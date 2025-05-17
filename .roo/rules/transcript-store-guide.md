---
description:
globs:
alwaysApply: false
---
# Accessing the Transcript Store for AI / LLM Agents

The global transcript is managed by [TranscriptStore.tsx](mdc:src/contexts/TranscriptStore.tsx).

## What the store provides
* `lines`: `TranscriptLine[]` – an ordered array of every speech-to-text entry that has been committed.
* `addLine(line)` – append a new `TranscriptLine` (agents **must** omit the `id`; it is generated automatically).
* `clear()` – wipe all lines (use sparingly).
* `asMarkdown()` – convenience helper that formats the entire transcript as bullet-point markdown.

## Real-time access pattern for agents
1. **Window hook (simplest)**  
   The provider exposes the live store on the browser `window`:
   ```ts
   const store = window.__transcriptStore!
   const md   = store.asMarkdown()
   const last = store.lines.at(-1)
   ```
   This object is fully reactive because the provider replaces it on every update; the reference **changes**, so re-grab it or subscribe (see below).

2. **React hook (preferred inside React trees)**  
   ```ts
   import { useTranscriptStore } from '@/contexts/TranscriptStore'
   const { lines, addLine } = useTranscriptStore()
   ```

3. **Mutation rules for agents**
   • Always set `authorId` & `authorName` to identify the agent.  
   • Populate `text` with the content.  
   • Leave `id` blank – the store will generate it.
   ```ts
   store.addLine({
     authorId: 'agent_xyz',
     authorName: 'BrainyBot',
     text: '✅ Fact-check passed',
     timestamp: new Date()
   })
   ```

## Persistence
The provider mirrors `lines` into `localStorage` under the key `transcript_lines` every time it changes. Reading that key is a fast, non-reactive snapshot.

## Single source of truth
Only **CollaborativeBoard** writes user speech lines; agents should read (and may append system notes) from the same store to avoid divergence.

---
Use this rule whenever you need to fetch or append transcript data for LLM prompts, fact-checking, or summarisation tasks.
