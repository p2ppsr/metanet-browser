import React from 'react';
import { Stack } from 'expo-router';
import { UserContextProvider, NativeHandlers } from '../context/UserContext';
import packageJson from '../package.json';
import { WalletInterface } from '@bsv/sdk';
import { WalletContextProvider } from '@/context/WalletContext';

async function onWalletReady(wallet: WalletInterface): Promise<(() => void) | undefined> {
    return () => {
        console.log('onWalletReady', wallet);
    }
}

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
}

// Root layout component that sets up providers and navigation
export default function RootLayout() {
  // With Expo Router, we need a simpler layout setup
  return (
    <UserContextProvider 
      nativeHandlers={nativeHandlers} 
      appVersion={packageJson.version} 
      appName="Metanet Mobile"
    >
      <WalletContextProvider onWalletReady={onWalletReady}>
        <Stack>
          <Stack.Screen 
            name="index" 
            options={{ 
              headerShown: false 
            }} 
          />
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: true
            }} 
          />
        </Stack>
      </WalletContextProvider>
    </UserContextProvider>
  );
}