// Simple script to test LiveKit token generation
require('dotenv').config({ path: './thought-partners/.env.local' });
const { AccessToken } = require('livekit-server-sdk');

// Get LiveKit credentials from environment
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

console.log('Testing LiveKit token generation with:');
console.log('API Key:', apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING');
console.log('API Secret:', apiSecret ? 'PRESENT' : 'MISSING');
console.log('URL:', url || 'undefined');

if (!apiKey || !apiSecret) {
  console.error('ERROR: Missing LiveKit credentials in environment variables!');
  process.exit(1);
}

// Use async function to properly await the token generation
async function testTokenGeneration() {
  try {
    // Create a test token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: 'test-user',
      ttl: 60 * 60 // 1 hour
    });
    
    // Add basic permissions
    at.addGrant({
      roomJoin: true,
      room: 'test-room',
      canPublish: true,
      canSubscribe: true
    });
    
    console.log('Generating token...');
    
    // Generate JWT - properly await the Promise
    const token = await at.toJwt();
    
    console.log('\nToken generation result:');
    console.log('Token type:', typeof token);
    if (typeof token === 'string') {
      console.log('Token length:', token.length);
      console.log('Token preview:', token.substring(0, 20) + '...');
      console.log('\nSUCCESS: Token generation is working correctly!');
    } else {
      console.error('\nERROR: Generated token is not a string:', token);
      process.exit(1);
    }
  } catch (error) {
    console.error('\nERROR: Failed to generate token:', error);
    process.exit(1);
  }
}

// Run the test
testTokenGeneration(); 