// stores/TabStore.tsx
import { createRef } from 'react'
import { makeAutoObservable } from 'mobx'
import { WebView } from 'react-native-webview'
import { LayoutAnimation } from 'react-native'
import { Tab } from '@/shared/types/browser'
import { kNEW_TAB_URL } from '@/shared/constants'
import { isValidUrl } from '@/utils/generalHelpers'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WebViewNavigation } from 'react-native-webview'
export class TabStore {
  tabs: Tab[] = [] // Always initialize as an array
  activeTabId = 1
  showTabsView = false
  private nextId = 1
  private isSwitchingTabs = false
  private tabNavigationHistories: { [tabId: number]: string[] } = {} // Track navigation history per tab
  private tabHistoryIndexes: { [tabId: number]: number } = {} // Track current position in history per tab


  constructor() {
    console.log('TabStore constructor called')
    makeAutoObservable(this)
    // Preserve existing tabs during hot reload
    if (this.tabs.length === 0) {
      this.loadTabs().catch(console.error)
    }
    
    // Ensure we always have at least one tab after construction
    setTimeout(() => {
      if (this.tabs.length === 0) {
        this.newTab()
      }
    }, 0)
  }

  createTab(url: string = kNEW_TAB_URL): Tab {
    console.log(`createTab(): url=${url}, tabid=${this.nextId + 1}`)
    const safeUrl = isValidUrl(url) ? url : kNEW_TAB_URL
    return {
      id: this.nextId++,
      url: safeUrl,
      title: 'New Tab',
      webviewRef: createRef<WebView>(),
      canGoBack: false,
      canGoForward: false,
      isLoading: false
    }
  }

  newTab = (initialUrl: string = kNEW_TAB_URL) => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
  const newTab = this.createTab(initialUrl)
  this.tabs.push(newTab)
  this.activeTabId = newTab.id
  
  // Initialize navigation history for new tab - only add valid URLs to history
  if (initialUrl && initialUrl !== kNEW_TAB_URL && initialUrl !== 'about:blank' && isValidUrl(initialUrl)) {
    this.tabNavigationHistories[newTab.id] = [initialUrl]
    this.tabHistoryIndexes[newTab.id] = 0
  } else {
    // For new tabs with blank URLs, start with empty history
    this.tabNavigationHistories[newTab.id] = []
    this.tabHistoryIndexes[newTab.id] = -1
  }
  
