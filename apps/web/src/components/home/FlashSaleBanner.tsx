'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export function FlashSaleBanner() {
  const [timeLeft, setTimeLeft] = useState({ h: 2, m: 45, s: 30 });

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        let { h, m, s } = prev;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { return { h: 0, m: 0, s: 0 }; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flash-sale-banner rounded-2xl p-4 sm:p-6 mb-8 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
        </div>
        <div>
          <p className="text-white font-black text-lg leading-none">Flash Sale</p>
          <p className="text-red-200 text-sm">Ends in</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2">
        {[['h', timeLeft.h], ['m', timeLeft.m], ['s', timeLeft.s]].map(([label, val], i) => (
          <div key={label as string} className="flex items-center gap-2">
            <div className="countdown-box">
              <span className="countdown-number">{pad(val as number)}</span>
              <span className="countdown-label">{label}</span>
            </div>
            {i < 2 && <span className="text-white/70 text-xl font-bold">:</span>}
          </div>
        ))}
      </div>

      <Link href="/flash-sale" className="btn btn-md bg-white text-red-700 font-bold hover:bg-red-50 ml-auto">
        Shop Now
      </Link>
    </div>
  );
}
