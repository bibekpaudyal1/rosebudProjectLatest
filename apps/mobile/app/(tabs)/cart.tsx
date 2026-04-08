// ============================================================
// apps/mobile/app/(tabs)/cart.tsx
// Cart screen with swipe-to-delete, live totals
// ============================================================
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, Image as RNImage
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingBag, Trash2, Plus, Minus, ChevronRight } from 'lucide-react-native';
import { useCartStore } from '@/store/cart.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, subtotal, itemCount, removeItem, updateQty } = useCartStore();

  if (items.length === 0) {
    return (
      <View style={[shared.screen, shared.center, { paddingTop: insets.top }]}>
        <ShoppingBag size={64} color={COLORS.gray300} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Browse products and add them to cart</Text>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => router.push('/(tabs)/search')}
        >
          <Text style={styles.browseBtnText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: { item: typeof items[number] }) => (
    <View style={styles.cartItem}>
      {/* Image */}
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.cartImg} contentFit="cover" />
      ) : (
        <View style={[styles.cartImg, { backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 28 }}>🛍️</Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        {item.attributes && Object.keys(item.attributes).length > 0 && (
          <Text style={styles.itemVariant} numberOfLines={1}>
            {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </Text>
        )}
        <Text style={styles.itemPrice}>৳{(item.price * item.quantity).toLocaleString('en-BD')}</Text>

        {/* Quantity controls */}
        <View style={[shared.row, { gap: SPACING.sm, marginTop: SPACING.sm }]}>
          <View style={styles.qtyControl}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                if (item.quantity <= 1) removeItem(item.variantId);
                else updateQty(item.variantId, item.quantity - 1);
              }}
            >
              {item.quantity <= 1
                ? <Trash2 size={13} color={COLORS.red} />
                : <Minus size={13} color={COLORS.gray700} />}
            </TouchableOpacity>
            <Text style={styles.qtyNum}>{item.quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.variantId, item.quantity + 1)}>
              <Plus size={13} color={COLORS.gray700} />
            </TouchableOpacity>
          </View>
          <Text style={styles.unitPrice}>৳{item.price.toLocaleString('en-BD')} each</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        <Text style={styles.headerCount}>{itemCount} items</Text>
      </View>

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.variantId}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 160 }}
        ItemSeparatorComponent={() => <View style={{ height: 0.5, backgroundColor: COLORS.gray200, marginLeft: SPACING.lg }} />}
      />

      {/* Bottom summary */}
      <View style={[styles.summary, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.md }]}>
          <Text style={styles.subtotalLabel}>Subtotal ({itemCount} items)</Text>
          <Text style={styles.subtotalValue}>৳{subtotal.toLocaleString('en-BD')}</Text>
        </View>
        <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.lg }]}>
          <Text style={[styles.subtotalLabel, { color: COLORS.gray400 }]}>Delivery fee</Text>
          <Text style={[styles.subtotalLabel, { color: COLORS.gray400 }]}>Calculated at checkout</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/checkout')}
          activeOpacity={0.9}
        >
          <Text style={styles.checkoutBtnText}>Checkout · ৳{subtotal.toLocaleString('en-BD')}</Text>
          <ChevronRight size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyTitle:      { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.gray900, marginTop: SPACING.xl },
  emptySub:        { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.xxxl },
  browseBtn:       { marginTop: SPACING.xl, backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.xxxl, paddingVertical: SPACING.md },
  browseBtnText:   { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  headerTitle:     { fontSize: 20, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  headerCount:     { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.gray500 },
  cartItem:        { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.white },
  cartImg:         { width: 80, height: 80, borderRadius: RADIUS.md, overflow: 'hidden' },
  itemName:        { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.gray900, lineHeight: 20 },
  itemVariant:     { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 2 },
  itemPrice:       { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900, marginTop: 4 },
  qtyControl:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, overflow: 'hidden' },
  qtyBtn:          { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray50 },
  qtyNum:          { width: 32, textAlign: 'center', fontSize: 14, fontFamily: FONTS.bold, color: COLORS.gray900 },
  unitPrice:       { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray400 },
  summary:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 0.5, borderTopColor: COLORS.gray200, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, ...SHADOW.lg },
  subtotalLabel:   { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.gray700 },
  subtotalValue:   { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  checkoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.md + 2 },
  checkoutBtnText: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
});
