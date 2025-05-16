import { Utils } from '@bsv/sdk';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useState } from 'react';

const chunkSize = 1024;

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
        return await SecureStore.getItemAsync(key);
    }

    static async deleteItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
    }
}

interface LocalStorageContextType {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    deleteItem: (key: string) => Promise<void>;
    auth: (activelyRequestPermission?: boolean) => Promise<boolean>;
    setSnap: (snap: number[]) => Promise<void>;
    getSnap: () => Promise<number[] | null>;
    deleteSnap: () => Promise<void>;
    authenticated: boolean;
}

export const LocalStorageContext = createContext<LocalStorageContextType>({
    setItem: async (key: string, value: string) => {},
    getItem: async (key: string) => '',
    deleteItem: async (key: string) => {},
    auth: async (activelyRequestPermission?: boolean) => Promise.resolve(false),
    setSnap: async (snap: number[]) => {},
    getSnap: async () => null,
    deleteSnap: async () => {},
    authenticated: false,
});

export const useLocalStorage = () => useContext(LocalStorageContext);

export default function LocalStorageProvider({ children }: { children: React.ReactNode }) {
    const [authenticated, setAuthenticated] = useState<boolean>(false);

    const auth = useCallback(async (activelyRequestPermission: boolean = false) => {
        try {
            return true // TODO remove before release
            if (authenticated) return true;
            if (!activelyRequestPermission) return false;
            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to access sensitive data',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });
            if (authResult.success) {
                setAuthenticated(true);
                return true;
            } else {
                setAuthenticated(false);
                return false;
            }
        } catch (error) {
            setAuthenticated(false);
            return false;
        }
    }, [authenticated]);

    const setSnap = async (snap: number[]) => {
        try {
            let x = 0
            for (let offset = 0; offset < snap.length; offset += chunkSize) {
                const slice = Utils.toBase64(snap.slice(offset, offset + chunkSize))
                await setItem(`snap-${x}`, slice);
                x++
            }
        } catch (error) {
            console.log({ error });
        }
    }

    const setItem = async (key: string, value: string) => {
        try {
            await SecureDataStore.storeItem(key, value);
        } catch (error) {
            console.log({ error });
        }
    }

    const getSnap = async (): Promise<number[] | null> => {
        try {
            const authResult = await auth(false);
            if (!authResult) throw new Error('Not authenticated');
            let slice: string | null = 'snap'
            let x = 0
            let snap: number[] = []
            let bailout = 20
            while (slice && bailout > 0) {
                slice = await getItem(`snap-${x}`)
                if (slice === null) break;
                snap.push(...Utils.toArray(slice, 'base64'))
                x++
                bailout--
            }
            if (bailout === 0) {
                console.log('Avoid infinite loops, this data should not be more than 10KB');
                return null
            }
            if (snap.length === 0) return null
            return Utils.toArray(snap, 'base64')
        } catch (error) {
            console.log({ error });
            return null
        }
    }

    const getItem = async (key: string) => {
        try {
            const authResult = await auth(false);
            if (!authResult) throw new Error('Not authenticated');
            return await SecureDataStore.getItem(key);  
        } catch (error) {
            console.log({ error })
            return null;
        }
    }

    const deleteSnap = async (): Promise<void> => {
        try {
            const authResult = await auth(false);
            if (!authResult) throw new Error('Not authenticated');
            let slice: string | null = 'snap'
            let x = 0
            let bailout = 20
            while (slice && bailout > 0) {
                slice = await getItem(`snap-${x}`)
                if (slice === null) break;
                await SecureDataStore.deleteItem(`snap-${x}`);
                x++
                bailout--
            }
            if (bailout === 0) {
                console.warn('Avoid infinite loops, this data should not be more than 10KB');
            }
        } catch (error) {
            console.warn({ error });
        }
    }

    const deleteItem = async (key: string) => {
        try {
            await SecureDataStore.deleteItem(key);
        } catch (error) {
            console.warn({ error });
        }
    }

    return <LocalStorageContext.Provider value={{ auth, authenticated, setItem, getItem, setSnap, getSnap,deleteItem,deleteSnap }}>{children}</LocalStorageContext.Provider>;
}
