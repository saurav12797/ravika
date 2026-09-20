import { Stack } from 'expo-router';
import { HeaderBrand } from '@/components/HeaderBrand';
import { Colors } from '@/theme/colors';

export default function ConnectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.rose,
        headerStyle: { backgroundColor: Colors.cream },
        contentStyle: { backgroundColor: Colors.background },
        headerTitle: ({ children }) => (
          <HeaderBrand
            title={typeof children === 'string' ? children : 'Ravika'}
          />
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Connection' }} />
      <Stack.Screen name="reactions" options={{ title: 'Tell them' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
      <Stack.Screen name="stats" options={{ title: 'Stats' }} />
    </Stack>
  );
}
