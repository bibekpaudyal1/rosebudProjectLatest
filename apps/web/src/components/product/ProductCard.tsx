'use client';
// apps/web/src/components/product/ProductCard.tsx
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { useAddToCart } from '@/lib/api';
import { useToast } from '@/components/providers';
import { useCartDrawer } from '@/components/providers';
import { cn, formatPrice, discountPercent } from '@/lib/utils';
import type { Product } from '@bazarbd/types';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact' | 'horizontal';
  className?: string;
}

export function ProductCard({ product, variant = 'default', className }: ProductCardProps) {
  const { mutate: addToCart, isPending } = useAddToCart();
  const { toast } = useToast();
  const { open: openCart } = useCartDrawer();
  const [wished, setWished] = useState(false);
  const [imgError, setImgError] = useState(false);

  const defaultVariant = product.variants?.[0];
  const price = defaultVariant?.price ?? product.basePrice;
  const comparePrice = defaultVariant?.comparePrice ?? product.comparePrice;
  const discount = comparePrice ? discountPercent(comparePrice, price) : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!defaultVariant) { toast('Please select a variant', 'error'); return; }
    addToCart(
      { variantId: defaultVariant.id, quantity: 1 },
      {
        onSuccess: () => {
          toast(`${product.name} added to cart`, 'success');
          openCart();
        },
        onError: (err: any) =>
          toast(err?.response?.data?.error?.message ?? 'Failed to add to cart', 'error'),
      },
    );
  };

  if (variant === 'compact') {
    return (
      <Link
        href={`/products/${product.slug}`}
        className={cn('group flex gap-3 rounded-xl p-2 hover:bg-stone-50 transition-colors', className)}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
          {product.thumbnailUrl && !imgError ? (
            <Image
              src={product.thumbnailUrl}
              alt={product.name}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
              sizes="64px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-300">
              <ShoppingCart className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium text-stone-700 group-hover:text-brand-600">{product.name}</p>
          <p className="mt-1 text-sm font-bold text-brand-600">৳{formatPrice(price)}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5',
        className,
      )}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-stone-50 aspect-square">
        {product.thumbnailUrl && !imgError ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-200">
            <ShoppingCart className="h-12 w-12" />
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
            -{discount}%
          </span>
        )}

        {/* Wishlist button */}
        <button
          onClick={(e) => { e.preventDefault(); setWished((p) => !p); }}
          className="absolute right-3 top-3 rounded-full bg-white/80 p-1.5 shadow backdrop-blur-sm transition-all hover:bg-white"
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('h-4 w-4 transition-colors', wished ? 'fill-red-500 text-red-500' : 'text-stone-400 hover:text-red-400')} />
        </button>

        {/* Add to cart overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/40 to-transparent p-3 transition-transform duration-300 group-hover:translate-y-0">
          <button
            onClick={handleAddToCart}
            disabled={isPending || !defaultVariant}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-70"
          >
            {isPending ? (
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:300ms]" />
              </span>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Add to cart
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-stone-700 group-hover:text-stone-900 transition-colors">
          {product.name}
        </p>

        {/* Rating */}
        {product.rating > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-3 w-3',
                    star <= Math.round(product.rating) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200',
                  )}
                />
              ))}
            </div>
            <span className="text-[11px] text-stone-400">({product.reviewCount})</span>
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-base font-bold text-brand-600">৳{formatPrice(price)}</span>
          {comparePrice && comparePrice > price && (
            <span className="text-xs text-stone-400 line-through">৳{formatPrice(comparePrice)}</span>
          )}
        </div>

        {product.soldCount > 100 && (
          <p className="mt-1 text-[11px] text-stone-400">{product.soldCount.toLocaleString()} sold</p>
        )}
      </div>
    </Link>
  );
}

// ── Grid skeleton ──────────────────────────────────────────
export function ProductCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-card">
          <div className="animate-pulse">
            <div className="aspect-square bg-stone-100" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-stone-100" />
              <div className="h-4 w-1/2 rounded bg-stone-100" />
              <div className="h-5 w-1/3 rounded bg-stone-100" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}