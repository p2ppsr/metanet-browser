import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { WalletContextProvider } from './context/WalletContext';
import { UserContextProvider } from './context/UserContext';
import packageJson from '../package.json';
import { WalletInterface } from '@bsv/sdk';
import { NativeHandlers } from './context/UserContext';

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

export default function RootLayout() {
  return (
    <UserContextProvider 
      nativeHandlers={nativeHandlers} 
      appVersion={packageJson.version} 
      appName="Metanet Mobile"
    >
      <WalletContextProvider onWalletReady={onWalletReady}>
        <View>
          <Text style={styles.text}>Getting Started</Text>
        </View>
      </WalletContextProvider>
    </UserContextProvider>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 50,
    color: '#333',
    textAlign: 'center',
    marginTop: 100,
  },
});