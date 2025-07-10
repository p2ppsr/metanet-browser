import { Platform, Linking } from 'react-native';
import messagingModular from '@react-native-firebase/messaging';
import { FirebaseMessaging } from '@/utils/firebase';

/**
 * Requests permission to show notifications on iOS (and Android 13+).
 */
export const requestUserPermission = async (): Promise<boolean> => {
  const authStatus = await messagingModular().requestPermission();
  const enabled =
    authStatus === FirebaseMessaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === FirebaseMessaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Notification permissions granted:', authStatus);
  } else {
    console.log('Notification permissions denied:', authStatus);
  }

  return enabled;
};

/**
 * Fetches the current FCM token for the device.
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messagingModular().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (err) {
    console.error('Failed to get FCM token:', err);
    return null;
  }
};

/**
 * Subscribes to notification events.
 */
export const initializeFirebaseNotifications = async (): Promise<void> => {
  const hasPermission = await requestUserPermission();
  if (!hasPermission) return;

  await getFCMToken(); // Volatile for now

  // Handle notification received in foreground
  messagingModular().onMessage(async remoteMessage => {
    console.log('Foreground notification:', remoteMessage);
  });

  // Handle notification opened from background state
  messagingModular().onNotificationOpenedApp(remoteMessage => {
    console.log('Notification opened from background:', remoteMessage);
    handleNotificationNavigation(remoteMessage);
  });

  // Handle notification opened from quit state
  const initialMessage = await messagingModular().getInitialNotification();
  if (initialMessage) {
    console.log('App opened from quit via notification:', initialMessage);
    handleNotificationNavigation(initialMessage);
  }

  // Handle token refresh
  messagingModular().onTokenRefresh(token => {
    console.log('FCM token refreshed:', token);
    // TODO: Eventually persist or send to backend
  });
};

/**
 * If the notification includes a URL, navigate to it.
 */
const handleNotificationNavigation = (message: any) => {
  const url = message?.data?.url;
  if (url) {
    console.log('Navigating to URL from notification:', url);
    Linking.openURL(url).catch(err => {
      console.error('Failed to open notification URL:', err);
    });
  }
};
