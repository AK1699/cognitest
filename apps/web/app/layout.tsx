import type { Metadata } from 'next';
import { Karla, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { ToastProvider } from './toast';

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
    <html lang="en" className={`${spaceGrotesk.variable} ${karla.variable}`} suppressHydrationWarning>
      <head>
        {/* apply the stored theme before paint to avoid a light-mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cognitest-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.setAttribute('data-theme','dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-cream font-body text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
