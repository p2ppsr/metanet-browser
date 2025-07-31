/* eslint-disable react/no-unstable-nested-components */
const F = 'app/browser'
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { setWebViewMessageCallback, initializeFirebaseNotifications } from '@/utils/pushNotificationManager'
import { getPushSubscription } from '@/services/notificationBackendService'
import type { PendingNotification } from '@/hooks/usePushNotifications'
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  ScrollView,
  Modal as RNModal,
  BackHandler,
  ActivityIndicator
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { getPermissionScript } from '../utils/permissionScript'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview'
import Modal from 'react-native-modal'
import {
  GestureHandlerRootView,
  Swipeable,
  PanGestureHandler,
  State as GestureState
} from 'react-native-gesture-handler'
import { TabView, SceneMap } from 'react-native-tab-view'
import Fuse from 'fuse.js'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { observer } from 'mobx-react-lite'
import { router } from 'expo-router'

import { useTheme } from '@/context/theme/ThemeContext'
import { useWallet } from '@/context/WalletContext'
import { WalletInterface } from '@bsv/sdk'
import { RecommendedApps } from '@/components/RecommendedApps'
import { useLocalStorage } from '@/context/LocalStorageProvider'
import Balance from '@/components/Balance'
import type { Bookmark, HistoryEntry, Tab } from '@/shared/types/browser'
import { HistoryList } from '@/components/HistoryList'
import { isValidUrl } from '@/utils/generalHelpers'
import tabStore from '../stores/TabStore'
import bookmarkStore from '@/stores/BookmarkStore'
import {
  getPermissionState,
  setDomainPermission,
  checkPermissionForDomain,
  PermissionType,
  PermissionState,
  getDomainPermissions
} from '@/utils/permissionsManager'
import SettingsScreen from './settings'
import appConfig from '../app.json'
import IdentityScreen from './identity'
import { useTranslation } from 'react-i18next'
import { useBrowserMode } from '@/context/BrowserModeContext'
import { useLanguage } from '@/utils/translations'
import SecurityScreen from './security'
import TrustScreen from './trust'
import { uhrpHandler } from '@/utils/uhrpProtocol'

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                   */
/* -------------------------------------------------------------------------- */

import { getPendingUrl, clearPendingUrl } from '@/hooks/useDeepLinking'
import { useWebAppManifest } from '@/hooks/useWebAppManifest'
import UniversalScanner, { ScannerHandle } from '@/components/UniversalScanner'
import { logWithTimestamp } from '@/utils/logging'
import PermissionsScreen from '@/components/PermissionsScreen'
import PermissionModal from '@/components/PermissionModal'
import * as Notifications from 'expo-notifications'

/* -------------------------------------------------------------------------- */
/*                                   CONSTS                                   */
/* -------------------------------------------------------------------------- */
// Declare scanCodeWithCamera as an optional property on the Window type to make scanner trigger method accessible from injected JavaScript.
declare global {
  interface Window {
    scanCodeWithCamera?: (reason: string) => Promise<string>
  }
}
const kNEW_TAB_URL = 'about:blank'
const kGOOGLE_PREFIX = 'https://www.google.com/search?q='
const HISTORY_KEY = 'history'

function getInjectableJSMessage(message: any = {}) {
  const messageString = JSON.stringify(message)
  return `
    (function() {
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(${messageString})
      }));
    })();
  `
}

