/**
 * Root entry point for React Native app
 * Registers FCM background handler for Android headless mode BEFORE React starts
 */

// Import headless FCM handler first (registers the handler on import)
import './headless'

// Initialize react-native-quick-crypto
import { install } from 'react-native-quick-crypto'
install()

// Then start the normal Expo app
import 'expo-router/entry'
