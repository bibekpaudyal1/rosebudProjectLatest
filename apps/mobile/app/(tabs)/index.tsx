// ============================================================
// apps/mobile/app/(tabs)/index.tsx
// Home screen — banner, flash sale, categories, product grids
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Bell, Zap } from 'lucide-react-native';
import { useInfiniteProducts, useCategories } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const { width: W } = Dimensions.get('window');

const BANNERS = [
  { id: '1', title: 'Eid Sale', subtitle: 'Up to 70% off', bg: '#0A6E4F', emoji: '🎉' },
  { id: '2', title: 'New Phones', subtitle: 'Best prices',  bg: '#1E3A5F', emoji: '📱' },
  { id: '3', title: 'Flash Deal', subtitle: 'Ends tonight', bg: '#7B2D8B', emoji: '⚡' },
];

const CATEGORIES = [
  { id: '1', name: 'Electronics', emoji: '📱', color: '#DBEAFE' },
  { id: '2', name: 'Fashion',     emoji: '👗', color: '#FCE7F3' },
  { id: '3', name: 'Home',        emoji: '🏠', color: '#FEF3C7' },
  { id: '4', name: 'Books',       emoji: '📚', color: '#D1FAE5' },
  { id: '5', name: 'Beauty',      emoji: '💄', color: '#FFE4E6' },
  { id: '6', name: 'Sports',      emoji: '⚽', color: '#FFEDD5' },
  { id: '7', name: 'Groceries',   emoji: '🛒', color: '#ECFDF5' },
  { id: '8', name: 'Toys',        emoji: '🧸', color: '#FEF9C3' },
];

