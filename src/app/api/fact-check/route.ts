import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Server misconfigured – missing OPENAI_API_KEY' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey })

    const systemPrompt = `You are a fact-checking assistant. For each factual claim in the given text, return a JSON object with a single key \"results\" whose value is an array of objects. Each object must have:\n- claim (string)\n- verdict (concise, <= 20 words)\n- score (integer 1-10, 10 means definitely true).\nIf no factual claim is present, return {\"results\": []}.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? '{"results":[]}'
    let resultsArr: Array<{ claim: string; verdict: string; score: number }> = []
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        resultsArr = parsed
      } else if (Array.isArray(parsed.results)) {
        resultsArr = parsed.results
      }
    } catch {
      // ignore parse errors; leave empty
    }

    return NextResponse.json({ results: resultsArr })
  } catch (err) {
    console.error('[fact-check API] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
} 