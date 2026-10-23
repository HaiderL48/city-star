import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  NotoSansGujarati_400Regular,
  NotoSansGujarati_600SemiBold,
  NotoSansGujarati_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-gujarati';

import { CartProvider } from '@/state/cart';
import { SessionProvider, useSession } from '@/state/session';
import { headerOptions } from '@/theme';
import '@/i18n';

SplashScreen.preventAutoHideAsync();

function SplashHide() {
  const { ready } = useSession();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return null;
}

function Guard() {
  const { ready, settings, user } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !settings) return;
    const top = segments[0];
    // Private shop app: skip login/registration and open the counter directly.
    if (!settings.setupDone) {
      if (top !== 'setup') router.replace('/setup');
      return;
    }
    if (!user) {
      if (top !== 'setup') router.replace('/setup');
      return;
    }
    if (!top || top === 'index' || top === 'login' || top === 'setup') router.replace('/home');
  }, [ready, settings, user, segments, router]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    NotoSansGujarati_400Regular,
    NotoSansGujarati_600SemiBold,
    NotoSansGujarati_700Bold,
  });

  if (!loaded && !error) return null;

  return (
    <SessionProvider>
      <CartProvider>
        <StatusBar style="light" />
        <SplashHide />
        <Guard />
        <Stack screenOptions={headerOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </CartProvider>
    </SessionProvider>
  );
}
