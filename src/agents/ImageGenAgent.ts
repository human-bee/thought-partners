import { createShapeId, toRichText } from 'tldraw'

function registerImageGenAgent() {
  if (typeof window === 'undefined') return
  if ((window as any).__imageGenAgentRegistered) return
  ;(window as any).__imageGenAgentRegistered = true

  window.addEventListener('keydown', async (e) => {
    if ((e.key !== '3' && e.code !== 'Digit3') || e.repeat) return

    const store = (window as any).__transcriptStore
    const controller = (window as any).__whiteboardController
    if (!store || !controller) return

    // Build prompt from ALL user-authored transcript lines (exclude any *_agent authors)
    const prompt = store.lines
      .filter((l: any) => !(l.authorId && typeof l.authorId === 'string' && l.authorId.endsWith('_agent')))
      .map((l: any) => l.text)
      .join('\n')
      .trim()
    if (!prompt) return

    const res = await fetch('/api/image-gen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!res.ok) {
      console.error('[ImageGenAgent] backend error', await res.text())
      return
    }

    const { imageUrl } = await res.json()
    if (!imageUrl) return

    const id = createShapeId()
    controller.applyChange({
      type: 'createShape',
      description: 'image generated note',
      shape: {
        id: id as any,
        type: 'note',
        x: 500,
        y: 100,
        props: {
          richText: toRichText(`![img](${imageUrl})`),
          color: 'purple',
          size: 'm',
          font: 'draw',
          align: 'start',
          verticalAlign: 'middle',
          growY: true,
        },
      },
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