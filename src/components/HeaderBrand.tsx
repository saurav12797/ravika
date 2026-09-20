import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { Colors, Typography } from '@/theme/colors';

/** Compact Ravika mark for navigation headers. */
export function HeaderBrand({ title }: { title?: string }) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <BrandLogo size={28} />
      <Text style={styles.title} numberOfLines={1}>
        {title ?? 'Ravika'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
  },
  title: {
    ...Typography.label,
    color: Colors.roseDark,
    fontWeight: '700',
  },
});
