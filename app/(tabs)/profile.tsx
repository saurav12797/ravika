import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Avatar, Button, TextField, LoadingState } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScreenHeader } from '@/components/ScreenHeader';
import { checkUsernameAvailable, updateProfile } from '@/services/userService';
import { uploadAvatar } from '@/services/storageService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Spacing, TouchTarget, Typography } from '@/theme/colors';
import type { Gender } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function ProfileScreen() {
  return (
    <ErrorBoundary label="profile">
      <ProfileScreenInner />
    </ErrorBoundary>
  );
}

function ProfileScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [name, setName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [gender, setGender] = useState<Gender | undefined>(profile?.gender);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? '');
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setGender(profile?.gender);
  }, [profile?.displayName, profile?.username, profile?.bio, profile?.gender]);

  useEffect(() => {
    if (!isLoading && user && !profile) {
      router.replace('/(auth)/profile-setup');
    }
  }, [isLoading, user, profile, router]);

  if (isLoading) {
    return (
      <View style={styles.flex}>
        <LoadingState label="Loading profile…" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.flex, styles.centerPad]}>
        <Text style={styles.error}>Please sign in again.</Text>
        <Button title="Go to login" onPress={() => router.replace('/(auth)/login')} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.flex}>
        <LoadingState label="Opening profile setup…" />
      </View>
    );
  }

  const email =
    user?.email?.trim() || (profile as { email?: string } | null)?.email || null;
  const phone = profile.phoneE164 || user.phoneNumber || null;

  const validateUsername = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      setUsernameError('3-20 chars: letters, numbers, underscore.');
      return false;
    }
    if (normalized === profile.username) {
      setUsernameError(null);
      return true;
    }
    const available = await checkUsernameAvailable(normalized);
    if (!available) {
      setUsernameError('That username is taken.');
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      if (!name.trim()) {
        setError('Add your name.');
        return;
      }
      const ok = await validateUsername(username);
      if (!ok) return;

      const displayName = name.trim();

      const updated = await updateProfile(user.uid, {
        displayName,
        username: username.trim().toLowerCase(),
        bio: bio.trim() || undefined,
        gender,
      });
      setProfile(updated);
      setSavedHint('Saved');
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to update your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setSaving(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const avatarUrl = await uploadAvatar(user.uid, manipulated.uri);
      const updated = await updateProfile(user.uid, { avatarUrl });
      setProfile(updated);
      setSavedHint('Photo updated');
    } catch (err) {
      Alert.alert('Upload failed', toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const onLogout = () => {
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' ? window.confirm('Log out of Ravika?') : true;
      if (ok) void doLogout();
      return;
    }
    Alert.alert('Log out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void doLogout();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + 88,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Profile"
          subtitle="Edit what you set up when you joined"
          showNotifications={false}
        />

        <View style={styles.hero}>
          <Avatar uri={profile.avatarUrl} name={profile.displayName} size={96} />
          <Text style={styles.handle}>@{profile.username}</Text>
          <Button
            title="Change photo"
            variant="secondary"
            size="md"
            onPress={() => void changePhoto()}
            accessibilityLabel="Change profile photo"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>About you</Text>

          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            accessibilityLabel="Name"
          />

          <TextField
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              setUsernameError(null);
              setSavedHint(null);
            }}
            onBlur={() => {
              if (username) void validateUsername(username);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError ?? undefined}
            hint="Friends can search this handle"
            accessibilityLabel="Username"
          />

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
                    style={[styles.genderText, selected && styles.genderTextSelected]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Bio"
            value={bio ?? ''}
            onChangeText={setBio}
            multiline
            maxLength={160}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
            accessibilityLabel="Bio"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.lockedHint}>
            These come from sign-in and cannot be edited here.
          </Text>
          {phone ? (
            <View style={styles.lockedRow}>
              <Text style={styles.lockedLabel}>Phone</Text>
              <Text style={styles.lockedValue}>{phone}</Text>
            </View>
          ) : null}
          {email ? (
            <View style={styles.lockedRow}>
              <Text style={styles.lockedLabel}>Email</Text>
              <Text style={styles.lockedValue}>{email}</Text>
            </View>
          ) : null}
          {!phone && !email ? (
            <Text style={styles.lockedValue}>No phone or email on file</Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {savedHint ? <Text style={styles.saved}>{savedHint}</Text> : null}

        <Button
          title="Save changes"
          onPress={() => void save()}
          loading={saving}
          fullWidth
          accessibilityLabel="Save profile changes"
        />

        <View style={styles.card}>
          <Button
            title="Settings"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open settings"
          />
          {profile.isAdmin ? (
            <Button
              title="Admin"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/admin')}
              accessibilityLabel="Open admin"
            />
          ) : null}
          <Button
            title="Log out"
            variant="danger"
            fullWidth
            onPress={onLogout}
            accessibilityLabel="Log out"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centerPad: {
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  handle: {
    ...Typography.label,
    color: Colors.roseDark,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.ink,
    fontSize: 15,
  },
  label: {
    ...Typography.label,
    color: Colors.ink,
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
  lockedHint: {
    ...Typography.caption,
    color: Colors.inkSubtle,
    marginTop: -Spacing.xs,
  },
  lockedRow: {
    gap: 2,
  },
  lockedLabel: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  lockedValue: {
    ...Typography.body,
    color: Colors.ink,
  },
  card: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
  saved: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
});
