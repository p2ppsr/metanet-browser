const { StorageDownloader, StorageUtils } = require('@bsv/sdk');

class UHRPTester {
  constructor() {
    this.downloader = new StorageDownloader();
  }

  async testUHRPUrl(hash, label) {
    console.log(`\n Testing ${label}: ${hash}`);
    console.log('='.repeat(60));

    try {
      // Step 1: Validate URL
      const isValid = StorageUtils.isValidURL(hash);
      console.log(` Valid UHRP URL: ${isValid}`);

      if (!isValid) {
        console.log(' Invalid UHRP URL format');
        return;
      }

      // Step 2: Resolve to HTTP URL
      console.log(' Resolving to HTTP URL...');
      const resolved = await this.downloader.resolve(hash);
      
      if (!resolved || resolved.length === 0) {
        console.log(' UHRP resolution failed - no URLs returned');
        return;
      }

      const [resolvedUrl] = resolved;
      console.log(` Resolved to: ${resolvedUrl}`);

      // Step 3: Fetch content
      console.log(' Fetching content...');
      const response = await fetch(resolvedUrl);
      
      if (!response.ok) {
        console.log(` HTTP Error: ${response.status} ${response.statusText}`);
        return;
      }

      // Step 4: Analyze headers
      console.log(' Response Headers:');
      console.log(`  Content-Type: ${response.headers.get('content-type')}`);
      console.log(`  Content-Length: ${response.headers.get('content-length')}`);
      console.log(`  Content-Disposition: ${response.headers.get('content-disposition')}`);
      console.log(`  Cache-Control: ${response.headers.get('cache-control')}`);

      // Step 5: Analyze content
      const arrayBuffer = await response.arrayBuffer();
      const content = new Uint8Array(arrayBuffer);
      
      console.log(`Content Size: ${content.length} bytes`);
      console.log(`First 20 bytes: [${Array.from(content.slice(0, 20)).join(', ')}]`);
      console.log(`First 20 bytes (hex): ${Array.from(content.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      // Step 6: MIME type detection
      let serverMimeType = response.headers.get('content-type') || 'application/octet-stream';
      serverMimeType = serverMimeType.split(';')[0].trim();
      
      const detectedMimeType = this.detectMimeTypeFromContent(content);
      
      console.log(`Server MIME Type: ${serverMimeType}`);
      console.log(`Detected MIME Type: ${detectedMimeType}`);
      console.log(`Final MIME Type: ${serverMimeType === 'application/octet-stream' ? detectedMimeType : serverMimeType}`);
      
      // Step 7: Display capability
      const canDisplay = this.canDisplayInline(detectedMimeType);
      console.log(`Can Display Inline: ${canDisplay}`);

      // Step 8: Content preview
      if (detectedMimeType.startsWith('text/') || detectedMimeType === 'application/json') {
        const textContent = new TextDecoder().decode(content.slice(0, 200));
        console.log(`Text Preview: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`);
      }

    } catch (error) {
      console.error(`Error testing ${label}:`, error.message);
    }
  }

  detectMimeTypeFromContent(content) {
    const bytes = content.slice(0, 12);
    
    // PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }
    
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }
    
    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    
    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return 'image/gif';
    }
    
    // WebP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }

    // MP4 video
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video/mp4';
    }

    // WebM video
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'video/webm';
    }

    // AVI video
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) {
      return 'video/avi';
    }
    
    // HTML
    const textContent = new TextDecoder().decode(bytes.slice(0, 100));
    if (textContent.toLowerCase().includes('<html') || textContent.toLowerCase().includes('<!doctype html')) {
      return 'text/html';
    }
    
    // JSON
    if (textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
      return 'application/json';
    }
    
    // Plain text (fallback for many text formats)
    if (this.isProbablyText(bytes)) {
      return 'text/plain';
    }
    
    return 'application/octet-stream';
  }

  isProbablyText(bytes) {
    const sample = bytes.slice(0, 100);
    let textChars = 0;
    
    for (const byte of sample) {
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++;
      }
    }
    
    return textChars / sample.length > 0.7;
  }

  canDisplayInline(mimeType) {
    const inlineTypes = [
      'text/html',
      'text/plain',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/avi'
    ];
    
    return inlineTypes.includes(mimeType) || 
           mimeType.startsWith('image/') || 
           mimeType.startsWith('text/') ||
           mimeType.startsWith('video/');
  }

  async runAllTests() {
    console.log(' Starting UHRP MIME Type Detection Tests');
    console.log('==========================================');

    const testCases = [
      // New UHRP URLs
      { hash: 'XUTr8jVoGJUaMYQa4KP6bZ4ejVimzpkfnt1ogDBqDShmdoM6xUcZ', label: 'Nano UHRP CAT' },
      { hash: 'XUTEGfCykZ4E8oJhT98keoPTg2Q28Nq4sJJXLf9CYA5CjV7ZsTCV', label: 'Nano UHRP VIDEO' },

      // Old UHRP URLs
      { hash: 'XUSuidbeknPv3KKFbBArzUDEfMSHCDXMqMjsAaPLkYLZS4Ebxjfm', label: 'Lite UHRP DOG' },
      { hash: 'XUTfTEb8xSaFAu55BS1LMi5mwT4VLYXTwmGn2oKvLeVGMKZj5rGy', label: 'Lite UHRP VIDEO' },

    ];

    for (const testCase of testCases) {
      await this.testUHRPUrl(testCase.hash, testCase.label);
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n All tests completed!');
    console.log('\n Summary Analysis:');
    console.log('- Check if new UHRP URLs have different Content-Type headers');
    console.log('- Compare content signatures between old and new');
    console.log('- Look for differences in Content-Disposition headers');
    console.log('- Check if server behavior differs between old and new UHRP servers');
  }
}

// Run the tests
const tester = new UHRPTester();
tester.runAllTests().catch(console.error);