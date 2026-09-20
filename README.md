# Ravika

Real-time connection & emotion app for Android (Expo + Firebase).

**Core loop:** Connect → choose someone → tap an emotion → instant notification → watch the bond grow.

## What this repo is

| Layer | Stack |
| --- | --- |
| App | Expo SDK 57, React Native, TypeScript, Expo Router |
| State | TanStack Query + Zustand (auth/UI) |
| Backend | Firebase Auth (custom token via OTP), Firestore, Cloud Functions, Storage |
| Push | Expo Notifications → Expo Push API |
| Package | `com.ravika.app` |

## Quick start

```bash
npm install
cp .env.example .env
# fill EXPO_PUBLIC_FIREBASE_* values from Firebase console

npx expo start
```

Press `a` for Android emulator, or scan the QR code with Expo Go / a dev build.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Open on Android |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Jest business-logic tests |
| `npm run format` | Prettier |

## Firebase setup

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

Summary:

1. Create a Firebase project; enable Auth, Firestore, Functions, Storage.
2. Copy web config into `.env` (`EXPO_PUBLIC_FIREBASE_*`).
3. Set `.firebaserc` project id.
4. Deploy functions + rules:

```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions,firestore:rules,storage,firestore:indexes
```

5. Call `seedDefaults` once (emulator or as admin).
6. For SMS: set Twilio secrets, or use `ALLOW_TEST_OTP=true` / emulator `debugOtp` during development.

## Architecture

```
app/                  Expo Router screens (auth, tabs, connection, admin)
src/
  components/         UI + reaction/connection widgets
  services/           Firebase client services
  stores/             Zustand (auth, UI)
  hooks/              Auth, network, presence, push, connections
  constants/          Reactions, relationships, milestones
  theme/              Design tokens
functions/            Cloud Functions (OTP, sendInteraction, admin, contacts)
firestore.rules       Security rules (server-owned counters & limits)
```

**Server-enforced:** OTP, rate limits (cooldown / hourly / daily), interaction creation, notification grouping, admin settings.

**Client:** UX validation, realtime listeners, profile/pins/requests (within rules).

## Product surfaces

- Phone OTP auth → profile setup
- Find users (username, phone, hashed contacts)
- Connection requests + relationship agreement
- Pin up to 2 people on Home
- Emotional reaction grid with animations + push
- Activity timeline + dashboard stats + milestones
- Global admin: notification modes, grouping windows, rate limits, reactions

## Android APK (EAS)

Prerequisites: Expo account, `eas-cli`, Firebase configured.

```bash
npm install -g eas-cli
eas login
eas build:configure

# Internal APK for device testing
eas build -p android --profile preview
```

Profiles are in `eas.json`:

- `development` - dev client APK
- `preview` - internal distribution APK
- `production` - release APK

Install the downloaded APK on a physical Android device (enable install from unknown sources if needed).

### Local Android without EAS

```bash
npx expo prebuild -p android
npx expo run:android
```

Requires Android SDK / Android Studio.

## Environment variables

Never commit secrets. Use `.env` (gitignored) from `.env.example`.

| Variable | Used by |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | App |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | App |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | App |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | App |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | App |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | App |
| `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION` | App (default `us-central1`) |
| `TWILIO_*` / `ALLOW_TEST_OTP` | Cloud Functions only |

## Testing

```bash
npm test
npm run typecheck
cd functions && npm run build
```

Business logic covered: phone validation, notification copy, presence, pins, cooldowns, hourly/daily limits, OTP rate limit, notification grouping modes.

## Notes

- Presence heartbeats are throttled (≈ every 2 minutes) to avoid Firestore write spam.
- Contact discovery hashes E.164 numbers (SHA-256) before lookup; full address books are not uploaded.
- Offline: banner shown; reactions go through callables and will fail clearly rather than fake delivery.