  this.saveTabs()
}

  get activeTab(): Tab | null {
    const tab = this.tabs.find(t => t.id === this.activeTabId)
    
    // If no tab found but we have tabs, fix the activeTabId to point to the first tab
    if (!tab && this.tabs.length > 0) {
      this.activeTabId = this.tabs[0].id
      return this.tabs[0]
    }
    
    // If no tabs at all, create one
    if (!tab && this.tabs.length === 0) {
      this.newTab()
      return this.tabs[0] || null
    }
    
    return tab || null
  }

 setActiveTab(id: number) {
    if (this.tabs.some(t => t.id === id)) {
      this.isSwitchingTabs = true
      this.activeTabId = id
      
      setTimeout(() => {
        this.isSwitchingTabs = false
      }, 100) // Reduced timeout
    }
  }

  setShowTabsView(show: boolean) {
    this.showTabsView = show
  }

  updateTab(id: number, patch: Partial<Tab>) {
    const tab = this.tabs.find(t => t.id === id)
    if (tab) {
      const newUrl = patch.url
      if (newUrl && !isValidUrl(newUrl)) {
        patch.url = kNEW_TAB_URL
      }
      Object.assign(tab, patch)
      this.saveTabs()
    }
  }

  goBack(tabId: number) {
    const tab = this.tabs.find(t => t.id === tabId)
    const history = this.tabNavigationHistories[tabId]
    const currentIndex = this.tabHistoryIndexes[tabId]
    console.log(`goBack(): tabId=${tabId}, currentIndex=${currentIndex}, history=${history}`)
    if (tab && history && currentIndex > 0) {
      const newIndex = currentIndex - 1
      const url = history[newIndex]
      
      this.tabHistoryIndexes[tabId] = newIndex
      
      // Navigate WebView to the URL
      if (tab.webviewRef.current) {
        tab.webviewRef.current.injectJavaScript(`window.location.href = "${url}";`)
      }
    }
  }

  goForward(tabId: number) {
    const tab = this.tabs.find(t => t.id === tabId)
    const history = this.tabNavigationHistories[tabId]
    const currentIndex = this.tabHistoryIndexes[tabId]
    console.log(`goForward(): tabId=${tabId}, currentIndex=${currentIndex}, history=${history}`)
    if (tab && history && currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1
      const url = history[newIndex]
      
      this.tabHistoryIndexes[tabId] = newIndex
      
      // Navigate WebView to the URL
      if (tab.webviewRef.current) {
        tab.webviewRef.current.injectJavaScript(`window.location.href = "${url}";`)
      }
    }
  }

  closeTab = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const tabIndex = this.tabs.findIndex(t => t.id === id)
    if (tabIndex === -1) return

    this.tabs.splice(tabIndex, 1)
    
    // Clear navigation history for closed tab
    delete this.tabNavigationHistories[id]
    delete this.tabHistoryIndexes[id]

    if (this.tabs.length === 0) {
      this.newTab()
      return
    }

    if (this.activeTabId === id) {
      this.activeTabId = this.tabs[Math.max(tabIndex - 1, 0)].id
    }
    this.saveTabs()
  }

  handleNavigationStateChange(tabId: number, navState: WebViewNavigation) {
  const tab = this.tabs.find(t => t.id === tabId)
  
  // Only process navigation events for the currently active tab
  if (!tab || tabId !== this.activeTabId || this.isSwitchingTabs) {
    return
  }

  // Always update loading state (this doesn't affect history)
  tab.isLoading = navState.loading

  // Only update navigation state and history when navigation completes
  // and exclude about:blank URLs from history
  if (!navState.loading && navState.url && 
      navState.url !== 'about:blank' && 
      navState.url !== kNEW_TAB_URL &&
      isValidUrl(navState.url)) {
    const history = this.tabNavigationHistories[tabId] || []
    const currentIndex = this.tabHistoryIndexes[tabId] ?? -1
    
    // If this is a new URL (not going back/forward)
    if (navState.url !== history[currentIndex]) {
      // Check if this is a back/forward navigation
      const urlIndex = history.indexOf(navState.url)
      
      if (urlIndex !== -1) {
        // This is back/forward navigation - update index
        this.tabHistoryIndexes[tabId] = urlIndex
      } else {
        // This is new navigation - add to history
        const newHistory = currentIndex >= 0 ? history.slice(0, currentIndex + 1) : []
        newHistory.push(navState.url)
        this.tabNavigationHistories[tabId] = newHistory
        this.tabHistoryIndexes[tabId] = newHistory.length - 1
      }
    }

    // Update tab state based on our tracked history
    const currentHistory = this.tabNavigationHistories[tabId] || []
    const currentIdx = this.tabHistoryIndexes[tabId] ?? -1
    
    tab.canGoBack = currentIdx > 0
    tab.canGoForward = currentIdx < currentHistory.length - 1
    tab.url = navState.url
    tab.title = navState.title || navState.url
    
    this.saveTabs()
  }
}

  async saveTabs() {
    if (!this.tabs) this.tabs = [] // Prevent undefined
    const serializableTabs = this.tabs.map(({ webviewRef, ...rest }) => rest)
    await AsyncStorage.setItem('tabs', JSON.stringify(serializableTabs)).catch(
      console.error
    )
  }

  async loadTabs() {
    const savedTabs = await AsyncStorage.getItem('tabs')
    if (savedTabs) {
      const parsedTabs = JSON.parse(savedTabs).map((tab: any) => ({
        ...tab,
        webviewRef: createRef<WebView>()
      }))
      this.tabs = parsedTabs
      
      // Update nextId to be higher than any existing tab id
      const maxId = Math.max(...parsedTabs.map((t: Tab) => t.id), 0)
      this.nextId = maxId + 1
      
      // Ensure activeTabId points to a valid tab
      if (parsedTabs.length > 0) {
        const activeTabExists = parsedTabs.some((t: Tab) => t.id === this.activeTabId)
        if (!activeTabExists) {
          this.activeTabId = parsedTabs[0].id
        }
      }
    } else {
      // No saved tabs, create initial tab
      this.tabs = []
      this.newTab() // This will create a tab and set it as active
    }
  }
}

const tabStore = new TabStore()
export default tabStore
