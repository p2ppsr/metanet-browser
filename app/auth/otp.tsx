import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
  TextInput
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet } from '@/context/WalletContext';

export default function OtpScreen() {
  // Apply theme
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();

  const { managers } = useWallet();
  const params = useLocalSearchParams();
  const phoneNumber = params.phoneNumber as string;
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60); // 60 second countdown for resending OTP
  const [canResend, setCanResend] = useState(false);

  // Create refs for the input fields
  const inputRefs = useRef<Array<TextInput | null>>([]);
  
  // Start countdown timer when component mounts
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Handle OTP verification
  const handleVerify = async () => {
    if (otp.length !== 6) return; // Ensure OTP is complete
    
    setLoading(true);
    
    try {
      await managers!.walletManager!.completeAuth({
        phoneNumber,
        otp,
      });
      
      // Navigate to password screen after OTP verification
      router.push({
        pathname: '/auth/password',
        params: { phoneNumber: phoneNumber }
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Verification Failed', 'The code you entered is incorrect. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle resend OTP
  const handleResend = async () => {
    if (!canResend) return;
    
    setLoading(true);
    
    try {
      await managers!.walletManager!.startAuth({ phoneNumber });
      
      // Reset countdown
      setCountdown(60);
      setCanResend(false);
      
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } catch (error) {
      console.error('Error resending OTP:', error);
      Alert.alert('Error', 'Failed to resend verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Verification Code</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the 6-digit code sent to {phoneNumber}
          </Text>
          
          <View style={styles.otpContainer}>
            <View style={styles.otpInputsContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => {
                return (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput, 
                      { 
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.textPrimary
                      },
                      otp.length === index && {
                        borderColor: colors.primary,
                        borderWidth: 2
                      }
                    ]}
                    keyboardType="phone-pad"
                    maxLength={1}
                    value={otp[index] || ''}
                    onChangeText={(text) => {
                      // Update the OTP value at this index
                      if (text.length === 0) {
                        // Backspace - clear current digit
                        setOtp(otp.slice(0, index));
                      } else {
                        // Add digit to OTP
                        const newOtp = otp.slice(0, index) + text + otp.slice(index + 1);
                        setOtp(newOtp);
                        
                        // Auto-focus next input if this one is filled
                        if (index < 5 && text.length === 1) {
                          // Move to next input using React Native refs
                          if (inputRefs.current[index + 1]) {
                            inputRefs.current[index + 1]?.focus();
                          }
                        }
                      }
                    }}
                    autoFocus={index === 0}
                  />
                );
              })}
            </View>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.verifyButton, 
              { backgroundColor: colors.primary },
              otp.length !== 6 && {
                backgroundColor: colors.inputBorder
              }
            ]} 
            onPress={handleVerify}
            disabled={otp.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text style={[styles.verifyButtonText, { color: colors.buttonText }]}>Verify</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.resendContainer}>
            <Text style={[styles.resendText, { color: colors.textSecondary }]}>Didn't receive the code?</Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text style={[styles.resendActionText, { color: colors.secondary }]}>Resend Code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.countdownText, { color: colors.textSecondary, opacity: 0.7 }]}>
                Resend in {countdown}s
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.changeNumberButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.changeNumberText, { color: colors.secondary }]}>Change Phone Number</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 30,
    textAlign: 'center',
  },
  otpContainer: {
    width: '100%',
    marginBottom: 30,
  },
  otpInputsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 20,
    padding: 12,
    textAlign: 'center',
    width: 45,
    height: 55,
  },
  otpInputFocused: {},  // Styles now applied inline with theme colors
  verifyButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {}, // Styles now applied inline with theme colors
  verifyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  resendText: {
    marginRight: 5,
  },
  resendActionText: {
    fontWeight: 'bold',
  },
  countdownText: {},  // Color now applied inline with theme colors
  changeNumberButton: {
    marginTop: 20,
  },
  changeNumberText: {
    fontSize: 14,
  },
});
