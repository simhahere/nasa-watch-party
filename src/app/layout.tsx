import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NASA Watch Party — Watch Together',
  description: 'Watch movies and videos together in real-time with friends. Sync playback, chat, and video calls.',
  keywords: 'watch party, sync video, watch together, online movie, friends',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚀</text></svg>',
  },
  openGraph: {
    title: 'NASA Watch Party',
    description: 'Watch movies together in perfect sync',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
