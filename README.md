# Thought Partners: Collaborative Whiteboard with Video Conferencing

A real-time collaborative application built with Next.js that combines a whiteboard using TLDraw and video conferencing with LiveKit.

---

## Features

- **Real-time whiteboard collaboration** using TLDraw, with each participant's transcriptions appended to their own note for clarity.
- **Video conferencing** with LiveKit for real-time communication.
- **Room-based collaboration**: users join specific rooms via unique URLs.
- **Speech-to-text transcription**: spoken words are transcribed and appear as collaborative notes on the whiteboard, organized by participant and minute.
- **One-minute chunking**: transcriptions are grouped into one-minute segments, visually organized on the canvas.
- **Developer tools**: includes a TLDraw Debugger and extensive logging for troubleshooting.
- **Next.js 13+ compatibility**: all interactive components are client components (`"use client"`).

---

## How It Works

- **Joining a Room:**
  - Users join a collaborative session by navigating to `/whiteboard/[roomId]` (replace `[roomId]` with any unique identifier).
  - Enter your name to join the room and connect to the shared whiteboard and video call.
- **Whiteboard & Transcription:**
  - The whiteboard uses TLDraw for real-time drawing and collaborative notes.
  - Speech-to-text transcriptions are appended to each participant's note, chunked by minute, and synchronized across all users.
- **Video Conferencing:**
  - LiveKit provides real-time video and audio, appearing in a floating panel within the whiteboard interface.
- **Transcription Controls:**
  - Users can start/stop transcription, see progress bars, and view minute-based note organization.
- **AI & Research Features:**
  - (If enabled) AI features use OpenAI, Perplexity, Anthropic, etc., for enhanced transcription, web search, or research tools.
- **Debugging Tools:**
  - TLDraw Debugger and extensive logging are available for developers.
- **Responsive Design:**
  - The app is styled with TailwindCSS and adapts to different screen sizes.

---

## Architecture

- **Frontend:** Next.js (App Router, React 19)
- **Whiteboard:** TLDraw for collaborative drawing and note-taking
- **Video:** LiveKit for WebRTC-based video conferencing
- **Transcription:** Web Speech API for speech-to-text, synchronized via LiveKit data channels
- **Authentication:** LiveKit tokens for secure room access
- **Client/Server Split:** The main whiteboard page delegates all client logic to `ClientOnlyWhiteboardRoom` for SSR compatibility
- **API Endpoints:** Custom API routes for token management and (optionally) AI agent creation
- **Environment Management:** Uses `EnvInitializer` and `clientEnv` for safe environment variable access on the client

---

## Extensibility & Customization

- **Adding new AI providers:**
  - The architecture supports plugging in new AI APIs by adding keys and updating API routes.
- **Customizing the whiteboard:**
  - Developers can extend TLDraw shapes, add new controls, or change the layout.
- **Global editor instance:**
  - The TLDraw editor is accessible globally for debugging and extension.

---

## Developer Onboarding

- See `for-the-new-dev.md` for a deep dive into the transcription system, data flow, and minute-chunking logic.
- The TLDraw editor instance is accessible globally for debugging.
- Use the TLDraw Debugger (`src/components/TLDrawDebugger.tsx`) for diagnostics and to test note creation.
- All interactive components are client components (`"use client"`).
- New files and utilities include:
  - `src/app/whiteboard/[roomId]/ClientOnlyWhiteboardRoom.tsx`
  - `src/components/TLDrawDebugger.tsx`
  - `src/hooks/useIsClient.ts`
  - `src/utils/tldraw-debug.ts`
  - `for-the-new-dev.md` (developer onboarding and architecture)

---

## Testing & Quality

- **Jest-based test suite:**
  - Run with `npm run test`, `npm run test:watch`, or `npm run test:coverage`.
- **Linting and formatting:**
  - ESLint and TailwindCSS are used for code quality and styling.
- **LiveKit Token Test Script:**
  - Use `src/scripts/test-token.js` to verify your LiveKit credentials and token generation.

---

## Troubleshooting & Debugging

- **Environment Variables:**
  - Use the `EnvInitializer` and `clientEnv` utilities for safe access to environment variables on the client.
  - If you see errors about missing environment variables, check your `.env.local` file and restart the dev server.
- **Logging:**
  - Control log verbosity with `NEXT_PUBLIC_LOG_LEVEL` (ERROR, WARN, INFO, DEBUG).
  - Suppress React warnings in development with `NEXT_PUBLIC_DISABLE_REACT_LOGS=true`.
- **Common Issues:**
  - "process is not defined" error: Use the `clientEnv` utility instead of direct `process.env` access in client-side code.
  - Camera/Microphone not working: Test with direct access first to isolate browser permission issues from LiveKit configuration issues.

---

## Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# LiveKit Configuration (Required for video/audio)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# OpenAI Configuration (Required for AI features)
OPENAI_API_KEY=your_openai_api_key

