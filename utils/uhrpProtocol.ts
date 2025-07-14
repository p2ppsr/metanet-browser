import { StorageDownloader, StorageUtils } from '@bsv/sdk';

export interface DownloadResult {
  data: number[]
  mimeType: string | null
}
export class UHRPProtocolHandler {
  private static instance: UHRPProtocolHandler;
  private downloader: StorageDownloader;
  private resolvedUrls: Record<string, DownloadResult> = {}; // Cache resolved URLs

  private constructor() {
    this.downloader = new StorageDownloader();
  }

  public static getInstance(): UHRPProtocolHandler {
    if (!UHRPProtocolHandler.instance) {
      UHRPProtocolHandler.instance = new UHRPProtocolHandler();
    }
    return UHRPProtocolHandler.instance;
  }

  public isUHRPUrl(url: string): boolean {
    let hashToCheck = url;
    if (url.toLowerCase().startsWith('uhrp://')) {
      const match = url.match(/^uhrp:\/\/(.+)$/i);
      if (!match) return false;
      hashToCheck = match[1];
    }
    return StorageUtils.isValidURL(hashToCheck);
  }

  public extractHashFromUHRPUrl(url: string): string | null {
    if (this.isUHRPUrl(url)) {
      const match = url.match(/^uhrp:\/\/(.+)$/i);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  public async resolveUHRPUrl(url: string): Promise<DownloadResult> {
    if (this.isUHRPUrl(url)) {
      const hash = this.extractHashFromUHRPUrl(url);
      if (!hash) {
        throw new Error('Invalid UHRP URL format');
      }
      if (this.resolvedUrls[hash]) {
        return this.resolvedUrls[hash];
      }
      try {
        const data = await this.downloader.download(hash);
        return data;
      } catch (error) {
        console.error('Error resolving UHRP URL:', error);
        throw new Error('Failed to resolve UHRP URL');
      }
    }
    throw new Error('URL is not a valid UHRP URL');
  }
}
 

  

export const uhrpHandler = UHRPProtocolHandler.getInstance();

// Utility function to handle UHRP navigation
export function handleUHRPNavigation(url: string): boolean {
  if (!uhrpHandler.isUHRPUrl(url)) {
    return false;
  }
  
  console.log('🔗 [UHRP] Handling UHRP navigation:', url);
  
  // For now, we'll let the browser handle UHRP URLs
  // This function returns true to indicate that UHRP handling is available
  return true;
}
