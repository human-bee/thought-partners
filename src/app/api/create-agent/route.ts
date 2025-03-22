import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
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
      // Include even more explicit permissions to ensure compatibility
      canPublishSources: { camera: true, microphone: true, screen: true },
      roomAdmin: false, // Not an admin, but a regular user
      roomCreate: false,
    });
    
    console.log('Grant added to token. Generating JWT...');
    
    // Generate the token - properly await the Promise
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
    } else {
      console.log('Token is not a string type:', token);
      return NextResponse.json(
        { error: 'Generated token is not a string' },
        { status: 500 }
      );
    }
    
    // Create AI agent if requested and if required environment variables exist
    let agentCreated = false;

    if (data.createAiAgent && process.env.DEEPGRAM_API_KEY) {
      // Note: This part would require deploying a separate service
      // The commented-out code below is a placeholder for how it would work
      // but would require an actual agent server to implement
      
      /*
      // Use LiveKit's server-side SDK to create an agent
      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      
      // Call external agent service
      const response = await fetch('https://your-agent-service.com/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          serverUrl,
          apiKey,
          apiSecret,
          deepgramApiKey: process.env.DEEPGRAM_API_KEY,
        }),
      });
      
      const agentResponse = await response.json();
      agentCreated = agentResponse.success;
      */
      
      // For now, just log that this would happen in a real implementation
      console.log('Would create AI agent for room:', roomName);
      agentCreated = false;
    }
    
    return NextResponse.json({ 
      success: true,
      token,
      identity,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
      agentCreated
    });
    
  } catch (error: any) {
    console.error('Error creating token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 