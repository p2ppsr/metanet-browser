const { StorageDownloader } = require('@bsv/sdk');

async function debugUHRPCat() {
  console.log('🐱 Debugging UHRP Cat Issue');
  console.log('='.repeat(50));

  const downloader = new StorageDownloader();
  const hash = 'XUSuidbeknPv3KKFbBArzUDEfMSHCDXMqMjsAaPLkYLZS4Ebxjfm';
  const uhrpUrl = `uhrp://${hash}`;
  
  console.log(`Testing URL: ${uhrpUrl}`);
  
  try {
    // Step 1: Test UHRP resolution
    console.log('\n1. Testing UHRP resolution...');
    const resolved = await downloader.resolve(hash);
    const httpUrl = resolved[0];
    console.log(`   Resolved to: ${httpUrl}`);
    
    // Step 2: Test HTTP response
    console.log('\n2. Testing HTTP response...');
    const response = await fetch(httpUrl);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Content-Length: ${response.headers.get('content-length')}`);
    console.log(`   Content-Disposition: ${response.headers.get('content-disposition')}`);
    
    // Step 3: Check content
    const arrayBuffer = await response.arrayBuffer();
    const content = new Uint8Array(arrayBuffer);
    console.log(`   Content Size: ${content.length} bytes`);
    console.log(`   First 10 bytes: [${Array.from(content.slice(0, 10)).join(', ')}]`);
    console.log(`   First 10 bytes (hex): ${Array.from(content.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Step 4: MIME type detection
    const bytes = content.slice(0, 12);
    let detectedMimeType = 'application/octet-stream';
    
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      detectedMimeType = 'image/jpeg';
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      detectedMimeType = 'image/png';
    }
    
    console.log(`   Detected MIME type: ${detectedMimeType}`);
    
    // Step 5: Test data URL creation
    console.log('\n3. Testing data URL creation...');
    const serverMimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
    const shouldUseDataUrl = serverMimeType === 'application/octet-stream' && 
                            (detectedMimeType.startsWith('image/') || detectedMimeType.startsWith('text/'));
    
    console.log(`   Server MIME type: ${serverMimeType}`);
    console.log(`   Should use data URL: ${shouldUseDataUrl}`);
    
    if (shouldUseDataUrl) {
      console.log('   Creating data URL...');
      const chunkSize = 8192;
      let binary = '';
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64 = btoa(binary);
      const dataUrl = `data:${detectedMimeType};base64,${base64}`;
      console.log(`   Data URL length: ${dataUrl.length} characters`);
      console.log(`   Data URL prefix: ${dataUrl.substring(0, 50)}...`);
      
      // Test if browser limits are exceeded
      if (dataUrl.length > 2 * 1024 * 1024) {
        console.log(`   ⚠️  WARNING: Data URL exceeds 2MB limit`);
      } else {
        console.log(`   ✅ Data URL is within size limits`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

debugUHRPCat().catch(console.error);
