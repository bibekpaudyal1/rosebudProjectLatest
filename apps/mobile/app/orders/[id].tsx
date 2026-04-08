// ============================================================
// apps/mobile/app/orders/[id].tsx
// Order tracking — status timeline, items, shipment updates
// Real-time polling every 30s for active orders
// ============================================================
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CheckCircle2, Clock, Circle, Package, MapPin, Phone, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { showMessage } from 'react-native-flash-message';
import { useOrder } from '@/lib/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const TIMELINE = [
  { status: 'confirmed',        label: 'Order Confirmed',    emoji: '✅', desc: 'Your order has been confirmed' },
  { status: 'processing',       label: 'Processing',         emoji: '⚙️',  desc: 'Seller is preparing your order' },
  { status: 'packed',           label: 'Packed',             emoji: '📦', desc: 'Packed and ready to ship' },
  { status: 'shipped',          label: 'Shipped',            emoji: '🚚', desc: 'Order handed to courier' },
  { status: 'out_for_delivery', label: 'Out for Delivery',   emoji: '🛵', desc: 'On the way to your address!' },
  { status: 'delivered',        label: 'Delivered',          emoji: '🎉', desc: 'Order delivered' },
];

const STATUS_ORDER = TIMELINE.map((s) => s.status);

const STATUS_COLOR: Record<string, string> = {
  pending:          '#F59E0B',
  payment_pending:  '#F59E0B',
  payment_failed:   COLORS.red,
  confirmed:        '#3B82F6',
  processing:       '#8B5CF6',
  packed:           '#6366F1',
  shipped:          '#06B6D4',
  out_for_delivery: '#F97316',
  delivered:        COLORS.green,
  cancelled:        COLORS.red,
  refunded:         '#9CA3AF',
};

