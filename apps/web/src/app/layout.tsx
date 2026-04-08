// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

// Bengali-optimised body font (Hind Siliguri supports Bangla script)
const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

// Clean display font for headings and UI labels
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://bazarbd.com'),
  title: {
    default: 'BazarBD — Bangladesh\'s Online Marketplace',
    template: '%s | BazarBD',
  },
  description: 'Shop millions of products from thousands of sellers across Bangladesh. Fast delivery, bKash, Nagad, COD accepted.',
  keywords: ['online shopping bangladesh', 'bazar bd', 'buy online', 'dhaka shopping', 'বাজার'],
  openGraph: {
    type: 'website',
    locale: 'bn_BD',
    alternateLocale: 'en_US',
    siteName: 'BazarBD',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'BazarBD' }],
  },
  twitter: { card: 'summary_large_image', site: '@bazarbd' },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A6E4F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${hindSiliguri.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}