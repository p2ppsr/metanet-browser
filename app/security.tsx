import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';

export default function SecurityScreen() {
  // Get theme colors
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();

  // local state for demo only
  const [newPass, setNewPass] = useState('');
  const [retype, setRetype] = useState('');

  const changePassword = () => {
    if (newPass.length < 6) {
      Alert.alert('Password too short');
      return;
    }
    if (newPass !== retype) {
      Alert.alert('Passwords do not match');
      return;
    }
    Alert.alert('Success', 'Password changed (mock)');
    setNewPass('');
    setRetype('');
  };

  const onViewKey = () => Alert.alert('Recovery Key', '•••••••••••••• (mock)');

  return (
    <SafeAreaView style={[themeStyles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ padding:16, flex:1 }}>
        <Text style={[themeStyles.title, { color: colors.textPrimary, textAlign:'left', alignSelf:'flex-start' }]}>Security</Text>
        <Text style={[themeStyles.textSecondary, { marginBottom: 20, textAlign:'left', alignSelf:'flex-start' }]}>Manage your password and recovery key.</Text>

        {/* Change password card */}
        <View style={[styles.card, { borderColor: colors.inputBorder, backgroundColor: colors.paperBackground }]}>          
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Change Password</Text>
          <Text style={[styles.cardCaption, { color: colors.textSecondary }]}>You will be prompted to enter your old password to confirm the change.</Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            placeholder="New password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={newPass}
            onChangeText={setNewPass}
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            placeholder="Retype password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={retype}
            onChangeText={setRetype}
          />
          <TouchableOpacity onPress={() => Alert.alert('Forgot password flow')}>
            <Text style={[styles.forgotText, { color: colors.secondary }]}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={changePassword}>
            <Text style={{ color: colors.buttonText, fontWeight:'600' }}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Recovery key card */}
        <View style={[styles.card, { borderColor: colors.inputBorder, backgroundColor: colors.paperBackground }]}>          
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recovery Key</Text>
          <Text style={[styles.cardCaption, { color: colors.textSecondary }]}>You will need your recovery key if you forget your password or lose your phone.</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={onViewKey}>
            <Text style={{ color: colors.secondary }}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => Alert.alert('Change recovery key (mock)')}>
            <Text style={{ color: colors.buttonText, fontWeight:'600' }}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card:{ padding:16, borderWidth:1, borderRadius:8, marginBottom:24 },
  cardTitle:{ fontSize:16, fontWeight:'600', marginBottom:8 },
  cardCaption:{ fontSize:12, marginBottom:12 },
  input:{ borderWidth:1, borderRadius:6, paddingHorizontal:12, paddingVertical:10, marginBottom:12, fontSize:14 },
  forgotText:{ fontSize:12, marginBottom:12 },
  btn:{ alignSelf:'flex-end', paddingVertical:8, paddingHorizontal:16, borderRadius:6 },
  linkBtn:{ alignSelf:'flex-start', marginBottom:12 }
});
