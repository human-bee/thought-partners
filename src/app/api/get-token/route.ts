import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

function getParam(obj: any, ...keys: string[]) {
  for (const key of keys) {
    if (typeof obj.get === 'function') {
      // URLSearchParams
      const val = obj.get(key);
      if (val) return val;
    } else if (key in obj && obj[key]) {
      return obj[key];
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const room = getParam(params, 'room', 'roomName');
  const username = getParam(params, 'username', 'identity', 'participantName');
  const refresh = params.get('refresh') === 'true';
  return handleTokenRequest({ room, username, refresh });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const room = getParam(body, 'room', 'roomName');
    const username = getParam(body, 'username', 'identity', 'participantName');
    const refresh = !!body.refresh;
    return handleTokenRequest({ room, username, refresh });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
  }
}

async function handleTokenRequest({ room, username, refresh }: { room: string | null, username: string | null, refresh?: boolean }) {
  if (!room || !username) {
    return NextResponse.json({ error: 'Missing required parameters: room and username' }, { status: 400 });
  }
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: 'Server configuration error - LiveKit credentials not found' }, { status: 500 });
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: username,
      name: username,
      ttl: 60 * 60 * 12, // 12 hours in seconds
    });

    // Grant all relevant permissions
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: [
        TrackSource.CAMERA,
        TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO
      ],
    });

    const token = await at.toJwt();
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Generated token is not valid' }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate token', details: error.message }, { status: 500 });
  }
} 