import dynamic from 'next/dynamic';

// Import ClientOnlyWhiteboardRoom without ssr: false
const ClientOnlyWhiteboardRoom = dynamic(() => import('./ClientOnlyWhiteboardRoom'));

export default function WhiteboardRoom({ params: { roomId } }: any) {
  // No need to extract here, roomId is now available directly
  return <ClientOnlyWhiteboardRoom roomId={roomId} />; // Use the variable
} 