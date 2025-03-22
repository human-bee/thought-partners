import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const data = await request.json();
  const { roomName, identity } = data;
  
  if (!roomName || !identity) {
    return NextResponse.json(
      { error: 'Missing roomName or identity' },
      { status: 400 }
    );
  }
  
  // Validate environment variables
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing LiveKit credentials' },
      { status: 500 }
    );
  }
  
  try {
    // Create a token specifically for reconnecting with proper permissions
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity,
        ttl: 60 * 60 * 2, // 2 hours in seconds
        name: identity, // Add name field for better debugging
      }
    );
    
    // Add all possible permissions to ensure video/audio works
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Explicitly add all permissions
      canPublishAudio: true,
      canPublishVideo: true,
      // Include even more explicit permissions to ensure compatibility
      canPublishSources: { camera: true, microphone: true, screen: true },
      // Add admin permissions as a last resort (not recommended for production)
      roomAdmin: true,
      roomCreate: true,
    });
    
    // Generate the token
    const token = at.toJwt();
    
    // Log token info for debugging
    console.log(`Generated refresh token for ${identity} with full publishing permissions`);
    
    return NextResponse.json({ 
      success: true,
      token,
      identity,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL
    });
    
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 