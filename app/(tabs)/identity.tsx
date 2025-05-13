import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Clipboard, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet } from '@/context/WalletContext';

export default function IdentityScreen() {
  // Get theme colors
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();
  const { managers, adminOriginator } = useWallet();
  const [identityKey, setIdentityKey] = React.useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setString(identityKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function getIdentityKey() {
      const response = await managers?.permissionsManager?.getPublicKey({ identityKey: true }, adminOriginator)
      if (response) {
        setIdentityKey(response.publicKey)
      }
    }
    getIdentityKey()
  }, [managers, adminOriginator])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Identity</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Manage your digital identity and credentials.
        </Text>
        <View style={styles.keyContainer}>
          <Text style={[styles.keyText, { color: colors.textSecondary, backgroundColor: colors.paperBackground }]} numberOfLines={1} ellipsizeMode="middle">
            {identityKey}
          </Text>
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: colors.paperBackground }]}
            onPress={handleCopy}
            disabled={copied}
          >
            <MaterialIcons
              name={copied ? 'check' : 'content-copy'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  keyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  keyText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
