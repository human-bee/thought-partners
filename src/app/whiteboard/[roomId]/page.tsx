import dynamic from 'next/dynamic';

// Import ClientOnlyWhiteboardRoom without ssr: false
const ClientOnlyWhiteboardRoom = dynamic(() => import('./ClientOnlyWhiteboardRoom'));

export default async function WhiteboardRoom({ params }: { params: { roomId: string } }) {
  const { roomId } = await params;
  return <ClientOnlyWhiteboardRoom roomId={roomId} />;
}