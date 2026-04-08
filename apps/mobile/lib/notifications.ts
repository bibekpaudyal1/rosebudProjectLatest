// ============================================================
// apps/mobile/lib/notifications.ts
// Firebase Cloud Messaging push notification setup
// ============================================================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Skipped — not a physical device');
    return null;
  }

  // Check / request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied');
    return null;
  }

  // Android: requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name:       'Order Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound:      'notification',
    });
    await Notifications.setNotificationChannelAsync('promotions', {
      name:       'Promotions',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Get Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  // Register token with BazarBD backend
  try {
    await api.post('/notifications/register-device', {
      token:    token.data,
      platform: Platform.OS,
    });
    console.log(`[Push] Token registered: ${token.data.slice(0, 20)}...`);
  } catch (e) {
    console.warn('[Push] Token registration failed:', e);
  }

  return token.data;
}

export function setupNotificationListeners() {
  // Handle notification received while app is foregrounded
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as any;
    console.log('[Push] Received:', data.type, data);
  });

  // Handle notification tap (app in background or closed)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;

    // Deep link based on notification type
    switch (data.type) {
      case 'order_update':
        if (data.orderId) {
          const { router: expoRouter } = require('expo-router');
          expoRouter.push(`/orders/${data.orderId}`);
        }
        break;
      case 'flash_sale':
        const { router: expoRouter2 } = require('expo-router');
        expoRouter2.push('/(tabs)/search?flashSale=true');
        break;
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ── Hook to call on app mount ─────────────────────────────
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function usePushNotifications() {
  const { userId } = useAuthStore();

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications();
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, [userId]);
}
