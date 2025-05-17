import { createShapeId } from 'tldraw'

function registerImageGenAgent() {
  if (typeof window === 'undefined') return
  if ((window as { __imageGenAgentRegistered?: boolean }).__imageGenAgentRegistered) return
  ;(window as { __imageGenAgentRegistered?: boolean }).__imageGenAgentRegistered = true

  window.addEventListener('keydown', async (e) => {
    if ((e.key !== '3' && e.code !== 'Digit3') || e.repeat) return

    type TranscriptLine = { authorId?: string; text: string }
    type TranscriptStore = { lines: TranscriptLine[]; addLine: (line: TranscriptLine & { authorName?: string; timestamp?: Date }) => void }
    type CreateShapeChange = { type: 'createShape'; description: string; shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> } }
    type WhiteboardController = { applyChange: (change: CreateShapeChange) => void; editor: { uploadAsset: (blob: Blob) => Promise<{ src: string; meta: { width: number; height: number } }>; createShape: (shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> }) => void } }
    const store = (window as { __transcriptStore?: TranscriptStore }).__transcriptStore
    const controller = (window as { __whiteboardController?: WhiteboardController }).__whiteboardController
    if (!store || !controller) return

    // Build prompt from ALL user-authored transcript lines (exclude any *_agent authors)
    const prompt = store.lines
      .filter((l) => !(l.authorId && typeof l.authorId === 'string' && l.authorId.endsWith('_agent')))
      .map((l) => l.text)
      .join('\n')
      .trim()
    if (!prompt) return

    const res = await fetch('/api/image-gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!res.ok) {
      return
    }

    const { imageUrl } = await res.json()
    if (!imageUrl) return

    // Create a new Image shape backed by the asset store
    const id = createShapeId()
    const editor = (window as any).__editorInstance;
    const pageId = editor?.getCurrentPageId?.() || 'page:page';
    controller.editor.createShape({
      id,
      type: 'image',
      parentId: pageId as any,
      x: 500,
      y: 100,
      props: {
        url: imageUrl,
      },
      meta: { group: 'agent' },
    } as any)

    store.addLine({
      authorId: 'imagegen_agent',
      authorName: 'ImageGenBot',
      text: `🖼️ Image generated for "${prompt}"`,
      timestamp: new Date(),
    })
  })
}

registerImageGenAgent() 