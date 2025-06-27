import React, { useEffect } from 'react';
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
import { LanguageProvider, debugLanguageDetection } from '@/utils/translations';
import { useTranslation } from 'react-i18next';
// Import the i18n instance to test translations
import '@/utils/translations';

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

// Translation test component
function TranslationTester() {
  const { t, i18n } = useTranslation();
  
  useEffect(() => {
    const runTests = () => {
      try {
        console.log('🧪 Testing translations in component...');
        console.log('Current language:', i18n.language);
        console.log('Test translation (new_tab):', t('new_tab'));
        console.log('Test translation (bookmarks):', t('bookmarks'));
        console.log('Test translation (settings):', t('settings'));
        console.log('✅ Translation component test completed');
        
        // Run comprehensive debug
        debugLanguageDetection();
      } catch (error) {
        console.error('❌ Translation test failed:', error);
      }
    };
    
    // Run test after a short delay to ensure i18n is initialized
    setTimeout(runTests, 2000);
  }, [t, i18n]);
  
  return null;
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <LocalStorageProvider>
        <UserContextProvider
          nativeHandlers={nativeHandlers}
          appVersion={packageJson.version}
          appName="Metanet"
        >
          <ExchangeRateContextProvider>
            <WalletContextProvider>              <ThemeProvider>
                <DeepLinkHandler />
                <TranslationTester />
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
    </LanguageProvider>
  );
}