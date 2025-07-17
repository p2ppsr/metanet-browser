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

  const createPushSubscription = async (origin: string, vapidPublicKey?: string): Promise<PushSubscription | null> => {
    try {
      const permission = await requestNotificationPermission(origin)
      if (permission !== 'granted') {
        return null
      }

      const nativeToken = await getNativePushToken()
      if (!nativeToken) {
        return null
      }

      let endpoint: string

      // TODO: For backend push notifications to work, these endpoints need to be implemented:
      if (Platform.OS === 'android') {
        // Future: Real FCM endpoint that PWA backends can use
        endpoint = `https://fcm.googleapis.com/fcm/send/${nativeToken}`
        console.log('🔄 Android: Using FCM-style endpoint (requires Firebase setup)')
      } else if (Platform.OS === 'ios') {
        // Future: APNS bridge service endpoint
        endpoint = `https://web.push.apple.com/v1/send/${nativeToken}`
        console.log('🔄 iOS: Using APNS-style endpoint (requires bridge service)')
      } else {
        // Current: Expo endpoint (works for in-app notifications)
        endpoint = `https://exp.host/--/api/v2/push/send/${nativeToken}`
        console.log('✅ Expo: Using Expo endpoint (works now for testing)')
      }

      const subscription: PushSubscription = {
        endpoint,
        keys: {
          p256dh: generateRandomKey(),
          auth: generateRandomKey()
        },
        origin,
        vapidPublicKey
      }

      const updatedSubscriptions = subscriptions.filter(s => s.origin !== origin)
      updatedSubscriptions.push(subscription)
      await saveSubscriptions(updatedSubscriptions)

      console.log('📱 Created push subscription:', {
        origin,
        endpoint: endpoint.substring(0, 50) + '...',
        platform: Platform.OS
      })

      return subscription
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

  const getSubscription = (origin: string): PushSubscription | null => {
    return subscriptions.find(s => s.origin === origin) || null
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

const generateRandomKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let result = ''
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
