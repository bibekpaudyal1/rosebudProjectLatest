export function Footer() {
  return (
    <footer className="border-t bg-white py-8 text-gray-700">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Company */}
          <div>
            <h3 className="font-semibold text-gray-900">BazarBD</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/" className="hover:text-blue-600">Home</a></li>
              <li><a href="/" className="hover:text-blue-600">About Us</a></li>
              <li><a href="/" className="hover:text-blue-600">Contact</a></li>
              <li><a href="/" className="hover:text-blue-600">Careers</a></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold text-gray-900">Customer Service</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/" className="hover:text-blue-600">Help Center</a></li>
              <li><a href="/" className="hover:text-blue-600">Track Order</a></li>
              <li><a href="/" className="hover:text-blue-600">Returns</a></li>
              <li><a href="/" className="hover:text-blue-600">Shipping Info</a></li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-semibold text-gray-900">Policies</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/" className="hover:text-blue-600">Privacy Policy</a></li>
              <li><a href="/" className="hover:text-blue-600">Terms & Conditions</a></li>
              <li><a href="/" className="hover:text-blue-600">Cookie Policy</a></li>
              <li><a href="/" className="hover:text-blue-600">FAQ</a></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-semibold text-gray-900">Connect With Us</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/" className="hover:text-blue-600">Facebook</a></li>
              <li><a href="/" className="hover:text-blue-600">Twitter</a></li>
              <li><a href="/" className="hover:text-blue-600">Instagram</a></li>
              <li><a href="/" className="hover:text-blue-600">YouTube</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-gray-600">
          <p>&copy; 2026 BazarBD. All rights reserved. | Made in Bangladesh 🇧🇩</p>
        </div>
      </div>
    </footer>
  );
}
