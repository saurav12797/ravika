import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '@/theme/colors';

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Prevents a single screen/native error from killing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[ErrorBoundary]', this.props.label ?? 'root', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.box} accessibilityRole="alert">
          <Text style={styles.title}>Something went soft-wrong</Text>
          <Text style={styles.body}>
            Ravika hit a bump. You can keep going — tap retry.
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.btnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  title: {
    ...Typography.heading,
    color: Colors.ink,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  btn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.rose,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
  },
  btnText: {
    ...Typography.label,
    color: '#fff',
  },
});
