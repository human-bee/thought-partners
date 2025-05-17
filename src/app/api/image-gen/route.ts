import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Buffer } from 'buffer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Server misconfigured – missing OPENAI_API_KEY' }, { status: 500 })
    }

    let safePrompt: string = prompt
    if (safePrompt.length > 1000) safePrompt = safePrompt.slice(0, 1000)

    const openai = new OpenAI({ apiKey })

    let imageUrl: string | undefined
    try {
      const out = await openai.images.generate({
        model: 'dall-e-3',
        prompt: safePrompt,
        n: 1,
        size: '512x512',
      })
      imageUrl = out.data?.[0]?.url
    } catch (err) {
    }

    if (!imageUrl) {
      try {
        const out = await openai.images.generate({
          model: 'dall-e-2',
          prompt: safePrompt,
          n: 1,
          size: '512x512',
        })
        imageUrl = out.data?.[0]?.url
      } catch (err) {
        return NextResponse.json({ error: 'Generation failed', details: (err as Error).message }, { status: 500 })
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    // Return the OpenAI image URL directly
    return NextResponse.json({ imageUrl })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
} 