# Perplexity Configuration (Required for AI Web Search)
PERPLEXITY_API_KEY=your_perplexity_api_key

# Anthropic Configuration (Required for AI computer use features)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google API Lab Key
GOOGLE_API_KEY=your_google_api_key

# Deepgram Configuration (Required for real-time diarization AI transcription)
DEEPGRAM_API_KEY=your_deepgram_api_key

# Kaggle Configuration
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_key

# Academic/Research (Easy Registration)
CROSSREF_API_EMAIL=your_email@example.com

# Academic Search & Citations
UNPAYWALL_EMAIL=your_email@example.com
ARXIV_API_USER=your_arxiv_user

# No key needed, just identify yourself
WIKIPEDIA_API_USER_AGENT="YourAppName (your_email@example.com)"
WORLDBANK_API_FORMAT=json

# Set log level for development (options: ERROR, WARN, INFO, DEBUG)
NEXT_PUBLIC_LOG_LEVEL=WARN

# Disable React development warnings (true/false)
NEXT_PUBLIC_DISABLE_REACT_LOGS=true
```

- Replace the example values with your actual API keys and credentials.
- Only the LiveKit variables are strictly required for basic video/audio and whiteboard functionality. The other keys enable AI, search, and research features.

---

## Major Dependencies

- [Next.js](https://nextjs.org/) (App Router, SSR/CSR)
- [React](https://react.dev/) 19
- [TLDraw](https://tldraw.dev/) (collaborative whiteboard)
- [LiveKit](https://livekit.io/) (video/audio, data channels)
- [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Deepgram](https://deepgram.com/), [Perplexity](https://www.perplexity.ai/) (AI features)
- [Zustand](https://zustand-demo.pmnd.rs/) (state management)
- [TailwindCSS](https://tailwindcss.com/) (styling)
- [Jest](https://jestjs.io/) (testing)

---

## API: /api/get-token

LiveKit token generation endpoint. Supports GET/POST requests.

### Parameters
- `room`/`roomName`: Room name
- `username`/`identity`/`participantName`: User identity
- `refresh` (optional): Trigger token refresh

---

## Deployment

```bash
npm run build
```

Deploy on Vercel or any Next.js-compatible host.

- The app includes a custom Content Security Policy (CSP) in `next.config.js`.
- ESLint is disabled during production builds for now.

---

## Known Issues & Limitations

- **Persistence:** Whiteboard content is not persisted between sessions (yet).
- **AI agent features:** Some features are placeholders and require additional backend services.
- **Session recording and chat:** Planned for future releases.
- **Environment variable issues:** Ensure all required variables are set in `.env.local` and restart the dev server after changes.

---

## Roadmap / Future Enhancements

- Persistence for whiteboard content
- True real-time whiteboard collaboration (Yjs or similar)
- Chat functionality
- Session recording
- Improved AI agent integration
- More robust error handling and onboarding

---

## Contributing

We welcome contributions! To get started:

1. Fork the repository and create a new branch for your feature or bugfix.
2. Run the app locally and make your changes.
3. Add or update tests as appropriate.
4. Open a pull request with a clear description of your changes.

Please follow standard coding practices and be respectful in code reviews and discussions. For major changes, open an issue first to discuss your proposal.

---

## FAQ

**Q: I get an error about missing environment variables. What should I do?**  
A: Double-check your `.env.local` file in the project root. Make sure all required variables (especially the LiveKit keys) are set, and restart your dev server after making changes.

---

**Q: Why do I see "process is not defined" errors in the browser?**  
A: This happens if you try to use `process.env` directly in client-side code. Use the provided `clientEnv` utility for safe access to environment variables on the client.

---

**Q: My camera or microphone isn't working in the app.**  
A:  
- Make sure your browser has permission to access your camera and mic.
- Try the direct webcam test in the app (if available) to isolate browser issues from LiveKit configuration.
- Check that your LiveKit environment variables are correct.

---

**Q: How do I add new AI or research features?**  
A: Add the relevant API key(s) to your `.env.local` and update the API routes or client code to use the new provider. The architecture is designed to be extensible.

---

**Q: Can I persist whiteboard content between sessions?**  
A: Not yet! Persistence is on the roadmap. Right now, content is only shared in real time during a session.

---

**Q: How do I contribute?**  
A: Fork the repo, create a branch, make your changes, and open a pull request. See the "Contributing" section above for more details.

---

**Q: Where can I find more technical details about the transcription system?**  
A: See `for-the-new-dev.md` in the repo for a deep dive into the transcription and chunking logic.

---

**Q: Is this app production-ready?**  
A: It's a work in progress! It's suitable for demos, prototyping, and collaborative research, but some features (like persistence and advanced AI agents) are still in development.

---

## License

[MIT](https://choosealicense.com/licenses/mit/)
