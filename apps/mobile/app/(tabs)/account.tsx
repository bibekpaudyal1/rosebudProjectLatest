// ============================================================
// apps/mobile/app/(tabs)/account.tsx
// User account screen with profile, settings, logout
// ============================================================
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  User, Package, MapPin, Bell, HelpCircle,
  Star, Shield, LogOut, ChevronRight, ExternalLink
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: Package, label: 'My Orders', route: '/(tabs)/orders' },
      { icon: MapPin,   label: 'Saved Addresses', route: '/(modals)/address-picker' },
      { icon: Star,     label: 'My Reviews', route: '/account/reviews' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { icon: Bell,       label: 'Notifications', route: '/account/notifications' },
      { icon: Shield,     label: 'Privacy & Security', route: '/account/security' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle,  label: 'Help Center',    route: '/support' },
      { icon: ExternalLink,label: 'bazarbd.com',    route: 'https://bazarbd.com', external: true },
    ],
  },
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { userId, role, logout } = useAuthStore();
  const isLoggedIn = Boolean(userId);

  return (
    <ScrollView style={[shared.screen, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      {isLoggedIn ? (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={28} color={COLORS.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>My Account</Text>
            <Text style={styles.profileRole}>{role ?? 'Customer'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/account/profile')}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>Sign in to your account</Text>
          <Text style={styles.guestSub}>Track orders, save addresses, and more</Text>
          <View style={[shared.row, { gap: SPACING.md, marginTop: SPACING.lg }]}>
            <TouchableOpacity style={[styles.authBtn, styles.authBtnPrimary]} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.authBtnPrimaryText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authBtn, styles.authBtnSecondary]} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.authBtnSecondaryText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {MENU_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, i > 0 && styles.menuItemBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconWrap}>
                  <item.icon size={18} color={COLORS.green} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <ChevronRight size={16} color={COLORS.gray300} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {isLoggedIn && (
        <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
          <LogOut size={18} color={COLORS.red} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header:              { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 0.5, borderBottomColor: COLORS.gray200 },
  headerTitle:         { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  profileCard:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, margin: SPACING.lg, padding: SPACING.lg, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, ...SHADOW.sm },
  avatar:              { width: 54, height: 54, borderRadius: RADIUS.full, backgroundColor: COLORS.greenPale, alignItems: 'center', justifyContent: 'center' },
  profileName:         { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.gray900 },
  profileRole:         { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 2, textTransform: 'capitalize' },
  editText:            { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.green },
  guestCard:           { margin: SPACING.lg, padding: SPACING.xl, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, ...SHADOW.sm },
  guestTitle:          { fontSize: 18, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  guestSub:            { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 4 },
  authBtn:             { flex: 1, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  authBtnPrimary:      { backgroundColor: COLORS.green },
  authBtnPrimaryText:  { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.white },
  authBtnSecondary:    { borderWidth: 1.5, borderColor: COLORS.green },
  authBtnSecondaryText:{ fontSize: 14, fontFamily: FONTS.bold, color: COLORS.green },
  section:             { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle:        { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm },
  menuCard:            { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOW.sm },
  menuItem:            { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md + 2 },
  menuItemBorder:      { borderTopWidth: 0.5, borderTopColor: COLORS.gray100 },
  menuIconWrap:        { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.greenPale, alignItems: 'center', justifyContent: 'center' },
  menuLabel:           { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.gray900 },
  logoutBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, margin: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA' },
  logoutText:          { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.red },
});
