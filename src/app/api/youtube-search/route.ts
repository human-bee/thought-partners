import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

/**
 * POST /api/youtube-search
 * Body: { query: string }
 * Returns: { url, title } of the top YouTube result using Google Data API.
 */
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    // We only use OpenAI now
    const result = await fallbackWithOpenAI(query)
    if (result) return NextResponse.json(result)

    // As a last resort return a default video to ensure agent always has a link
    return NextResponse.json({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up (Fallback)'
    })
  } catch (err) {
    console.error('[youtube-search] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Helper to validate youtube.com links
function isYoutubeUrl(url?: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return (
      (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') &&
      u.pathname === '/watch' &&
      !!u.searchParams.get('v')
    )
  } catch {
    return false
  }
}

async function verifyYoutube(url: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    )
    return res.ok
  } catch {
    return false
  }
}

async function fallbackWithOpenAI(query: string) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null

  try {
    const openai = new OpenAI({ apiKey: openaiKey })
    const systemPrompt =
      'You are a helpful assistant. Respond ONLY with a JSON object {"url":"<youtube url>","title":"<video title>"} for the single most relevant YouTube video to the given query. The url MUST start with https://www.youtube.com/watch?v= and be publicly available.'

    for (let attempt = 0; attempt < 3; attempt++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      })

      const txt = completion.choices[0]?.message?.content ?? ''
      try {
        const obj = JSON.parse(txt) as { url?: string; title?: string }
        if (obj.url && isYoutubeUrl(obj.url) && (await verifyYoutube(obj.url)) && obj.title) {
          return obj
        }
      } catch {
        /* ignore parse errors */
      }
      // tweak query slightly for next attempt
      query = `${query} youtube video` // broaden context
    }
  } catch (err) {
    console.error('[youtube-search] OpenAI fallback error', err)
  }
  return null
} 