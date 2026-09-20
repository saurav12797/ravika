import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { User } from 'firebase/auth';
import { Button, TextField } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';
import * as authService from '@/services/authService';
import {
  getGoogleIdTokenNative,
  isGoogleSignInConfigured,
  configureGoogleSignIn,
} from '@/services/googleSignIn';
import { getUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { env, isFirebaseConfigured } from '@/config/env';
import { Colors, Radii, Shadows, Spacing, Typography } from '@/theme/colors';
import { toUserMessage } from '@/utils/errors';

WebBrowser.maybeCompleteAuthSession();

/** Unique Ravika love notes - soft, private, for people you hold close. */
const LOVE_NOTES = [
  'Some hearts just need a tiny tap to feel closer.',
  'Love does not always need words. Sometimes it needs a spark.',
  'The people you love deserve to feel remembered, today.',
  'A soft “I miss you” can travel farther than a long message.',
  'This is your quiet place for the ones who matter most.',
  'Distance feels smaller when someone thinks of you first.',
];

function todaysLoveNote(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return LOVE_NOTES[day % LOVE_NOTES.length];
}

function FloatingOrb({
  delay,
  size,
  color,
  x,
  y,
}: {
  delay: number;
  size: number;
  color: string;
  x: number;
  y: number;
}) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, drift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * -16 },
      { scale: 0.94 + drift.value * 0.1 },
    ],
    opacity: 0.28 + drift.value * 0.22,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: x,
          top: y,
        },
        style,
      ]}
    />
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hydrate = useAuthStore((s) => s.hydrate);
  const loveNote = useMemo(() => todaysLoveNote(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [googleRequest, googleResponse, promptGoogle] =
    Google.useIdTokenAuthRequest({
      webClientId: env.googleWebClientId || undefined,
      androidClientId:
        env.googleAndroidClientId || env.googleWebClientId || undefined,
      iosClientId: env.googleIosClientId || env.googleWebClientId || undefined,
      clientId: env.googleWebClientId || undefined,
      ...(Platform.OS === 'web'
        ? {
            redirectUri: AuthSession.makeRedirectUri({ preferLocalhost: true }),
            selectAccount: true,
          }
        : {}),
    });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        configureGoogleSignIn();
      } catch {
        // Never crash login mount over Google configure.
      }
    }
  }, []);

  const finishAuth = async (user: User) => {
    const profile = await getUser(user.uid);
    hydrate(user, profile);
    if (!profile?.username || !profile?.displayName) {
      router.replace('/(auth)/profile-setup');
    } else {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError('Something gentle went wrong. Please try Google again.');
      return;
    }

    void (async () => {
      setGoogleLoading(true);
      setError(null);
      try {
        const user = await authService.signInWithGoogleIdToken(idToken);
        await finishAuth(user);
      } catch (err) {
        setError(toUserMessage(err));
      } finally {
        setGoogleLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const onEmailSignIn = async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await authService.signInWithEmail(email, password);
      await finishAuth(user);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured.');
      return;
    }
    if (!isGoogleSignInConfigured()) {
      setError('Google sign-in is not ready yet.');
      return;
    }

    setGoogleLoading(true);
    try {
      if (Platform.OS !== 'web') {
        const idToken = await getGoogleIdTokenNative();
        const user = await authService.signInWithGoogleIdToken(idToken);
        await finishAuth(user);
        return;
      }

      if (!googleRequest) {
        setError('Google is still warming up. Try again in a second.');
        return;
      }

      const result = await promptGoogle({
        windowFeatures: { width: 500, height: 600 },
      });
      if (result.type === 'dismiss' || result.type === 'cancel') {
        setError(null);
      } else if (result.type === 'error') {
        setError(result.error?.message || 'Google sign-in failed.');
      }
    } catch (err) {
      const msg = toUserMessage(err);
      if (msg.toLowerCase().includes('cancel')) {
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#FFE8F0', '#FFF6EE', '#FFEDE3']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FloatingOrb delay={0} size={120} color="#F7A8B8" x={-36} y={70} />
      <FloatingOrb delay={500} size={80} color="#FFB199" x={260} y={40} />
      <FloatingOrb delay={900} size={64} color="#FFD6E3" x={180} y={520} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing['2xl'],
            paddingBottom: insets.bottom + Spacing['4xl'],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(700).springify()}
          style={styles.hero}
        >
          <BrandLogo size={72} />
          <Text style={styles.brand} accessibilityRole="header">
            Ravika
          </Text>
          <Text style={styles.tagline}>
            A soft place for the ones you love
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(200).duration(600)}
          style={styles.loveNote}
        >
          <Text style={styles.loveNoteLabel}>A NOTE FOR TODAY</Text>
          <Text style={styles.loveNoteText}>{loveNote}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(160).duration(650).springify()}
          style={[styles.card, Shadows.medium]}
        >
          <Text style={styles.heading}>Come closer</Text>
          <Text style={styles.hint}>
            Sign in with email and password, or continue with Google.
          </Text>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@email.com"
            accessibilityLabel="Email"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="At least 6 characters"
            accessibilityLabel="Password"
          />
          <Button
            title="Continue with email"
            onPress={() => {
              void onEmailSignIn();
            }}
            loading={loading}
            fullWidth
            accessibilityLabel="Continue with email password"
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.or}>or</Text>
            <View style={styles.divider} />
          </View>

          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={() => {
              void onGoogle();
            }}
            loading={googleLoading}
            disabled={
              Platform.OS === 'web'
                ? !googleRequest || !isGoogleSignInConfigured()
                : !isGoogleSignInConfigured()
            }
            fullWidth
            accessibilityLabel="Continue with Google"
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.Text
          entering={FadeIn.delay(450).duration(500)}
          style={styles.footer}
        >
          Built for love, not for noise.
        </Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  orb: {
    position: 'absolute',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brand: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#2D2930',
    textAlign: 'center',
  },
  tagline: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
    maxWidth: 280,
    paddingHorizontal: Spacing.md,
  },
  loveNote: {
    backgroundColor: 'rgba(255, 228, 236, 0.85)',
    borderRadius: Radii.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(232, 90, 122, 0.18)',
    gap: Spacing.xs,
  },
  loveNoteLabel: {
    ...Typography.overline,
    color: Colors.roseDark,
    textAlign: 'center',
  },
  loveNoteText: {
    ...Typography.body,
    color: Colors.ink,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: Radii['2xl'],
    padding: Spacing['2xl'],
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 90, 122, 0.12)',
  },
  heading: {
    ...Typography.heading,
    color: Colors.ink,
  },
  hint: {
    ...Typography.caption,
    color: Colors.inkMuted,
    lineHeight: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  or: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
  },
  footer: {
    ...Typography.caption,
    color: Colors.inkSubtle,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
