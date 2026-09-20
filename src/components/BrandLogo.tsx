import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Official Ravika R mark (transparent) — no black plate. */
export function BrandLogo({ size = 72, style }: Props) {
  return (
    <Image
      source={require('../../assets/brand-logo.png')}
      style={[{ width: size, height: size }, style]}
      accessibilityLabel="Ravika logo"
      resizeMode="contain"
    />
  );
}
