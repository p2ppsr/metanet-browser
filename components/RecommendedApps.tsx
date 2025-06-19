import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
} from 'react-native';
import Fuse from 'fuse.js';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';

interface App {
  domain: string;
  appName: string;
  appIconImageUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*                            DEFAULT RECOMMENDED                             */
/* -------------------------------------------------------------------------- */

const defaultApps: App[] = [
  {
    domain: 'https://p2pmnee.atx.systems',
    appName: 'P2PMNEE',
    appIconImageUrl: 'https://p2pmnee.atx.systems/p2m.png',
  },
  {
    domain: 'https://metanetstatus.lovable.app',
    appName: 'Metanet Status',
    appIconImageUrl: 'https://metanetstatus.lovable.app/favicon.ico',
  },
  {
    domain: 'https://todo.metanet.app',
    appName: 'My ToDo List',
    appIconImageUrl: 'https://todo.metanet.app/favicon.ico',
  },
  {
    domain: 'https://peerpay.babbage.systems',
    appName: 'PeerPay',
    appIconImageUrl: 'https://peerpay.babbage.systems/favicon.ico',
  },
  {
    domain: 'https://mountaintops.net',
    appName: 'Mountaintops',
    appIconImageUrl: 'https://mountaintops.net/favicon.ico',
  },
  {
    domain: 'https://metanetacademy.com',
    appName: 'Metanet Academy',
    appIconImageUrl: 'https://metanetacademy.com/favicon.ico',
  },
  {
    domain: 'https://coinflip.babbage.systems',
    appName: 'Coinflip Friend',
    appIconImageUrl: 'https://coinflip.babbage.systems/favicon.ico',
  },
];

/* -------------------------------------------------------------------------- */
/*                         RECOMMENDED APPS COMPONENT                         */
/* -------------------------------------------------------------------------- */

export const RecommendedApps = ({
  setStartingUrl,
  includeBookmarks = [],
}: {
  setStartingUrl: (url: string) => void;
  includeBookmarks?: { title: string; url: string }[];
}) => {
  const { colors } = useTheme();
  const { recentApps } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');

  /* -------------------------- compose data sources -------------------------- */
  const allApps: App[] = useMemo(() => {
    const sources: App[] = [
      ...defaultApps,
      ...recentApps.map(a => ({ ...a, appIconImageUrl: a.appIconImageUrl })),
      ...includeBookmarks.map(bm => ({
        domain: bm.url,
        appName: bm.title || bm.url,
        appIconImageUrl: `${bm.url.replace(/\/$/, '')}/favicon.ico`,
      })),
    ];

    // deduplicate by domain
    return sources.reduce<App[]>((acc, cur) => {
      if (!acc.find(a => a.domain === cur.domain)) acc.push(cur);
      return acc;
    }, []);
  }, [includeBookmarks, recentApps]);

  /* ---------------------------- fuzzy searching ---------------------------- */
  const fuse = useMemo(() => {
    return new Fuse(allApps, {
      keys: ['appName', 'domain'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [allApps]);

  const visibleApps = useMemo(() => {
    if (!searchQuery.trim()) return allApps;
    return fuse.search(searchQuery).map(r => r.item);
  }, [allApps, fuse, searchQuery]);

  /* ------------------------------- render ---------------------------------- */
  const renderAppItem = ({ item }: { item: App }) => (
    <TouchableOpacity
      style={componentStyles.appItem}
      onPress={() => setStartingUrl(item.domain)}
    >
      {item.appIconImageUrl ? (
        <Image
          source={{ uri: item.appIconImageUrl }}
          style={componentStyles.appIcon}
          defaultSource={{ uri: item.domain + '/favicon.ico' }}
        />
      ) : (
        <View
          style={[
            componentStyles.placeholderIcon,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={{ color: colors.background, fontSize: 16 }}>
            {item.appName.charAt(0)}
          </Text>
        </View>
      )}
      <Text style={[componentStyles.appTitle, { color: colors.textPrimary }]}>
        {item.appName}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[componentStyles.container, { backgroundColor: colors.paperBackground }]}>
      <Text style={[componentStyles.sectionTitle, { color: colors.textPrimary }]}>
        Bookmarks
      </Text>

      <View style={componentStyles.searchContainer}>
        <TextInput
          style={[
            componentStyles.searchInput,
            {
              color: colors.textPrimary,
              backgroundColor: colors.inputBackground || colors.background,
              borderColor: colors.inputBorder,
            },
          ]}
          placeholder="Search bookmarks…"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={visibleApps}
        renderItem={renderAppItem}
        keyExtractor={item => item.domain}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                    CSS                                     */
/* -------------------------------------------------------------------------- */

const componentStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  searchContainer: { marginBottom: 16 },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  appItem: {
    alignItems: 'center',
    marginBottom: 16,
    flex: 1,
    margin: 4,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginBottom: 8,
  },
  placeholderIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: { fontSize: 14, textAlign: 'center' },
});
