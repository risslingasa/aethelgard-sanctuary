import type { Metadata } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aethelgard Sanctuary',
  description:
    'An interactive 3D floating fantasy island diorama featuring an ancient wizard’s observatory tower, glowing turquoise stream and waterfall, cherry blossoms, bioluminescent mushrooms, and smooth Golden Sunset to Starry Aurora Night transitions.',
  openGraph: {
    title: 'Aethelgard Sanctuary',
    description:
      'Explore an interactive 3D floating fantasy island diorama with smooth Golden Sunset and Starry Aurora Night lighting.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aethelgard Sanctuary',
    description:
      'Explore an interactive 3D floating fantasy island diorama with smooth Golden Sunset and Starry Aurora Night lighting.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`}>
      <body
        suppressHydrationWarning
        className="m-0 h-screen w-screen overflow-hidden bg-[#1a1f36] font-sans text-stone-100 antialiased selection:bg-amber-300/30"
      >
        {children}
      </body>
    </html>
  );
}
