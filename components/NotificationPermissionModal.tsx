import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import Modal from 'react-native-modal'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme/ThemeContext'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface NotificationPermissionModalProps {
  visible: boolean
  origin: string
  onDismiss: () => void
  onResponse: (granted: boolean) => void
}

export default function NotificationPermissionModal({
  visible,
  origin,
  onDismiss,
  onResponse
}: NotificationPermissionModalProps) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { requestNotificationPermission, getPermission } = usePushNotifications()
  const [isRequesting, setIsRequesting] = useState(false)

  const domainName = React.useMemo(() => {
    try {
      const url = new URL(origin)
      return url.hostname
    } catch {
      return origin
    }
  }, [origin])

  const handleAllow = async () => {
    setIsRequesting(true)
    try {
      const permission = await requestNotificationPermission(origin)
      onResponse(permission === 'granted')
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      onResponse(false)
    } finally {
      setIsRequesting(false)
      onDismiss()
    }
  }

  const handleBlock = () => {
    onResponse(false)
    onDismiss()
  }

  // Check if permission was already granted/denied
  useEffect(() => {
    if (visible) {
      const currentPermission = getPermission(origin)
      if (currentPermission !== 'default') {
        onResponse(currentPermission === 'granted')
        onDismiss()
      }
    }
  }, [visible, origin, getPermission, onResponse, onDismiss])

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onDismiss}
      backdropOpacity={0.5}
      style={styles.modal}
      useNativeDriver
      hideModalContentWhileAnimating
    >
      <View style={[styles.container, { backgroundColor: colors.paperBackground }]}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.icon}>🔔</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('allow_notifications_question')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '600' }}>{domainName}</Text> {t('wants_to_send_notifications')}
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('can_send_notifications_about')}</Text>
          <View style={styles.featuresList}>
            <Text style={[styles.feature, { color: colors.textSecondary }]}>{t('breaking_news_updates')}</Text>
            <Text style={[styles.feature, { color: colors.textSecondary }]}>{t('messages_activity')}</Text>
            <Text style={[styles.feature, { color: colors.textSecondary }]}>{t('reminders_alerts')}</Text>
          </View>
          <Text style={[styles.note, { color: colors.textSecondary }]}>{t('change_in_settings')}</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.blockButton, { backgroundColor: colors.inputBorder }]}
            onPress={handleBlock}
            disabled={isRequesting}
          >
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{t('block')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.allowButton,
              {
                backgroundColor: colors.primary,
                opacity: isRequesting ? 0.7 : 1
              }
            ]}
            onPress={handleAllow}
            disabled={isRequesting}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              {isRequesting ? t('requesting') : t('allow')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20
  },
  container: {
    borderRadius: 16,
    padding: 0,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden'
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  icon: {
    fontSize: 28
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  description: {
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center'
  },
  featuresList: {
    marginBottom: 16
  },
  feature: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  buttons: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e1e1e1'
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  blockButton: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e1e1e1'
  },
  allowButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
