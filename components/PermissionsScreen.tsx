import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, SectionList, Pressable } from 'react-native'
import { useTheme } from '@/context/theme/ThemeContext'
import { getDomainPermissions, setDomainPermission, PermissionState, PermissionType } from '@/utils/permissionsManager'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '@react-native-segmented-control/segmented-control'

// Group permissions by category for better organization
interface PermissionCategory {
  title: string
  data: PermissionType[]
}

// Define the most commonly used permissions grouped by category
const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    title: 'Media',
    data: ['CAMERA', 'RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO']
  },
  {
    title: 'Location',
    data: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION']
  },
  {
    title: 'Storage',
    data: ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']
  },
  {
    title: 'Contacts',
    data: ['READ_CONTACTS', 'WRITE_CONTACTS']
  },
  {
    title: 'Calendar',
    data: ['READ_CALENDAR', 'WRITE_CALENDAR']
  },
  {
    title: 'Phone',
    data: ['READ_PHONE_STATE', 'CALL_PHONE', 'READ_CALL_LOG', 'WRITE_CALL_LOG', 'READ_PHONE_NUMBERS', 'ANSWER_PHONE_CALLS']
  },
  {
    title: 'Sensors',
    data: ['BODY_SENSORS', 'ACTIVITY_RECOGNITION']
  },
  {
    title: 'Bluetooth',
    data: ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT', 'BLUETOOTH_ADVERTISE']
  }
]

// Flatten the categories to get all permissions for search/filter functionality
const ALL_PERMISSIONS: PermissionType[] = PERMISSION_CATEGORIES.reduce<PermissionType[]>(
  (acc, category) => [...acc, ...category.data],
  []
)

