import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/ui';
import { updateProfile } from '@/services/userService';
import {
  ensurePushTokenSaved,
} from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { NotificationMode, NotificationPreferences } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

const MODES: Array<{ id: NotificationMode; label: string; hint: string }> = [
  { id: 'individual', label: 'Individual', hint: 'Every feeling gets a push' },
  { id: 'grouped', label: 'Grouped', hint: 'Batch nearby reactions' },
  { id: 'smart', label: 'Smart', hint: 'Quiet hours + light batching' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(
    profile?.notificationPreferences ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.notificationPreferences) {
      setPrefs(profile.notificationPreferences);
    }
  }, [profile?.notificationPreferences]);

  const persist = async (next: NotificationPreferences) => {
    if (!user) return;
    setPrefs(next);
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(user.uid, { notificationPreferences: next });
      if (next.pushEnabled) {
        await ensurePushTokenSaved();
      }
      setMessage('Saved');
    } catch (err) {
      setMessage(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return <LoadingState label="Loading settings…" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerTintColor: Colors.rose }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
      >
        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.mode}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.modeLabel}>Edit profile</Text>
            <Text style={styles.modeHint}>
              Name, username, photo, bio
            </Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Notifications</Text>
        <View style={styles.card}>
          <Row
            label="Push notifications"
            value={prefs.pushEnabled}
            onChange={(v) => void persist({ ...prefs, pushEnabled: v })}
          />
          <Row
            label="Reaction alerts"
            value={prefs.reactionNotifications}
            onChange={(v) =>
              void persist({ ...prefs, reactionNotifications: v })
            }
          />
          <Row
            label="Connection requests"
            value={prefs.requestNotifications}
            onChange={(v) =>
              void persist({ ...prefs, requestNotifications: v })
            }
          />
          <Row
            label="Milestones"
            value={prefs.milestoneNotifications}
            onChange={(v) =>
              void persist({ ...prefs, milestoneNotifications: v })
            }
          />
        </View>

        <Text style={styles.section}>Delivery mode</Text>
        <View style={styles.card}>
          {MODES.map((mode) => {
            const selected = prefs.mode === mode.id;
            return (
              <Pressable
                key={mode.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => void persist({ ...prefs, mode: mode.id })}
                style={[styles.mode, selected && styles.modeOn]}
              >
                <Text style={styles.modeLabel}>{mode.label}</Text>
                <Text style={styles.modeHint}>{mode.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Accessibility</Text>
        <View style={styles.card}>
          <Row
            label="Reduce motion"
            value={reducedMotion}
            onChange={setReducedMotion}
          />
        </View>

        {saving ? <Text style={styles.status}>Saving…</Text> : null}
        {message ? <Text style={styles.status}>{message}</Text> : null}
      </ScrollView>
    </>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.borderStrong, true: Colors.roseLight }}
        thumbColor={value ? Colors.rose : Colors.cream}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowLabel: {
    ...Typography.body,
    color: Colors.ink,
    flex: 1,
  },
  mode: {
    padding: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.cream,
  },
  modeOn: {
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.rose,
  },
  modeLabel: {
    ...Typography.bodyStrong,
    color: Colors.ink,
  },
  modeHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  status: {
    ...Typography.caption,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
