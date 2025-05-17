import { createShapeId } from 'tldraw'

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
  if ((window as { __youtubeClipAgentRegistered?: boolean }).__youtubeClipAgentRegistered) return
  ;(window as { __youtubeClipAgentRegistered?: boolean }).__youtubeClipAgentRegistered = true


  window.addEventListener('keydown', async (e) => {
    if ((e.key !== '2' && e.code !== 'Digit2') || e.repeat) return


    type TranscriptLine = { authorId?: string; text: string }
    type TranscriptStore = { lines: TranscriptLine[]; addLine: (line: TranscriptLine & { authorName?: string; timestamp?: Date }) => void }
    type WhiteboardController = { editor: { createShape: (shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> }) => void } }
    const store = (window as { __transcriptStore?: TranscriptStore }).__transcriptStore
    if (!store) {
      return
    }

    const controller = (window as { __whiteboardController?: WhiteboardController }).__whiteboardController
    if (!controller) {
      return
    }

    // Find the latest transcript line that is NOT produced by an agent
    const latestLine = [...store.lines].reverse().find((l) => {
      // Assume agent authorIds end with '_agent'
      return !(l.authorId && typeof l.authorId === 'string' && l.authorId.endsWith('_agent'))
    })

    if (!latestLine) return

    const query: string | undefined = latestLine.text?.trim()
    if (!query) return


    // Call backend API
    let clip: { url: string; title: string } | null = null
    try {
      const res = await fetch('/api/youtube-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
      } else {
        const json = await res.json()
        if (json && json.url && json.title) {
          clip = { url: json.url, title: json.title }
        }
      }
    } catch {
      // ignore; fall back to default
    }

    if (!clip) {
      return
    }

    // Determine placement – try to place near viewport centre
    let x = 300
    let y = 100
    try {
      const editor = (window as { __editorInstance?: { getViewportPageBounds?: () => { center: { x: number; y: number } } } }).__editorInstance
      if (editor?.getViewportPageBounds) {
        const bounds = editor.getViewportPageBounds()
        x = bounds.center.x + 200 // offset to the right
        y = bounds.center.y
      }
    } catch {
      // ignore; fall back to default
    }

    const id = createShapeId()


    // Create an Embed shape for the YouTube clip
    const editor = (window as any).__editorInstance;
    const pageId = editor?.getCurrentPageId?.() || 'page:page';
    controller.editor.createShape({
      id,
      type: 'embed',
      parentId: pageId as any,
      x,
      y,
      props: {
        url: clip.url,
      },
      meta: { group: 'agent' },
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