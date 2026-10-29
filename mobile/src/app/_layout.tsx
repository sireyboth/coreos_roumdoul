// Root of the app. Signed-out people only reach sign-in; signed-in people only reach (app)/.
import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import { NAV_THEME } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { me, isLoading } = useSession();

  // Keep the splash screen up until we know whether someone is signed in.
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!me}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Follow the phone's light/dark setting: tell NativeWind, so `dark:` classes and the
  // .dark:root colors in global.css switch with it (it doesn't follow the system on its own).
  const system = useSystemColorScheme();
  const { colorScheme, setColorScheme } = useColorScheme();
  useEffect(() => {
    setColorScheme(system === 'dark' ? 'dark' : 'light');
  }, [system, setColorScheme]);
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SessionProvider>
        <RootStack />
      </SessionProvider>
      {/* Dialogs, dropdowns and popovers render here, above every screen. */}
      <PortalHost />
    </ThemeProvider>
  );
}
