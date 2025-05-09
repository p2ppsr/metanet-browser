import React from 'react';
import { StyleSheet } from 'react-native';
import { UserInterface } from '@bsv/brc100-ui-react-components';
import packageJson from '../package.json';

async function onWalletReady() {
    console.log('onWalletReady');
}

async function nativeHandlers() {
    console.log('nativeHandlers');
}

export default function RootLayout() {
  return (
    <UserInterface
      onWalletReady={onWalletReady}
      nativeHandlers={nativeHandlers}
      appVersion={packageJson.version}
      appName="Metanet Mobile"
    />
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