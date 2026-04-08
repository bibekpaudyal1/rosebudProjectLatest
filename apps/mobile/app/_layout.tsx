import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FlashMessage from 'react-native-flash-message';
import { useAuthStore } from '@/store/auth.store';
import '../global.css';

SplashScreen.preventAutoHideAsync();

// Configure notification handler — show alerts even when app is foregrounded
Notifications.setNotificationHandler({
  // @ts-ignore
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           60_000,
      retry:               1,
      refetchOnWindowFocus:false,
    },
  },
});

export default function RootLayout() {
  const { hydrate } = useAuthStore();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Hydrate auth state from SecureStore on cold start
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
            <Stack.Screen name="(auth)"   options={{ headerShown: false }} />
            <Stack.Screen name="product/[slug]" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="checkout"       options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="orders/[id]"    options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="(modals)/address-picker"  options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="(modals)/payment-method"  options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          <FlashMessage position="top" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}