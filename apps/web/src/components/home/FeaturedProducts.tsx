import Link from 'next/link';

type FeaturedProductsProps = {
  sortBy: 'popularity' | 'createdAt';
  limit: number;
};

export async function FeaturedProducts({ sortBy, limit }: FeaturedProductsProps) {
  // Mock data - replace with actual API call
  const products = Array.from({ length: limit }, (_, i) => ({
    id: i + 1,
    slug: `product-${i + 1}`,
    title: `Product ${i + 1}`,
    price: Math.floor(Math.random() * 10000) + 1000,
    salePrice: Math.floor(Math.random() * 8000) + 500,
    image: '/placeholder-product.jpg',
    rating: Math.floor(Math.random() * 5) + 1,
    reviews: Math.floor(Math.random() * 500),
  }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.slug}`}
          className="group"
        >
          <div className="bg-gray-100 rounded-lg overflow-hidden mb-2 h-40 md:h-48 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors">
            {product.image}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-[--brand-green]">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-gray-900">৳{product.salePrice}</span>
            <span className="text-sm text-gray-500 line-through">৳{product.price}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-yellow-400">★</span>
            <span className="text-xs text-gray-600">({product.reviews})</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
