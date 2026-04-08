import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminPagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>Page {page} of {total}</span>
      <div className="flex gap-1.5">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 text-slate-300 font-medium transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <button onClick={() => onPage(page + 1)} disabled={page >= total}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 text-slate-300 font-medium transition-colors">
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}