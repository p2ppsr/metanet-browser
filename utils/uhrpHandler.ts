import { uhrpHandler } from './uhrpProtocol';
import { router } from 'expo-router';

/**
 * Handle UHRP URL navigation from the browser
 */
export const handleUHRPNavigation = (url: string): boolean => {
  if (!uhrpHandler.isUHRPUrl(url)) {
    return false;
  }

  console.log('🔗 [UHRP_HANDLER] Navigating to UHRP content:', url);
  
  // Navigate to UHRP viewer screen
  router.push({
    pathname: '/uhrp/[url]',
    params: { url: encodeURIComponent(url) }
  });
  
  return true;
};

/**
 * Check if a URL should be handled as UHRP
 */
export const shouldHandleAsUHRP = (url: string): boolean => {
  return uhrpHandler.isUHRPUrl(url);
};

/**
 * Enhanced URL validation that includes UHRP
 */
export const isValidUrlOrUHRP = (url: string): boolean => {
  // Check if it's a UHRP URL
  if (uhrpHandler.isUHRPUrl(url)) {
    return true;
  }
  
  // Check if it's a regular URL (you can import your existing validation)
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
