import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AdminProviders } from '@/components/AdminProviders';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'BazarBD Admin', template: '%s | Admin' },
  description: 'BazarBD platform administration',
  robots: { index: false, follow: false }, // never index admin panel
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}