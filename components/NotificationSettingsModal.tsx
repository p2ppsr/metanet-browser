import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Switch,
} from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '@/context/theme/ThemeContext';
import { usePushNotifications, NotificationPermission } from '@/hooks/usePushNotifications';

interface NotificationSettingsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function NotificationSettingsModal({
  visible,
  onDismiss,
}: NotificationSettingsModalProps) {
  const { colors } = useTheme();
  const { 
    permissions, 
    subscriptions, 
    unsubscribe, 
    clearAllPermissions,
    requestNotificationPermission 
  } = usePushNotifications();

  const getDomainName = (origin: string): string => {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return origin;
    }
  };

  const handleTogglePermission = async (permission: NotificationPermission) => {
    if (permission.permission === 'granted') {
      // Unsubscribe
      const success = await unsubscribe(permission.origin);
      if (success) {
        Alert.alert(
          'Notifications Disabled',
          `Notifications from ${getDomainName(permission.origin)} have been disabled.`
        );
      }
    } else {
      // Re-enable
      const result = await requestNotificationPermission(permission.origin);
      if (result === 'granted') {
        Alert.alert(
          'Notifications Enabled',
          `Notifications from ${getDomainName(permission.origin)} have been enabled.`
        );
      }
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'This will disable notifications from all websites. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllPermissions();
            Alert.alert('Success', 'All notification permissions have been cleared.');
          },
        },
      ]
    );
  };

  const renderPermissionItem = ({ item }: { item: NotificationPermission }) => {
    const isGranted = item.permission === 'granted';
    const hasSubscription = subscriptions.some(s => s.origin === item.origin);
    
    return (
      <View style={[styles.permissionItem, { borderBottomColor: colors.inputBorder }]}>
        <View style={styles.permissionInfo}>
          <Text style={[styles.domainName, { color: colors.textPrimary }]}>
            {getDomainName(item.origin)}
          </Text>
          <Text style={[styles.permissionStatus, { color: colors.textSecondary }]}>
            {isGranted ? (hasSubscription ? 'Active' : 'Allowed') : 'Blocked'}
          </Text>
          <Text style={[styles.permissionDate, { color: colors.textSecondary }]}>
            {new Date(item.granted).toLocaleDateString()}
          </Text>
        </View>
        <Switch
          value={isGranted && hasSubscription}
          onValueChange={() => handleTogglePermission(item)}
          trackColor={{ false: colors.inputBorder, true: colors.primary }}
          thumbColor={colors.background}
        />
      </View>
    );
  };

  const activePermissions = permissions.filter(p => p.permission !== 'default');

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
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Notification Settings
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
          >
            <Text style={[styles.closeText, { color: colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activePermissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>🔕</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No notification permissions
              </Text>
              <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                Websites that request notification permission will appear here
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Website Permissions ({activePermissions.length})
              </Text>
              <FlatList
                data={activePermissions}
                keyExtractor={(item) => item.origin}
                renderItem={renderPermissionItem}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
              
              <TouchableOpacity
                style={[styles.clearAllButton, { backgroundColor: colors.inputBorder }]}
                onPress={handleClearAll}
              >
                <Text style={[styles.clearAllText, { color: colors.textPrimary }]}>
                  Clear All Permissions
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  permissionInfo: {
    flex: 1,
  },
  domainName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  permissionStatus: {
    fontSize: 14,
    marginBottom: 2,
  },
  permissionDate: {
    fontSize: 12,
  },
  clearAllButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});