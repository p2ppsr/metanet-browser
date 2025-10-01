import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
import SharedGroupPreferences from 'react-native-shared-group-preferences'
import { Platform } from 'react-native'

export interface LocalStorageContextType {
  /* non-secure */
  setSnap: (snap: number[]) => Promise<void>
  getSnap: () => Promise<number[] | null>
  deleteSnap: () => Promise<void>

  /* secure */
  setPassword: (password: string) => Promise<void>
  getPassword: () => Promise<string | null>
  deletePassword: () => Promise<void>

  /* general */
  setItem: (item: string, value: string) => Promise<void>
  getItem: (item: string) => Promise<string | null>
  deleteItem: (item: string) => Promise<void>
}

const SNAP_KEY = 'snap'
const PASSWORD_KEY = 'password'

export const LocalStorageContext = createContext<LocalStorageContextType>({
  /* non-secure */
  setSnap: async () => {},
  getSnap: async () => null,
  deleteSnap: async () => {},

  /* secure */
  setPassword: async () => {},
  getPassword: async () => null,
  deletePassword: async () => {},

  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  deleteItem: AsyncStorage.removeItem
})

export const useLocalStorage = () => useContext(LocalStorageContext)

const APP_GROUP = 'group.app.metanet.explorer'

export default function LocalStorageProvider({ children }: { children: React.ReactNode }) {
  /* --------------------------------- SECURE -------------------------------- */

  // keep “am I already biometrically unlocked?” in memory for this session
  const [authenticated, setAuthenticated] = useState(false)
  const authInProgress = useRef<Promise<boolean> | null>(null)

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    // If we already asked this frame, reuse the same promise so we don’t show
    // the Face ID modal twice in parallel.
    if (authInProgress.current) return authInProgress.current

    const doAuth = async () => {
      if (authenticated) return true

      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to auto-fill your password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      })

      setAuthenticated(success)
      authInProgress.current = null // reset latch
      return success
    }

    authInProgress.current = doAuth()
    return authInProgress.current
  }, [authenticated])

  /* ------------------------------- non-secure ------------------------------ */

  const setSnap = useCallback(async (snap: number[]): Promise<void> => {
    try {
      const snapAsJSON = typeof snap === 'string' ? snap : JSON.stringify(snap)
      if (Platform.OS === 'ios') {
        await SharedGroupPreferences.setItem(SNAP_KEY, snapAsJSON, APP_GROUP)
      } else {
        await AsyncStorage.setItem(SNAP_KEY, snapAsJSON)
      }
    } catch (err) {
      console.warn('[setSnap]', err)
    }
  }, [])

  const getSnap = useCallback(async (): Promise<number[] | null> => {
    try {
      let raw: string | null
      if (Platform.OS === 'ios') {
        raw = await SharedGroupPreferences.getItem(SNAP_KEY, APP_GROUP)
      } else {
        raw = await AsyncStorage.getItem(SNAP_KEY)
      }
      return raw ? (JSON.parse(raw) as number[]) : null
    } catch (err) {
      console.warn('[getSnap]', err)
      return null
    }
  }, [])

  const deleteSnap = useCallback(async (): Promise<void> => {
    try {
      if (Platform.OS === 'ios') {
        await SharedGroupPreferences.setItem(SNAP_KEY, null, APP_GROUP)
      } else {
        await AsyncStorage.removeItem(SNAP_KEY)
      }
    } catch (err) {
      console.warn('[deleteSnap]', err)
    }
  }, [])

  /* -------------------------------- secure --------------------------------- */

  const setPassword = useCallback(async (password: string): Promise<void> => {
    try {
      // we don’t force auth for setting—iOS/Android will handle any keychain UI
      await SecureStore.setItemAsync(PASSWORD_KEY, password, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
      })
    } catch (err) {
      console.warn('[setPassword]', err)
    }
  }, [])

  const getPassword = useCallback(async (): Promise<string | null> => {
    try {
      if (!(await ensureAuth())) return null
      return await SecureStore.getItemAsync(PASSWORD_KEY)
    } catch (err) {
      console.warn('[getPassword]', err)
      return null
    }
  }, [ensureAuth])

  const deletePassword = useCallback(async (): Promise<void> => {
    try {
      if (!(await ensureAuth())) return
      await SecureStore.deleteItemAsync(PASSWORD_KEY)
    } catch (err) {
      console.warn('[deletePassword]', err)
    }
  }, [ensureAuth])

  /* -------------------------------- output --------------------------------- */

  const value: LocalStorageContextType = useMemo(
    () => ({
      /* non-secure */
      setSnap,
      getSnap,
      deleteSnap,

      /* secure */
      setPassword,
      getPassword,
      deletePassword,

      /* general */
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
      deleteItem: AsyncStorage.removeItem
    }),
    [setSnap, getSnap, deleteSnap, setPassword, getPassword, deletePassword]
  )

  return <LocalStorageContext.Provider value={value}>{children}</LocalStorageContext.Provider>
}
