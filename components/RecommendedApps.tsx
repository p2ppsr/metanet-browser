import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Fuse from 'fuse.js';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';

interface App {
  domain: string;
  appName: string;
  appIconImageUrl?: string;
}

interface RecommendedAppsProps {
  setStartingUrl: (url: string) => void;
  includeBookmarks?: { title: string; url: string }[];
  hideHeader?: boolean;
  onRemoveBookmark?: (url: string) => void;
  onRemoveDefaultApp?: (url: string) => void;
  removedDefaultApps?: string[];
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
  hideHeader = false,
  onRemoveBookmark,
  onRemoveDefaultApp,
  removedDefaultApps = [],
}: RecommendedAppsProps) => {
  const { colors } = useTheme();
  const { recentApps } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);

  /* -------------------------- helper functions -------------------------- */
  const isBookmark = useCallback((app: App) => {
    // Check if it's in the actual bookmarks list
    return includeBookmarks.some(bookmark => bookmark.url === app.domain);
  }, [includeBookmarks]);

  const isDefaultApp = useCallback((app: App) => {
    // Check if it's one of the default apps
    return defaultApps.some(defaultApp => defaultApp.domain === app.domain);
  }, []);

  const handleLongPress = useCallback((app: App) => {
    // Allow removal of bookmarks OR default apps
    if ((isBookmark(app) || isDefaultApp(app)) && (onRemoveBookmark || onRemoveDefaultApp)) {
      setSelectedApp(app);
      setContextMenuVisible(true);
    }
  }, [isBookmark, isDefaultApp, onRemoveBookmark, onRemoveDefaultApp]);

  const handleDeleteBookmark = useCallback(() => {
    if (selectedApp) {
      if (isBookmark(selectedApp) && onRemoveBookmark) {
        onRemoveBookmark(selectedApp.domain);
      } else if (isDefaultApp(selectedApp) && onRemoveDefaultApp) {
        onRemoveDefaultApp(selectedApp.domain);
      }
    }
    setContextMenuVisible(false);
    setSelectedApp(null);
  }, [selectedApp, isBookmark, isDefaultApp, onRemoveBookmark, onRemoveDefaultApp]);

  const closeContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setSelectedApp(null);
  }, []);

  /* -------------------------- compose data sources -------------------------- */
  const allApps: App[] = useMemo(() => {
    const sources: App[] = [
      // Filter out removed default apps
      ...defaultApps.filter(app => !removedDefaultApps.includes(app.domain)),
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
  }, [includeBookmarks, recentApps, removedDefaultApps]);

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
      onLongPress={() => handleLongPress(item)}
      delayLongPress={800} // Increased from 500ms to 800ms
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
      {!hideHeader && (
      <Text style={[componentStyles.sectionTitle, { color: colors.textPrimary }]}>
        Bookmarks
      </Text>
      )}

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

      {/* Context Menu Modal */}
      <Modal
        transparent
        visible={contextMenuVisible}
        onRequestClose={closeContextMenu}
        animationType="fade"
      >
        <Pressable 
          style={componentStyles.contextMenuBackdrop}
          onPress={closeContextMenu}
        >
          <View style={[componentStyles.contextMenu, { backgroundColor: colors.background }]}>
            <View style={[componentStyles.contextMenuHeader, { borderBottomColor: colors.inputBorder }]}>
              <Text style={[componentStyles.contextMenuTitle, { color: colors.textPrimary }]}>
                {selectedApp?.appName}
              </Text>
              <Text style={[componentStyles.contextMenuUrl, { color: colors.textSecondary }]}>
                {selectedApp?.domain}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[componentStyles.contextMenuItem, { borderBottomColor: colors.inputBorder }]}
              onPress={handleDeleteBookmark}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" style={componentStyles.contextMenuIcon} />
              <Text style={[componentStyles.contextMenuText, { color: '#FF3B30' }]}>
                {selectedApp && isBookmark(selectedApp) ? 'Delete Bookmark' : 'Remove from Favorites'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[componentStyles.contextMenuItem, { borderBottomWidth: 0 }]}
              onPress={closeContextMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={22} color={colors.textSecondary} style={componentStyles.contextMenuIcon} />
              <Text style={[componentStyles.contextMenuText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    width: '30%',
    marginHorizontal: '1.5%',
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 14,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  // Context Menu Styles
  contextMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    borderRadius: 12,
    minWidth: 250,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contextMenuHeader: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contextMenuUrl: {
    fontSize: 12,
    opacity: 0.7,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextMenuIcon: {
    marginRight: 12,
  },
  contextMenuText: {
    fontSize: 16,
    flex: 1,
  },
});
