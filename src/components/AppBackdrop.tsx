import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type HeartPlacement = {
  top: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  text: string;
  size: number;
  rotate: `${number}deg` | `-${number}deg`;
};

const HEARTS: HeartPlacement[] = [
  { top: '9%', left: '8%', text: '♡', size: 32, rotate: '-14deg' },
  { top: '18%', right: '12%', text: '♥', size: 18, rotate: '12deg' },
  { top: '42%', left: '4%', text: '♡', size: 24, rotate: '10deg' },
  { top: '56%', right: '6%', text: '♥', size: 28, rotate: '-12deg' },
  { top: '76%', left: '13%', text: '♥', size: 16, rotate: '8deg' },
  { top: '88%', right: '20%', text: '♡', size: 34, rotate: '-8deg' },
] as const;

export function AppBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#FFF7F0', '#FFECE4', '#FFF0F5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {HEARTS.map((heart, index) => (
        <Text
          key={`${heart.text}-${index}`}
          style={[
            styles.heart,
            {
              top: heart.top,
              left: heart.left,
              right: heart.right,
              fontSize: heart.size,
              transform: [{ rotate: heart.rotate }],
            },
          ]}
        >
          {heart.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heart: {
    position: 'absolute',
    color: 'rgba(196,61,92,0.12)',
    fontWeight: '700',
  },
});
