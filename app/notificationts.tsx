import React, { useMemo, useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme/ThemeContext'
import { useThemeStyles } from '@/context/theme/useThemeStyles'
import { useWallet } from '@/context/WalletContext'
import { MessageBoxClient } from '@bsv/message-box-client'
import { IdentityClient } from '@bsv/sdk'

type NotificationItem = {
  id: string
  from: string
  handle?: string
  date: string
  amount?: string
  body: string
  avatar?: string // reserved for future image urls
  isSpam?: boolean
  read?: boolean
  status?: 'unread' | 'read' | 'archived'
  category?: 'priority' | 'spam'
  // New properties added here
  title?: string
  description?: string
  image?: string
}


export default function NotificationsScreen() {
  const { t } = useTranslation()
  const { colors, isDark } = useTheme()
  const themeStyles = useThemeStyles()
  const { managers } = useWallet()

  const [tab, setTab] = useState<'priority' | 'spam'>('priority')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch notifications from MessageBoxClient
  const fetchNotifications = useCallback(async () => {
    if (!managers?.permissionsManager || !managers?.walletManager) {
      setError('Wallet not available')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Get wallet instance from permissionsManager 
      const wallet = managers.permissionsManager
      const messageBoxClient = new MessageBoxClient({
        walletClient: wallet
      })
      
      const identityClient = new IdentityClient(wallet)
      
      const response = await messageBoxClient.listMessages({ 
        messageBox: 'notifications' 
      })
      
      // Transform PeerMessage[] to NotificationItem[] with identity resolution
      const transformedNotifications: NotificationItem[] = await Promise.all(
        response.map(async (message: any) => {
          let resolvedName = message.sender || 'Unknown'
          
          try {
            if (message.sender) {
              const [identity] = await identityClient.resolveByIdentityKey({ 
                identityKey: message.sender 
              })
              if (identity?.name) {
                resolvedName = identity.name
              }
            }
          } catch (identityError) {
            console.warn('Failed to resolve identity for', message.sender, identityError)
            // Fall back to using the sender key or 'Unknown'
          }
          
          return {
            id: message.messageId || Math.random().toString(),
            from: resolvedName,
            date: new Date(message.timestamp).toLocaleString(),
            body: typeof message.body === 'string' ? message.body : JSON.stringify(message.body),
            category: 'priority' as const,
            isSpam: false
          }
        })
      )
      
      setNotifications(transformedNotifications)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setError('Failed to load notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [managers?.permissionsManager, managers?.walletManager])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const data = useMemo(
    () =>
      notifications.filter(n => (tab === 'priority' ? !n.isSpam : n.isSpam)),
    [notifications, tab]
  )

  const onOpen = (item: NotificationItem) => {
    Alert.alert(t('open') || 'Open', `${item.from}: ${item.body}`)
  }

  const onAcknowledge = (item: NotificationItem) => {
    Alert.alert(t('acknowledged') || 'Acknowledged', `✔ ${item.from}`)
  }

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <View style={[styles.card, { backgroundColor: colors.paperBackground, borderColor: colors.textSecondary }]}>
      <View style={styles.rowTop}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '33' }]}>
          <MaterialIcons name="person" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerTextWrap}>
          <View style={styles.headerLine}>
            <Text style={[styles.fromText, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.from}
            </Text>
            {!!item.amount && (
              <Text style={[styles.amountText, { color: colors.textPrimary }]}>{item.amount}</Text>
            )}
          </View>
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.handle ? `${item.handle} • ${item.date}` : item.date}
          </Text>
        </View>
      </View>

      <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{item.body}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => onOpen(item)}
          style={[styles.pillBtn, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.pillText, { color: colors.textPrimary }]}>{t('open') || 'Open'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAcknowledge(item)}
          style={[styles.pillBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.pillText, { color: colors.buttonText }]}>{t('acknowledge') || 'Acknowledge'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={[themeStyles.container, { flex: 1 }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.fullContainer}>
          {/* Segmented control */}
          <View style={[styles.tabs, { backgroundColor: colors.paperBackground, borderColor: colors.textSecondary }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                tab === 'priority' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setTab('priority')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'priority' ? colors.buttonText : colors.textPrimary }
                ]}
              >
                {t('priority') || 'Priority'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                tab === 'spam' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setTab('spam')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'spam' ? colors.buttonText : colors.textPrimary }
                ]}
              >
                {t('spam') || 'Spam'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('loading_notifications') || 'Loading notifications...'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={fetchNotifications}
              >
                <Text style={[styles.retryButtonText, { color: colors.buttonText }]}>
                  {t('retry') || 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContent}>
              {data.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {tab === 'priority'
                    ? (t('no_priority_notifications') || 'No priority notifications.')
                    : (t('no_spam_notifications') || 'No spam notifications.')
                  }
                </Text>
              ) : (
                data.map((item, index) => (
                  <View key={item.id}>
                    {renderItem({ item })}
                    {index < data.length - 1 && <View style={{ height: 12 }} />}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  mockBanner: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 16
  },
  mockStripe: {
    height: 16,
    borderRadius: 8,
    marginVertical: 6
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    width: '100%',
    marginBottom: 16
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    flex: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600'
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16
  },
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  headerTextWrap: {
    flex: 1
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fromText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8
  },
  metaText: {
    fontSize: 13,
    marginTop: 2
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 12
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  pillBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    flex: 1
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
