// ============================================================
// apps/admin/src/components/charts/RevenueChart.tsx
// ============================================================
'use client';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { adminApi } from '@/lib/admin-api';
import { useState } from 'react';

type Range = '7d' | '30d' | '90d';

export function RevenueChart() {
  const [range, setRange] = useState<Range>('7d');

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-chart', range],
    queryFn: () => adminApi.getRevenueChart(range),
  });

  const chartData = data?.data ?? buildDemoData(range === '7d' ? 7 : range === '30d' ? 30 : 90);

  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-white text-sm">Revenue & Orders</h2>
          <p className="text-xs text-slate-500 mt-0.5">GMV over time</p>
        </div>
        <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })} />
            <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
              formatter={(val: any, name: any) => name === 'gmv' ? [`৳${val.toLocaleString('en-BD')}`, 'GMV'] : [val, 'Orders']}
              labelFormatter={(l) => new Date(l).toLocaleDateString('en-BD', { weekday: 'short', month: 'short', day: 'numeric' })}
            />
            <Area type="monotone" dataKey="gmv" stroke="#10b981" strokeWidth={2} fill="url(#gmvGrad)" dot={false} />
            <Area type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="url(#ordersGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function buildDemoData(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return { date: d.toISOString(), gmv: 80_000 + Math.random() * 120_000, orders: 40 + Math.floor(Math.random() * 80) };
  });
}


