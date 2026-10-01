import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandLogo } from '@/components/BrandLogo';
import { NotificationBell } from '@/components/NotificationBell';
import { Colors, Spacing, Typography } from '@/theme/colors';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Show small Ravika mark (default true). */
  showLogo?: boolean;
  /** Instagram-style bell - on by default for every page. */
  showNotifications?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  showLogo = true,
  showNotifications = true,
}: ScreenHeaderProps) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[Colors.blush, Colors.cream]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
      />
      <View style={styles.topRow}>
        {showLogo ? (
          <View style={styles.brandRow}>
            <BrandLogo size={26} />
            <Text style={styles.brand}>Ravika</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.actions}>
          {showNotifications ? <NotificationBell /> : null}
          {right}
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.34)',
    shadowColor: Colors.roseDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brand: {
    ...Typography.caption,
    color: Colors.roseDark,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  text: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    ...Typography.display,
    color: Colors.ink,
    fontSize: 30,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.inkMuted,
  },
});
