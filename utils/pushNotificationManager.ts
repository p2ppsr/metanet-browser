import { Platform, Linking } from 'react-native'
import messagingModular from '@react-native-firebase/messaging'
import { FirebaseMessaging } from '@/utils/firebase'
import * as Notifications from 'expo-notifications'
import type { PendingNotification } from '@/hooks/usePushNotifications'
import { IdentityClient, WalletInterface } from '@bsv/sdk'
import { MessageBoxClient } from '@bsv/message-box-client'

/**
 * Requests permission to show notifications on iOS (and Android 13+).
 */
export const requestUserPermission = async (): Promise<boolean> => {
  const authStatus = await messagingModular().requestPermission()
  const enabled =
    authStatus === FirebaseMessaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === FirebaseMessaging.AuthorizationStatus.PROVISIONAL

  if (enabled) {
    console.log('Notification permissions granted:', authStatus)
  } else {
    console.log('Notification permissions denied:', authStatus)
  }

  return enabled
}

/**
 * Fetches the current FCM token for the device.
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messagingModular().getToken()
    console.log('FCM Token:', token)
    return token
  } catch (err) {
    console.error('Failed to get FCM token:', err)
    return null
  }
}

// WebView bridge callbacks for forwarding notifications
// let webViewMessageCallback: ((notification: PendingNotification) => void) | null = null

/**
 * Set callback for forwarding notifications to WebView
 */
// export const setWebViewMessageCallback = (callback: (notification: PendingNotification) => void) => {
//   webViewMessageCallback = callback
// }

/**
 * Show a local notification using Expo Notifications
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
 * Initialize FCM notifications with backend integration and WebView bridge
 */
// export const initializeFirebaseNotifications = async (wallet?: WalletInterface, originator?: string): Promise<void> => {

//   console.log('🚀 Initializing Firebase notifications with backend integration')

//   const hasPermission = await requestUserPermission()
//   if (!hasPermission) {
//     console.warn('⚠️ FCM permissions not granted, notifications will not work')
//     return
//   }

//   const fcmToken = await getFCMToken()
//   if (!fcmToken) {
//     console.warn('⚠️ Could not get FCM token, notifications will not work')
//     return
//   }

//   console.log('✅ FCM initialized successfully with token:', fcmToken.substring(0, 20) + '...')

//   // Handle notification received in foreground
//   messagingModular().onMessage(async remoteMessage => {
//     console.log('📱 FCM foreground notification received:', remoteMessage)

//     try {
//       // Extract messageId from FCM notification body
//       const messageId = remoteMessage.notification?.body

//       if (!messageId) {
//         console.warn('⚠️ No messageId in FCM notification body, showing generic notification')
//         const notification: PendingNotification = {
//           title: remoteMessage.notification?.title || 'New Message',
//           body: remoteMessage.notification?.body || 'You have received a new message',
//           origin: 'unknown',
//           timestamp: Date.now()
//         }
//         await showLocalNotification(notification)
//         return
//       }

//       console.log('📬 Processing notification for messageId:', messageId)
//       // Create MessageBoxClient and retrieve messages
//       const messageBoxClient = new MessageBoxClient({
//         walletClient: wallet,
//         host: 'http://localhost:8080',
//         enableLogging: true,
//         originator
//       })

//       console.log('🔍 Fetching messages from notification messageBox...')
//       const messages = await messageBoxClient.listMessages({
//         messageBox: 'notifications',
//         originator
//       })
//       console.log('Found messages:', messages)

//       // Find the specific message that triggered the notification
//       const targetMessage = messages.find(message => message.messageId === messageId)

//       if (!targetMessage) {
//         console.warn(`⚠️ Message with ID ${messageId} not found in messageBox`)
//         return
//       }

//       console.log('📬 Found target message:', targetMessage)

//       // Acknowledge the specific message
//       await messageBoxClient.acknowledgeMessage({
//         messageIds: [messageId],
//         originator
//       })
//       console.log('✅ Message acknowledged:', messageId)

//       // const identityClient = new IdentityClient(wallet, )

//       // Create notification with the actual message content
//       const notification: PendingNotification = {
//         title: remoteMessage.notification?.title || 'New Message',
//         body: typeof targetMessage.body === 'string'
//           ? targetMessage.body
//           : JSON.stringify(targetMessage.body),
//         origin: targetMessage.sender || 'unknown',
//         timestamp: Date.now(),
//         data: {
//           messageId: targetMessage.messageId,
//           sender: targetMessage.sender,
//           fcmMessageId: remoteMessage.messageId,
//           from: remoteMessage.from
//         }
//       }

//       // Show local notification
//       await showLocalNotification(notification)

//       // Forward to WebView if callback is set
//       if (webViewMessageCallback) {
//         webViewMessageCallback(notification)
//       }
//     } catch (error) {
//       console.error('❌ Error processing FCM notification:', error)

//       // Fallback: show generic notification even if message processing fails
//       // const fallbackNotification: PendingNotification = {
//       //   title: remoteMessage.notification?.title || 'New Message',
//       //   body: remoteMessage.notification?.body || 'You have received a new message',
//       //   origin: 'unknown',
//       //   timestamp: Date.now()
//       // }

//       // try {
//       //   await showLocalNotification(fallbackNotification)
//       // } catch (fallbackError) {
//       //   console.error('❌ Failed to show fallback notification:', fallbackError)
//       // }
//     }
//   })

//   // Handle notification opened from background state
//   messagingModular().onNotificationOpenedApp(remoteMessage => {
//     console.log('📱 Notification opened from background:', remoteMessage)
//     handleNotificationNavigation(remoteMessage)

//     const fcmData =
//       typeof remoteMessage.data === 'object' && remoteMessage.data !== null
//         ? (remoteMessage.data as Record<string, any>)
//         : {}

//     const notification: PendingNotification = {
//       title: remoteMessage.notification?.title || 'Notification',
//       body: remoteMessage.notification?.body || '',
//       data: fcmData,
//       origin: fcmData.origin || 'unknown',
//       timestamp: Date.now()
//     }

//     // Forward to WebView if callback is set
//     if (webViewMessageCallback) {
//       webViewMessageCallback(notification)
//     }
//   })

//   // Handle notification opened from quit state
//   const initialMessage = await messagingModular().getInitialNotification()
//   if (initialMessage) {
//     console.log('📱 App opened from quit via notification:', initialMessage)
//     handleNotificationNavigation(initialMessage)

//     const fcmData =
//       typeof initialMessage.data === 'object' && initialMessage.data !== null
//         ? (initialMessage.data as Record<string, any>)
//         : {}

//     const notification: PendingNotification = {
//       title: initialMessage.notification?.title || 'Notification',
//       body: initialMessage.notification?.body || '',
//       data: fcmData,
//       origin: fcmData.origin || 'unknown',
//       timestamp: Date.now()
//     }

//     // Forward to WebView if callback is set
//     if (webViewMessageCallback) {
//       webViewMessageCallback(notification)
//     }
//   }

//   // Handle token refresh and update backend
//   messagingModular().onTokenRefresh(async token => {
//     console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...')
//     // TODO: Update backend with new token
//   })
// }

/**
 * If the notification includes a URL, navigate to it.
 */
// const handleNotificationNavigation = (message: any) => {
//   const url = message?.data?.url
//   if (url) {
//     console.log('Navigating to URL from notification:', url)
//     Linking.openURL(url).catch(err => {
//       console.error('Failed to open notification URL:', err)
//     })
//   }
// }
