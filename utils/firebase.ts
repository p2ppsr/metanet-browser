import analytics from '@react-native-firebase/analytics';
import remoteConfig from '@react-native-firebase/remote-config';
import installations from '@react-native-firebase/installations';
import { Platform } from 'react-native';

const analyticsInstance = analytics();
const remoteConfigInstance = remoteConfig();
const installationsInstance = installations();

export const initializeFirebase = async () => {
  try {
    await analyticsInstance.logAppOpen();
    console.log('Firebase Analytics: app_open event logged');

    // For development mode of Firebase Remote Config
    if (__DEV__) {
      await remoteConfigInstance.setConfigSettings({
        minimumFetchIntervalMillis: 0,
      });

      const token = await installationsInstance.getToken();
      console.log(`A/B Testing Token for ${Platform.OS}:`, token);
    }

    // Initialize Remote Config and set default values
    await remoteConfigInstance.setDefaults({
      start_button_text: 'Get Started',
    });

    // Fetch and activate the latest config
    const fetchedRemotely = await remoteConfigInstance.fetchAndActivate();
    if (fetchedRemotely) {
      console.log('Remote Config: Configs were retrieved from the backend and activated.');
    } else {
      console.log('Remote Config: No new configs were fetched from the backend.');
    }
  } catch (error) {
    console.error('Firebase error', error);
  }
};

export {
  analyticsInstance as analytics,
  remoteConfigInstance as remoteConfig,
  installationsInstance as installations,
};
