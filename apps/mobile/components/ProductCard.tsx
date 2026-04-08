// ============================================================
// apps/mobile/components/ProductCard.tsx
// Reusable product card — vertical (grid) and horizontal (list) modes
// ============================================================
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ViewStyle, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Star } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const { width: W } = Dimensions.get('window');

interface ProductCardProps {
  product:    any;
  horizontal?: boolean;
  style?:     ViewStyle;
}

export function ProductCard({ product, horizontal = false, style }: ProductCardProps) {
  const price        = product.variants?.[0]?.price ?? product.basePrice;
  const comparePrice = product.variants?.[0]?.comparePrice ?? product.comparePrice;
  const discount     = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  return (
    <TouchableOpacity
      style={[horizontal ? styles.horizontal : styles.vertical, style]}
      onPress={() => router.push(`/product/${product.slug}`)}
      activeOpacity={0.85}
    >
      {/* Image */}
      <View style={horizontal ? styles.hImg : styles.vImg}>
        <Image
          source={{ uri: product.thumbnailUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89uX3HwAIiAOSgcWVvwAAAABJRU5ErkJggg=="
        />
        {discount > 5 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={horizontal ? styles.hInfo : styles.vInfo}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

        {product.rating > 0 && (
          <View style={[shared.row, { gap: 3, marginTop: 3 }]}>
            <Star size={11} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({product.reviewCount})</Text>
          </View>
        )}

        <View style={[shared.row, { gap: 6, marginTop: 5, flexWrap: 'wrap' }]}>
          <Text style={styles.price}>৳{Math.round(price).toLocaleString('en-BD')}</Text>
          {comparePrice && (
            <Text style={styles.comparePrice}>৳{Math.round(comparePrice).toLocaleString('en-BD')}</Text>
          )}
        </View>

        {product.soldCount > 50 && (
          <Text style={styles.sold}>{product.soldCount.toLocaleString()} sold</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function ProductCardSkeleton({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <View style={[horizontal ? styles.horizontal : styles.vertical, { overflow: 'hidden' }]}>
      <View style={[horizontal ? styles.hImg : styles.vImg, styles.skeleton]} />
      <View style={horizontal ? styles.hInfo : styles.vInfo}>
        <View style={[styles.skeleton, { height: 12, borderRadius: 4, marginBottom: 6, width: '90%' }]} />
        <View style={[styles.skeleton, { height: 12, borderRadius: 4, marginBottom: 6, width: '70%' }]} />
        <View style={[styles.skeleton, { height: 16, borderRadius: 4, width: '40%' }]} />
      </View>
    </View>
  );
}

const CARD_W = (W - SPACING.lg * 2 - SPACING.sm) / 2;

const styles = StyleSheet.create({
  vertical: {
    width:           CARD_W,
    backgroundColor: COLORS.white,
    borderRadius:    RADIUS.lg,
    overflow:        'hidden',
    ...SHADOW.sm,
    borderWidth:     0.5,
    borderColor:     COLORS.gray200,
  },
  horizontal: {
    width:           160,
    backgroundColor: COLORS.white,
    borderRadius:    RADIUS.lg,
    overflow:        'hidden',
    ...SHADOW.sm,
    borderWidth:     0.5,
    borderColor:     COLORS.gray200,
  },
  vImg: { aspectRatio: 1, backgroundColor: COLORS.gray100 },
  hImg: { height: 140, backgroundColor: COLORS.gray100 },
  vInfo:        { padding: SPACING.sm },
  hInfo:        { padding: SPACING.sm },
  discountBadge:{ position: 'absolute', top: SPACING.xs, left: SPACING.xs, backgroundColor: COLORS.red, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.white },
  name:         { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.gray700, lineHeight: 17 },
  rating:       { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.gray700 },
  ratingCount:  { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.gray400 },
  price:        { fontSize: 15, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  comparePrice: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray400, textDecorationLine: 'line-through' },
  sold:         { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.gray400, marginTop: 2 },
  skeleton:     { backgroundColor: COLORS.gray200 },
});