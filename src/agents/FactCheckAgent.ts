import { createShapeId, toRichText } from 'tldraw'

/**
 * Registers the fact-checking agent. It adds a keydown listener for the `1` key. When triggered it:
 *  – grabs the latest transcript line (or all lines if you change `linesToCheck`)
 *  – asks OpenAI GPT-4o to fact-check the claim(s)
 *  – creates a sticky note on the whiteboard with the verdict
 *  – appends a summary line to the transcript
 */
export function registerFactCheckAgent() {
  if (typeof window === 'undefined') return
  // Avoid double-registering (HMR / multiple imports)
  if ((window as any).__factCheckAgentRegistered) return
  ;(window as any).__factCheckAgentRegistered = true


  window.addEventListener('keydown', async (e) => {
    if ((e.key !== '1' && e.code !== 'Digit1') || e.repeat) return


    const store = (window as any).__transcriptStore
    if (!store) {
      return
    }

    const controller = (window as any).__whiteboardController
    if (!controller) {
      return
    }

    // Decide which lines to fact-check. Here we use only the latest.
    const linesToCheck = store.lines.slice(-1)
    if (!linesToCheck.length) return

    // Build the user content string (join if multiple)
    const userContent = linesToCheck.map((l: any) => l.text).join('\n')

    // Call backend API for fact-checking (uses server-side OPENAI_API_KEY)
    let factResults: Array<{ claim: string; verdict: string; score: number }> = []
    try {
      const res = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userContent }),
      })

      if (!res.ok) {
        return
      }

      const json = await res.json()
      if (Array.isArray(json.results)) {
        factResults = json.results
      }
    } catch (err) {
      return
    }

    if (!factResults.length) {
      return
    }

    // Create notes and transcript lines
    factResults.forEach((res, idx) => {
      const { claim, verdict, score } = res
      const id = createShapeId()
      const color = score >= 8 ? 'green' : score >= 5 ? 'yellow' : 'red'
      // y-offset each note a bit so they don't overlap
      const y = 100 + idx * 140

      const editor = (window as any).__editorInstance;
      const pageId = editor?.getCurrentPageId?.() || 'page:page';
      controller.editor.createShape({
        id: id as string,
        type: 'note',
        parentId: pageId as any,
        x: 100,
        y,
        props: {
          richText: toRichText(`Fact-check: ${verdict} (${score}/10)`),
          color,
          size: 'm',
          font: 'draw',
          align: 'start',
          verticalAlign: 'middle',
          growY: true,
        },
        meta: { group: 'agent' },
      } as any)

      store.addLine({
        authorId: 'factcheck_agent',
        authorName: 'FactCheckBot',
        text: `Fact-check for "${claim}": ${verdict} (${score}/10)`,
        timestamp: new Date(),
      })
    })
  })
}

// Auto-register immediately on import
registerFactCheckAgent() 