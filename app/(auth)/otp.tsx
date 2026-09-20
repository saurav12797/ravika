import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, TextField } from '@/components/ui';
import * as authService from '@/services/authService';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import { toUserMessage, AppError } from '@/utils/errors';
import { formatPhoneDisplay } from '@/utils/phone';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    verificationId?: string;
    phone?: string;
  }>();
  const hydrate = useAuthStore((s) => s.hydrate);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const verificationId = params.verificationId ?? '';
  const phone = params.phone ?? '';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verify = async () => {
    setError(null);
    if (!verificationId) {
      setError('Missing verification. Go back and request a new code.');
      return;
    }

    setLoading(true);
    try {
      const user = await authService.confirmPhoneVerification(verificationId, code);
      const profile = await getUser(user.uid);
      hydrate(user, profile);

      if (!profile?.username || !profile?.displayName) {
        router.replace('/(auth)/profile-setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (err instanceof AppError && err.code === 'auth/invalid-otp') {
        setError(toUserMessage(err));
        setCode('');
      } else if (err instanceof AppError && err.code === 'auth/expired-otp') {
        setError(toUserMessage(err));
      } else {
        setError(toUserMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing['4xl'],
            paddingBottom: insets.bottom + Spacing['2xl'],
          },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">
          Enter your code
        </Text>
        <Text style={styles.subtitle}>
          Sent to {phone ? formatPhoneDisplay(phone) : 'your phone'}
        </Text>

        <View style={styles.card}>
          <TextField
            ref={inputRef}
            label="One-time code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={8}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="6-digit code"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={loading ? 'Checking…' : 'Verify & continue'}
            onPress={() => void verify()}
            loading={loading}
            disabled={code.trim().length < 4}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  title: { ...Typography.heading, color: Colors.ink, fontSize: 28 },
  subtitle: { ...Typography.body, color: Colors.inkMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  error: { ...Typography.caption, color: Colors.danger },
});
