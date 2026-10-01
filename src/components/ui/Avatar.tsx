import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors, Typography } from '@/theme/colors';
import type { PresenceStatus } from '@/types/models';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  presence?: PresenceStatus;
  style?: StyleProp<ViewStyle>;
}

function initialsFromName(name?: string): string {
  if (!name?.trim()) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function Avatar({ uri, name, size = 48, presence, style }: AvatarProps) {
  const initials = useMemo(() => initialsFromName(name), [name]);
  const radius = size / 2;
  const presenceSize = Math.max(10, Math.round(size * 0.22));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `Avatar for ${name}` : 'Avatar'}
      style={[styles.wrap, { width: size, height: size, borderRadius: radius }, style]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: Colors.blush,
          }}
        />
      ) : (
        <View
          style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}
        >
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
            {initials}
          </Text>
        </View>
      )}
      {presence ? (
        <View
          style={[
            styles.presence,
            {
              width: presenceSize,
              height: presenceSize,
              borderRadius: presenceSize / 2,
              backgroundColor:
                presence === 'online'
                  ? Colors.online
                  : presence === 'recently'
                    ? Colors.recently
                    : Colors.offline,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'visible',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.blush,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  initials: {
    ...Typography.label,
    color: Colors.roseDark,
  },
  presence: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: Colors.cream,
  },
});
