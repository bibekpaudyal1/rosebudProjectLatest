import React from 'react';

export function DataTable({ columns, data, loading, emptyMessage }: { columns: any[], data: any[], loading?: boolean, emptyMessage?: string }) {
  if (loading) return <div className="p-4 text-center text-gray-500">Loading...</div>;
  if (!data?.length) return <div className="p-4 text-center text-gray-500">{emptyMessage || 'No data'}</div>;

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow border border-gray-100">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
          <tr>
            {columns.map((col: any) => (
              <th key={col.key} className="px-4 py-3 font-semibold">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row: any, i: number) => (
            <tr key={row.id || i} className="hover:bg-gray-50 hover:text-gray-900 transition-colors">
              {columns.map((col: any) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
