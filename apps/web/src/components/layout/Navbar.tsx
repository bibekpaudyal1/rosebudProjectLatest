'use client';
// apps/web/src/components/layout/Navbar.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Search, User, Menu, X,
  Package, LogOut, Heart, ChevronDown, Bell
} from 'lucide-react';
import { useCartDrawer } from '@/components/providers';
import { useMe, useCart, useAutocomplete, useLogout } from '@/lib/api';
import { cn } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const { open: openCart } = useCartDrawer();
  const { data: user } = useMe();
  const { data: cart } = useCart();
  const { mutate: logout } = useLogout();
  const cartCount = cart?.itemCount ?? 0;

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = useAutocomplete(query);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/products?search=${encodeURIComponent(query.trim())}`);
      setSearchFocused(false);
      setQuery('');
    }
  }, [query, router]);

  const handleSuggestion = (s: string) => {
    router.push(`/products?search=${encodeURIComponent(s)}`);
    setSearchFocused(false);
    setQuery('');
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full bg-white transition-shadow duration-200',
          scrolled ? 'shadow-md' : 'border-b border-stone-100',
        )}
      >
        {/* Top strip */}
        <div className="bg-brand-600 px-4 py-1 text-center text-xs text-white">
          🚚 Free delivery on orders over ৳999 · Pay with bKash, Nagad, Card or COD
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-4">

            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2 font-display font-bold text-brand-600">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                <rect width="28" height="28" rx="6" fill="#16a34a"/>
                <path d="M6 20L10 8h8l4 12H6z" fill="white" opacity=".9"/>
                <circle cx="14" cy="11" r="2" fill="#f97316"/>
              </svg>
              <span className="hidden text-xl sm:inline">BazarBD</span>
            </Link>

            {/* Search bar */}
            <div ref={searchRef} className="relative flex-1">
              <form onSubmit={handleSearch}>
                <div className={cn(
                  'flex items-center rounded-xl border bg-stone-50 transition-all duration-200',
                  searchFocused ? 'border-brand-500 ring-2 ring-brand-100 bg-white' : 'border-stone-200',
                )}>
                  <input
                    type="search"
                    placeholder="Search products, brands, categories..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-stone-400"
                  />
                  <button
                    type="submit"
                    className="mr-1 rounded-lg bg-brand-600 p-2 text-white hover:bg-brand-700 transition-colors"
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </form>

              {/* Autocomplete dropdown */}
              {searchFocused && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl border border-stone-100 bg-white shadow-lg animate-fade-in">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSuggestion(s)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="hidden rounded-xl p-2.5 text-stone-500 hover:bg-stone-100 hover:text-brand-600 transition-colors sm:flex"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
              </Link>

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative rounded-xl p-2.5 text-stone-500 hover:bg-stone-100 hover:text-brand-600 transition-colors"
                aria-label={`Cart (${cartCount} items)`}
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>

              {/* User menu */}
              {user ? (
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserMenuOpen((p) => !p)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden md:inline">{user.fullName.split(' ')[0]}</span>
                    <ChevronDown className={cn('hidden h-3.5 w-3.5 transition-transform md:inline', userMenuOpen && 'rotate-180')} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-xl animate-fade-in">
                      <div className="border-b border-stone-100 px-4 py-3">
                        <p className="text-sm font-semibold text-stone-800">{user.fullName}</p>
                        <p className="text-xs text-stone-500">{user.phone ?? user.email}</p>
                      </div>
                      <nav className="p-2">
                        {[
                          { href: '/account', icon: User, label: 'My Account' },
                          { href: '/orders', icon: Package, label: 'My Orders' },
                          { href: '/wishlist', icon: Heart, label: 'Wishlist' },
                        ].map(({ href, icon: Icon, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 hover:text-brand-600 transition-colors"
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </Link>
                        ))}
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors mt-1 border-t border-stone-100"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </nav>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Sign in
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen((p) => !p)}
                className="rounded-xl p-2.5 text-stone-500 hover:bg-stone-100 transition-colors sm:hidden"
                aria-label="Menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Category nav bar */}
          <nav className="hidden items-center gap-1 pb-2 sm:flex" aria-label="Categories">
            {[
              'Electronics', 'Fashion', 'Home & Living', 'Books',
              'Sports', 'Groceries', 'Beauty', 'Toys',
            ].map((cat) => (
              <Link
                key={cat}
                href={`/products?category=${encodeURIComponent(cat.toLowerCase())}`}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-brand-700 transition-colors whitespace-nowrap"
              >
                {cat}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-72 bg-white p-6 shadow-2xl animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-brand-600">BazarBD</span>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 hover:bg-stone-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {[
                { href: '/products', label: 'All Products' },
                { href: '/products?category=electronics', label: 'Electronics' },
                { href: '/products?category=fashion', label: 'Fashion' },
                { href: '/products?category=home', label: 'Home & Living' },
                { href: '/orders', label: 'My Orders' },
                { href: '/account', label: 'My Account' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}