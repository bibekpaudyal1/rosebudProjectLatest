// ============================================================
// apps/web/src/components/cart/CartDrawer.tsx
// Slide-in cart from the right
// ============================================================
'use client';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, ShoppingBag, Trash2, Plus, Minus } from 'lucide-react';
import { useCartDrawer } from '@/components/providers';
import { useCart, useUpdateCartItem, useRemoveFromCart } from '@/lib/api';

export function CartDrawer() {
  const { isOpen, close: closeCart } = useCartDrawer();
  const { data: cartData, isLoading } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();

  const cart = cartData as any;
  const items = cart?.items ?? [];

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="cart-overlay" onClick={closeCart} aria-hidden="true" />

      {/* Drawer */}
      <aside className="cart-drawer" role="dialog" aria-label="Shopping cart" aria-modal="true">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[--brand-green]" />
            <h2 className="font-bold text-lg text-gray-900">Cart</h2>
            {items.length > 0 && (
              <span className="badge badge-green">{cart?.itemCount} items</span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="btn btn-ghost w-9 h-9 rounded-xl"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                    <div className="skeleton h-4 w-1/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-4xl">
                🛒
              </div>
              <p className="font-bold text-gray-900 mb-1">Your cart is empty</p>
              <p className="text-sm text-gray-500 mb-6">Add items to get started</p>
              <button onClick={closeCart} className="btn btn-primary btn-md">
                Browse Products
              </button>
            </div>
          )}

          {items.map((item: any) => (
            <div key={item.variantId} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
              {/* Image */}
              <Link
                href={`/p/${item.variant?.product?.slug ?? '#'}`}
                onClick={closeCart}
                className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-100"
              >
                {item.variant?.product?.thumbnailUrl ? (
                  <Image
                    src={item.variant.product.thumbnailUrl}
                    alt=""
                    width={64} height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                )}
              </Link>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/p/${item.variant?.product?.slug ?? '#'}`}
                  onClick={closeCart}
                  className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug hover:text-[--brand-green]"
                >
                  {item.variant?.product?.name ?? 'Product'}
                </Link>
                {item.variant?.name && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.variant.name}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {/* Qty controls */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        if (item.quantity <= 1) removeItem.mutate(item.variantId);
                        else updateItem.mutate({ variantId: item.variantId, quantity: item.quantity - 1 });
                      }}
                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    >
                      {item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateItem.mutate({ variantId: item.variantId, quantity: item.quantity + 1 })}
                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">
                    ৳{item.totalPrice.toLocaleString('en-BD')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer summary */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-white">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal ({cart?.itemCount} items)</span>
              <span className="font-semibold text-gray-900">৳{cart?.subtotal?.toLocaleString('en-BD') ?? 0}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Delivery fee</span>
              <span>Calculated at checkout</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="btn btn-primary btn-lg w-full"
            >
              Proceed to Checkout
            </Link>
            <button onClick={closeCart} className="btn btn-ghost btn-md w-full text-gray-500">
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
