import "expo-crypto";
import "react-native-get-random-values";

import { KeyDeriver, P2PKH, PrivateKey, PublicKey, Random, Utils } from '@bsv/sdk';
import { Services, StorageClient, Wallet, WalletStorageManager } from '@bsv/wallet-toolbox-mobile';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useMemo, useState } from 'react';
import { Alert, Share } from 'react-native';

class SecureDataStore {
    /**
     * Stores sensitive data securely using Expo's secure store.
     * @param {string} key - The unique name under which the data is stored.
     * @param {string} value - The sensitive data to store.
     * @returns {Promise<void>} - Resolves when the data is stored.
     */
    static async storeItem(key: string, value: string): Promise<void> {
        await SecureStore.setItemAsync(key, value);
    }

  /**
   * Retrieves sensitive data after successful biometrics authentication.
   * @param {string} key - The name of the data to retrieve.
   * @returns {Promise<string | null>} - The stored data if authentication succeeds, null if the key doesn't exist, or throws an error if authentication fails.
   */
    static async getItem(key: string): Promise<string | null> {
        const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to access sensitive data',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });

        if (authResult.success) {
            return await SecureStore.getItemAsync(key);
        } else {
            throw new Error('Authentication failed');
        }
    }

    static async deleteItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
    }
}

interface KeyContextType {
    wallet: Wallet | null;
    storage: WalletStorageManager | null;
    authenticate: () => Promise<void>;
    logout: () => Promise<void>;
    addKey: (str: string) => Promise<void>;
    makePayment: (address: string, amount: number) => Promise<void>;
}

export const KeyContext = createContext<KeyContextType>({
    wallet: null,
    storage: null,
    authenticate: async () => {},
    logout: async () => {},
    addKey: async () => {},
    makePayment: async () => {},
});

export const useKeyContext = () => useContext(KeyContext);

export default function KeyProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [storage, setStorage] = useState<WalletStorageManager | null>(null);

    async function addKey(str: string) {
        try {
            const key = PrivateKey.fromHex(str);
            await SecureDataStore.storeItem('key', key.toHex());
        } catch (error) {
            console.log({ error });
        }
    };

      
    const makePayment = async (publicKey: string, amount: number) => {
        try {
            const w = wallet;
            if (!w) {
                throw new Error('Wallet not initialized');
            }
            console.log(`Sending ${amount} satoshis to ${publicKey}`);
            const derivationPrefix = Utils.toBase64(Random(8));
            const derivationSuffix = Utils.toBase64(Random(8));
            const counterparty = publicKey;
            // getPubkey for output
            const paymentOutput = await w.getPublicKey({
                protocolID: [2, '3241645161d8'],
                counterparty,
                keyID: derivationPrefix + ' ' + derivationSuffix,
            });
            // getInputs and pubkeyForChange
            console.log({ paymentOutput });
            const createActionRes = await w.createAction({
                description: 'mobile p2p payment',
                outputs: [{
                    lockingScript: new P2PKH().lock(PublicKey.fromString(paymentOutput.publicKey).toAddress()).toHex(),
                    satoshis: amount,
                    outputDescription: 'the funds',
                    customInstructions: JSON.stringify({
                        derivationPrefix,
                        derivationSuffix,
                        counterparty,
                        type: "BRC29"
                    })
                }],
                options: {
                    randomizeOutputs: false,
                    acceptDelayedBroadcast: false,
                }
            });
            console.log({ createActionRes });
        } catch (error) {
            console.error('Payment failed', error);
            Alert.alert('Payment failed', 'Please try again later.');
        }
    };
    
    async function authenticate() {
        try {
            let key
            // Try to retrieve the stored key with biometric authentication.
            const hexKey = await SecureDataStore.getItem('key');
            if (hexKey) {
                key = PrivateKey.fromHex(hexKey)
            } else {
                // Generate and store a new key with biometric access control.
                key = PrivateKey.fromRandom();
                const newKey = key.toHex();
                await SecureDataStore.storeItem('key', newKey);
                // prompt the user to copy the hex to clipboard and paste somewhere secure.
                Alert.alert('New key generated', 'Please copy this key to a secure location: ' + newKey);
                await Share.share({
                    message: newKey,
                });
            }

            const chain = 'main'
            const endpointUrl = 'https://storage.babbage.systems'
            const rootKey = key
            const keyDeriver = new KeyDeriver(rootKey)
            const identityKey = keyDeriver.identityKey
            const storage = new WalletStorageManager(identityKey)
            const services = new Services(chain)
            const wallet = new Wallet({
                chain,
                keyDeriver,
                storage,
                services,
                privilegedKeyManager: undefined,
            })
            const client = new StorageClient(wallet, endpointUrl)
            await storage.addWalletStorageProvider(client)
            await storage.makeAvailable()

            setWallet(wallet)
            setStorage(storage)
        } catch (error) {
            console.log({ error });
        }
    }

    const logout = async () => {
        try {
            await SecureDataStore.deleteItem('key');
            setWallet(null)
            setStorage(null)
        } catch (error) {
            console.log({ error });
        }
    }

    const value = useMemo(() => ({ addKey, makePayment, wallet, storage, authenticate, logout }), [wallet, storage]);

    return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}