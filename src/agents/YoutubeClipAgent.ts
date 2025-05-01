import { createShapeId, toRichText } from 'tldraw'

/**
 * Registers the YouTube Clip agent. Press the `2` key to:
 *  – read the latest transcript line
 *  – call `/api/youtube-search` to find a relevant clip
 *  – add a sticky note linking to the clip (placed near the user viewport)
 *  – append a summary line to the transcript
 */
export function registerYoutubeClipAgent() {
  if (typeof window === 'undefined') return
  // Prevent double-registration (HMR etc.)
  if ((window as any).__youtubeClipAgentRegistered) return
  ;(window as any).__youtubeClipAgentRegistered = true

  console.log('[YoutubeClipAgent] Registered key listener')

  window.addEventListener('keydown', async (e) => {
    if ((e.key !== '2' && e.code !== 'Digit2') || e.repeat) return

    console.log('[YoutubeClipAgent] 2 key pressed')

    const store = (window as any).__transcriptStore
    if (!store) {
      console.warn('[YoutubeClipAgent] Transcript store not ready')
      return
    }

    const controller = (window as any).__whiteboardController
    if (!controller) {
      console.warn('[YoutubeClipAgent] Whiteboard controller not ready')
      return
    }

    // Find the latest transcript line that is NOT produced by an agent
    const latestLine = [...store.lines].reverse().find((l: any) => {
      // Assume agent authorIds end with '_agent'
      return !(l.authorId && typeof l.authorId === 'string' && l.authorId.endsWith('_agent'))
    })

    if (!latestLine) return

    const query: string | undefined = latestLine.text?.trim()
    if (!query) return

    console.log('[YoutubeClipAgent] Searching YouTube for:', query)

    // Call backend API
    let clip: { url: string; title: string } | null = null
    try {
      const res = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        console.error('[YoutubeClipAgent] /api/youtube-search error', res.status)
      } else {
        const json = await res.json()
        if (json && json.url && json.title) {
          clip = { url: json.url, title: json.title }
          console.log('[YoutubeClipAgent] API returned', clip)
        }
      }
    } catch (err) {
      console.error('[YoutubeClipAgent] youtube-search fetch error', err)
    }

    if (!clip) {
      console.warn('[YoutubeClipAgent] No clip found')
      return
    }

    // Determine placement – try to place near viewport centre
    let x = 300
    let y = 100
    try {
      const editor = (window as any).__editorInstance
      if (editor?.getViewportPageBounds) {
        const bounds = editor.getViewportPageBounds()
        x = bounds.center.x + 200 // offset to the right
        y = bounds.center.y
      }
    } catch (err) {
      // ignore; fall back to default
    }

    const id = createShapeId()

    console.log('[YoutubeClipAgent] Creating note at', { x, y })

    controller.applyChange({
      type: 'createShape',
      description: 'youtube clip note',
      shape: {
        id: id as any,
        type: 'note',
        x,
        y,
        props: {
          richText: toRichText(`[${clip.title}](${clip.url})`),
          color: 'blue',
          size: 'm',
          font: 'draw',
          align: 'start',
          verticalAlign: 'middle',
          growY: true,
        },
      },
    } as any)

    // Push summary to transcript
    store.addLine({
      authorId: 'youtube_agent',
      authorName: 'YouTubeBot',
      text: `YouTube clip for "${query}": ${clip.title} (${clip.url})`,
      timestamp: new Date(),
    })
  })
}

// Auto-register
registerYoutubeClipAgent() 