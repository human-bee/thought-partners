import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Conference',
  description: 'Join a video conference session',
};

export default function VideoConferenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 