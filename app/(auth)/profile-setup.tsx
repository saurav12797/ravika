import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, TextField } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';
import { createProfile, checkUsernameAvailable } from '@/services/userService';
import { ensurePushTokenSaved } from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, TouchTarget, Typography } from '@/theme/colors';
import type { Gender } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<Gender | undefined>();
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateUsername = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      setUsernameError('3–20 chars: letters, numbers, underscore.');
      return false;
    }
    const available = await checkUsernameAvailable(normalized);
    if (!available) {
      setUsernameError('That username is taken.');
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const onSubmit = async () => {
    setError(null);
    if (!user) {
      setError('Please sign in again.');
      return;
    }
    if (!name.trim()) {
      setError('Add your name.');
      return;
    }

    const ok = await validateUsername(username);
    if (!ok) {
      return;
    }

    setLoading(true);
    try {
      const displayName = name.trim();
      const profile = await createProfile({
        id: user.uid,
        phoneE164: user.phoneNumber ?? undefined,
        email: user.email ?? undefined,
        username: username.trim().toLowerCase(),
        displayName,
        bio: bio.trim() || undefined,
        gender,
      });
      setProfile(profile);
      void ensurePushTokenSaved();
      router.replace('/(tabs)');
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#FFE8F0', '#FFF6EE', '#FFEDE3']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing['2xl'],
            paddingBottom: insets.bottom + Spacing['3xl'],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <BrandLogo size={56} />
          <Text style={styles.title} accessibilityRole="header">
            Make it yours
          </Text>
          <Text style={styles.subtitle}>
            A name, a handle, and a little spark of personality — so the people
            you love know it's you.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your name</Text>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            autoCapitalize="words"
            accessibilityLabel="Name"
          />

          <Text style={styles.sectionLabel}>Your handle</Text>
          <TextField
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              setUsernameError(null);
            }}
            onBlur={() => {
              if (username) {
                void validateUsername(username);
              }
            }}
            placeholder="ravika_lover"
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError ?? undefined}
            hint="Unique handle friends can search"
            accessibilityLabel="Username"
          />

          <Text style={styles.sectionLabel}>About you</Text>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => {
              const selected = gender === g.id;
              return (
                <Pressable
                  key={g.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={g.label}
                  onPress={() => setGender(g.id)}
                  style={[styles.genderChip, selected && styles.genderSelected]}
                >
                  <Text
                    style={[
                      styles.genderText,
                      selected && styles.genderTextSelected,
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="A short note about you"
            multiline
            maxLength={160}
            style={styles.bio}
            accessibilityLabel="Bio"
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Continue"
            onPress={() => {
              void onSubmit();
            }}
            loading={loading}
            fullWidth
            accessibilityLabel="Save profile and continue"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#2A1F24',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: '#6B5560',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: Radii['2xl'],
    padding: Spacing['2xl'],
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 90, 122, 0.14)',
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.roseDark,
    marginTop: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: '#2A1F24',
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  genderChip: {
    minHeight: TouchTarget.min - 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    backgroundColor: Colors.creamDark,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  genderSelected: {
    backgroundColor: Colors.blush,
    borderColor: Colors.rose,
  },
  genderText: {
    ...Typography.caption,
    color: Colors.inkMuted,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: Colors.roseDark,
  },
  bio: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
});