export default function HomeScreen() {
  const insets   = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [timeLeft, setTimeLeft]       = useState({ h: 3, m: 22, s: 15 });
  const [refreshing, setRefreshing]   = useState(false);
  const bannerRef = useRef<FlatList>(null);

  const { data: trendingData, refetch: refetchTrending } = useInfiniteProducts({ sortBy: 'popularity' });
  const { data: newData,      refetch: refetchNew }      = useInfiniteProducts({ sortBy: 'createdAt' });

  const trendingProducts = trendingData?.pages[0]?.data ?? [];
  const newProducts      = newData?.pages[0]?.data ?? [];

  // Banner auto-scroll
  useEffect(() => {
    const t = setInterval(() => {
      const next = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(next);
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
    }, 4000);
    return () => clearInterval(t);
  }, [bannerIndex]);

  // Countdown
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((p) => {
        let { h, m, s } = p;
        s -= 1;
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) return { h: 0, m: 0, s: 0 };
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchTrending(), refetchNew()]);
    setRefreshing(false);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.green} />}
    >
      {/* ── Topbar ─────────────────────────────────────── */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarBrand}>BazarBD</Text>
          <Text style={styles.topbarSub}>Dhaka, Bangladesh</Text>
        </View>
        <View style={shared.row}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/search')}>
            <Search size={20} color={COLORS.gray700} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: SPACING.sm }]}>
            <Bell size={20} color={COLORS.gray700} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ─────────────────────────────────── */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => router.push('/(tabs)/search')}
        activeOpacity={0.8}
      >
        <Search size={16} color={COLORS.gray400} />
        <Text style={styles.searchPlaceholder}>Search products, brands...</Text>
      </TouchableOpacity>

      {/* ── Banner carousel ────────────────────────────── */}
      <View style={styles.bannerContainer}>
        <FlatList
          ref={bannerRef}
          data={BANNERS}
          keyExtractor={(b) => b.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / (W - SPACING.lg * 2)));
          }}
          renderItem={({ item: banner }) => (
            <View style={[styles.banner, { backgroundColor: banner.bg, width: W - SPACING.lg * 2 }]}>
              <View style={styles.bannerDots}>
                {BANNERS.map((_, i) => (
                  <View key={i} style={[styles.dot, { width: i === bannerIndex ? 20 : 6, opacity: i === bannerIndex ? 1 : 0.4 }]} />
                ))}
              </View>
              <Text style={styles.bannerEmoji}>{banner.emoji}</Text>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              <TouchableOpacity style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Shop Now</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      {/* ── Flash sale countdown ─────────────────────── */}
      <View style={styles.flashSale}>
        <View style={shared.row}>
          <Zap size={18} color="#FCD34D" fill="#FCD34D" />
          <Text style={styles.flashTitle}>  Flash Sale</Text>
        </View>
        <View style={shared.row}>
          {[['h', timeLeft.h], ['m', timeLeft.m], ['s', timeLeft.s]].map(([label, val], i) => (
            <React.Fragment key={label as string}>
              {i > 0 && <Text style={styles.flashColon}>:</Text>}
              <View style={styles.flashBox}>
                <Text style={styles.flashNum}>{pad(val as number)}</Text>
                <Text style={styles.flashLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/search?flashSale=true')}>
          <Text style={styles.flashCta}>See all →</Text>
        </TouchableOpacity>
      </View>

      {/* ── Categories ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={shared.sectionTitle}>Categories</Text>
        <FlatList
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACING.sm }}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={styles.catItem}
              onPress={() => router.push(`/(tabs)/search?categoryName=${cat.name}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.catIcon, { backgroundColor: cat.color }]}>
                <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
              </View>
              <Text style={styles.catLabel}>{cat.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Trending products ──────────────────────────── */}
      <View style={styles.section}>
        <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.md }]}>
          <Text style={shared.sectionTitle}>Trending Now</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search?sortBy=popularity')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={trendingProducts.slice(0, 6)}
          keyExtractor={(p: any) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACING.sm }}
          renderItem={({ item }) => <ProductCard product={item} horizontal />}
        />
      </View>

      {/* ── New arrivals ───────────────────────────────── */}
      <View style={[styles.section, { marginBottom: SPACING.xxxl }]}>
        <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.md }]}>
          <Text style={shared.sectionTitle}>New Arrivals</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search?sortBy=createdAt')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.grid}>
          {newProducts.slice(0, 6).map((p: any) => (
            <ProductCard key={p.id} product={p} style={{ width: (W - SPACING.lg * 2 - SPACING.sm) / 2 }} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: COLORS.gray50 },
  topbar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  topbarBrand:      { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.green },
  topbarSub:        { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 1 },
  iconBtn:          { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  notifDot:         { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.orange, borderWidth: 1.5, borderColor: COLORS.white },
  searchBar:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, ...SHADOW.sm, borderWidth: 0.5, borderColor: COLORS.gray200 },
  searchPlaceholder:{ flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray400 },
  bannerContainer:  { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  banner:           { borderRadius: RADIUS.xl, padding: SPACING.xl, minHeight: 160, justifyContent: 'flex-end', overflow: 'hidden' },
  bannerDots:       { position: 'absolute', bottom: SPACING.md, left: SPACING.xl, flexDirection: 'row', gap: 5 },
  dot:              { height: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.8)' },
  bannerEmoji:      { position: 'absolute', right: SPACING.xl, top: SPACING.xl, fontSize: 60 },
  bannerTitle:      { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.white, lineHeight: 32 },
  bannerSubtitle:   { fontSize: 14, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.85)', marginTop: 4, marginBottom: SPACING.md },
  bannerBtn:        { backgroundColor: COLORS.white, alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  bannerBtnText:    { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.gray900 },
  flashSale:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#B91C1C', marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, marginBottom: SPACING.lg },
  flashTitle:       { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.white },
  flashColon:       { fontSize: 18, fontFamily: FONTS.extrabold, color: 'rgba(255,255,255,0.7)', marginHorizontal: 2 },
  flashBox:         { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm, padding: 4, minWidth: 34, alignItems: 'center' },
  flashNum:         { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white, lineHeight: 20 },
  flashLabel:       { fontSize: 8, fontFamily: FONTS.semibold, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },
  flashCta:         { fontSize: 13, fontFamily: FONTS.bold, color: 'rgba(255,255,255,0.9)' },
  section:          { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  catItem:          { alignItems: 'center', gap: SPACING.xs },
  catIcon:          { width: 60, height: 60, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  catLabel:         { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.gray700, textAlign: 'center' },
  seeAll:           { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.green },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});