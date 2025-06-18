/* eslint-disable react/no-unstable-nested-components */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
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
  InteractionManager
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation
} from 'react-native-webview'
import Modal from 'react-native-modal'
import { GestureHandlerRootView, Swipeable, PanGestureHandler, State as GestureState } from 'react-native-gesture-handler'
import { TabView, SceneMap } from 'react-native-tab-view'
import Fuse from 'fuse.js'
import * as Linking from 'expo-linking'

import { useTheme } from '@/context/theme/ThemeContext'
import { useWallet } from '@/context/WalletContext'
import { WalletInterface } from '@bsv/sdk'
import { RecommendedApps } from '@/components/RecommendedApps'
import { useLocalStorage } from '@/context/LocalStorageProvider'
import Balance from '@/components/Balance'
import type { Bookmark, HistoryEntry, Tab } from '@/shared/types/browser'
import { HistoryList } from '@/components/HistoryList'
import { isValidUrl } from '@/utils/generalHelpers'
import tabStore from '@/stores/TabStore'
import bookmarkStore from '@/stores/BookmarkStore'

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   CONSTS                                   */
/* -------------------------------------------------------------------------- */

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
  renderClearConfirm,
  colors,
  styles,
  index,
  setIndex
}: {
  BookmarksScene: React.ComponentType;
  HistoryScene: React.ComponentType;
  renderClearConfirm: () => React.ReactNode;
  colors: any;
  styles: any;
  index: number;
  setIndex: (index: number) => void;
}) {
  console.log('[StarDrawer] Render');

  useEffect(() => {
    console.log('[StarDrawer] MOUNT');
    return () => console.log('[StarDrawer] UNMOUNT');  
  }, [])

  const routes = useMemo(() => [
    { key: 'bookmarks', title: 'Bookmarks' },
    { key: 'history', title: 'History' }
  ], []);
  const renderScene = useMemo(() => SceneMap({
    bookmarks: BookmarksScene,
    history: HistoryScene
  }), [BookmarksScene, HistoryScene]);
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
                style={[
                  styles.starTab,
                  i === index && { borderBottomColor: colors.primary }
                ]}
                onPress={() => setIndex(i)}
              >
                <Text
                  style={[
                    styles.starTabLabel,
                    {
                      color:
                        i === index ? colors.primary : colors.textSecondary
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
      {renderClearConfirm()}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  BROWSER                                   */
/* -------------------------------------------------------------------------- */

export default function Browser() {
  /* --------------------------- theme / basic hooks -------------------------- */
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  /* ----------------------------- wallet context ----------------------------- */
  const { managers } = useWallet()
  const [wallet, setWallet] = useState<WalletInterface | undefined>()
  useEffect(() => {
    if (managers?.walletManager?.authenticated)
      setWallet(managers.walletManager)
  }, [managers])

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
      if (
        history.length &&
        history[0].url.replace(/\/$/, '') === entry.url.replace(/\/$/, '')
      )
        return
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
  const addBookmark = useCallback((title: string, url: string) => {
    bookmarkStore.addBookmark(title, url)
  }, [])

  const removeBookmark = useCallback((url: string) => {
    bookmarkStore.removeBookmark(url)
  }, [])

  /* ---------------------------------- tabs --------------------------------- */
  const activeTab = tabStore.activeTab!

  /* -------------------------- ui / animation state -------------------------- */
  const addressEditing = useRef(false)
  const [addressText, setAddressText] = useState(kNEW_TAB_URL)
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressBarHeight, setAddressBarHeight] = useState(0);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [showInfoDrawer, setShowInfoDrawer] = useState(false)
  const [infoDrawerRoute, setInfoDrawerRoute] = useState<
    'root' | 'identity' | 'settings' | 'security' | 'trust'
  >('root')
  const drawerAnim = useRef(new Animated.Value(0)).current

  const [showTabsView, setShowTabsView] = useState(false)
  const [showStarDrawer, setShowStarDrawer] = useState(false)
  const [starTabIndex, setStarTabIndex] = useState(0);
  const starDrawerAnim = useRef(new Animated.Value(0)).current
  

  const addressInputRef = useRef<TextInput>(null)

  /* ------------------------------ keyboard hook ----------------------------- */
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      console.log('[Browser] Keyboard show event:', showEvent);
      setKeyboardVisible(true);
      const height = event.endCoordinates.height;
      setKeyboardHeight(height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      console.log('[Browser] Keyboard hide event:', hideEvent);
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      if (addressInputRef.current) {
        console.log('[Browser] Blurring address input from keyboard hide event');
      }
      addressInputRef.current?.blur();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                                 UTILITIES                                  */
  /* -------------------------------------------------------------------------- */

  const domainForUrl = (u: string): string => {
    try {
      if (u === kNEW_TAB_URL) return ''
      const { hostname } = new URL(u)
      return hostname
    } catch {
      return u
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                              ADDRESS HANDLING                              */
  /* -------------------------------------------------------------------------- */

  const onAddressSubmit = () => {
    let entry = addressText.trim()
    const isProbablyUrl =
      /^([a-z]+:\/\/|www\.|([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})(\/|$)/i.test(entry)

    if (entry === '') entry = kNEW_TAB_URL
    else if (!isProbablyUrl) entry = kGOOGLE_PREFIX + encodeURIComponent(entry)
    else if (!/^[a-z]+:\/\//i.test(entry)) entry = 'https://' + entry

    if (!isValidUrl(entry)) {
      entry = kNEW_TAB_URL
    }

    updateActiveTab({ url: entry })
    addressEditing.current = false
  }

  /* -------------------------------------------------------------------------- */
  /*                               TAB NAVIGATION                               */
  /* -------------------------------------------------------------------------- */

  const navBack = () => activeTab.webviewRef.current?.goBack()
  const navFwd = () => activeTab.webviewRef.current?.goForward()
  const navReloadOrStop = () =>
    activeTab.isLoading
      ? activeTab.webviewRef.current?.stopLoading()
      : activeTab.webviewRef.current?.reload()

  const updateActiveTab = useCallback((patch: Partial<Tab>) => {
    const newUrl = patch.url
    if (newUrl && !isValidUrl(newUrl)) {
      patch.url = kNEW_TAB_URL
    }
    tabStore.updateTab(tabStore.activeTabId, patch)
  }, [])

  function closeTab(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    tabStore.closeTab(id)
  }

  useEffect(() => {
    if (tabStore.tabs.length === 0) {
      tabStore.newTab()
    }
  }, [])

  const dismissKeyboard = () => {
    addressInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const responderProps =
    addressFocused && keyboardVisible
      ? {
        onStartShouldSetResponder: () => true,
        onResponderRelease: dismissKeyboard,
      }
      : {};

  /* -------------------------------------------------------------------------- */
  /*                           WEBVIEW MESSAGE HANDLER                          */
  /* -------------------------------------------------------------------------- */

  const injectedJavaScript = `/* YOUR ORIGINAL INJECTED JS HERE */`

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const sendResponseToWebView = (id: string, result: any) => {
        const message = {
          type: 'CWI',
          id,
          isInvocation: false,
          result,
          status: 'ok'
        }
        activeTab.webviewRef.current?.injectJavaScript(
          getInjectableJSMessage(message)
        )
      }

      const msg = JSON.parse(event.nativeEvent.data)

      if (msg.type === 'CONSOLE') {
        switch (msg.method) {
          case 'log':
            console.log('[WebView]', ...msg.args)
            break
          case 'warn':
            console.warn('[WebView]', ...msg.args)
            break
          case 'error':
            console.error('[WebView]', ...msg.args)
            break
          case 'info':
            console.info('[WebView]', ...msg.args)
            break
          case 'debug':
            console.debug('[WebView]', ...msg.args)
            break
        }
        return
      }

      const origin = activeTab.url.replace(/^https?:\/\//, '').split('/')[0]
      let response: any
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
          response = await (wallet as any)[msg.call](
            typeof msg.args !== 'undefined' ? msg.args : {},
            origin
          )
          break
        default:
          throw new Error('Unsupported method.')
      }
      sendResponseToWebView(msg.id, response)
    },
    [activeTab.url, activeTab.webviewRef, wallet]
  )

  /* -------------------------------------------------------------------------- */
  /*                      NAV STATE CHANGE → HISTORY TRACKING                   */
  /* -------------------------------------------------------------------------- */

  const handleNavStateChange = (navState: WebViewNavigation) => {
    tabStore.handleNavigationStateChange(tabStore.activeTabId, navState)
    if (!addressEditing.current) setAddressText(navState.url)

    if (!navState.loading && navState.url !== kNEW_TAB_URL) {
      pushHistory({
        title: navState.title || navState.url,
        url: navState.url,
        timestamp: Date.now()
      }).catch(() => { })
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          SHARE / HOMESCREEN SHORTCUT                       */
  /* -------------------------------------------------------------------------- */

  const shareCurrent = async () => {
    try {
      await Share.share({ message: activeTab.url })
    } catch (err) {
      console.warn('Share cancelled/failed', err)
    }
  }

  const addToHomeScreen = async () => {
    try {
      if (Platform.OS === 'android') {
      } else {
        await Linking.openURL('prefs:root=Safari')
      }
    } catch (e) {
      console.warn('Add to homescreen failed', e)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                           STAR (BOOKMARK+HISTORY)                          */
  /* -------------------------------------------------------------------------- */
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDrawerAnimating, setIsDrawerAnimating] = useState(false);
  const windowHeight = Dimensions.get('window').height
  const drawerFullHeight = windowHeight * 0.75
  const translateY = useRef(new Animated.Value(drawerFullHeight)).current

  const closeStarDrawer = useCallback(() => {
    if (isDrawerAnimating) return
    setIsDrawerAnimating(true)
    Animated.spring(translateY, {
      toValue: drawerFullHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8
    }).start(() => {
      setShowStarDrawer(false)
      setIsDrawerAnimating(false)
    })
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

        const shouldClose =
          translationY > drawerFullHeight / 3 || velocityY > 800
        const targetValue = shouldClose ? drawerFullHeight : 0

        Animated.spring(translateY, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
          velocity: velocityY / 500
        }).start(() => {
          if (shouldClose) {
            setShowStarDrawer(false)
          }
          setIsDrawerAnimating(false)
        })
      }
    },
    [drawerFullHeight, translateY]
  )

  useEffect(() => {
    console.log('[Browser] showStarDrawer changed:', showStarDrawer);

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

  const toggleStarDrawer = useCallback((open: boolean) => {
    setShowStarDrawer(open)
    Animated.timing(starDrawerAnim, {
      toValue: open ? 1 : 0,
      duration: 250,
      useNativeDriver: true
    }).start()
  }, [starDrawerAnim])

  // State for clear confirm modal (move this above scene components)

  const handleSetStartingUrl = useCallback((url: string) => {
    updateActiveTab({ url })
    toggleStarDrawer(false)
  }, [updateActiveTab])

  const BookmarksScene = useMemo(() => {
    console.log('[BookmarksScene] Render');
    return () => (
      <RecommendedApps
        includeBookmarks={bookmarkStore.bookmarks}
        setStartingUrl={handleSetStartingUrl}
      />
    )
  }, [bookmarkStore.bookmarks, handleSetStartingUrl])

  const HistoryScene = React.useCallback(() => {
    console.log('[HistoryScene] Render');
    return (
    <HistoryList
      history={history}
      onSelect={u => {
        updateActiveTab({ url: u })
        toggleStarDrawer(false)
      }}
      onDelete={removeHistoryItem}
      onClear={() => setShowClearConfirm(true)}
    />
  )}, [history, updateActiveTab, toggleStarDrawer, removeHistoryItem, setShowClearConfirm]);



  /* ---------------------------- clear history modal ------------------------- */
  const renderClearConfirm = useCallback(() => (
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
              clearHistory()
              setShowClearConfirm(false)
            }}
          >
            <Text style={{ color: '#fff' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ), [showClearConfirm, colors, styles, clearHistory])

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

  const [addressSuggestions, setAddressSuggestions] = useState<
    (HistoryEntry | Bookmark)[]
  >([])

  const onChangeAddressText = (txt: string) => {
    setAddressText(txt)
    if (txt.trim().length === 0) {
      setAddressSuggestions([])
      return
    }
    const res = fuseRef.current
      .search(txt)
      .slice(0, 5)
      .map(r => r.item)
    setAddressSuggestions(res)
  }

  /* -------------------------------------------------------------------------- */
  /*                              INFO DRAWER NAV                               */
  /* -------------------------------------------------------------------------- */

  const toggleInfoDrawer = (
    open: boolean,
    route: typeof infoDrawerRoute = 'root'
  ) => {
    setInfoDrawerRoute(route)
    setShowInfoDrawer(open)
  }

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: showInfoDrawer ? 1 : 0,
      duration: 260,
      useNativeDriver: true
    }).start()
  }, [showInfoDrawer, drawerAnim])

  const drawerHeight =
    infoDrawerRoute === 'root'
      ? 260 + insets.bottom
      : Dimensions.get('window').height * 0.9

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                    */
  /* -------------------------------------------------------------------------- */

  const showAddressBar = !keyboardVisible || addressFocused
  const showBottomBar = !(keyboardVisible && addressFocused)

  const starDrawerAnimatedStyle = useMemo(() => ([
    styles.starDrawer,
    {
      backgroundColor: colors.background,
      height: drawerFullHeight,
      top: windowHeight - drawerFullHeight,
      transform: [{ translateY }]
    }
  ]), [styles.starDrawer, colors.background, drawerFullHeight, windowHeight, translateY]);

  const addressDisplay = addressFocused
    ? addressText
    : domainForUrl(addressText)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={addressFocused
          ? (Platform.OS === 'ios' ? 'padding' : 'height')
          : undefined
        }
      >
        <SafeAreaView
          style={[
            styles.container,
            {
              backgroundColor: colors.inputBackground,
              paddingBottom: addressFocused && keyboardVisible
                ? 0
                : insets.bottom
            }
          ]}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />

          <Text style={{ color: 'red', fontSize: 20 }}>update 8</Text>

          {activeTab.url === kNEW_TAB_URL ? (
            <RecommendedApps
              includeBookmarks={bookmarkStore.bookmarks}
              setStartingUrl={url => updateActiveTab({ url })}
            />
          ) : (
            <View
              style={{ flex: 1 }}
              {...responderProps}
            >
              <WebView
                ref={activeTab.webviewRef}
                source={{ uri: activeTab.url }}
                originWhitelist={['https://*', 'http://*']}
                onMessage={handleMessage}
                injectedJavaScript={injectedJavaScript}
                onNavigationStateChange={handleNavStateChange}
                javaScriptEnabled
                domStorageEnabled
                allowsBackForwardNavigationGestures
                containerStyle={{ backgroundColor: colors.background }}
                style={{ flex: 1 }}
              />
            </View>
          )}
          <View
            onLayout={(e) => setAddressBarHeight(e.nativeEvent.layout.height)}
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
              <TouchableOpacity onPress={() => toggleInfoDrawer(true)}>
                <Text style={styles.addressButton}>ℹ︎</Text>
              </TouchableOpacity>
            )}

            {!addressFocused &&
              !activeTab.isLoading &&
              activeTab.url.startsWith('https') && (
                <Text
                  style={[styles.padlock, { color: colors.textSecondary }]}
                >
                  🔒
                </Text>
              )}

            <TextInput
              ref={addressInputRef}
              editable
              value={
                addressDisplay === 'new-tab-page' ? '' : addressDisplay
              }
              onChangeText={onChangeAddressText}
              onFocus={() => {
                addressEditing.current = true
                setAddressFocused(true)
                setTimeout(() => {
                  addressInputRef.current?.setNativeProps({
                    selection: { start: 0, end: addressText.length }
                  })
                }, 0)
              }}
              onBlur={() => {
                addressEditing.current = false
                setAddressFocused(false)
                setAddressSuggestions([])
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
              placeholder="Search or enter site name"
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              onPress={
                addressFocused ? () => setAddressText('') : navReloadOrStop
              }
            >
              <Text style={styles.addressButton}>
                {addressFocused ? '✕' : activeTab.isLoading ? '✕' : '↻'}
              </Text>
            </TouchableOpacity>
          </View>

          {addressFocused && addressSuggestions.length > 0 && (
            <View
              style={[
                styles.suggestionBox,
                { backgroundColor: colors.paperBackground }
              ]}
            >
              {addressSuggestions.map(
                (entry: HistoryEntry | Bookmark, i: number) => (
                  <TouchableOpacity
                    key={entry.url}
                    onPress={() => {
                      setAddressText(entry.url)
                      onAddressSubmit()
                    }}
                    style={styles.suggestionItem}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.suggestionTitle,
                        { color: colors.textPrimary }
                      ]}
                    >
                      {entry.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.suggestionUrl,
                        { color: colors.textSecondary }
                      ]}
                    >
                      {entry.url}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}

          {showTabsView && (
            <TabsView
              tabs={tabStore.tabs}
              activeId={tabStore.activeTabId}
              setActive={tabStore.setActiveTab}
              addTab={tabStore.addTab}
              closeTab={tabStore.removeTab}
              onDismiss={() => setShowTabsView(false)}
              colors={colors}
            />
          )}

          {showStarDrawer && (
            <View style={StyleSheet.absoluteFill}>
              <Pressable style={styles.backdrop} onPress={closeStarDrawer} />
              <Animated.View
                style={starDrawerAnimatedStyle}
              >
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
                    renderClearConfirm={renderClearConfirm}
                    colors={colors}
                    styles={styles}
                    index={starTabIndex}
                    setIndex={setStarTabIndex}
                  />
                </View>
              </Animated.View>
            </View>
          )}
          {showBottomBar && (
            <View
              style={[
                styles.bottomBar,
                {
                  backgroundColor: colors.inputBackground,
                  paddingBottom: 0
                }
              ]}
            >
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={navBack}
                disabled={!activeTab.canGoBack}
              >
                <Text
                  style={[
                    styles.toolbarIcon,
                    !activeTab.canGoBack && { opacity: 0.3 }
                  ]}
                >
                  ←
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={navFwd}
                disabled={!activeTab.canGoForward}
              >
                <Text
                  style={[
                    styles.toolbarIcon,
                    !activeTab.canGoForward && { opacity: 0.3 }
                  ]}
                >
                  →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={shareCurrent}
                disabled={activeTab.url === kNEW_TAB_URL}
              >
                <Text
                  style={[
                    styles.toolbarIcon,
                    activeTab.url === kNEW_TAB_URL && { opacity: 0.3 }
                  ]}
                >
                  ⇪
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => toggleStarDrawer(true)}
              >
                <Text style={styles.toolbarIcon}>★</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => setShowTabsView(true)}
              >
                <Text style={styles.toolbarIcon}>▒</Text>
              </TouchableOpacity>
            </View>
          )}

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
                        outputRange: [drawerHeight, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              {infoDrawerRoute === 'root' && (
                <>
                  <Pressable
                    style={styles.drawerHandle}
                    onPress={() => toggleInfoDrawer(false)}
                  >
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
                    label="Add Bookmark"
                    onPress={() => {
                      addBookmark(
                        activeTab.title || 'Untitled',
                        activeTab.url
                      )
                      toggleInfoDrawer(false)
                    }}
                  />
                  <DrawerItem
                    label="Add to Device Homescreen"
                    onPress={async () => {
                      await addToHomeScreen()
                      toggleInfoDrawer(false)
                    }}
                  />
                  <DrawerItem
                    label="Back to Homepage"
                    onPress={() => {
                      updateActiveTab({ url: kNEW_TAB_URL })
                      setAddressText(kNEW_TAB_URL)
                      toggleInfoDrawer(false)
                    }}
                  />
                </>
              )}

              {infoDrawerRoute !== 'root' && (
                <SubDrawerView
                  route={infoDrawerRoute}
                  onBack={() => setInfoDrawerRoute('root')}
                />
              )}
            </Animated.View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView >
  )
}

/* -------------------------------------------------------------------------- */
/*                               SUB-COMPONENTS                               */
/* -------------------------------------------------------------------------- */

const TabsView = ({
  tabs,
  activeId,
  setActive,
  addTab,
  closeTab,
  onDismiss,
  colors
}: {
  tabs: Tab[]
  activeId: number
  setActive: (id: number) => void
  addTab: () => void
  closeTab: (id: number) => void
  onDismiss: () => void
  colors: any
}) => {
  const screen = Dimensions.get('window')
  const ITEM_W = screen.width * 0.42
  const ITEM_H = screen.height * 0.28
  const insets = useSafeAreaInsets()

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
      return (
        <Animated.View
          style={[
            styles.swipeDelete,
            { backgroundColor: '#ff3b30', transform: [{ translateX: trans }] }
          ]}
        >
          <Text style={styles.swipeDeleteText}>✕</Text>
        </Animated.View>
      )
    }

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        onSwipeableRightOpen={() => closeTab(item.id)}
        friction={2}
        rightThreshold={40}
      >
        <Pressable
          style={[
            styles.tabPreview,
            {
              width: ITEM_W,
              height: ITEM_H,
              borderColor:
                item.id === activeId ? colors.primary : colors.inputBorder,
              borderWidth: item.id === activeId ? 2 : StyleSheet.hairlineWidth,
              backgroundColor: colors.background
            }
          ]}
          onPress={() => setActive(item.id)}
        >
          <View style={{ flex: 1, overflow: 'hidden' }}>
            {item.url === kNEW_TAB_URL ? (
              <View style={styles.tabPreviewEmpty}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                  New Tab
                </Text>
              </View>
            ) : (
              <WebView
                source={{ uri: item.url }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                pointerEvents="none"
              />
            )}
            <View
              style={[
                styles.tabTitleBar,
                { backgroundColor: colors.paperBackground }
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}
              >
                {item.title}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    )
  }

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
        contentContainerStyle={{
          padding: 12,
          paddingBottom: 100 + insets.bottom
        }}
      />

      <View
        style={[styles.tabsViewFooter, { paddingBottom: insets.bottom + 10 }]}
      >
        <TouchableOpacity style={styles.newTabBtn} onPress={() => addTab()}>
          <Text style={styles.newTabIcon}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={onDismiss}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const DrawerItem = ({
  label,
  onPress
}: {
  label: string
  onPress: () => void
}) => {
  const { colors } = useTheme()
  return (
    <Pressable style={styles.drawerItem} onPress={onPress}>
      <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const SubDrawerView = ({
  route,
  onBack
}: {
  route: 'identity' | 'settings' | 'security' | 'trust'
  onBack: () => void
}) => {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.subDrawerHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={[styles.backBtn, { color: colors.primary }]}>
            ‹ Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.subDrawerTitle, { color: colors.textPrimary }]}>
          {route[0].toUpperCase() + route.slice(1)}
        </Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.subDrawerContent}>
        <Text style={{ color: colors.textSecondary }}>
          {route} screen content goes here.
        </Text>
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
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    borderRadius: 6,
    fontSize: 15
  },
  addressButton: { fontSize: 18, marginHorizontal: 6, color: '#fff' },
  padlock: { marginRight: 4, fontSize: 14 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth
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
    justifyContent: 'center',
  },

  /* tabs view */
  tabsViewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  tabsViewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  newTabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4c4c4c',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newTabIcon: { fontSize: 32, color: '#fff', lineHeight: 32 },
  doneButton: {
    position: 'absolute',
    right: 20,
    bottom: 26
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },

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
  drawerItem: { paddingVertical: 14, paddingHorizontal: 24 },
  drawerLabel: { fontSize: 17 },

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
  }
})
