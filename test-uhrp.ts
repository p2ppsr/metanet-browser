import { StorageUtils, StorageDownloader } from '@bsv/sdk'
const downloader = new StorageDownloader();
console.log('Testing UHRP resolution...');

const testHash = 'XUUSj5qWvjbmdPAgffwA6ppW5UDMjLcc7woXDkYRqKRYveXCgJXE';

console.log('Hash:', testHash);
console.log('Hash length:', testHash.length);

console.log('Testing StorageUtils.isValidURL...');
const isValidUrl = await StorageUtils.isValidURL(testHash);
console.log('Is valid URL:', isValidUrl);

console.log('Testing StorageUtils.getHashFromURL...');
try {
  const hashFromUrl = await downloader.resolve(testHash);
  console.log('Hash from URL:', hashFromUrl);
} catch (error) {
  console.log('getHashFromURL error:', (error as Error).message);
}

console.log('Testing normalizeURL...');
try {
  const normalized = StorageUtils.normalizeURL(testHash);
  console.log('Normalized URL:', normalized);
} catch (error) {
  console.log('normalizeURL error:', (error as Error).message);
}

console.log('Test completed');
