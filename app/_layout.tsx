import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import '@/services/firebase';
import { OfflineBanner } from '@/components/ui';
import { HeaderBrand } from '@/components/HeaderBrand';
import { LaunchSplash } from '@/components/LaunchSplash';
import { ReactionBurst } from '@/components/ReactionBurst';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useNetwork } from '@/hooks/useNetwork';
import { usePresence } from '@/hooks/usePresence';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeInboxSync } from '@/hooks/useRealtimeInboxSync';
import { Colors } from '@/theme/colors';

/** Keep the cute launch animation on screen long enough to enjoy. */
const MIN_LAUNCH_MS = 2400;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash already hidden (web).
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [minTimeDone, setMinTimeDone] = useState(false);

  useNetwork();
  usePresence();
  useReducedMotion();
  usePushNotifications();
  useRealtimeInboxSync();

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_LAUNCH_MS);
    return () => clearTimeout(timer);
  }, []);

  const showLaunch = isLoading || !minTimeDone;

  useEffect(() => {
    if (!showLaunch) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [showLaunch]);

  useEffect(() => {
    if (showLaunch) {
      return;
    }

    try {
      const parts = segments as string[];
      const inAuthGroup = parts[0] === '(auth)';
      const onProfileSetup = inAuthGroup && parts[1] === 'profile-setup';

      if (!isAuthenticated) {
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
        return;
      }

      const needsProfile =
        !profile || !profile.username || !profile.displayName;

      if (needsProfile) {
        if (!onProfileSetup) {
          router.replace('/(auth)/profile-setup');
        }
        return;
      }

      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.warn('[AuthGate] navigation failed', err);
    }
  }, [isAuthenticated, showLaunch, profile, router, segments]);

  if (showLaunch) {
    return <LaunchSplash />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary label="root">
            <StatusBar style="dark" />
            <OfflineBanner />
            <AuthGate>
              <ErrorBoundary label="navigation">
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="settings"
                    options={{
                      headerShown: true,
                      headerTintColor: Colors.rose,
                      headerStyle: { backgroundColor: Colors.cream },
                      headerTitle: () => <HeaderBrand title="Settings" />,
                      presentation: 'card',
                    }}
                  />
                  <Stack.Screen
                    name="find-users"
                    options={{
                      headerShown: true,
                      headerTintColor: Colors.rose,
                      headerStyle: { backgroundColor: Colors.cream },
                      headerTitle: () => <HeaderBrand title="Find someone" />,
                    }}
                  />
                  <Stack.Screen name="connection/[id]" />
                  <Stack.Screen
                    name="chat/[id]"
                    options={{
                      headerShown: true,
                      headerTintColor: Colors.rose,
                      headerStyle: { backgroundColor: Colors.cream },
                      headerTitle: () => <HeaderBrand title="Chat" />,
                    }}
                  />
                  <Stack.Screen
                    name="quick-send"
                    options={{
                      presentation: 'transparentModal',
                      animation: 'fade',
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen name="admin" />
                </Stack>
              </ErrorBoundary>
            </AuthGate>
            <ReactionBurst />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
