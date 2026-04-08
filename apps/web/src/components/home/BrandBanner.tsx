export function BrandBanner() {
  const brands = [
    { name: 'Samsung', logo: '📱' },
    { name: 'Apple', logo: '🍎' },
    { name: 'Sony', logo: '🎧' },
    { name: 'LG', logo: '📺' },
    { name: 'Nike', logo: '👟' },
    { name: 'Adidas', logo: '⚽' },
  ];

  return (
    <section className="my-8 py-6 px-4 bg-gray-50 rounded-2xl">
      <h2 className="section-title text-center mb-6">Featured Brands</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {brands.map((brand) => (
          <div
            key={brand.name}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="text-3xl md:text-4xl mb-2">{brand.logo}</div>
            <p className="text-xs md:text-sm font-semibold text-gray-700 text-center">{brand.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
