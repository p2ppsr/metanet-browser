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
// Notifications.setNotificationHandler({
//   handleNotification: async notification => {
//     console.log('📱 Local notification received:', {
//       title: notification.request.content.title,
//       body: notification.request.content.body,
//       data: notification.request.content.data
//     })

//     return {
//       shouldShowAlert: true,
//       shouldPlaySound: true,
//       shouldSetBadge: true,
//       shouldShowBanner: true,
//       shouldShowList: true
//     }
//   }
// })

/**
 * Simplified push notifications hook for WebView-native bridge architecture
 * Uses backend service for subscription management and FCM for delivery
 */
export const usePushNotifications = () => {
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([])
  const [permissions, setPermissions] = useState<NotificationPermission[]>([])
  const [subscriptions, setSubscriptions] = useState<{ origin: string; userKey: string }[]>([])
  const notificationListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    // Set up notification listeners for local notifications
    // notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
    // console.log('📱 Foreground notification received:', {
    //   title: notification.request.content.title,
    //   body: notification.request.content.body,
    //   data: notification.request.content.data
    // })
    // })
    // responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
    //   console.log('📱 Notification tapped:', {
    //     actionIdentifier: response.actionIdentifier,
    //     notification: {
    //       title: response.notification.request.content.title,
    //       body: response.notification.request.content.body,
    //       data: response.notification.request.content.data
    //     }
    //   })
    //   const data = response.notification.request.content.data
    //   if (data?.url) {
    //     console.log('🌐 Should navigate to URL:', data.url)
    //     // URL navigation will be handled by the WebView bridge
    //   }
    // })
    // return () => {
    //   notificationListener.current?.remove()
    //   responseListener.current?.remove()
    // }
  }, [])

  /**
   * Request push notification permission for a domain
   * This integrates with the backend service and permission modal
   */
  // const requestNotificationPermission = async (origin: string): Promise<'granted' | 'denied' | 'default'> => {
  //   try {
  //     console.log('🔔 Requesting push permission for origin:', origin)

  //     // Check if backend service is available
  //     const isHealthy = await notificationBackend.healthCheck()
  //     if (!isHealthy) {
  //       console.error('❌ Backend service is not available')
  //       return 'denied'
  //     }

  //     console.log('🔍 Registering for origin:', origin)

  //     // Register subscription with backend - userId should be the origin
  //     const result = await notificationBackend.registerPushSubscription(origin, origin)

  //     if (result.success && result.userKey) {
  //       console.log('✅ Push permission granted, userKey:', result.userKey)

  //       // Update permissions state
  //       const newPermission: NotificationPermission = {
  //         origin,
  //         permission: 'granted',
  //         granted: Date.now()
  //       }
  //       setPermissions(prev => {
  //         const existing = prev.find(p => p.origin === origin)
  //         if (existing) {
  //           return prev.map(p => p.origin === origin ? newPermission : p)
  //         }
  //         return [...prev, newPermission]
  //       })

  //       // Update subscriptions state
  //       setSubscriptions(prev => {
  //         const existing = prev.find(s => s.origin === origin)
  //         if (!existing && result.userKey) {
  //           return [...prev, { origin, userKey: result.userKey }]
  //         }
  //         return prev
  //       })

  //       return 'granted'
  //     } else {
  //       console.log('❌ Push permission denied or failed:', result.message)

  //       // Update permissions state to denied
  //       const deniedPermission: NotificationPermission = {
  //         origin,
  //         permission: 'denied',
  //         granted: Date.now()
  //       }
  //       setPermissions(prev => {
  //         const existing = prev.find(p => p.origin === origin)
  //         if (existing) {
  //           return prev.map(p => p.origin === origin ? deniedPermission : p)
  //         }
  //         return [...prev, deniedPermission]
  //       })

  //       return 'denied'
  //     }
  //   } catch (error) {
  //     console.error('❌ Error requesting push permission:', error)
  //     return 'denied'
  //   }
  // }

  /**
   * Show a local notification (used when FCM delivers to native layer)
   */
  // const showLocalNotification = async (notification: PendingNotification) => {
  //   try {
  //     await Notifications.scheduleNotificationAsync({
  //       content: {
  //         title: notification.title,
  //         body: notification.body,
  //         data: {
  //           origin: notification.origin,
  //           ...notification.data
  //         }
  //       },
  //       trigger: null // Show immediately
  //     })

  //     console.log('📱 Local notification scheduled successfully')
  //   } catch (error) {
  //     console.error('❌ Error showing local notification:', error)
  //   }
  // }

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

  /**
   * Unsubscribe from notifications for a specific origin
   */
  const unsubscribe = async (origin: string): Promise<boolean> => {
    try {
      console.log('🔕 Unsubscribing from origin:', origin)

      // Remove from backend if we have a subscription
      const subscription = subscriptions.find(s => s.origin === origin)
      if (subscription) {
        // Here you would call backend to unsubscribe, but for now just remove locally
        console.log('🔍 Removing subscription for userKey:', subscription.userKey)
      }

      // Update local state
      setPermissions(prev => prev.map(p => (p.origin === origin ? { ...p, permission: 'denied' as const } : p)))
      setSubscriptions(prev => prev.filter(s => s.origin !== origin))

      return true
    } catch (error) {
      console.error('❌ Error unsubscribing:', error)
      return false
    }
  }

  /**
   * Clear all notification permissions and subscriptions
   */
  const clearAllPermissions = async (): Promise<void> => {
    try {
      console.log('🗑️ Clearing all notification permissions')

      // Clear backend subscriptions if needed
      for (const subscription of subscriptions) {
        console.log('🔍 Would remove subscription for:', subscription.origin)
      }

      // Clear local state
      setPermissions([])
      setSubscriptions([])
    } catch (error) {
      console.error('❌ Error clearing permissions:', error)
    }
  }

  return {
    // Core functions
    // requestNotificationPermission,
    // showLocalNotification,
    unsubscribe,
    clearAllPermissions,

    // State
    permissions,
    subscriptions,
    pendingNotifications,

    // Notification queue management
    addPendingNotification,
    clearPendingNotifications,
    getPendingNotificationsForOrigin,

    // Backend service access
    notificationBackend
  }
}
