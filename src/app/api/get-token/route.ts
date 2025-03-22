import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const room = searchParams.get('room');
  const username = searchParams.get('username');
  
  if (!room || !username) {
    return NextResponse.json(
      { error: 'Missing room or username' },
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
    // Create a token with specified identity and room access
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: username,
        ttl: 60 * 60 * 6, // 6 hours in seconds
        name: username, // Add name field for better debugging
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
      
      roomAdmin: false, // Not an admin, but a regular user
      roomCreate: false,
    });
    
    const token = await at.toJwt();
    
    // Log full token details for debugging
    console.log(`Generated token for ${username} with full publishing permissions`);
    console.log(`Token details: roomJoin, canPublish, canPublishAudio, canPublishVideo, canPublishSources all set to true`);
    
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
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 