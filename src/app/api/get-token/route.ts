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
  
  // Create a token with specified identity and room access
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: username,
    }
  );
  
  // Grant appropriate permissions
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  
  const token = at.toJwt();
  
  return NextResponse.json({ token });
} 