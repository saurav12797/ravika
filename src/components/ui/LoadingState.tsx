import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors, Spacing, Typography } from '@/theme/colors';

export interface LoadingStateProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ label = 'Loading…', style }: LoadingStateProps) {
  const [pulse] = useState(() => new Animated.Value(0.7));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <Animated.View style={{ opacity: pulse }}>
        <ActivityIndicator size="large" color={Colors.rose} />
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['4xl'],
    gap: Spacing.lg,
  },
  label: {
    ...Typography.body,
    color: Colors.inkMuted,
  },
});
