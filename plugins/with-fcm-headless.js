const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to register ReactNativeFirebaseMessagingHeadlessTask
 * This enables FCM background message processing when the app is killed
 */
function withFCMHeadless(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Find the application element
    const application = androidManifest.manifest.application?.[0];
    if (!application) {
      throw new Error('Could not find application element in AndroidManifest.xml');
    }

    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }

    // Check if FCM headless service already exists
    const existingService = application.service.find(
      service => service.$?.['android:name'] === 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService'
    );

    // Add the FCM headless service if it doesn't exist
    if (!existingService) {
      application.service.push({
        $: {
          'android:name': 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'com.google.firebase.MESSAGING_EVENT',
                },
              },
            ],
          },
        ],
      });

      console.log('✅ Added ReactNativeFirebaseMessagingHeadlessService to AndroidManifest.xml');
    } else {
      console.log('ℹ️  ReactNativeFirebaseMessagingHeadlessService already exists in AndroidManifest.xml');
    }

    return config;
  });
}

module.exports = withFCMHeadless;
