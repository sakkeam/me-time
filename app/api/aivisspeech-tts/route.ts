import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, styleId } = await req.json();

    if (!text || styleId === undefined) {
      return NextResponse.json(
        { error: 'Missing text or styleId' },
        { status: 400 }
      );
    }

    const ENGINE_URL = 'http://localhost:10101';

    // Step 1: Create audio query
    const queryUrl = new URL(`${ENGINE_URL}/audio_query`);
    queryUrl.searchParams.append('text', text);
    queryUrl.searchParams.append('speaker', styleId.toString());

    const queryRes = await fetch(queryUrl.toString(), {
      method: 'POST',
    });

    if (!queryRes.ok) {
      const errorText = await queryRes.text();
      console.error('Audio query failed:', errorText);
      return NextResponse.json(
        { error: `Audio query failed: ${queryRes.statusText}` },
        { status: queryRes.status }
      );
    }

    const audioQuery = await queryRes.json();

    // Set sampling rate to 24000Hz to match OpenAI and client expectations
    audioQuery.outputSamplingRate = 24000;

    // Step 2: Synthesize
    const synthesisUrl = new URL(`${ENGINE_URL}/synthesis`);
    synthesisUrl.searchParams.append('speaker', styleId.toString());

    const synthesisRes = await fetch(synthesisUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(audioQuery),
    });

    if (!synthesisRes.ok) {
      const errorText = await synthesisRes.text();
      console.error('Synthesis failed:', errorText);
      return NextResponse.json(
        { error: `Synthesis failed: ${synthesisRes.statusText}` },
        { status: synthesisRes.status }
      );
    }

    const wavBuffer = await synthesisRes.arrayBuffer();
    const base64WAV = Buffer.from(wavBuffer).toString('base64');

    return NextResponse.json({ audio: base64WAV });
  } catch (error) {
    console.error('AivisSpeech TTS error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
