import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminTopBar }  from '@/components/layout/AdminTopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-56 transition-all duration-300">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
