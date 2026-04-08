import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HeroBanner } from '@/components/home/HeroBanner';
import { FlashSaleBanner } from '@/components/home/FlashSaleBanner';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { TrustBar } from '@/components/home/TrustBar';
import { BrandBanner } from '@/components/home/BrandBanner';
import { ProductGridSkeleton } from '@/components/product/ProductGridSkeleton';

export const metadata: Metadata = {
  title: 'BazarBD — Bangladesh\'s Online Marketplace',
  description: 'Shop electronics, fashion, home & more. Fast delivery across Bangladesh. bKash, Nagad, COD accepted.',
};

export default function HomePage() {
  return (
    <>
      <TrustBar />

      <div className="container-page">
        <HeroBanner />

        <Suspense fallback={null}>
          <FlashSaleBanner />
        </Suspense>

        <CategoryGrid />

        <section className="section">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="section-title">Trending Now</h2>
              <p className="section-subtitle">Most popular products this week</p>
            </div>
            <a href="/products?sortBy=popularity" className="text-sm font-semibold text-[--brand-green] hover:underline">
              See all →
            </a>
          </div>
          <Suspense fallback={<ProductGridSkeleton count={10} />}>
            <FeaturedProducts sortBy="popularity" limit={10} />
          </Suspense>
        </section>

        <BrandBanner />

        <section className="section">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="section-title">New Arrivals</h2>
              <p className="section-subtitle">Just added to our marketplace</p>
            </div>
            <a href="/products?sortBy=createdAt" className="text-sm font-semibold text-[--brand-green] hover:underline">
              See all →
            </a>
          </div>
          <Suspense fallback={<ProductGridSkeleton count={10} />}>
            <FeaturedProducts sortBy="createdAt" limit={10} />
          </Suspense>
        </section>
      </div>
    </>
  );
}