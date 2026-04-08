'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Eye, Store } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/ui/DataTable';
import { AdminPagination } from '@/components/ui/AdminPagination';

export default function SellersPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage]     = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', status, page],
    queryFn: () => adminApi.getSellers({ status, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveSeller(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sellers'] }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectSeller(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sellers'] }),
  });

  const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700',
    suspended: 'bg-red-100 text-red-700', rejected: 'bg-gray-100 text-gray-600',
  };

  const columns = [
    {
      key: 'shop', label: 'Shop',
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{row.shopName}</p>
            <p className="text-xs text-gray-500">/{row.shopSlug}</p>
          </div>
        </div>
      ),
    },
    { key: 'nid', label: 'NID', render: (row: any) => <span className="text-xs text-gray-500 font-mono">{row.nidNumber ?? '—'}</span> },
    { key: 'commission', label: 'Commission', render: (row: any) => <span className="text-sm font-bold text-amber-600">{row.commissionRate}%</span> },
    { key: 'applied', label: 'Applied', render: (row: any) => <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleDateString('en-BD')}</span> },
    { key: 'status', label: 'Status', render: (row: any) => <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[row.status]}`}>{row.status}</span> },
    {
      key: 'actions', label: 'Actions',
      render: (row: any) => (
        <div className="flex gap-1.5 flex-wrap">
          {row.status === 'pending' && (
            <>
              <button onClick={() => approve.mutate(row.id)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition-colors">
                <CheckCircle2 className="w-3 h-3" /> Approve
              </button>
              <button onClick={() => { const r = (globalThis as any).prompt('Reason for rejection:'); if (r) reject.mutate({ id: row.id, reason: r }); }}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors">
                <XCircle className="w-3 h-3" /> Reject
              </button>
            </>
          )}
          {row.status === 'approved' && (
            <button onClick={() => adminApi.suspendSeller(row.id).then(() => qc.invalidateQueries({ queryKey: ['admin-sellers'] }))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors">
              Suspend
            </button>
          )}
          <a href={`/dashboard/sellers/${row.id}`}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-semibold transition-colors">
            <Eye className="w-3 h-3" /> View
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {['pending','approved','suspended','rejected'].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={data?.data?.data ?? []} loading={isLoading} emptyMessage={`No ${status} sellers`} />
      <AdminPagination page={page} total={data?.data?.meta?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
