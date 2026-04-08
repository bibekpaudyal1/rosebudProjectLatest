// ============================================================
// apps/mobile/lib/api.ts
// Axios client for mobile — reads JWT from Zustand/SecureStore
// ============================================================
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/auth.store';

const BASE_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject access token from Zustand store
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ error: { message: string } }>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) { logout(); return Promise.reject(error); }

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken } = res.data.data;
        await setTokens({ accessToken, refreshToken });
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }

    const message = error.response?.data?.error?.message ?? error.message ?? 'Something went wrong';
    return Promise.reject(new Error(message));
  },
);

// ============================================================
// TYPED API FUNCTIONS
// ============================================================

export const mobileAuthApi = {
  sendOtp: (phone: string, purpose: string) =>
    api.post('/auth/otp/send', { phone, purpose }).then((r) => r.data),

  register: (dto: { phone: string; fullName: string; password: string; otp: string }) =>
    api.post('/auth/register', dto).then((r) => r.data.data),

  login: (dto: { phone?: string; email?: string; password: string }) =>
    api.post('/auth/login', dto).then((r) => r.data.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
};

export const mobileProductApi = {
  search: (params: {
    search?: string; categoryId?: string;
    minPrice?: number; maxPrice?: number;
    sortBy?: string; page?: number; limit?: number;
  }) => api.get('/products', { params }).then((r) => r.data),

  getBySlug: (slug: string) =>
    api.get(`/products/${slug}/by-slug`).then((r) => r.data.data),

  autocomplete: (q: string): Promise<string[]> =>
    api.get('/products/autocomplete', { params: { q } }).then((r) => r.data.data),

  getReviews: (productId: string, page = 1) =>
    api.get('/reviews', { params: { productId, page, limit: 10 } }).then((r) => r.data),
};

export const mobileCategoryApi = {
  getAll: () => api.get('/categories').then((r) => r.data.data),
};

export const mobileCartApi = {
  get:        ()                                        => api.get('/cart').then((r) => r.data.data),
  addItem:    (variantId: string, quantity: number)    => api.post('/cart/items', { variantId, quantity }).then((r) => r.data.data),
  updateItem: (variantId: string, quantity: number)    => api.patch(`/cart/items/${variantId}`, { quantity }).then((r) => r.data.data),
  removeItem: (variantId: string)                       => api.delete(`/cart/items/${variantId}`).then((r) => r.data.data),
  clear:      ()                                        => api.delete('/cart'),
};

export const mobileOrderApi = {
  create: (dto: { addressId: string; paymentMethod: string; couponCode?: string; notes?: string }) =>
    api.post('/orders', dto).then((r) => r.data.data),

  getMyOrders: (page = 1) =>
    api.get('/orders/my', { params: { page, limit: 15 } }).then((r) => r.data),

  getById: (id: string) =>
    api.get(`/orders/${id}`).then((r) => r.data.data),

  cancel: (id: string, reason?: string) =>
    api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data.data),
};

export const mobilePaymentApi = {
  initiate: (orderId: string, gateway: string) =>
    api.post('/payments/initiate', { orderId, gateway }).then((r) => r.data.data),
};

export const mobileShippingApi = {
  calculateRates: (district: string, weightKg?: number, isCod?: boolean) =>
    api.post('/shipping/calculate', { district, weightKg, isCod }).then((r) => r.data.data),
};

export const mobileUserApi = {
  getMe:       ()                           => api.get('/users/me').then((r) => r.data.data),
  updateMe:    (dto: Record<string, unknown>) => api.patch('/users/me', dto).then((r) => r.data.data),
  getAddresses: ()                           => api.get('/addresses').then((r) => r.data.data),
  createAddress: (dto: Record<string, unknown>) => api.post('/addresses', dto).then((r) => r.data.data),
};

// ============================================================
// REACT QUERY HOOKS
// ============================================================
import {
  useQuery, useMutation, useInfiniteQuery, useQueryClient,
} from '@tanstack/react-query';

export const QUERY_KEYS = {
  products:    (p: Record<string, unknown>) => ['products', p],
  product:     (slug: string)               => ['product', slug],
  reviews:     (id: string)                 => ['reviews', id],
  categories:  ()                           => ['categories'],
  cart:        ()                           => ['cart'],
  orders:      (p: number)                  => ['orders', p],
  order:       (id: string)                 => ['order', id],
  me:          ()                           => ['me'],
  addresses:   ()                           => ['addresses'],
} as const;

// Infinite scroll products
export function useInfiniteProducts(params: {
  search?: string; categoryId?: string;
  minPrice?: number; maxPrice?: number; sortBy?: string;
}) {
  return useInfiniteQuery({
    queryKey:          ['products-infinite', params],
    queryFn:           ({ pageParam = 1 }) => mobileProductApi.search({ ...params, page: pageParam as number, limit: 20 }),
    getNextPageParam:  (last) => last?.meta?.page < last?.meta?.totalPages ? last.meta.page + 1 : undefined,
    initialPageParam:  1,
    staleTime:         2 * 60 * 1000,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: QUERY_KEYS.product(slug),
    queryFn:  () => mobileProductApi.getBySlug(slug),
    staleTime:5 * 60 * 1000,
    enabled:  Boolean(slug),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories(),
    queryFn:  mobileCategoryApi.getAll,
    staleTime:30 * 60 * 1000,
  });
}

export function useCart() {
  return useQuery({
    queryKey: QUERY_KEYS.cart(),
    queryFn:  mobileCartApi.get,
    staleTime:30 * 1000,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      mobileCartApi.addItem(variantId, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.cart() }),
  });
}

export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.orders(page),
    queryFn:  () => mobileOrderApi.getMyOrders(page),
    staleTime:60 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey:       QUERY_KEYS.order(id),
    queryFn:        () => mobileOrderApi.getById(id),
    enabled:        Boolean(id),
    refetchInterval:(query) => {
      const status = (query.state.data as any)?.status;
      return ['confirmed','processing','packed','shipped','out_for_delivery'].includes(status) ? 30_000 : false;
    },
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: QUERY_KEYS.addresses(),
    queryFn:  mobileUserApi.getAddresses,
    staleTime:5 * 60 * 1000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mobileOrderApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.cart() });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useShippingRates(params: { district: string; weightKg?: number; isCod?: boolean }, enabled: boolean = true) {
  return useQuery({
    queryKey: ['shippingRates', params.district, params.weightKg, params.isCod],
    queryFn:  () => mobileShippingApi.calculateRates(params.district, params.weightKg, params.isCod),
    enabled:  Boolean(params.district) && enabled,
  });
}