'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MapPin, CreditCard, ClipboardList } from 'lucide-react';
import { useCart, useAddresses, useShippingRates, useCreateOrder } from '@/lib/api';

type Step = 'address' | 'payment' | 'review';
const STEPS: { id: Step; label: string; Icon: any }[] = [
  { id: 'address', label: 'Delivery',   Icon: MapPin },
  { id: 'payment', label: 'Payment',    Icon: CreditCard },
  { id: 'review',  label: 'Review',     Icon: ClipboardList },
];

const PAYMENT_OPTIONS = [
  { id: 'bkash',      label: 'bKash',     logo: '💚', desc: 'Pay with bKash wallet' },
  { id: 'nagad',      label: 'Nagad',     logo: '🟠', desc: 'Pay with Nagad wallet' },
  { id: 'sslcommerz', label: 'Card',      logo: '💳', desc: 'Visa, Mastercard, AMEX' },
  { id: 'cod',        label: 'Cash on Delivery', logo: '💵', desc: 'Pay when you receive' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { data: cartData } = useCart();
  const { data: addresses } = useAddresses();
  const createOrder = useCreateOrder();

  const [step, setStep]           = useState<Step>('address');
  const [addressId, setAddressId] = useState('');
  const [payment, setPayment]     = useState('cod');
  const [couponCode, setCouponCode] = useState('');
  const [notes, setNotes]         = useState('');
  const [placing, setPlacing]     = useState(false);
  const [error, setError]         = useState('');

  const cart = cartData as any;
  const selectedAddress = addresses?.find((a: any) => a.id === addressId);

  const { data: ratesData } = useShippingRates(
    { district: selectedAddress?.district ?? 'Dhaka' },
    Boolean(selectedAddress),
  );
  const shippingFee = ratesData?.cheapest?.price ?? 60;
  const total = (cart?.subtotal ?? 0) + shippingFee;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const placeOrder = async () => {
    if (!addressId) return setError('Please select a delivery address');
    if (!payment)   return setError('Please select a payment method');

    setPlacing(true); setError('');
    try {
      const order = await createOrder.mutateAsync({
        addressId,
        paymentMethod: payment,
        couponCode: couponCode || undefined,
        notes: notes || undefined,
      });

      if (payment === 'bkash' || payment === 'nagad' || payment === 'sslcommerz') {
        const res = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, gateway: payment }),
        });
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
      }

      router.push(`/checkout/success?orderId=${order.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container-page py-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i < stepIndex && setStep(s.id)}
              disabled={i > stepIndex}
              className="flex items-center gap-2 group disabled:cursor-default"
            >
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all
                ${i < stepIndex  ? 'bg-[--brand-green] text-white' : ''}
                ${i === stepIndex ? 'bg-[--brand-green] text-white ring-4 ring-[--brand-green-pale]' : ''}
                ${i > stepIndex  ? 'bg-gray-200 text-gray-400' : ''}
              `}>
                {i < stepIndex ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-sm font-semibold hidden sm:block ${i === stepIndex ? 'text-[--brand-green]' : i < stepIndex ? 'text-gray-700' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < stepIndex ? 'bg-[--brand-green]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-200">
              {error}
            </div>
          )}

          {step === 'address' && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Select Delivery Address</h2>
              {addresses?.length === 0 && (
                <div className="text-center py-8">
                  <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No saved addresses</p>
                  <a href="/account/addresses/new" className="btn btn-primary btn-md">Add Address</a>
                </div>
              )}
              {addresses?.map((addr: any) => (
                <label key={addr.id} className={`flex gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${addressId === addr.id ? 'border-[--brand-green] bg-[--brand-green-pale]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="address" value={addr.id} checked={addressId === addr.id} onChange={() => setAddressId(addr.id)} className="mt-1 accent-[--brand-green]" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900">{addr.recipientName}</p>
                      <span className="badge badge-gray text-[10px]">{addr.label}</span>
                      {addr.isDefault && <span className="badge badge-green text-[10px]">Default</span>}
                    </div>
                    <p className="text-gray-600">{addr.phone}</p>
                    <p className="text-gray-600">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                    <p className="text-gray-600">{addr.district}, {addr.division}</p>
                  </div>
                </label>
              ))}
              <button
                onClick={() => { if (addressId) setStep('payment'); else setError('Select an address'); }}
                disabled={!addressId}
                className="btn btn-primary btn-lg w-full"
              >
                Continue to Payment
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Payment Method</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${payment === opt.id ? 'border-[--brand-green] bg-[--brand-green-pale]' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="payment" value={opt.id} checked={payment === opt.id} onChange={() => setPayment(opt.id)} className="accent-[--brand-green]" />
                    <span className="text-2xl">{opt.logo}</span>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="label">Coupon Code (optional)</label>
                <div className="flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="input flex-1 uppercase font-mono" />
                  <button className="btn btn-secondary btn-md px-5">Apply</button>
                </div>
              </div>

              <div>
                <label className="label">Order notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." className="input h-20 resize-none py-3" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('address')} className="btn btn-secondary btn-lg flex-1">Back</button>
                <button onClick={() => setStep('review')} className="btn btn-primary btn-lg flex-1">Review Order</button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-900">Review Your Order</h2>

              {cart?.items?.map((item: any) => (
                <div key={item.variantId} className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {item.variant?.product?.thumbnailUrl && (
                      <img src={item.variant.product.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.variant?.product?.name}</p>
                    <p className="text-xs text-gray-500">{item.variant?.name} × {item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">৳{item.totalPrice.toLocaleString('en-BD')}</span>
                </div>
              ))}

              <div className="flex gap-3">
                <button onClick={() => setStep('payment')} className="btn btn-secondary btn-lg flex-1">Back</button>
                <button onClick={placeOrder} disabled={placing} className="btn btn-primary btn-lg flex-1">
                  {placing ? 'Placing order...' : `Place Order · ৳${total.toLocaleString('en-BD')}`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cart?.itemCount} items)</span>
                <span>৳{(cart?.subtotal ?? 0).toLocaleString('en-BD')}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery fee</span>
                <span>{selectedAddress ? `৳${shippingFee}` : 'TBD'}</span>
              </div>
              {couponCode && (
                <div className="flex justify-between text-[--brand-green] font-medium">
                  <span>Coupon discount</span>
                  <span>-৳0</span>
                </div>
              )}
              <div className="divider" />
              <div className="flex justify-between font-black text-gray-900 text-base">
                <span>Total</span>
                <span>৳{total.toLocaleString('en-BD')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
