import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Alert } from 'react-native';
import UHRPViewer from '@/components/UHRPViewer2';

export default function UHRPScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/browser');
    }
  };

  const handleError = (error: any) => {
    console.error('UHRP Error:', error);
    Alert.alert(
      'Content Error',
      `Failed to load UHRP content: ${error.message || 'Unknown error'}`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  if (!url) {
    // Navigate back if no URL provided
    React.useEffect(() => {
      handleBack();
    }, []);
    return null;
  }

  // Decode the URL since it was encoded when passed as a parameter
  const decodedUrl = decodeURIComponent(url);

  return (
    <UHRPViewer
      url={decodedUrl}
      onBack={handleBack}
      onError={handleError}
    />
  );
}
