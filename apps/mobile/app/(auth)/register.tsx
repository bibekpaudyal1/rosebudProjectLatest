// ============================================================
// apps/mobile/app/(auth)/register.tsx
// Registration with phone OTP verification
// ============================================================
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Phone, User, Lock, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { showMessage } from 'react-native-flash-message';
import { mobileAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW, shared } from '@/theme';

type RegStep = 'details' | 'otp';

export default function RegisterScreen() {
  const insets    = useSafeAreaInsets();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [regStep,    setRegStep]    = useState<RegStep>('details');
  const [phone,      setPhone]      = useState('');
  const [fullName,   setFullName]   = useState('');
  const [password,   setPassword]   = useState('');
  const [otp,        setOtp]        = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [otpResend,  setOtpResend]  = useState(60);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startOtpTimer = () => {
    setOtpResend(60);
    timerRef.current = setInterval(() => {
      setOtpResend((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!phone.trim()) return setError('Enter your phone number');
    if (!fullName.trim()) return setError('Enter your full name');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true); setError('');

    try {
      await mobileAuthApi.sendOtp(phone.trim(), 'register');
      setRegStep('otp');
      startOtpTimer();
      showMessage({ message: `OTP sent to ${phone}`, type: 'success' });
    } catch (e: any) {
      setError(e.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    if (otp.length !== 6) return setError('Enter the 6-digit OTP');
    setLoading(true); setError('');

    try {
      const result = await mobileAuthApi.register({ phone: phone.trim(), fullName: fullName.trim(), password, otp });
      await setTokens({
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
        userId:       result.userId,
        role:         result.role,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showMessage({ message: `Welcome to BazarBD, ${fullName.split(' ')[0]}! 🎉`, type: 'success', duration: 3000 });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Registration failed');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={shared.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => regStep === 'otp' ? setRegStep('details') : router.back()}>
          <ChevronLeft size={22} color={COLORS.gray900} />
        </TouchableOpacity>

        <Text style={styles.title}>{regStep === 'details' ? 'Create Account' : 'Verify Phone'}</Text>
        <Text style={styles.subtitle}>
          {regStep === 'details'
            ? 'Join BazarBD and start shopping'
            : `Enter the 6-digit code sent to\n${phone}`}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {regStep === 'details' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <User size={16} color={COLORS.gray400} />
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Rahim Uddin" placeholderTextColor={COLORS.gray400} autoCapitalize="words" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrap}>
                <Phone size={16} color={COLORS.gray400} />
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+8801XXXXXXXXX" placeholderTextColor={COLORS.gray400} keyboardType="phone-pad" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Lock size={16} color={COLORS.gray400} />
                <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Minimum 8 characters" placeholderTextColor={COLORS.gray400} secureTextEntry={!showPass} />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={16} color={COLORS.gray400} /> : <Eye size={16} color={COLORS.gray400} />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]} onPress={sendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        )}

        {regStep === 'otp' && (
          <>
            {/* OTP input boxes */}
            <View style={styles.otpRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[styles.otpBox, { borderColor: otp.length === i ? COLORS.green : otp.length > i ? COLORS.greenLight : COLORS.gray200 }]}>
                  <Text style={styles.otpChar}>{otp[i] ?? ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={{ position: 'absolute', opacity: 0, height: 0 }}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            {/* Resend */}
            <View style={[shared.center, { marginVertical: SPACING.xl }]}>
              {otpResend > 0
                ? <Text style={styles.resendWait}>Resend OTP in {otpResend}s</Text>
                : <TouchableOpacity onPress={() => { sendOtp(); }}>
                    <Text style={styles.resendBtn}>Resend OTP</Text>
                  </TouchableOpacity>}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { opacity: loading || otp.length < 6 ? 0.7 : 1 }]} onPress={register} disabled={loading || otp.length < 6}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>
          </>
        )}

        <View style={[shared.row, { justifyContent: 'center', marginTop: SPACING.xl, gap: 6 }]}>
          <Text style={styles.loginHint}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={[styles.loginHint, { color: COLORS.green, fontFamily: FONTS.bold }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content:        { paddingHorizontal: SPACING.xl },
  backBtn:        { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: SPACING.lg },
  title:          { fontSize: 28, fontFamily: FONTS.extrabold, color: COLORS.gray900, marginBottom: SPACING.xs },
  subtitle:       { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray500, marginBottom: SPACING.xl, lineHeight: 22 },
  errorBox:       { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  errorText:      { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.red },
  inputGroup:     { marginBottom: SPACING.lg },
  label:          { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.gray700, marginBottom: SPACING.sm },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, height: 52, backgroundColor: COLORS.white },
  input:          { flex: 1, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.gray900 },
  primaryBtn:     { backgroundColor: COLORS.green, borderRadius: RADIUS.lg, height: 54, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  primaryBtnText: { fontSize: 16, fontFamily: FONTS.extrabold, color: COLORS.white },
  otpRow:         { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginTop: SPACING.xl },
  otpBox:         { width: 48, height: 56, borderRadius: RADIUS.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  otpChar:        { fontSize: 22, fontFamily: FONTS.extrabold, color: COLORS.gray900 },
  resendWait:     { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500 },
  resendBtn:      { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.green },
  loginHint:      { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.gray500 },
});
