/* eslint‑disable react/no‑unstable‑nested‑components */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
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
  LayoutAnimation,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import Modal from 'react-native-modal';
import {
  GestureHandlerRootView,
  Swipeable
} from 'react-native-gesture-handler';
import { TabView, SceneMap } from 'react-native-tab-view';
import Fuse from 'fuse.js';
import * as Linking from 'expo-linking';

import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';
import { WalletInterface } from '@bsv/sdk';
import { RecommendedApps } from '@/components/RecommendedApps';
import { useLocalStorage } from '@/context/LocalStorageProvider';
import Balance from '@/components/Balance';

import NotificationPermissionModal from '@/components/NotificationPermissionModal';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import { usePushNotifications } from '@/hooks/usePushNotifications';

import { getPendingUrl, clearPendingUrl } from '@/hooks/useDeepLinking';
import { useWebAppManifest } from '@/hooks/useWebAppManifest';
import * as Notifications from 'expo-notifications';

/* -------------------------------------------------------------------------- */
/*                                   CONSTS                                   */
/* -------------------------------------------------------------------------- */

const kNEW_TAB_URL = 'new-tab-page';
const kGOOGLE_PREFIX = 'https://www.google.com/search?q=';
const BOOKMARKS_KEY = 'bookmarks';
const HISTORY_KEY = 'history';


type HistoryEntry = { title: string; url: string; timestamp: number };
type Bookmark = { title: string; url: string; added: number };

type Tab = {
  id: number;
  url: string;
  title: string;
  webviewRef: React.RefObject<WebView<any>>;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
};

function getInjectableJSMessage(message: any = {}) {
  const messageString = JSON.stringify(message)
  return `
    (function() {
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(${messageString})
      }));
    })();
  `;
}

/* -------------------------------------------------------------------------- */
/*                                  BROWSER                                   */
/* -------------------------------------------------------------------------- */

