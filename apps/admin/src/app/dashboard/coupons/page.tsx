// ============================================================
// apps/admin/src/app/dashboard/coupons/page.tsx
// Create, toggle, and delete coupons
// ============================================================
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';

export default function CouponsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', discountType: 'percentage', discountValue: 10,
    minOrderValue: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn:  () => adminApi.getCoupons({}),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createCoupon({
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderValue: form.minOrderValue > 0 ? Number(form.minOrderValue) : undefined,
      maxDiscount:   form.maxDiscount > 0   ? Number(form.maxDiscount)   : undefined,
      usageLimit:    form.usageLimit > 0    ? Number(form.usageLimit)    : undefined,
      expiresAt:     form.expiresAt || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); setShowForm(false); resetForm(); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.toggleCoupon(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  const resetForm = () => setForm({ code: '', discountType: 'percentage', discountValue: 10, minOrderValue: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '' });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#0A6E4F] text-white text-sm font-semibold hover:bg-[#0E9267] transition-colors">
          <Plus className="w-4 h-4" /> New coupon
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-slide-up">
          <h2 className="font-bold text-gray-900 mb-5">Create coupon</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: (e.target as any).value.toUpperCase() })} placeholder="EID2026" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A6E4F] uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: (e.target as any).value })} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (৳)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount value *</label>
              <div className="relative">
                <input type="number" min={1} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number((e.target as any).value) })} className="w-full h-10 pl-3 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{form.discountType === 'percentage' ? '%' : '৳'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Min order value (৳)</label>
              <input type="number" min={0} value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number((e.target as any).value) })} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max discount (৳) <span className="text-gray-400 text-xs">(for % type)</span></label>
              <input type="number" min={0} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number((e.target as any).value) })} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usage limit</label>
              <input type="number" min={0} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number((e.target as any).value) })} placeholder="Unlimited" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Expires at</label>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: (e.target as any).value })} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6E4F]" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={!form.code || !form.discountValue || createMutation.isPending} className="flex-1 h-10 rounded-xl bg-[#0A6E4F] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#0E9267]">
              {createMutation.isPending ? 'Creating...' : 'Create coupon'}
            </button>
          </div>
        </div>
      )}

      {/* Coupons list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Discount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Min order</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Used</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expires</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              : data?.data?.map((coupon: any) => (
                  <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono font-bold text-sm text-gray-900">{coupon.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `৳${coupon.discountValue}`}
                      </span>
                      {coupon.maxDiscount > 0 && <span className="text-xs text-gray-400 ml-1">(max ৳{coupon.maxDiscount})</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{coupon.minOrderValue > 0 ? `৳${coupon.minOrderValue}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {coupon.usedCount}{coupon.usageLimit > 0 ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('en-BD') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${coupon.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title={coupon.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {coupon.isActive
                            ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                            : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => (globalThis as any).confirm('Delete this coupon?') && deleteMutation.mutate(coupon.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && !data?.data?.length && (
          <p className="text-center py-12 text-sm text-gray-400">No coupons yet</p>
        )}
      </div>
    </div>
  );
}