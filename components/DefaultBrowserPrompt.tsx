import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BROWSER_PROMPT_KEY = 'hasShownDefaultBrowserPrompt';

export default function DefaultBrowserPrompt() {
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    checkAndShowPrompt();
  }, []);

  const checkAndShowPrompt = async () => {
    if (hasChecked) return;
    setHasChecked(true);

    try {
      // Check if prompt shown 
      const hasShown = await AsyncStorage.getItem(DEFAULT_BROWSER_PROMPT_KEY);
      if (hasShown) return;

      // Wait a bit
      setTimeout(() => {
        showDefaultBrowserPrompt();
      }, 2000);
      
    } catch (error) {
      console.error('Error checking default browser prompt:', error);
    }
  };

  const showDefaultBrowserPrompt = () => {
    Alert.alert(
      'Set as Default Browser',
      'Would you like to set Metanet as your default browser? This will allow you to open web links directly in Metanet.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => markPromptShown(),
        },
        {
          text: 'Set as Default',
          onPress: () => openDefaultBrowserSettings(),
        },
      ]
    );
  };

  const openDefaultBrowserSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        // On Android, try opening the default apps settings
        const url = 'android.settings.MANAGE_DEFAULT_APPS_SETTINGS';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback to general settings
          await Linking.openSettings();
        }
      } else if (Platform.OS === 'ios') {
        // On iOS, try to direct users to Settings app
        Alert.alert(
          'Set Default Browser',
          'To set Metanet as your default browser:\n\n1. Go to Settings\n2. Scroll down to Metanet\n3. Tap "Default Browser App"\n4. Select Metanet',
          [
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      }
      
      await markPromptShown();
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert('Error', 'Could not open settings. Please manually set Metanet as your default browser in your device settings.');
      await markPromptShown();
    }
  };

  const markPromptShown = async () => {
    try {
      await AsyncStorage.setItem(DEFAULT_BROWSER_PROMPT_KEY, 'true');
    } catch (error) {
      console.error('Error saving prompt state:', error);
    }
  };

  return null;
}

export const showManualDefaultBrowserPrompt = () => {
  Alert.alert(
    'Set as Default Browser',
    'Set Metanet as your default browser to open web links directly in the app.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'android') {
            Linking.openSettings();
          } else {
            Alert.alert(
              'Set Default Browser',
              'To set Metanet as your default browser:\n\n1. Go to Settings\n2. Scroll down to Metanet\n3. Tap "Default Browser App"\n4. Select Metanet',
              [
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings(),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ]
            );
          }
        },
      },
    ]
  );
};