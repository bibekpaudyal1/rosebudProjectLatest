// ============================================================
// apps/admin/src/app/dashboard/page.tsx
// Admin overview with KPI cards, revenue chart, live order feed
// ============================================================
'use client';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Users, ShoppingBag, DollarSign,
  Store, AlertTriangle, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { OrderStatusChart } from '@/components/charts/OrderStatusChart';
import { adminApi } from '@/lib/admin-api';

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getDashboardStats(),
    refetchInterval: 30_000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['admin', 'recent-orders'],
    queryFn: () => adminApi.getOrders({ limit: 8, page: 1 }),
    refetchInterval: 15_000,
  });

  const kpis = [
    {
      label:    "Today's GMV",
      value:    stats ? `৳${(stats.todayGmv ?? 0).toLocaleString('en-BD')}` : '—',
      change:   stats?.gmvChange ?? 0,
      icon:     DollarSign,
      color:    'text-emerald-600',
      bg:       'bg-emerald-50',
    },
    {
      label:  "Today's Orders",
      value:  stats?.todayOrders?.toLocaleString() ?? '—',
      change: stats?.ordersChange ?? 0,
      icon:   ShoppingBag,
      color:  'text-blue-600',
      bg:     'bg-blue-50',
    },
    {
      label:  'Active Users',
      value:  stats?.activeUsers?.toLocaleString() ?? '—',
      change: stats?.usersChange ?? 0,
      icon:   Users,
      color:  'text-violet-600',
      bg:     'bg-violet-50',
    },
    {
      label:  'Active Sellers',
      value:  stats?.activeSellers?.toLocaleString() ?? '—',
      change: stats?.sellersChange ?? 0,
      icon:   Store,
      color:  'text-amber-600',
      bg:     'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              {kpi.change !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  kpi.change > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {kpi.change > 0
                    ? <ArrowUpRight className="w-3 h-3" />
                    : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(kpi.change)}%
                </div>
              )}
            </div>
            {isLoading
              ? <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse" />
              : <p className="text-2xl font-black text-gray-900">{kpi.value}</p>}
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Pending approvals alert ───────────────────── */}
      {stats?.pendingSellers > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            <strong>{stats.pendingSellers}</strong> sellers awaiting approval.{' '}
            <a href="/dashboard/sellers?status=pending" className="underline font-bold">Review now →</a>
          </p>
        </div>
      )}

      {/* ── Charts row ────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900">Revenue (last 30 days)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Daily GMV in BDT</p>
            </div>
            <span className="badge bg-emerald-50 text-emerald-700 text-xs">Live</span>
          </div>
          <RevenueChart />
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-1">Order status</h2>
          <p className="text-xs text-gray-500 mb-4">Today's distribution</p>
          <OrderStatusChart />
        </div>
      </div>

      {/* ── Bottom row ────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Recent orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Recent orders</h2>
            <a href="/dashboard/orders" className="text-xs font-semibold text-[#0A6E4F] hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-gray-50">
            {recentOrders?.data?.map((order: any) => (
              <div key={order.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                  #
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {order.status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-bold text-gray-900 shrink-0">
                  ৳{Number(order.total).toLocaleString('en-BD')}
                </span>
              </div>
            ))}
            {!recentOrders?.data?.length && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No orders yet today</div>
            )}
          </div>
        </div>

        {/* Top sellers */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Top sellers</h2>
            <a href="/dashboard/sellers" className="text-xs font-semibold text-[#0A6E4F] hover:underline">View all →</a>
          </div>
          <TopSellersTable />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-yellow-50 text-yellow-700',
  confirmed:        'bg-blue-50 text-blue-700',
  processing:       'bg-purple-50 text-purple-700',
  shipped:          'bg-indigo-50 text-indigo-700',
  out_for_delivery: 'bg-orange-50 text-orange-700',
  delivered:        'bg-emerald-50 text-emerald-700',
  cancelled:        'bg-red-50 text-red-700',
};

function TopSellersTable() {
  const { data } = useQuery({
    queryKey: ['admin', 'top-sellers'],
    queryFn: () => adminApi.getTopSellers(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="divide-y divide-gray-50">
      {data?.map((seller: any, i: number) => (
        <div key={seller.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
          <span className="text-sm font-black text-gray-300 w-5 text-center">{i + 1}</span>
          <div className="w-8 h-8 rounded-xl bg-[#E6F4F0] flex items-center justify-center text-xs font-bold text-[#0A6E4F] shrink-0">
            {seller.shopName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{seller.shopName}</p>
            <p className="text-xs text-gray-400">{seller.totalSales} orders</p>
          </div>
          <span className="text-sm font-bold text-gray-900">৳{Number(seller.revenue ?? 0).toLocaleString('en-BD')}</span>
        </div>
      ))}
      {!data?.length && (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">No seller data yet</div>
      )}
    </div>
  );
}