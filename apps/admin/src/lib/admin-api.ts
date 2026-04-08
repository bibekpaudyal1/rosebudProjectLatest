// apps/admin/src/lib/admin-api.ts
import axios from 'axios';
import { getSession } from 'next-auth/react';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if ((session as any)?.accessToken) config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(new Error(e.response?.data?.error?.message ?? e.message)),
);

export const adminApi = {
  getDashboardStats:          () => api.get('/admin/stats/dashboard') as Promise<any>,
  getStats:                   () => api.get('/admin/stats/dashboard') as Promise<any>,
  getRevenueChart:            (range: string) => api.get(`/admin/stats/revenue?range=${range}`) as Promise<any>,
  getOrderStatusDistribution: () => api.get('/admin/stats/order-status') as Promise<any>,
  getUsers:          (p: Record<string, unknown>) => api.get('/users', { params: p }) as Promise<any>,
  deactivateUser:    (id: string) => api.delete(`/users/${id}`) as Promise<any>,
  getSellers:        (p: Record<string, unknown>) => api.get('/sellers', { params: p }) as Promise<any>,
  approveSeller:     (id: string) => api.post(`/sellers/${id}/approve`) as Promise<any>,
  rejectSeller:      (id: string, reason: string) => api.post(`/sellers/${id}/reject`, { reason }) as Promise<any>,
  suspendSeller:     (id: string) => api.post(`/sellers/${id}/suspend`) as Promise<any>,
  getProducts:       (p: Record<string, unknown>) => api.get('/products', { params: p }) as Promise<any>,
  approveProduct:    (id: string) => api.post(`/products/${id}/publish`) as Promise<any>,
  deleteProduct:     (id: string) => api.delete(`/products/${id}`) as Promise<any>,
  getOrders:         (p: Record<string, unknown>) => api.get('/admin/orders', { params: p }) as Promise<any>,
  getOrderById:      (id: string) => api.get(`/orders/${id}`) as Promise<any>,
  updateOrderStatus: (id: string, status: string, note?: string) => api.patch(`/orders/${id}/status`, { status, note }) as Promise<any>,
  getRefunds:        (p: Record<string, unknown>) => api.get('/admin/refunds', { params: p }) as Promise<any>,
  processRefund:     (paymentId: string, amount: number, reason: string) => api.post(`/payments/${paymentId}/refund`, { amount, reason }) as Promise<any>,
  getCoupons:        (p: Record<string, unknown>) => api.get('/coupons', { params: p }) as Promise<any>,
  createCoupon:      (dto: Record<string, unknown>) => api.post('/coupons', dto) as Promise<any>,
  toggleCoupon:      (id: string, isActive: boolean) => api.patch(`/coupons/${id}`, { isActive }) as Promise<any>,
  deleteCoupon:      (id: string) => api.delete(`/coupons/${id}`) as Promise<any>,
  getFlashSales:     () => api.get('/flash-sales') as Promise<any>,
  createFlashSale:   (dto: Record<string, unknown>) => api.post('/flash-sales', dto) as Promise<any>,
  activateFlashSale: (id: string) => api.post(`/flash-sales/${id}/activate`) as Promise<any>,
  getAuditLogs:      (p: Record<string, unknown>) => api.get('/admin/audit-logs', { params: p }) as Promise<any>,
  getTopSellers:     (limit = 10) => api.get(`/admin/analytics/top-sellers?limit=${limit}`) as Promise<any>,
  getTopProducts:    (limit = 10) => api.get(`/admin/analytics/top-products?limit=${limit}`) as Promise<any>,
};