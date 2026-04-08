import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from './api-client';

// User hooks
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/me');
      return data;
    },
    enabled: typeof window !== 'undefined',
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      window.location.href = '/auth/login';
    },
  });
}

// Cart hooks
export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const { data } = await apiClient.get('/cart');
      return data;
    },
  });
}

export function useUpdateCartItem() {
  return useMutation({
    mutationFn: async (vars: { itemId: string; quantity: number }) => {
      const { data } = await apiClient.put(`/cart/${vars.itemId}`, { quantity: vars.quantity });
      return data;
    },
  });
}

export function useRemoveFromCart() {
  return useMutation({
    mutationFn: async (itemId: string) => {
      await apiClient.delete(`/cart/${itemId}`);
    },
  });
}

// Search hooks
export function useAutocomplete(query: string) {
  return useQuery({
    queryKey: ['autocomplete', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await apiClient.get('/search/autocomplete', { params: { q: query } });
      return data.suggestions ?? [];
    },
    enabled: query.length > 0,
  });
}

export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const { data } = await apiClient.get('/search', { params: { q: query } });
      return data;
    },
    enabled: query.length > 0,
  });
}
