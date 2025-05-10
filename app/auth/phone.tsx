import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
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

// Common country codes with country names and dial codes
const countryCodes = [
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Japan', code: 'JP', dialCode: '+81' },
  { name: 'Brazil', code: 'BR', dialCode: '+55' },
  { name: 'France', code: 'FR', dialCode: '+33' },
  { name: 'Mexico', code: 'MX', dialCode: '+52' },
  { name: 'Russia', code: 'RU', dialCode: '+7' },
  { name: 'Spain', code: 'ES', dialCode: '+34' },
  { name: 'South Korea', code: 'KR', dialCode: '+82' },
];

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
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
  const handleContinue = async () => {
    if (!isValidPhoneNumber()) return;
    
    setLoading(true);
    
    try {
      // In a real app, you would call your backend to send OTP
      console.log('Sending OTP to:', formattedNumber);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter your phone number</Text>
          <Text style={styles.subtitle}>We'll send you a verification code</Text>
          
          <View style={styles.inputContainer}>
            <View style={styles.phoneInputContainer}>
              {/* Country code selector */}
              <TouchableOpacity 
                style={styles.countryCodeContainer} 
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countryCodeText}>{selectedCountry.dialCode}</Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
              
              {/* Phone number input */}
              <TextInput
                style={styles.phoneNumberInput}
                placeholder="Phone number"
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
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Country</Text>
                    <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                      <Text style={styles.closeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <FlatList
                    data={countryCodes}
                    keyExtractor={(item) => item.code}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.countryItem}
                        onPress={() => handleSelectCountry(item)}
                      >
                        <Text style={styles.countryName}>{item.name}</Text>
                        <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              </View>
            </Modal>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.continueButton, 
              !isValidPhoneNumber() && styles.continueButtonDisabled
            ]} 
            onPress={handleContinue}
            disabled={!isValidPhoneNumber() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    width: 80,
  },
  countryCodeText: {
    fontSize: 16,
    marginRight: 5,
  },
  dropdownIcon: {
    fontSize: 10,
    color: '#666',
  },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 18,
    color: '#666',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  countryName: {
    fontSize: 16,
  },
  countryDialCode: {
    fontSize: 16,
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  continueButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
});
