// ============================================================
// apps/seller/src/components/layout/SellerSidebar.tsx
// ============================================================
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Package, ShoppingBag, BarChart3,
  Tag, Settings, LogOut, Store, Boxes, Wallet, ChevronLeft
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Overview',    href: '/dashboard',               icon: LayoutDashboard },
  { label: 'Products',    href: '/dashboard/products',      icon: Package },
  { label: 'Orders',      href: '/dashboard/orders',        icon: ShoppingBag },
  { label: 'Inventory',   href: '/dashboard/inventory',     icon: Boxes },
  { label: 'Analytics',   href: '/dashboard/analytics',     icon: BarChart3 },
  { label: 'Promotions',  href: '/dashboard/promotions',    icon: Tag },
  { label: 'Payouts',     href: '/dashboard/payouts',       icon: Wallet },
  { label: 'Store',       href: '/dashboard/store',         icon: Store },
  { label: 'Settings',    href: '/dashboard/settings',      icon: Settings },
];

export function SellerSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-300 z-20 shadow-sm ${collapsed ? 'w-16' : 'w-56'}`}>

      <div className={`flex items-center h-16 px-4 border-b border-gray-100 shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-xl bg-[#0A6E4F] flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-black text-sm text-gray-900 truncate">{(session?.user as any)?.shopName ?? 'My Shop'}</p>
            <p className="text-[10px] text-gray-400">Seller Dashboard</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[#E6F4F0] text-[#0A6E4F]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3 space-y-1 shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:bg-gray-50">
          {collapsed ? '→' : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}


