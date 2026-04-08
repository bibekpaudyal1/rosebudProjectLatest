// apps/web/src/lib/api.ts
// Axios client with auth header injection and error normalisation
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import type {
  Product, Cart, Order, User, Address, Review,
  ApiResponse, ShippingRate,
} from '@bazarbd/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT access token on every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const session = await getSession();
  if ((session as any)?.accessToken) {
    config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
  }
  return config;
});

// Normalise errors
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error: { message: string; code: string } }>) => {
    const message = error.response?.data?.error?.message ?? error.message ?? 'Unknown error';
    return Promise.reject(new Error(message));
  },
);

// ============================================================
// TYPED API FUNCTIONS
// ============================================================

// ── Products ──────────────────────────────────────────────
export const productApi = {
  search: async (params: {
    search?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiResponse<Product[]>>('/products', { params });
    return data;
  },

  getBySlug: async (slug: string) => {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${slug}/by-slug`);
    return data.data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return data.data;
  },

  autocomplete: async (q: string): Promise<string[]> => {
    const { data } = await api.get<ApiResponse<string[]>>('/products/autocomplete', { params: { q } });
    return data.data;
  },

  getReviews: async (productId: string, page = 1) => {
    const { data } = await api.get<ApiResponse<Review[]>>(`/reviews`, {
      params: { productId, page, limit: 10 },
    });
    return data;
  },
};

// ── Categories ────────────────────────────────────────────
export const categoryApi = {
  getAll: async () => {
    const { data } = await api.get<ApiResponse<any[]>>('/categories');
    return data.data;
  },
};

// ── Cart ──────────────────────────────────────────────────
export const cartApi = {
  get: async (sessionId?: string) => {
    const { data } = await api.get<ApiResponse<Cart>>('/cart', {
      headers: sessionId ? { 'X-Session-Id': sessionId } : {},
    });
    return data.data;
  },

  addItem: async (variantId: string, quantity: number) => {
    const { data } = await api.post<ApiResponse<Cart>>('/cart/items', { variantId, quantity });
    return data.data;
  },

  updateItem: async (variantId: string, quantity: number) => {
    const { data } = await api.patch<ApiResponse<Cart>>(`/cart/items/${variantId}`, { quantity });
    return data.data;
  },

  removeItem: async (variantId: string) => {
    const { data } = await api.delete<ApiResponse<Cart>>(`/cart/items/${variantId}`);
    return data.data;
  },

  clear: async () => {
    await api.delete('/cart');
  },

  mergeGuestCart: async (sessionId: string) => {
    const { data } = await api.post<ApiResponse<Cart>>('/cart/merge', {}, {
      headers: { 'X-Session-Id': sessionId },
    });
    return data.data;
  },
};

// ── Orders ────────────────────────────────────────────────
export const orderApi = {
  create: async (dto: {
    addressId: string;
    paymentMethod: string;
    couponCode?: string;
    notes?: string;
  }) => {
    const { data } = await api.post<ApiResponse<Order>>('/orders', dto);
    return data.data;
  },

  getMyOrders: async (page = 1, limit = 10) => {
    const { data } = await api.get<ApiResponse<Order[]>>('/orders/my', {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return data.data;
  },

  cancel: async (id: string, reason?: string) => {
    const { data } = await api.post<ApiResponse<Order>>(`/orders/${id}/cancel`, { reason });
    return data.data;
  },
};

// ── Payments ──────────────────────────────────────────────
export const paymentApi = {
  initiate: async (dto: { orderId: string; gateway: string }) => {
    const { data } = await api.post<ApiResponse<{
      paymentId: string;
      redirectUrl?: string;
      gatewayData?: unknown;
    }>>('/payments/initiate', dto);
    return data.data;
  },
};

// ── Shipping ──────────────────────────────────────────────
export const shippingApi = {
  calculateRates: async (params: {
    district: string;
    weightKg?: number;
    isCod?: boolean;
  }) => {
    const { data } = await api.post<ApiResponse<{
      rates: ShippingRate[];
      cheapest: ShippingRate;
    }>>('/shipping/calculate', params);
    return data.data;
  },

  getShipmentByOrder: async (orderId: string) => {
    const { data } = await api.get<ApiResponse<any[]>>(`/shipping/orders/${orderId}`);
    return data.data;
  },
};

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  sendOtp: async (phone: string, purpose: string) => {
    const { data } = await api.post('/auth/otp/send', { phone, purpose });
    return data;
  },

  register: async (dto: { phone: string; fullName: string; password: string; otp: string }) => {
    const { data } = await api.post('/auth/register', dto);
    return data.data;
  },

  login: async (dto: { phone?: string; email?: string; password: string }) => {
    const { data } = await api.post('/auth/login', dto);
    return data.data;
  },
};

// ── User ──────────────────────────────────────────────────
export const userApi = {
  getMe: async () => {
    const { data } = await api.get<ApiResponse<User>>('/users/me');
    return data.data;
  },

  updateMe: async (dto: Partial<User>) => {
    const { data } = await api.patch<ApiResponse<User>>('/users/me', dto);
    return data.data;
  },

  getAddresses: async () => {
    const { data } = await api.get<ApiResponse<Address[]>>('/addresses');
    return data.data;
  },

  createAddress: async (dto: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const { data } = await api.post<ApiResponse<Address>>('/addresses', dto);
    return data.data;
  },
};

// ============================================================
// REACT QUERY HOOKS
// ============================================================
// apps/web/src/hooks/useProducts.ts

import {
  useQuery, useMutation, useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';

export const QUERY_KEYS = {
  products:        (params: Record<string, unknown>) => ['products', params],
  product:         (slug: string) => ['product', slug],
  productReviews:  (id: string) => ['product-reviews', id],
  categories:      () => ['categories'],
  cart:            () => ['cart'],
  orders:          (page: number) => ['orders', page],
  order:           (id: string) => ['order', id],
  shippingRates:   (params: Record<string, unknown>) => ['shipping-rates', params],
  me:              () => ['me'],
  addresses:       () => ['addresses'],
} as const;

// ── Products ──────────────────────────────────────────────
export function useProducts(params: {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.products(params),
    queryFn: () => productApi.search(params),
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: (prev) => prev,
  });
}

export function useInfiniteProducts(params: {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
}) {
  return useInfiniteQuery({
    queryKey: ['products-infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      productApi.search({ ...params, page: pageParam as number, limit: 20 }),
    getNextPageParam: (lastPage) =>
      lastPage.meta && lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: QUERY_KEYS.product(slug),
    queryFn: () => productApi.getBySlug(slug),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(slug),
  });
}

export function useProductReviews(productId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.productReviews(productId),
    queryFn: () => productApi.getReviews(productId),
    enabled: Boolean(productId),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories(),
    queryFn: categoryApi.getAll,
    staleTime: 30 * 60 * 1000, // 30 min — categories change rarely
  });
}

// ── Cart ──────────────────────────────────────────────────
export function useCart() {
  return useQuery({
    queryKey: QUERY_KEYS.cart(),
    queryFn: () => cartApi.get(),
    staleTime: 30 * 1000,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      cartApi.addItem(variantId, quantity),
    onSuccess: (updatedCart) => {
      qc.setQueryData(QUERY_KEYS.cart(), { data: updatedCart, success: true });
    },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      cartApi.updateItem(variantId, quantity),
    onSuccess: (updatedCart) => {
      qc.setQueryData(QUERY_KEYS.cart(), { data: updatedCart, success: true });
    },
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => cartApi.removeItem(variantId),
    onSuccess: (updatedCart) => {
      qc.setQueryData(QUERY_KEYS.cart(), { data: updatedCart, success: true });
    },
  });
}

// ── Orders ────────────────────────────────────────────────
export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.orders(page),
    queryFn: () => orderApi.getMyOrders(page),
    staleTime: 60 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.order(id),
    queryFn: () => orderApi.getById(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      // Poll every 30s for active orders
      const status = (query.state.data as any)?.status;
      const activeStatuses = ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery'];
      return status && activeStatuses.includes(status) ? 30_000 : false;
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.cart() });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ── User ──────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: QUERY_KEYS.me(),
    queryFn: userApi.getMe,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: QUERY_KEYS.addresses(),
    queryFn: userApi.getAddresses,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Shipping rates ─────────────────────────────────────────
export function useShippingRates(params: { district: string; weightKg?: number; isCod?: boolean }, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.shippingRates(params),
    queryFn: () => shippingApi.calculateRates(params),
    enabled: enabled && Boolean(params.district),
    staleTime: 10 * 60 * 1000,
  });
}

// ── Search ────────────────────────────────────────────────
export function useAutocomplete(query: string) {
  return useQuery({
    queryKey: ['autocomplete', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await api.get('/search/autocomplete', { params: { q: query } });
      return (data as any).suggestions ?? [];
    },
    enabled: query.length > 0,
  });
}

export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const { data } = await api.get('/search', { params: { q: query } });
      return data;
    },
    enabled: query.length > 0,
  });
}

// ── Auth ──────────────────────────────────────────────────
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      window.location.href = '/auth/login';
    },
  });
}