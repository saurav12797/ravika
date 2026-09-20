import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Colors } from '@/theme/colors';
import { LoadingState } from '@/components/ui';
import { HeaderBrand } from '@/components/HeaderBrand';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <LoadingState label="Checking admin access…" />;
  }

  if (!profile?.isAdmin) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.rose,
        headerStyle: { backgroundColor: Colors.cream },
        contentStyle: { backgroundColor: Colors.background },
        headerTitle: ({ children }) => (
          <HeaderBrand
            title={typeof children === 'string' ? children : 'Admin'}
          />
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="rate-limits" options={{ title: 'Rate limits' }} />
      <Stack.Screen name="reactions" options={{ title: 'Reactions' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
    </Stack>
  );
}
