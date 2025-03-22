# Thought Partners: Collaborative Whiteboard with Video Conferencing

A real-time collaborative application built with Next.js that combines a whiteboard using TLDraw and video conferencing with LiveKit. 

## Features

- **Real-time whiteboard collaboration** using TLDraw
- **Video conferencing** with LiveKit for real-time communication
- **Room-based collaboration** where users can join specific rooms 
- **Authentication** with user identity and LiveKit tokens

## Prerequisites

Before running this application, you'll need:

1. A LiveKit account and API keys (get them at [LiveKit Cloud](https://livekit.io/cloud))
2. Node.js 18+ installed on your machine

## Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Using the Application

1. Navigate to `/whiteboard/[roomId]` where `[roomId]` is any unique identifier for your room
2. Enter your name to join the room
3. Use the whiteboard on the left side for drawing and collaboration
4. The video conference will appear on the right side, allowing you to see and speak with other participants in the room

## Architecture

- **Frontend**: Next.js with React 19
- **Whiteboard**: TLDraw for collaborative drawing
- **Video**: LiveKit for WebRTC-based video conferencing
- **Authentication**: LiveKit tokens for secure room access

## Future Enhancements

- Adding persistence for whiteboard content
- Implementing true real-time collaboration for the whiteboard using Yjs
- Adding chat functionality
- Implementing recording capabilities for sessions

## Deployment

The application can be deployed on Vercel or any other hosting service that supports Next.js.

```bash
npm run build
```

## License

[MIT](https://choosealicense.com/licenses/mit/)
