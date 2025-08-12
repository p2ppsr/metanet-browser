/**
 * headless.js - React Native Firebase Headless Task Registration
 * This file registers the FCM background message handler for Android headless mode
 */

import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { MessageBoxClient } from '@bsv/message-box-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedGroupPreferences from 'react-native-shared-group-preferences'
import { Platform } from 'react-native'
import { CachedKeyDeriver, PrivateKey, SymmetricKey, Utils, IdentityClient } from '@bsv/sdk';
import { WalletStorageManager, WalletSigner, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-mobile';
import * as crypto from 'crypto'
global.self = { crypto }

const APP_GROUP = 'group.org.bsvblockchain.metanet'
const SNAP_KEY = 'snap';

// Helper functions (duplicated from fcmBackground.ts for headless isolation)

/**
 * Common function to process FCM notifications and show local notifications
 * @param {Object} remoteMessage - The FCM remote message
 * @param {string} context - Context for logging ('background' or 'foreground')
 * @param {boolean} enableLogging - Whether to enable detailed logging for MessageBoxClient
 */
async function processNotificationMessage(remoteMessage, context = 'headless', enableLogging = false) {
  console.log(`[${context}] 📦 FCM ${context} message received:`, remoteMessage);

  try {
    const messageId = Platform.OS === 'ios' ?
      remoteMessage.notification?.body
      : remoteMessage.data.messageId;

    if (!messageId) {
      console.warn(`[${context}] ⚠️ No messageId in FCM notification body`);
      return;
    }

    console.log(`[${context}] 📬 Processing messageId:`, messageId);

    const wallet = await getHeadlessWallet();
    if (!wallet) {
      console.warn(`[${context}] Could not reconstruct wallet from storage`);
      return
    }

    const messageBoxClient = new MessageBoxClient({
      enableLogging,
      host: 'https://messagebox.babbage.systems',
      walletClient: wallet
    });

    console.log(`[${context}] 🔍 Listing messages from notifications box...`);
    const messages = await messageBoxClient.listMessages({
      messageBox: 'notifications',
      host: 'https://messagebox.babbage.systems'
    });

    const targetMessage = messages.find(m => m.messageId === messageId);
    if (!targetMessage) {
      console.warn(`[${context}] ⚠️ Message ${messageId} not found in notifications box`);
      return;
    }

    console.log(`[${context}] 📬 Found target message:`, targetMessage);

    // await messageBoxClient.acknowledgeMessage({ messageIds: [messageId] });

    // Resolve identity of sender
    const identityClient = new IdentityClient(wallet);
    const [identity] = await identityClient.resolveByIdentityKey({ identityKey: targetMessage.sender });
    console.log(`[${context}] Resolved identity:`, identity);

    // Create notification with the actual message content
    const notification = {
      title: identity?.name || targetMessage.sender,
      body: typeof targetMessage.body === 'string'
        ? targetMessage.body
        : JSON.stringify(targetMessage.body),
      origin: targetMessage.sender || 'unknown',
      timestamp: Date.now(),
      data: {
        messageId: targetMessage.messageId,
        sender: targetMessage.sender,
        fcmMessageId: remoteMessage.messageId,
        from: remoteMessage.from
      }
    };

    await showLocalNotification(notification);
    console.log(`[${context}] ✅ Successfully processed FCM ${context} message`);
  } catch (error) {
    console.error(`[${context}] ❌ Error handling ${context} FCM message:`, error);
  }
}
async function makeWallet(chain, privateKey) {
  const keyDeriver = new CachedKeyDeriver(new PrivateKey(privateKey, 'hex'));
  const storageManager = new WalletStorageManager(keyDeriver.identityKey);
  const signer = new WalletSigner(chain, keyDeriver, storageManager);
  const services = new Services(chain);
  const wallet = new Wallet(signer, services);
  const client = new StorageClient(
    wallet,
    chain === 'test' ? 'https://staging-storage.babbage.systems' : 'https://storage.babbage.systems'
  );
  await client.makeAvailable();
  await storageManager.addWalletStorageProvider(client);
  return wallet;
}

function snap2privkey(snap) {
  console.log('[snap2privkey] Got snap', snap)
  const reader = new Utils.Reader(snap);
  const version = reader.readUInt8();
  console.log('[snap2privkey] Got version', version)

  let snapshotKey;
  let encryptedPayload;

  if (version === 1) {
    snapshotKey = reader.read(32);
    encryptedPayload = reader.read();
  } else if (version === 2) {
    snapshotKey = reader.read(32);
    reader.read(16) // Skip active profile ID
    encryptedPayload = reader.read();
  } else {
    throw new Error(`Unsupported snapshot version: ${version}`);
  }

  console.log('[snap2privkey] Got snapshotKey', snapshotKey)
  console.log('[snap2privkey] Got encryptedPayload', encryptedPayload)

  const decryptedPayload = new SymmetricKey(snapshotKey).decrypt(encryptedPayload);
  const payloadReader = new Utils.Reader(decryptedPayload);
  return Utils.toHex(payloadReader.read(32));
}

async function getHeadlessWallet() {
  try {
    console.log('[headless] Reconstructing wallet from storage...');
    let snapRaw;
    if (Platform.OS === 'ios') {
      snapRaw = await SharedGroupPreferences.getItem(SNAP_KEY, APP_GROUP)
    } else {
      snapRaw = await AsyncStorage.getItem(SNAP_KEY)
    }
    if (!snapRaw) {
      console.warn('[headless] No wallet snapshot found in storage');
      return null;
    }

    console.log('[headless] Got snap from storage', snapRaw)
    const privkey = snap2privkey(JSON.parse(snapRaw));
    console.log('[headless] Got privkey from snap');

    const wallet = await makeWallet('main', privkey);
    console.log('[headless] Got wallet', !!wallet);

    return wallet;
  } catch (error) {
    console.error('[headless] Failed to reconstruct wallet from storage:', error);
    return null;
  }
}

async function getFCMToken() {
  try {
    const token = await messaging().getToken();
    console.log('[headless] FCM Token:', token?.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('[headless] Failed to get FCM token..:', error);
    return null;
  }
}

async function showLocalNotification(notification) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: {
          origin: notification.origin,
          ...notification.data
        }
      },
      trigger: null
    });
    console.log('[headless] Local notification scheduled');
  } catch (error) {
    console.error('[headless] Failed to show local notification:', error);
  }
}

// Register the headless task
messaging().setBackgroundMessageHandler(async remoteMessage => {
  await processNotificationMessage(remoteMessage, 'background', true);
});

messaging().onMessage(async remoteMessage => {
  await processNotificationMessage(remoteMessage, 'foreground', false);
})

console.log('[headless] 🚀 FCM background handler registered at', new Date().toISOString());
(async () => {
  try {
    const wallet = await getHeadlessWallet();
    if (!wallet) {
      console.warn('[headless] Could not reconstruct wallet from storage')
      return
    }

    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      throw new Error('Push notifications permission denied')
    }

    // Get FCM token for debugging/backend registration
    const fcmToken = await getFCMToken();
    console.log('[headless] FCM Token:', fcmToken)
    const messageBoxClient = new MessageBoxClient({
      enableLogging: true,
      host: 'https://messagebox.babbage.systems',
      walletClient: wallet
    });

    // TODO: Handle errors
    await messageBoxClient.registerDevice({
      fcmToken,
      platform: Platform.OS
    }, 'https://messagebox.babbage.systems')
  } catch (error) {
    console.error('[headless] Error getting fcm token and registering device:', error)
  }
})()
