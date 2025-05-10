import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { WalletContext } from '../context/WalletContext';
import { router } from 'expo-router';

export default function LoginScreen() {
  const walletContext = useContext(WalletContext);
  
  // Handle login button press
  const handleLogin = () => {
    // In a real app, you would trigger actual wallet authentication here
    console.log('Login button pressed');
    
    // TODO: Replace with actual authentication
    // For now, we can navigate to the apps tab to simulate login
    router.replace('/apps');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.welcomeTitle}>Welcome to Metanet Mobile</Text>
        <Text style={styles.welcomeText}>Sign in to access your wallet and apps</Text>
        
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  loginButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
