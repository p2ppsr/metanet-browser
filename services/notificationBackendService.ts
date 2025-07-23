// Backend API integration for metanet-mobile push notifications
// Replaces local Firebase handling with backend server calls

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Backend configuration - Using local IP for mobile device connectivity
const BACKEND_BASE_URL = 'http://172.29.81.201:3000'
const API_BASE_URL = 'http://172.29.81.201:3000/api/v1'
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
  origin: string // Origin domain for the subscription
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
  private async makeRequest<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<BackendResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          ...options.headers,
        },
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
   * Register push subscription with backend
   */
  async registerPushSubscription(
    userId: string, 
    origin: string = 'metanet-mobile'
  ): Promise<BackendResponse> {
    try {
      // Get system notification permissions
      const { status } = await Notifications.requestPermissionsAsync()
      if (status !== 'granted') {
        throw new Error('Push notifications permission denied')
      }

      // Generate FCM-compatible token and keys for web push compatibility
      const keys = this.generateWebPushKeys()
      
      // Create a pseudo-FCM token for web push compatibility
      // In a real implementation, this would be a proper FCM token
      const pseudoFCMToken = `metanet-mobile-${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const fcmEndpoint = `https://fcm.googleapis.com/fcm/send/${pseudoFCMToken}`

      const subscription: BackendPushSubscription = {
        endpoint: fcmEndpoint,
        keys,
        userId,
        origin, // Include the origin field that backend expects
        deviceInfo: {
          platform: Platform.OS as 'ios' | 'android',
          appVersion: '1.0.0', // App version for backend tracking
          deviceId: pseudoFCMToken.substring(0, 50) // Use part of FCM token as device ID
        }
      }

      console.log('📱 Registering push subscription with backend...', {
        userId,
        endpoint: subscription.endpoint.substring(0, 50) + '...'
      })

      const response = await this.makeRequest('/subscriptions/register', {
        method: 'POST',
        body: JSON.stringify(subscription)
      })

      console.log('🔍 Backend response received:', response)
      console.log('🔍 Response.success:', response.success)
      console.log('🔍 Response.userKey:', response.userKey)

      if (response.success && response.userKey) {
        // Store user key for future requests
        this.userKey = response.userKey
        await AsyncStorage.setItem(USER_KEY_STORAGE, this.userKey)
        
        // Store subscription info
        await AsyncStorage.setItem(SUBSCRIPTIONS_STORAGE, JSON.stringify({
          userKey: this.userKey,
          subscription,
          origin,
          registeredAt: Date.now()
        }))

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
  async checkPermissions(): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    return await this.makeRequest(`/subscriptions/${this.userKey}/permissions`)
  }

  /**
   * Send notification via backend (for testing)
   */
  async sendNotification(notification: Omit<BackendNotification, 'userKey'>): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    const payload: BackendNotification = {
      userKey: this.userKey,
      ...notification
    }

    return await this.makeRequest('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<BackendResponse> {
    if (!this.userKey) {
      return { success: false, error: 'No user key found' }
    }

    const response = await this.makeRequest(`/subscriptions/${this.userKey}`, {
      method: 'DELETE'
    })

    if (response.success) {
      // Clear stored data
      this.userKey = null
      await AsyncStorage.removeItem(USER_KEY_STORAGE)
      await AsyncStorage.removeItem(SUBSCRIPTIONS_STORAGE)
      console.log('✅ Successfully unsubscribed from push notifications')
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
      const response = await fetch(`${BACKEND_BASE_URL}/health`)
      const data = await response.json()
      return { success: response.ok, data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Health check failed' 
      }
    }
  }
}

// Export singleton instance
export const notificationBackend = NotificationBackendService.getInstance()
