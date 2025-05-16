import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';

interface App {
  domain: string;
  appName: string;
  appIconImageUrl?: string;
}

const defaultApps: App[] = [
    { domain: 'https://p2pmnee.atx.systems', appName: 'P2PMNEE', appIconImageUrl: 'https://p2pmnee.atx.systems/p2m.png' }
];

export const RecommendedApps = ({ navigate }: { navigate: (url: string) => void }) => {
  const { colors } = useTheme();
  const { recentApps } = useWallet();

  // Filter out duplicates by domain, clean app names, and limit to 20 items
  const uniqueApps = [...defaultApps, ...recentApps].reduce((acc: App[], current) => {
    // Check if we already have an app with this domain
    const domainExists = acc.find(app => app.domain === current.domain);
    if (!domainExists) {
      // Clean up appName if it's a URL
      const cleanedApp = {
        ...current,
        appName: current.appName?.startsWith('http://') || current.appName?.startsWith('https://') ? 
          current.appName.replace(/^https?:\/\//, '') : current.appName
      };
      acc.push(cleanedApp);
    }
    return acc;
  }, []);
  
  // Limit to 20 items
  const apps = uniqueApps.slice(0, 20);

  const renderAppItem = ({ item }: { item: App }) => (
    <TouchableOpacity 
      style={componentStyles.appItem} 
      onPress={() => navigate(item.domain)}
    >
      {item.appIconImageUrl ? (
        <Image 
          source={{ uri: item.appIconImageUrl }} 
          style={componentStyles.appIcon} 
          defaultSource={{ uri: item.domain + '/favicon.ico' }}
        />
      ) : (
        <View style={[componentStyles.placeholderIcon, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.background, fontSize: 16 }}>{item.appName.charAt(0)}</Text>
        </View>
      )}
      <Text style={[componentStyles.appTitle, { color: colors.textPrimary }]}>{item.appName}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[componentStyles.container, { backgroundColor: colors.paperBackground }]}>
      <Text style={[componentStyles.sectionTitle, { color: colors.textPrimary }]}>Applications</Text>
      <FlatList
        data={apps}
        renderItem={renderAppItem}
        keyExtractor={(item) => item.domain}
        numColumns={3}
        key="grid"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={componentStyles.gridContainer}
      />
    </View>
  );
};

const componentStyles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  gridContainer: {
    paddingVertical: 8,
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
  appTitle: {
    fontSize: 14,
    textAlign: 'center',
  }
});