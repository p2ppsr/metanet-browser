import { WalletInterface, PrivateKey, P2PKH, PublicKey, InternalizeActionArgs, CachedKeyDeriver, Utils, SymmetricKey } from '@bsv/sdk';
import { StorageClient, Services, Wallet, WalletSigner, WalletStorageManager } from '@bsv/wallet-toolbox-mobile';
import { MessageBoxClient } from '@bsv/message-box-client'

async function makeWallet(chain: 'main' | 'test', privateKey: string): Promise<WalletInterface> {
  const keyDeriver = new CachedKeyDeriver(new PrivateKey(privateKey, 'hex'));
  const storageManager = new WalletStorageManager(keyDeriver.identityKey);
  const signer = new WalletSigner(chain, keyDeriver, storageManager);
  const services = new Services(chain);
  const wallet = new Wallet(signer, services);
  const client = new StorageClient(
    wallet,
    // Hard-code storage URLs for now, but this should be configurable in the future along with the private key.
    chain === 'test' ? 'https://staging-storage.babbage.systems' : 'https://storage.babbage.systems'
  );
  await client.makeAvailable();
  await storageManager.addWalletStorageProvider(client);
  return wallet;
}

function snap2privkey(snap: string): string {
  const reader = new Utils.Reader(Utils.toArray(snap, 'base64'))
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

(window as any).run = async (snap: string, messageId: string) => {
  const key = snap2privkey(snap)
  console.log('got key out of snap')
  const wallet = makeWallet('main', key)
  console.log('got wallet', wallet)



  const messageBoxClient = new MessageBoxClient({
    enableLogging: true,
    walletClient: wallet
  })

  console.log('[headless] 🔍 Listing messages from notifications box...');
  const messages = await messageBoxClient.listMessages({
    messageBox: 'notifications'
  })

  const targetMessage = messages.find(m => m.messageId === messageId)
  if (!targetMessage) {
    console.warn(`[headless] ⚠️ Message ${messageId} not found in notifications box`)
    return
  }

  await messageBoxClient.acknowledgeMessage({ messageIds: [messageId] });

  const notification = {
    title: 'New Message',
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

  console.log('notification', notification)
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