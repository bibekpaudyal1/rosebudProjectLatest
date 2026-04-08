'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    title: 'Eid Special Sale',
    subtitle: 'Up to 70% off on fashion, electronics & more',
    cta: 'Shop the Sale',
    ctaHref: '/products?sale=eid',
    badge: 'Limited Time',
    bg: 'from-emerald-700 to-emerald-900',
    image: '/banners/eid-sale.jpg',
  },
  {
    id: 2,
    title: 'New Smartphones',
    subtitle: 'Samsung, Xiaomi, OPPO & more — best prices guaranteed',
    cta: 'Browse Phones',
    ctaHref: '/products?categorySlug=smartphones',
    badge: 'New Arrivals',
    bg: 'from-slate-800 to-slate-950',
    image: '/banners/smartphones.jpg',
  },
  {
    id: 3,
    title: 'Home & Kitchen',
    subtitle: 'Everything for your home, delivered to your door',
    cta: 'Shop Home',
    ctaHref: '/products?categorySlug=home-living',
    badge: 'Free Delivery',
    bg: 'from-amber-700 to-amber-900',
    image: '/banners/home.jpg',
  },
];

export function HeroBanner() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[current];

  return (
    <div className="relative rounded-2xl overflow-hidden my-4 h-[260px] sm:h-[340px] md:h-[420px]">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-r ${slide.bg} transition-all duration-700`} />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
      />

      {/* Content */}
      <div className="relative h-full flex items-center px-8 md:px-14 z-10">
        <div className="max-w-lg animate-slide-up">
          <span className="badge bg-white/20 text-white mb-3 backdrop-blur-sm">{slide.badge}</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-3">
            {slide.title}
          </h1>
          <p className="text-white/80 text-base md:text-lg mb-6 leading-relaxed">
            {slide.subtitle}
          </p>
          <Link href={slide.ctaHref} className="btn btn-md md:btn-lg bg-white text-gray-900 hover:bg-gray-100 font-bold shadow-lg">
            {slide.cta}
          </Link>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
          />
        ))}
      </div>

      {/* Arrow controls */}
      <button
        onClick={() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => setCurrent((c) => (c + 1) % SLIDES.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 flex items-center justify-center transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
