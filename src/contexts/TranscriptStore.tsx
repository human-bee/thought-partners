import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export interface TranscriptLine {
  id: string // unique id (could be a uuid or timestamp based)
  authorId: string
  authorName: string
  text: string
  timestamp: Date
}

interface TranscriptStoreValue {
  lines: TranscriptLine[]
  addLine: (line: Omit<TranscriptLine, 'id'>) => void
  clear: () => void
  // convenience accessors
  asMarkdown: () => string
}

const TranscriptStoreContext = createContext<TranscriptStoreValue | null>(null)

export function TranscriptStoreProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<TranscriptLine[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('transcript_lines')
      return raw ? (JSON.parse(raw) as TranscriptLine[]).map((l) => ({ ...l, timestamp: new Date(l.timestamp) })) : []
    } catch {
      return []
    }
  })

  const addLine = useCallback((line: Omit<TranscriptLine, 'id'>) => {
    setLines((prev) => [
      ...prev,
      {
        ...line,
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      },
    ])
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const asMarkdown = useCallback(() => {
    return lines
      .map((l) => `- **${l.authorName}** (${l.timestamp.toLocaleTimeString()}): ${l.text}`)
      .join('\n')
  }, [lines])

  const value = useMemo<TranscriptStoreValue>(
    () => ({ lines, addLine, clear, asMarkdown }),
    [lines, addLine, clear, asMarkdown]
  )

  // Expose to global window for external agents / debugging
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __transcriptStore?: TranscriptStoreValue }).__transcriptStore = value
    }
  }, [value])

  // Persist to localStorage whenever lines change
  React.useEffect(() => {
    try {
      localStorage.setItem('transcript_lines', JSON.stringify(lines))
    } catch {}
  }, [lines])

  return (
    <TranscriptStoreContext.Provider value={value}>{children}</TranscriptStoreContext.Provider>
  )
}

export function useTranscriptStore() {
  const ctx = useContext(TranscriptStoreContext)
  if (!ctx) throw new Error('useTranscriptStore must be used within a TranscriptStoreProvider')
  return ctx
} 