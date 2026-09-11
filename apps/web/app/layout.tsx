import type { Metadata } from 'next';
import { Karla, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-karla',
});

export const metadata: Metadata = {
  title: 'Cognitest',
  description: 'Hybrid QA engineering platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${karla.variable}`}>
      <body className="min-h-screen bg-cream font-body text-ink antialiased">{children}</body>
    </html>
  );
}
