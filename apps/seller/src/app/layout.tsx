// apps/seller/src/app/layout.tsx
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Seller Dashboard — BazarBD',
    template: '%s | BazarBD Seller',
  },
  description: 'Manage your BazarBD store — products, orders, inventory and payouts.',
  robots: { index: false, follow: false },
};

export default function SellerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.className} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
