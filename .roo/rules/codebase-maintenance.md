---
description: 
globs: 
alwaysApply: false
---
# Codebase Maintenance & Cleanup Guide

This project has evolved rapidly, and some files or patterns may be vestigial, duplicated, or only needed for development/testing. Use this guide to help keep the codebase clean and maintainable.

## Key Areas to Audit

### 1. LiveKit Token Endpoints
- Multiple endpoints exist for token generation:
  - [`src/app/api/get-token/route.ts`](mdc:src/app/api/get-token/route.ts)
  - [`src/app/api/livekit/route.ts`](mdc:src/app/api/livekit/route.ts)
  - [`src/app/api/refresh-token/route.ts`](mdc:src/app/api/refresh-token/route.ts)
  - [`src/app/api/create-agent/route.ts`](mdc:src/app/api/create-agent/route.ts)
- **Action:** Consider consolidating logic into a single endpoint or shared utility. Remove or deprecate legacy/unused endpoints.

### 2. Transcription Canvas & Controls
- There are multiple implementations:
  - [`src/components/TranscriptionCanvas.tsx`](mdc:src/components/TranscriptionCanvas.tsx)
  - [`src/components/transcription/TranscriptionCanvas.tsx`](mdc:src/components/transcription/TranscriptionCanvas.tsx)
  - [`src/components/transcription/TestControls.tsx`](mdc:src/components/transcription/TestControls.tsx)
- **Action:** Audit which are actually used in production. Move dev/test-only versions to a `devtools` or `playground` area, or remove if obsolete.

### 3. Logger Utilities
- There are two similar utilities:
  - [`src/components/videoconference/VideoLogger.ts`](mdc:src/components/videoconference/VideoLogger.ts)
  - [`src/utils/VideoLogger.ts`](mdc:src/utils/VideoLogger.ts)
- **Action:** Consolidate to a single logger utility.

### 4. Devtools & Test Harnesses
- Files like [`src/components/LiveKitTest.tsx`](mdc:src/components/LiveKitTest.tsx), [`src/components/TLDrawDebugger.tsx`](mdc:src/components/TLDrawDebugger.tsx), [`src/utils/tldraw-debug.ts`](mdc:src/utils/tldraw-debug.ts), and [`src/app/test-livekit/page.tsx`](mdc:src/app/test-livekit/page.tsx) are primarily for development/testing.
- **Action:** Move these to a dedicated `devtools` or `playground` directory, and ensure they're not bundled in production.

### 5. File/Import Consistency
- Some test files reference paths with different casing (e.g., `VideoConference/ConnectionManager` vs `videoconference/ConnectionManager`).
- **Action:** Standardize import paths to avoid issues on case-sensitive filesystems.

### 6. Mocks & Test Utilities
- Mocks in [`src/mocks/`](mdc:src/mocks) and test utilities in [`src/tests/`](mdc:src/tests) are for testing only.
- **Action:** Ensure these are not imported in production code.

## Questions to Ask During Audit
- Which files are actually imported/used in the main app?
- Are there duplicate or vestigial implementations (especially for token endpoints, transcription, or logging)?
- Are devtools/test harnesses needed in production, or can they be moved/removed?
- Are there features that have been abandoned or replaced, but the code remains?

## Best Practices
- Regularly audit for unused or duplicate files.
- Gate devtools/test harnesses behind environment checks or move them to a separate area.
- Consolidate utilities and shared logic.
- Document which files are "core" vs. "devtools" for future maintainers.
