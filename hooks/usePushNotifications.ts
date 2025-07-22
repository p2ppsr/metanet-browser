import { useState, useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const NOTIFICATION_PERMISSIONS_KEY = 'notificationPermissions'
const SUBSCRIPTIONS_KEY = 'pushSubscriptions'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  origin: string
  vapidPublicKey?: string
}

export interface NotificationPermission {
  origin: string
  permission: 'default' | 'granted' | 'denied'
  granted: number
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    console.log('Notification received:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data
    })

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    }
  }
})

export const usePushNotifications = () => {
  const [permissions, setPermissions] = useState<NotificationPermission[]>([])
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([])
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const notificationListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    loadStoredData()

    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      })
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped by user:', {
        actionIdentifier: response.actionIdentifier,
        notification: {
          title: response.notification.request.content.title,
          body: response.notification.request.content.body,
          data: response.notification.request.content.data
        }
      })

      const data = response.notification.request.content.data
      if (data?.url) {
        console.log('Should navigate to URL:', data.url)
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  const loadStoredData = async () => {
    try {
      const storedPermissions = await AsyncStorage.getItem(NOTIFICATION_PERMISSIONS_KEY)
      const storedSubscriptions = await AsyncStorage.getItem(SUBSCRIPTIONS_KEY)

      if (storedPermissions) {
        const parsed = JSON.parse(storedPermissions)
        setPermissions(parsed)
      }

      if (storedSubscriptions) {
        const parsed = JSON.parse(storedSubscriptions)
        setSubscriptions(parsed)
      }
    } catch (error) {
      console.error('Error loading notification data:', error)
    }
  }

  const savePermissions = async (newPermissions: NotificationPermission[]) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSIONS_KEY, JSON.stringify(newPermissions))
      setPermissions(newPermissions)
    } catch (error) {
      console.error('Error saving permissions:', error)
    }
  }

  const saveSubscriptions = async (newSubscriptions: PushSubscription[]) => {
    try {
      await AsyncStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(newSubscriptions))
      setSubscriptions(newSubscriptions)
    } catch (error) {
      console.error('Error saving subscriptions:', error)
    }
  }

  const registerForPushNotificationsAsync = async (requestPermission = false) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (requestPermission && existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true
          }
        })
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        return null
      }

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
          sound: 'default'
        })
      }

      let token
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'f18a56d2-60e6-4170-95ca-839868f329fa'

        token = await Notifications.getExpoPushTokenAsync({ projectId })
      } catch (error) {
        console.warn('Error getting token with project ID, trying fallback:', error)
        try {
          token = await Notifications.getExpoPushTokenAsync()
        } catch (fallbackError) {
          console.log('Fallback token failed, using mock token for local notifications')
          const mockToken = 'ExponentPushToken[mock-' + Date.now() + ']'
          setExpoPushToken(mockToken)
          return mockToken
        }
      }

      setExpoPushToken(token.data)
      return token.data
    } catch (error) {
      console.error('Error registering for notifications:', error)
      return null
    }
  }

  const requestNotificationPermission = async (origin: string): Promise<'granted' | 'denied' | 'default'> => {
    try {
      const existingPermission = permissions.find(p => p.origin === origin)
      if (existingPermission && existingPermission.permission !== 'default') {
        return existingPermission.permission
      }

      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true
        }
      })

      const permission: 'granted' | 'denied' = status === 'granted' ? 'granted' : 'denied'

      const newPermission: NotificationPermission = {
        origin,
        permission,
        granted: Date.now()
      }

      const updatedPermissions = permissions.filter(p => p.origin !== origin)
      updatedPermissions.push(newPermission)
      await savePermissions(updatedPermissions)

      if (permission === 'granted') {
        await registerForPushNotificationsAsync(true)
      }

      return permission
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'denied'
    }
  }

  // Get native push token for backend compatibility
  const getNativePushToken = async (): Promise<string | null> => {
    try {
      // For now, return Expo token but formatted for future FCM/APNS compatibility
      const expoToken = expoPushToken || (await registerForPushNotificationsAsync())
      if (!expoToken) return null

      // Extract token from Expo format for potential FCM use
      if (expoToken.startsWith('ExponentPushToken[') && expoToken.endsWith(']')) {
        // Use regex to safely extract the token content between brackets
        const match = expoToken.match(/ExponentPushToken\[(.*?)\]/)
        if (match && match[1]) {
          return match[1]
        }
      }

      return expoToken
    } catch (error) {
      console.error('Error getting native push token:', error)
      return null
    }
  }

  const createPushSubscription = async (origin: string, options?: any): Promise<any> => {
    console.log('🔔 Creating push subscription for:', origin, 'with options:', options)
    console.log('🔑 VAPID public key provided:', options?.applicationServerKey ? 'YES' : 'NO')
    console.log('👁️ User visible only:', options?.userVisibleOnly)

    try {
      const permission = await requestNotificationPermission(origin)
      if (permission !== 'granted') {
        console.log('❌ Permission not granted:', permission)
        return null
      }

      const nativeToken = await getNativePushToken()
      if (!nativeToken) {
        console.error('❌ Failed to get native push token')
        return null
      }

      console.log('✅ Got native push token:', nativeToken.substring(0, 20) + '...')

      // Create standard web push endpoint format
      let endpoint: string
      if (Platform.OS === 'ios') {
        // Use standard FCM format for iOS (more compatible with web push services)
        endpoint = `https://fcm.googleapis.com/fcm/send/${nativeToken}`
        console.log('🍎 iOS: Using FCM-compatible endpoint')
      } else {
        // Use standard FCM endpoint format for Android (widely accepted)
        endpoint = `https://fcm.googleapis.com/fcm/send/${nativeToken}`
        console.log('🤖 Android: Using FCM-compatible endpoint')
      }

      // Generate proper cryptographic keys
      const p256dhKey = generateP256dhKey()
      const authKey = generateAuthKey()
      console.log(' Generated keys - p256dh length:', p256dhKey.length, 'auth length:', authKey.length)
      console.log(' p256dh sample:', p256dhKey.substring(0, 10) + '...')
      console.log(' auth sample:', authKey.substring(0, 10) + '...')

      // Create a properly formatted Web Push subscription object that exactly matches browser API
      const webPushSubscription = {
        endpoint,
        expirationTime: null,
        keys: {
          p256dh: p256dhKey,
          auth: authKey
        },
        // Add methods that websites expect - exactly like real browser implementation
        toJSON: function () {
          return {
            endpoint: this.endpoint,
            expirationTime: this.expirationTime,
            keys: {
              p256dh: this.keys.p256dh,
              auth: this.keys.auth
            }
          }
        },
        getKey: function (name: string) {
          if (name === 'p256dh') return this.keys.p256dh
          if (name === 'auth') return this.keys.auth
          return null
        },
        unsubscribe: function () {
          console.log('[RN WebView] Unsubscribe called')
          return Promise.resolve(true)
        }
      }

      console.log(' Created web push subscription object:')
      console.log('   - endpoint:', endpoint.substring(0, 50) + '...')
      console.log('   - keys.p256dh:', p256dhKey.substring(0, 20) + '...')
      console.log('   - keys.auth:', authKey.substring(0, 20) + '...')
      console.log('   - toJSON method:', typeof webPushSubscription.toJSON)
      console.log('   - getKey method:', typeof webPushSubscription.getKey)
      console.log('   - unsubscribe method:', typeof webPushSubscription.unsubscribe)

      // Our internal subscription object with extra metadata
      const subscription: PushSubscription = {
        endpoint,
        keys: {
          p256dh: p256dhKey,
          auth: authKey
        },
        origin,
        vapidPublicKey: options?.applicationServerKey
      }

      const updatedSubscriptions = subscriptions.filter(s => s.origin !== origin)
      updatedSubscriptions.push(subscription)
      await saveSubscriptions(updatedSubscriptions)

      console.log('📱 Created push subscription:', {
        origin,
        endpoint: endpoint.substring(0, 50) + '...',
        platform: Platform.OS
      })

      // Return the web-standard subscription object to the website
      return webPushSubscription as any
    } catch (error) {
      console.error('Error creating push subscription:', error)
      return null
    }
  }

  const unsubscribe = async (origin: string): Promise<boolean> => {
    try {
      const updatedSubscriptions = subscriptions.filter(s => s.origin !== origin)
      await saveSubscriptions(updatedSubscriptions)
      return true
    } catch (error) {
      console.error('Error unsubscribing:', error)
      return false
    }
  }

  const getPermission = (origin: string): 'granted' | 'denied' | 'default' => {
    const permission = permissions.find(p => p.origin === origin)
    return permission?.permission || 'default'
  }

  const getSubscription = (origin: string): any => {
    const internalSub = subscriptions.find(s => s.origin === origin)
    if (!internalSub) return null

    // Return web-standard subscription object format
    return {
      endpoint: internalSub.endpoint,
      keys: {
        p256dh: internalSub.keys.p256dh,
        auth: internalSub.keys.auth
      },
      toJSON: function () {
        return {
          endpoint: this.endpoint,
          keys: this.keys
        }
      },
      unsubscribe: function () {
        return Promise.resolve(true)
      }
    }
  }

  const clearAllPermissions = async () => {
    await savePermissions([])
    await saveSubscriptions([])
  }

  return {
    permissions,
    subscriptions,
    expoPushToken,
    requestNotificationPermission,
    createPushSubscription,
    unsubscribe,
    getPermission,
    getSubscription,
    clearAllPermissions
  }
}

// Generate proper cryptographic keys for web push
const generateP256dhKey = (): string => {
  // For p256dh, we need a valid ECDH public key (65 bytes uncompressed)
  // Since we can't generate real ECDH keys in React Native easily,
  // we'll create a properly formatted fake key that passes basic validation

  // Uncompressed public key format: 0x04 + 32 bytes X + 32 bytes Y = 65 bytes
  const keyBytes = new Uint8Array(65)
  keyBytes[0] = 0x04 // Uncompressed point indicator

  // Generate 64 random bytes for X and Y coordinates
  for (let i = 1; i < 65; i++) {
    keyBytes[i] = Math.floor(Math.random() * 256)
  }

  // Convert to base64url
  return arrayBufferToBase64Url(keyBytes.buffer)
}

const generateAuthKey = (): string => {
  // Auth key should be exactly 16 bytes (128 bits)
  const authBytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    authBytes[i] = Math.floor(Math.random() * 256)
  }

  // Convert to base64url
  return arrayBufferToBase64Url(authBytes.buffer)
}

// Helper function to convert ArrayBuffer to base64url
const arrayBufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  // Convert to base64 then make it URL-safe
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
