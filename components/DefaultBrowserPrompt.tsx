import React, { useEffect, useState } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DEFAULT_BROWSER_PROMPT_KEY = 'hasShownDefaultBrowserPrompt'

export default function DefaultBrowserPrompt() {
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    checkAndShowPrompt()
  }, [])

  const checkAndShowPrompt = async () => {
    if (hasChecked) return

    setHasChecked(true)

    try {
      const hasShown = await AsyncStorage.getItem(DEFAULT_BROWSER_PROMPT_KEY)
      if (hasShown) return

      // Show prompt after app loads
      setTimeout(() => {
        showDefaultBrowserPrompt()
      }, 2000)
    } catch (error) {
      console.error('Error checking default browser prompt:', error)
    }
  }

  const showDefaultBrowserPrompt = () => {
    Alert.alert(
      'Set as Default Browser',
      'Would you like to set Metanet Explorer as your default browser? This will allow you to open web links directly in Metanet Explorer.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: markPromptShown
        },
        {
          text: 'Set as Default',
          onPress: openDefaultBrowserSettings
        }
      ]
    )
  }

  const openDefaultBrowserSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        // Try opening Android default apps settings
        const androidUrls = [
          'android.settings.MANAGE_DEFAULT_APPS_SETTINGS',
          'android.settings.APPLICATION_SETTINGS',
          'android.settings.SETTINGS'
        ]

        let opened = false
        for (const url of androidUrls) {
          try {
            const canOpen = await Linking.canOpenURL(url)
            if (canOpen) {
              await Linking.openURL(url)
              opened = true
              break
            }
          } catch (urlError) {
            // Next URL
          }
        }

        if (!opened) {
          await Linking.openSettings()
        }
      } else if (Platform.OS === 'ios') {
        // Show iOS instructions
        Alert.alert(
          'Set Default Browser',
          'To set Metanet Explorer as your default browser:\n\n1. Go to Settings\n2. Scroll down to Metanet Explorer\n3. Tap "Default Browser App"\n4. Select Metanet Explorer',
          [
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        )
      }

      await markPromptShown()
    } catch (error) {
      console.error('Error opening settings:', error)
      Alert.alert(
        'Error',
        'Could not open settings. Please manually set Metanet Explorer as your default browser in your device settings.'
      )
      await markPromptShown()
    }
  }

  const markPromptShown = async () => {
    try {
      await AsyncStorage.setItem(DEFAULT_BROWSER_PROMPT_KEY, 'true')
    } catch (error) {
      console.error('Error saving prompt state:', error)
    }
  }

  return null
}

export const showManualDefaultBrowserPrompt = () => {
  Alert.alert(
    'Set as Default Browser',
    'Set Metanet Explorer as your default browser to open web links directly in the app.',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'android') {
            Linking.openSettings()
          } else {
            Alert.alert(
              'Set Default Browser',
              'To set Metanet Explorer as your default browser:\n\n1. Go to Settings\n2. Scroll down to Metanet Explorer\n3. Tap "Default Browser App"\n4. Select Metanet Explorer',
              [
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings()
                },
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ]
            )
          }
        }
      }
    ]
  )
}
