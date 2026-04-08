export function TrustBar() {
  return (
    <div className="bg-[--brand-green] text-white">
      <div className="container-page">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/20 text-center">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-2 py-2.5 px-4">
              <span className="text-xl">{item.emoji}</span>
              <span className="text-xs sm:text-sm font-semibold text-white/90">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TRUST_ITEMS = [
  { emoji: '🚚', label: 'Fast Delivery' },
  { emoji: '💳', label: 'bKash · Nagad · COD' },
  { emoji: '🔒', label: 'Secure Checkout' },
  { emoji: '↩️', label: 'Easy Returns' },
];
