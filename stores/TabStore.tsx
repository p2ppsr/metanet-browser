// stores/TabStore.tsx
import { createRef } from 'react'
import { makeAutoObservable } from 'mobx'
import { WebView } from 'react-native-webview'
import { LayoutAnimation } from 'react-native'
import { Tab } from '@/shared/types/browser'
import { kNEW_TAB_URL } from '@/shared/constants'
import { isValidUrl } from '@/utils/generalHelpers'
import AsyncStorage from '@react-native-async-storage/async-storage'

export class TabStore {
  tabs: Tab[] = [] // Always initialize as an array
  activeTabId = 1
  showTabsView = false
  private nextId = 1

  constructor() {
    console.log('TabStore constructor called')
    makeAutoObservable(this)
    // Preserve existing tabs during hot reload
    if (this.tabs.length === 0) {
      this.loadTabs().catch(console.error)
    }
  }

  createTab(url: string = kNEW_TAB_URL): Tab {
    console.log(`createTab(): url=${url}`)
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

  addTab() {
    const tab = this.createTab()
    this.tabs.push(tab)
    this.activeTabId = tab.id
    this.saveTabs()
  }

  get activeTab(): Tab | undefined {
    return this.tabs.find(t => t.id === this.activeTabId)
  }

  setActiveTab(id: number) {
    if (this.tabs.some(t => t.id === id)) {
      this.activeTabId = id
    }
  }

  setShowTabsView(show: boolean) {
    this.showTabsView = show
  }

  newTab(initialUrl: string = kNEW_TAB_URL) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const newTab = this.createTab(initialUrl)
    this.tabs.push(newTab)
    this.activeTabId = newTab.id
    this.saveTabs()
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

  closeTab(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    this.tabs = this.tabs.filter(t => t.id !== id)
    if (this.tabs.length === 0) {
      this.tabs.push(this.createTab())
    }
    if (
      id === this.activeTabId &&
      !this.tabs.find(t => t.id === this.activeTabId)
    ) {
      const lastTab = this.tabs[this.tabs.length - 1]
      this.activeTabId = lastTab?.id ?? 1
    }
    this.saveTabs()
  }

  removeTab(id: number) {
    if (!this.tabs || !Array.isArray(this.tabs)) this.tabs = [] // Robust safety check
    this.tabs = this.tabs.filter(t => t.id !== id)
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        this.activeTabId = this.tabs[0].id
      } else {
        const newTab = this.createTab()
        this.tabs = [newTab]
        this.activeTabId = newTab.id
      }
    }
    this.saveTabs()
  }

  handleNavigationStateChange(id: number, navState: any) {
    this.updateTab(id, {
      url: navState.url,
      title: navState.title || 'Loading...',
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      isLoading: navState.loading
    })
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
      this.activeTabId = parsedTabs.length > 0 ? parsedTabs[0].id : 1
    } else {
      this.tabs = [this.createTab()] // Ensure at least one tab
    }
  }
}

const tabStore = new TabStore()
export default tabStore
