import React, { useState } from 'react';
import { 
  View, 
  Text, 
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
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';

export default function PasswordScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phoneNumber as string;
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Get theme styles and colors
  const { colors, isDark } = useTheme();
  const styles = useThemeStyles();
  
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
      router.replace('/(tabs)/apps');
    } catch (error) {
      console.error('Error authenticating:', error);
      Alert.alert('Error', 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter Password</Text>
          <Text style={styles.subtitle}>
            Please enter your password to continue
          </Text>
          
          <View style={styles.inputContainer}>
            <View style={styles.input}>
              <TextInput
                style={styles.inputText}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={24} 
                  color={colors.textSecondary}
                  style={styles.icon}
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
              styles.button, 
              !isButtonEnabled() && styles.buttonDisabled
            ]} 
            onPress={handleSubmit}
            disabled={!isButtonEnabled()}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={{ marginTop: 15 }}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
