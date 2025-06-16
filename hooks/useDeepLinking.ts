import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_URL_KEY = 'pendingDeepLinkUrl';

export function useDeepLinking() {
  useEffect(() => {
    // Handle app opened from deep link while app was closed
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle app opened from deep link while app was running
    const handleUrl = (event: { url: string }) => {
      handleDeepLink(event.url);
    };

    getInitialURL();
    
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleDeepLink = async (url: string) => {
    console.log('Received deep link:', url);
    
    // If it's a web URL (http/https), use manifest-aware handling
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await handleManifestAwareDeepLink(url);
    } else if (url.startsWith('metanet://')) {
      // Handle custom scheme URLs
      const route = url.replace('metanet://', '');
      
      // Only navigate to valid routes to avoid TypeScript errors
      const validRoutes = ['browser', 'settings', 'identity', 'security', 'trust'];
      if (validRoutes.includes(route)) {
        router.push(`/${route}` as any);
      } else {
        // Default to browser for unknown routes
        router.push('/browser');
      }
    }
  };
  
  const handleManifestAwareDeepLink = async (incomingUrl: string) => {
    console.log('Processing manifest-aware deep link:', incomingUrl);
    
    try {
      // Get the base URL to fetch manifest
      const url = new URL(incomingUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      
      // Try to fetch manifest
      const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
      
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        console.log('Found manifest for deep link:', manifest);
        
        // Check if we should use start_url for onboarding
        if (manifest.start_url && url.pathname === '/') {
          const startUrl = manifest.start_url.startsWith('http') 
            ? manifest.start_url 
            : `${baseUrl}${manifest.start_url.startsWith('/') ? '' : '/'}${manifest.start_url}`;
          
          console.log('Using manifest start_url for onboarding:', startUrl);
          await AsyncStorage.setItem(PENDING_URL_KEY, startUrl);
          router.replace('/browser');
          return;
        }
      }
    } catch (error) {
      console.log('No manifest found or error fetching:', error);
    }
    
    // Fallback to original URL
    await AsyncStorage.setItem(PENDING_URL_KEY, incomingUrl);
    router.replace('/browser');
  };
}

// Export helper functions for other components to use
export const setPendingUrl = async (url: string) => {
  await AsyncStorage.setItem(PENDING_URL_KEY, url);
};

export const getPendingUrl = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(PENDING_URL_KEY);
};

export const clearPendingUrl = async () => {
  await AsyncStorage.removeItem(PENDING_URL_KEY);
};