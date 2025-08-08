import messagingModular from '@react-native-firebase/messaging'
import { FirebaseMessaging } from '@/utils/firebase'
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
