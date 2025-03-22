import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { roomName } = await request.json();
    
    if (!roomName) {
      return NextResponse.json(
        { error: 'Missing roomName' },
        { status: 400 }
      );
    }
    
    // Mock implementation for now - would connect to LiveKit Agents SDK in production
    console.log(`Creating agent for room: ${roomName}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
} 