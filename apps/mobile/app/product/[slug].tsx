// ============================================================
// apps/mobile/app/product/[slug].tsx
// Product detail — image gallery, variant selector, add to cart
// ============================================================
import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  StyleSheet, Dimensions, Animated, ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingCart, Heart, Share2, Star, Shield, Truck, RotateCcw, Plus, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { showMessage } from 'react-native-flash-message';
import { useProduct, useAddToCart } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const { width: W } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { slug }  = useLocalSearchParams<{ slug: string }>();
  const insets    = useSafeAreaInsets();
  const { data: product, isLoading } = useProduct(slug);
  const addToCartMutation = useAddToCart();
  const cartStore = useCartStore();

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedImage,   setSelectedImage]   = useState(0);
  const [quantity,        setQuantity]         = useState(1);
  const [wishlisted,      setWishlisted]       = useState(false);
  const [adding,          setAdding]           = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  const variant      = selectedVariant ?? product?.variants?.[0];
  const images       = product?.images?.map((i: any) => i.url) ?? (product?.thumbnailUrl ? [product.thumbnailUrl] : []);
  const price        = variant?.price ?? product?.basePrice ?? 0;
  const comparePrice = variant?.comparePrice ?? product?.comparePrice;
  const discount     = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  const attributeKeys = variant?.attributes ? Object.keys(variant.attributes) : [];

  const getValuesByKey = (key: string) => [
    ...new Set(product?.variants?.map((v: any) => v.attributes?.[key])),
  ];

  const handleAddToCart = async (buyNow = false) => {
    if (!variant) return;
    setAdding(true);
    try {
      await addToCartMutation.mutateAsync({ variantId: variant.id, quantity });
      // Also add to local store for offline support
      cartStore.addItem({
        variantId:  variant.id,
        quantity,
        name:       product.name,
        price:      Number(price),
        imageUrl:   product.thumbnailUrl,
        attributes: variant.attributes,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (buyNow) {
        router.push('/checkout');
      } else {
        showMessage({ message: 'Added to cart!', type: 'success', icon: 'success', duration: 2000 });
      }
    } catch (e: any) {
      showMessage({ message: e.message ?? 'Failed to add to cart', type: 'danger', icon: 'danger' });
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[shared.screen, shared.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[shared.screen, shared.center]}>
        <Text style={{ fontFamily: FONTS.medium, color: COLORS.gray500 }}>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>
      {/* ── Top actions ──────────────────────────────── */}
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color={COLORS.gray900} />
        </TouchableOpacity>
        <View style={shared.row}>
          <TouchableOpacity style={[styles.circleBtn, { marginRight: SPACING.sm }]} onPress={() => setWishlisted(!wishlisted)}>
            <Heart size={20} color={wishlisted ? COLORS.red : COLORS.gray700} fill={wishlisted ? COLORS.red : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn}>
            <Share2 size={20} color={COLORS.gray700} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Image gallery ────────────────────────────── */}
        <View style={styles.gallery}>
          <Animated.FlatList
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
            onMomentumScrollEnd={(e) => {
              setSelectedImage(Math.round(e.nativeEvent.contentOffset.x / W));
            }}
            renderItem={({ item: imgUrl }) => (
              <Image source={{ uri: imgUrl }} style={{ width: W, height: W * 0.85 }} contentFit="contain" />
            )}
          />

          {/* Image dots */}
          {images.length > 1 && (
            <View style={styles.imageDots}>
              {images.map((_: any, i: number) => (
                <View
                  key={i}
                  style={[styles.imgDot, {
                    width:       i === selectedImage ? 18 : 6,
                    backgroundColor: i === selectedImage ? COLORS.green : COLORS.gray300,
                  }]}
                />
              ))}
            </View>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip} contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}>
              {images.map((url: string, i: number) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedImage(i)}
                  style={[styles.thumb, { borderColor: i === selectedImage ? COLORS.green : COLORS.gray200 }]}
                >
                  <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Product info ─────────────────────────────── */}
        <View style={styles.info}>
          {/* Price + discount */}
          <View style={[shared.row, { gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.xs }]}>
            <Text style={styles.price}>৳{Math.round(price).toLocaleString('en-BD')}</Text>
            {comparePrice && (
              <>
                <Text style={styles.comparePrice}>৳{Math.round(comparePrice).toLocaleString('en-BD')}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{discount}% OFF</Text>
                </View>
              </>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name}>{product.name}</Text>

          {/* Rating */}
          {product.rating > 0 && (
            <View style={[shared.row, { gap: 6, marginTop: SPACING.sm }]}>
              <View style={shared.row}>
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={14} color="#F59E0B" fill={s <= Math.round(product.rating) ? '#F59E0B' : 'transparent'} />
                ))}
              </View>
              <Text style={styles.ratingNum}>{product.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({product.reviewCount} reviews)</Text>
              <Text style={styles.ratingCount}>· {product.soldCount?.toLocaleString()} sold</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Variants */}
          {attributeKeys.map((key) => (
            <View key={key} style={{ marginBottom: SPACING.lg }}>
              <Text style={styles.variantLabel}>
                {key.charAt(0).toUpperCase() + key.slice(1)}:{' '}
                <Text style={{ color: COLORS.gray900 }}>{variant?.attributes?.[key]}</Text>
              </Text>
              <View style={[shared.row, { flexWrap: 'wrap', gap: SPACING.sm }]}>
                {getValuesByKey(key).map((val: any) => {
                  const v = product.variants?.find((vv: any) => vv.attributes?.[key] === val);
                  const selected = variant?.attributes?.[key] === val;
                  return (
                    <TouchableOpacity
                      key={String(val)}
                      onPress={() => v && setSelectedVariant(v)}
                      style={[styles.variantChip, { borderColor: selected ? COLORS.green : COLORS.gray200, backgroundColor: selected ? COLORS.greenPale : COLORS.white }]}
                    >
                      <Text style={[styles.variantChipText, { color: selected ? COLORS.green : COLORS.gray700 }]}>{String(val)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Quantity */}
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={styles.variantLabel}>Quantity</Text>
            <View style={[shared.row, { gap: SPACING.md }]}>
              <View style={styles.qtyRow}>
                <TouchableOpacity onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.qtyBtn}>
                  <Minus size={16} color={COLORS.gray700} />
                </TouchableOpacity>
                <Text style={styles.qtyNum}>{quantity}</Text>
                <TouchableOpacity onPress={() => setQuantity(Math.min(99, quantity + 1))} style={styles.qtyBtn}>
                  <Plus size={16} color={COLORS.gray700} />
                </TouchableOpacity>
              </View>
              <Text style={styles.inStock}>In stock</Text>
            </View>
          </View>

          {/* Trust badges */}
          <View style={[shared.row, { gap: SPACING.sm, marginBottom: SPACING.xl }]}>
            {[
              { Icon: Shield, label: 'Genuine' },
              { Icon: Truck,  label: 'Fast Delivery' },
              { Icon: RotateCcw, label: 'Easy Return' },
            ].map(({ Icon, label }) => (
              <View key={label} style={styles.trustBadge}>
                <Icon size={16} color={COLORS.green} />
                <Text style={styles.trustLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          {product.description && (
            <View style={{ marginBottom: SPACING.xl }}>
              <Text style={styles.descTitle}>Product Details</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom CTA bar ───────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => handleAddToCart(false)}
          disabled={adding}
          activeOpacity={0.85}
        >
          <ShoppingCart size={18} color={COLORS.green} />
          <Text style={styles.addBtnText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buyBtn}
          onPress={() => handleAddToCart(true)}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.buyBtnText}>Buy Now · ৳{(Math.round(price) * quantity).toLocaleString('en-BD')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topActions:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  circleBtn:      { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  gallery:        { backgroundColor: COLORS.white },
  imageDots:      { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: SPACING.sm },
  imgDot:         { height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.green },
  thumbStrip:     { marginVertical: SPACING.sm },
  thumb:          { width: 52, height: 52, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 2 },
  info:           { padding: SPACING.lg, backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, marginTop: -SPACING.md },
  price:          { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  comparePrice:   { fontSize: 16, fontFamily: FONTS.regular, color: COLORS.gray400, textDecorationLine: 'line-through', paddingTop: 4 },
  discountBadge:  { backgroundColor: '#FEF2F2', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  discountText:   { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.red },
  name:           { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900, lineHeight: 26, marginTop: SPACING.xs },
  ratingNum:      { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.gray700 },
  ratingCount:    { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray400 },
  divider:        { height: 0.5, backgroundColor: COLORS.gray200, marginVertical: SPACING.lg },
  variantLabel:   { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.gray500, marginBottom: SPACING.sm },
  variantChip:    { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1.5 },
  variantChipText:{ fontSize: 14, fontFamily: FONTS.semibold },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, overflow: 'hidden' },
  qtyBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray50 },
  qtyNum:         { width: 44, textAlign: 'center', fontSize: 16, fontFamily: FONTS.bold, color: COLORS.gray900 },
  inStock:        { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.green },
  trustBadge:     { flex: 1, alignItems: 'center', gap: 5, paddingVertical: SPACING.md, backgroundColor: COLORS.greenPale, borderRadius: RADIUS.md },
  trustLabel:     { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.green, textAlign: 'center' },
  descTitle:      { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.gray900, marginBottom: SPACING.sm },
  descText:       { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray700, lineHeight: 22 },
  bottomBar:      { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 0.5, borderTopColor: COLORS.gray200 },
  addBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.md },
  addBtnText:     { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.green },
  buyBtn:         { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.md },
  buyBtnText:     { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.white },
});
