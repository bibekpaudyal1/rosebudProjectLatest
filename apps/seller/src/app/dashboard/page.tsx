// ============================================================
// apps/seller/src/app/dashboard/page.tsx
// Seller overview — revenue KPIs, 7-day chart, pending orders,
// low-stock alerts
// ============================================================
'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingBag, Package, Star, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';
import { sellerApi } from '@/lib/seller-api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function buildDemo(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return { date: d.toISOString(), revenue: 15_000 + Math.random() * 40_000 };
  });
}

export default function SellerOverviewPage() {
  const { data: stats } = useQuery({ queryKey: ['seller-stats'], queryFn: sellerApi.getStats, refetchInterval: 60_000 });
  const { data: chart } = useQuery({ queryKey: ['seller-chart'], queryFn: () => sellerApi.getRevenueChart('7d') });
  const { data: pending } = useQuery({ queryKey: ['seller-pending'], queryFn: () => sellerApi.getOrders({ status: 'confirmed', limit: 5 }) });
  const { data: lowStock } = useQuery({ queryKey: ['seller-lowstock'], queryFn: sellerApi.getLowStockItems });

  const chartData = chart?.data ?? buildDemo(7);

  const KPI_CARDS = [
    { label: 'Revenue (30d)',   value: stats?.revenue30d ? `৳${(stats.revenue30d/1000).toFixed(1)}K` : '৳—', delta: stats?.revenueDelta,  icon: TrendingUp,  cls: 'text-emerald-600 bg-emerald-50' },
    { label: 'Orders (30d)',    value: stats?.orders30d ?? '—',       delta: stats?.ordersDelta, icon: ShoppingBag, cls: 'text-blue-600 bg-blue-50' },
    { label: 'Active Products', value: stats?.activeProducts ?? '—',  delta: null, icon: Package,    cls: 'text-violet-600 bg-violet-50' },
    { label: 'Avg. Rating',     value: stats?.avgRating ? `${stats.avgRating} ★` : '—', delta: null, icon: Star, cls: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.cls}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
            {kpi.delta !== null && kpi.delta !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${kpi.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(kpi.delta).toFixed(1)}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-4">Revenue — Last 7 days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `৳${(v/1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
              formatter={(v: number) => [`৳${v.toLocaleString('en-BD')}`, 'Revenue']}
              labelFormatter={(l: string) => new Date(l).toLocaleDateString('en-BD', { weekday: 'short', month: 'short', day: 'numeric' })}
            />
            <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#sRev)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pending orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-sm">Orders to Fulfill</h2>
            <a href="/dashboard/orders?status=confirmed" className="text-xs text-emerald-600 hover:underline font-medium">View all →</a>
          </div>
          <div className="space-y-2">
            {pending?.data?.slice(0, 5).map((order: any) => (
              <a key={order.id} href={`/dashboard/orders/${order.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{order.quantity ?? order.items?.length} items</p>
                </div>
                <span className="text-sm font-bold text-gray-900">৳{Number(order.totalPrice ?? order.total).toLocaleString('en-BD')}</span>
              </a>
            ))}
            {!pending?.data?.length && <p className="text-center py-6 text-gray-400 text-sm">No pending orders 🎉</p>}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-sm">Low Stock Alerts</h2>
            <a href="/dashboard/inventory" className="text-xs text-emerald-600 hover:underline font-medium">Manage →</a>
          </div>
          <div className="space-y-2">
            {lowStock?.data?.slice(0, 5).map((item: any) => (
              <div key={item.variantId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.quantity === 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <AlertCircle className={`w-3.5 h-3.5 ${item.quantity === 0 ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 font-mono text-xs">{item.variantId.slice(-8)}</p>
                  <p className="text-xs text-gray-400">{item.quantity === 0 ? 'Out of stock' : `${item.lowStockThreshold} threshold`}</p>
                </div>
                <span className={`text-sm font-bold ${item.quantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>{item.quantity} left</span>
              </div>
            ))}
            {!lowStock?.data?.length && <p className="text-center py-6 text-gray-400 text-sm">All items well stocked ✓</p>}
          </div>
        </div>
      </div>
    </div>
  );
}


