import { Platform } from 'react-native'
import config from './config'
import { initializeFirebaseNotifications } from './pushNotificationManager'

let analytics: () => any
let remoteConfig: () => any
let installations: () => any
let messaging: () => any
let FirebaseMessaging: any

if (config.useFirebase) {
  try {
    const analyticsModular = require('@react-native-firebase/analytics')
    const remoteConfigModular = require('@react-native-firebase/remote-config')
    const installationsModular = require('@react-native-firebase/installations')
    const messagingModular = require('@react-native-firebase/messaging')
    FirebaseMessaging = messagingModular

    analytics = () => analyticsModular.getAnalytics()
    remoteConfig = () => remoteConfigModular.getRemoteConfig()
    installations = () => installationsModular.getInstallations()
    messaging = () => messagingModular.getMessaging()
  } catch (error) {
    console.error('Failed to load Firebase modules. Running in mock mode.', error)
    config.useFirebase = false
  }
}

if (!config.useFirebase) {
  const mockAnalytics = {
    logAppOpen: async () => console.log('Mock Analytics: app_open event logged'),
    logEvent: async (name: string, params?: Record<string, any>) => {
      console.log(`Mock Analytics: Event '${name}' logged with params:`, params)
    }
  }

  const mockRemoteConfig = {
    setConfigSettings: async (settings: any) => console.log('Mock Remote Config: Set config settings:', settings),
    setDefaults: async (defaults: any) => console.log('Mock Remote Config: Set defaults:', defaults),
    fetchAndActivate: async () => {
      console.log('Mock Remote Config: Fetched and activated.')
      return true
    },
    getValue: (key: string) => {
      console.log(`Mock Remote Config: Getting value for key '${key}'`)
      return {
        asString: () => '',
        getSource: () => 'static'
      }
    }
  }

  const mockInstallations = {
    getToken: async () => {
      console.log('Mock Installations: Getting token.')
      return 'mock-token'
    }
  }

  const mockMessaging = {
    requestPermission: async () => {
      console.log('Mock Messaging: Requesting permission.')
      return true
    },
    getToken: async () => {
      console.log('Mock Messaging: Getting token.')
      return 'mock-token'
    },
    onMessage: (callback: (message: any) => void) => {
      console.log('Mock Messaging: Listening for messages.')
      callback({ data: { message: 'Mock message' } })
    }
  }

  analytics = () => mockAnalytics
  remoteConfig = () => mockRemoteConfig
  installations = () => mockInstallations
  messaging = () => mockMessaging
  FirebaseMessaging = {
    AuthorizationStatus: {
      NOT_DETERMINED: -1,
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
      EPHEMERAL: 3
    }
  }
}

export const initializeFirebase = async () => {
  if (!config.useFirebase) {
    console.log('Firebase is disabled. Using mock services for initialization.')
    return
  }

  try {
    await analytics().logAppOpen()
    console.log('Firebase Analytics: app_open event logged')

    if (__DEV__) {
      await remoteConfig().setConfigSettings({ minimumFetchIntervalMillis: 0 })
      const token = await installations().getToken()
      console.log(`A/B Testing Token for ${Platform.OS}:`, token)
    }

    await remoteConfig().setDefaults({ start_button_text: 'Get Started' })
    const fetched = await remoteConfig().fetchAndActivate()
    console.log(`Remote Config: ${fetched ? 'Fetched & activated' : 'No new configs'}`)

    await initializeFirebaseNotifications()
  } catch (error) {
    console.error('Firebase initialization error:', error)
  }
}

export { analytics, remoteConfig, installations, messaging, FirebaseMessaging }
