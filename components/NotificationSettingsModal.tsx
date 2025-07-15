import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native'
import Modal from 'react-native-modal'
import { useTheme } from '@/context/theme/ThemeContext'
import {
  getDomainPermissions,
  setDomainPermission,
  resetDomainPermissions,
  PermissionType,
  PermissionState,
  DomainPermissions
} from '@/utils/permissionsManager'

const allPermissions: PermissionType[] = [
  'notifications',
  'location',
  'camera',
  'microphone',
  'camera-microphone',
  'pan-tilt-zoom',
  'bluetooth',
  'usb',
  'midi',
  'persistent-storage',
  'nfc',
  'device-orientation',
  'device-motion',
  'fullscreen',
  'clipboard-read',
  'clipboard-write',
  'popup',
  'auto-download',
  'idle-detection',
  'vr',
  'keyboard-lock'
]

interface PermissionsSettingsModalProps {
  visible: boolean
  onDismiss: () => void
  domain: string
}

export default function PermissionsSettingsModal({ visible, onDismiss, domain }: PermissionsSettingsModalProps) {
  const { colors } = useTheme()
  const [permissions, setPermissions] = React.useState<DomainPermissions>({})

  React.useEffect(() => {
    if (visible && domain) {
      getDomainPermissions(domain).then(setPermissions)
    }
  }, [visible, domain])

  // Derive summary directly from permissions state
  const summary = React.useMemo(() => {
    let allow = 0,
      deny = 0
    const setPermissionsCount = Object.keys(permissions).length
    for (const key in permissions) {
      if (permissions[key as PermissionType] === 'allow') allow++
      else if (permissions[key as PermissionType] === 'deny') deny++
    }
    const ask = allPermissions.length - setPermissionsCount
    return { allow, deny, ask }
  }, [permissions])

  const handleSetPermission = async (permission: PermissionType, state: PermissionState) => {
    await setDomainPermission(domain, permission, state)
    const newPerms = await getDomainPermissions(domain)
    setPermissions(newPerms)
  }

  const handleReset = async () => {
    await resetDomainPermissions(domain)
    setPermissions({})
  }

  const getLabel = (perm: PermissionType) => {
    switch (perm) {
      case 'notifications':
        return 'Notifications'
      case 'location':
        return 'Location'
      case 'camera':
        return 'Camera'
      case 'microphone':
        return 'Microphone'
      case 'camera-microphone':
        return 'Camera + Microphone'
      case 'pan-tilt-zoom':
        return 'Pan-Tilt-Zoom'
      case 'bluetooth':
        return 'Bluetooth'
      case 'usb':
        return 'USB'
      case 'midi':
        return 'MIDI'
      case 'persistent-storage':
        return 'Persistent Storage'
      case 'nfc':
        return 'NFC'
      case 'device-orientation':
        return 'Device Orientation'
      case 'device-motion':
        return 'Device Motion'
      case 'fullscreen':
        return 'Fullscreen'
      case 'clipboard-read':
        return 'Clipboard (Read)'
      case 'clipboard-write':
        return 'Clipboard (Write)'
      case 'popup':
        return 'Popup'
      case 'auto-download':
        return 'Auto Download'
      case 'idle-detection':
        return 'Idle Detection'
      case 'vr':
        return 'VR'
      case 'keyboard-lock':
        return 'Keyboard Lock'
      default:
        return perm
    }
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onDismiss}
      onSwipeComplete={onDismiss}
      swipeDirection="down"
      style={styles.modal}
      useNativeDriver={false}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.inputBorder }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Permissions</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Text style={[styles.closeText, { color: colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text
            style={[styles.sectionTitle, { color: colors.textSecondary }]}
          >{`Allowed: ${summary.allow} · Denied: ${summary.deny} · Ask: ${summary.ask}`}</Text>
          <FlatList
            data={allPermissions}
            keyExtractor={item => item}
            renderItem={({ item }) => {
              const state: PermissionState = permissions[item] || 'ask'
              return (
                <View style={[styles.permissionItem, { borderBottomColor: colors.inputBorder }]}>
                  <Text style={[styles.domainName, { color: colors.textPrimary }]}>{getLabel(item)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['allow', 'deny', 'ask'] as PermissionState[]).map(option => (
                      <TouchableOpacity
                        key={option}
                        style={{
                          marginHorizontal: 4,
                          padding: 6,
                          borderRadius: 6,
                          backgroundColor: state === option ? colors.primary : colors.inputBorder
                        }}
                        onPress={() => handleSetPermission(item, option)}
                      >
                        <Text
                          style={{
                            color: state === option ? colors.buttonText : colors.textPrimary,
                            fontWeight: '600'
                          }}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )
            }}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity
            style={[styles.clearAllButton, { backgroundColor: colors.inputBorder }]}
            onPress={handleReset}
          >
            <Text style={[styles.clearAllText, { color: colors.textPrimary }]}>Reset to Default</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 400
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  handle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center'
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  list: {
    flex: 1
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  permissionInfo: {
    flex: 1
  },
  domainName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  permissionStatus: {
    fontSize: 14,
    marginBottom: 2
  },
  permissionDate: {
    fontSize: 12
  },
  clearAllButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center'
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '500'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280
  }
})
