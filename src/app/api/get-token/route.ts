import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// GET method for backward compatibility with existing code
export async function GET(request: NextRequest) {
  console.log('Token request received:', {
    apiKey: LIVEKIT_API_KEY ? 'defined' : 'undefined',
    apiSecret: LIVEKIT_API_SECRET ? 'defined' : 'undefined'
  });

  const searchParams = request.nextUrl.searchParams;
  const room = searchParams.get('room');
  const username = searchParams.get('username');
  
  console.log('Request parameters:', { room, username });
  
  return handleTokenRequest(room, username);
}

// POST method to match the parent project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room, username } = body;
    
    return handleTokenRequest(room, username);
  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}

// Common handler for both GET and POST
async function handleTokenRequest(room: string | null, username: string | null) {
  if (!room || !username) {
    console.error('Missing parameters:', { room, username });
    return NextResponse.json(
      { error: 'Missing required parameters: room and username' },
      { status: 400 }
    );
  }
  
  // Validate environment variables
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('Environment variables missing:', {
      LIVEKIT_API_KEY: !!LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET: !!LIVEKIT_API_SECRET
    });
    return NextResponse.json(
      { error: 'Server configuration error - LiveKit credentials not found' },
      { status: 500 }
    );
  }
  
  try {
    console.log('Creating AccessToken with params:', {
      room,
      username,
      apiKeyLength: LIVEKIT_API_KEY.length,
      apiSecretLength: LIVEKIT_API_SECRET.length
    });

    // Create a token with specified identity and room access
    const at = new AccessToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      {
        identity: username,
        name: username,
        ttl: 3600 * 12, // 12 hours in seconds
      }
    );
    
    // Grant appropriate permissions
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishAudio: true,
      canPublishVideo: true,
      canPublishSources: [
        TrackSource.CAMERA,
        TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO
      ]
    });
    
    console.log('Generating JWT token...');
    const token = await at.toJwt(); // Make sure to await the token generation
    
    // Verify token is a string
    if (typeof token !== 'string') {
      console.error('Token generation error: Token is not a string', token);
      return NextResponse.json(
        { error: 'Generated token is not valid' },
        { status: 500 }
      );
    }
    
    console.log('Token generated successfully');
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Detailed error in token generation:', {
      error,
      message: error.message,
      stack: error.stack,
      room,
      username
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate token',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 