import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RELATIONSHIP_TYPES,
  getRelationshipDefinition,
} from '@/constants/relationships';
import { Colors, Radii, Spacing, TouchTarget, Typography } from '@/theme/colors';
import type { RelationshipType } from '@/types/models';

export interface RelationshipPickerProps {
  value?: RelationshipType;
  onChange: (value: RelationshipType) => void;
  label?: string;
}

/** Soft dropdown for how they sit in your heart. */
export function RelationshipPicker({
  value = 'crush',
  onChange,
  label = 'Close to me as',
}: RelationshipPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => getRelationshipDefinition(value) ?? RELATIONSHIP_TYPES[0],
    [value],
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${selected.label}`}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text style={styles.triggerEmoji}>{selected.emoji}</Text>
        <Text style={styles.triggerText}>{selected.label}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Close to me as</Text>
            <Text style={styles.sheetHint}>Pick how they sit in your heart</Text>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {RELATIONSHIP_TYPES.map((item) => {
                const isOn = item.id === value;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isOn }}
                    onPress={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    style={[styles.option, isOn && styles.optionOn]}
                  >
                    <Text style={styles.optionEmoji}>{item.emoji}</Text>
                    <Text style={[styles.optionLabel, isOn && styles.optionLabelOn]}>
                      {item.label}
                    </Text>
                    {isOn ? <Text style={styles.check}>♥</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  fieldLabel: {
    ...Typography.label,
    color: Colors.ink,
  },
  trigger: {
    minHeight: TouchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.roseLight,
  },
  triggerEmoji: { fontSize: 20 },
  triggerText: {
    ...Typography.bodyStrong,
    color: Colors.ink,
    flex: 1,
  },
  chevron: {
    ...Typography.body,
    color: Colors.rose,
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40, 20, 30, 0.45)',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.heading,
    color: Colors.ink,
  },
  sheetHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  list: { maxHeight: 360 },
  option: {
    minHeight: TouchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
  },
  optionOn: {
    backgroundColor: Colors.blush,
  },
  optionEmoji: { fontSize: 20 },
  optionLabel: {
    ...Typography.body,
    color: Colors.ink,
    flex: 1,
  },
  optionLabelOn: {
    color: Colors.roseDark,
    fontWeight: '700',
  },
  check: {
    color: Colors.rose,
    fontSize: 16,
  },
});
