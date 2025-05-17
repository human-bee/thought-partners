import { NextResponse } from 'next/server';

/**
 * API endpoint to perform LiveKit diagnostics
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { diagnostics } = data;

    // Log diagnostics to server log for analysis

    // Here you could persist diagnostics to a database or send them to a
    // monitoring service for further analysis

    return NextResponse.json({
      success: true,
      message: 'Diagnostics received',
      timestamp: new Date().toISOString(),
      issues: diagnostics.issues || []
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Simple ping endpoint for connectivity tests
 */
export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
} 