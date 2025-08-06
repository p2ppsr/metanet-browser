import { getFCMToken } from '@/utils/pushNotificationManager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Backend configuration - Using local IP for mobile device connectivity
const BACKEND_BASE_URL = 'http://192.168.1.178:3000'
const API_BASE_URL = 'http://192.168.1.178:3000/api/v1'
const API_KEY = 'AIzaSyCXrXRvZjrMfIiC7oTjQ7D6rksbFT8Neaw'

// Storage keys
const USER_KEY_STORAGE = 'metanet_user_key'
const SUBSCRIPTIONS_STORAGE = 'metanet_subscriptions'

export interface BackendPushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userId: string
  origin: string
  deviceInfo?: {
    platform: 'ios' | 'android'
    appVersion?: string
    deviceId?: string
  }
}

export interface BackendNotification {
  userKey: string
  notification: {
    title: string
    body: string
    icon?: string
    url?: string
  }
  data?: Record<string, any>
}

export interface BackendResponse<T = any> {
  success: boolean
  data?: T
  userKey?: string
  message?: string
  error?: string
}

export class NotificationBackendService {
  private static instance: NotificationBackendService
  private userKey: string | null = null

  private constructor() {}

  static getInstance(): NotificationBackendService {
    if (!NotificationBackendService.instance) {
      NotificationBackendService.instance = new NotificationBackendService()
    }
    return NotificationBackendService.instance
  }

  /**
   * Initialize the service and load stored user key
   */
  async initialize(): Promise<void> {
    try {
      this.userKey = await AsyncStorage.getItem(USER_KEY_STORAGE)
      console.log('🔧 Backend service initialized. User key:', this.userKey ? 'exists' : 'none')
    } catch (error) {
      console.error('❌ Failed to initialize backend service:', error)
    }
  }

  /**
   * Make authenticated API request to backend
   */
  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<BackendResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          ...options.headers
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      return data
    } catch (error) {
      console.error(`❌ Backend API error [${endpoint}]:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate proper cryptographic keys for web push
   */
  private generateWebPushKeys(): { p256dh: string; auth: string } {
    // Generate random bytes for keys (simplified for demo)
    const p256dh = this.generateRandomBase64Url(65)
    const auth = this.generateRandomBase64Url(16)

    return { p256dh, auth }
  }

  private generateRandomBase64Url(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Register push subscription with backend (Production Curl-Compatible)
   */
  async registerPushSubscription(userId: string, origin: string = 'metanet-mobile'): Promise<BackendResponse> {
    try {
      const { status } = await Notifications.requestPermissionsAsync()
      if (status !== 'granted') {
        throw new Error('Push notifications permission denied')
      }

      const fcmToken = await getFCMToken()
      if (!fcmToken) {
        throw new Error('FCM token not available')
      }

      const keys = this.generateWebPushKeys()

      const deviceId = `metanet-mobile-${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(7)}`

      const fcmEndpoint = `https://fcm.googleapis.com/fcm/send/${deviceId}`

      const registrationPayload = {
        endpoint: fcmEndpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth
        },
        fcmToken: fcmToken,
        userId: userId,
        deviceInfo: {
          platform: Platform.OS,
          deviceId: deviceId,
          appVersion: '1.0.0'
        }
      }

      console.log('📱 Registering push subscription with backend (Production Format)...', {
        userId,
        fcmToken: fcmToken.substring(0, 20) + '...',
        endpoint: registrationPayload.endpoint.substring(0, 50) + '...'
      })

      const response = await this.makeRequest('/subscriptions/register', {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registrationPayload)
      })

      console.log('🔍 Backend response received:', response)
      console.log('🔍 Response.success:', response.success)
      console.log('🔍 Response.userKey:', response.userKey)

      if (response.success && response.userKey) {
        // Store user key for future requests
        this.userKey = response.userKey
        await AsyncStorage.setItem(USER_KEY_STORAGE, this.userKey)

        // Store subscription info
        await AsyncStorage.setItem(
          SUBSCRIPTIONS_STORAGE,
          JSON.stringify({
            userKey: this.userKey,
            subscription: registrationPayload,
            origin,
            registeredAt: Date.now()
          })
        )

        console.log('✅ Push subscription registered successfully:', response.userKey)
      }

      return response
    } catch (error) {
      console.error('❌ Failed to register push subscription:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  /**
   * Check permissions for current user
   */
  async checkPermissions(origin: string = 'metanet-mobile'): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    console.log('🔍 Checking permissions for userKey:', this.userKey)

    return await this.makeRequest(`/subscriptions/permissions/${this.userKey}`, {
      method: 'GET',
      headers: {
        Origin: origin
      }
    })
  }

  /**
   * Send notification via backend (Production Curl-Compatible)
   */
  async sendNotification(
    notification: {
      title: string
      body: string
      icon?: string
      data?: Record<string, any>
    },
    origin: string = 'metanet-mobile'
  ): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    const payload = {
      userKey: this.userKey,
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        data: notification.data || {
          custom: 'payload',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      }
    }

    console.log('📤 Sending notification via production endpoint...', {
      userKey: this.userKey,
      title: notification.title
    })

    return await this.makeRequest('/notifications/send', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Unsubscribe from push notifications (Production Curl-Compatible)
   */
  async unsubscribe(origin: string = 'metanet-mobile'): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    console.log('🗑️ Unsubscribing userKey from push notifications:', this.userKey)

    const response = await this.makeRequest(`/subscriptions/${this.userKey}`, {
      method: 'DELETE',
      headers: {
        Origin: origin
      }
    })

    if (response.success) {
      // Clear stored data
      this.userKey = null
      await AsyncStorage.removeItem(USER_KEY_STORAGE)
      await AsyncStorage.removeItem(SUBSCRIPTIONS_STORAGE)
      console.log('✅ Successfully unsubscribed and cleared local data')
    }

    return response
  }

  /**
   * Get current user key
   */
  getUserKey(): string | null {
    return this.userKey
  }

  /**
   * Check if user is subscribed
   */
  isSubscribed(): boolean {
    return this.userKey !== null
  }

  /**
   * Health check backend connection
   */
  async healthCheck(): Promise<BackendResponse> {
    try {
      console.log('🔍 Health checking backend connection...')
      const response = await fetch(`${BACKEND_BASE_URL}/health`)
      const data = await response.json()
      console.log('🔍 Backend health check response:', data)
      return { success: response.ok, data }
    } catch (error) {
      console.error('❌ Health check failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }
}

// Export singleton instance
export const notificationBackend = NotificationBackendService.getInstance()
