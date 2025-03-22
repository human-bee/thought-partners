import { NextRequest, NextResponse } from 'next/server';
import { MultimodalAgent } from '@livekit/agents';
import { DeepgramTranscriber } from '@livekit/agents-plugin-deepgram';

export async function POST(request: NextRequest) {
  const data = await request.json();
  const { roomName } = data;
  
  if (!roomName) {
    return NextResponse.json(
      { error: 'Missing room name' },
      { status: 400 }
    );
  }
  
  try {
    // Create a transcription agent with diarization
    const transcriber = new DeepgramTranscriber({
      apiKey: process.env.DEEPGRAM_API_KEY!,
      options: {
        diarize: true,
        model: 'nova-2',
        language: 'en-US',
      },
    });
    
    // Create and initialize the agent
    const agent = new MultimodalAgent({
      livekit: {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL!,
        apiKey: process.env.LIVEKIT_API_KEY!,
        apiSecret: process.env.LIVEKIT_API_SECRET!,
      },
      room: roomName,
      identity: 'ai-transcriber',
    });
    
    // Set up transcription pipeline
    agent.use(transcriber);
    
    // Connect the agent to the room
    await agent.connect();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Agent created and connected' 
    });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 