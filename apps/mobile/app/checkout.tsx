// ============================================================
// apps/mobile/app/checkout.tsx
// 3-step checkout: address → payment → confirm
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, MapPin, CreditCard, CheckCircle, ChevronRight, Circle } from 'lucide-react-native';
import { showMessage } from 'react-native-flash-message';
import * as Haptics from 'expo-haptics';
import { useAddresses, useCreateOrder, useShippingRates } from '@/lib/api';
import { mobilePaymentApi } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

type Step = 'address' | 'payment' | 'review';

const PAYMENT_OPTIONS = [
  { id: 'bkash',      label: 'bKash',      emoji: '💚', desc: 'Pay via bKash wallet',      color: '#E8F5E9' },
  { id: 'nagad',      label: 'Nagad',      emoji: '🟠', desc: 'Pay via Nagad wallet',      color: '#FFF3E0' },
  { id: 'sslcommerz', label: 'Card',       emoji: '💳', desc: 'Visa / Mastercard / AMEX',   color: '#E3F2FD' },
  { id: 'cod',        label: 'Cash on Delivery', emoji: '💵', desc: 'Pay when you receive', color: '#F3F4F6' },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, subtotal, clearCart } = useCartStore();
  const createOrder   = useCreateOrder();

  const [step,       setStep]       = useState<Step>('address');
  const [addressId,  setAddressId]  = useState('');
  const [payment,    setPayment]    = useState('cod');
  const [coupon,     setCoupon]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [placing,    setPlacing]    = useState(false);
  const [error,      setError]      = useState('');

  const { data: addresses, isLoading: addrLoading } = useAddresses();
  const selectedAddress = addresses?.find((a: any) => a.id === addressId);

  const { data: ratesData } = useShippingRates(
    { district: selectedAddress?.district ?? 'Dhaka' },
    Boolean(selectedAddress),
  );
  const shippingFee = ratesData?.cheapest?.price ?? 60;
  const total       = subtotal + shippingFee;

  const STEPS: { id: Step; label: string }[] = [
    { id: 'address', label: 'Delivery' },
    { id: 'payment', label: 'Payment' },
    { id: 'review',  label: 'Review' },
  ];
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const placeOrder = async () => {
    if (!addressId) return setError('Select a delivery address');
    if (!payment)   return setError('Select a payment method');
    setPlacing(true); setError('');

    try {
      const order = await createOrder.mutateAsync({
        addressId,
        paymentMethod: payment,
        couponCode:    coupon || undefined,
        notes:         notes  || undefined,
      });

      // Gateway redirect for mobile wallets
      if (['bkash', 'nagad', 'sslcommerz'].includes(payment)) {
        const payResult = await mobilePaymentApi.initiate(order.id, payment);
        if (payResult.redirectUrl) {
          // Open payment gateway in browser
          const canOpen = await Linking.canOpenURL(payResult.redirectUrl);
          if (canOpen) {
            await Linking.openURL(payResult.redirectUrl);
            // Poll for payment completion
          }
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      router.replace(`/orders/${order.id}?success=true`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to place order');
      setPlacing(false);
    }
  };

  return (
    <View style={[shared.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => stepIndex > 0 ? setStep(STEPS[stepIndex - 1].id) : router.back()}>
          <ChevronLeft size={22} color={COLORS.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, {
                backgroundColor: i <= stepIndex ? COLORS.green : COLORS.gray200,
              }]}>
                {i < stepIndex
                  ? <CheckCircle size={16} color={COLORS.white} />
                  : <Text style={[styles.stepNum, { color: i === stepIndex ? COLORS.white : COLORS.gray500 }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, { color: i === stepIndex ? COLORS.green : COLORS.gray400 }]}>{s.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, { backgroundColor: i < stepIndex ? COLORS.green : COLORS.gray200 }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Step 1: Address ──────────────────────── */}
        {step === 'address' && (
          <View>
            <Text style={styles.sectionTitle}>Select Delivery Address</Text>
            {addrLoading ? (
              <ActivityIndicator color={COLORS.green} style={{ marginVertical: SPACING.xl }} />
            ) : addresses?.length === 0 ? (
              <View style={styles.emptyAddr}>
                <MapPin size={32} color={COLORS.gray300} />
                <Text style={styles.emptyText}>No saved addresses</Text>
                <TouchableOpacity style={styles.addAddrBtn} onPress={() => router.push('/(modals)/address-picker')}>
                  <Text style={styles.addAddrText}>+ Add Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: SPACING.sm }}>
                {addresses?.map((addr: any) => (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addrCard, { borderColor: addressId === addr.id ? COLORS.green : COLORS.gray200 }]}
                    onPress={() => setAddressId(addr.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioCircle, { borderColor: addressId === addr.id ? COLORS.green : COLORS.gray300 }]}>
                      {addressId === addr.id && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[shared.row, { gap: SPACING.sm, marginBottom: 4 }]}>
                        <Text style={styles.addrName}>{addr.recipientName}</Text>
                        {addr.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addrPhone}>{addr.phone}</Text>
                      <Text style={styles.addrLine}>{addr.line1}</Text>
                      <Text style={styles.addrLine}>{addr.district}, {addr.division}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: SPACING.xl, opacity: addressId ? 1 : 0.5 }]}
              disabled={!addressId}
              onPress={() => { if (addressId) setStep('payment'); else setError('Select an address'); }}
            >
              <Text style={styles.primaryBtnText}>Continue to Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: Payment ──────────────────────── */}
        {step === 'payment' && (
          <View>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={{ gap: SPACING.sm }}>
              {PAYMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.payOption, { borderColor: payment === opt.id ? COLORS.green : COLORS.gray200 }]}
                  onPress={() => setPayment(opt.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioCircle, { borderColor: payment === opt.id ? COLORS.green : COLORS.gray300 }]}>
                    {payment === opt.id && <View style={styles.radioDot} />}
                  </View>
                  <View style={[styles.payEmoji, { backgroundColor: opt.color }]}>
                    <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payLabel}>{opt.label}</Text>
                    <Text style={styles.payDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: SPACING.xl }]}
              onPress={() => setStep('review')}
            >
              <Text style={styles.primaryBtnText}>Review Order</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3: Review ────────────────────────── */}
        {step === 'review' && (
          <View>
            <Text style={styles.sectionTitle}>Order Summary</Text>

            {/* Items */}
            {items.map((item) => (
              <View key={item.variantId} style={styles.reviewItem}>
                <View style={[styles.reviewImg, { backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 24 }}>🛍️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.reviewMeta}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.reviewPrice}>৳{(item.price * item.quantity).toLocaleString('en-BD')}</Text>
              </View>
            ))}

            {/* Totals */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>৳{subtotal.toLocaleString('en-BD')}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Delivery</Text>
                <Text style={styles.totalValue}>৳{shippingFee}</Text>
              </View>
              <View style={[styles.totalRow, { borderTopWidth: 0.5, borderTopColor: COLORS.gray200, paddingTop: SPACING.md, marginTop: SPACING.sm }]}>
                <Text style={[styles.totalLabel, { fontFamily: FONTS.extrabold, fontSize: 16, color: COLORS.gray900 }]}>Total</Text>
                <Text style={[styles.totalValue, { fontFamily: FONTS.extrabold, fontSize: 18, color: COLORS.green }]}>৳{total.toLocaleString('en-BD')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: SPACING.xl, opacity: placing ? 0.7 : 1 }]}
              onPress={placeOrder}
              disabled={placing}
            >
              {placing
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.primaryBtnText}>Place Order · ৳{total.toLocaleString('en-BD')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  backBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900 },
  stepRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray100 },
  stepItem:        { alignItems: 'center', gap: 5 },
  stepCircle:      { width: 32, height: 32, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  stepNum:         { fontSize: 14, fontFamily: FONTS.bold },
  stepLabel:       { fontSize: 11, fontFamily: FONTS.semibold },
  stepLine:        { flex: 1, height: 2, marginHorizontal: SPACING.sm, marginBottom: 16 },
  content:         { padding: SPACING.lg, paddingBottom: 60 },
  errorBox:        { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  errorText:       { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.red },
  sectionTitle:    { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.gray900, marginBottom: SPACING.lg },
  addrCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1.5, ...SHADOW.sm },
  radioCircle:     { width: 20, height: 20, borderRadius: RADIUS.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioDot:        { width: 10, height: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.green },
  addrName:        { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.gray900 },
  addrPhone:       { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray500, marginBottom: 2 },
  addrLine:        { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray700 },
  defaultBadge:    { backgroundColor: COLORS.greenPale, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText:{ fontSize: 10, fontFamily: FONTS.bold, color: COLORS.green },
  emptyAddr:       { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  emptyText:       { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.gray500 },
  addAddrBtn:      { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  addAddrText:     { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.white },
  payOption:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1.5, ...SHADOW.sm },
  payEmoji:        { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  payLabel:        { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.gray900 },
  payDesc:         { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 2 },
  reviewItem:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray100 },
  reviewImg:       { width: 52, height: 52, borderRadius: RADIUS.md, overflow: 'hidden' },
  reviewName:      { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.gray900 },
  reviewMeta:      { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 3 },
  reviewPrice:     { fontSize: 14, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  totalsCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, ...SHADOW.sm },
  totalRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  totalLabel:      { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.gray600 },
  totalValue:      { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.gray900 },
  primaryBtn:      { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  primaryBtnText:  { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
});