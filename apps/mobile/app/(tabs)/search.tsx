// ============================================================
// apps/mobile/app/(tabs)/search.tsx
// Search + browse products with filters and infinite scroll
// ============================================================
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, SlidersHorizontal } from 'lucide-react-native';
import { useInfiniteProducts } from '@/lib/api';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const SORT_OPTIONS = [
  { value: 'popularity', label: '🔥 Popular' },
  { value: 'createdAt',  label: '✨ Newest' },
  { value: 'price-asc',  label: '💰 Price ↑' },
  { value: 'price-desc', label: '💰 Price ↓' },
  { value: 'rating',     label: '⭐ Rated' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query,   setQuery]   = useState('');
  const [sortBy,  setSortBy]  = useState('popularity');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const inputRef = useRef<TextInput>(null);

  const {
    data, fetchNextPage, hasNextPage,
    isFetchingNextPage, isLoading,
  } = useInfiniteProducts({
    search: query,
    sortBy: sortBy === 'price-asc' || sortBy === 'price-desc' ? 'price' : sortBy,
    minPrice, maxPrice,
  });

  const products = data?.pages.flatMap((p) => p?.data ?? []) ?? [];
  const total    = data?.pages[0]?.meta?.total ?? 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const clearSearch = () => { setQuery(''); inputRef.current?.focus(); };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.green} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={[shared.center, { flex: 1, paddingTop: 80 }]}>
        <Text style={{ fontSize: 48 }}>🔍</Text>
        <Text style={[styles.emptyTitle, { marginTop: SPACING.lg }]}>No products found</Text>
        <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
      </View>
    );
  };

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>

      {/* ── Search bar ──────────────────────────────── */}
      <View style={styles.searchBox}>
        <View style={styles.inputRow}>
          <Search size={18} color={COLORS.gray400} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products..."
            placeholderTextColor={COLORS.gray400}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={18} color={COLORS.gray400} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Sort chips ──────────────────────────────── */}
      <FlatList
        horizontal
        data={SORT_OPTIONS}
        keyExtractor={(s) => s.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortStrip}
        renderItem={({ item: opt }) => (
          <TouchableOpacity
            onPress={() => setSortBy(opt.value)}
            style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? COLORS.green : COLORS.white }]}
          >
            <Text style={[styles.sortLabel, { color: sortBy === opt.value ? COLORS.white : COLORS.gray700 }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.sortRow}
      />

      {/* ── Result count ────────────────────────────── */}
      {!isLoading && (
        <Text style={styles.resultCount}>
          {total.toLocaleString()} {query ? `results for "${query}"` : 'products'}
        </Text>
      )}

      {/* ── Product grid ────────────────────────────── */}
      {isLoading ? (
        <FlatList
          numColumns={2}
          data={Array.from({ length: 8 })}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: SPACING.sm }}
          renderItem={() => <ProductCardSkeleton />}
        />
      ) : (
        <FlatList
          numColumns={2}
          data={products}
          keyExtractor={(p: any) => p.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: SPACING.sm }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox:   { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white },
  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.gray100, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, height: 44 },
  input:       { flex: 1, fontFamily: FONTS.regular, fontSize: 15, color: COLORS.gray900 },
  sortRow:     { backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  sortStrip:   { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  sortChip:    { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.gray200 },
  sortLabel:   { fontSize: 13, fontFamily: FONTS.semibold },
  resultCount: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500 },
  grid:        { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle:  { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900 },
  emptySub:    { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: SPACING.sm },
});