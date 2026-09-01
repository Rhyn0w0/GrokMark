import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GrokMark | Clear labels for AI images',
  description:
    'Add a visible AI watermark to photos, illustrations, and drawings directly in your browser.',
  openGraph: {
    title: 'GrokMark | Clear labels for AI images',
    description:
      'Mark AI-made photos, illustrations, and drawings before you share them.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GrokMark | Clear labels for AI images',
    description:
      'Mark AI-made photos, illustrations, and drawings before you share them.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