/* -------------------------------------------------------------------------- */
/*                                 COMPONENTS                                 */
/* -------------------------------------------------------------------------- */
function StarDrawer({
  BookmarksScene,
  HistoryScene,
  colors,
  styles,
  index,
  setIndex
}: {
  BookmarksScene: React.ComponentType
  HistoryScene: React.ComponentType
  colors: any
  styles: any
  index: number
  setIndex: (index: number) => void
}) {
  const { t } = useTranslation()
  const routes = useMemo(
    () => [
      { key: 'bookmarks', title: t('bookmarks') },
      { key: 'history', title: t('history') }
    ],
    [t]
  )
  const renderScene = useMemo(
    () =>
      SceneMap({
        bookmarks: BookmarksScene,
        history: HistoryScene
      }),
    [BookmarksScene, HistoryScene]
  )
  return (
    <View style={{ flex: 1 }}>
      <TabView
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderScene={renderScene}
        lazy={false}
        renderTabBar={props => (
          <View style={styles.starTabBar}>
            {props.navigationState.routes.map((r, i) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.starTab, i === index && { borderBottomColor: colors.primary }]}
                onPress={() => setIndex(i)}
              >
                <Text
                  style={[
                    styles.starTabLabel,
                    {
                      color: i === index ? colors.primary : colors.textSecondary
                    }
                  ]}
                >
                  {r.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  BROWSER                                   */
/* -------------------------------------------------------------------------- */

let renderCounter = 0

function Browser() {
  renderCounter++

  /* --------------------------- theme / basic hooks -------------------------- */
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const { isWeb2Mode } = useBrowserMode()

  /* ----------------------------- language headers ----------------------------- */
  // Map i18n language codes to proper HTTP Accept-Language header values
  const getAcceptLanguageHeader = useCallback(() => {
    const languageMap: Record<string, string> = {
      en: 'en-US,en;q=0.9',
      zh: 'zh-CN,zh;q=0.9,en;q=0.8',
      es: 'es-ES,es;q=0.9,en;q=0.8',
      hi: 'hi-IN,hi;q=0.9,en;q=0.8',
      fr: 'fr-FR,fr;q=0.9,en;q=0.8',
      ar: 'ar-SA,ar;q=0.9,en;q=0.8',
      pt: 'pt-BR,pt;q=0.9,en;q=0.8',
      bn: 'bn-BD,bn;q=0.9,en;q=0.8',
      ru: 'ru-RU,ru;q=0.9,en;q=0.8',
      id: 'id-ID,id;q=0.9,en;q=0.8'
    }

    const currentLanguage = i18n.language || 'en'
    return languageMap[currentLanguage] || 'en-US,en;q=0.9'
  }, [i18n.language])

  /* ---------------------------------- tabs --------------------------------- */
  const activeTab = tabStore.activeTab // Should never be null due to TabStore guarantees

  /* ----------------------------- push notifications ------------------------- */
  const { 
    requestPermission,
    showLocalNotification,
    pendingNotifications
  } = usePushNotifications()

  // WebView ref for notification forwarding
  const webViewRef = useRef<any>(null)

  /* ------------------------- WebView-Native Bridge ------------------------ */
  
  // Forward notifications from native FCM to WebView
  const forwardNotificationToWebView = useCallback((notification: PendingNotification) => {
    if (webViewRef.current && activeTab && activeTab.url) {
      const domain = domainForUrl(activeTab.url)
      
      // Only forward if notification is for the current domain
      if (domain && notification.origin === domain) {
        console.log('🌉 Forwarding FCM notification to WebView:', notification)
        
        // Inject JavaScript to trigger push event in WebView
        const jsCode = `
          (function() {
            try {
              if (window.navigator && window.navigator.serviceWorker) {
                // Dispatch push event to service worker if available
                const event = new Event('push');
                event.data = {
                  json: () => (${JSON.stringify({
                    title: notification.title,
                    body: notification.body,
                    data: notification.data
                  })})
                };
                window.dispatchEvent(event);
              }
              
              // Also trigger any custom  listeners
              window.dispatchEvent(new CustomEvent('metanet-push-notification', {
                detail: ${JSON.stringify(notification)}
              }));
              
              console.log('✅ Push notification forwarded to WebView');
            } catch (error) {
              console.error('❌ Error forwarding push notification:', error);
            }
          })()
        `;
        
        webViewRef.current.injectJavaScript(jsCode);
      }
    }
  }, [activeTab?.url])

  // Initialize notification system and set up bridge
  useEffect(() => {
    console.log('🚀 Initializing WebView-Native notification bridge')
    
    // Initialize Firebase notifications
    initializeFirebaseNotifications().catch(console.error)
    
    // Set callback for FCM notifications to forward to WebView
    setWebViewMessageCallback(forwardNotificationToWebView)
    
    return () => {
      // Clean up callback on unmount
      setWebViewMessageCallback(() => {})
    }
  }, [forwardNotificationToWebView])

  /* ----------------------------- permissions ----------------------------- */

  const updateDeniedPermissionsForDomain = useCallback(async (url: string) => {
    try {
      const domain = domainForUrl(url)
      const allPermissions: PermissionType[] = ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION']
      const deniedPermissions: PermissionType[] = []

      // Check each permission
      for (const permission of allPermissions) {
        const state = await getPermissionState(domain, permission)
        if (state === 'deny') {
          deniedPermissions.push(permission)
        }
      }

      // Log the denied permissions for debugging
      console.log(`Permissions denied for ${domain}:`, deniedPermissions)

      // Update the state variable that's used in the injected JavaScript
      setPermissionsDeniedForCurrentDomain(deniedPermissions)

      // If we have an active WebView and we're on this domain currently,
      // we could trigger a reload to apply the new permission settings
      // Alternatively, we let navigation events handle refreshing
    } catch (error) {
      console.error('Failed to update denied permissions:', error)
    }
  }, [])

  const showPermissionModal = useCallback(
    (domain: string, permission: PermissionType, callback: (granted: boolean) => void) => {
      console.log(`[showPermissionModal] Opening modal for ${domain} with permission ${permission}`)
      setPendingDomain(domain)
      setPendingPermission(permission)
      setPendingCallback(() => callback)
      setPermissionModalVisible(true)
      console.log(`[showPermissionModal] Modal visibility set to true`)
    },
    []
  )

  // Helper function to check OS level permissions
  const checkOSPermission = useCallback(async (permission: PermissionType): Promise<boolean> => {
    // This function would call the appropriate OS-level permission checks using react-native-permissions
    // For demonstration, we're simplifying this
    console.log(`[OS Permission Check] Checking ${permission} permission`)
    return true // Assume permission is granted at OS level for demonstration
  }, [])

  const promptUserForPermission = useCallback(
    async (domain: string, permission: PermissionType): Promise<boolean> => {
      console.log(`[Permission Request] Attempting to prompt user for ${permission} on ${domain}`)
      return new Promise(resolve => {
        // First check if we already have a domain-specific permission set
        getPermissionState(domain, permission).then(async domainPermission => {
          console.log(`[Permission Check] Domain ${domain} permission for ${permission}: ${domainPermission}`)

          if (domainPermission === 'deny') {
            // If already denied for this domain, don't show modal
            console.log(`[Permission] Already denied for domain ${domain}`)
            resolve(false)
            return
          }

          if (domainPermission === 'allow') {
            // If already allowed for this domain, check OS permission
            const osGranted = await checkOSPermission(permission)
            resolve(osGranted)
            return
          }

          // Otherwise show the modal (domainPermission is 'ask' or undefined)
          console.log(`[Permission] Setting up modal for ${domain} for ${permission}`)

          // Directly set modal state instead of using showPermissionModal
          setPendingDomain(domain)
          setPendingPermission(permission)
          setPendingCallback((granted: boolean) => {
            console.log(`[Permission] User responded to prompt: ${granted ? 'granted' : 'denied'}`)
            if (granted) {
              // If user allowed, check OS permission
              checkOSPermission(permission).then(osGranted => {
                if (!osGranted) {
                  console.log(`[Permission] OS denied ${permission} even though domain was allowed`)
                }
                resolve(osGranted)
              })
            } else {
              // User denied in the modal
              resolve(false)
            }
          })

          // Force modal visibility in next tick to ensure state updates
          setTimeout(() => {
            console.log('[Permission] Setting modal to visible')
            setPermissionModalVisible(true)
          }, 0)
        })
      })
    },
    [checkOSPermission]
  )

  /* ----------------------------- wallet context ----------------------------- */
  const { managers } = useWallet()
  const [wallet, setWallet] = useState<WalletInterface | undefined>()
  useEffect(() => {
    // Only initialize wallet if not in web2 mode
    if (!isWeb2Mode && managers?.walletManager?.authenticated) {
      setWallet(managers.walletManager)
    } else if (isWeb2Mode) {
      setWallet(undefined)
    }
  }, [managers, isWeb2Mode])

  /* ---------------------------- storage helpers ----------------------------- */
  const { getItem, setItem } = useLocalStorage()

  /* -------------------------------- history -------------------------------- */
  const loadHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    const raw = await getItem(HISTORY_KEY)
    const data = raw ? (JSON.parse(raw) as HistoryEntry[]) : []
    return data.map(h => ({
      ...h,
      url: isValidUrl(h.url) ? h.url : kNEW_TAB_URL
    }))
  }, [getItem])

  const [history, setHistory] = useState<HistoryEntry[]>([])
  useEffect(() => {
    loadHistory().then(setHistory)
  }, [loadHistory])

  const saveHistory = useCallback(
    async (list: HistoryEntry[]) => {
      setHistory(list)
      await setItem(HISTORY_KEY, JSON.stringify(list))
    },
    [setItem]
  )

  const pushHistory = useCallback(
    async (entry: HistoryEntry) => {
      if (history.length && history[0].url.replace(/\/$/, '') === entry.url.replace(/\/$/, '')) return
      const next = [entry, ...history].slice(0, 500)
      await saveHistory(next)
    },
    [history, saveHistory]
  )

  const removeHistoryItem = useCallback(
    async (url: string) => {
      const next = history.filter(h => h.url !== url)
      await saveHistory(next)
    },
    [history, saveHistory]
  )

  const clearHistory = useCallback(async () => {
    await saveHistory([])
  }, [saveHistory])

  /* -------------------------------- bookmarks ------------------------------- */
  const [removedDefaultApps, setRemovedDefaultApps] = useState<string[]>([])

  // Homepage customization settings
  const [homepageSettings, setHomepageSettings] = useState({
    showBookmarks: true,
    showRecentApps: true,
    showRecommendedApps: true
  })

  // Load homepage settings from storage
  useEffect(() => {
    const loadHomepageSettings = async () => {
      try {
        const savedSettings = await getItem('homepageSettings')
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings)
          setHomepageSettings(prev => ({ ...prev, ...parsedSettings }))
        }
      } catch (error) {
        console.error('Error loading homepage settings:', error)
      }
    }
    loadHomepageSettings()
  }, [getItem])

  const updateHomepageSettings = useCallback(
    async (newSettings: Partial<typeof homepageSettings>) => {
      const updatedSettings = { ...homepageSettings, ...newSettings }
      setHomepageSettings(updatedSettings)
      try {
        await setItem('homepageSettings', JSON.stringify(updatedSettings))
      } catch (error) {
        console.error('Error saving homepage settings:', error)
      }
    },
    [homepageSettings, setItem]
  )

  const addBookmark = useCallback((title: string, url: string) => {
    // Only add bookmarks for valid URLs that aren't the new tab page
    if (url && url !== kNEW_TAB_URL && isValidUrl(url) && !url.includes('about:blank')) {
      bookmarkStore.addBookmark(title, url)
    }
  }, [])

  const removeBookmark = useCallback((url: string) => {
    bookmarkStore.removeBookmark(url)
  }, [])

  const removeDefaultApp = useCallback((url: string) => {
    setRemovedDefaultApps(prev => [...prev, url])
  }, [])

  /* -------------------------- ui / animation state -------------------------- */
  const addressEditing = useRef(false)
  const lastNavStateRef = useRef<WebViewNavigation | null>(null)
  const lastNavStateTimestamp = useRef<number>(0)
  const [addressText, setAddressText] = useState(kNEW_TAB_URL)
  const [addressFocused, setAddressFocused] = useState(false)
  const [addressBarHeight, setAddressBarHeight] = useState(0)

  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [mobileControlsHeight, setMobileControlsHeight] = useState(0)

  // Permission-related state variables
  const [permissionsDeniedForCurrentDomain, setPermissionsDeniedForCurrentDomain] = useState<PermissionType[]>([])

  // Handler for when permissions are changed from the PermissionsScreen
  const handlePermissionChangeFromScreen = useCallback(
    async (permission: PermissionType, state: PermissionState) => {
      console.log(`[Browser] Permission changed in PermissionsScreen: ${permission} -> ${state}`)

      // Update the WebView with the new permission state
      if (tabStore.activeTab?.webviewRef?.current && tabStore.activeTab.url) {
        // Update the denied permissions list for the current domain
        await updateDeniedPermissionsForDomain(tabStore.activeTab.url)
        const domain = new URL(tabStore.activeTab.url).hostname
        console.log(`[Browser] Updated denied permissions for ${domain}`)

        // Inject JavaScript to update the WebView's permissions immediately
        if (tabStore.activeTab?.webviewRef?.current) {
          const updateScript = `
          (function() {
            // Override console.log to send logs to React Native terminal
            const originalConsoleLog = console.log;
            console.log = function(...args) {
              const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ');
              
              // Send to React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'console_log',
                  message: message
                }));
              }
              
              // Also call original console.log for any native browser dev tools
              originalConsoleLog.apply(console, args);
            };
            
            console.log('[Metanet] Updating permission: ${permission} to ${state}');
            
            // Update the denied permissions list
            window.__metanetDeniedPermissions = ${JSON.stringify(permissionsDeniedForCurrentDomain)};
            
            // Check if we need to update specific API overrides
            if ('${permission}' === 'CAMERA' || '${permission}' === 'RECORD_AUDIO') {
              // Restore original getUserMedia if permissions are now allowed
              if ('${state}' === 'allow' && navigator.mediaDevices.__originalGetUserMedia) {
                console.log('[Metanet] Restoring original getUserMedia for ${permission}');
                navigator.mediaDevices.getUserMedia = navigator.mediaDevices.__originalGetUserMedia;
              } 
              // Override getUserMedia if permissions are now denied
              else if ('${state}' === 'deny') {
                console.log('[Metanet] Overriding getUserMedia for ${permission}');
                if (!navigator.mediaDevices.__originalGetUserMedia) {
                  navigator.mediaDevices.__originalGetUserMedia = navigator.mediaDevices.getUserMedia;
                }
                navigator.mediaDevices.getUserMedia = function(constraints) {
                  if ('${permission}' === 'CAMERA' && constraints && constraints.video) {
                    return Promise.reject(new DOMException('Camera access denied by site settings', 'NotAllowedError'));
                  }
                  if ('${permission}' === 'RECORD_AUDIO' && constraints && constraints.audio) {
                    return Promise.reject(new DOMException('Microphone access denied by site settings', 'NotAllowedError'));
                  }
                  return navigator.mediaDevices.__originalGetUserMedia.call(navigator.mediaDevices, constraints);
                };
              }
            }
            
            // Handle location permission changes
            if ('${permission}' === 'ACCESS_FINE_LOCATION') {
              if ('${state}' === 'allow') {
                // Restore original geolocation methods if permissions are now allowed
                console.log('[Metanet] Restoring original geolocation methods');
                if (navigator.geolocation.__originalGetCurrentPosition) {
                  navigator.geolocation.getCurrentPosition = navigator.geolocation.__originalGetCurrentPosition;
                }
                if (navigator.geolocation.__originalWatchPosition) {
                  navigator.geolocation.watchPosition = navigator.geolocation.__originalWatchPosition;
                }
              } else if ('${state}' === 'deny') {
                // Override geolocation methods if permissions are now denied
                console.log('[Metanet] Overriding geolocation methods');
                if (!navigator.geolocation.__originalGetCurrentPosition) {
                  navigator.geolocation.__originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                }
                if (!navigator.geolocation.__originalWatchPosition) {
                  navigator.geolocation.__originalWatchPosition = navigator.geolocation.watchPosition;
                }
                
                navigator.geolocation.getCurrentPosition = function(success, error) {
                  if (error) {
                    error(new Error('Location access denied by site settings'));
                  }
                  return undefined;
                };
                
                navigator.geolocation.watchPosition = function(success, error) {
                  if (error) {
                    error(new Error('Location access denied by site settings'));
                  }
                  return 0; // Return a fake watch ID
                };
              }
            }
            
            // Notify the page about the permission change
            const event = new CustomEvent('permissionchange', { 
              detail: { permission: '${permission}', state: '${state}' }
            });
            document.dispatchEvent(event);
            console.log('[Metanet] Dispatched permissionchange event for ${permission}');
          })();
        `
          tabStore.activeTab.webviewRef.current.injectJavaScript(updateScript)
          console.log(`[Browser] Injected permission update script for ${permission}`)
        }
      }
    },
    [permissionsDeniedForCurrentDomain]
  )

  const [permissionModalVisible, setPermissionModalVisible] = useState(false)
  const [pendingPermission, setPendingPermission] = useState<PermissionType | null>(null)
  const [pendingDomain, setPendingDomain] = useState<string | null>(null)
  const [pendingCallback, setPendingCallback] = useState<((granted: boolean) => void) | null>(null)

  const [showInfoDrawer, setShowInfoDrawer] = useState(false)
  const [infoDrawerRoute, setInfoDrawerRoute] = useState<
    'root' | 'identity' | 'settings' | 'security' | 'trust' | 'permissions'
  >('root')
  const drawerAnim = useRef(new Animated.Value(0)).current

  const [showTabsView, setShowTabsView] = useState(false)
  const [showStarDrawer, setShowStarDrawer] = useState(false)
  const [starTabIndex, setStarTabIndex] = useState(0)
  const starDrawerAnim = useRef(new Animated.Value(0)).current
  const [isDesktopView, setIsDesktopView] = useState(false)
  const [isToggleDesktopCooldown, setIsToggleDesktopCooldown] = useState(false)

  // Orientation handling
  const [orientation, setOrientation] = useState('portrait')
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'))

  // Handle orientation changes
  useEffect(() => {
    const updateOrientation = () => {
      const windowDimensions = Dimensions.get('window')
      setScreenDimensions(windowDimensions)
      const newOrientation = windowDimensions.width > windowDimensions.height ? 'landscape' : 'portrait'
      setOrientation(newOrientation)
      console.log(`📱 Orientation changed to: ${newOrientation} (${windowDimensions.width}x${windowDimensions.height})`)
    }

    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', updateOrientation)

    // Initial check
    updateOrientation()

    return () => {
      subscription?.remove()
    }
  }, [])

  const addressInputRef = useRef<TextInput>(null)
  const [consoleLogs, setConsoleLogs] = useState<any[]>([])
  const { manifest, fetchManifest, getStartUrl, shouldRedirectToStartUrl } = useWebAppManifest()
  const [showBalance, setShowBalance] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uhrpLoading, setUhrpLoading] = useState<string | null>(null)

  // Fullscreen management for iOS and Android
  const enterFullscreen = useCallback(async () => {
    try {
      setIsFullscreen(true)
      console.log('Entering fullscreen mode')
    } catch (error) {
      console.warn('Failed to enter fullscreen:', error)
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      setIsFullscreen(false)
      console.log('Exiting fullscreen mode')
    } catch (error) {
      console.warn('Failed to exit fullscreen:', error)
    }
  }, [])

  // Safety check - if somehow activeTab is null, force create a new tab
  // This is done after all hooks to avoid violating Rules of Hooks
  useEffect(() => {
    if (!activeTab) {
      console.warn('activeTab is null, creating new tab')
      tabStore.newTab()
    }
  }, [activeTab])

  // Balance handling - only delay on first open
  useEffect(() => {
    if (showInfoDrawer && infoDrawerRoute === 'root') {
      const t = setTimeout(() => setShowBalance(true), 260) // shorter delay
      return () => clearTimeout(t)
    } else {
      setShowBalance(false)
    }
  }, [showInfoDrawer, infoDrawerRoute])

  /* ------------------------------ keyboard hook ----------------------------- */
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardVisible(true)
      const height = event.endCoordinates.height
      setKeyboardHeight(height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false)
      setKeyboardHeight(0)
      if (addressInputRef.current) {
      }
      addressInputRef.current?.blur()
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Deep linking useEffect
  useEffect(() => {
    const checkPendingUrl = async () => {
      try {
        const pendingUrl = await getPendingUrl()
        console.log('🔗 [Browser] Checking for pending URL:', pendingUrl)
        if (pendingUrl) {
          console.log('🔗 [Browser] Loading pending URL from deep link:', pendingUrl)

          // Check if this is a UHRP URL that needs special handling
          if (uhrpHandler.isUHRPUrl(pendingUrl)) {
            console.log('🔗 [Browser] Pending URL is UHRP, resolving first:', pendingUrl)
            try {
              const resolvedContent = await uhrpHandler.resolveUHRPUrl(pendingUrl)
              console.log('🔗 [UHRP] Resolved to HTTP URL with MIME type:', resolvedContent.mimeType)

              // Navigate directly to the resolved HTTP URL
              if (resolvedContent.resolvedUrl) {
                updateActiveTab({ url: resolvedContent.resolvedUrl })
                setAddressText(pendingUrl) // Keep original UHRP URL in address bar
              }
            } catch (error: any) {
              console.error('🔗 [Browser] UHRP resolution failed:', error)

              // Show error page for failed UHRP resolution
              updateActiveTab({ url: pendingUrl })
              setAddressText(pendingUrl)

              const errorHtml = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>UHRP Error</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                        text-align: center; 
                        padding: 50px 20px; 
                        background: #f5f5f5;
                        color: #333;
                      }
                      .container { 
                        max-width: 400px; 
                        margin: 0 auto; 
                        background: white; 
                        padding: 30px; 
                        border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                      }
                      h2 { color: #e74c3c; margin-bottom: 20px; }
                      .url { background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; margin: 20px 0; }
                      button { 
                        background: #007AFF; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        font-size: 16px; 
                        cursor: pointer;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h2>Failed to load UHRP content</h2>
                      <div class="url">${pendingUrl}</div>
                      <p>Error: ${error.message || 'Unknown error occurred while resolving UHRP URL'}</p>
                      <button onclick="window.location.href='about:blank'">Go to Homepage</button>
                    </div>
                  </body>
                </html>
              `

              setTimeout(() => {
                const currentTab = tabStore.activeTab
                if (currentTab?.webviewRef?.current) {
                  currentTab.webviewRef.current.injectJavaScript(`
                    document.open();
                    document.write(\`${errorHtml.replace(/`/g, '\\`')}\`);
                    document.close();
                    true; // Required for iOS
                  `)
                }
              }, 1000)
            }
          } else {
            // Regular URL handling
            updateActiveTab({ url: pendingUrl })
            setAddressText(pendingUrl)
          }

          await clearPendingUrl()
          console.log('🔗 [Browser] Pending URL cleared')
        }
      } catch (error) {
        console.error('Error checking pending URL:', error)
      }
    }

    checkPendingUrl()
    const timer = setTimeout(checkPendingUrl, 500)
    return () => clearTimeout(timer)
  }, [])

  // Manifest checking useEffect
  useEffect(() => {
    if (!activeTab) return

    let isCancelled = false

    const handleManifest = async () => {
      if (activeTab.url === kNEW_TAB_URL || !activeTab.url.startsWith('http') || activeTab.isLoading) {
        return
      }

      if (isCancelled) return

      // console.log('Checking manifest for:', activeTab.url);

      try {
        const manifestData = await fetchManifest(activeTab.url)

        if (isCancelled) return

        if (manifestData) {
          // console.log('Found manifest for', activeTab.url, manifestData);

          if (manifestData.babbage?.protocolPermissions) {
            // console.log('Found Babbage protocol permissions:', manifestData.babbage.protocolPermissions);
          }

          const url = new URL(activeTab.url)
          if (shouldRedirectToStartUrl(manifestData, activeTab.url) && url.pathname === '/') {
            const startUrl = getStartUrl(manifestData, activeTab.url)
            // console.log('Redirecting to start_url:', startUrl);
            updateActiveTab({ url: startUrl })
            setAddressText(startUrl)
          }
        }
      } catch (error) {
        console.error('Error in manifest handling:', error)
      }
    }

    const timeoutId = setTimeout(() => {
      if (activeTab && !activeTab.isLoading && activeTab.url !== kNEW_TAB_URL && activeTab.url.startsWith('http')) {
        handleManifest()
      }
    }, 1000)

    return () => {
      isCancelled = true
      clearTimeout(timeoutId)
    }
  }, [activeTab])

  // Language change useEffect - reload WebView when language changes
  useEffect(() => {
    if (activeTab && activeTab.webviewRef?.current && activeTab.url !== kNEW_TAB_URL) {
      // Force reload WebView with new language headers
      activeTab.webviewRef.current.reload()
    }
  }, [i18n.language, activeTab])

  // Debug logging for WebView re-renders and navigation tracking
  useEffect(() => {
    console.log('🔄 [WEBVIEW_RENDER] WebView component may re-render due to activeTab change:', {
      activeTabId: activeTab?.id,
      activeTabUrl: activeTab?.url,
      isDesktopView,
      timestamp: new Date().toISOString()
    })
  }, [activeTab?.id, activeTab?.url, isDesktopView])

  // Track when the userAgent changes (could cause re-render)
  useEffect(() => {
    console.log('👤 [USER_AGENT_CHANGE] User agent changed:', {
      newUserAgent: isDesktopView ? 'desktop' : 'mobile',
      isDesktopView,
      activeTabUrl: activeTab?.url,
      timestamp: new Date().toISOString()
    })
  }, [isDesktopView])

  /* -------------------------------------------------------------------------- */
  /*                                 UTILITIES                                  */
  /* -------------------------------------------------------------------------- */
  const domainForUrl = useCallback((u: string): string => {
    try {
      if (u === kNEW_TAB_URL) return ''
      const { hostname } = new URL(u)
      return hostname
    } catch {
      return u
    }
  }, [])

  /* -------------------------------------------------------------------------- */
  /*                              ADDRESS HANDLING                              */
  /* -------------------------------------------------------------------------- */

  const updateActiveTab = useCallback((patch: Partial<Tab>) => {
    console.log('📝 [UPDATE_ACTIVE_TAB] Tab update requested:', {
      patch,
      currentActiveTabId: tabStore.activeTabId,
      currentUrl: tabStore.activeTab?.url,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    })

    // Handle URL updates with strict null safety
    if ('url' in patch) {
      const newUrl = patch.url
      if (!newUrl || newUrl === null || newUrl === undefined) {
        console.log('📝 [UPDATE_ACTIVE_TAB] Null/undefined URL detected, setting to new tab URL:', {
          originalUrl: newUrl,
          redirectTo: kNEW_TAB_URL,
          timestamp: new Date().toISOString()
        })
        patch.url = kNEW_TAB_URL
      } else if (!isValidUrl(newUrl) && newUrl !== kNEW_TAB_URL) {
        console.log('📝 [UPDATE_ACTIVE_TAB] Invalid URL detected, redirecting to new tab:', {
          originalUrl: newUrl,
          redirectTo: kNEW_TAB_URL,
          timestamp: new Date().toISOString()
        })
        patch.url = kNEW_TAB_URL
      }
    }

    const finalUrl = patch.url
    if (finalUrl) {
      console.log('📝 [UPDATE_ACTIVE_TAB] URL change will trigger WebView navigation:', {
        from: tabStore.activeTab?.url,
        to: finalUrl,
        tabId: tabStore.activeTabId,
        timestamp: new Date().toISOString()
      })
    }

    tabStore.updateTab(tabStore.activeTabId, patch)
  }, [])

  const onAddressSubmit = useCallback(() => {
    console.log('🚀 [ADDRESS_SUBMIT] Starting address submission:', {
      originalInput: addressText,
      timestamp: new Date().toISOString(),
      activeTabId: tabStore.activeTabId
    })

    let entry = addressText.trim()

    // Check if this is a UHRP URL first
    if (uhrpHandler.isUHRPUrl(entry)) {
      // Set loading state
      setUhrpLoading(entry)

      // Handle UHRP URL directly in the browser
      ;(async () => {
        try {
          const resolvedContent = await uhrpHandler.resolveUHRPUrl(entry)

          // Navigate to the resolved HTTP URL
          if (resolvedContent.resolvedUrl) {
            // Update the address bar to show the original UHRP URL
            setAddressText(entry)

            // Navigate to the resolved URL using the same method as normal navigation
            updateActiveTab({ url: resolvedContent.resolvedUrl })
          }
        } catch (error: any) {
          // Show error in WebView
          const errorHtml = `
            <html>
              <head><title>UHRP Error</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2>Failed to load UHRP content</h2>
                <p>URL: ${entry}</p>
                <p>Error: ${error.message || 'Unknown error'}</p>
                <button onclick="history.back()">Go Back</button>
              </body>
            </html>
          `

          // Navigate to data URL with error content
          updateActiveTab({ url: `data:text/html,${encodeURIComponent(errorHtml)}` })
        } finally {
          // Clear loading state
          setUhrpLoading(null)
        }
      })()

      return // Exit early for UHRP URLs
    }

    const isProbablyUrl = /^([a-z]+:\/\/|www\.|([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})(\/|$)/i.test(entry)

    if (entry === '') entry = kNEW_TAB_URL
    else if (!isProbablyUrl) entry = kGOOGLE_PREFIX + encodeURIComponent(entry)
    else if (!/^[a-z]+:\/\//i.test(entry)) entry = 'https://' + entry

    if (!isValidUrl(entry)) {
      entry = kNEW_TAB_URL
    }

    updateActiveTab({ url: entry })
    addressEditing.current = false
  }, [addressText, updateActiveTab])

  /* -------------------------------------------------------------------------- */
  /*                               TAB NAVIGATION                               */
  /* -------------------------------------------------------------------------- */
  const navBack = useCallback(() => {
    const currentTab = tabStore.activeTab
    if (currentTab && currentTab.canGoBack) {
      tabStore.goBack(currentTab.id)
    }
  }, [])

  const navFwd = useCallback(() => {
    const currentTab = tabStore.activeTab
    if (currentTab && currentTab.canGoForward) {
      tabStore.goForward(currentTab.id)
    }
  }, [])

  const navReloadOrStop = useCallback(() => {
    const currentTab = tabStore.activeTab
    if (!currentTab) return

    if (currentTab.isLoading) {
      return currentTab.webviewRef?.current?.stopLoading()
    } else {
      return currentTab.webviewRef?.current?.reload()
    }
  }, [])

  const toggleDesktopView = useCallback(() => {
    // Prevent multiple rapid presses during cooldown
    if (isToggleDesktopCooldown) return

    const currentTab = tabStore.activeTab

    setIsToggleDesktopCooldown(true)
    setIsDesktopView(prev => !prev)

    // Reload the current page to apply the new user agent
    if (currentTab && currentTab.url !== kNEW_TAB_URL) {
      currentTab.webviewRef?.current?.reload()
    }

    // Reset cooldown after reload animation/loading time
    setTimeout(() => {
      setIsToggleDesktopCooldown(false)
    }, 1500) // 1.5 second cooldown to allow for reload
  }, [isToggleDesktopCooldown])

  // User agent strings
  const getMobileUserAgent = () => {
    const osVersion = Platform.Version
    if (Platform.OS === 'ios') {
      // Convert iOS version to underscored format (e.g., 16.0 -> 16_0)
      const iosVersion = typeof osVersion === 'string' ? osVersion.replace(/\./g, '_') : '16_0'
      return `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1 `
    } else {
      // Android version is typically a number
      const androidVersion = typeof osVersion === 'number' ? osVersion : 13
      return `Mozilla/5.0 (Linux; Android ${androidVersion}; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 `
    }
  }

  const getDesktopUserAgent = () => {
    if (Platform.OS === 'ios') {
      // Use standard macOS Safari for maximum compatibility
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15 }`
    } else {
      // Use standard Windows Chrome for maximum compatibility
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 }`
    }
  }
  const mobileUserAgent = getMobileUserAgent()
  const desktopUserAgent = getDesktopUserAgent()

  useEffect(() => {
    if (tabStore.tabs.length === 0) {
      tabStore.newTab()
    }
  }, [])
  useEffect(() => {
    if (activeTab && !addressEditing.current) {
      setAddressText(activeTab.url)
    }
  }, [activeTab])

  const dismissKeyboard = useCallback(() => {
    addressInputRef.current?.blur()
    Keyboard.dismiss()
  }, [])

  const responderProps =
    addressFocused && keyboardVisible
      ? {
          onStartShouldSetResponder: () => true,
          onResponderRelease: dismissKeyboard
        }
      : {}

  /* -------------------------------------------------------------------------- */
  /*                           WEBVIEW MESSAGE HANDLER                          */
  /* -------------------------------------------------------------------------- */

  // === 1. Injected JS ============================================
  const injectedJavaScript = useMemo(
    () => `
  // Notification API polyfill is now in permissionScript.ts (runs before content loads)
  // This section handles other runtime JavaScript functionality

    // Fullscreen API polyfill
    if (!document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen = function() {
        return new Promise((resolve, reject) => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'REQUEST_FULLSCREEN'
          }));
          
          const handler = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'FULLSCREEN_RESPONSE') {
                window.removeEventListener('message', handler);
                if (data.success) {
                  resolve();
                } else {
                  reject(new Error('Fullscreen request denied'));
                }
              }
            } catch (e) {}
          };
          window.addEventListener('message', handler);
        });
      };
    }

    if (!document.exitFullscreen) {
      document.exitFullscreen = function() {
        return new Promise((resolve) => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'EXIT_FULLSCREEN'
          }));
          
          const handler = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'FULLSCREEN_RESPONSE') {
                window.removeEventListener('message', handler);
                resolve();
              }
            } catch (e) {}
          };
          window.addEventListener('message', handler);
        });
      };
    }

    // Define fullscreen properties
    Object.defineProperty(document, 'fullscreenElement', {
      get: function() {
        return window.__fullscreenElement || null;
      }
    });

    Object.defineProperty(document, 'fullscreen', {
      get: function() {
        return !!window.__fullscreenElement;
      }
    });

    // Listen for fullscreen changes from native
    window.addEventListener('message', function(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'FULLSCREEN_CHANGE') {
          window.__fullscreenElement = data.isFullscreen ? document.documentElement : null;
          document.dispatchEvent(new Event('fullscreenchange'));
        }
      } catch (e) {}
    });

    // Console logging
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    console.log = function(...args) {
      originalLog.apply(console, args);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'CONSOLE',
        method: 'log',
        args: args
      }));
    };

    console.warn = function(...args) {
      originalWarn.apply(console, args);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'CONSOLE',
        method: 'warn',
        args: args
      }));
    };

    console.error = function(...args) {
      originalError.apply(console, args);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'CONSOLE',
        method: 'error',
        args: args
      }));
    };

    console.info = function(...args) {
      originalInfo.apply(console, args);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'CONSOLE',
        method: 'info',
        args: args
      }));
    };

    console.debug = function(...args) {
      originalDebug.apply(console, args);
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'CONSOLE',
        method: 'debug',
        args: args
      }));
    };

    // Intercept fetch requests to add Accept-Language header
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
      // Get current language header from React Native
      const acceptLanguage = '${getAcceptLanguageHeader()}';
      
      // Merge headers
      const headers = new Headers(init.headers);
      if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', acceptLanguage);
      }
      
      // Update init with new headers
      const newInit = {
        ...init,
        headers: headers
      };
      
      return originalFetch.call(this, input, newInit);
    };

    // Also intercept XMLHttpRequest for older APIs
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      this._method = method;
      this._url = url;
      return originalXHROpen.call(this, method, url, async, user, password);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
      // Add Accept-Language header if not already set
      if (!this.getRequestHeader('Accept-Language')) {
        const acceptLanguage = '${getAcceptLanguageHeader()}';
        this.setRequestHeader('Accept-Language', acceptLanguage);
      }
      return originalXHRSend.call(this, data);
    };
  })();
  true;
`,
    [getAcceptLanguageHeader]
  )

  // === 2. RN ⇄ WebView message bridge ========================================
  // Manages the scanner overlay state and timeout handling
  const [scannedData, setScannedData] = useState<string | null>(null)
  const [scannerFullscreen, setScannerFullscreen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const scanResolver = useRef<((data: string) => void) | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scannerRef = useRef<ScannerHandle>(null)

  // Hook with required with cleanup after unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      scanResolver.current = null
      setShowScanner(false)
    }
  }, [])

  // Uses callback to send cancel message to webview and cleans up scanner state
  const dismissScanner = useCallback(() => {
    if (scanResolver.current) {
      logWithTimestamp(F, 'Resolving scan promise with empty string')
      scanResolver.current('')
      scanResolver.current = null
    }

    // Inject CANCEL_SCAN event into WebView to resolve window.scanCodeWithCamera
    if (activeTab?.webviewRef?.current) {
      logWithTimestamp(F, `Injecting CANCEL_SCAN to WebView at ${activeTab.url}`)
      activeTab.webviewRef.current.injectJavaScript(`
        window.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'CANCEL_SCAN',
            result: 'dismiss'
          })
        }));
        true;
      `)
    } else {
      logWithTimestamp(F, 'WebView ref is missing — cannot send CANCEL_SCAN')
    }

    setShowScanner(false)

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    logWithTimestamp(F, 'Scanner dismissed programmatically')
  }, [activeTab])

  // Resolves the scan promise and resets scanner state
  useEffect(() => {
    if (scannedData && scanResolver.current) {
      logWithTimestamp(F, 'Scan data received', { scannedData })
      scanResolver.current(scannedData)
      scanResolver.current = null
      setScannedData(null)
      setShowScanner(false)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
    }
  }, [scannedData])

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      logWithTimestamp(F, `handleMessage:event=${JSON.stringify(event)}`)
      logWithTimestamp(F, `handleMessage:activeTab=${JSON.stringify(activeTab)}`)
      logWithTimestamp(
        F,
        `handleMessage:activeTab.webviewRef?.current=${JSON.stringify(activeTab!.webviewRef?.current)}`
      )
      // Safety check - if activeTab is undefined, we cannot process messages
      if (!activeTab) {
        console.warn('Cannot process WebView message: activeTab is undefined')
        return
      }

      const sendResponseToWebView = (id: string, result: any) => {
        if (!activeTab || !activeTab.webviewRef?.current) return

        const message = {
          type: 'CWI',
          id,
          isInvocation: false,
          result,
          status: 'ok'
        }

        activeTab.webviewRef.current.injectJavaScript(getInjectableJSMessage(message))
      }

      let msg
      try {
        msg = JSON.parse(event.nativeEvent.data)
        
        // Handle console log messages from injected JavaScript
        if (msg.type === 'console_log') {
          console.log(`[WebView Console] ${msg.message}`)
          return
        }
        
        console.log(`[WebView Message] Received message of type: ${msg?.type}`, JSON.stringify(msg))
      } catch (error) {
        console.error('Failed to parse WebView message:', error)
        return
      }
      logWithTimestamp(F, `handleMessage:msg.type=${msg.type}`)
      // Checks for split-screen or fullscreen camera scanning
      if (msg.type === 'REQUEST_SCAN') {
        logWithTimestamp(F, `handleMessage:msg=${JSON.stringify(msg)}`)
        const fullscreen = typeof msg.reason === 'string' && msg.reason.toLowerCase().includes('fullscreen')
        logWithTimestamp(F, `handleMessage:fullscreen=${fullscreen}`)
        setScannerFullscreen(fullscreen)
        setShowScanner(true)
        return
      }

      // Helper function to send permission results to WebView
      const sendPermissionResultToWebView = (permissionType: string, granted: boolean) => {
        if (!activeTab?.webviewRef?.current) return

        activeTab.webviewRef.current.injectJavaScript(`
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: '${permissionType}_PERMISSION_RESULT',
              granted: ${granted}
            })
          }));
        `)
      }

      // Generic permission request handler
      const handlePermissionRequest = async (
        messageType: string,
        permissionType: PermissionType,
        resultType: string
      ) => {
        console.log(
          `[PERMISSION DEBUG] Starting handlePermissionRequest for ${messageType}, ${permissionType}, ${resultType}`
        )
        try {
          const domain = domainForUrl(activeTab.url)
          console.log(`[${messageType}] Permission request from ${domain} for ${permissionType}`)
          console.log(`[PERMISSION DEBUG] Active tab URL: ${activeTab?.url || 'undefined'}`)
          console.log(`[PERMISSION DEBUG] Domain extracted: ${domain}`)
          if (!domain) {
            console.error(`[PERMISSION ERROR] Cannot get domain from URL: ${activeTab?.url}`)
            sendPermissionResultToWebView(resultType, false)
            return
          }

          // Check the domain-specific permission state
          const permState = await getPermissionState(domain, permissionType)
          console.log(`[${messageType}] Domain permission state: ${permState}`)

          if (permState === 'deny') {
            // If explicitly denied for this domain, reject immediately
            console.log(`[${messageType}] Permission already denied for ${domain}, rejecting request`)
            sendPermissionResultToWebView(resultType, false)
            return
          }

          if (permState === 'allow') {
            // If allowed for this domain, check OS permission
            console.log(`[${messageType}] Permission already allowed for ${domain}, checking OS permission`)
            const granted = await checkPermissionForDomain(domain, permissionType)
            sendPermissionResultToWebView(resultType, granted)
            return
          }

          // If 'ask' (or undefined), show the permission prompt
          console.log(`[${messageType}] Permission state is 'ask', showing permission modal for ${domain}`)

          return new Promise(resolve => {
            // Direct call to showPermissionModal to ensure visibility
            setPendingDomain(domain)
            setPendingPermission(permissionType)
            setPendingCallback((granted: boolean) => {
              console.log(`[${messageType}] User responded to permission prompt: ${granted ? 'granted' : 'denied'}`)
              sendPermissionResultToWebView(resultType, granted)
              resolve(granted)
            })

            // Force modal visibility in next tick to ensure state updates
            setTimeout(() => {
              setPermissionModalVisible(true)
              console.log(`[${messageType}] Permission modal visibility set to true`)
            }, 0)
          })
        } catch (error) {
          console.error(`[PERMISSION ERROR] Error handling permission request:`, error)
          sendPermissionResultToWebView(resultType, false)
          return false
        }
      }

      // Handle camera permission request
      if (msg.type === 'REQUEST_CAMERA') {
        console.log('[WebView] Camera permission request detected')
        await handlePermissionRequest('CAMERA', 'CAMERA', 'CAMERA')
        return
      }

      // Handle microphone permission request
      if (
        msg.type === 'REQUEST_MICROPHONE' ||
        (msg.type === 'CONSOLE' &&
          msg.args &&
          msg.args.some((arg: any) => typeof arg === 'string' && arg.includes('microphone')))
      ) {
        console.log('[WebView] Microphone permission request detected')
        await handlePermissionRequest('MICROPHONE', 'RECORD_AUDIO', 'MICROPHONE')
        return
      }

      // Handle location permission request
      if (
        msg.type === 'REQUEST_LOCATION' ||
        (msg.type === 'CONSOLE' &&
          msg.args &&
          msg.args.some((arg: any) => typeof arg === 'string' && arg.includes('location')))
      ) {
        console.log('[WebView] Location permission request detected')
        await handlePermissionRequest('LOCATION', 'ACCESS_FINE_LOCATION', 'LOCATION')
        return
      }

      // Handle generic permission requests that might come in different formats
      if (
        (msg.type && msg.type.includes('PERMISSION')) ||
        (msg.type === 'CONSOLE' &&
          msg.args &&
          msg.args.some((arg: any) => typeof arg === 'string' && arg.includes('permission')))
      ) {
        console.log('[WebView] Generic permission request detected, attempting to parse')

        // Try to determine permission type from the message
        let permType: PermissionType | null = null

        if (msg.args && Array.isArray(msg.args)) {
          if (
            msg.args.some((arg: any) => typeof arg === 'string' && (arg.includes('camera') || arg.includes('video')))
          ) {
            permType = 'CAMERA'
          } else if (
            msg.args.some(
              (arg: any) => typeof arg === 'string' && (arg.includes('microphone') || arg.includes('audio'))
            )
          ) {
            permType = 'RECORD_AUDIO'
          } else if (msg.args.some((arg: any) => typeof arg === 'string' && arg.includes('location'))) {
            permType = 'ACCESS_FINE_LOCATION'
          }
        }

        if (permType) {
          console.log(`[WebView] Identified permission type: ${permType}`)
          await handlePermissionRequest(permType, permType, permType === 'RECORD_AUDIO' ? 'MICROPHONE' : permType)
          return
        }
      }

      // Handle console logs from WebView
      if (msg.type === 'CONSOLE') {
        const logPrefix = '[WebView]'
        switch (msg.method) {
          case 'log':
            console.log(logPrefix, ...msg.args)
            break
          case 'warn':
            console.warn(logPrefix, ...msg.args)
            break
          case 'error':
            console.error(logPrefix, ...msg.args)
            break
          case 'info':
            console.info(logPrefix, ...msg.args)
            break
          case 'debug':
            console.debug(logPrefix, ...msg.args)
            break
        }
        return
      }

      // Handle fullscreen requests
      if (msg.type === 'REQUEST_FULLSCREEN') {
        console.log('Fullscreen requested by website')
        await enterFullscreen()

        // Send success response back to webview
        if (activeTab.webviewRef?.current) {
          activeTab.webviewRef.current.injectJavaScript(`
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'FULLSCREEN_RESPONSE',
                success: true
              })
            }));
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'FULLSCREEN_CHANGE',
                isFullscreen: true
              })
            }));
          `)
        }
        return
      }

      // Handle exit fullscreen requests
      if (msg.type === 'EXIT_FULLSCREEN') {
        console.log('Exit fullscreen requested by website')
        await exitFullscreen()

        // Send response back to webview
        if (activeTab.webviewRef?.current) {
          activeTab.webviewRef.current.injectJavaScript(`
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'FULLSCREEN_RESPONSE',
                success: true
              })
            }));
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'FULLSCREEN_CHANGE',
                isFullscreen: false
              })
            }));
          `)
        }
        return
      }

      // Handle notification permission requests
      if (msg.type === 'REQUEST_NOTIFICATION_PERMISSION') {
        console.log('[WebView] 🔔 Notification permission request detected')
        console.log('[WebView] 🌐 Current URL:', activeTab.url)
        console.log('[WebView] 📋 Message data:', msg)

        try {
          const domain = domainForUrl(activeTab.url)
          if (!domain) {
            console.error('[WebView] ❌ Cannot get domain from URL for notification permission')
            return
          }

          console.log('[WebView] 🌐 Extracted domain:', domain)

          // Check the current permission state in permissions manager
          // NOTIFICATIONS now only has Allow/Deny states (defaults to Deny)
          const currentPermissionState = await getPermissionState(domain, 'NOTIFICATIONS')
          console.log('[WebView] 🔍 Current permission state for domain:', domain, '=', currentPermissionState)

          let permission: string

          if (currentPermissionState === 'allow') {
            // If explicitly allowed, return granted
            console.log('[WebView] ✅ Permission explicitly allowed for domain:', domain)
            permission = 'granted'
          } else {
            // Default is deny - if not explicitly allowed, it's denied
            console.log('[WebView] ❌ Permission denied for domain (default or explicit):', domain)
            permission = 'denied'
          }

          console.log('[WebView] ✅ Permission result:', permission)
          console.log('[WebView] 📤 Sending permission response to webview')

          // Send response back to webview and update permission property
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              console.log('[WebView Response] Received permission response: ${permission}');
              
              // CRITICAL: Update the actual Notification.permission property
              if (window.Notification) {
                Object.defineProperty(window.Notification, 'permission', {
                  value: '${permission}',
                  writable: false,
                  configurable: true
                });
                console.log('[WebView Response] Updated Notification.permission to:', window.Notification.permission);
              }
              
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'NOTIFICATION_PERMISSION_RESPONSE',
                  permission: '${permission}'
                })
              }));
            `)
            console.log('[WebView] ✅ Permission response sent successfully')
          } else {
            console.error('[WebView] ❌ Cannot send response: webviewRef is null')
          }
        } catch (error) {
          console.error('[WebView] ❌ Error handling notification permission request:', error)
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              console.error('[WebView Response] Permission request failed:', '${error}');
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'NOTIFICATION_PERMISSION_RESPONSE',
                  permission: 'denied'
                })
              }));
            `)
          }
        }
        return
      }

      // Handle general permission requests (for permissions UI)
      if (msg.type === 'REQUEST_PERMISSION') {
        console.log('[WebView] 🔐 General permission request detected')
        console.log('[WebView] 📋 Permission type:', msg.permission)
        console.log('[WebView] 🌐 Current URL:', activeTab.url)

        try {
          const domain = domainForUrl(activeTab.url)
          if (!domain) {
            console.error('[WebView] ❌ Cannot get domain from URL for permission request')
            return
          }

          const permissionType = msg.permission as PermissionType
          console.log('[WebView] 🔑 Requesting permission:', permissionType, 'for domain:', domain)

          // Special handling for NOTIFICATIONS - integrate with push notification system
          if (permissionType === 'NOTIFICATIONS') {
            const result = await requestPermission(domain)
            const permission = result.granted ? 'granted' : 'denied'

            // Also update the general permissions system
            const permissionState: PermissionState =
              permission === 'granted' ? 'allow' : permission === 'denied' ? 'deny' : 'ask'
            await setDomainPermission(domain, 'NOTIFICATIONS', permissionState)

            console.log('[WebView] ✅ NOTIFICATIONS permission result:', permission, '-> state:', permissionState)

            // Send response back to webview
            if (activeTab.webviewRef?.current) {
              activeTab.webviewRef.current.injectJavaScript(`
                console.log('[WebView Response] Permission granted for NOTIFICATIONS: ${permission}');
                window.dispatchEvent(new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'PERMISSION_RESPONSE',
                    permission: '${permissionType}',
                    result: '${permissionState}'
                  })
                }));
              `)
            }
          } else {
            // Handle other permissions through the standard system
            console.log('[WebView] 🔄 Handling standard permission:', permissionType)

            // For now, we'll prompt the user and set to 'allow' (this can be enhanced with actual UI prompts)
            await setDomainPermission(domain, permissionType, 'allow')

            // Send response back to webview
            if (activeTab.webviewRef?.current) {
              activeTab.webviewRef.current.injectJavaScript(`
                console.log('[WebView Response] Permission granted for ${permissionType}');
                window.dispatchEvent(new MessageEvent('message', {
                  data: JSON.stringify({
                    type: 'PERMISSION_RESPONSE',
                    permission: '${permissionType}',
                    result: 'allow'
                  })
                }));
              `)
            }
          }
        } catch (error) {
          console.error('[WebView] ❌ Error handling general permission request:', error)
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              console.error('[WebView Response] Permission request failed:', '${error}');
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PERMISSION_RESPONSE',
                  permission: '${msg.permission}',
                  result: 'deny'
                })
              }));
            `)
          }
        }
        return
      }

      // Handle show notification requests
      if (msg.type === 'SHOW_NOTIFICATION') {
        console.log('[WebView] 📢 Show notification request received')
        console.log('[WebView] 📋 Notification data:', msg)
        console.log('[WebView] 🌐 Current URL:', activeTab.url)

        try {
          const domain = domainForUrl(activeTab.url)
          if (!domain) {
            console.error('[WebView] ❌ Cannot get domain from URL for notification')
            return
          }

          console.log('[WebView] 🌐 Extracted domain:', domain)

          // First check the push notification permission system
          // Note: Using simplified permission check for now
          const hasPushPermission = true // Will be properly integrated with backend permission system

          console.log('[WebView] 🔑 Push permissions for domain:', {
            found: hasPushPermission,
            permission: hasPushPermission ? 'granted' : 'denied',
            hasPushPermission
          })

          // Check the general permission system (this takes precedence)
          const permissionState = await getPermissionState(domain, 'NOTIFICATIONS')

          console.log('[WebView] 🔑 General permissions for domain:', {
            permissionState
          })

          // NOTIFICATIONS now only has Allow/Deny states (defaults to Deny)
          // Only allow notifications if explicitly set to 'allow' AND push permission is granted
          const canShowNotification = permissionState === 'allow' && hasPushPermission

          if (permissionState !== 'allow') {
            console.log('[WebView] ❌ Notifications not allowed - permission state:', permissionState)
            return
          }

          if (!hasPushPermission) {
            console.log('[WebView] ❌ Notifications not allowed - push permission not granted')
            return
          }

          console.log('[WebView] 🔍 Final permission check:', {
            domain,
            pushPermission: hasPushPermission ? 'granted' : 'denied',
            generalPermission: permissionState,
            hasPushPermission,
            canShowNotification
          })

          if (!canShowNotification) {
            console.log('[WebView] ❌ Notifications not allowed for domain:', domain)
            console.log('[WebView] ❌ Push permission:', hasPushPermission ? 'granted' : 'denied')
            console.log('[WebView] ❌ General permission:', permissionState)
            console.log('[WebView] ❌ Reason: Permission denied or not properly granted')
            return
          }

          console.log('[WebView] ✅ Permission check passed, scheduling notification')

          // Schedule the notification using Expo Notifications
          await Notifications.scheduleNotificationAsync({
            content: {
              title: msg.title || 'Notification',
              body: msg.body || '',
              data: {
                url: activeTab.url,
                domain: domain,
                ...msg.data
              }
            },
            trigger: null // Show immediately
          })

          console.log('Notification scheduled successfully')
        } catch (error) {
          console.error('Error showing notification:', error)
        }
        return
      }

      // Handle push subscription requests
      if (msg.type === 'PUSH_SUBSCRIBE') {
        console.log('[WebView] 🔔 Push subscribe request received')
        console.log('[WebView] 📋 Subscribe options:', msg.options)
        console.log('[WebView] 🔑 VAPID key:', msg.options?.applicationServerKey ? 'PROVIDED' : 'NONE')
        console.log('[WebView] 👁️ User visible only:', msg.options?.userVisibleOnly)

        try {
          const domain = domainForUrl(activeTab.url)
          if (!domain) {
            console.error('[WebView] ❌ Cannot get domain from URL for push subscription')
            return
          }

          console.log('[WebView] 🌐 Creating subscription for domain:', domain)

          // Create push subscription for this domain using backend
          const result = await requestPermission(domain)
          
          let subscription = null
          
          console.log('[WebView] ✅ Push permission granted, userKey:', result.userKey, result.granted)

          if (result.granted && result.userKey) {
            // Get the centralized PushSubscription object from notificationBackendService
            subscription = getPushSubscription()
            
            if (subscription) {
              console.log('[WebView] ✅ Using centralized PushSubscription with consistent keys')
              console.log('[WebView] 🔑 Endpoint:', subscription.endpoint)
              const p256dhKey = subscription.getKey ? subscription.getKey('p256dh') : 'N/A'
              const authKey = subscription.getKey ? subscription.getKey('auth') : 'N/A'
              console.log('[WebView] 🔑 p256dh key:', typeof p256dhKey === 'string' ? p256dhKey.substring(0, 20) + '...' : 'N/A')
              console.log('[WebView] 🔑 auth key:', typeof authKey === 'string' ? authKey.substring(0, 20) + '...' : 'N/A')
            } else {
              console.log('[WebView] ❌ No PushSubscription available from backend service')
            }
            
            console.log('[WebView] ✅ Using backend userKey for subscription:', result.userKey)
          } else {
            console.log('[WebView] ❌ Failed to get backend subscription: Permission not granted')
          }

          console.log('[WebView] 📦 Subscription created:', subscription ? 'SUCCESS' : 'FAILED')
          
          // Send response back to webview
          if (activeTab.webviewRef?.current) {
            const responseData = {
              type: 'PUSH_SUBSCRIPTION_RESPONSE',
              subscription: subscription
            }
            console.log('[WebView] 📤 Sending subscription response to webview')
            console.log('[WebView Debug] 📤 Sending subscription response to webview')
            console.log('[WebView Debug] 📤 Subscription to send:', subscription)
            console.log('[WebView Debug] ⏰ Executing delayed push subscription response injection')
            console.log('[WebView Debug] 📨 Message event dispatched with data:', JSON.stringify({
              type: 'PUSH_SUBSCRIPTION_RESPONSE',
              subscription: subscription
            }))
            // Create a clean subscription object for the website
            const cleanSubscription = subscription ? {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.getKey ? subscription.getKey('p256dh') : null,
                auth: subscription.getKey ? subscription.getKey('auth') : null
              }
            } : null
            
            const responseJson = JSON.stringify({
              type: 'PUSH_SUBSCRIPTION_RESPONSE',
              subscription: cleanSubscription
            })
            
            // Add comprehensive debugging for message passing
            console.log('[WebView Debug] About to inject JavaScript response:', {
              hasSubscription: cleanSubscription !== null,
              responseJson: responseJson,
              userKey: result.userKey
            })
            
            // 🎯 FINAL WORKING SOLUTION: Use delayed injection (setTimeout) - PROVEN TO WORK!
            console.log('[WebView Debug] 🎯 Using delayed injection - the proven working solution!')
            console.log('[WebView Debug] 📤 Subscription to send:', cleanSubscription)
            
            // CRITICAL: Use setTimeout delay because immediate injection fails after async backend calls
            setTimeout(() => {
              console.log('[WebView Debug] ⏰ Executing delayed push subscription response injection')
              
              // 🔍 CRITICAL DEBUG: Check WebView ref availability
              console.log('[WebView Debug] 🔍 Debugging WebView ref:');
              console.log('[WebView Debug] 🔍 - activeTab exists:', !!activeTab);
              console.log('[WebView Debug] 🔍 - activeTab.webviewRef exists:', !!activeTab?.webviewRef);
              console.log('[WebView Debug] 🔍 - activeTab.webviewRef.current exists:', !!activeTab?.webviewRef?.current);
              console.log('[WebView Debug] 🔍 - WebView ref type:', typeof activeTab?.webviewRef?.current);
              
              if (activeTab?.webviewRef?.current) {
                console.log('[WebView Debug] ✅ WebView ref is available - attempting injection');
                
                try {
                  // Create the injection JavaScript as a string with proper escaping
                  const subscriptionJson = JSON.stringify(cleanSubscription);
                  const injectionJS = `
                  console.log('[WebView Response] 🚀 Push subscription response injection (delayed)');
                  console.log('[WebView Response] 📦 Subscription data:', ${JSON.stringify(subscriptionJson)});
                  
                  // 🔍 CRITICAL DEBUG: Check what's available in window object
                  console.log('[WebView Response] 🔍 Debugging window object:');
                  console.log('[WebView Response] 🔍 - window.pushSubscriptionPromiseResolve:', typeof window.pushSubscriptionPromiseResolve);
                  console.log('[WebView Response] 🔍 - window.pushSubscriptionPromiseReject:', typeof window.pushSubscriptionPromiseReject);
                  console.log('[WebView Response] 🔍 - Available keys:', Object.keys(window).filter(k => k.includes('push')));
                  
                  // CRITICAL FIX: Resolve the original Promise that webpushtest.com is waiting for
                  let resolverFound = false;
                  
                  // Try multiple resolver strategies
                  if (window.pushSubscriptionPromiseResolve) {
                    console.log('[WebView Response] 🎯 FOUND Promise resolver (method 1) - proceeding to resolve!');
                    resolverFound = true;
                  } else if (window.pushResolvers && window.currentPushResolverKey) {
                    console.log('[WebView Response] 🎯 FOUND Promise resolver (method 2) - using resolver key:', window.currentPushResolverKey);
                    const resolver = window.pushResolvers[window.currentPushResolverKey];
                    if (resolver) {
                      window.pushSubscriptionPromiseResolve = resolver.resolve;
                      window.pushSubscriptionPromiseReject = resolver.reject;
                      resolverFound = true;
                    }
                  }
                  
                  if (resolverFound) {
                    const subscription = ${subscriptionJson};
                    
                    // Create a comprehensive PushSubscription object that matches browser APIs
                    const pushSubscription = {
                      endpoint: subscription.endpoint,
                      expirationTime: null,
                      keys: subscription.keys,
                      options: { 
                        userVisibleOnly: true,
                        applicationServerKey: subscription.keys?.applicationServerKey || null
                      },
                      
                      // Standard PushSubscription methods
                      toJSON: function() {
                        return {
                          endpoint: this.endpoint,
                          expirationTime: this.expirationTime,
                          keys: this.keys
                        };
                      },
                      
                      unsubscribe: function() {
                        console.log('[WebView Response] 🗑️ PushSubscription.unsubscribe() called');
                        return Promise.resolve(true);
                      },
                      
                      // Additional properties some sites expect
                      getKey: function(name) {
                        console.log('[WebView Response] 🔑 PushSubscription.getKey() called with:', name);
                        if (name === 'p256dh' && this.keys.p256dh) {
                          // Convert base64 to ArrayBuffer if needed
                          return this.keys.p256dh;
                        } else if (name === 'auth' && this.keys.auth) {
                          return this.keys.auth;
                        }
                        return null;
                      }
                    };
                    
                    console.log('[WebView Response] 📦 About to resolve with comprehensive pushSubscription:', pushSubscription);
                    
                    try {
                      // Resolve the original Promise
                      window.pushSubscriptionPromiseResolve(pushSubscription);
                      
                      // Clean up resolvers
                      delete window.pushSubscriptionPromiseResolve;
                      delete window.pushSubscriptionPromiseReject;
                      if (window.pushResolvers && window.currentPushResolverKey) {
                        delete window.pushResolvers[window.currentPushResolverKey];
                        delete window.currentPushResolverKey;
                      }
                      
                      console.log('[WebView Response] ✅✅✅ SUCCESS: Original Promise resolved with comprehensive PushSubscription object!');
                    } catch (resolveError) {
                      console.error('[WebView Response] ❌ Error resolving Promise:', resolveError);
                    }
                  } else {
                    console.log('[WebView Response] ⚠️⚠️⚠️ No Promise resolver found - this is the problem!');
                    console.log('[WebView Response] 🔍 Checking if we can find any resolvers in window object...');
                    
                    // Try to find any resolver functions
                    const allKeys = Object.keys(window);
                    const pushKeys = allKeys.filter(k => k.toLowerCase().includes('push'));
                    const promiseKeys = allKeys.filter(k => k.toLowerCase().includes('promise'));
                    const resolveKeys = allKeys.filter(k => k.toLowerCase().includes('resolve'));
                    
                    console.log('[WebView Response] 🔍 Push-related keys:', pushKeys);
                    console.log('[WebView Response] 🔍 Promise-related keys:', promiseKeys);
                    console.log('[WebView Response] 🔍 Resolve-related keys:', resolveKeys);
                    
                    // Fallback to message event for compatibility
                    console.log('[WebView Response] 🔄 Falling back to message event...');
                    window.dispatchEvent(new MessageEvent('message', {
                      data: JSON.stringify({
                        type: 'PUSH_SUBSCRIPTION_RESPONSE',
                        subscription: ${subscriptionJson}
                      })
                    }));
                    console.log('[WebView Response] 📨 Message event dispatched as fallback');
                  }
                  
                  console.log('[WebView Response] ✅ Push subscription response handling completed!');
                  `;
                  
                  const injectionResult = activeTab.webviewRef.current.injectJavaScript(injectionJS);
                  
                  console.log('[WebView Debug] ✅ JavaScript injection completed successfully');
                } catch (injectionError) {
                  console.error('[WebView Debug] ❌ JavaScript injection failed:', injectionError);
                  console.error('[WebView Debug] ❌ This is why no logs are showing from injected JavaScript!');
                }
              } else {
                console.error('[WebView Debug] ❌ WebView ref unavailable during delayed injection');
                console.error('[WebView Debug] ❌ activeTab:', !!activeTab);
                console.error('[WebView Debug] ❌ webviewRef:', !!activeTab?.webviewRef);
                console.error('[WebView Debug] ❌ current:', !!activeTab?.webviewRef?.current);
              }
            }, 100)
          }
        } catch (error) {
          console.error('[WebView] ❌ Error creating push subscription:', error)
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              console.error('[WebView Response] Push subscription failed:', '${error}');
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PUSH_SUBSCRIPTION_RESPONSE',
                  subscription: null
                })
              }));
            `)
          }
        }
        return
      }

      // Handle get push subscription requests
      if (msg.type === 'GET_PUSH_SUBSCRIPTION') {
        console.log('[WebView] Get push subscription request')
        /* ... */
        try {
          const domain = domainForUrl(activeTab.url)
          if (!domain) {
            console.error('Cannot get domain from URL for push subscription')
            return
          }

          // Use our new simplified subscription approach
          const existingSubscription = null // Will be implemented with proper backend integration
          console.log('[WebView] Creating new subscription for domain:', domain)

          // Send response back to webview
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PUSH_SUBSCRIPTION_RESPONSE',
                  subscription: ${JSON.stringify(existingSubscription)}
                })
              }));
            `)
          }
        } catch (error) {
          console.error('Error getting push subscription:', error)
          if (activeTab.webviewRef?.current) {
            activeTab.webviewRef.current.injectJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PUSH_SUBSCRIPTION_RESPONSE',
                  subscription: null
                })
              }));
            `)
          }
        }
        return
      }

      // Handling of wallet before api call.
      if (msg.call && (!wallet || isWeb2Mode)) {
        // console.log('Wallet not ready or in web2 mode, ignoring call:', msg.call);
        return
      }

      // Handle wallet API calls
      const origin = activeTab.url.replace(/^https?:\/\//, '').split('/')[0]
      let response: any

      try {
        switch (msg.call) {
          case 'getPublicKey':
          case 'revealCounterpartyKeyLinkage':
          case 'revealSpecificKeyLinkage':
          case 'encrypt':
          case 'decrypt':
          case 'createHmac':
          case 'verifyHmac':
          case 'createSignature':
          case 'verifySignature':
          case 'createAction':
          case 'signAction':
          case 'abortAction':
          case 'listActions':
          case 'internalizeAction':
          case 'listOutputs':
          case 'relinquishOutput':
          case 'acquireCertificate':
          case 'listCertificates':
          case 'proveCertificate':
          case 'relinquishCertificate':
          case 'discoverByIdentityKey':
          case 'isAuthenticated':
          case 'waitForAuthentication':
          case 'getHeight':
          case 'getHeaderForHeight':
          case 'discoverByAttributes':
          case 'getNetwork':
          case 'getVersion':
            response = await (wallet as any)[msg.call](typeof msg.args !== 'undefined' ? msg.args : {}, origin)
            break
          default:
            throw new Error('Unsupported method.')
        }
        sendResponseToWebView(msg.id, response)
      } catch (error) {
        console.error('Error processing wallet API call:', msg.call, error)
      }
    },
    [activeTab, wallet, t]
  )

  /* -------------------------------------------------------------------------- */
  /*                      NAV STATE CHANGE → HISTORY TRACKING                   */
  /* -------------------------------------------------------------------------- */
  const handleNavStateChange = useCallback(
    (navState: WebViewNavigation) => {
      console.log('🌐 [NAV_STATE_CHANGE] WebView navigation event received:', {
        url: navState.url,
        title: navState.title,
        loading: navState.loading,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
        activeTabId: tabStore.activeTabId,
        currentTabUrl: activeTab?.url,
        timestamp: new Date().toISOString()
      })

      // Safety check - if activeTab is undefined, we cannot process navigation
      if (!activeTab) {
        console.warn('⚠️ [NAV_STATE_CHANGE] Cannot handle navigation: activeTab is undefined')
        return
      }

      // Ignore favicon requests for about:blank
      if (navState.url?.includes('favicon.ico') && activeTab.url === kNEW_TAB_URL) {
        console.log('🚫 [NAV_STATE_CHANGE] Ignoring favicon request for new tab')
        return
      }

      // Check if this is a duplicate navigation state (same URL, same loading state)
      const now = Date.now()
      const lastNavState = lastNavStateRef.current
      const isDuplicate =
        lastNavState &&
        lastNavState.url === navState.url &&
        lastNavState.loading === navState.loading &&
        lastNavState.canGoBack === navState.canGoBack &&
        lastNavState.canGoForward === navState.canGoForward

      // Throttle rapid navigation state changes (less than 50ms apart)
      const isThrottled = now - lastNavStateTimestamp.current < 50

      if (isDuplicate) {
        console.log('🔄 [NAV_STATE_CHANGE] Skipping duplicate navigation state for same URL/state')
        return
      }

      if (isThrottled && lastNavState?.url === navState.url) {
        console.log('⏱️ [NAV_STATE_CHANGE] Throttling rapid navigation state change for same URL')
        return
      }

      // Store this navigation state for future duplicate detection
      lastNavStateRef.current = navState
      lastNavStateTimestamp.current = now

      // Log navigation state changes with back/forward capabilities
      const processingStart = performance.now()
      console.log('🌐 [NAV_STATE_CHANGE] Processing navigation:', {
        url: navState.url,
        title: navState.title,
        loading: navState.loading,
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
        timestamp: new Date().toISOString()
      })

      // Make sure we're updating the correct tab's navigation state
      console.log('📊 [NAV_STATE_CHANGE] Updating tab store navigation state for tab:', activeTab.id)
      tabStore.handleNavigationStateChange(activeTab.id, navState)

      if (!addressEditing.current) {
        console.log('📍 [NAV_STATE_CHANGE] Updating address text to:', navState.url)
        setAddressText(navState.url)
      } else {
        console.log('📍 [NAV_STATE_CHANGE] Address editing in progress, skipping address text update')
      }

      if (!navState.loading && navState.url !== kNEW_TAB_URL) {
        console.log('📄 [NAV_STATE_CHANGE] Webpage fully loaded, adding to history:', {
          url: navState.url,
          title: navState.title,
          canGoBack: navState.canGoBack,
          canGoForward: navState.canGoForward,
          timestamp: new Date().toISOString()
        })

        pushHistory({
          title: navState.title || navState.url,
          url: navState.url,
          timestamp: Date.now()
        }).catch(() => {})
      } else if (navState.loading) {
        console.log('⏳ [NAV_STATE_CHANGE] Page is still loading...')
      }

      // Log completion time for performance tracking
      const processingTime = performance.now() - processingStart
      console.log('✅ [NAV_STATE_CHANGE] Navigation state processing completed in', processingTime.toFixed(2), 'ms')
    },
    [activeTab, tabStore, setAddressText, pushHistory]
  )

  /* -------------------------------------------------------------------------- */
  /*                          SHARE / HOMESCREEN SHORTCUT                       */
  /* -------------------------------------------------------------------------- */
  const shareCurrent = useCallback(async () => {
    const currentTab = tabStore.activeTab
    if (!currentTab) return

    try {
      await Share.share({ message: currentTab.url })
    } catch (err) {
      console.warn('Share cancelled/failed', err)
    }
  }, [])
  const addToHomeScreen = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
      } else {
        await Linking.openURL('prefs:root=Safari')
      }
    } catch (e) {
      console.warn('Add to homescreen failed', e)
    }
  }, [])

  /* -------------------------------------------------------------------------- */
  /*                           STAR (BOOKMARK+HISTORY)                          */
  /* -------------------------------------------------------------------------- */
  // const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDrawerAnimating, setIsDrawerAnimating] = useState(false)
  const windowHeight = Dimensions.get('window').height
  const drawerFullHeight = windowHeight * 0.75
  const translateY = useRef(new Animated.Value(drawerFullHeight)).current

  const closeStarDrawer = useCallback(() => {
    const runCloseDrawer = () => {
      Keyboard.dismiss()
      setIsDrawerAnimating(true)

      Animated.spring(translateY, {
        toValue: drawerFullHeight,
        useNativeDriver: true,
        tension: 100,
        friction: 8
      }).start()

      setTimeout(() => {
        setShowStarDrawer(false)
        setIsDrawerAnimating(false)
      }, 300)
    }
    if (isDrawerAnimating) {
      translateY.stopAnimation(() => {
        runCloseDrawer()
      })
      return
    }
    runCloseDrawer()
  }, [isDrawerAnimating, drawerFullHeight, translateY])

  const onPanGestureEvent = useRef(
    Animated.event([{ nativeEvent: { translationY: translateY } }], {
      useNativeDriver: true
    })
  ).current

  const onPanHandlerStateChange = useCallback(
    (event: any) => {
      if (event.nativeEvent.oldState === GestureState.ACTIVE) {
        if (isDrawerAnimating) return
        setIsDrawerAnimating(true)

        const { translationY, velocityY } = event.nativeEvent

        const shouldClose = translationY > drawerFullHeight / 3 || velocityY > 800
        const targetValue = shouldClose ? drawerFullHeight : 0

        Animated.spring(translateY, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
          velocity: velocityY / 500
        }).start()

        if (shouldClose) {
          Keyboard.dismiss()
          setTimeout(() => {
            setShowStarDrawer(false)
            setIsDrawerAnimating(false)
          }, 150)
        } else {
          setIsDrawerAnimating(false)
        }
      }
    },
    [drawerFullHeight, translateY, isDrawerAnimating]
  )

  useEffect(() => {
    if (showStarDrawer) {
      setIsDrawerAnimating(true)
      translateY.setValue(drawerFullHeight)
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8
      }).start(() => {
        setIsDrawerAnimating(false)
      })
    }
  }, [showStarDrawer])

  const toggleStarDrawer = useCallback(
    (open: boolean) => {
      setShowStarDrawer(open)
      Animated.timing(starDrawerAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start()
    },
    [starDrawerAnim]
  )

  // State for clear confirm modal (move this above scene components)

  const handleSetStartingUrl = useCallback(
    async (url: string) => {
      // Check if this is a UHRP URL
      if (uhrpHandler.isUHRPUrl(url)) {
        // Set loading state
        setUhrpLoading(url)

        try {
          // Resolve UHRP URL to get the HTTP server URL
          const resolvedContent = await uhrpHandler.resolveUHRPUrl(url)

          updateActiveTab({ url: resolvedContent.resolvedUrl })
          toggleStarDrawer(false)
        } catch (error) {
          // Show error page
          const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>UHRP Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  text-align: center; 
                  padding: 50px 20px; 
                  background: #f5f5f5;
                  color: #333;
                }
                .container { 
                  max-width: 400px; 
                  margin: 0 auto; 
                  background: white; 
                  padding: 30px; 
                  border-radius: 10px; 
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h2 { color: #e74c3c; margin-bottom: 20px; }
                .url { background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; margin: 20px 0; }
                button { 
                  background: #007AFF; 
                  color: white; 
                  border: none; 
                  padding: 12px 24px; 
                  border-radius: 6px; 
                  font-size: 16px; 
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Failed to load UHRP content</h2>
                <div class="url">${url}</div>
                <p>Error: ${(error as any)?.message || 'Unknown error occurred while resolving UHRP URL'}</p>
                <button onclick="window.location.href='about:blank'">Go to Homepage</button>
              </div>
            </body>
          </html>
        `
          updateActiveTab({ url: `data:text/html,${encodeURIComponent(errorHtml)}` })
          toggleStarDrawer(false)
        } finally {
          // Clear loading state
          setUhrpLoading(null)
        }
      } else {
        // Normal HTTP/HTTPS URL, use regular navigation
        updateActiveTab({ url })
        toggleStarDrawer(false)
      }
    },
    [updateActiveTab]
  )

  const handleHomepageNavigation = useCallback(
    async (url: string) => {
      // Check if this is a UHRP URL
      if (uhrpHandler.isUHRPUrl(url)) {
        // Set loading state
        setUhrpLoading(url)

        try {
          // Resolve UHRP URL to get the HTTP server URL
          const resolvedContent = await uhrpHandler.resolveUHRPUrl(url)

          updateActiveTab({ url: resolvedContent.resolvedUrl })
        } catch (error) {
          // Show error page
          const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>UHRP Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  text-align: center; 
                  padding: 50px 20px; 
                  background: #f5f5f5;
                  color: #333;
                }
                .container { 
                  max-width: 400px; 
                  margin: 0 auto; 
                  background: white; 
                  padding: 30px; 
                  border-radius: 10px; 
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h2 { color: #e74c3c; margin-bottom: 20px; }
                .url { background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; margin: 20px 0; }
                button { 
                  background: #007AFF; 
                  color: white; 
                  border: none; 
                  padding: 12px 24px; 
                  border-radius: 6px; 
                  font-size: 16px; 
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Failed to load UHRP content</h2>
                <div class="url">${url}</div>
                <p>Error: ${(error as any)?.message || 'Unknown error occurred while resolving UHRP URL'}</p>
                <button onclick="window.location.href='about:blank'">Go to Homepage</button>
              </div>
            </body>
          </html>
        `
          updateActiveTab({ url: `data:text/html,${encodeURIComponent(errorHtml)}` })
        } finally {
          // Clear loading state
          setUhrpLoading(null)
        }
      } else {
        // Normal HTTP/HTTPS URL, use regular navigation
        updateActiveTab({ url })
      }
    },
    [updateActiveTab]
  )

  const BookmarksScene = useMemo(() => {
    return () => (
      <RecommendedApps
        includeBookmarks={bookmarkStore.bookmarks
          .filter(bookmark => {
            // Filter out invalid URLs to prevent favicon errors
            return (
              bookmark.url &&
              bookmark.url !== kNEW_TAB_URL &&
              isValidUrl(bookmark.url) &&
              !bookmark.url.includes('about:blank')
            )
          })
          .reverse()}
        setStartingUrl={handleSetStartingUrl}
        onRemoveBookmark={removeBookmark}
        onRemoveDefaultApp={removeDefaultApp}
        removedDefaultApps={removedDefaultApps}
        hideHeader={true}
        showOnlyBookmarks={true}
      />
    )
  }, [bookmarkStore.bookmarks, handleSetStartingUrl, removeBookmark, removeDefaultApp, removedDefaultApps])

  const HistoryScene = React.useCallback(() => {
    return (
      <HistoryList
        history={history}
        onSelect={u => {
          updateActiveTab({ url: u })
          toggleStarDrawer(false)
        }}
        onDelete={removeHistoryItem}
        onClear={() => showClearConfirm()}
      />
    )
  }, [history, updateActiveTab, toggleStarDrawer, removeHistoryItem])

  /* ---------------------------- clear history modal ------------------------- */
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false)

  const showClearConfirm = useCallback(() => {
    setClearConfirmVisible(true)
  }, [])

  const handleConfirmClearAll = useCallback(() => {
    clearHistory()
    setClearConfirmVisible(false)
  }, [clearHistory])

  const closeClearConfirm = useCallback(() => {
    setClearConfirmVisible(false)
  }, [])

  /* -------------------------------------------------------------------------- */
  /*                         ADDRESS BAR AUTOCOMPLETE                           */
  /* -------------------------------------------------------------------------- */

  const fuseRef = useRef(
    new Fuse<HistoryEntry | Bookmark>([], {
      keys: ['title', 'url'],
      threshold: 0.4
    })
  )
  useEffect(() => {
    fuseRef.current.setCollection([...history, ...bookmarkStore.bookmarks])
  }, [history, bookmarkStore.bookmarks])
  const [addressSuggestions, setAddressSuggestions] = useState<(HistoryEntry | Bookmark)[]>([])

  const onChangeAddressText = useCallback((txt: string) => {
    setAddressText(txt)
    if (txt.trim().length === 0) {
      setAddressSuggestions([])
      return
    }
    const results = fuseRef.current
      .search(txt)
      .slice(0, 10) // Get more results initially
      .map(r => r.item)

    // Remove duplicates based on URL
    const uniqueResults = results
      .filter((item, index, self) => index === self.findIndex(t => t.url === item.url))
      .slice(0, 5) // Then limit to 5 unique results

    setAddressSuggestions(uniqueResults)
  }, [])

  /* -------------------------------------------------------------------------- */
  /*                              INFO DRAWER NAV                               */
  /* -------------------------------------------------------------------------- */
  const toggleInfoDrawer = useCallback((open: boolean, route: typeof infoDrawerRoute = 'root') => {
    setInfoDrawerRoute(route)
    setShowInfoDrawer(open)
  }, [])

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: showInfoDrawer ? 1 : 0,
      duration: 260,
      useNativeDriver: true
    }).start()
  }, [showInfoDrawer, drawerAnim])

  const drawerHeight =
    infoDrawerRoute === 'root' ? Dimensions.get('window').height * 0.75 : Dimensions.get('window').height * 0.9

  /* -------------------------------------------------------------------------- */
  /*                               DRAWER HANDLERS                              */
  /* -------------------------------------------------------------------------- */

  const drawerHandlers = useMemo(
    () => ({
      identity: () => setInfoDrawerRoute('identity'),
      security: () => setInfoDrawerRoute('security'),
      trust: () => setInfoDrawerRoute('trust'),
      settings: () => setInfoDrawerRoute('settings'),
      toggleDesktopView: () => {
        toggleDesktopView()
        toggleInfoDrawer(false)
      },
      addBookmark: () => {
        // Only add bookmark if activeTab exists and URL is valid and not new tab page
        if (
          activeTab &&
          activeTab.url &&
          activeTab.url !== kNEW_TAB_URL &&
          isValidUrl(activeTab.url) &&
          !activeTab.url.includes('about:blank')
        ) {
          addBookmark(activeTab.title || t('untitled'), activeTab.url)
          toggleInfoDrawer(false)
        }
      },
      addToHomeScreen: async () => {
        await addToHomeScreen()
        toggleInfoDrawer(false)
      },
      backToHomepage: () => {
        updateActiveTab({ url: kNEW_TAB_URL })
        setAddressText(kNEW_TAB_URL)
        toggleInfoDrawer(false)
      },
      goToLogin: () => {
        // Navigate back to the main route for login
        router.replace('/')
        toggleInfoDrawer(false)
      }
    }),
    [activeTab, addBookmark, toggleInfoDrawer, updateActiveTab, setAddressText, addToHomeScreen, toggleDesktopView, t]
  )

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                    */
  /* -------------------------------------------------------------------------- */

  const showAddressBar = !keyboardVisible || addressFocused
  const showBottomBar = !(keyboardVisible && addressFocused)

  // Exit fullscreen on back button or gesture when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const backHandler = () => {
        exitFullscreen()
        // Notify webview that fullscreen exited
        activeTab?.webviewRef.current?.injectJavaScript(`
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'FULLSCREEN_CHANGE',
              isFullscreen: false
            })
          }));
        `)
        return true // Prevent default back behavior
      }

      // Add back button listener for Android
      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', backHandler)
        return () => subscription.remove()
      }
    }
  }, [isFullscreen, activeTab?.webviewRef, exitFullscreen])

  const starDrawerAnimatedStyle = useMemo(
    () => [
      styles.starDrawer,
      {
        backgroundColor: colors.background,
        height: drawerFullHeight,
        top: windowHeight - drawerFullHeight,
        transform: [{ translateY }]
      }
    ],
    [styles.starDrawer, colors.background, drawerFullHeight, windowHeight, translateY]
  )

  const addressDisplay = addressFocused ? addressText : domainForUrl(addressText)

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Permission modal */}
      {/* Test button for permission modal - only in dev mode */}
      {false && __DEV__ && (
        <>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 100,
              right: 10,
              backgroundColor: 'blue',
              padding: 10,
              zIndex: 9999
            }}
            onPress={() => {
              console.log('TEST: Opening permission modal manually')
              setPendingDomain(tabStore.activeTab?.url ? new URL(tabStore.activeTab.url).hostname : 'example.com')
              setPendingPermission('CAMERA')
              setPendingCallback(() => (granted: boolean) => {
                console.log('TEST: Permission decision:', granted ? 'GRANTED' : 'DENIED')
              })
              setPermissionModalVisible(true)
            }}
          >
            <Text style={{ color: 'white' }}>Test Permission</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 160,
              right: 10,
              backgroundColor: 'green',
              padding: 10,
              zIndex: 9999
            }}
            onPress={() => {
              console.log('TEST: Testing Notification API')
              if (activeTab?.webviewRef?.current) {
                activeTab.webviewRef.current.injectJavaScript(`
                  console.log('Testing Notification API...');
                  console.log('Notification in window:', 'Notification' in window);
                  console.log('Notification constructor:', typeof window.Notification);
                  console.log('Notification.permission:', window.Notification?.permission);
                  
                  if (window.Notification) {
                    window.Notification.requestPermission().then(permission => {
                      console.log('Permission result:', permission);
                      if (permission === 'granted') {
                        new window.Notification('Test Notification', {
                          body: 'This is a test notification from the website!',
                          icon: '/favicon.ico'
                        });
                      }
                    });
                  } else {
                    console.log('Notification API not available');
                  }
                  true;
                `)
              }
            }}
          >
            <Text style={{ color: 'white', fontSize: 12 }}>Test Notification</Text>
          </TouchableOpacity>
        </>
      )}

      <PermissionModal
        visible={permissionModalVisible}
        domain={pendingDomain ?? ''}
        permission={pendingPermission ?? 'CAMERA'}
        onDecision={granted => {
          if (pendingDomain && pendingPermission) {
            // Update permission in storage
            setDomainPermission(pendingDomain, pendingPermission, granted ? 'allow' : 'deny').then(() => {
              // Update the denied permissions list
              updateDeniedPermissionsForDomain(activeTab?.url || '')

              // If we're on the same domain where the permission was changed,
              if (activeTab?.url && domainForUrl(activeTab.url) === pendingDomain && activeTab.webviewRef?.current) {
                console.log(`Updating permission settings for ${pendingDomain} without page reload`)

                // Update the denied permissions list state
                if (granted) {
                  // Remove from denied list if permission is now allowed
                  setPermissionsDeniedForCurrentDomain(prev => prev.filter(p => p !== pendingPermission))
                } else {
                  // Add to denied list if permission is now denied
                  setPermissionsDeniedForCurrentDomain(prev =>
                    prev.includes(pendingPermission as PermissionType)
                      ? prev
                      : [...prev, pendingPermission as PermissionType]
                  )
                }

                // Inject JavaScript to update permission state in the WebView
                const updatedDeniedPermissions = granted
                  ? permissionsDeniedForCurrentDomain.filter(p => p !== pendingPermission)
                  : [...permissionsDeniedForCurrentDomain, pendingPermission as PermissionType]

                const permissionUpdateScript = `
                    (function() {
                      try {
                        // Update the permission state dynamically
                        window.__metanetDeniedPermissions = ${JSON.stringify(updatedDeniedPermissions)};
                        
                        // Notify the page that permissions have been updated
                        const permEvent = new CustomEvent('permissionchange', { 
                          detail: { 
                            permission: '${pendingPermission}',
                            state: '${granted ? 'granted' : 'denied'}' 
                          } 
                        });
                        document.dispatchEvent(permEvent);
                        console.log('Permission change event dispatched:', '${pendingPermission}', '${granted ? 'granted' : 'denied'}');
                        
                        // Dynamically update the permission overrides
                        if ('${pendingPermission}' === 'CAMERA' || '${pendingPermission}' === 'RECORD_AUDIO') {
                          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                            const originalGetUserMedia = navigator.mediaDevices.__originalGetUserMedia || navigator.mediaDevices.getUserMedia;
                            
                            // Store original if not already stored
                            if (!navigator.mediaDevices.__originalGetUserMedia) {
                              navigator.mediaDevices.__originalGetUserMedia = originalGetUserMedia;
                            }
                            
                            // Update the override
                            navigator.mediaDevices.getUserMedia = function(constraints) {
                              const denied = window.__metanetDeniedPermissions || [];
                              
                              // Check if requesting camera access when it's denied
                              if (denied.includes("CAMERA") && constraints && constraints.video) {
                                return Promise.reject(new DOMException("Camera access denied by site settings", "NotAllowedError"));
                              }
                              
                              // Check if requesting microphone access when it's denied
                              if (denied.includes("RECORD_AUDIO") && constraints && constraints.audio) {
                                return Promise.reject(new DOMException("Microphone access denied by site settings", "NotAllowedError"));
                              }
                              
                              // If we got here, the requested media types are allowed
                              return originalGetUserMedia.call(navigator.mediaDevices, constraints);
                            };
                          }
                        }
                        
                        // Update geolocation override if that permission changed
                        if ('${pendingPermission}' === 'ACCESS_FINE_LOCATION') {
                          if (navigator.geolocation) {
                            // Store original methods if not already stored
                            if (!navigator.geolocation.__originalGetCurrentPosition) {
                              navigator.geolocation.__originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                              navigator.geolocation.__originalWatchPosition = navigator.geolocation.watchPosition;
                            }
                            
                            const denied = window.__metanetDeniedPermissions || [];
                            
                            if (denied.includes("ACCESS_FINE_LOCATION")) {
                              // Override the geolocation API methods to deny access
                              navigator.geolocation.getCurrentPosition = function(success, error) {
                                if (error) {
                                  error(new Error("Location access denied by site settings"));
                                }
                                return undefined;
                              };
                              
                              navigator.geolocation.watchPosition = function(success, error) {
                                if (error) {
                                  error(new Error("Location access denied by site settings"));
                                }
                                return 0; // Return a fake watch ID
                              };
                            } else {
                              // Restore original methods if permission is now granted
                              navigator.geolocation.getCurrentPosition = navigator.geolocation.__originalGetCurrentPosition;
                              navigator.geolocation.watchPosition = navigator.geolocation.__originalWatchPosition;
                            }
                          }
                        }
                      } catch(e) { 
                        console.error('Error updating permission state:', e); 
                      }
                    })();
                  `
                activeTab.webviewRef.current.injectJavaScript(permissionUpdateScript)
                console.log(
                  `Dynamic permission update injected for ${pendingPermission} (${granted ? 'granted' : 'denied'})`
                )
              }
            })
          }

          // Call the callback with the user's decision
          pendingCallback?.(granted)

          // Reset modal state
          setPermissionModalVisible(false)
          setPendingDomain(null)
          setPendingPermission(null)
          setPendingCallback(null)
        }}
      />
      {/* Fullscreen Overlay for both iOS and Android */}
      {isFullscreen && (
        <RNModal
          animationType="fade"
          transparent={false}
          visible={isFullscreen}
          onRequestClose={exitFullscreen}
          statusBarTranslucent={true}
          supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
          onOrientationChange={orientation => {
            console.log('Orientation changed to:', orientation)
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 50 : 30,
                right: 20,
                zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 20,
                width: 40,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onPress={exitFullscreen}
            >
              <Ionicons name="contract-outline" size={20} color="white" />
            </TouchableOpacity>
            {activeTab && activeTab.url && (
              <WebView
                ref={activeTab.webviewRef}
                source={{
                  uri: activeTab.url || kNEW_TAB_URL,
                  headers: {
                    'Accept-Language': getAcceptLanguageHeader()
                  }
                }}
                originWhitelist={['https://*', 'http://*']}
                onMessage={handleMessage}
                injectedJavaScript={injectedJavaScript}
                onNavigationStateChange={handleNavStateChange}
                onShouldStartLoadWithRequest={(request: any) => {
                  // Check if this is a UHRP URL
                  if (uhrpHandler.isUHRPUrl(request.url)) {
                    // Resolve UHRP URL to HTTP URL and navigate to it
                    ;(async () => {
                      try {
                        const resolvedContent = await uhrpHandler.resolveUHRPUrl(request.url)

                        // Navigate directly to the resolved HTTP URL
                        if (resolvedContent.resolvedUrl) {
                          updateActiveTab({ url: resolvedContent.resolvedUrl })
                        }
                      } catch (error: any) {
                        // Show error page
                        const errorHtml = `
                          <html>
                            <head><title>UHRP Error</title></head>
                            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                              <h2>Failed to load UHRP content</h2>
                              <p>URL: ${request.url}</p>
                              <p>Error: ${error.message || 'Unknown error'}</p>
                              <button onclick="history.back()">Go Back</button>
                            </body>
                          </html>
                        `

                        updateActiveTab({ url: `data:text/html,${encodeURIComponent(errorHtml)}` })
                      }
                    })()

                    return false // Prevent WebView from loading the original UHRP URL
                  }

                  return true // Allow all other requests
                }}
                userAgent={isDesktopView ? desktopUserAgent : mobileUserAgent}
                onError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent
                  // Ignore favicon errors for about:blank
                  if (nativeEvent.url?.includes('favicon.ico') && activeTab?.url === kNEW_TAB_URL) {
                    return
                  }
                }}
                onHttpError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent
                  // Ignore favicon errors for about:blank
                  if (nativeEvent.url?.includes('favicon.ico') && activeTab?.url === kNEW_TAB_URL) {
                    return
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsLinkPreview={false}
                allowsProtectedMedia={true}
                allowsBackForwardNavigationGestures
                style={{ flex: 1 }}
              />
            )}
          </View>
        </RNModal>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={addressFocused ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
      >
        <SafeAreaView
          style={[
            styles.container,
            {
              backgroundColor: colors.inputBackground,
              paddingBottom:
                addressFocused && keyboardVisible ? 0 : isFullscreen ? 0 : Platform.OS === 'ios' ? 0 : insets.bottom,
              // Hide content when fullscreen modal is active
              opacity: isFullscreen ? 0 : 1
            }
          ]}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} hidden={isFullscreen} />

          {activeTab?.url === kNEW_TAB_URL ? (
            <TouchableWithoutFeedback onPress={dismissKeyboard}>
              <View style={{ flex: 1 }}>
                <RecommendedApps
                  includeBookmarks={bookmarkStore.bookmarks
                    .filter(bookmark => {
                      return (
                        bookmark.url &&
                        bookmark.url !== kNEW_TAB_URL &&
                        isValidUrl(bookmark.url) &&
                        !bookmark.url.includes('about:blank')
                      )
                    })
                    .reverse()}
                  setStartingUrl={handleHomepageNavigation}
                  onRemoveBookmark={removeBookmark}
                  onRemoveDefaultApp={removeDefaultApp}
                  removedDefaultApps={removedDefaultApps}
                  homepageSettings={homepageSettings}
                  onUpdateHomepageSettings={updateHomepageSettings}
                />
              </View>
            </TouchableWithoutFeedback>
          ) : activeTab ? (
            <View style={{ flex: 1 }} {...responderProps}>
              <WebView
                ref={activeTab?.webviewRef}
                source={{
                  uri: activeTab?.url || kNEW_TAB_URL,
                  headers: {
                    'Accept-Language': getAcceptLanguageHeader()
                  }
                }}
                originWhitelist={['https://*', 'http://*']}
                onMessage={handleMessage}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  // Check if URL actually changed to avoid unnecessary updates
                  if (navState.url !== activeTab?.url) {
                    updateDeniedPermissionsForDomain(navState.url)
                  }
                  handleNavStateChange(navState)
                }}
                // Added injected scanner invocation function into webview runtime
                injectedJavaScript={
                  injectedJavaScript +
                  `
                  window.scanCodeWithCamera = function(reason) {
                    return new Promise((resolve, reject) => {
                      const handleScanResponse = (event) => {
                        try {
                          const data = JSON.parse(event.data);
                          if (data.type === 'SCAN_RESPONSE') {
                            clearTimeout(timeout);
                            resolve(data.data);
                          }
                        } catch (e) {
                          // Ignore parsing errors
                        }
                      };

                      window.addEventListener('message', handleScanResponse, { once: true });
  
                      window.ReactNativeWebView?.postMessage(JSON.stringify({
                        type: 'REQUEST_SCAN'
                      }));

                      const timeout = setTimeout(() => {
                        reject(new Error('Scan timeout'));
                      }, 60000);
                    });
                  };
                  `
                }
                injectedJavaScriptBeforeContentLoaded={getPermissionScript(
                  permissionsDeniedForCurrentDomain,
                  pendingPermission
                )}
                onShouldStartLoadWithRequest={(request: any) => {
                  // Check if this is a UHRP URL
                  if (uhrpHandler.isUHRPUrl(request.url)) {
                    // Resolve UHRP URL to HTTP URL and navigate to it
                    ;(async () => {
                      try {
                        const resolvedContent = await uhrpHandler.resolveUHRPUrl(request.url)

                        // Navigate directly to the resolved HTTP URL
                        if (resolvedContent.resolvedUrl) {
                          updateActiveTab({ url: resolvedContent.resolvedUrl })
                        }
                      } catch (error: any) {
                        // Show error page
                        const errorHtml = `
                          <html>
                            <head><title>UHRP Error</title></head>
                            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                              <h2>Failed to load UHRP content</h2>
                              <p>URL: ${request.url}</p>
                              <p>Error: ${error.message || 'Unknown error'}</p>
                              <button onclick="history.back()">Go Back</button>
                            </body>
                          </html>
                        `

                        updateActiveTab({ url: `data:text/html,${encodeURIComponent(errorHtml)}` })
                      }
                    })()

                    return false // Prevent WebView from loading the original UHRP URL
                  }

                  return true // Allow all other requests
                }}
                userAgent={isDesktopView ? desktopUserAgent : mobileUserAgent}
                onError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent
                  // Ignore favicon errors for about:blank
                  if (nativeEvent.url?.includes('favicon.ico') && activeTab?.url === kNEW_TAB_URL) {
                    return
                  }
                }}
                onHttpError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent
                  // Ignore favicon errors for about:blank
                  if (nativeEvent.url?.includes('favicon.ico') && activeTab?.url === kNEW_TAB_URL) {
                    return
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsLinkPreview={false}
                allowsProtectedMedia={true}
                allowsBackForwardNavigationGestures
                containerStyle={{ backgroundColor: colors.background }}
                style={{ flex: 1 }}
              />
              {showScanner && (
                <UniversalScanner
                  ref={scannerRef}
                  scannedData={scannedData}
                  setScannedData={setScannedData}
                  showScanner={showScanner}
                  onDismiss={() => {
                    logWithTimestamp(F, 'Starting dismissal process')
                    dismissScanner()
                  }}
                  fullscreen={scannerFullscreen}
                />
              )}
            </View>
          ) : null}
          {!isFullscreen && (
            <View
              onLayout={e => setAddressBarHeight(e.nativeEvent.layout.height)}
              style={[
                styles.addressBar,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  paddingTop: addressFocused && keyboardVisible ? 8 : 12,
                  paddingBottom: addressFocused && keyboardVisible ? 0 : 12,
                  zIndex: 10,
                  elevation: 10
                }
              ]}
            >
              {!addressFocused && (
                <TouchableOpacity onPress={() => toggleInfoDrawer(true)} style={styles.addressBarIcon}>
                  <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {!addressFocused && !activeTab?.isLoading && activeTab?.url.startsWith('https') && (
                <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={styles.padlock} />
              )}

              <TextInput
                ref={addressInputRef}
                editable
                value={addressDisplay === 'new-tab-page' ? '' : addressDisplay}
                onChangeText={onChangeAddressText}
                onFocus={() => {
                  addressEditing.current = true
                  setAddressFocused(true)
                  // Set the text to empty if it's the new tab URL
                  if (activeTab?.url === kNEW_TAB_URL) {
                    setAddressText('')
                  }
                  setTimeout(() => {
                    const textToSelect = activeTab?.url === kNEW_TAB_URL ? '' : addressText
                    addressInputRef.current?.setNativeProps({
                      selection: { start: 0, end: textToSelect.length }
                    })
                  }, 0)
                }}
                onBlur={() => {
                  addressEditing.current = false
                  setAddressFocused(false)
                  setAddressSuggestions([])
                  // Reset to the actual URL when losing focus
                  if (!addressEditing.current) {
                    setAddressText(activeTab?.url ? activeTab.url : kNEW_TAB_URL)
                  }
                }}
                onSubmitEditing={onAddressSubmit}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                style={[
                  styles.addressInput,
                  {
                    flex: 1,
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    textAlign: addressFocused ? 'left' : 'center'
                  }
                ]}
                placeholder={t('search_placeholder')}
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                onPress={addressFocused ? () => setAddressText('') : navReloadOrStop}
                style={styles.addressBarIcon}
              >
                <Ionicons
                  name={addressFocused || activeTab?.isLoading ? 'close-circle' : 'refresh'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {!addressFocused && activeTab?.url !== kNEW_TAB_URL && (
                <TouchableOpacity onPress={toggleDesktopView} style={styles.addressBarIcon}>
                  <Ionicons
                    name={isDesktopView ? 'phone-portrait' : 'desktop'}
                    size={20}
                    color={isDesktopView ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {!isFullscreen && addressFocused && addressSuggestions.length > 0 && (
            <View style={[styles.suggestionBox, { backgroundColor: colors.paperBackground }]}>
              {addressSuggestions.map((entry: HistoryEntry | Bookmark, i: number) => (
                <TouchableOpacity
                  key={`suggestion-${i}-${entry.url}`}
                  onPress={() => {
                    // Dismiss keyboard and hide suggestions first
                    addressInputRef.current?.blur()
                    Keyboard.dismiss()
                    setAddressFocused(false)
                    setAddressSuggestions([])

                    // Then load the page
                    setAddressText(entry.url)
                    updateActiveTab({ url: entry.url })
                    addressEditing.current = false
                  }}
                  style={styles.suggestionItem}
                >
                  <Text numberOfLines={1} style={[styles.suggestionTitle, { color: colors.textPrimary }]}>
                    {entry.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.suggestionUrl, { color: colors.textSecondary }]}>
                    {entry.url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isFullscreen && showTabsView && (
            <TabsView onDismiss={() => setShowTabsView(false)} setAddressText={setAddressText} colors={colors} />
          )}

          {!isFullscreen && (showStarDrawer || isDrawerAnimating) && (
            <View style={StyleSheet.absoluteFill}>
              <Pressable style={styles.backdrop} onPress={closeStarDrawer} />
              <Animated.View style={starDrawerAnimatedStyle}>
                <PanGestureHandler
                  onGestureEvent={onPanGestureEvent}
                  onHandlerStateChange={onPanHandlerStateChange}
                  activeOffsetY={10}
                  failOffsetX={[-20, 20]}
                >
                  <Animated.View style={styles.drawerHandleArea}>
                    <View style={styles.handleBar} />
                  </Animated.View>
                </PanGestureHandler>
                <View style={{ flex: 1 }}>
                  <StarDrawer
                    BookmarksScene={BookmarksScene}
                    HistoryScene={HistoryScene}
                    colors={colors}
                    styles={styles}
                    index={starTabIndex}
                    setIndex={setStarTabIndex}
                  />
                </View>
              </Animated.View>
            </View>
          )}
          {!isFullscreen && showBottomBar && activeTab && (
            <BottomToolbar
              activeTab={activeTab}
              colors={colors}
              styles={styles}
              navBack={navBack}
              navFwd={navFwd}
              shareCurrent={shareCurrent}
              toggleStarDrawer={toggleStarDrawer}
              setShowTabsView={setShowTabsView}
            />
          )}

          <Modal
            isVisible={!isFullscreen && showInfoDrawer}
            onBackdropPress={() => toggleInfoDrawer(false)}
            swipeDirection="down"
            onSwipeComplete={() => toggleInfoDrawer(false)}
            style={{ margin: 0, justifyContent: 'flex-end' }}
          >
            <Animated.View
              style={[
                styles.infoDrawer,
                {
                  backgroundColor: colors.background,
                  height: drawerHeight,
                  transform: [
                    {
                      translateY: drawerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [drawerHeight, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              {infoDrawerRoute === 'root' && (
                <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                  <Pressable style={styles.drawerHandle} onPress={() => toggleInfoDrawer(false)}>
                    <View style={styles.handleBar} />
                  </Pressable>
                  {!isWeb2Mode && showBalance && <Balance />}
                  {!isWeb2Mode && (
                    <>
                      <DrawerItem
                        label={t('identity')}
                        icon="person-circle-outline"
                        onPress={drawerHandlers.identity}
                      />
                      <DrawerItem label={t('security')} icon="lock-closed-outline" onPress={drawerHandlers.security} />
                      <DrawerItem
                        label={t('trust_network')}
                        icon="shield-checkmark-outline"
                        onPress={drawerHandlers.trust}
                      />
                      <DrawerItem label={t('settings')} icon="settings-outline" onPress={drawerHandlers.settings} />
                      <DrawerItem
                        label={t('Permissions')}
                        icon="notifications-outline"
                        onPress={() => setInfoDrawerRoute('permissions')}
                      />
                      <View style={styles.divider} />
                    </>
                  )}
                  {activeTab?.url !== kNEW_TAB_URL && (
                    <DrawerItem
                      label={isDesktopView ? t('switch_to_mobile_view') : t('switch_to_desktop_view')}
                      icon={isDesktopView ? 'phone-portrait-outline' : 'desktop-outline'}
                      onPress={drawerHandlers.toggleDesktopView}
                    />
                  )}
                  <DrawerItem label={t('add_bookmark')} icon="star-outline" onPress={drawerHandlers.addBookmark} />
                  <DrawerItem
                    label={t('add_to_device_homescreen')}
                    icon="home-outline"
                    onPress={drawerHandlers.addToHomeScreen}
                  />
                  <DrawerItem
                    label={t('back_to_homepage')}
                    icon="apps-outline"
                    onPress={drawerHandlers.backToHomepage}
                  />
                  {/* Login button for web2 mode users */}
                  {isWeb2Mode && (
                    <>
                      <View style={styles.divider} />
                      <DrawerItem
                        label="Login to unlock Web3 features"
                        icon="log-in-outline"
                        onPress={drawerHandlers.goToLogin}
                      />
                    </>
                  )}
                </ScrollView>
              )}

              {infoDrawerRoute !== 'root' && (
                <SubDrawerView
                  route={infoDrawerRoute}
                  onBack={() => setInfoDrawerRoute('root')}
                  onPermissionChange={handlePermissionChangeFromScreen}
                />
              )}
            </Animated.View>
          </Modal>

          {/* Clear History Confirmation Modal */}
          <RNModal transparent visible={clearConfirmVisible} onRequestClose={closeClearConfirm} animationType="fade">
            <Pressable style={styles.contextMenuBackdrop} onPress={closeClearConfirm}>
              <View style={[styles.contextMenu, { backgroundColor: colors.background }]}>
                <View style={[styles.contextMenuHeader, { borderBottomColor: colors.inputBorder }]}>
                  <Text style={[styles.contextMenuTitle, { color: colors.textPrimary }]}>
                    {t('clear_browsing_history')}
                  </Text>
                  <Text style={[styles.contextMenuUrl, { color: colors.textSecondary }]}>
                    {t('action_cannot_be_undone')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.contextMenuItem, { borderBottomColor: colors.inputBorder }]}
                  onPress={handleConfirmClearAll}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={22} color="#FF3B30" style={styles.contextMenuIcon} />
                  <Text style={[styles.contextMenuText, { color: '#FF3B30' }]}>{t('clear')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.contextMenuItem, { borderBottomWidth: 0 }]}
                  onPress={closeClearConfirm}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close-outline"
                    size={22}
                    color={colors.textSecondary}
                    style={styles.contextMenuIcon}
                  />
                  <Text style={[styles.contextMenuText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </RNModal>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* UHRP Loading Overlay */}
      {uhrpLoading && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              padding: 30,
              borderRadius: 15,
              alignItems: 'center',
              minWidth: 250,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                marginTop: 20,
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
                textAlign: 'center'
              }}
            >
              Loading UHRP Content...
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: 'center'
              }}
            >
              {uhrpLoading}
            </Text>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  )
}

export default observer(Browser)

/* -------------------------------------------------------------------------- */
/*                               SUB-COMPONENTS                               */
/* -------------------------------------------------------------------------- */

const TabsViewBase = ({
  onDismiss,
  setAddressText,
  colors
}: {
  onDismiss: () => void
  setAddressText: (text: string) => void
  colors: any
}) => {
  const { t } = useTranslation()
  // Use the imported tabStore directly
  const screen = Dimensions.get('window')
  const ITEM_W = screen.width * 0.42
  const ITEM_H = screen.height * 0.28
  const insets = useSafeAreaInsets()

  // Animation for new tab button
  const newTabScale = useRef(new Animated.Value(1)).current
  // Add cooldown state
  const [isCreatingTab, setIsCreatingTab] = useState(false)

  const handleNewTabPress = useCallback(() => {
    // Prevent multiple rapid presses
    if (isCreatingTab) return

    setIsCreatingTab(true)

    // Scale animation
    Animated.sequence([
      Animated.timing(newTabScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(newTabScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start(() => {
      // Create new tab and dismiss view after animation
      tabStore.newTab()
      // Reset address text to new tab URL
      setAddressText(kNEW_TAB_URL)
      onDismiss()

      // Reset cooldown after a short delay
      setTimeout(() => {
        setIsCreatingTab(false)
      }, 300)
    })
  }, [newTabScale, onDismiss, setAddressText, isCreatingTab])

  const renderItem = ({ item }: { item: Tab }) => {
    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const trans: Animated.AnimatedInterpolation<number> = dragX.interpolate({
        inputRange: [-101, 0],
        outputRange: [0, 1],
        extrapolate: 'clamp'
      })
      return <Animated.View style={[styles.swipeDelete]}></Animated.View>
    }
    const renderLeftActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const trans: Animated.AnimatedInterpolation<number> = dragX.interpolate({
        inputRange: [0, 101],
        outputRange: [1, 0],
        extrapolate: 'clamp'
      })
      return <Animated.View style={[styles.swipeDelete]}></Animated.View>
    }

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        onSwipeableRightOpen={() => tabStore.closeTab(item.id)}
        onSwipeableLeftOpen={() => tabStore.closeTab(item.id)}
        friction={2}
        rightThreshold={40}
        leftThreshold={40}
      >
        <Pressable
          style={[
            styles.tabPreview,
            {
              width: ITEM_W,
              height: ITEM_H,
              borderColor: item.id === tabStore.activeTabId ? colors.primary : colors.inputBorder,
              borderWidth: item.id === tabStore.activeTabId ? 3 : StyleSheet.hairlineWidth,
              backgroundColor: colors.paperBackground
            }
          ]}
          onPress={() => {
            tabStore.setActiveTab(item.id)
            onDismiss()
          }}
        >
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.textSecondary + '80',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10
            }}
            onPress={e => {
              e.stopPropagation() // Prevent tab selection when closing
              tabStore.closeTab(item.id)
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ color: colors.background, fontSize: 14, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, overflow: 'hidden' }}>
            {item.url === kNEW_TAB_URL ? (
              <View style={styles.tabPreviewEmpty}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>{t('new_tab')}</Text>
              </View>
            ) : (
              <WebView
                source={{ uri: item.url || kNEW_TAB_URL }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                pointerEvents="none"
              />
            )}
            <View style={[styles.tabTitleBar, { backgroundColor: colors.inputBackground + 'E6' }]}>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}>
                {item.title}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    )
  }

  return (
    <View style={[styles.tabsViewContainer, { backgroundColor: colors.background + 'CC' }]}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <FlatList
        data={tabStore.tabs.slice()}
        renderItem={renderItem}
        keyExtractor={t => String(t.id)}
        numColumns={2}
        contentContainerStyle={{
          padding: 12,
          paddingTop: 32,
          paddingBottom: 20 // Reduced padding since we have a bar now
        }}
      />

      {/* New styled footer bar */}
      <View
        style={[
          styles.tabsViewFooterBar,
          {
            backgroundColor: colors.inputBackground,
            paddingBottom: insets.bottom + 10,
            borderTopColor: colors.inputBorder
          }
        ]}
      >
        <Animated.View style={{ transform: [{ scale: newTabScale }] }}>
          <TouchableOpacity
            style={[
              styles.newTabBtn,
              {
                backgroundColor: colors.primary,
                // Add visual feedback when disabled
                ...(isCreatingTab && { opacity: 0.6 })
              }
            ]}
            onPress={handleNewTabPress}
            activeOpacity={0.7}
            disabled={isCreatingTab}
          >
            <Text style={[styles.newTabIcon, { color: colors.background }]}>＋</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[
            styles.doneButtonStyled,
            {
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: colors.inputBorder
            }
          ]}
          onPress={() => {
            // Add haptic feedback if available
            if (Platform.OS === 'ios') {
              // iOS haptic feedback
              try {
                const { ImpactFeedbackGenerator } = require('expo-haptics')
                ImpactFeedbackGenerator.impactAsync(ImpactFeedbackGenerator.ImpactFeedbackStyle.Medium)
              } catch (e) {
                // Fallback for expo-haptics not available
              }
            }
            tabStore.clearAllTabs()
            onDismiss() // Close the tabs view after clearing
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.background }}>{t('clear_all')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.doneButtonStyled,
            {
              backgroundColor: colors.primary
            }
          ]}
          onPress={onDismiss}
        >
          <Text style={[{ color: colors.background }]}>{t('done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const TabsView = observer(TabsViewBase)

const DrawerItem = React.memo(
  ({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) => {
    const { colors } = useTheme()
    return (
      <TouchableOpacity style={styles.drawerItem} onPress={onPress} activeOpacity={0.6} delayPressIn={0}>
        <Ionicons name={icon} size={22} color={colors.textSecondary} style={styles.drawerIcon} />
        <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    )
  }
)

const SubDrawerView = React.memo(
  ({
    route,
    onBack,
    onOpenNotificationSettings,
    onPermissionChange
  }: {
    route: 'identity' | 'settings' | 'security' | 'trust' | 'permissions'
    onBack: () => void
    onOpenNotificationSettings?: () => void
    onPermissionChange?: (permission: PermissionType, state: PermissionState) => void
  }) => {
    const { colors } = useTheme()
    const { t } = useTranslation()
    const { isWeb2Mode } = useBrowserMode()

    const screens = useMemo(
      () => ({
        identity: <IdentityScreen />,
        settings: <SettingsScreen />,
        security: <SecurityScreen />,
        trust: <TrustScreen />
      }),
      []
    )

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.subDrawerHeader}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.6} delayPressIn={0}>
            <Text style={[styles.backBtn, { color: colors.primary }]}>‹ {t('back')}</Text>
          </TouchableOpacity>
          <Text style={[styles.subDrawerTitle, { color: colors.textPrimary }]}>{t(route)}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.subDrawerContent}>
          {route === 'permissions' ? (
            <View style={{ paddingHorizontal: 20, flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16, marginBottom: 20 }}>
                Manage permissions from websites and apps.
              </Text>

              {tabStore.activeTab?.url && (
                <PermissionsScreen
                  origin={new URL(tabStore.activeTab.url).hostname}
                  onPermissionChange={onPermissionChange}
                />
              )}
            </View>
          ) : (
            // Only show web3 screens when not in web2 mode
            !isWeb2Mode && screens[route]
          )}
        </View>
      </View>
    )
  }
)

/* -------------------------------------------------------------------------- */
/*                              BOTTOM TOOLBAR                               */
/* -------------------------------------------------------------------------- */

const BottomToolbar = ({
  activeTab,
  colors,
  styles,
  navBack,
  navFwd,
  shareCurrent,
  toggleStarDrawer,
  setShowTabsView
}: {
  activeTab: Tab
  colors: any
  styles: any
  navBack: () => void
  navFwd: () => void
  shareCurrent: () => void
  toggleStarDrawer: (open: boolean) => void
  setShowTabsView: (show: boolean) => void
}) => {
  const handleStarPress = useCallback(() => toggleStarDrawer(true), [toggleStarDrawer])
  const handleTabsPress = useCallback(() => setShowTabsView(true), [setShowTabsView])

  // Debug: Log activeTab state on every render
  useEffect(() => {
    console.log('🔧 BottomToolbar activeTab state:', {
      id: activeTab.id,
      url: activeTab.url,
      canGoBack: activeTab.canGoBack,
      canGoForward: activeTab.canGoForward,
      isNewTab: activeTab.url === kNEW_TAB_URL,
      kNEW_TAB_URL: kNEW_TAB_URL,
      backButtonDisabled: !activeTab.canGoBack || activeTab.url === kNEW_TAB_URL
    })
  })

  // Calculate disabled state
  const isBackDisabled = !activeTab.canGoBack || activeTab.url === kNEW_TAB_URL
  const isForwardDisabled = !activeTab.canGoForward || activeTab.url === kNEW_TAB_URL

  console.log('🔧 BottomToolbar Button States:', {
    isBackDisabled,
    isForwardDisabled,
    canGoBack: activeTab.canGoBack,
    url: activeTab.url,
    isNewTab: activeTab.url === kNEW_TAB_URL
  })

  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: colors.inputBackground,
          paddingBottom: 0
        }
      ]}
    >
      {/* Left side navigation buttons */}
      <View style={styles.toolbarSection}>
        <TouchableOpacity
          style={[styles.toolbarButton, { opacity: isBackDisabled ? 0.3 : 1 }]}
          onPress={() => {
            console.log('🔘 Back Button Pressed:', {
              canGoBack: activeTab.canGoBack,
              url: activeTab.url,
              isNewTab: activeTab.url === kNEW_TAB_URL,
              disabled: isBackDisabled
            })
            navBack()
          }}
          disabled={isBackDisabled}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, { opacity: isForwardDisabled ? 0.3 : 1 }]}
          onPress={() => {
            console.log('🔘 Forward Button Pressed:', {
              canGoForward: activeTab.canGoForward,
              url: activeTab.url,
              isNewTab: activeTab.url === kNEW_TAB_URL,
              disabled: isForwardDisabled
            })
            navFwd()
          }}
          disabled={isForwardDisabled}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Ionicons name="arrow-forward" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Center share button */}
      <View style={styles.toolbarCenter}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={shareCurrent}
          disabled={activeTab.url === kNEW_TAB_URL}
          activeOpacity={0.6}
          delayPressIn={0}
        >
          <Ionicons
            name="share-outline"
            size={24}
            color={activeTab.url === kNEW_TAB_URL ? colors.textSecondary : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Right side action buttons */}
      <View style={styles.toolbarSection}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleStarPress} activeOpacity={0.6} delayPressIn={0}>
          <Ionicons name="star-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={handleTabsPress} activeOpacity={0.6} delayPressIn={0}>
          <Ionicons name="copy-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    CSS                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12
  },
  addressInput: {
    paddingHorizontal: 8
  },
  addressBarIcon: { paddingHorizontal: 6 },
  padlock: { marginRight: 4 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  toolbarSection: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  toolbarCenter: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolbarButton: { padding: 6 },
  toolbarIcon: { fontSize: 20 },

  /* suggestions */
  suggestionBox: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingBottom: 8
  },
  suggestionItem: { paddingVertical: 8, paddingHorizontal: 16 },
  suggestionTitle: { fontSize: 14 },
  suggestionUrl: { fontSize: 11 },

  /* star drawer */
  starDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 12
  },

  starTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  starTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  starTabLabel: { fontSize: 15, fontWeight: '600' },
  drawerHandleArea: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },

  /* tabs view */
  tabsViewContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100
  },
  tabPreview: {
    margin: '4%',
    borderRadius: 10,
    overflow: 'visible'
  },
  tabPreviewEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabTitleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  tabsViewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  tabsViewFooterBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5
  },

  doneButton: {
    position: 'absolute',
    right: 20,
    bottom: 56
  },
  deleteAllTabsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  doneButtonStyled: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  newTabBtn: {
    width: 56,
    height: 46,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center'
  },
  newTabIcon: { fontSize: 32, lineHeight: 32 },

  /* info drawer */
  infoDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 10
  },
  drawerHandle: { alignItems: 'center', padding: 10 },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999'
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24
  },
  drawerIcon: {
    marginRight: 16
  },
  drawerLabel: {
    flex: 1,
    fontSize: 17
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
    marginVertical: 8,
    marginHorizontal: 24
  },

  /* sub-drawer */
  subDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12
  },
  backBtn: { fontSize: 17 },
  subDrawerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  subDrawerContent: { flex: 1, padding: 16 },

  /* swipe delete */
  swipeDelete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    marginVertical: 10,
    borderRadius: 10
  },
  swipeDeleteText: { color: '#fff', fontSize: 24 },

  /* confirm modal */
  confirmBox: {
    borderRadius: 12,
    padding: 24,
    width: '85%',
    alignSelf: 'center'
  },
  confirmTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 6,
    marginLeft: 12
  },

  /* modal */
  modal: { justifyContent: 'center', alignItems: 'center' },

  /* backdrop */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 20
  },

  /* context menu styles */
  contextMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  contextMenu: {
    borderRadius: 12,
    minWidth: 250,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  contextMenuHeader: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  contextMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  contextMenuUrl: {
    fontSize: 12,
    opacity: 0.7
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  contextMenuIcon: {
    marginRight: 12
  },
  contextMenuText: {
    fontSize: 16,
    flex: 1
  }
  // Permission modal styles have been moved to PermissionModal.tsx
})
