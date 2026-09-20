import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorState, LoadingState, TextField } from '@/components/ui';
import {
  getAdminSettings,
  updateAdminSettings,
} from '@/services/adminService';
import { Colors, Radii, Spacing } from '@/theme/colors';
import type { RateLimitSettings } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

export default function AdminRateLimitsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
  });
  const [form, setForm] = useState<RateLimitSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data.rateLimits);
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading || !form) return <LoadingState />;
  if (settingsQuery.isError) {
    return (
      <ErrorState
        error={settingsQuery.error}
        onRetry={() => void settingsQuery.refetch()}
      />
    );
  }

  const setNum = (key: keyof RateLimitSettings, text: string) => {
    setForm({
      ...form,
      [key]: Number(text.replace(/\D/g, '')) || 0,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings({ rateLimits: form });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      Alert.alert('Saved', 'Rate limits updated.');
    } catch (err) {
      Alert.alert('Error', toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing['3xl'] },
      ]}
    >
      <View style={styles.card}>
        <TextField
          label="OTP per hour"
          value={String(form.otpPerHour)}
          onChangeText={(t) => setNum('otpPerHour', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Interactions per minute"
          value={String(form.interactionsPerMinute)}
          onChangeText={(t) => setNum('interactionsPerMinute', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Interactions per hour"
          value={String(form.interactionsPerHour)}
          onChangeText={(t) => setNum('interactionsPerHour', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Interactions per day"
          value={String(form.interactionsPerDay)}
          onChangeText={(t) => setNum('interactionsPerDay', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Requests per day"
          value={String(form.requestsPerDay)}
          onChangeText={(t) => setNum('requestsPerDay', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Cooldown between reactions (sec)"
          value={String(form.cooldownSec)}
          onChangeText={(t) => setNum('cooldownSec', t)}
          keyboardType="number-pad"
        />
        <TextField
          label="Duplicate reaction cooldown (sec)"
          value={String(form.duplicateReactionCooldownSec)}
          onChangeText={(t) => setNum('duplicateReactionCooldownSec', t)}
          keyboardType="number-pad"
        />
      </View>
      <Button title="Save" loading={saving} onPress={() => void save()} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
