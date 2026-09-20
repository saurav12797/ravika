import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextInput as TextInputRef,
  type ViewStyle,
} from 'react-native';
import { Colors, Radii, Spacing, TouchTarget, Typography } from '@/theme/colors';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextField = forwardRef<TextInputRef, TextFieldProps>(
  function TextField(
    {
      label,
      error,
      hint,
      containerStyle,
      style,
      onFocus,
      onBlur,
      placeholderTextColor = '#D9C7CF',
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={placeholderTextColor}
          accessibilityLabel={label ?? rest.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            focused && styles.inputFocused,
            error ? styles.inputError : null,
            style,
          ]}
          {...rest}
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    width: '100%',
  },
  label: {
    ...Typography.label,
    color: Colors.ink,
  },
  input: {
    minHeight: TouchTarget.min + 8,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.ink,
    ...Typography.body,
  },
  inputFocused: {
    borderColor: Colors.rose,
    backgroundColor: Colors.surfaceElevated,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
  hint: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
});
