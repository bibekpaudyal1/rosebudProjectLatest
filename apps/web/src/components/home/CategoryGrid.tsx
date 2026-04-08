import Link from 'next/link';

const CATEGORIES = [
  { name: 'Electronics',  slug: 'electronics',   emoji: '📱', color: 'bg-blue-50 text-blue-700' },
  { name: 'Fashion',      slug: 'fashion',        emoji: '👗', color: 'bg-pink-50 text-pink-700' },
  { name: 'Home',         slug: 'home-living',    emoji: '🏠', color: 'bg-amber-50 text-amber-700' },
  { name: 'Books',        slug: 'books',          emoji: '📚', color: 'bg-green-50 text-green-700' },
  { name: 'Beauty',       slug: 'beauty',         emoji: '💄', color: 'bg-rose-50 text-rose-700' },
  { name: 'Sports',       slug: 'sports',         emoji: '⚽', color: 'bg-orange-50 text-orange-700' },
  { name: 'Groceries',    slug: 'groceries',      emoji: '🛒', color: 'bg-lime-50 text-lime-700' },
  { name: 'Toys',         slug: 'toys',           emoji: '🧸', color: 'bg-yellow-50 text-yellow-700' },
];

export function CategoryGrid() {
  return (
    <section className="my-6">
      <h2 className="section-title mb-4">Shop by Category</h2>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/products?categorySlug=${cat.slug}`}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 transition-all hover:-translate-y-0.5 hover:shadow-sm group"
          >
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${cat.color} flex items-center justify-center text-2xl sm:text-3xl transition-transform group-hover:scale-110`}>
              {cat.emoji}
            </div>
            <span className="text-xs font-semibold text-center text-gray-700 leading-tight">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
