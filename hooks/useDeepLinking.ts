import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebAppManifest } from './useWebAppManifest';

const PENDING_URL_KEY = 'pendingDeepLinkUrl';

export function useDeepLinking() {
  const { fetchManifest, getStartUrl, shouldRedirectToStartUrl } = useWebAppManifest();

  useEffect(() => {
    // Handle app opened from deep link while closed
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle app opened from deep link while running
    const handleUrl = (event: { url: string }) => {
      handleDeepLink(event.url);
    };

    getInitialURL();
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => subscription?.remove();
  }, []);

  const handleDeepLink = async (url: string) => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        await handleManifestAwareDeepLink(url);
      } else if (url.startsWith('metanet://')) {
        // Handle custom scheme URLs
        const route = url.replace('metanet://', '');
        
        const validRoutes = ['browser', 'settings', 'identity', 'security', 'trust'];
        if (validRoutes.includes(route)) {
          router.push(`/${route}` as any);
        } else {
          router.push('/browser');
        }
      } else {
        router.push('/browser');
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
      router.push('/browser');
    }
  };

  const handleManifestAwareDeepLink = async (incomingUrl: string) => {
    try {
      const manifest = await fetchManifest(incomingUrl);
      
      if (manifest) {
        // Check if we should use start_url for onboarding
        if (shouldRedirectToStartUrl(manifest, incomingUrl)) {
          const startUrl = getStartUrl(manifest, incomingUrl);
          await AsyncStorage.setItem(PENDING_URL_KEY, startUrl);
          router.replace('/browser');
          return;
        }
        
        // Handle Babbage permissions if needed
        if (manifest.babbage?.protocolPermissions) {
          // Will add special handling for Babbage apps here
        }
      }
    } catch (error) {
      console.error('Error fetching manifest:', error);
    }
    
    // Fallback to original URL
    await AsyncStorage.setItem(PENDING_URL_KEY, incomingUrl);
    router.replace('/browser');
  };
}

export const setPendingUrl = async (url: string) => {
  await AsyncStorage.setItem(PENDING_URL_KEY, url);
};

export const getPendingUrl = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(PENDING_URL_KEY);
};

export const clearPendingUrl = async () => {
  await AsyncStorage.removeItem(PENDING_URL_KEY);
};