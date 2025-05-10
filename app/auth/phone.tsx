import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { router } from 'expo-router';
import PhoneInput from 'react-native-phone-number-input';
import { StatusBar } from 'expo-status-bar';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedNumber, setFormattedNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const phoneInputRef = useRef<PhoneInput>(null);
  
  // Check if phone number is valid
  const isValidPhoneNumber = () => {
    return phoneNumber.length > 6; // Simple validation, adjust as needed
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
            <PhoneInput
              ref={phoneInputRef}
              defaultValue={phoneNumber}
              defaultCode="US"
              layout="first"
              onChangeText={(text) => {
                setPhoneNumber(text);
              }}
              onChangeFormattedText={(text) => {
                setFormattedNumber(text);
              }}
              countryPickerProps={{
                withAlphaFilter: true,
              }}
              withShadow
              autoFocus
              containerStyle={styles.phoneContainer}
              textContainerStyle={styles.textInput}
            />
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
  phoneContainer: {
    width: '100%',
    borderRadius: 10,
  },
  textInput: {
    paddingVertical: 0,
    borderRadius: 10,
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
