'use client';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { useOrder } from '@/lib/api';

const ORDER_TIMELINE = [
  { status: 'confirmed',        label: 'Order Confirmed',     desc: 'Your order has been confirmed' },
  { status: 'processing',       label: 'Processing',          desc: 'Seller is preparing your order' },
  { status: 'packed',           label: 'Packed',              desc: 'Order packed and ready to ship' },
  { status: 'shipped',          label: 'Shipped',             desc: 'Order handed to courier' },
  { status: 'out_for_delivery', label: 'Out for Delivery',    desc: 'On the way to your address' },
  { status: 'delivered',        label: 'Delivered',           desc: 'Order delivered successfully' },
];

const STATUS_ORDER = ORDER_TIMELINE.map((s) => s.status);

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const { data: order, isLoading } = useOrder(params.id) as any;

  if (isLoading) {
    return (
      <div className="container-page py-8 max-w-2xl">
        {[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-xl mb-4" />)}
      </div>
    );
  }

  if (!order) return <div className="container-page py-16 text-center text-gray-500">Order not found</div>;

  const currentIndex = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="container-page py-8 max-w-2xl">
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Placed {new Date(order.createdAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className={`order-status-${order.status} text-xs px-3 py-1.5`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-6">
          {ORDER_TIMELINE.map((step, i) => {
            const isDone    = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isPending = i > currentIndex;
            const isLast    = i === ORDER_TIMELINE.length - 1;

            return (
              <div key={step.status} className="timeline-item">
                {!isLast && <div className={`timeline-line ${isDone ? 'bg-[--brand-green]' : 'bg-gray-200'}`} />}

                {isDone && (
                  <div className="timeline-dot-done">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                {isCurrent && (
                  <div className="timeline-dot-active">
                    <Clock className="w-3.5 h-3.5 text-white animate-spin-slow" />
                  </div>
                )}
                {isPending && <div className="timeline-dot-pending" />}

                <div className={isPending ? 'opacity-40' : ''}>
                  <p className={`text-sm font-bold ${isCurrent ? 'text-brand-orange-DEFAULT' : isDone ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-gray-900 mb-4">Items Ordered</h2>
        <div className="space-y-3">
          {order.items?.map((item: any) => (
            <div key={item.id} className="flex gap-3">
              <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                {item.productSnapshot?.thumbnailUrl && (
                  <img src={item.productSnapshot.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productSnapshot?.name}</p>
                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              </div>
              <span className="text-sm font-bold text-gray-900 shrink-0">
                ৳{Number(item.totalPrice).toLocaleString('en-BD')}
              </span>
            </div>
          ))}
        </div>
        <div className="divider" />
        <div className="flex justify-between font-black text-gray-900">
          <span>Total Paid</span>
          <span>৳{Number(order.total).toLocaleString('en-BD')}</span>
        </div>
      </div>
    </div>
  );
}
