// components/BrowserWebView.tsx
import React, { useRef, useEffect, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { observer } from 'mobx-react-lite'
import tabStore from '@/stores/TabStore'
import type { WebViewNavigation, WebViewMessageEvent } from 'react-native-webview'
import { kNEW_TAB_URL } from '@/shared/constants'

interface BrowserWebViewProps {
  onMessage?: (event: WebViewMessageEvent) => void
  onNavigationStateChange?: (navState: WebViewNavigation) => void
  injectedJavaScript?: string
  userAgent?: string
  style?: any
  [key: string]: any // Allow other WebView props to be passed through
}

// This component renders multiple WebViews, one for each tab
// but only shows the active one. This keeps all tabs mounted in memory.
const BrowserWebView = observer(
  ({
    onMessage,
    onNavigationStateChange,
    injectedJavaScript,
    userAgent,
    style,
    ...otherProps
  }: BrowserWebViewProps) => {
    const webViewRefs = useRef<{ [tabId: number]: React.RefObject<WebView | null> }>({})

    // Initialize refs for all tabs and update refs when tabs change
    useEffect(() => {
      console.log(
        '🔄 BrowserWebView: Updating refs for tabs:',
        tabStore.tabs.map(t => `${t.id}:${t.url}`)
      )

      tabStore.tabs.forEach(tab => {
        if (!webViewRefs.current[tab.id]) {
          console.log(`🔄 BrowserWebView: Creating new ref for tab ${tab.id}`)
          webViewRefs.current[tab.id] = React.createRef<WebView>()
        }
        // Always update the tab's webview ref to ensure it points to the current ref
        tab.webviewRef = webViewRefs.current[tab.id]
      })

      // Clean up refs for tabs that no longer exist
      Object.keys(webViewRefs.current).forEach(tabIdStr => {
        const tabId = parseInt(tabIdStr)
        if (!tabStore.tabs.find(tab => tab.id === tabId)) {
          console.log(`🔄 BrowserWebView: Removing ref for deleted tab ${tabId}`)
          delete webViewRefs.current[tabId]
        }
      })

      // Log all current refs
      console.log('📋 BrowserWebView: Current webViewRefs state:', {
        refCount: Object.keys(webViewRefs.current).length,
        refIds: Object.keys(webViewRefs.current).map(id => parseInt(id)),
        tabStoreRefs: tabStore.tabs.map(tab => ({
          tabId: tab.id,
          hasRef: !!tab.webviewRef,
          refCurrent: !!tab.webviewRef?.current,
          refType: typeof tab.webviewRef?.current
        }))
      })
    }, [tabStore.tabs]) // Depend on the actual tabs array to react to any changes

    const handleNavigationStateChange = useCallback(
      (tabId: number) => (navState: WebViewNavigation) => {
        console.log(`🌐 BrowserWebView: Navigation state change for tab ${tabId}:`, navState.url)

        // Update the tab store first
        tabStore.handleNavigationStateChange(tabId, navState)

        // Only call the parent handler for the active tab to avoid confusion
        if (tabId === tabStore.activeTabId && onNavigationStateChange) {
          onNavigationStateChange(navState)
        }
      },
      [onNavigationStateChange]
    )

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        if (onMessage) {
          onMessage(event)
        }
      },
      [onMessage]
    )

    console.log(
      '🔄 BrowserWebView: Rendering tabs:',
      tabStore.tabs.map(t => `${t.id}:${t.url} (active: ${t.id === tabStore.activeTabId})`)
    )

    return (
      <View style={[styles.container, style]}>
        {tabStore.tabs.map(tab => {
          // Ensure we have a ref for this tab (without state mutation during render)
          if (!webViewRefs.current[tab.id]) {
            webViewRefs.current[tab.id] = React.createRef<WebView>()
          }

          const isActive = tab.id === tabStore.activeTabId
          console.log(`🔄 BrowserWebView: Rendering WebView for tab ${tab.id}, active: ${isActive}, URL: ${tab.url}`)

          return (
            <View
              key={`webview-${tab.id}`}
              style={[
                styles.webviewContainer,
                {
                  display: isActive ? 'flex' : 'none'
                }
              ]}
            >
              <WebView
                key={`webview-content-${tab.id}-${tab.url}`} // Force re-render when URL changes
                ref={webView => {
                  // Use a ref callback to ensure the ref is properly assigned
                  if (webViewRefs.current[tab.id]) {
                    webViewRefs.current[tab.id].current = webView
                  }
                  // Also update the tab store ref
                  if (tab.webviewRef) {
                    tab.webviewRef.current = webView
                  }
                }}
                source={{ uri: tab.url || kNEW_TAB_URL }}
                onNavigationStateChange={handleNavigationStateChange(tab.id)}
                onMessage={handleMessage}
                injectedJavaScript={injectedJavaScript}
                userAgent={userAgent}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsBackForwardNavigationGestures={true}
                decelerationRate={0.998}
                startInLoadingState={true}
                scalesPageToFit={true}
                mixedContentMode="compatibility"
                thirdPartyCookiesEnabled={true}
                allowsLinkPreview={false}
                allowsFullscreenVideo={true}
                setSupportMultipleWindows={false}
                {...otherProps}
              />
            </View>
          )
        })}
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  webviewContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  webview: {
    flex: 1
  }
})

export default BrowserWebView
