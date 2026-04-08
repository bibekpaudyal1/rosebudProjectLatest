// apps/seller/src/lib/seller-api.ts
import axios from 'axios';
import { getSession } from 'next-auth/react';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const api  = axios.create({ baseURL: BASE, timeout: 15_000 });

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if ((session as any)?.accessToken) config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(new Error(e.response?.data?.error?.message ?? e.message)),
);

export const sellerApi = {
  getStats:           () => api.get('/seller/stats') as Promise<any>,
  getRevenueChart:    (range: string) => api.get(`/seller/stats/revenue?range=${range}`) as Promise<any>,
  getProducts:        (p?: Record<string, unknown>) => api.get('/seller/products', { params: p }) as Promise<any>,
  createProduct:      (dto: unknown) => api.post('/products', dto) as Promise<any>,
  updateProduct:      (id: string, dto: unknown) => api.patch(`/products/${id}`, dto) as Promise<any>,
  publishProduct:     (id: string) => api.post(`/products/${id}/publish`) as Promise<any>,
  unpublishProduct:   (id: string) => api.post(`/products/${id}/unpublish`) as Promise<any>,
  deleteProduct:      (id: string) => api.delete(`/products/${id}`) as Promise<any>,
  getOrders:          (p?: Record<string, unknown>) => api.get('/orders/seller', { params: p }) as Promise<any>,
  getOrderById:       (id: string) => api.get(`/orders/${id}`) as Promise<any>,
  updateStatus:       (id: string, status: string, note?: string) => api.patch(`/orders/${id}/status`, { status, note }) as Promise<any>,
  getInventory:       (p?: Record<string, unknown>) => api.get('/seller/inventory', { params: p }) as Promise<any>,
  restock:            (variantId: string, quantity: number, note?: string) => api.post('/inventory/restock', { variantId, quantity, note }) as Promise<any>,
  getLowStockItems:   () => api.get('/inventory/alerts/low-stock') as Promise<any>,
  getCoupons:         () => api.get('/seller/coupons') as Promise<any>,
  createCoupon:       (dto: unknown) => api.post('/seller/coupons', dto) as Promise<any>,
  toggleCoupon:       (id: string, isActive: boolean) => api.patch(`/seller/coupons/${id}`, { isActive }) as Promise<any>,
  getReviews:         (p?: Record<string, unknown>) => api.get('/seller/reviews', { params: p }) as Promise<any>,
  getPayouts:         (p?: Record<string, unknown>) => api.get('/seller/payouts', { params: p }) as Promise<any>,
  requestPayout:      (amount: number) => api.post('/seller/payouts/request', { amount }) as Promise<any>,
  getShopProfile:     () => api.get('/seller/profile') as Promise<any>,
  updateShopProfile:  (dto: unknown) => api.patch('/seller/profile', dto) as Promise<any>,
};
