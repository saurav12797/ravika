# Firebase setup - Ravika

This document covers local emulators, project wiring, and deploying the
Cloud Functions + Firestore/Storage rules that back the Expo client.

## Prerequisites

- Node.js **20**
- Firebase CLI (`npm i -g firebase-tools`)
- A Firebase project with **Auth**, **Firestore**, **Functions**, and **Storage** enabled
- Expo app already configured via `src/services/firebase.ts`

## 1. Point `.firebaserc` at your project

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

## 2. Install & build functions

```bash
cd functions
npm install
npm run build
```

## 3. Environment / secrets

Set these for the Functions runtime (Firebase console → Functions →
environment / `firebase functions:secrets:set`, or `.env` for emulators):

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio SMS (optional) |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_FROM_NUMBER` | E.164 sender |
| `ALLOW_TEST_OTP` | `true` to log OTPs when Twilio is unset (never in prod) |
| `FUNCTIONS_EMULATOR` | Set automatically by the emulator |

Without Twilio: OTP codes are logged when `FUNCTIONS_EMULATOR=true` or
`ALLOW_TEST_OTP=true`. Emulator responses may include `debugOtp`.

## 4. Seed defaults

With emulators running (or as an admin in production):

```bash
firebase emulators:start --only functions,firestore,auth,storage
```

Then call the `seedDefaults` callable (Admin SDK / Functions shell / client):

- Creates `adminSettings/global`
- Mirrors `rateLimitSettings/global` and `notificationSettings/global`
- Defaults: **30s** duplicate cooldown, **50**/hour, **200**/day interactions,
  notification mode **smart** with **2** minute grouping window, all reactions enabled

## 5. Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Or piece-wise:

```bash
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

## 6. Client wiring

Callables expected by the app:

| Callable | Client |
|---|---|
| `requestOtp` / `verifyOtp` | `src/services/authService.ts` |
| `sendInteraction` | `src/services/interactionService.ts` |
| `updateAdminSettings` | `src/services/adminService.ts` |
| `matchContactsByPhoneHashes` (alias `matchContacts`) | `src/services/discoveryService.ts` |
| `registerDevice` | optional; client also writes `users.deviceTokens` |
| `seedDefaults` | emulator / admin only |

Point the client at emulators in dev if needed:

```ts
connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);
```

## 7. Schema notes (client-aligned)

- Connections use **`userIds`** (sorted pair), not `memberIds`
- Interactions use **`reactionType`** (1-19 / `custom` / `custom_text`)
- Admin config lives in **`adminSettings/global`** with nested `rateLimits` + `notifications`
- Daily stats docs: **`{connectionId}_{yyyy-mm-dd}`**
- Phone discovery: `users.phoneHash` + `phoneHashes/{hash}` index
- Profile photos: Storage path `users/{uid}/profile.jpg`

## 8. Phone Auth - Blaze + India SMS

Firebase **Phone SMS is not available on the free Spark plan** anymore
(error `BILLING_NOT_ENABLED`). Google sign-in still works on Spark.

To send real OTP to `+91…`:

1. Upgrade the project to **Blaze** (pay-as-you-go) - [billing](https://console.firebase.google.com/project/ravika-533a3/usage/details)
   - Blaze is not a flat monthly fee; unused quota is often **$0**
   - Phone Auth SMS is billed per message after free allowance
2. **Authentication → Sign-in method** → enable **Phone**
3. **Authentication → Settings → SMS region policy** → allow **India (`IN`)**
4. Optional: add **Phone numbers for testing** so you can verify without SMS cost

Until Blaze is on, use **Continue with Google** in the app.

### Google sign-in (web) - fix `redirect_uri_mismatch`

Firebase **Authorized domains** (`localhost`) is already enough for Firebase
itself. Google login also needs the **Google Cloud OAuth Web client**:

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials?project=ravika-533a3)
2. Open the **Web client** whose ID matches `.env`:
   `508586850560-lljgd4fcgehjnp9h7m7e749u4ue53mfp...`
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8081`
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:8081`
5. Save, wait ~1-2 minutes, hard-refresh the app, try Google again

Also keep **Authentication → Sign-in method → Google** enabled in Firebase.

## 9. Making yourself admin

After first sign-in, set either:

1. Custom claim: `admin.auth().setCustomUserClaims(uid, { admin: true })`
2. Or `adminSettings/global.adminUid = "<your-uid>"`
3. Or `users/{uid}.isAdmin = true` (Admin SDK only - client rules block this)
