import { Platform } from 'react-native';
import config from './config';

// Define module-level variables for the Firebase services.
// These will be functions that return the singleton instance, e.g., analytics().
let analytics: () => any;
let remoteConfig: () => any;
let installations: () => any;

// Conditionally load Firebase modules or set up mocks.
if (config.useFirebase) {
  try {
    const analyticsModular = require('@react-native-firebase/analytics');
    const remoteConfigModular = require('@react-native-firebase/remote-config');
    const installationsModular = require('@react-native-firebase/installations');

    const analyticsInstance = analyticsModular.getAnalytics();
    const remoteConfigInstance = remoteConfigModular.getRemoteConfig();
    const installationsInstance = installationsModular.getInstallations();
    
    analytics = () => analyticsInstance;
    remoteConfig = () => remoteConfigInstance;
    installations = () => installationsInstance;
    
  } catch (error) {
    console.error("Failed to load Firebase modules. Running in mock mode.", error);
    // Fallback to mock mode if modules fail to load, ensuring app doesn't crash.
    config.useFirebase = false;
  }
}

// If useFirebase is false (either by config or by load failure), set up mock services.
if (!config.useFirebase) {
  const mockAnalytics = {
    logAppOpen: async () => console.log('Mock Analytics: app_open event logged'),
    logEvent: async (name: string, params?: { [key: string]: any }) => {
      console.log(`Mock Analytics: Event '${name}' logged with params:`, params);
    },
  };

  const mockRemoteConfig = {
    setConfigSettings: async (settings: any) => console.log('Mock Remote Config: Set config settings:', settings),
    setDefaults: async (defaults: any) => console.log('Mock Remote Config: Set defaults:', defaults),
    fetchAndActivate: async () => {
      console.log('Mock Remote Config: Fetched and activated.');
      return true;
    },
    getValue: (key: string) => {
      console.log(`Mock Remote Config: Getting value for key '${key}'`);
      return {
        asString: () => '',
        getSource: () => 'static', // Mimic the behavior of a default value
      };
    },
  };

  const mockInstallations = {
    getToken: async () => {
      console.log('Mock Installations: Getting token.');
      return 'mock-token';
    },
    getId: async () => {
      console.log('Mock Installations: Getting ID.');
      return 'mock-installation-id';
    },
  };

  // The service variables are assigned functions that return the mock objects,
  // mimicking the behavior of the actual Firebase modules.
  analytics = () => mockAnalytics;
  remoteConfig = () => mockRemoteConfig;
  installations = () => mockInstallations;
}

/**
 * Initializes Firebase services if enabled.
 * This function can be called safely regardless of the useFirebase flag.
 */
export const initializeFirebase = async () => {
  if (!config.useFirebase) {
    console.log("Firebase is disabled. Using mock services for initialization.");
  }

  try {
    await analytics().logAppOpen();

    if (config.useFirebase) {
        console.log('Firebase Analytics: app_open event logged');
    }

    // For development mode of Firebase Remote Config
    if (__DEV__) {
      await remoteConfig().setConfigSettings({
        minimumFetchIntervalMillis: 0,
      });

      const token = await installations().getToken();
      if (config.useFirebase) {
        console.log(`A/B Testing Token for ${Platform.OS}:`, token);
      }
    }

    await remoteConfig().setDefaults({
      start_button_text: 'Get Started',
    });

    const fetchedRemotely = await remoteConfig().fetchAndActivate();

    if (config.useFirebase) {
        if (fetchedRemotely) {
            console.log('Remote Config: Configs were retrieved from the backend and activated.');
        } else {
            console.log('Remote Config: No new configs were fetched from the backend.');
        }
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
};

// Export the service functions so they can be used throughout the app.
export { analytics, remoteConfig, installations };

