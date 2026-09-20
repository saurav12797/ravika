import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SENDABLE_REACTIONS } from '@/constants/reactions';
import { sendReaction } from '@/services/interactionService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Shadows, Spacing, Typography } from '@/theme/colors';
import type { ReactionType } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

/**
 * Deep-link landing: ravika://quick-send?connectionId=&toUserId=&reaction=&name=
 * Sends instantly (or shows one-tap chips) so feelings leave without browsing the app.
 */
export default function QuickSendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.uid);
  const params = useLocalSearchParams<{
    connectionId?: string;
    toUserId?: string;
    reaction?: string;
    name?: string;
  }>();

  const connectionId = String(params.connectionId ?? '');
  const toUserId = String(params.toUserId ?? '');
  const name = String(params.name ?? 'them');
  const preferred = useMemo(() => {
    const n = Number(params.reaction);
    if (Number.isFinite(n) && n > 0) return n as ReactionType;
    return 2 as ReactionType;
  }, [params.reaction]);

  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const send = useCallback(
    async (reactionType: ReactionType) => {
      if (!connectionId || !toUserId || !userId) {
        setError('This shortcut is missing a person. Open Home and try again.');
        setStatus('error');
        return;
      }
      setStatus('sending');
      setError(null);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sendReaction({
          connectionId,
          toUserId,
          reactionType,
          toDisplayName: name,
        });
        setStatus('done');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1600);
      } catch (err) {
        setError(toUserMessage(err));
        setStatus('error');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [connectionId, toUserId, userId, name, router],
  );

  useEffect(() => {
    if (autoTried || !userId || !connectionId || !toUserId) return;
    setAutoTried(true);
    void send(preferred);
  }, [autoTried, userId, connectionId, toUserId, preferred, send]);

  const chips = SENDABLE_REACTIONS.slice(0, 5);

  return (
    <LinearGradient
      colors={['#FFE4EC', '#FFF6EE', '#FFE8DE']}
      style={[
        styles.root,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <Text style={styles.kicker}>Quick send</Text>
      <Text style={styles.title}>
        {status === 'sending'
          ? `Sending to ${name}…`
          : status === 'done'
            ? `On its way to ${name} 💕`
            : `Tell ${name}`}
      </Text>
      <Text style={styles.sub}>
        One tap and the feeling flies - no scrolling needed.
      </Text>

      {status === 'sending' ? (
        <ActivityIndicator color={Colors.rose} size="large" style={styles.spinner} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.row}>
        {chips.map((r) => (
          <Pressable
            key={String(r.id)}
            disabled={status === 'sending'}
            accessibilityRole="button"
            accessibilityLabel={`Send ${r.title} to ${name}`}
            onPress={() => void send(r.id)}
            style={[styles.chip, Shadows.soft]}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            <Text style={styles.chipLabel} numberOfLines={1}>
              {r.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        style={styles.home}
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
      >
        <Text style={styles.homeText}>Back to Home</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  kicker: {
    ...Typography.overline,
    color: Colors.rose,
  },
  title: {
    ...Typography.display,
    color: Colors.ink,
    fontSize: 28,
  },
  sub: {
    ...Typography.body,
    color: Colors.inkMuted,
  },
  spinner: {
    marginVertical: Spacing.lg,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    width: '30%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: Radii.xl,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
    gap: 4,
  },
  emoji: { fontSize: 32 },
  chipLabel: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '600',
    textAlign: 'center',
  },
  home: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  homeText: {
    ...Typography.label,
    color: Colors.roseDark,
  },
});
