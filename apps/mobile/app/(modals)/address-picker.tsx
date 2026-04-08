// ============================================================
// apps/mobile/app/(modals)/address-picker.tsx
// Modal for adding a new delivery address
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, MapPin } from 'lucide-react-native';
import { showMessage } from 'react-native-flash-message';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mobileUserApi } from '@/lib/api';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '@/theme';

const DIVISIONS = [
  'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna',
  'Sylhet', 'Barisal', 'Rangpur', 'Mymensingh',
];

export default function AddressPickerModal() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    recipientName: '',
    phone:         '',
    line1:         '',
    line2:         '',
    district:      '',
    division:      'Dhaka',
    postalCode:    '',
    label:         'Home',
    isDefault:     false,
  });

  const patch = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const createAddr = useMutation({
    mutationFn: () => mobileUserApi.createAddress(form as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] });
      showMessage({ message: 'Address saved', type: 'success' });
      router.back();
    },
    onError: (e: any) => {
      showMessage({ message: e.message ?? 'Failed to save address', type: 'danger' });
    },
  });

  const canSubmit =
    form.recipientName.trim() &&
    form.phone.trim() &&
    form.line1.trim() &&
    form.district.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Delivery Address</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X size={22} color={COLORS.gray700} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconRow}>
            <MapPin size={32} color={COLORS.green} />
          </View>

          {/* Recipient */}
          <Field label="Recipient Name *">
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={COLORS.gray400}
              value={form.recipientName}
              onChangeText={(v) => patch('recipientName', v)}
              returnKeyType="next"
            />
          </Field>

          <Field label="Phone Number *">
            <TextInput
              style={styles.input}
              placeholder="01XXXXXXXXX"
              placeholderTextColor={COLORS.gray400}
              value={form.phone}
              onChangeText={(v) => patch('phone', v)}
              keyboardType="phone-pad"
            />
          </Field>

          {/* Address lines */}
          <Field label="Address Line 1 *">
            <TextInput
              style={styles.input}
              placeholder="House/Flat no., Road, Area"
              placeholderTextColor={COLORS.gray400}
              value={form.line1}
              onChangeText={(v) => patch('line1', v)}
            />
          </Field>

          <Field label="Address Line 2">
            <TextInput
              style={styles.input}
              placeholder="Landmark (optional)"
              placeholderTextColor={COLORS.gray400}
              value={form.line2}
              onChangeText={(v) => patch('line2', v)}
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="District *">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Dhaka"
                  placeholderTextColor={COLORS.gray400}
                  value={form.district}
                  onChangeText={(v) => patch('district', v)}
                />
              </Field>
            </View>
            <View style={{ width: SPACING.md }} />
            <View style={{ flex: 1 }}>
              <Field label="Postal Code">
                <TextInput
                  style={styles.input}
                  placeholder="1212"
                  placeholderTextColor={COLORS.gray400}
                  value={form.postalCode}
                  onChangeText={(v) => patch('postalCode', v)}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>

          {/* Division picker */}
          <Field label="Division">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACING.sm, paddingVertical: SPACING.xs }}
            >
              {DIVISIONS.map((div) => (
                <TouchableOpacity
                  key={div}
                  style={[styles.chip, { backgroundColor: form.division === div ? COLORS.green : COLORS.gray100, borderColor: form.division === div ? COLORS.green : COLORS.gray200 }]}
                  onPress={() => patch('division', div)}
                >
                  <Text style={[styles.chipText, { color: form.division === div ? COLORS.white : COLORS.gray700 }]}>
                    {div}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          {/* Label */}
          <Field label="Label">
            <View style={styles.row}>
              {['Home', 'Work', 'Other'].map((lbl) => (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.labelChip, { backgroundColor: form.label === lbl ? COLORS.greenPale : COLORS.gray100, borderColor: form.label === lbl ? COLORS.green : COLORS.gray200 }]}
                  onPress={() => patch('label', lbl)}
                >
                  <Text style={[styles.labelChipText, { color: form.label === lbl ? COLORS.green : COLORS.gray600 }]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* Set as default */}
          <TouchableOpacity
            style={styles.defaultRow}
            onPress={() => patch('isDefault', !form.isDefault)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, { backgroundColor: form.isDefault ? COLORS.green : COLORS.white, borderColor: form.isDefault ? COLORS.green : COLORS.gray300 }]}>
              {form.isDefault && <Text style={{ color: COLORS.white, fontSize: 12, fontFamily: FONTS.bold }}>✓</Text>}
            </View>
            <Text style={styles.defaultLabel}>Set as default address</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.saveBtn, { opacity: canSubmit ? 1 : 0.5 }]}
            disabled={!canSubmit || createAddr.isPending}
            onPress={() => createAddr.mutate()}
          >
            {createAddr.isPending
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.saveBtnText}>Save Address</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.white },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  title:        { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.gray900 },
  closeBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gray100, borderRadius: RADIUS.full },
  content:      { padding: SPACING.lg, paddingBottom: 32 },
  iconRow:      { alignItems: 'center', marginBottom: SPACING.xl },
  label:        { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.gray700, marginBottom: SPACING.xs },
  input:        { height: 48, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray900, backgroundColor: COLORS.gray50 },
  row:          { flexDirection: 'row', alignItems: 'flex-start' },
  chip:         { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
  chipText:     { fontSize: 13, fontFamily: FONTS.semibold },
  labelChip:    { flex: 1, marginRight: SPACING.sm, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center' },
  labelChipText:{ fontSize: 13, fontFamily: FONTS.semibold },
  defaultRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl, padding: SPACING.md, backgroundColor: COLORS.gray50, borderRadius: RADIUS.md },
  checkbox:     { width: 22, height: 22, borderRadius: RADIUS.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  defaultLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.gray700 },
  saveBtn:      { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  saveBtnText:  { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
  gray600:      COLORS.gray600 as any,
  greenPale:    COLORS.greenPale as any,
});
