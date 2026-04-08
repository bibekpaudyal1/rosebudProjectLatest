// ============================================================
// apps/mobile/app/(tabs)/orders.tsx
// Orders list with status filters and pull-to-refresh
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, ChevronRight } from 'lucide-react-native';
import { useMyOrders } from '@/lib/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'confirmed',       label: 'Active' },
  { value: 'shipped',         label: 'Shipped' },
  { value: 'delivered',       label: 'Delivered' },
  { value: 'cancelled',       label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:          { bg: '#FEF3C7', text: '#92400E' },
  payment_pending:  { bg: '#FEF3C7', text: '#92400E' },
  confirmed:        { bg: '#DBEAFE', text: '#1E40AF' },
  processing:       { bg: '#EDE9FE', text: '#5B21B6' },
  packed:           { bg: '#E0E7FF', text: '#3730A3' },
  shipped:          { bg: '#CFFAFE', text: '#155E75' },
  out_for_delivery: { bg: '#FFEDD5', text: '#9A3412' },
  delivered:        { bg: '#D1FAE5', text: '#065F46' },
  cancelled:        { bg: '#FEE2E2', text: '#991B1B' },
  refunded:         { bg: '#F3F4F6', text: '#374151' },
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useMyOrders(page);
  const orders = data?.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderEmpty = () => (
    <View style={[shared.center, { paddingTop: 80, gap: SPACING.lg }]}>
      <Package size={64} color={COLORS.gray300} />
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptyText}>Start shopping to see your orders here</Text>
      <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
        <Text style={styles.shopBtnText}>Browse Products</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item: order }: { item: any }) => {
    const statusStyle = STATUS_COLOR[order.status] ?? { bg: COLORS.gray100, text: COLORS.gray600 };
    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/orders/${order.id}`)}
        activeOpacity={0.8}
      >
        <View style={[shared.row, { justifyContent: 'space-between', marginBottom: SPACING.sm }]}>
          <Text style={styles.orderNum}>{order.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {order.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.orderDate}>
          {new Date(order.createdAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>

        <View style={[styles.divider, { marginVertical: SPACING.sm }]} />

        <View style={[shared.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.itemCount}>{order.items?.length ?? 0} item(s)</Text>
          <View style={shared.row}>
            <Text style={styles.total}>৳{Number(order.total).toLocaleString('en-BD')}</Text>
            <ChevronRight size={16} color={COLORS.gray400} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {isLoading ? (
        <View style={[shared.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 }}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.green} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:       { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  headerTitle:  { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  orderCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, borderWidth: 0.5, borderColor: COLORS.gray200 },
  orderNum:     { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  statusBadge:  { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText:   { fontSize: 11, fontFamily: FONTS.bold, textTransform: 'capitalize' },
  orderDate:    { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500 },
  divider:      { height: 0.5, backgroundColor: COLORS.gray200 },
  itemCount:    { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray600 },
  total:        { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  emptyTitle:   { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.gray900 },
  emptyText:    { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500, textAlign: 'center', paddingHorizontal: SPACING.xxxl },
  shopBtn:      { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.xxxl, paddingVertical: SPACING.md },
  shopBtnText:  { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
});