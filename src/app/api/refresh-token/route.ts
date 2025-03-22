import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json();
    const { roomName, identity } = body;

    // Enhanced input validation
    if (!roomName || typeof roomName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid roomName parameter' },
        { status: 400 }
      );
    }

    if (!identity || typeof identity !== 'string') {
      return NextResponse.json(
        { error: 'Invalid identity parameter' },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error('Missing LiveKit credentials:', {
        hasApiKey: !!LIVEKIT_API_KEY,
        hasApiSecret: !!LIVEKIT_API_SECRET
      });
      return NextResponse.json(
        { error: 'Server configuration error - missing LiveKit credentials' },
        { status: 500 }
      );
    }

    try {
      // Create token with specified identity
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name: identity,
        ttl: 60 * 60 * 12, // 12 hours in seconds
      });

      // Add comprehensive permissions
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
        
        // Add all possible permissions
        participantPermission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          hidden: false,
          recorder: false,
        },
      });

      // Generate the token
      const token = await at.toJwt();

      // Validate generated token
      if (!token || typeof token !== 'string' || token === '') {
        throw new Error('Generated token is invalid');
      }

      // Log success for debugging
      console.log(`Successfully generated token for ${identity} in room ${roomName} with full permissions`);

      return NextResponse.json({ token });
    } catch (tokenError) {
      console.error('Error during token generation:', tokenError);
      return NextResponse.json(
        { error: 'Failed to generate token - internal error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 