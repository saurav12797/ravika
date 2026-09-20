import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/ui';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <LoadingState label="Loading…" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile?.username || !profile?.displayName) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
