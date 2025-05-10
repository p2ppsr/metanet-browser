import React, { useState, useContext } from 'react';
import { 
  View, 
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { WalletContext, WABConfig } from '@/context/WalletContext';
import { DEFAULT_WAB_URL, DEFAULT_STORAGE_URL } from '@/context/config';

// Define types for config
type PhoneVerifier = 'Twilio' | 'Persona';
type BsvNetwork = 'mainnet' | 'testnet';

const ConfigScreen = () => {
  // Access theme
  const { colors, isDark } = useTheme();
  const styles = useThemeStyles();
  const { finalizeConfig } = useContext(WalletContext);
  
  // State for configuration
  const [wabUrl, setWabUrl] = useState(DEFAULT_WAB_URL);
  const [phoneVerifier, setPhoneVerifier] = useState<PhoneVerifier>('Twilio');
  const [network, setNetwork] = useState<BsvNetwork>('mainnet');
  const [storageUrl, setStorageUrl] = useState(DEFAULT_STORAGE_URL);
  
  // Validation
  const isUrlValid = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  const isFormValid = () => {
    return isUrlValid(wabUrl) && isUrlValid(storageUrl);
  };
  
  // Handle save and continue
  const handleSaveConfig = () => {
    if (!isFormValid()) {
      Alert.alert('Invalid Configuration', 'Please ensure both URLs are valid.');
      return;
    }
    
    // Construct the WAB config
    const wabConfig: WABConfig = {
      wabUrl,
      wabInfo: {
        phoneVerifier
      },
      method: phoneVerifier.toLowerCase(),
      network: network === 'mainnet' ? 'main' : 'test',
      storageUrl
    };
    
    // Save the configuration
    if (finalizeConfig) {
      const success = finalizeConfig(wabConfig);
      if (success) {
        console.log('Configuration saved successfully');
        router.push('/auth/phone');
      } else {
        Alert.alert('Configuration Error', 'Failed to save configuration. Please try again.');
      }
    } else {
      console.log('Configuration would be saved:', wabConfig);
      router.push('/auth/phone');
    }
  };
  
  // Handle cancellation - return to welcome screen
  const handleCancel = () => {
    router.back();
  };
  
  // Render a selectable chip
  const renderChip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      style={[
        styles.row,
        {
          padding: 12,
          borderRadius: 20,
          marginRight: 10,
          marginBottom: 5,
          backgroundColor: selected ? colors.secondary : colors.inputBackground,
          borderWidth: 1,
          borderColor: selected ? colors.secondary : colors.inputBorder,
        }
      ]}
      onPress={onPress}
    >
      {selected && (
        <Ionicons 
          name="checkmark-circle" 
          size={18} 
          color={isDark ? colors.background : colors.buttonText} 
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={[styles.text, { color: selected ? (isDark ? colors.background : colors.buttonText) : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <Text style={[styles.title, { textAlign: 'left' }]}>Configuration</Text>
            
            {/* WAB Configuration */}
            <View style={styles.card}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                Wallet Authentication Backend (WAB)
              </Text>
              <Text style={[styles.textSecondary, { marginBottom: 15 }]}>
                Provides 2 of 3 backup and recovery functionality for your root key.
              </Text>
              
              <Text style={styles.inputLabel}>WAB URL</Text>
              <View style={styles.input}>
                <TextInput
                  style={styles.inputText}
                  value={wabUrl}
                  onChangeText={setWabUrl}
                  placeholder="Enter WAB URL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              
              {/* Phone Verification Service */}
              <Text style={[styles.inputLabel, { marginTop: 15 }]}>
                Service which will be used to verify your phone number
              </Text>
              <View style={[styles.row, { flexWrap: 'wrap', marginVertical: 10 }]}>
                {renderChip('Twilio', phoneVerifier === 'Twilio', () => setPhoneVerifier('Twilio'))}
                {renderChip('Persona', phoneVerifier === 'Persona', () => setPhoneVerifier('Persona'))}
              </View>
            </View>
            
            {/* Network Configuration */}
            <View style={[styles.card, { marginTop: 15 }]}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                BSV Network
              </Text>
              
              <View style={[styles.row, { flexWrap: 'wrap', marginVertical: 10 }]}>
                {renderChip('mainnet', network === 'mainnet', () => setNetwork('mainnet'))}
                {renderChip('testnet', network === 'testnet', () => setNetwork('testnet'))}
              </View>
            </View>
            
            {/* Storage Configuration */}
            <View style={[styles.card, { marginTop: 15 }]}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                Wallet Storage Provider
              </Text>
              <Text style={[styles.textSecondary, { marginBottom: 15 }]}>
                Used for your transactions and metadata storage.
              </Text>
              
              <Text style={styles.inputLabel}>Storage URL</Text>
              <View style={styles.input}>
                <TextInput
                  style={styles.inputText}
                  value={storageUrl}
                  onChangeText={setStorageUrl}
                  placeholder="Enter Storage URL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={{ marginTop: 30, marginBottom: 30 }}>
              <TouchableOpacity 
                style={[styles.button, !isFormValid() && styles.buttonDisabled]}
                onPress={handleSaveConfig}
                disabled={!isFormValid()}
              >
                <Text style={styles.buttonText}>Save & Continue</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ alignItems: 'center', marginTop: 15 }}
                onPress={handleCancel}
              >
                <Text style={styles.link}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ConfigScreen;
