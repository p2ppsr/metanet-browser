import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Modal,
  FlatList,
  Pressable
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet } from '@/context/WalletContext';
import { countryCodes } from '@/utils/countryCodes';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[222]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const { managers } = useWallet();
  
  // Get theme styles and colors
  const { colors, isDark } = useTheme();
  const styles = useThemeStyles();
  
  // Format the full phone number with country code
  const formattedNumber = `${selectedCountry.dialCode}${phoneNumber}`;
  
  // Check if phone number is valid
  const isValidPhoneNumber = () => {
    return phoneNumber.length > 6; // Simple validation, adjust as needed
  };
  
  // Handle country selection
  const handleSelectCountry = (country: typeof countryCodes[0]) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
  };
  
  // Handle login button press
  const handleContinue = useCallback(async () => {
    if (!isValidPhoneNumber()) return;
    
    setLoading(true);
    
    try {
      await managers!.walletManager!.startAuth({
        phoneNumber: formattedNumber,
      });
      
      // Navigate to OTP screen
      router.push({
        pathname: '/auth/otp',
        params: { phoneNumber: formattedNumber }
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Show error message to user
    } finally {
      setLoading(false);
    }
  }, [managers?.walletManager, formattedNumber]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter your phone number</Text>
          <Text style={styles.subtitle}>We'll send you a verification code</Text>
          
          <View style={styles.inputContainer}>
            <View style={[styles.input, { paddingLeft: 0 }]}>
              {/* Country code selector */}
              <TouchableOpacity 
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 10,
                  borderRightWidth: 1,
                  borderRightColor: colors.inputBorder,
                  width: 80,
                }} 
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16, marginRight: 5 }}>
                  {selectedCountry.dialCode}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>▼</Text>
              </TouchableOpacity>
              
              {/* Phone number input */}
              <TextInput
                style={styles.inputText}
                placeholder="Phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus
              />
            </View>
            
            {/* Country picker modal */}
            <Modal
              visible={showCountryPicker}
              animationType="slide"
              transparent
              onRequestClose={() => setShowCountryPicker(false)}
            >
              <View style={{
                flex: 1,
                justifyContent: 'flex-end',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}>
                <View style={{
                  backgroundColor: colors.paperBackground,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  maxHeight: '80%',
                }}>
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.inputBorder,
                  }}>
                    <Text style={[styles.text, { fontWeight: 'bold', fontSize: 18 }]}>Select Country</Text>
                    <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                      <Text style={{ fontSize: 18, color: colors.textSecondary }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <FlatList
                    data={countryCodes}
                    keyExtractor={(item) => item.code}
                    renderItem={({ item }) => (
                      <Pressable
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          padding: 15,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.inputBorder,
                        }}
                        onPress={() => handleSelectCountry(item)}
                      >
                        <Text style={styles.text}>{item.name}</Text>
                        <Text style={styles.textSecondary}>{item.dialCode}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              </View>
            </Modal>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.button, 
              !isValidPhoneNumber() && styles.buttonDisabled
            ]} 
            onPress={handleContinue}
            disabled={!isValidPhoneNumber() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
