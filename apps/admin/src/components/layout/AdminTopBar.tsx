'use client';
import { usePathname } from 'next/navigation';
import { Bell, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':             'Overview',
  '/dashboard/users':       'User Management',
  '/dashboard/sellers':     'Seller Management',
  '/dashboard/orders':      'Order Monitoring',
  '/dashboard/products':    'Product Moderation',
  '/dashboard/coupons':     'Coupons',
  '/dashboard/flash-sales': 'Flash Sales',
  '/dashboard/analytics':   'Analytics',
  '/dashboard/fraud':       'Fraud Detection',
  '/dashboard/settings':    'Settings',
};

export function AdminTopBar() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const title = PAGE_TITLES[pathname] ?? 'Admin';

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 shadow-sm">
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={() => qc.invalidateQueries()}
          className="btn btn-ghost btn-sm gap-1.5 text-gray-500"
          title="Refresh all data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button className="btn btn-ghost btn-sm relative" title="Notifications">
          <Bell className="w-4.5 h-4.5 text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="h-5 w-px bg-gray-200 mx-1" />
        <span className="text-xs text-gray-400">
          {new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </header>
  );
}
