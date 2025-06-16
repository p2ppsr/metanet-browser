import { useState, useEffect, useRef } from 'react';

interface WebAppManifest {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  background_color?: string;
  theme_color?: string;
  icons?: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  shortcuts?: Array<{
    name: string;
    url: string;
    description?: string;
    icons?: Array<{
      src: string;
      sizes: string;
    }>;
  }>;
  babbage?: {
    protocolPermissions?: {
      [key: string]: string;
    };
  };
}

export const useWebAppManifest = () => {
    const [manifest, setManifest] = useState<WebAppManifest | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Add cache to prevent repeated fetches
    const manifestCache = useRef<Map<string, WebAppManifest | null>>(new Map());
    const fetchPromises = useRef<Map<string, Promise<WebAppManifest | null>>>(new Map());
  
    const fetchManifest = async (websiteUrl: string): Promise<WebAppManifest | null> => {
      try {
        // Get the base URL (domain)
        const url = new URL(websiteUrl);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        
        if (manifestCache.current.has(baseUrl)) {
            const cached = manifestCache.current.get(baseUrl);
            if (cached !== undefined) {
              setManifest(cached);
              return cached;
            }
          }
        // Check if we're already fetching this URL
        if (fetchPromises.current.has(baseUrl)) {
          return await fetchPromises.current.get(baseUrl)!;
        }
        
        setLoading(true);
        
        // Create promise and store it
        const fetchPromise = performManifestFetch(baseUrl);
        fetchPromises.current.set(baseUrl, fetchPromise);
        
        try {
          const result = await fetchPromise;
          
          // Cache the result (even if null)
          manifestCache.current.set(baseUrl, result);
          setManifest(result);
          
          return result;
        } finally {
          // Remove from pending promises
          fetchPromises.current.delete(baseUrl);
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Error fetching manifest:', error);
        setManifest(null);
        return null;
      }
    };
  
    const performManifestFetch = async (baseUrl: string): Promise<WebAppManifest | null> => {
        // Only check manifest.json as specified by client
        const manifestUrl = `${baseUrl}/manifest.json`;
    
        try {
          console.log(`Fetching manifest from: ${manifestUrl}`);
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch(manifestUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, application/manifest+json',
            },
            signal: controller.signal,
          });
    
          clearTimeout(timeout);
    
          if (response.ok) {
            const manifestData = await response.json();
            console.log('Found manifest:', manifestData);
            return manifestData;
          } else {
            console.log(`No manifest found at ${manifestUrl}`);
          }
        } catch (error) {
          console.log(`Error fetching manifest from ${manifestUrl}:`, error);
        }
    
        // Try parsing HTML for manifest link as fallback
        try {
          console.log(`Checking HTML for manifest link: ${baseUrl}`);
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          
          const htmlResponse = await fetch(baseUrl, {
            signal: controller.signal,
          });
          
          clearTimeout(timeout);
          
          if (htmlResponse.ok) {
            const html = await htmlResponse.text();
            const manifestLinkMatch = html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']*)["'][^>]*>/i);
            
            if (manifestLinkMatch) {
              const manifestPath = manifestLinkMatch[1];
              const manifestUrl = manifestPath.startsWith('http') 
                ? manifestPath 
                : `${baseUrl}${manifestPath.startsWith('/') ? '' : '/'}${manifestPath}`;
              
              console.log(`Found manifest link in HTML: ${manifestUrl}`);
              
              const response = await fetch(manifestUrl, {
                headers: {
                  'Accept': 'application/json, application/manifest+json',
                },
              });
              
              if (response.ok) {
                const manifestData = await response.json();
                console.log('Found manifest from HTML link:', manifestData);
                return manifestData;
              }
            }
          }
        } catch (error) {
          console.log('Error parsing HTML for manifest link:', error);
        }
    
        console.log('No manifest found for', baseUrl);
        return null;
      };
      
    const getStartUrl = (manifest: WebAppManifest | null, currentUrl: string): string => {
      if (!manifest?.start_url) return currentUrl;
      
      const url = new URL(currentUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      
      // Handle relative start_url
      if (manifest.start_url.startsWith('/')) {
        return `${baseUrl}${manifest.start_url}`;
      } else if (manifest.start_url.startsWith('http')) {
        return manifest.start_url;
      } else if (manifest.start_url === '.') {
        // Special case: "." means stay on current URL
        return currentUrl;
      } else {
        return `${baseUrl}/${manifest.start_url}`;
      }
    };
  
    const shouldRedirectToStartUrl = (manifest: WebAppManifest | null, currentUrl: string): boolean => {
      if (!manifest?.start_url) return false;
      
      // If start_url is "." (like Tempo), don't redirect
      if (manifest.start_url === '.') return false;
      
      const url = new URL(currentUrl);
      const pathname = url.pathname;
      
      // If we're on the root path and there's a different start_url, redirect
      return pathname === '/' && manifest.start_url !== '/' && manifest.start_url !== '.';
    };
  
    const getBabbagePermissions = (manifest: WebAppManifest | null): {[key: string]: string} | null => {
      return manifest?.babbage?.protocolPermissions || null;
    };
  
    return {
      manifest,
      loading,
      fetchManifest,
      getStartUrl,
      shouldRedirectToStartUrl,
      getBabbagePermissions,
      clearCache: () => {
        manifestCache.current.clear();
        fetchPromises.current.clear();
      }
    };
  };