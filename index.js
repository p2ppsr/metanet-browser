/**
 * Root entry point for React Native app
 * Registers FCM background handler for Android headless mode BEFORE React starts
 */

// Import headless FCM handler first (registers the handler on import)
import './headless'

// Then start the normal Expo app
import 'expo-router/entry'
