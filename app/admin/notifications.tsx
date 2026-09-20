import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorState, LoadingState, TextField } from '@/components/ui';
import {
  getAdminSettings,
  updateAdminSettings,
} from '@/services/adminService';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';
import type { NotificationMode, NotificationSettings } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
  });
  const [form, setForm] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data.notifications);
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

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings({ notifications: form });
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      Alert.alert('Saved', 'Notification settings updated.');
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
        <View style={styles.row}>
          <Text style={styles.label}>Quiet hours</Text>
          <Switch
            value={form.quietHoursEnabled}
            onValueChange={(v) => setForm({ ...form, quietHoursEnabled: v })}
          />
        </View>
        <TextField
          label="Default quiet start"
          value={form.defaultQuietHoursStart}
          onChangeText={(t) => setForm({ ...form, defaultQuietHoursStart: t })}
          placeholder="22:00"
        />
        <TextField
          label="Default quiet end"
          value={form.defaultQuietHoursEnd}
          onChangeText={(t) => setForm({ ...form, defaultQuietHoursEnd: t })}
          placeholder="07:00"
        />
        <TextField
          label="Grouping window (seconds)"
          value={String(form.groupingWindowSeconds ?? form.batchWindowMinutes * 60)}
          onChangeText={(t) => {
            const seconds = Number(t.replace(/\D/g, '')) || 0;
            setForm({
              ...form,
              groupingWindowSeconds: seconds,
              batchWindowMinutes: Math.max(1, Math.round(seconds / 60)),
            });
          }}
          keyboardType="number-pad"
          hint="Use 30, 60, 120, 300, or 600"
        />
        <Text style={styles.label}>Quick windows</Text>
        <View style={styles.chips}>
          {[30, 60, 120, 300, 600].map((seconds) => (
            <Button
              key={seconds}
              title={seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
              size="md"
              variant={
                (form.groupingWindowSeconds ?? 0) === seconds
                  ? 'primary'
                  : 'secondary'
              }
              onPress={() =>
                setForm({
                  ...form,
                  groupingWindowSeconds: seconds,
                  batchWindowMinutes: Math.max(1, Math.round(seconds / 60)),
                })
              }
            />
          ))}
        </View>
        <Text style={styles.label}>Mode: {form.mode}</Text>
        {(['individual', 'grouped', 'smart'] as NotificationMode[]).map(
          (mode) => (
            <Button
              key={mode}
              title={mode}
              size="md"
              variant={form.mode === mode ? 'primary' : 'secondary'}
              onPress={() => setForm({ ...form, mode })}
            />
          ),
        )}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  label: { ...Typography.label, color: Colors.ink },
});
