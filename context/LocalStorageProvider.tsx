import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useMemo, useState } from 'react';

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

interface LocalStorageContextType {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    deleteItem: (key: string) => Promise<void>;
}

export const LocalStorageContext = createContext<LocalStorageContextType>({
    setItem: async (key: string, value: string) => {},
    getItem: async (key: string) => '',
    deleteItem: async (key: string) => {},
});

export const useLocalStorage = () => useContext(LocalStorageContext);

export default function LocalStorageProvider({ children }: { children: React.ReactNode }) {

    const setItem = async (key: string, value: string) => {
        try {
            await SecureDataStore.storeItem(key, value);
        } catch (error) {
            console.log({ error });
        }
    }

    const getItem = async (key: string) => {
        try {
            return await SecureDataStore.getItem(key);
        } catch (error) {
            console.log({ error });
            return null;
        }
    }

    const deleteItem = async (key: string) => {
        try {
            await SecureDataStore.deleteItem(key);
        } catch (error) {
            console.log({ error });
        }
    }

    return <LocalStorageContext.Provider value={{ setItem, getItem, deleteItem }}>{children}</LocalStorageContext.Provider>;
}
