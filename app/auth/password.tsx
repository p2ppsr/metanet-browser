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
  Alert 
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function PasswordScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phoneNumber as string;
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Check if the password meets minimum requirements
  const isValidPassword = () => {
    return password.length >= 6; // Basic minimum length check
  };
  
  // Check if the button should be enabled
  const isButtonEnabled = () => {
    return isValidPassword() && !loading;
  };
  
  // Handle password submission
  const handleSubmit = async () => {
    if (!isButtonEnabled()) return;
    
    setLoading(true);
    
    try {
      // In a real app, you would authenticate or register the user
      console.log('Authenticating user with phone:', phoneNumber);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // This would integrate with the wallet system in a real app
      // Could be either first-time registration or returning user login
      
      // Navigate to apps screen
      router.replace('/apps');
    } catch (error) {
      console.error('Error authenticating:', error);
      Alert.alert('Error', 'Authentication failed. Please try again.');
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
          <Text style={styles.title}>Enter Password</Text>
          <Text style={styles.subtitle}>
            Please enter your password to continue
          </Text>
          
          <View style={styles.inputContainer}>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={24} 
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            
            {password !== '' && !isValidPassword() && (
              <Text style={styles.validationError}>
                Password must be at least 6 characters
              </Text>
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              !isButtonEnabled() && styles.submitButtonDisabled
            ]} 
            onPress={handleSubmit}
            disabled={!isButtonEnabled()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.forgotPasswordButton}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
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
  passwordInputContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 15,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 15,
    height: '100%',
  },
  eyeIcon: {
    padding: 10,
  },
  validationError: {
    color: '#ff3b30',
    fontSize: 12,
    marginBottom: 15,
    marginTop: -10,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#0066cc',
    fontSize: 14,
    textAlign: 'center',
  },
});
