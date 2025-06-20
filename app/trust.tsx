import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { Ionicons } from '@expo/vector-icons';
import TrustDetail, { TrustedOrigin, Permission } from '@/components/Trust/TrustDetail';
import TrustThresholdCard from '@/components/Trust/TrustThresholdCard';
import CertifierCard, { Certifier } from '@/components/Trust/CertifierCard';

type TrustedItem = TrustedOrigin

export default function TrustScreen() {
  // Get theme colors
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();

  // Dummy placeholder data until real data is wired in
  const [items, setItems] = useState<TrustedItem[]>([
    {
      id: '1',
      name: 'PeerPay',
      domain: 'peerpay.babbage.systems',
      icon: 'https://peerpay.babbage.systems/favicon.ico',
      added: '2025-06-18',
      securityLevel: 'medium',
      lastUsed: '2025-06-19',
      note: 'Payment app',
      permissions: [
        { id: 'p1', type: 'protocol', description: 'Payment protocol v1', grantedAt: '2025-06-18' }
      ],
      events: [
        { date: '2025-06-19', text: 'Signed payment tx' }
      ],
      fullKey: '03daf81sfe3f83da0ad3b5bedc520aa488aef5cbc939a3c67a7fe604d6cbffe8'
    },
    {
      id: '2',
      name: 'Metanet Academy',
      domain: 'metanetacademy.com',
      icon: 'https://metanetacademy.com/favicon.ico',
      added: '2025-06-17',
      securityLevel: 'low',
      permissions: [
        { id: 'p2', type: 'identity', description: 'Identity resolution', grantedAt: '2025-06-17' }
      ],
      events: [],
      fullKey: '02cfcd...6cfd4a17'
    }
  ])

  // Dummy certifiers list
  const [certifiers, setCertifiers] = useState<Certifier[]>([
    {
      id: 'c1', name: 'Metanet Trust Services', domain: 'trust.metanet', description: 'Registry for protocols, baskets, and certificates types', verified: true, icon: undefined, trustLevel: 4, maxTrust: 10, fullKey: '03daf81sfe3f83da0ad3b5bedc520aa488aef5cbc939a3c67a7fe604d6cbffe8', permissions: []
    }
  ])

  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.domain.toLowerCase().includes(q));
  }, [items, query]);

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // detail modal state
  const [selected, setSelected] = useState<TrustedOrigin | null>(null);

  const closeModal = () => setSelected(null);

  const renderItem = ({ item }: { item: TrustedItem }) => (
    <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.7} style={[styles.card, { borderColor: colors.inputBorder }]}>      
      {item.icon ? (
        <Image source={{ uri: item.icon }} style={styles.icon} />
      ) : (
        <View style={[styles.placeholderIcon, { backgroundColor: colors.primary }]}>          
          <Text style={{ color: colors.background, fontWeight: '700' }}>{item.name[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.itemDomain, { color: colors.textSecondary }]} numberOfLines={1}>{item.domain}</Text>
        <Text style={[styles.itemAdded, { color: colors.textSecondary }]}>Trusted {item.added}</Text>
      </View>
      <TouchableOpacity onPress={() => removeItem(item.id)}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  )

  const changeTrust = (id: string, val: number) => {
    setCertifiers(prev => prev.map(c => c.id === id ? { ...c, trustLevel: val } : c));
  }
  const removeCertifier = (id: string) => setCertifiers(prev => prev.filter(c => c.id !== id));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Trusted Origins</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>Manage your trust relationships and certifier network.</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder="Search trusted origins…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={{ color: colors.textSecondary }}>No trusted origins yet.</Text>
          </View>
        )}
      />

      {/* threshold card & certifiers */}
      <FlatList
        data={certifiers}
        keyExtractor={c => c.id}
        ListHeaderComponent={() => (
          <TrustThresholdCard totalPoints={10} threshold={2} onChange={() => {}} />
        )}
        renderItem={({ item }) => (
          <CertifierCard cert={item} onChangeTrust={changeTrust} onRemove={removeCertifier} />
        )}
        contentContainerStyle={{ padding: 16 }}
      />

      {/* detail modal */}
      {selected && (
        <View style={styles.modalOverlay}>
          <TrustDetail
            origin={selected}
            onClose={closeModal}
            onRevoke={(id) => removeItem(id)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  desc: { fontSize: 12, marginBottom: 12 },
  searchInput: { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 8 },
  icon: { width: 32, height: 32, borderRadius: 6, marginRight: 12 },
  placeholderIcon: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '600' },
  itemDomain: { fontSize: 12 },
  itemAdded: { fontSize: 10 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
});
