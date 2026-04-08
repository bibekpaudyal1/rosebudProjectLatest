// ============================================================
// apps/admin/src/components/charts/OrderStatusChart.tsx
// ============================================================
'use client';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '@/lib/admin-api';

const COLORS: Record<string, string> = {
  delivered: '#10b981', confirmed: '#3b82f6', shipped: '#6366f1',
  processing: '#8b5cf6', out_for_delivery: '#f97316', cancelled: '#ef4444',
  pending: '#f59e0b', refunded: '#64748b',
};

export function OrderStatusChart() {
  const { data } = useQuery({
    queryKey: ['order-status-distribution'],
    queryFn: adminApi.getOrderStatusDistribution,
    refetchInterval: 60_000,
  });

  const raw = data?.data ?? [
    { status: 'delivered', count: 1840 }, { status: 'confirmed', count: 430 },
    { status: 'shipped', count: 310 }, { status: 'processing', count: 195 },
    { status: 'cancelled', count: 88 }, { status: 'pending', count: 45 },
  ];

  const total = raw.reduce((s: number, d: any) => s + d.count, 0);

  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5 h-full flex flex-col">
      <div className="mb-4">
        <h2 className="font-bold text-white text-sm">Order Status</h2>
        <p className="text-xs text-slate-500 mt-0.5">{total.toLocaleString()} total</p>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={raw} cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="count" paddingAngle={2} strokeWidth={0}>
            {raw.map((entry: any, i: number) => (
              <Cell key={i} fill={COLORS[entry.status] ?? '#64748b'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
            formatter={(val: any, _: any, p: any) => [`${val.toLocaleString()} (${((val/total)*100).toFixed(1)}%)`, p.payload.status]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-1.5 mt-3 flex-1">
        {raw.slice(0, 6).map((item: any) => (
          <div key={item.status} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[item.status] ?? '#64748b' }} />
            <span className="text-slate-400 flex-1 capitalize">{item.status.replace(/_/g, ' ')}</span>
            <span className="text-slate-300 font-semibold tabular-nums">{item.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}