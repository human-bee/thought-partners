import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

// Environment variables for LiveKit
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export async function GET(req: NextRequest) {
  // Return 500 if API key or secret is missing
  if (!apiKey || !apiSecret) {
    console.error('LiveKit API key or secret is missing');
    return NextResponse.json(
      { error: 'LiveKit API key or secret is missing' },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const room = url.searchParams.get('room');
  const identity = url.searchParams.get('identity');

  // Return 400 if room or identity is missing
  if (!room || !identity) {
    console.error('Missing room or identity param', { room, identity });
    return NextResponse.json(
      { error: 'Missing room or identity param' },
      { status: 400 }
    );
  }

  try {
    // Create token with identity and name
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: identity // Use identity as name
    });

    // Grant permissions based on identity
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    // Generate token
    const token = at.toJwt();

    // Return token in JSON
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 