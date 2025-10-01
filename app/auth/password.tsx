import React, { useState } from 'react'
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
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme/ThemeContext'
import { useThemeStyles } from '@/context/theme/useThemeStyles'
import { useWallet } from '@/context/WalletContext'
import { Utils } from '@bsv/sdk'
import { useLocalStorage } from '@/context/LocalStorageProvider'

export default function PasswordScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams()
  const phoneNumber = params.phoneNumber as string
  const { setSnap } = useLocalStorage()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Get theme styles and colors
  const { colors, isDark } = useTheme()
  const styles = useThemeStyles()

  const { managers } = useWallet()

  // Check if the password meets minimum requirements
  const isValidPassword = () => {
    return password.length >= 6 // Basic minimum length check
  }

  // Check if the button should be enabled
  const isButtonEnabled = () => {
    return isValidPassword() && !loading
  }

  // Handle password submission
  const handleSubmit = async () => {
    if (!isButtonEnabled()) return

    setLoading(true)

    try {
      await managers!.walletManager!.providePassword(password)

      if (managers!.walletManager!.authenticated) {
        const snapshot = managers!.walletManager!.saveSnapshot()
        await setSnap(snapshot)
        router.dismissAll()
        router.replace('/browser')
      } else {
        Alert.alert(t('error'), t('auth_failed_maybe_password'))
      }
    } catch (error) {
      console.error('Error authenticating:', error)
      Alert.alert(t('error'), t('auth_failed_try_again'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{t('enter_password')}</Text>
          <Text style={styles.subtitle}>{t('enter_password_subtitle')}</Text>

          <View style={styles.inputContainer}>
            <View style={styles.input}>
              <TextInput
                style={styles.inputText}
                placeholder={t('password')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color={colors.textSecondary}
                  style={styles.icon}
                />
              </TouchableOpacity>
            </View>

            {password !== '' && !isValidPassword() && (
              <Text style={styles.validationError}>{t('password_validation_error')}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, (!isValidPassword() || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isButtonEnabled() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonTextDisabled} />
            ) : (
              <Text style={[styles.buttonText, (!isValidPassword() || loading) && styles.buttonTextDisabled]}>
                {t('continue')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 15 }}>
            <Text style={styles.link}>{t('forgot_password_link')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
