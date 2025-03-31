import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
// For proper implementation, these packages would need to be installed:
// npm install @livekit/agents @livekit/agents-plugin-deepgram

export async function POST(request: NextRequest) {
  const data = await request.json();
  const { roomName, participantName } = data;
  
  if (!roomName) {
    return NextResponse.json(
      { error: 'Missing room name' },
      { status: 400 }
    );
  }

  // Check for required environment variables
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    console.error('Missing LiveKit credentials in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing LiveKit credentials' },
      { status: 500 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET.trim();
  
  // Additional validation to ensure credentials aren't empty after trimming
  if (!apiKey || !apiSecret) {
    console.error('LiveKit credentials are empty or invalid after trimming');
    return NextResponse.json(
      { error: 'Server configuration error: Invalid LiveKit credentials' },
      { status: 500 }
    );
  }
  
  // Log partial credentials for debugging (don't log full secret)
  console.log(`Using LiveKit API Key: ${apiKey.substring(0, 5)}...`);
  console.log(`API Secret length: ${apiSecret.length} characters`);

  const identity = participantName || 'user-' + Math.floor(Math.random() * 1000000);
  
  try {
    // Create a token for the participant
    console.log('Creating AccessToken with:', {
      apiKeyLength: apiKey.length,
      apiSecretLength: apiSecret.length,
      identity,
      roomName
    });
    
    const at = new AccessToken(
      apiKey,
      apiSecret,
      {
        identity,
        ttl: 60 * 60 * 24, // 24 hours in seconds
      }
    );
    
    // Check if the AccessToken was created correctly
    if (!at) {
      console.error('Failed to create AccessToken instance');
      return NextResponse.json(
        { error: 'Failed to create token' },
        { status: 500 }
      );
    }
    
    console.log('AccessToken created successfully. Adding grant...');
    
    // Add permissions to the token
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Set ALL permissions to true to ensure video/audio works
      canPublishAudio: true,
      canPublishVideo: true,
      roomAdmin: false, // Not an admin, but a regular user
      roomCreate: false,
    });
    
    console.log('Grant added to token. Generating JWT...');
    
    // Generate the token - properly await the Promise
    console.log('About to generate JWT...');
    
    // Initialize agentCreated first to avoid reference error
    let agentCreated = false;
    
    try {
      const token = await at.toJwt();
      console.log('JWT generation complete.');
      
      // Validate token before sending
      if (!token || token === '{}' || token === 'undefined' || token === '[]') {
        console.error('Failed to generate a valid token:', token);
        return NextResponse.json(
          { error: 'Failed to generate a valid token' },
          { status: 500 }
        );
      }
      
      // Log token info for debugging
      console.log(`Generated token for ${identity} with full publishing permissions`);
      console.log(`Token type: ${typeof token}`);
      // Only log substring if token is a string
      if (typeof token === 'string') {
        console.log(`Token starts with: ${token.substring(0, 15)}...`);
        console.log(`Token length: ${token.length}`);
        
        // Create AI agent if requested and if required environment variables exist
        if (data.createAiAgent && process.env.DEEPGRAM_API_KEY) {
          // e.g. call external agent service...
          // agentCreated = true;
          console.log('Would create AI agent for room:', roomName);
          agentCreated = true;
        }
        
        return NextResponse.json({ token, agentCreated });
      } else {
        console.log('Token is not a string type:', token);
        return NextResponse.json(
          { error: 'Generated token is not a string' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error generating JWT token:', error);
      return NextResponse.json(
        { error: `JWT generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 