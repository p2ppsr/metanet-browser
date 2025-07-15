import AsyncStorage from '@react-native-async-storage/async-storage'
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions'

/**
 * Defines the types of permissions a website can request.
 */
export type PermissionType =
  | 'notifications'
  | 'location'
  | 'camera'
  | 'microphone'
  | 'camera-microphone'
  | 'pan-tilt-zoom'
  | 'bluetooth'
  | 'usb'
  | 'midi'
  | 'persistent-storage'
  | 'nfc'
  | 'device-orientation'
  | 'device-motion'
  | 'fullscreen'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'popup'
  | 'auto-download'
  | 'idle-detection'
  | 'vr'
  | 'keyboard-lock'

/**
 * Represents the state of a given permission: granted, denied, or requires a prompt.
 */
export type PermissionState = 'allow' | 'deny' | 'ask'

/**
 * A record of permission states for a specific domain.
 */
export type DomainPermissions = Partial<Record<PermissionType, PermissionState>>

/**
 * The shape of the entire permissions store, mapping domains to their permissions.
 */
export interface PermissionsStore {
  [domain: string]: DomainPermissions
}

const STORAGE_KEY = 'PERMISSIONS_STORE_V1'

/**
 * Retrieves the entire permissions store from AsyncStorage.
 * @returns {Promise<PermissionsStore>} The permissions store object.
 */
export async function getPermissionsStore(): Promise<PermissionsStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Basic validation to ensure it's an object
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed
    }
    return {}
  } catch (error) {
    console.error('Failed to get permissions store:', error)
    return {} // Return empty object on error
  }
}

/**
 * Saves the entire permissions store to AsyncStorage.
 * @param {PermissionsStore} store - The permissions store to save.
 */
export async function setPermissionsStore(store: PermissionsStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    console.error('Failed to set permissions store:', error)
  }
}

/**
 * Gets all permissions for a specific domain.
 * @param {string} domain - The domain to retrieve permissions for.
 * @returns {Promise<DomainPermissions>} An object of permissions for the domain.
 */
export async function getDomainPermissions(domain: string): Promise<DomainPermissions> {
  const store = await getPermissionsStore()
  return store[domain] || {}
}

/**
 * Sets the state for a specific permission on a given domain.
 * @param {string} domain - The domain to set the permission for.
 * @param {PermissionType} permission - The permission type.
 * @param {PermissionState} state - The new state for the permission.
 */
export async function setDomainPermission(
  domain: string,
  permission: PermissionType,
  state: PermissionState
): Promise<void> {
  try {
    const store = await getPermissionsStore()
    if (!store[domain]) {
      store[domain] = {}
    }
    store[domain][permission] = state
    await setPermissionsStore(store)
  } catch (error) {
    console.error(`Failed to set permission ${permission} for ${domain}:`, error)
  }
}

/**
 * Resets all permissions for a specific domain.
 * @param {string} domain - The domain whose permissions will be reset.
 */
export async function resetDomainPermissions(domain: string): Promise<void> {
  try {
    const store = await getPermissionsStore()
    if (store[domain]) {
      delete store[domain]
      await setPermissionsStore(store)
    }
  } catch (error) {
    console.error(`Failed to reset permissions for ${domain}:`, error)
  }
}

/**
 * Resets the entire permissions store for all domains.
 */
export async function resetAllPermissions(): Promise<void> {
  await setPermissionsStore({})
}

/**
 * Gets the current state of a single permission for a domain.
 * @param {string} domain - The domain to check.
 * @param {PermissionType} permission - The permission to check.
 * @returns {Promise<PermissionState>} The current state of the permission.
 */
export async function getPermissionState(domain: string, permission: PermissionType): Promise<PermissionState> {
  const domainPerms = await getDomainPermissions(domain)
  return domainPerms[permission] || 'ask'
}

export async function checkCameraPermissionForDomain(domain: string) {
  // const sitePerms = getSitePermission(domain)
  /*
  if (!sitePerms.camera) return false

  const osPermission = await check(PERMISSIONS.ANDROID.CAMERA)
  if (osPermission !== RESULTS.GRANTED) {
    const result = await request(PERMISSIONS.ANDROID.CAMERA)
    return result === RESULTS.GRANTED
  }

  return true
  */
}
