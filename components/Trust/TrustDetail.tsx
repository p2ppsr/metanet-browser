import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export type Permission = {
  id: string
  type: 'protocol' | 'identity' | 'basket' | 'spending'
  description: string
  grantedAt: string
  expiresAt?: string
}

export type TrustedOrigin = {
  id: string
  name: string
  domain: string
  icon?: string
  securityLevel: 'low' | 'medium' | 'high'
  added: string
  lastUsed?: string
  note?: string
  permissions: Permission[]
  events: { date: string; text: string }[]
  fullKey: string
}

type Props = {
  origin: TrustedOrigin
  onClose: () => void
  onRevoke: (id: string) => void
}

const TrustDetail: React.FC<Props> = ({ origin, onClose, onRevoke }) => {
  const { colors } = useTheme();

  // Group permissions by type for section list
  const grouped = origin.permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.type]) acc[p.type] = []
    acc[p.type].push(p)
    return acc
  }, {})

  const sections = Object.entries(grouped).map(([key, data]) => ({
    title: key[0].toUpperCase() + key.slice(1) + ' permissions',
    data
  }))

  return (
    <View style={[styles.container, { backgroundColor: colors.paperBackground }]}>      
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{origin.name}</Text>
          <Text style={[styles.domain, { color: colors.textSecondary }]}>{origin.domain}</Text>
        </View>
        <TouchableOpacity onPress={() => onRevoke(origin.id)} accessibilityRole="button" accessibilityLabel="Revoke trust">
          <Ionicons name="trash" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.meta, { color: colors.textSecondary }]}>Trusted {origin.added}</Text>
      {origin.lastUsed && (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>Last used {origin.lastUsed}</Text>
      )}
      {origin.note && (
        <Text style={[styles.note, { color: colors.textPrimary }]}>“{origin.note}”</Text>
      )}

      {/* full identity key */}
      <View style={styles.keyRow}>
        <Text style={[styles.fullKey, { color: colors.textSecondary, flex:1 }]} numberOfLines={1} ellipsizeMode="middle">{origin.fullKey}</Text>
        <TouchableOpacity onPress={() => Clipboard.setStringAsync(origin.fullKey)} accessibilityLabel="Copy identity key" style={{ paddingHorizontal:4 }}>
          <Ionicons name="copy" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.permissionRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.textPrimary, flex:1 }}>{item.description}</Text>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{section.title}</Text>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Recent activity</Text>
      {origin.events.map(ev => (
        <Text style={[styles.eventText, { color: colors.textSecondary }]} key={ev.date + ev.text}>• {ev.date}: {ev.text}</Text>
      ))}

      <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close details">
        <Text style={{ color: colors.buttonText }}>Close</Text>
      </TouchableOpacity>
    </View>
  )
}

export default TrustDetail;

const styles = StyleSheet.create({
  container: { borderRadius: 12, padding: 20, width: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 20, fontWeight: '700' },
  domain: { fontSize: 12 },
  meta: { fontSize: 12 },
  note: { fontSize: 14, fontStyle: 'italic', marginTop:4 },
  sectionHeader: { fontSize: 14, fontWeight: '600', marginTop: 16 },
  permissionRow: { flexDirection: 'row', alignItems: 'center' },
  keyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  fullKey: { fontSize: 10 },
  eventText: { fontSize: 12, marginTop: 4 },
  closeBtn: { alignSelf: 'flex-end', marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }
}); 