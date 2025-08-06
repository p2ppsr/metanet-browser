import { useState, useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { notificationBackend } from '@/services/notificationBackendService'

// Simplified interfaces for the new architecture
export interface NotificationPermission {
  origin: string
  permission: 'default' | 'granted' | 'denied'
  granted: number
}

export interface PendingNotification {
  title: string
  body: string
  data?: Record<string, any>
  origin: string
  timestamp: number
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    console.log('📱 Local notification received:', {
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

/**
 * Simplified push notifications hook for WebView-native bridge architecture
 * Uses backend service for subscription management and FCM for delivery
 */
export const usePushNotifications = () => {
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([])
  const notificationListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    // Set up notification listeners for local notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Foreground notification received:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      })
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Notification tapped:', {
        actionIdentifier: response.actionIdentifier,
        notification: {
          title: response.notification.request.content.title,
          body: response.notification.request.content.body,
          data: response.notification.request.content.data
        }
      })

      const data = response.notification.request.content.data
      if (data?.url) {
        console.log('🌐 Should navigate to URL:', data.url)
        // URL navigation will be handled by the WebView bridge
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  /**
   * Request push notification permission for a domain
   * This integrates with the backend service and permission modal
   */
  const requestPermission = async (origin: string): Promise<{ granted: boolean; userKey?: string }> => {
    try {
      console.log('🔔 Requesting push permission for origin:', origin)

      // Check if backend service is available
      const isHealthy = await notificationBackend.healthCheck()
      if (!isHealthy) {
        console.error('❌ Backend service is not available')
        return { granted: false }
      }

      console.log('🔍 Registering for origin:', origin)

      // Register subscription with backend - userId should be the origin
      const result = await notificationBackend.registerPushSubscription(origin, origin)

      if (result.success && result.userKey) {
        console.log('✅ Push permission granted, userKey:', result.userKey)
        return { granted: true, userKey: result.userKey }
      } else {
        console.log('❌ Push permission denied or failed:', result.message)
        return { granted: false }
      }
    } catch (error) {
      console.error('❌ Error requesting push permission:', error)
      return { granted: false }
    }
  }

  /**
   * Show a local notification (used when FCM delivers to native layer)
   */
  const showLocalNotification = async (notification: PendingNotification) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: {
            origin: notification.origin,
            ...notification.data
          }
        },
        trigger: null // Show immediately
      })

      console.log('📱 Local notification scheduled successfully')
    } catch (error) {
      console.error('❌ Error showing local notification:', error)
    }
  }

  /**
   * Add a notification to the pending queue for WebView forwarding
   */
  const addPendingNotification = (notification: PendingNotification) => {
    setPendingNotifications(prev => [...prev, notification])
  }

  /**
   * Clear pending notifications (after they've been forwarded to WebView)
   */
  const clearPendingNotifications = () => {
    setPendingNotifications([])
  }

  /**
   * Get pending notifications for a specific origin
   */
  const getPendingNotificationsForOrigin = (origin: string) => {
    return pendingNotifications.filter(notification => notification.origin === origin)
  }

  return {
    // Core functions
    requestPermission,
    showLocalNotification,

    // Notification queue management
    pendingNotifications,
    addPendingNotification,
    clearPendingNotifications,
    getPendingNotificationsForOrigin,

    // Backend service access
    notificationBackend
  }
}