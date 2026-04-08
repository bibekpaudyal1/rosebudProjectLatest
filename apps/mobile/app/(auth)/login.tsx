// ============================================================
// apps/mobile/app/(auth)/login.tsx
// Phone + OTP login with 60s countdown resend
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { showMessage } from 'react-native-flash-message';
import * as Haptics from 'expo-haptics';
import { mobileAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

export default function LoginScreen() {
  const insets   = useSafeAreaInsets();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [phone,       setPhone]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const handleLogin = async () => {
    if (!phone.trim()) return setError('Enter your phone number');
    if (!password)     return setError('Enter your password');
    setLoading(true); setError('');

    try {
      const result = await mobileAuthApi.login({ phone: phone.trim(), password });
      await setTokens({
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
        userId:       result.userId,
        role:         result.role,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={shared.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={shared.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.xxxl, paddingBottom: insets.bottom + SPACING.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={[shared.center, { marginBottom: SPACING.xxxl }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.brand}>BazarBD</Text>
          <Text style={styles.tagline}>Bangladesh's Online Marketplace</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Phone input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone number</Text>
          <View style={styles.inputWrap}>
            <Phone size={16} color={COLORS.gray400} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+8801XXXXXXXXX"
              placeholderTextColor={COLORS.gray400}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Lock size={16} color={COLORS.gray400} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry={!showPass}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff size={16} color={COLORS.gray400} /> : <Eye size={16} color={COLORS.gray400} />}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: SPACING.xl }}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <ArrowRight size={18} color={COLORS.white} />
              </>}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Register link */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.secondaryBtnText}>Create new account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ alignSelf: 'center', marginTop: SPACING.xl }}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.skipText}>Browse without account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content:        { paddingHorizontal: SPACING.xl },
  logoCircle:     { width: 64, height: 64, borderRadius: RADIUS.xl, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOW.md },
  logoText:       { fontSize: 32, fontFamily: FONTS.extrabold, color: COLORS.white },
  brand:          { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.green },
  tagline:        { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray500, marginTop: 4 },
  title:          { fontSize: 26, fontFamily: FONTS.extrabold, color: COLORS.gray900, marginBottom: SPACING.xs },
  subtitle:       { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray500, marginBottom: SPACING.xl },
  errorBox:       { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  errorText:      { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.red },
  inputGroup:     { marginBottom: SPACING.lg },
  label:          { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.gray700, marginBottom: SPACING.sm },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, height: 52, backgroundColor: COLORS.white },
  input:          { flex: 1, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray900 },
  forgotText:     { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.green },
  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.green, borderRadius: RADIUS.lg, height: 54, ...SHADOW.md },
  primaryBtnText: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
  divider:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginVertical: SPACING.xl },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: COLORS.gray200 },
  dividerText:    { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray400 },
  secondaryBtn:   { borderWidth: 1.5, borderColor: COLORS.green, borderRadius: RADIUS.lg, height: 54, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.green },
  skipText:       { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.gray400, textDecorationLine: 'underline' },
});