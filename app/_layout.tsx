import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { UserContextProvider, NativeHandlers } from '../context/UserContext';
import packageJson from '../package.json';
import { WalletContextProvider } from '@/context/WalletContext';
import { ExchangeRateContextProvider } from '@/context/ExchangeRateContext';
import { ThemeProvider } from '@/context/theme/ThemeContext';
import PasswordHandler from '@/components/PasswordHandler';
import RecoveryKeySaver from '@/components/RecoveryKeySaver';
import LocalStorageProvider from '@/context/LocalStorageProvider';
import ProtocolAccessModal from '@/components/ProtocolAccessModal';
import BasketAccessModal from '@/components/BasketAccessModal';
import CertificateAccessModal from '@/components/CertificateAccessModal';
import SpendingAuthorizationModal from '@/components/SpendingAuthorizationModal';
import { useDeepLinking } from '@/hooks/useDeepLinking';
import DefaultBrowserPrompt from '@/components/DefaultBrowserPrompt';
import * as Notifications from 'expo-notifications';
import { getAnalytics } from '@react-native-firebase/analytics';
import { getRemoteConfig } from '@react-native-firebase/remote-config';
import { getInstallations } from '@react-native-firebase/installations';
import { Platform } from 'react-native';

const nativeHandlers: NativeHandlers = {
  isFocused: async () => false,
  onFocusRequested: async () => { },
  onFocusRelinquished: async () => { },
  onDownloadFile: async (fileData: Blob, fileName: string) => {
    try {
      const url = window.URL.createObjectURL(fileData);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  }
};

// Configure global notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Deep link handler component
function DeepLinkHandler() {
  useDeepLinking();
  return null;
}

export default function RootLayout() {
  const [configLoaded, setConfigLoaded] = useState(false);
  useEffect(() => {
    const logAppOpen = async () => {
      try {
        const analyticsInstance = getAnalytics();
        await analyticsInstance.logAppOpen();
        console.log('Firebase Analytics: app_open event logged');

        const remoteConfigInstance = getRemoteConfig();

        // For development mode of Firebase Remote Config
        if (__DEV__) {
          await remoteConfigInstance.setConfigSettings({
            minimumFetchIntervalMillis: 0,
          });

          const token = await getInstallations().getToken()
          console.log(`A/B Testing Token for ${Platform.OS}:`, token)
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
      } finally {
        setConfigLoaded(true);
      }
    };
    logAppOpen();
  }, []);

  if (!configLoaded) {
    return null;
  }

  return (
    <LocalStorageProvider>
      <UserContextProvider
        nativeHandlers={nativeHandlers}
        appVersion={packageJson.version}
        appName="Metanet"
      >
        <ExchangeRateContextProvider>
          <WalletContextProvider>
            <ThemeProvider>
              <DeepLinkHandler />
              <DefaultBrowserPrompt />
              <PasswordHandler />
              <RecoveryKeySaver />
              <ProtocolAccessModal />
              <BasketAccessModal />
              <CertificateAccessModal />
              <SpendingAuthorizationModal />
              <Stack
                screenOptions={{
                  animation: 'slide_from_right',
                  headerShown: false
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="browser" />
                <Stack.Screen name="config" options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'modal'
                }} />
              </Stack>
            </ThemeProvider>
          </WalletContextProvider>
        </ExchangeRateContextProvider>
      </UserContextProvider>
    </LocalStorageProvider>
  );
}