export default function OrderTrackingScreen() {
  const { id, success } = useLocalSearchParams<{ id: string; success?: string }>();
  const insets          = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);

  useEffect(() => {
    if (success === 'true') {
      showMessage({ message: 'Order placed successfully! 🎉', type: 'success', duration: 3000 });
    }
  }, [success]);

  if (isLoading) {
    return (
      <View style={[shared.screen, shared.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[shared.screen, shared.center, { paddingTop: insets.top }]}>
        <Text style={{ fontFamily: FONTS.medium, color: COLORS.gray500 }}>Order not found</Text>
      </View>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled  = order.status === 'cancelled' || order.status === 'refunded';
  const statusColor  = STATUS_COLOR[order.status] ?? COLORS.gray500;

  const copyOrderNumber = async () => {
    await Clipboard.setStringAsync(order.orderNumber);
    showMessage({ message: 'Order number copied', type: 'default', duration: 1500 });
  };

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={COLORS.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Order header card ─────────────────────── */}
        <View style={styles.orderCard}>
          <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.md }]}>
            <View>
              <Text style={styles.orderLabel}>Order Number</Text>
              <TouchableOpacity style={[shared.row, { gap: 6 }]} onPress={copyOrderNumber}>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <Copy size={14} color={COLORS.green} />
              </TouchableOpacity>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {order.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
          <View style={[shared.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.orderMeta}>
              {new Date(order.createdAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.orderTotal}>৳{Number(order.total).toLocaleString('en-BD')}</Text>
          </View>
        </View>

        {/* ── Tracking timeline ─────────────────────── */}
        {!isCancelled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tracking</Text>
            <View style={styles.timeline}>
              {TIMELINE.map((step, i) => {
                const isDone    = i < currentIndex;
                const isCurrent = i === currentIndex;
                const isPending = i > currentIndex;
                const isLast    = i === TIMELINE.length - 1;

                return (
                  <View key={step.status} style={styles.timelineItem}>
                    {/* Vertical line */}
                    {!isLast && (
                      <View style={[styles.timelineLine, { backgroundColor: isDone ? COLORS.green : COLORS.gray200 }]} />
                    )}

                    {/* Dot */}
                    <View style={[
                      styles.timelineDot,
                      {
                        backgroundColor: isDone ? COLORS.green : isCurrent ? COLORS.orange : COLORS.gray200,
                        borderWidth:     isCurrent ? 3 : 0,
                        borderColor:     isCurrent ? `${COLORS.orange}40` : 'transparent',
                      },
                    ]}>
                      {isDone && <CheckCircle2 size={12} color={COLORS.white} />}
                      {isCurrent && <Clock size={10} color={COLORS.white} />}
                    </View>

                    {/* Content */}
                    <View style={[styles.timelineContent, { opacity: isPending ? 0.35 : 1 }]}>
                      <View style={[shared.row, { gap: SPACING.sm }]}>
                        <Text style={{ fontSize: 16 }}>{step.emoji}</Text>
                        <Text style={[styles.timelineTitle, {
                          color: isCurrent ? COLORS.orange : isDone ? COLORS.gray900 : COLORS.gray400,
                        }]}>
                          {step.label}
                        </Text>
                      </View>
                      <Text style={styles.timelineDesc}>{step.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Cancelled / Refunded ──────────────────── */}
        {isCancelled && (
          <View style={[styles.section, styles.cancelledCard]}>
            <Text style={{ fontSize: 32 }}>{order.status === 'refunded' ? '💰' : '❌'}</Text>
            <Text style={[styles.sectionTitle, { color: COLORS.red }]}>
              Order {order.status === 'refunded' ? 'Refunded' : 'Cancelled'}
            </Text>
            <Text style={styles.cancelledDesc}>
              {order.status === 'refunded'
                ? 'Your refund has been processed and will reflect in 3–5 business days.'
                : 'This order was cancelled. If you paid, a refund will be initiated shortly.'}
            </Text>
          </View>
        )}

        {/* ── Delivery address ──────────────────────── */}
        {order.shippingAddress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressCard}>
              <MapPin size={16} color={COLORS.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addrName}>{(order.shippingAddress as any).recipientName}</Text>
                <Text style={styles.addrLine}>{(order.shippingAddress as any).line1}</Text>
                <Text style={styles.addrLine}>{(order.shippingAddress as any).district}, {(order.shippingAddress as any).division}</Text>
              </View>
              <TouchableOpacity style={shared.row}>
                <Phone size={14} color={COLORS.green} />
                <Text style={{ marginLeft: 4, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.green }}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Order items ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered</Text>
          {order.items?.map((item: any) => (
            <View key={item.id} style={styles.orderItem}>
              <View style={[styles.itemImg, { backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 26 }}>📦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.productSnapshot?.name}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>৳{Number(item.totalPrice).toLocaleString('en-BD')}</Text>
            </View>
          ))}
        </View>

        {/* ── Payment summary ────────────────────────── */}
        <View style={[styles.section, styles.summaryCard]}>
          <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.sm }]}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>৳{Number(order.subtotal).toLocaleString('en-BD')}</Text>
          </View>
          <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.sm }]}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.summaryValue}>৳{Number(order.shippingFee).toLocaleString('en-BD')}</Text>
          </View>
          {Number(order.discount) > 0 && (
            <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.sm }]}>
              <Text style={[styles.summaryLabel, { color: COLORS.green }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>-৳{Number(order.discount).toLocaleString('en-BD')}</Text>
            </View>
          )}
          <View style={[shared.row, { justifyContent: 'space-between', paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.gray200 }]}>
            <Text style={[styles.summaryLabel, { fontFamily: FONTS.extrabold, fontSize: 16, color: COLORS.gray900 }]}>Total</Text>
            <Text style={[styles.summaryValue, { fontFamily: FONTS.extrabold, fontSize: 18, color: COLORS.green }]}>৳{Number(order.total).toLocaleString('en-BD')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  headerTitle:     { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900 },
  orderCard:       { margin: SPACING.lg, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, ...SHADOW.sm },
  orderLabel:      { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.gray400, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  orderNumber:     { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  statusBadge:     { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full },
  statusText:      { fontSize: 12, fontFamily: FONTS.bold, textTransform: 'capitalize' },
  orderMeta:       { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500 },
  orderTotal:      { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  section:         { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle:    { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900, marginBottom: SPACING.md },
  timeline:        { paddingLeft: SPACING.sm },
  timelineItem:    { flexDirection: 'row', gap: SPACING.md, paddingBottom: SPACING.xl, position: 'relative' },
  timelineLine:    { position: 'absolute', left: 14, top: 26, bottom: 0, width: 2 },
  timelineDot:     { width: 28, height: 28, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineContent: { flex: 1, paddingTop: 3 },
  timelineTitle:   { fontSize: 14, fontFamily: FONTS.bold },
  timelineDesc:    { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 3 },
  cancelledCard:   { backgroundColor: '#FFF5F5', borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm },
  cancelledDesc:   { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray600, textAlign: 'center' },
  addressCard:     { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  addrName:        { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.gray900 },
  addrLine:        { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray600, marginTop: 2 },
  orderItem:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray100 },
  itemImg:         { width: 52, height: 52, borderRadius: RADIUS.md, overflow: 'hidden' },
  itemName:        { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.gray900 },
  itemMeta:        { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 2 },
  itemPrice:       { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  summaryCard:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  summaryLabel:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.gray600 },
  summaryValue:    { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.gray900 },
});