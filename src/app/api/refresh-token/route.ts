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
        ttl: 60 * 60 * 6, // 6 hours in seconds - longer TTL to prevent expiration issues
        name: identity, // Add name field for better debugging
      }
    );
    
    // Add ALL possible permissions to ensure video/audio works
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      
      // Explicitly add all permissions for media publishing
      canPublishAudio: true,
      canPublishVideo: true,
      
      // Make these more explicit for iOS handoff compatibility
      canPublishSources: { 
        camera: true, 
        microphone: true, 
        screen: true,
        screen_share: true,
      },
      
      // Add more detailed permissions
      participantPermission: {
        canPublish: true,
        canPublishAudio: true,
        canPublishVideo: true,
        canSubscribe: true,
      },
      
      // Grant elevated privileges for reconnection scenarios
      roomAdmin: true,
      roomCreate: true,
      
      // Set high capacity limits
      maxParticipants: 20,
      canUpdateOwnMetadata: true,
    });
    
    // Generate the token
    const token = await at.toJwt();
    
    // Log token info for debugging
    console.log(`Generated refresh token for ${identity} with enhanced publishing permissions`);
    console.log(`Full permissions set: admin, create, publish audio/video/data with all sources`);
    
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