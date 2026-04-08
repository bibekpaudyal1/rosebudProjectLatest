'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Users, Store, ShoppingBag, Package,
  Tag, Zap, BarChart3, Shield, Settings, LogOut,
  ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Overview',     href: '/dashboard',            icon: LayoutDashboard },
  { label: 'Users',        href: '/dashboard/users',      icon: Users },
  { label: 'Sellers',      href: '/dashboard/sellers',    icon: Store },
  { label: 'Orders',       href: '/dashboard/orders',     icon: ShoppingBag },
  { label: 'Products',     href: '/dashboard/products',   icon: Package },
  { label: 'Coupons',      href: '/dashboard/coupons',    icon: Tag },
  { label: 'Flash Sales',  href: '/dashboard/flash-sales',icon: Zap },
  { label: 'Analytics',    href: '/dashboard/analytics',  icon: BarChart3 },
  { label: 'Fraud',        href: '/dashboard/fraud',      icon: AlertTriangle },
  { label: 'Settings',     href: '/dashboard/settings',   icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-gray-900 text-white flex flex-col transition-all duration-300 z-20 ${collapsed ? 'w-16' : 'w-56'}`}>

      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b border-white/10 shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-xl bg-[#0A6E4F] flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="font-black text-lg tracking-tight">BazarBD</span>}
      </div>

      {/* Nav */}
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
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/8'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-white/10 p-3 space-y-1 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-[#0A6E4F] flex items-center justify-center text-xs font-bold shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{(session as any)?.user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-white hover:bg-white/8 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 mx-auto" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
