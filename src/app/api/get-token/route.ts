import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// GET method for backward compatibility with existing code
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const room = searchParams.get('room');
  const username = searchParams.get('username');
  
  return handleTokenRequest(room, username);
}

// POST method to match the parent project
export async function POST(request: NextRequest) {
  try {
    // Parse body
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
    return NextResponse.json(
      { error: 'Missing required parameters: room and username' },
      { status: 400 }
    );
  }
  
  // Validate environment variables
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not defined');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }
  
  try {
    // Create a token with specified identity and room access
    const at = new AccessToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      {
        identity: username,
        name: username,
        ttl: '12h', // Token valid for 12 hours
      }
    );
    
    // Grant appropriate permissions
    at.addGrant({ 
      roomJoin: true, 
      room, 
      canPublish: true, 
      canSubscribe: true,
      canPublishData: true,
      
      // Explicitly add these permissions for audio/video publishing
      canPublishAudio: true,
      canPublishVideo: true,
      
      // Add more detailed permissions
      participantPermission: {
        canPublish: true,
        canPublishAudio: true,
        canPublishVideo: true,
        canSubscribe: true,
      },
      
      // Add all possible video and audio sources
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
      
      roomAdmin: false, // Not an admin, but a regular user
      roomCreate: false,
    });
    
    // Log token details for debugging
    console.log(`Generating token for ${username} with full publishing permissions`);
    console.log(`Token details: roomJoin=true, canPublish=true, canPublishAudio=true, canPublishVideo=true, all sources allowed`);
    
    const token = await at.toJwt();
    
    // Verify token is a string
    if (typeof token !== 'string') {
      console.error('Token generation error: Token is not a string', token);
      return NextResponse.json(
        { error: 'Generated token is not valid' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 