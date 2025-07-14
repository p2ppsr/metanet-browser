import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '@/context/theme/ThemeContext';
import type { PermissionType } from '@/utils/permissionsManager';

interface PermissionModalProps {
  visible: boolean;
  origin: string;
  permission: PermissionType;
  loading?: boolean;
  onAllow: () => void;
  onDeny: () => void;
  onDismiss: () => void;
}

// Maps PermissionType to user-friendly labels for the modal
const PERMISSION_LABELS: Record<PermissionType, string> = {
  notifications: 'Notifications',
  location: 'Location',
  camera: 'Camera',
  microphone: 'Microphone',
  'camera-microphone': 'Camera & Microphone',
  'pan-tilt-zoom': 'Pan-Tilt-Zoom',
  bluetooth: 'Bluetooth',
  usb: 'USB',
  midi: 'MIDI',
  'persistent-storage': 'Persistent Storage',
  nfc: 'NFC',
  'device-orientation': 'Device Orientation',
  'device-motion': 'Device Motion',
  fullscreen: 'Fullscreen',
  'clipboard-read': 'Clipboard Read',
  'clipboard-write': 'Clipboard Write',
  popup: 'Popup',
  'auto-download': 'Auto Download',
  'idle-detection': 'Idle Detection',
  vr: 'VR',
  'keyboard-lock': 'Keyboard Lock',
};

export default function PermissionModal({
  visible,
  origin,
  permission,
  loading,
  onAllow,
  onDeny,
  onDismiss,
}: PermissionModalProps) {
  const { colors } = useTheme();
  return (
    <Modal isVisible={visible} onBackdropPress={onDismiss} style={styles.modal}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>  
        <Text style={[styles.title, { color: colors.textPrimary }]}>Permission Request</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>The site <Text style={{ fontWeight: 'bold' }}>{origin}</Text> wants to access:</Text>
        <Text style={[styles.permission, { color: colors.primary }]}>{PERMISSION_LABELS[permission] || permission}</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success }]}
            onPress={onAllow}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>Allow</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.error }]}
            onPress={onDeny}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>Deny</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { justifyContent: 'center', alignItems: 'center' },
  container: {
    padding: 24,
    borderRadius: 12,
    minWidth: 280,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 15, marginBottom: 8, textAlign: 'center' },
  permission: { fontSize: 17, fontWeight: '600', marginBottom: 20 },
  buttons: { flexDirection: 'row', gap: 16 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginHorizontal: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
