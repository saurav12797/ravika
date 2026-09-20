import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  EmptyState,
  TextField,
} from '@/components/ui';
import { HeaderBrand } from '@/components/HeaderBrand';
import { RelationshipPicker } from '@/components/RelationshipPicker';
import { getRelationshipDefinition } from '@/constants/relationships';
import {
  findByPhone,
  findByUsername,
  matchContactsByPhoneHashes,
  suggestUsersByUsername,
  type ContactMatch,
} from '@/services/discoveryService';
import { sendRequest } from '@/services/connectionService';
import { useAuthStore } from '@/stores/authStore';
import { Colors, Radii, Shadows, Spacing, Typography } from '@/theme/colors';
import type { RelationshipType, UserProfile } from '@/types/models';
import { toUserMessage } from '@/utils/errors';

export default function FindUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selfId = useAuthStore((s) => s.user?.uid);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [picked, setPicked] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<ContactMatch[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [relationship, setRelationship] =
    useState<RelationshipType>('crush');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const suggestSeq = useRef(0);

  // Live username suggestions while typing
  useEffect(() => {
    const q = query.trim();
    setError(null);

    if (q.length < 2 || /^\+?\d[\d\s()-]{6,}$/.test(q)) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }

    const seq = ++suggestSeq.current;
    setSuggesting(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await suggestUsersByUsername(q, selfId);
          if (seq === suggestSeq.current) {
            setSuggestions(rows);
          }
        } catch {
          if (seq === suggestSeq.current) {
            setSuggestions([]);
          }
        } finally {
          if (seq === suggestSeq.current) {
            setSuggesting(false);
          }
        }
      })();
    }, 280);

    return () => clearTimeout(timer);
  }, [query, selfId]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setPicked(null);
    try {
      const byUser = await findByUsername(q.replace(/^@/, ''));
      let byPhone: UserProfile | null = null;
      if (/^\+?\d[\d\s()-]{6,}$/.test(q)) {
        byPhone = await findByPhone(q);
      }
      const hit =
        [byUser, byPhone].find((u) => u != null && u.id !== selfId) ?? null;
      if (hit) {
        setPicked(hit);
        setSuggestions([]);
      } else if (suggestions.length === 1) {
        setPicked(suggestions[0]);
        setSuggestions([]);
      } else {
        setError('Nobody with that yet - try another name, love.');
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const discoverContacts = async () => {
    setContactsLoading(true);
    setError(null);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Maybe later',
          'That’s okay - you can always find them by username.',
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      const phones = data.flatMap(
        (c) => c.phoneNumbers?.map((p) => p.number ?? '') ?? [],
      );
      const matches = await matchContactsByPhoneHashes(phones);
      setContacts(matches.filter((m) => m.user.id !== selfId));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setContactsLoading(false);
    }
  };

  const connect = async (user: UserProfile) => {
    setSending(true);
    try {
      await sendRequest(user.id, relationship);
      const bond = getRelationshipDefinition(relationship);
      Alert.alert(
        'Request sent',
        `${user.displayName} will see you asked to be their ${bond?.label ?? 'person'}. It shows on Home under Connection requests.`,
        [
          {
            text: 'Go home',
            onPress: () => router.replace('/(tabs)'),
          },
        ],
      );
    } catch (err) {
      const msg = toUserMessage(err);
      if (
        msg.toLowerCase().includes('already connected') ||
        msg.toLowerCase().includes('already')
      ) {
        Alert.alert(
          'Already connected',
          `You and ${user.displayName} are already close. Open them from Home - Your people.`,
          [
            {
              text: 'Go home',
              onPress: () => router.replace('/(tabs)'),
            },
          ],
        );
      } else {
        Alert.alert('Could not send', msg);
      }
    } finally {
      setSending(false);
    }
  };

  const bond = getRelationshipDefinition(relationship);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTintColor: Colors.rose,
          headerStyle: { backgroundColor: Colors.cream },
          headerTitle: () => <HeaderBrand title="Find someone" />,
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.blurb}>
          Looking for someone you love? Type their name - we’ll whisper
          suggestions as you go.
        </Text>

        <TextField
          label="Find them"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setPicked(null);
          }}
          placeholder="@bee"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search username or phone"
        />

        {(suggesting || suggestions.length > 0) && !picked ? (
          <View style={styles.suggestBox}>
            {suggesting && suggestions.length === 0 ? (
              <View style={styles.suggestLoading}>
                <ActivityIndicator color={Colors.rose} />
                <Text style={styles.suggestHint}>Looking…</Text>
              </View>
            ) : null}
            {suggestions.map((user) => (
              <Pressable
                key={user.id}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${user.displayName}`}
                onPress={() => {
                  setPicked(user);
                  setQuery(`@${user.username}`);
                  setSuggestions([]);
                }}
                style={styles.suggestRow}
              >
                <Avatar uri={user.avatarUrl} name={user.displayName} size={40} />
                <View style={styles.suggestMeta}>
                  <Text style={styles.name}>{user.displayName}</Text>
                  <Text style={styles.username}>@{user.username}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Button
          title="Search"
          onPress={() => void search()}
          loading={searching}
          fullWidth
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {picked ? (
          <View style={[styles.foundCard, Shadows.medium]}>
            <Text style={styles.foundEyebrow}>Found them</Text>
            <View style={styles.foundHero}>
              <Avatar uri={picked.avatarUrl} name={picked.displayName} size={72} />
              <View style={styles.foundMeta}>
                <Text style={styles.foundName}>{picked.displayName}</Text>
                <Text style={styles.username}>@{picked.username}</Text>
                {picked.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
                    {picked.bio}
                  </Text>
                ) : null}
              </View>
            </View>

            <RelationshipPicker
              value={relationship}
              onChange={setRelationship}
              label="Close to me as"
            />

            <Button
              title={`Connect as ${bond?.emoji ?? '💕'} ${bond?.label ?? 'Crush'}`}
              onPress={() => void connect(picked)}
              loading={sending}
              fullWidth
              accessibilityLabel={`Connect with ${picked.displayName}`}
            />
          </View>
        ) : (
          <RelationshipPicker
            value={relationship}
            onChange={setRelationship}
            label="Close to me as"
          />
        )}

        <View style={styles.divider} />

        <Text style={styles.section}>People you already know</Text>
        <Text style={styles.hint}>
          Optional - see who’s already softly on Ravika.
        </Text>
        <Button
          title="Peek at contacts"
          variant="secondary"
          onPress={() => void discoverContacts()}
          loading={contactsLoading}
          fullWidth
        />

        {contacts.length === 0 && !contactsLoading ? (
          <EmptyState
            emoji="💌"
            title="No matches yet"
            description="Invite them in, or search above."
          />
        ) : (
          contacts.map((m) => (
            <Pressable
              key={m.user.id}
              style={styles.suggestRow}
              onPress={() => {
                setPicked(m.user);
                setQuery(`@${m.user.username}`);
              }}
            >
              <Avatar uri={m.user.avatarUrl} name={m.user.displayName} size={40} />
              <View style={styles.suggestMeta}>
                <Text style={styles.name}>{m.user.displayName}</Text>
                <Text style={styles.username}>@{m.user.username}</Text>
              </View>
              <Text style={styles.connect}>Choose</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  blurb: {
    ...Typography.body,
    color: Colors.inkMuted,
    fontStyle: 'italic',
  },
  suggestBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.roseLight,
    overflow: 'hidden',
  },
  suggestLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  suggestHint: {
    ...Typography.caption,
    color: Colors.inkMuted,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
  },
  suggestMeta: { flex: 1 },
  name: {
    ...Typography.bodyStrong,
    color: Colors.ink,
  },
  username: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  connect: {
    ...Typography.label,
    color: Colors.rose,
  },
  foundCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.roseLight,
  },
  foundEyebrow: {
    ...Typography.overline,
    color: Colors.roseDark,
    letterSpacing: 1,
  },
  foundHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  foundMeta: { flex: 1, gap: 4 },
  foundName: {
    ...Typography.heading,
    color: Colors.ink,
  },
  bio: {
    ...Typography.caption,
    color: Colors.inkMuted,
    marginTop: 4,
  },
  section: {
    ...Typography.heading,
    color: Colors.ink,
    marginTop: Spacing.sm,
  },
  hint: {
    ...Typography.caption,
    color: Colors.inkSubtle,
  },
  error: {
    ...Typography.caption,
    color: Colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
});
