// ============================================================
// apps/mobile/app/(modals)/payment-method.tsx
// Modal for selecting a payment method
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, CheckCircle2 } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '@/theme';

const PAYMENT_OPTIONS = [
  {
    id:    'bkash',
    label: 'bKash',
    emoji: '💚',
    desc:  'Pay with your bKash mobile wallet',
    bg:    '#E8F5E9',
  },
  {
    id:    'nagad',
    label: 'Nagad',
    emoji: '🟠',
    desc:  'Pay with your Nagad mobile wallet',
    bg:    '#FFF3E0',
  },
  {
    id:    'rocket',
    label: 'Rocket',
    emoji: '🚀',
    desc:  'Pay with DBBL Rocket wallet',
    bg:    '#EDE7F6',
  },
  {
    id:    'sslcommerz',
    label: 'Card',
    emoji: '💳',
    desc:  'Visa, Mastercard, AMEX accepted',
    bg:    '#E3F2FD',
  },
  {
    id:    'cod',
    label: 'Cash on Delivery',
    emoji: '💵',
    desc:  'Pay in cash when your order arrives',
    bg:    '#F3F4F6',
  },
];

export default function PaymentMethodModal() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selected?: string }>();
  const [selected, setSelected] = useState(params.selected ?? 'cod');

  const handleConfirm = () => {
    // Pass selection back via router params then go back
    router.back();
    // Caller should read from a shared store or navigation state;
    // here we navigate back with params supported by expo-router
    router.setParams({ paymentMethod: selected });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Payment Method</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={COLORS.gray700} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Choose how you want to pay</Text>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {PAYMENT_OPTIONS.map((opt) => {
          const active = selected === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.option, { borderColor: active ? COLORS.green : COLORS.gray200 }]}
              onPress={() => setSelected(opt.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.emojiBox, { backgroundColor: opt.bg }]}>
                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.optLabel}>{opt.label}</Text>
                <Text style={styles.optDesc}>{opt.desc}</Text>
              </View>

              {active
                ? <CheckCircle2 size={22} color={COLORS.green} />
                : <View style={styles.radioEmpty} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Confirm button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmText}>
            Confirm — {PAYMENT_OPTIONS.find((o) => o.id === selected)?.label}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.white },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  title:       { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900 },
  closeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray100, borderRadius: RADIUS.full },
  subtitle:    { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray500, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  list:        { paddingHorizontal: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.lg },
  option:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, borderWidth: 1.5, ...SHADOW.sm },
  emojiBox:    { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  optLabel:    { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.gray900 },
  optDesc:     { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 2 },
  radioEmpty:  { width: 22, height: 22, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.gray300 },
  footer:      { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.gray200 },
  confirmBtn:  { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  confirmText: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
});
