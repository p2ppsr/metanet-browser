import {
  WalletInterface,
  AuthFetch,
  ProtoWallet,
  PrivateKey,
  P2PKH,
  PublicKey,
  InternalizeActionArgs,
  CachedKeyDeriver,
  Utils,
  SymmetricKey,
  CompletedProtoWallet
} from '@bsv/sdk'
// import { StorageClient, Services, Wallet, WalletSigner, WalletStorageManager } from '@bsv/wallet-toolbox-mobile';
import { MessageBoxClient } from '@bsv/message-box-client'

// async function makeWallet(chain: 'main' | 'test', privateKey: string): Promise<WalletInterface> {
//   const keyDeriver = new CachedKeyDeriver(new PrivateKey(privateKey, 'hex'));
//   const storageManager = new WalletStorageManager(keyDeriver.identityKey);
//   const signer = new WalletSigner(chain, keyDeriver, storageManager);
//   const services = new Services(chain);
//   const wallet = new Wallet(signer, services);
//   const client = new StorageClient(
//     wallet,
//     // Hard-code storage URLs for now, but this should be configurable in the future along with the private key.
//     chain === 'test' ? 'https://staging-storage.babbage.systems' : 'https://storage.babbage.systems'
//   );
//   await client.makeAvailable();
//   await storageManager.addWalletStorageProvider(client);
//   return wallet;
// }

function snap2privkey(snap: string): string {
  const reader = new Utils.Reader(JSON.parse(snap))
  const version = reader.readUInt8()

  let snapshotKey: number[]
  let encryptedPayload: number[]

  if (version === 1) {
    snapshotKey = reader.read(32)
    encryptedPayload = reader.read()
  } else if (version === 2) {
    snapshotKey = reader.read(32)
    reader.read(16) // Skip active profile ID
    encryptedPayload = reader.read()
  } else {
    throw new Error(`Unsupported snapshot version: ${version}`)
  }

  // Decrypt payload
  const decryptedPayload = new SymmetricKey(snapshotKey).decrypt(encryptedPayload) as number[]
  const payloadReader = new Utils.Reader(decryptedPayload)

  // Read root primary key
  return Utils.toHex(payloadReader.read(32))
}

;(globalThis as any).run = async (snap: string, messageId: string) => {
  let key: string
  try {
    key = snap2privkey(snap)
  } catch (error) {
    console.error('error getting key from snap', error)
    return {
      title: 'New Message',
      body: `Error getting key from snap: ${error}`,
      origin: 'FOO',
      timestamp: Date.now(),
      data: {
        messageId: 'FOO',
        sender: 'FOO',
        fcmMessageId: messageId,
        from: 'fcm'
      }
    }
  }

  console.error('got key out of snap')
  // let wallet: WalletInterface
  // try {
  //   wallet = await makeWallet('main', key)
  // } catch (error) {
  //   console.error('error making wallet', error)
  //   return {
  //     title: 'New Message',
  //     body: `Error making wallet: ${error}`,
  //     origin: 'FOO',
  //     timestamp: Date.now(),
  //     data: {
  //       messageId: 'FOO',
  //       sender: 'FOO',
  //       fcmMessageId: messageId,
  //       from: 'fcm'
  //     }
  //   }
  // }
  // console.error('got wallet', wallet)

  let wallet: WalletInterface
  // try {
  console.error('key', key)
  wallet = new CompletedProtoWallet(new PrivateKey(key, 'hex'))
  //   const authFetch = new AuthFetch(wallet)
  //   const response = await authFetch.fetch('http://localhost:8080/listMessages', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ messageBox: 'notifications' })
  //   })
  //   let result = await response.json()
  //   if (result == null) {
  //     return {
  //       title: 'No Messages',
  //       body: 'null found',
  //       origin: 'Metanet',
  //       timestamp: Date.now(),
  //       data: {
  //         messageId: 'test',
  //         sender: 'test',
  //         fcmMessageId: messageId,
  //         from: 'fcm'
  //       }
  //     }
  //   }
  //   console.error('result', result)
  //   return {
  //     title: 'New Message',
  //     body: `result.status: ${result.status}`,
  //     origin: 'Metanet',
  //     timestamp: Date.now(),
  //     data: {
  //       messageId: 'test',
  //       sender: 'test',
  //       fcmMessageId: 'test',
  //       from: 'fcm'
  //     }
  //   }
  // } catch (error) {
  //   console.error('error making wallet', error)
  //   console.error('stack', (error as any).stack)
  //   return {
  //     title: 'New Message',
  //     body: `Error making wallet: ${error}`,
  //     origin: 'FOO',
  //     timestamp: Date.now(),
  //     data: {
  //       messageId: 'FOO',
  //       sender: 'FOO',
  //       fcmMessageId: 'messageId',
  //       from: 'fcm'
  //     }
  //   }
  // }
  // console.error('got wallet', wallet)

  const messageBoxClient = new MessageBoxClient({
    enableLogging: true,
    walletClient: wallet,
    host: 'https://messagebox.babbage.systems'
  })

  console.error('[headless] 🔍 Listing messages from notifications box...')
  const messages = await messageBoxClient.listMessagesLite({
    messageBox: 'notifications',
    host: 'https://messagebox.babbage.systems'
  })

  const targetMessage = messages.find(m => m.messageId === messageId)
  if (!targetMessage) {
    console.warn(`[headless] ⚠️ Message ${messageId} not found in notifications box`)
    return null
  }

  // await messageBoxClient.acknowledgeMessage({ messageIds: [messageId], host: 'http://localhost:8080' });

  const notification = {
    title: targetMessage.sender,
    body: typeof targetMessage.body === 'string' ? targetMessage.body : JSON.stringify(targetMessage.body),
    origin: targetMessage.sender || 'unknown',
    timestamp: Date.now(),
    data: {
      messageId: targetMessage.messageId,
      sender: targetMessage.sender,
      fcmMessageId: messageId,
      from: 'fcm'
    }
  }

  // const identityKey = (await wallet.getPublicKey({ identityKey: true })).publicKey

  // const notification = {
  //   title: 'New Message',
  //   body: `Identity key: ${identityKey}`,
  //   origin: 'FOO',
  //   timestamp: Date.now(),
  //   data: {
  //     messageId: 'FOO',
  //     sender: 'FOO',
  //     fcmMessageId: messageId,
  //     from: 'fcm'
  //   }
  // }
  // console.error('notification', notification)
  return notification
}

/*
let context = JSContext()!
let bundle = try String(contentsOfFile: "wallet-bundle.js")
context.evaluateScript(bundle)
let run = context.objectForKeyedSubscript("WalletBundle")
                 .forProperty("run")
run?.call(withArguments: [snapString, messageId])

*/
