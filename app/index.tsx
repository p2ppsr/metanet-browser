import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from '@/components/AppLogo';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet } from '@/context/WalletContext';

export default function LoginScreen() {
  // Get theme colors
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();
  const { managers } = useWallet();

  useEffect(() => {
    managers?.walletManager?.isAuthenticated({})
    .then(({ authenticated }) => {
      if (authenticated) {
        router.replace('/(tabs)/apps');
      }
    });
  }, [managers]);
  
  // Navigate to phone auth screen
  const handleGetStarted = () => {
    router.push('/auth/phone');
  };

  // Navigate to config screen
  const handleConfig = () => {
    router.push('/config');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
        <View style={styles.logoContainer}>
          <AppLogo />
        </View>
        
        <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>Metanet Mobile</Text>
        <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
          Secure BSV Blockchain Wallet
        </Text>
        
        <TouchableOpacity 
          style={[styles.getStartedButton, { backgroundColor: colors.primary }]} 
          onPress={handleGetStarted}
        >
          <Text style={[styles.getStartedButtonText, { color: colors.buttonText }]}>Get Started</Text>
        </TouchableOpacity>
        
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
        
        <TouchableOpacity 
          style={styles.configButton} 
          onPress={handleConfig}
        >
          <View style={styles.configIconContainer}>
            <Ionicons name="settings-outline" size={20} color={colors.secondary} />
            <Text style={styles.configButtonText}>Configure Providers</Text>
          </View>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  getStartedButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    padding: 10,
  },
  configIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  configButtonText: {
    color: '#0066cc',
    fontSize: 14,
    marginLeft: 2,
  },
  chevronIcon: {
    marginRight: 2,
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  },
});
