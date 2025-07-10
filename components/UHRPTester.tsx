import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/context/theme/ThemeContext';
import { uhrpHandler } from '@/utils/uhrpProtocol';
import { handleUHRPNavigation } from '@/utils/uhrpHandler';

const UHRPTester: React.FC = () => {
  const { colors } = useTheme();

  const testUHRPUrls = [
    'uhrp://test123',
    'uhrp://abc123def456',
    'uhrp://sample-content-hash',
  ];

  const handleTestUHRP = async (url: string) => {
    try {
      Alert.alert(
        'Testing UHRP URL',
        `Testing: ${url}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Test Navigation', 
            onPress: () => handleUHRPNavigation(url) 
          },
          { 
            text: 'Test Resolution', 
            onPress: async () => {
              try {
                await uhrpHandler.resolveUHRPUrl(url);
                Alert.alert('Success', 'UHRP URL resolved successfully');
              } catch (error) {
                Alert.alert('Error', `Failed to resolve: ${error}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to test UHRP: ${error}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        UHRP Protocol Tester
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Test UHRP URL handling and resolution
      </Text>
      
      {testUHRPUrls.map((url, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => handleTestUHRP(url)}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>
            Test: {url}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default UHRPTester;
