import { NextResponse } from 'next/server';

export async function GET() {
  const ENGINE_URL = 'http://localhost:10101';

  try {
    const res = await fetch(`${ENGINE_URL}/speakers`, {
      method: 'GET',
    });

    if (!res.ok) {
      return NextResponse.json(
        { speakers: [], error: `Failed to fetch speakers: ${res.statusText}` },
        { status: res.status }
      );
    }

    const speakers = await res.json();
    return NextResponse.json({ speakers });
  } catch (error) {
    console.error('AivisSpeech speakers fetch error:', error);
    // Return 200 with empty list so frontend can handle it gracefully without crashing
    return NextResponse.json({ 
      speakers: [], 
      error: 'AivisSpeech Engine not available' 
    });
  }
}