export default function Browser() {
  /* --------------------------- theme / basic hooks -------------------------- */
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  /* ----------------------------- wallet context ----------------------------- */
  const { managers } = useWallet();
  const [wallet, setWallet] = useState<WalletInterface | undefined>();
  useEffect(() => {
    if (managers?.walletManager?.authenticated)
      setWallet(managers.walletManager);
  }, [managers]);

  /* ---------------------------- storage helpers ----------------------------- */
  const {
    getItem,
    setItem
  } = useLocalStorage();

  /* -------------------------------- history -------------------------------- */
  const loadHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    const raw = await getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  }, [getItem]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    loadHistory().then(setHistory);
  }, [loadHistory]);

  const saveHistory = useCallback(
    async (list: HistoryEntry[]) => {
      setHistory(list);
      await setItem(HISTORY_KEY, JSON.stringify(list));
    },
    [setItem],
  );

  const pushHistory = useCallback(
    async (entry: HistoryEntry) => {
      // Avoid consecutive duplicates
      if (
        history.length &&
        history[0].url.replace(/\/$/, '') === entry.url.replace(/\/$/, '')
      )
        return;
      const next = [entry, ...history].slice(0, 500); // keep last 500
      await saveHistory(next);
    },
    [history, saveHistory],
  );

  const removeHistoryItem = useCallback(
    async (url: string) => {
      const next = history.filter(h => h.url !== url);
      await saveHistory(next);
    },
    [history, saveHistory],
  );

  const clearHistory = useCallback(async () => {
    await saveHistory([]);
  }, [saveHistory]);

  /* -------------------------------- bookmarks ------------------------------- */
  const loadBookmarks = useCallback(async (): Promise<Bookmark[]> => {
    const raw = await getItem(BOOKMARKS_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  }, [getItem]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  useEffect(() => {
    loadBookmarks().then(setBookmarks);
  }, [loadBookmarks]);

  const saveBookmarks = useCallback(
    async (list: Bookmark[]) => {
      setBookmarks(list);
      await setItem(BOOKMARKS_KEY, JSON.stringify(list));
    },
    [setItem],
  );

  const addBookmark = useCallback(
    async (title: string, url: string) => {
      if (url === kNEW_TAB_URL) return;
      if (bookmarks.find(b => b.url === url)) return; // avoid duplicates
      const next = [{ title, url, added: Date.now() }, ...bookmarks];
      await saveBookmarks(next);
    },
    [bookmarks, saveBookmarks],
  );

  const removeBookmark = useCallback(
    async (url: string) => {
      const next = bookmarks.filter(b => b.url !== url);
      await saveBookmarks(next);
    },
    [bookmarks, saveBookmarks],
  );

  /* ---------------------------------- tabs --------------------------------- */
  const nextTabId = useRef(1);
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab(kNEW_TAB_URL)]);
  const [activeTabId, setActiveTabId] = useState(1);
  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId)!,
    [tabs, activeTabId],
  );

  /* -------------------------- ui / animation state -------------------------- */
  const addressEditing = useRef(false);
  const [addressText, setAddressText] = useState(kNEW_TAB_URL);
  const [addressFocused, setAddressFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [infoDrawerRoute, setInfoDrawerRoute] = useState<'root' | 'identity' | 'settings' | 'security' | 'trust' | 'notifications'>('root');
  const drawerAnim = useRef(new Animated.Value(0)).current; // 0 = collapsed

  const [showTabsView, setShowTabsView] = useState(false);
  const [showStarDrawer, setShowStarDrawer] = useState(false);
  const starDrawerAnim = useRef(new Animated.Value(0)).current;

  const addressInputRef = useRef<TextInput>(null);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const { manifest, fetchManifest, getStartUrl, shouldRedirectToStartUrl } = useWebAppManifest();

  /* ------------------------- push notifications ----------------------------- */
  const {
    requestNotificationPermission,
    createPushSubscription,
    unsubscribe,
    getPermission,
    getSubscription,
  } = usePushNotifications();

  const [showNotificationPermissionModal, setShowNotificationPermissionModal] = useState(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState(false);
  const [notificationRequestOrigin, setNotificationRequestOrigin] = useState('');
  const [notificationRequestResolver, setNotificationRequestResolver] = useState<((granted: boolean) => void) | null>(null);


  /* ------------------------------ keyboard hook ----------------------------- */
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Deep linking useEffect
  useEffect(() => {
    const checkPendingUrl = async () => {
      try {
        const pendingUrl = await getPendingUrl();
        if (pendingUrl) {
          console.log('Loading pending URL from deep link:', pendingUrl);
          updateActiveTab({ url: pendingUrl });
          setAddressText(pendingUrl);
          await clearPendingUrl();
        }
      } catch (error) {
        console.error('Error checking pending URL:', error);
      }
    };

    checkPendingUrl();
    const timer = setTimeout(checkPendingUrl, 500);
    return () => clearTimeout(timer);
  }, []);

  // Manifest checking useEffect 
  useEffect(() => {
    let isCancelled = false;

    const handleManifest = async () => {
      if (activeTab.url === kNEW_TAB_URL || !activeTab.url.startsWith('http') || activeTab.isLoading) {
        return;
      }

      if (isCancelled) return;

      console.log('Checking manifest for:', activeTab.url);

      try {
        const manifestData = await fetchManifest(activeTab.url);

        if (isCancelled) return;

        if (manifestData) {
          console.log('Found manifest for', activeTab.url, manifestData);

          if (manifestData.babbage?.protocolPermissions) {
            console.log('Found Babbage protocol permissions:', manifestData.babbage.protocolPermissions);
          }

          const url = new URL(activeTab.url);
          if (shouldRedirectToStartUrl(manifestData, activeTab.url) && url.pathname === '/') {
            const startUrl = getStartUrl(manifestData, activeTab.url);
            console.log('Redirecting to start_url:', startUrl);
            updateActiveTab({ url: startUrl });
            setAddressText(startUrl);
          }
        }
      } catch (error) {
        console.error('Error in manifest handling:', error);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!activeTab.isLoading && activeTab.url !== kNEW_TAB_URL && activeTab.url.startsWith('http')) {
        handleManifest();
      }
    }, 1000);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeTab.url, activeTab.isLoading]);

  /* -------------------------------------------------------------------------- */
  /*                                 UTILITIES                                  */
  /* -------------------------------------------------------------------------- */

  function createTab(url: string): Tab {
    return {
      id: nextTabId.current++,
      url,
      title: 'New Tab',
      webviewRef: React.createRef<WebView>() as React.RefObject<WebView<any>>,
      canGoBack: false,
      canGoForward: false,
      isLoading: true,
    };
  }

  const domainForUrl = (u: string): string => {
    try {
      if (u === kNEW_TAB_URL) return '';
      const { hostname } = new URL(u);
      return hostname;
    } catch {
      return u;
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                              ADDRESS HANDLING                              */
  /* -------------------------------------------------------------------------- */

  const onAddressSubmit = () => {
    let entry = addressText.trim();
    const isProbablyUrl = /^([a-z]+:\/\/|www\.|([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})(\/|$)/i.test(
      entry,
    );

    if (entry === '') entry = kNEW_TAB_URL;
    else if (!isProbablyUrl) entry = kGOOGLE_PREFIX + encodeURIComponent(entry);
    else if (!/^[a-z]+:\/\//i.test(entry)) entry = 'https://' + entry;

    updateActiveTab({ url: entry });
    addressEditing.current = false;
    Keyboard.dismiss();
  };

  /* -------------------------------------------------------------------------- */
  /*                               TAB NAVIGATION                               */
  /* -------------------------------------------------------------------------- */

  const navBack = () => activeTab.webviewRef.current?.goBack();
  const navFwd = () => activeTab.webviewRef.current?.goForward();
  const navReloadOrStop = () =>
    activeTab.isLoading
      ? activeTab.webviewRef.current?.stopLoading()
      : activeTab.webviewRef.current?.reload();

  function updateActiveTab(patch: Partial<Tab>) {
    setTabs(tabs => tabs.map(t => (t.id === activeTabId ? { ...t, ...patch } : t)));
  }

  function closeTab(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTabs(tabs => {
      const filtered = tabs.filter(t => t.id !== id);
      if (filtered.length === 0) filtered.push(createTab(kNEW_TAB_URL));
      // If we closed the active tab, switch to the last tab in the list
      if (id === activeTabId && !filtered.find(t => t.id === activeTabId)) {
        const newActiveId = filtered.length > 0 ? filtered[filtered.length - 1].id : 0;
        if (newActiveId !== 0) {
          setActiveTabId(newActiveId);
        }
      }
      return filtered;
    });
  }

  function newTab(initialUrl = kNEW_TAB_URL) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const t = createTab(initialUrl);
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
    setShowTabsView(false);
  }

  /* -------------------------------------------------------------------------- */
  /*                           NOTIFICATION HANDLERS                            */
  /* -------------------------------------------------------------------------- */

  const handleNotificationPermissionRequest = async (origin: string): Promise<'granted' | 'denied' | 'default'> => {
    return new Promise((resolve) => {
      setNotificationRequestOrigin(origin);
      setNotificationRequestResolver(() => (granted: boolean) => {
        resolve(granted ? 'granted' : 'denied');
      });
      setShowNotificationPermissionModal(true);
    });
  };

  const handleNotificationPermissionResponse = (granted: boolean) => {
    if (notificationRequestResolver) {
      notificationRequestResolver(granted);
      setNotificationRequestResolver(null);
    }
    setShowNotificationPermissionModal(false);
    setNotificationRequestOrigin('');
  };

  /* -------------------------------------------------------------------------- */
  /*                           WEBVIEW MESSAGE HANDLER                          */
  /* -------------------------------------------------------------------------- */

  // === 1. Injected JS ============================================
  const injectedJavaScript = `
  // Push Notification API polyfill
  (function() {
    // Check if Notification API already exists
    if ('Notification' in window) {
      return;
    }

    // Polyfill Notification constructor
    window.Notification = function(title, options = {}) {
      this.title = title;
      this.body = options.body || '';
      this.icon = options.icon || '';
      this.tag = options.tag || '';
      this.data = options.data || null;
      
      // Send notification to native
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'SHOW_NOTIFICATION',
        title: this.title,
        body: this.body,
        icon: this.icon,
        tag: this.tag,
        data: this.data
      }));
      
      return this;
    };

    // Static methods
    window.Notification.requestPermission = function(callback) {
      return new Promise((resolve) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'REQUEST_NOTIFICATION_PERMISSION',
          callback: true
        }));
        
        // Listen for response
        const handler = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NOTIFICATION_PERMISSION_RESPONSE') {
              window.removeEventListener('message', handler);
              const permission = data.permission;
              if (callback) callback(permission);
              resolve(permission);
            }
          } catch (e) {}
        };
        window.addEventListener('message', handler);
      });
    };

    window.Notification.permission = 'default';

    // ServiceWorker registration polyfill for push
    if (!('serviceWorker' in navigator)) {
      navigator.serviceWorker = {
        register: function() {
          return Promise.resolve({
            pushManager: {
              subscribe: function(options) {
                return new Promise((resolve) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'PUSH_SUBSCRIBE',
                    options: options
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        resolve(data.subscription);
                      }
                    } catch (e) {}
                  };
                  window.addEventListener('message', handler);
                });
              },
              getSubscription: function() {
                return new Promise((resolve) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'GET_PUSH_SUBSCRIPTION'
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        resolve(data.subscription);
                      }
                    } catch (e) {}
                  };
                  window.addEventListener('message', handler);
                });
              }
            }
          });
        }
      };
    }

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
  })();
  true;
`;

  // === 2. RN ⇄ WebView message bridge ========================================
  
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const sendResponseToWebView = (id: string, result: any) => {
        const message = {
          type: 'CWI',
          id,
          isInvocation: false,
          result,
          status: 'ok'
        };
  
        activeTab.webviewRef.current?.injectJavaScript(
          getInjectableJSMessage(message)
        );
      };
  
      let msg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch (error) {
        console.error('Failed to parse WebView message:', error);
        return;
      }
  
      // Handle console logs from WebView
      if (msg.type === 'CONSOLE') {
        const logPrefix = '[WebView]';
        switch (msg.method) {
          case 'log':
            console.log(logPrefix, ...msg.args);
            break;
          case 'warn':
            console.warn(logPrefix, ...msg.args);
            break;
          case 'error':
            console.error(logPrefix, ...msg.args);
            break;
          case 'info':
            console.info(logPrefix, ...msg.args);
            break;
          case 'debug':
            console.debug(logPrefix, ...msg.args);
            break;
        }
        return;
      }
  
      // Handle notification permission request
      if (msg.type === 'REQUEST_NOTIFICATION_PERMISSION') {
        const permission = await handleNotificationPermissionRequest(activeTab.url);
  
        activeTab.webviewRef.current?.injectJavaScript(`
            window.Notification.permission = '${permission}';
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'NOTIFICATION_PERMISSION_RESPONSE',
                permission: '${permission}'
              })
            }));
          `);
        return;
      }
  
      // Handle push subscription for remote notifications
      if (msg.type === 'PUSH_SUBSCRIBE') {
        try {
          const subscription = await createPushSubscription(activeTab.url, msg.options?.applicationServerKey);
  
          activeTab.webviewRef.current?.injectJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PUSH_SUBSCRIPTION_RESPONSE',
                  subscription: ${JSON.stringify(subscription)}
                })
              }));
            `);
        } catch (error) {
          console.error('Error creating push subscription:', error);
          activeTab.webviewRef.current?.injectJavaScript(`
              window.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PUSH_SUBSCRIPTION_RESPONSE',
                  subscription: null,
                  error: '${error}'
                })
              }));
            `);
        }
        return;
      }
  
      // Handle get existing push subscription
      if (msg.type === 'GET_PUSH_SUBSCRIPTION') {
        const subscription = getSubscription(activeTab.url);
  
        activeTab.webviewRef.current?.injectJavaScript(`
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'PUSH_SUBSCRIPTION_RESPONSE',
                subscription: ${JSON.stringify(subscription)}
              })
            }));
          `);
        return;
      }
  
      // Handle immediate local notifications
      if (msg.type === 'SHOW_NOTIFICATION') {
        try {
          const permission = getPermission(activeTab.url);
          if (permission === 'granted') {
            // Show notification immediately
            await Notifications.scheduleNotificationAsync({
              content: {
                title: msg.title || 'Website Notification',
                body: msg.body || '',
                data: {
                  origin: activeTab.url,
                  type: 'website',
                  url: activeTab.url,
                  icon: msg.icon,
                  tag: msg.tag,
                  ...msg.data
                },
                sound: true,
              },
              trigger: null,
            });
          }
        } catch (error) {
          console.error('Error showing notification:', error);
        }
        return;
      }
  
      // Handle wallet API calls
      const origin = activeTab.url.replace(/^https?:\/\//, '').split('/')[0];
      let response: any;
      
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
            response = await (wallet as any)[msg.call](typeof msg.args !== 'undefined' ? msg.args : {}, origin);
            break;
          default:
            throw new Error('Unsupported method.');
        }
        sendResponseToWebView(msg.id, response);
      } catch (error) {
        console.error('Error processing wallet API call:', msg.call, error);
      }
    },
    [activeTab.url, activeTab.webviewRef, wallet, createPushSubscription, getSubscription, getPermission, handleNotificationPermissionRequest]
  );

  /* -------------------------------------------------------------------------- */
  /*                      NAV STATE CHANGE → HISTORY TRACKING                   */
  /* -------------------------------------------------------------------------- */

  const handleNavStateChange = (navState: WebViewNavigation) => {
    updateActiveTab({
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      isLoading: navState.loading,
      url: navState.url,
      title: navState.title || navState.url,
    });

    if (!addressEditing.current) setAddressText(navState.url);

    // record history once the page finished loading
    if (!navState.loading && navState.url !== kNEW_TAB_URL) {
      pushHistory({
        title: navState.title || navState.url,
        url: navState.url,
        timestamp: Date.now(),
      }).catch(() => { });
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                          SHARE / HOMESCREEN SHORTCUT                       */
  /* -------------------------------------------------------------------------- */

  const shareCurrent = async () => {
    try {
      await Share.share({ message: activeTab.url });
    } catch (err) {
      console.warn('Share cancelled/failed', err);
    }
  };

  const addToHomeScreen = async () => {
    try {
      if (Platform.OS === 'android') {
        // await createShortcut({
        //   id: domainForUrl(activeTab.url),
        //   shortLabel: activeTab.title,
        //   longLabel: activeTab.title,
        //   url: activeTab.url,
        // });
      } else {
        // Fallback: open native "Add to Home Screen" sheet in Safari
        await Linking.openURL('prefs:root=Safari');
      }
    } catch (e) {
      console.warn('Add to homescreen failed', e);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                           STAR (BOOKMARK+HISTORY)                          */
  /* -------------------------------------------------------------------------- */

  const toggleStarDrawer = (open: boolean) => {
    setShowStarDrawer(open);
    Animated.timing(starDrawerAnim, {
      toValue: open ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const StarDrawer = () => {
    const [index, setIndex] = useState(0);
    const routes = [
      { key: 'bookmarks', title: 'Bookmarks' },
      { key: 'history', title: 'History' },
    ];
    const renderScene = SceneMap({
      bookmarks: () => (
        <RecommendedApps
          includeBookmarks={bookmarks}
          setStartingUrl={(u: string) => {
            updateActiveTab({ url: u });
            toggleStarDrawer(false);
          }}
        />
      ),
      history: () => (
        <HistoryList
          history={history}
          onSelect={u => {
            updateActiveTab({ url: u });
            toggleStarDrawer(false);
          }}
          onDelete={removeHistoryItem}
          onClear={() => setShowClearConfirm(true)}
        />
      ),
    });

    return (
      <Animated.View
        style={[
          styles.starDrawer,
          {
            backgroundColor: colors.background,
            transform: [
              {
                translateY: starDrawerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [Dimensions.get('window').height, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TabView
          navigationState={{ index, routes }}
          onIndexChange={setIndex}
          renderScene={renderScene}
          renderTabBar={props => (
            <View style={styles.starTabBar}>
              {props.navigationState.routes.map((r, i) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.starTab,
                    i === index && { borderBottomColor: colors.primary },
                  ]}
                  onPress={() => setIndex(i)}
                >
                  <Text
                    style={[
                      styles.starTabLabel,
                      { color: i === index ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {r.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        {/* ------ Clear history confirmation ------ */}
        {renderClearConfirm()}
      </Animated.View>
    );
  };

  /* ---------------------------- clear history modal ------------------------- */
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const renderClearConfirm = () => (
    <Modal
      isVisible={showClearConfirm}
      onBackdropPress={() => setShowClearConfirm(false)}
      swipeDirection="down"
      style={styles.modal}
      useNativeDriver
    >
      <View
        style={[styles.confirmBox, { backgroundColor: colors.paperBackground }]}
      >
        <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
          Clear browsing history?
        </Text>
        <View style={styles.confirmButtons}>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.inputBorder }]}
            onPress={() => setShowClearConfirm(false)}
          >
            <Text style={{ color: colors.textPrimary }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: '#ff3b30' }]}
            onPress={() => {
              clearHistory();
              setShowClearConfirm(false);
            }}
          >
            <Text style={{ color: '#fff' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* -------------------------------------------------------------------------- */
  /*                         ADDRESS BAR AUTOCOMPLETE                           */
  /* -------------------------------------------------------------------------- */

  const fuseRef = useRef(
    new Fuse<HistoryEntry | Bookmark>([], {
      keys: ['title', 'url'],
      threshold: 0.4,
    }),
  );
  useEffect(() => {
    fuseRef.current.setCollection([...history, ...bookmarks]);
  }, [history, bookmarks]);

  const [addressSuggestions, setAddressSuggestions] = useState<
    (HistoryEntry | Bookmark)[]
  >([]);

  const onChangeAddressText = (txt: string) => {
    setAddressText(txt);
    if (txt.trim().length === 0) {
      setAddressSuggestions([]);
      return;
    }
    const res = fuseRef.current.search(txt).slice(0, 5).map(r => r.item);
    setAddressSuggestions(res);
  };

  /* -------------------------------------------------------------------------- */
  /*                              INFO DRAWER NAV                               */
  /* -------------------------------------------------------------------------- */
  const toggleInfoDrawer = (open: boolean, route: typeof infoDrawerRoute = 'root') => {
    setInfoDrawerRoute(route);
    setShowInfoDrawer(open);
  };

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: showInfoDrawer ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [showInfoDrawer, drawerAnim]);

  const drawerHeight =
    infoDrawerRoute === 'root'
      ? 400 + insets.bottom
      : Dimensions.get('window').height * 0.9;

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                    */
  /* -------------------------------------------------------------------------- */

  const showAddressBar = !keyboardVisible || addressFocused;
  const showBottomBar = !keyboardVisible && !addressFocused;

  const addressDisplay = addressFocused
    ? addressText
    : domainForUrl(addressText);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ----------------- dim bg when address focused ------------------ */}
      {addressFocused && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <SafeAreaView
            style={[styles.container, { backgroundColor: colors.inputBackground }]}
          >
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* ------------------ main viewport ------------------ */}
            {activeTab.url === kNEW_TAB_URL ? (
              <RecommendedApps
                includeBookmarks={bookmarks}
                setStartingUrl={url => updateActiveTab({ url })}
              />
            ) : (
              <WebView
                ref={activeTab.webviewRef}
                source={{ uri: activeTab.url }}
                originWhitelist={['*']}
                onMessage={handleMessage}
                injectedJavaScript={injectedJavaScript}
                onNavigationStateChange={handleNavStateChange}
                javaScriptEnabled
                domStorageEnabled
                allowsBackForwardNavigationGestures
                containerStyle={{ backgroundColor: colors.background }}
                style={{ flex: 1 }}
              />
            )}

            {/* ---------------- address bar ---------------- */}
            {showAddressBar && (
              <View
                style={[
                  styles.addressBar,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    paddingTop: 12,
                  },
                ]}
              >
                {/* info icon or back btn (drawer internal) */}
                {!addressFocused && (
                  <TouchableOpacity onPress={() => toggleInfoDrawer(true)}>
                    <Text style={styles.addressButton}>ℹ︎</Text>
                  </TouchableOpacity>
                )}

                {/* padlock + domain */}
                {!addressFocused && !activeTab.isLoading && activeTab.url.startsWith('https') && (
                  <Text style={[styles.padlock, { color: colors.textSecondary }]}>
                    🔒
                  </Text>
                )}

                {/* input */}
                <TextInput
                  ref={addressInputRef}
                  editable
                  value={addressDisplay === 'new-tab-page' ? '' : addressDisplay}
                  onChangeText={onChangeAddressText}
                  onFocus={() => {
                    addressEditing.current = true;
                    setAddressFocused(true);
                    setTimeout(() => {
                      addressInputRef.current?.setNativeProps({
                        selection: { start: 0, end: addressText.length },
                      });
                    }, 0);
                  }}
                  onBlur={() => {
                    addressEditing.current = false;
                    setAddressFocused(false);
                    setAddressSuggestions([]);
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
                      textAlign: addressFocused ? 'left' : 'center',
                    },
                  ]}
                  placeholder="Search or enter site name"
                  placeholderTextColor={colors.textSecondary}
                />

                {/* reload / stop / clear btn */}
                <TouchableOpacity
                  onPress={
                    addressFocused
                      ? () => setAddressText('')
                      : navReloadOrStop
                  }
                >
                  <Text style={styles.addressButton}>
                    {addressFocused ? '✕' : activeTab.isLoading ? '✕' : '↻'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ---- autocomplete suggestions ---- */}
            {addressFocused && addressSuggestions.length > 0 && (
              <View
                style={[
                  styles.suggestionBox,
                  { backgroundColor: colors.paperBackground },
                ]}
              >
                {addressSuggestions.map(s => (
                  <TouchableOpacity
                    key={s.url}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setAddressText(s.url);
                      onAddressSubmit();
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.suggestionTitle, { color: colors.textPrimary }]}
                    >
                      {'title' in s ? s.title : s.url}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.suggestionUrl, { color: colors.textSecondary }]}
                    >
                      {s.url}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ---------------- bottom toolbar ---------------- */}
            {showBottomBar && (
              <View
                style={[
                  styles.bottomBar,
                  {
                    backgroundColor: colors.inputBackground,
                    paddingBottom: insets.bottom,
                  },
                ]}
              >
                <ToolbarButton
                  icon="←"
                  onPress={navBack}
                  disabled={!activeTab.canGoBack}
                />
                <ToolbarButton
                  icon="→"
                  onPress={navFwd}
                  disabled={!activeTab.canGoForward}
                />
                <ToolbarButton
                  icon="⇪"
                  onPress={shareCurrent}
                  disabled={activeTab.url === kNEW_TAB_URL}
                />
                <ToolbarButton
                  icon="★"
                  onPress={() => toggleStarDrawer(true)}
                />
                <ToolbarButton
                  icon="▒"
                  onPress={() => setShowTabsView(true)}
                />
              </View>
            )}

            {/* ---------------- full‑screen tabs view ---------------- */}
            {showTabsView && (
              <TabsView
                tabs={tabs}
                activeId={activeTabId}
                setActive={id => {
                  setActiveTabId(id);
                  setShowTabsView(false);
                }}
                addTab={newTab}
                closeTab={closeTab}
                onDismiss={() => setShowTabsView(false)}
                colors={colors}
              />
            )}

            {/* ---------------- star (bookmark/history) drawer -------------- */}
            {showStarDrawer && <StarDrawer />}

            {/* ---------------- info drawer ---------------- */}
            <Modal
              isVisible={showInfoDrawer}
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
                          outputRange: [drawerHeight, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* ===== root menu ===== */}
                {infoDrawerRoute === 'root' && (
                  <>
                    <Pressable style={styles.drawerHandle} onPress={() => toggleInfoDrawer(false)}>
                      <View style={styles.handleBar} />
                    </Pressable>
                    <Balance />
                    <DrawerItem
                      label="Identity"
                      onPress={() => setInfoDrawerRoute('identity')}
                    />
                    <DrawerItem
                      label="Trust Network"
                      onPress={() => setInfoDrawerRoute('trust')}
                    />
                    <DrawerItem
                      label="Settings"
                      onPress={() => setInfoDrawerRoute('settings')}
                    />
                    <DrawerItem
                      label="Security"
                      onPress={() => setInfoDrawerRoute('security')}
                    />
                    <DrawerItem
                      label="Notifications"
                      onPress={() => setInfoDrawerRoute('notifications')}
                    />
                    <DrawerItem
                      label="Add Bookmark"
                      onPress={() => {
                        addBookmark(activeTab.title, activeTab.url);
                        toggleInfoDrawer(false);
                      }}
                    />
                    <DrawerItem
                      label="Add to Device Homescreen"
                      onPress={async () => {
                        await addToHomeScreen();
                        toggleInfoDrawer(false);
                      }}
                    />
                    <DrawerItem
                      label="Back to Homepage"
                      onPress={() => {
                        updateActiveTab({ url: kNEW_TAB_URL });
                        setAddressText(kNEW_TAB_URL);
                        toggleInfoDrawer(false);
                      }}
                    />
                  </>
                )}

                {/* ===== sub‑views (identity/settings/security/trust/notifications) ===== */}
                {infoDrawerRoute !== 'root' && (
                  <SubDrawerView
                    route={infoDrawerRoute}
                    onBack={() => setInfoDrawerRoute('root')}
                    onOpenNotificationSettings={() => {
                      setShowNotificationSettingsModal(true);
                      toggleInfoDrawer(false);
                    }}
                  />
                )}
              </Animated.View>
            </Modal>
            {/* ---------------- notification modals ---------------- */}
            <NotificationPermissionModal
              visible={showNotificationPermissionModal}
              origin={notificationRequestOrigin}
              onDismiss={() => setShowNotificationPermissionModal(false)}
              onResponse={handleNotificationPermissionResponse}
            />

            <NotificationSettingsModal
              visible={showNotificationSettingsModal}
              onDismiss={() => setShowNotificationSettingsModal(false)}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </GestureHandlerRootView>
  );
}

/* -------------------------------------------------------------------------- */
/*                               SUB‑COMPONENTS                               */
/* -------------------------------------------------------------------------- */

const ToolbarButton = ({
  icon,
  onPress,
  disabled,
}: {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    style={styles.toolbarButton}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.toolbarIcon, disabled && { opacity: 0.3 }]}>{icon}</Text>
  </TouchableOpacity>
);

/* ---- history list ---- */

const HistoryList = ({
  history,
  onSelect,
  onDelete,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (url: string) => void;
  onDelete: (url: string) => void;
  onClear: () => void;
}) => {
  const { colors } = useTheme();
  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <View style={[styles.swipeDelete, { backgroundColor: '#ff3b30' }]}>
          <Text style={styles.swipeDeleteText}>✕</Text>
        </View>
      )}
      onSwipeableRightOpen={() => onDelete(item.url)}
    >
      <Pressable style={styles.historyItem} onPress={() => onSelect(item.url)}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15 }}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>
          {item.url}
        </Text>
      </Pressable>
    </Swipeable>
  );
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={history}
        keyExtractor={i => i.url + i.timestamp}
        renderItem={renderItem}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
      <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
        <Text style={styles.clearBtnIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ---- tabs view ---- */

const TabsView = ({
  tabs,
  activeId,
  setActive,
  addTab,
  closeTab,
  onDismiss,
  colors,
}: {
  tabs: Tab[];
  activeId: number;
  setActive: (id: number) => void;
  addTab: () => void;
  closeTab: (id: number) => void;
  onDismiss: () => void;
  colors: any;
}) => {
  const screen = Dimensions.get('window');
  const ITEM_W = screen.width * 0.42;
  const ITEM_H = screen.height * 0.28;
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: Tab }) => (
    <Pressable
      style={[
        styles.tabPreview,
        {
          width: ITEM_W,
          height: ITEM_H,
          borderColor: item.id === activeId ? colors.primary : colors.inputBorder,
          borderWidth: item.id === activeId ? 2 : StyleSheet.hairlineWidth,
          backgroundColor: colors.background,
        },
      ]}
      onPress={() => setActive(item.id)}
    >
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {item.url === kNEW_TAB_URL ? (
          <View style={styles.tabPreviewEmpty}>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>New Tab</Text>
          </View>
        ) : (
          <WebView
            source={{ uri: item.url }}
            style={{ flex: 1 }}
            scrollEnabled={false}
            pointerEvents="none"
          />
        )}
        <View style={[styles.tabTitleBar, { backgroundColor: colors.paperBackground }]}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}
          >
            {item.title}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.tabCloseButton}
        onPress={() => closeTab(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ color: colors.textSecondary }}>✕</Text>
      </TouchableOpacity>
    </Pressable>
  );

  return (
    <View style={styles.tabsViewContainer}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <FlatList
        data={tabs}
        renderItem={renderItem}
        keyExtractor={t => String(t.id)}
        numColumns={2}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 + insets.bottom }}
      />

      <View style={[styles.tabsViewFooter, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.newTabBtn} onPress={() => addTab()}>
          <Text style={styles.newTabIcon}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={onDismiss}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ---- drawer item ---- */

const DrawerItem = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Pressable style={styles.drawerItem} onPress={onPress}>
      <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
};

/* ---- sub‑drawer view (identity/settings/security/trust) ---- */

const SubDrawerView = ({
  route,
  onBack,
  onOpenNotificationSettings,
}: {
  route: 'identity' | 'settings' | 'security' | 'trust' | 'notifications';
  onBack: () => void;
  onOpenNotificationSettings?: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.subDrawerHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backBtn, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.subDrawerTitle, { color: colors.textPrimary }]}>
          {route[0].toUpperCase() + route.slice(1)}
        </Text>
        <View style={{ width: 60 }} />
      </View>
      {/* ----  rendering real screens; placeholder for now ---- */}
      <View style={styles.subDrawerContent}>
        {route === 'notifications' ? (
          <View>
            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              Manage notifications from websites and apps.
            </Text>

            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: colors.inputBackground }]}
              onPress={onOpenNotificationSettings}
            >
              <View style={styles.settingsButtonContent}>
                <View style={styles.settingsButtonIcon}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <View style={styles.settingsButtonText}>
                  <Text style={[styles.settingsButtonTitle, { color: colors.textPrimary }]}>
                    Notification Settings
                  </Text>
                  <Text style={[styles.settingsButtonSubtitle, { color: colors.textSecondary }]}>
                    Manage website permissions
                  </Text>
                </View>
                <Text style={[styles.settingsButtonChevron, { color: colors.textSecondary }]}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            {route} screen content goes here.
          </Text>
        )}
      </View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    CSS                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addressInput: {
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    borderRadius: 6,
    fontSize: 15,
  },
  addressButton: { fontSize: 18, marginHorizontal: 6, color: '#fff' },
  padlock: { marginRight: 4, fontSize: 14 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarButton: { padding: 6 },
  toolbarIcon: { fontSize: 20, color: '#fff' },

  /* suggestions */
  suggestionBox: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingBottom: 8,
  },
  suggestionItem: { paddingVertical: 8, paddingHorizontal: 16 },
  suggestionTitle: { fontSize: 14 },
  suggestionUrl: { fontSize: 11 },

  /* star drawer */
  starDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '30%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    elevation: 12,
  },
  starTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  starTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  starTabLabel: { fontSize: 15, fontWeight: '600' },

  /* history list */
  historyItem: { padding: 12 },
  clearBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  clearBtnIcon: { color: '#fff', fontSize: 22 },

  /* tabs view */
  tabsViewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  tabPreview: {
    margin: '4%',
    borderRadius: 10,
    overflow: 'visible', // for close button
  },
  tabPreviewEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabTitleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tabCloseButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#777',
  },
  tabsViewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  newTabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4c4c4c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTabIcon: { fontSize: 32, color: '#fff', lineHeight: 32 },
  doneButton: {
    position: 'absolute',
    right: 20,
    bottom: 26,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },


  /* info drawer */
  infoDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 10,
  },
  drawerHandle: { alignItems: 'center', padding: 10 },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
  },
  drawerItem: { paddingVertical: 14, paddingHorizontal: 24 },
  drawerLabel: { fontSize: 17 },

  /* sub‑drawer */
  subDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
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
    borderRadius: 10,
  },
  swipeDeleteText: { color: '#fff', fontSize: 24 },

  /* confirm modal */
  confirmBox: {
    borderRadius: 12,
    padding: 24,
    width: '85%',
    alignSelf: 'center',
  },
  confirmTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 6,
    marginLeft: 12,
  },

  /* modal */
  modal: { justifyContent: 'center', alignItems: 'center' },

  /* backdrop */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 20,
  },
  /* notification settings */
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsButtonText: {
    flex: 1,
  },
  settingsButtonTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingsButtonSubtitle: {
    fontSize: 14,
  },
  settingsButtonChevron: {
    fontSize: 20,
    fontWeight: '300',
  },
});
