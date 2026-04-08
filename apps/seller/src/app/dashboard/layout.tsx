// apps/seller/src/app/dashboard/layout.tsx
import { SellerSidebar } from '@/components/layout/SellerSidebar';

export default function SellerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SellerSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-56 transition-all duration-300">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 shrink-0 shadow-sm">
          <div className="flex-1" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0A6E4F] hover:underline"
          >
            View storefront ↗
          </a>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
