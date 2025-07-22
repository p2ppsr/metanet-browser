// New push notifications hook that integrates with the metanet-mobile backend
// Replaces the existing usePushNotifications.ts with backend integration

import { useState, useEffect, useRef, useCallback } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationBackend, BackendResponse } from '@/services/notificationBackendService'

const NOTIFICATION_PERMISSIONS_KEY = 'notificationPermissions'

export interface NotificationPermission {
  origin: string
  permission: 'default' | 'granted' | 'denied'
  granted: number
}

export interface BackendPushSubscription {
  userKey: string
  origin: string
  registeredAt: number
}

// Configure notification handler for received notifications
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    console.log('📱 Notification received via backend:', {
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

export const useBackendPushNotifications = () => {
  const [permissions, setPermissions] = useState<NotificationPermission[]>([])
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [userKey, setUserKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [backendHealthy, setBackendHealthy] = useState<boolean>(false)
  
  const notificationListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  /**
   * Initialize the hook and backend service
   */
  const initialize = useCallback(async () => {
    try {
      console.log('🚀 Initializing backend push notifications...')
      
      // Initialize backend service
      await notificationBackend.initialize()
      
      // Check backend health
      const health = await notificationBackend.healthCheck()
      setBackendHealthy(health.success)
      
      if (!health.success) {
        console.warn('⚠️ Backend health check failed:', health.error)
      }
      
      // Check if already subscribed
      const currentUserKey = notificationBackend.getUserKey()
      setUserKey(currentUserKey)
      setIsSubscribed(notificationBackend.isSubscribed())
      
      // Load stored permissions
      const storedPermissions = await AsyncStorage.getItem(NOTIFICATION_PERMISSIONS_KEY)
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions))
      }
      
      console.log('✅ Backend push notifications initialized:', {
        userKey: currentUserKey ? 'exists' : 'none',
        isSubscribed: notificationBackend.isSubscribed(),
        backendHealthy: health.success
      })
    } catch (error) {
      console.error('❌ Failed to initialize backend push notifications:', error)
    }
  }, [])

  /**
   * Request notification permissions and subscribe to backend
   */
  const requestPermission = useCallback(async (
    origin: string,
    userId?: string
  ): Promise<{ granted: boolean; userKey?: string }> => {
    setIsLoading(true)
    
    try {
      // Request system notification permissions
      const { status } = await Notifications.requestPermissionsAsync()
      const granted = status === 'granted'
      
      if (!granted) {
        console.log('❌ System notification permission denied')
        return { granted: false }
      }
      
      // Check backend health before proceeding
      if (!backendHealthy) {
        const health = await notificationBackend.healthCheck()
        setBackendHealthy(health.success)
        
        if (!health.success) {
          throw new Error('Backend service is not available')
        }
      }
      
      // Register with backend
      const registrationUserId = userId || `metanet-user-${Date.now()}`
      const response = await notificationBackend.registerPushSubscription(registrationUserId, origin)
      
      if (response.success && response.userKey) {
        setUserKey(response.userKey)
        setIsSubscribed(true)
        
        // Update permissions storage
        const updatedPermissions = permissions.filter(p => p.origin !== origin)
        updatedPermissions.push({
          origin,
          permission: 'granted',
          granted: Date.now()
        })
        
        setPermissions(updatedPermissions)
        await AsyncStorage.setItem(NOTIFICATION_PERMISSIONS_KEY, JSON.stringify(updatedPermissions))
        
        console.log('✅ Successfully subscribed to backend push notifications:', {
          userKey: response.userKey,
          origin
        })
        
        return { granted: true, userKey: response.userKey }
      } else {
        throw new Error(response.error || 'Registration failed')
      }
    } catch (error) {
      console.error('❌ Failed to request push notification permission:', error)
      
      // Still update permissions to show the attempt
      const updatedPermissions = permissions.filter(p => p.origin !== origin)
      updatedPermissions.push({
        origin,
        permission: 'denied',
        granted: Date.now()
      })
      
      setPermissions(updatedPermissions)
      await AsyncStorage.setItem(NOTIFICATION_PERMISSIONS_KEY, JSON.stringify(updatedPermissions))
      
      return { granted: false }
    } finally {
      setIsLoading(false)
    }
  }, [permissions, backendHealthy])

  /**
   * Unsubscribe from backend notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    
    try {
      const response = await notificationBackend.unsubscribe()
      
      if (response.success) {
        setIsSubscribed(false)
        setUserKey(null)
        
        // Clear all permissions
        setPermissions([])
        await AsyncStorage.removeItem(NOTIFICATION_PERMISSIONS_KEY)
        
        console.log('✅ Successfully unsubscribed from backend push notifications')
        return true
      } else {
        throw new Error(response.error || 'Unsubscribe failed')
      }
    } catch (error) {
      console.error('❌ Failed to unsubscribe:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Check current backend permissions
   */
  const checkBackendPermissions = useCallback(async (): Promise<BackendResponse> => {
    return await notificationBackend.checkPermissions()
  }, [])

  /**
   * Send test notification via backend
   */
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await notificationBackend.sendNotification({
        notification: {
          title: '🎉 Test Notification',
          body: 'Your metanet-mobile backend integration is working!',
          icon: 'https://metanet.app/icon-192.png',
          url: 'https://metanet.app'
        },
        data: {
          source: 'metanet-mobile-test',
          timestamp: new Date().toISOString()
        }
      })
      
      console.log('🔔 Test notification sent:', response)
      return response
    } catch (error) {
      console.error('❌ Failed to send test notification:', error)
      return { success: false, error: 'Test notification failed' }
    }
  }, [])

  /**
   * Get permission for specific origin
   */
  const getPermissionForOrigin = useCallback((origin: string): NotificationPermission | null => {
    return permissions.find(p => p.origin === origin) || null
  }, [permissions])

  /**
   * Remove permission for specific origin
   */
  const removePermissionForOrigin = useCallback(async (origin: string) => {
    const updatedPermissions = permissions.filter(p => p.origin !== origin)
    setPermissions(updatedPermissions)
    await AsyncStorage.setItem(NOTIFICATION_PERMISSIONS_KEY, JSON.stringify(updatedPermissions))
    
    console.log('🗑️ Removed permission for origin:', origin)
  }, [permissions])

  // Initialize on mount
  useEffect(() => {
    initialize()
    
    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received in foreground:', notification)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification response received:', response)
    })

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current)
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current)
      }
    }
  }, [initialize])

  return {
    // State
    permissions,
    isSubscribed,
    userKey,
    isLoading,
    backendHealthy,
    
    // Actions
    requestPermission,
    unsubscribe,
    checkBackendPermissions,
    sendTestNotification,
    getPermissionForOrigin,
    removePermissionForOrigin,
    
    // Backend service access
    backendService: notificationBackend
  }
}
