import dynamic from 'next/dynamic';

// Import ClientOnlyWhiteboardRoom without ssr: false
const ClientOnlyWhiteboardRoom = dynamic(() => import('./ClientOnlyWhiteboardRoom'));

export default async function WhiteboardRoom({ params }: { params: { roomId: string } }) {
  // Since params needs to be awaited in Next.js App Router
  return <ClientOnlyWhiteboardRoom roomId={params.roomId} />;
} 