'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserCheck, UserX } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { DataTable } from '@/components/ui/DataTable';
import { AdminPagination } from '@/components/ui/AdminPagination';

export default function UsersPage() {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole]     = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn: () => adminApi.getUsers({ page, limit: 20, search, role }),
    placeholderData: (prev) => prev,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const columns = [
    {
      key: 'user', label: 'User',
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
            {row.fullName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{row.fullName}</p>
            <p className="text-xs text-gray-500">{row.phone ?? row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role',
      render: (row: any) => (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${row.role === 'admin' ? 'bg-purple-100 text-purple-700' : row.role === 'seller' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{row.role}</span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (row: any) => (
        <div className="flex items-center gap-1.5">
          {row.isVerified ? <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> : <UserX className="w-3.5 h-3.5 text-gray-400" />}
          <span className={`text-xs font-semibold ${row.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
    {
      key: 'joined', label: 'Joined',
      render: (row: any) => <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleDateString('en-BD')}</span>,
    },
    {
      key: 'actions', label: '',
      render: (row: any) => (
        <button onClick={() => toggleActive.mutate(row.id)}
          disabled={row.role === 'super_admin'}
          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${row.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-30`}>
          {row.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <input value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or phone..."
            className="w-full pl-9 pr-4 h-10 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
        </div>
        <select value={role} onChange={(e: any) => { setRole(e.target.value); setPage(1); }}
          className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
          <option value="">All roles</option>
          {['customer','seller','admin','moderator'].map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-500">{data?.data?.meta?.total?.toLocaleString()} total</span>
      </div>

      <DataTable columns={columns} data={data?.data?.data ?? []} loading={isLoading} emptyMessage="No users found" />
      <AdminPagination page={page} total={data?.data?.meta?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
