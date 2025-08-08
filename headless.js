/**
 * headless.js - React Native Firebase Headless Task Registration
 * This file registers the FCM background message handler for Android headless mode
 */

import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { MessageBoxClient } from '@bsv/message-box-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CachedKeyDeriver, PrivateKey, SymmetricKey, Utils } from '@bsv/sdk';
import { WalletStorageManager, WalletSigner, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-mobile';
import * as crypto from 'crypto'
global.self = { crypto }

const SNAP_KEY = 'snap';

// Helper functions (duplicated from fcmBackground.ts for headless isolation)
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

    const snapRaw = await AsyncStorage.getItem(SNAP_KEY);
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
  console.log('[headless] 📦 FCM background message received:', remoteMessage);
  try {
    const messageId = remoteMessage.notification?.body;

    if (!messageId) {
      console.warn('[headless] ⚠️ No messageId in FCM notification body');
      return;
    }

    console.log('[headless] 📬 Processing messageId:', messageId);

    const walletClient = await getHeadlessWallet();
    if (!walletClient) {
      console.warn('[headless] Could not reconstruct wallet from storage');
      return;
    }

    const messageBoxClient = new MessageBoxClient({
      enableLogging: true,
      host: 'https://f87ec6d5acf8.ngrok-free.app',
      walletClient
    });

    console.log('[headless] 🔍 Listing messages from notifications box...');
    const messages = await messageBoxClient.listMessages({
      messageBox: 'notifications'
    });

    const targetMessage = messages.find(m => m.messageId === messageId);
    if (!targetMessage) {
      console.warn(`[headless] ⚠️ Message ${messageId} not found in notifications box`);
      return;
    }

    await messageBoxClient.acknowledgeMessage({ messageIds: [messageId] });

    const notification = {
      title: remoteMessage.notification?.title || 'New Message',
      body: typeof targetMessage.body === 'string' ? targetMessage.body : JSON.stringify(targetMessage.body),
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
    console.log('[headless] ✅ Successfully processed FCM background message');
  } catch (error) {
    console.error('[headless] ❌ Error handling background FCM message:', error);
  }
});

messaging().onMessage(async remoteMessage => {
  console.log('📱 FCM foreground notification received:', remoteMessage)
  try {
    const wallet = await getHeadlessWallet();
    if (!wallet) {
      console.warn('[headless] Could not reconstruct wallet from storage');
      return;
    }
    // Extract messageId from FCM notification body
    const messageId = remoteMessage.notification?.body
    if (!messageId) {
      return
    }

    console.log('📬 Processing notification for messageId:', messageId)
    // Create MessageBoxClient and retrieve messages
    const messageBoxClient = new MessageBoxClient({
      walletClient: wallet,
      host: 'https://f87ec6d5acf8.ngrok-free.app'
    })

    console.log('🔍 Fetching messages from notification messageBox...')
    const messages = await messageBoxClient.listMessages({
      messageBox: 'notifications'
    })
    console.log('Found messages:', messages)

    // Find the specific message that triggered the notification
    const targetMessage = messages.find(message => message.messageId === messageId)

    if (!targetMessage) {
      console.warn(`⚠️ Message with ID ${messageId} not found in messageBox`)
      return
    }

    console.log('📬 Found target message:', targetMessage)

    // Acknowledge the specific message
    await messageBoxClient.acknowledgeMessage({
      messageIds: [messageId]
    })
    console.log('✅ Message acknowledged:', messageId)

    // TODO: Resolve identity of sender
    // const identityClient = new IdentityClient(wallet, )

    // Create notification with the actual message content
    const notification = {
      title: remoteMessage.notification?.title || 'New Message',
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
    }

    // Show local notification
    await showLocalNotification(notification)
  } catch (error) {
    console.error('❌ Error processing FCM notification:', error)
  }
})

console.log('[headless] 🚀 FCM background handler registered at', new Date().toISOString());
