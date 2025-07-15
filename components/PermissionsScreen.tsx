import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTheme } from '@/context/theme/ThemeContext'
import { getDomainPermissions, setDomainPermission, PermissionState, PermissionType } from '@/utils/permissionsManager'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '@react-native-segmented-control/segmented-control'

const ALL_PERMISSIONS: PermissionType[] = ['camera', 'microphone', 'location', 'notifications']

interface PermissionsScreenProps {
  origin: string
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ origin }) => {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [permissions, setPermissions] = useState<Partial<Record<PermissionType, PermissionState>>>({})
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    if (origin) {
      setLoading(true)
      const perms = await getDomainPermissions(origin)
      setPermissions(perms)
      setLoading(false)
    }
  }, [origin])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const handleValueChange = (permission: PermissionType, value: string) => {
    const state = value.toLowerCase() as PermissionState
    setPermissions(prev => ({ ...prev, [permission]: state }))
    setDomainPermission(origin, permission, state)
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (!origin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: colors.textSecondary }}>{t('no_website_active')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { color: colors.textPrimary }]}>{t('permissions_for')}</Text>
      <Text
        style={[styles.origin, { color: colors.textSecondary, borderBottomColor: colors.inputBorder }]}
        numberOfLines={1}
      >
        {origin}
      </Text>
      {ALL_PERMISSIONS.map(perm => {
        const selectedIndex = ['allow', 'ask', 'deny'].indexOf(permissions[perm] || 'ask')
        return (
          <View key={perm} style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>{capitalize(perm)}</Text>
            <SegmentedControl
              values={[t('allow'), t('ask'), t('deny')]}
              selectedIndex={selectedIndex}
              onValueChange={value => handleValueChange(perm, value)}
              tintColor={colors.primary}
              style={{ width: 200 }}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  origin: {
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  permissionLabel: {
    fontSize: 17
  }
})

export default PermissionsScreen