interface PermissionsScreenProps {
  origin: string
  onPermissionChange?: (permission: PermissionType, state: PermissionState) => void
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ origin, onPermissionChange }) => {
  console.log('[PermissionsScreen] Rendering component with origin:', origin)
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [permissions, setPermissions] = useState<Partial<Record<PermissionType, PermissionState>>>({})
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const fetchPermissions = useCallback(async () => {
    if (origin) {
      setLoading(true)
      const fetchedPerms = await getDomainPermissions(origin)
      console.log('[PermissionsScreen] Fetched permissions for', origin, fetchedPerms)

      // Create a default permissions object with 'ask' for all permissions
      const fullPermissions: Record<PermissionType, PermissionState> = {} as Record<PermissionType, PermissionState>
      ALL_PERMISSIONS.forEach(perm => {
        fullPermissions[perm] = fetchedPerms?.[perm] || 'ask'
      })

      // Set the complete permissions object
      setPermissions(fullPermissions)
      console.log('[PermissionsScreen] Complete permissions object with defaults:', fullPermissions)

      // By default, expand all categories to ensure content is visible
      const initialExpandedState: Record<string, boolean> = {}
      PERMISSION_CATEGORIES.forEach(category => {
        initialExpandedState[category.title] = true
      })
      console.log('[PermissionsScreen] Setting initial expanded categories:', initialExpandedState)
      setExpandedCategories(initialExpandedState)

      setLoading(false)
    } else {
      console.log('[PermissionsScreen] No origin provided, cannot fetch permissions')
      setLoading(false)
    }
  }, [origin])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const handleValueChange = (permission: PermissionType, value: string) => {
    const state = value.toLowerCase() as PermissionState
    console.log(`[PermissionsScreen] Setting ${permission} to ${state} for ${origin}`)
    
    // Update local state
    setPermissions(prev => ({ ...prev, [permission]: state }))
    
    // Save to storage
    setDomainPermission(origin, permission, state)
      .then(() => {
        console.log(`[PermissionsScreen] Successfully updated ${permission} to ${state}`)
        
        // Notify parent component (Browser) about the permission change
        if (onPermissionChange) {
          console.log(`[PermissionsScreen] Notifying parent about permission change: ${permission} -> ${state}`)
          onPermissionChange(permission, state)
        }
      })
      .catch(error => {
        console.error(`[PermissionsScreen] Error setting permission:`, error)
      })
  }

  // Format permission name for better readability
  const formatPermissionName = (permission: string) => {
    // First replace underscores with spaces and convert to title case
    const formatted = permission
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
      .replace('Media', '')
      .replace('Audio', 'Microphone')
      .replace('Record', 'Use')
      .replace('Camera', 'Camera')
      .replace('Access Fine Location', 'Precise Location')
      .replace('Access Coarse Location', 'Approximate Location')
      .trim()
    return formatted
  }

  if (!origin) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>
          {t('no_domain') || 'No domain specified'}
        </Text>
      </View>
    )
  }

  // Add debug info
  console.log('[PermissionsScreen] Current state before rendering:', {
    origin,
    loading,
    permissionCount: Object.keys(permissions).length,
    categoriesCount: PERMISSION_CATEGORIES.length,
    allPermCount: ALL_PERMISSIONS.length
  })

  // Transform categories into sections for SectionList
  const sectionsToRender = PERMISSION_CATEGORIES.map(category => {
    const permissionsInCategory = category.data
    const isExpanded = expandedCategories[category.title] ?? false
    console.log(`[PermissionsScreen] Category ${category.title} has ${permissionsInCategory.length} permissions, expanded: ${isExpanded}`)

    // Filter permissions to only those that exist in this domain or have defaults
    const availablePermissions = permissionsInCategory.filter(perm => {
      const exists = permissions.hasOwnProperty(perm)
      if (!exists) console.log(`[PermissionsScreen] Permission ${perm} does not exist in current permissions object`)
      return exists
    })

    console.log(`[PermissionsScreen] Category ${category.title} has ${availablePermissions.length} available permissions after filtering`)
    
    // Always include the category in sections, even when empty
    // If there are no permissions available for this category, exclude it entirely
    if (availablePermissions.length === 0) {
      return null
    }
    
    return {
      title: category.title,
      data: isExpanded ? availablePermissions : [],
      isExpanded: isExpanded // Add the expanded state for rendering
    }
  }).filter((section): section is {title: string, data: PermissionType[], isExpanded: boolean} => section !== null)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text
        style={[styles.origin, { color: colors.textSecondary, borderBottomColor: colors.inputBorder }]}
        numberOfLines={1}
      >
        {origin || 'Unknown Domain'}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : sectionsToRender.length === 0 ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, textAlign: 'center' }}>
            {t('no_permissions_found') || 'No permissions available for this domain'}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Text style={{ margin: 10, color: colors.textSecondary }}>
            {`${Object.keys(permissions).length} permissions found. Tap a category to expand/collapse.`}
          </Text>
          <SectionList
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            sections={sectionsToRender}
            keyExtractor={(item) => item}
            renderSectionHeader={({ section: { title } }) => {
              const isExpanded = expandedCategories[title] ?? false;
              return (
                <Pressable
                  onPress={() => setExpandedCategories(prev => ({ ...prev, [title]: !isExpanded }))}
                  style={[styles.sectionHeader, { backgroundColor: colors.inputBackground || '#f0f0f0' }]}
                >
                  <Text style={[styles.sectionHeaderText, { color: colors.textPrimary }]}>
                    {isExpanded ? '▼ ' : '▶ ' }
                    {title}
                  </Text>
                </Pressable>
              );
            }}
            renderItem={({ item: perm }) => {
              const state = permissions[perm] || 'ask'
              const selectedIndex = Math.max(['allow', 'ask', 'deny'].indexOf(state), 0)
              return (
                <View style={[styles.permissionRow, { backgroundColor: colors.background }]}>
                  <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                    {formatPermissionName(perm)}
                  </Text>
                  <SegmentedControl
                    values={[t('allow') || 'Allow', t('ask') || 'Ask', t('deny') || 'Deny']}
                    selectedIndex={selectedIndex}
                    onValueChange={value => handleValueChange(perm, value)}
                    tintColor={colors.buttonBackground}
                    fontStyle={{ color: colors.buttonText }}
                    activeFontStyle={{ color: colors.buttonText, fontWeight: '600' }}
                    style={{ width: 180 }}
                  />
                </View>
              )
            }}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.inputBorder,
                  marginLeft: 16
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={{ color: colors.textSecondary }}>
                  {t('no_permissions') || 'No permissions to display'}
                </Text>
              </View>
            }
            stickySectionHeadersEnabled={false}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1
  },
  header: {
    fontSize: 20, // Increased size
    fontWeight: '700', // Bolder
    textAlign: 'center',
    marginBottom: 8 // Added spacing
  },
  origin: {
    fontSize: 16, // Increased size
    textAlign: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc' // Explicit border color
  },
  sectionHeader: {
    paddingVertical: 10, // More padding
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4, // Added bottom margin
    borderRadius: 8,
    backgroundColor: '#f0f0f0', // Explicit background color
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700', // Bolder
    color: '#333' // Explicit text color
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // More padding
    paddingHorizontal: 16,
    borderBottomWidth: 1, // Added bottom border
    borderBottomColor: '#eee', // Light border color
    backgroundColor: 'white' // Explicit background color
  },
  permissionLabel: {
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
    color: '#333' // Explicit text color
  }
})

export default PermissionsScreen
