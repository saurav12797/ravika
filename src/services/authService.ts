import {
  GoogleAuthProvider,
  PhoneAuthProvider,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ApplicationVerifier,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { getFirebaseAuth } from '@/services/firebase';
import { AppError, toUserMessage } from '@/utils/errors';
import { isValidPhone, normalizeToE164 } from '@/utils/phone';

/**
 * Firebase built-in Phone Auth (Spark-compatible).
 * Requires a reCAPTCHA ApplicationVerifier from expo-firebase-recaptcha.
 */
export async function sendPhoneVerification(
  phoneE164: string,
  verifier: ApplicationVerifier,
): Promise<{ verificationId: string; phoneE164: string }> {
  if (!isValidPhone(phoneE164)) {
    throw new AppError('auth/invalid-phone', 'Enter a valid phone number.');
  }

  const normalized = normalizeToE164(phoneE164);

  try {
    const provider = new PhoneAuthProvider(getFirebaseAuth());
    const verificationId = await provider.verifyPhoneNumber(
      normalized,
      verifier,
    );
    return { verificationId, phoneE164: normalized };
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function confirmPhoneVerification(
  verificationId: string,
  code: string,
): Promise<User> {
  const trimmed = code.trim();
  if (!verificationId || !/^\d{4,8}$/.test(trimmed)) {
    throw new AppError('auth/invalid-otp', 'Enter the code from your SMS.');
  }

  try {
    const credential = PhoneAuthProvider.credential(verificationId, trimmed);
    const result = await signInWithCredential(getFirebaseAuth(), credential);
    return result.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@') || password.length < 6) {
    throw new AppError(
      'auth/invalid-credential',
      'Enter a valid email and a password with at least 6 characters.',
    );
  }

  try {
    const result = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      normalized,
      password,
    );
    return result.user;
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped.code === 'auth/user-not-found' || mapped.code === 'auth/invalid-credential') {
      // Try create for first-time users from the same form
      try {
        const created = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          normalized,
          password,
        );
        return created.user;
      } catch (createError) {
        throw mapAuthError(createError);
      }
    }
    throw mapped;
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@') || password.length < 6) {
    throw new AppError(
      'auth/invalid-credential',
      'Enter a valid email and a password with at least 6 characters.',
    );
  }

  try {
    const result = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      normalized,
      password,
    );
    return result.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

/** Google Sign-In via ID token from expo-auth-session (native). */
export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  if (!idToken) {
    throw new AppError('auth/invalid-credential', 'Google sign-in failed. Try again.');
  }

  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(getFirebaseAuth(), credential);
    return result.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

/**
 * Web Google Sign-In via Firebase popup (avoids redirect_uri_mismatch
 * from Expo AuthSession on localhost).
 */
export async function signInWithGooglePopup(): Promise<User> {
  if (Platform.OS !== 'web') {
    throw new AppError(
      'auth/unsupported',
      'Use the native Google button on this device.',
    );
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    return result.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch (error) {
    throw mapAuthError(error);
  }
}

export function getCurrentUser(): User | null {
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

function mapAuthError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'unknown';

  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : '';

  if (
    code === 'auth/invalid-verification-code' ||
    code === 'auth/code-expired' ||
    (message.includes('invalid') && message.includes('code'))
  ) {
    return new AppError(
      'auth/invalid-otp',
      toUserMessage({ code: 'auth/invalid-otp' }),
      error,
    );
  }

  if (code === 'auth/code-expired' || message.includes('expired')) {
    return new AppError(
      'auth/expired-otp',
      toUserMessage({ code: 'auth/expired-otp' }),
      error,
    );
  }

  if (code === 'auth/too-many-requests') {
    return new AppError(
      'auth/otp-rate-limited',
      'Too many attempts. Wait a bit and try again.',
      error,
    );
  }

  if (code === 'auth/email-already-in-use') {
    return new AppError(
      'auth/email-already-in-use',
      'That email is already registered. Sign in instead.',
      error,
    );
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return new AppError(
      'auth/invalid-credential',
      'Email or password is incorrect.',
      error,
    );
  }

  if (code === 'auth/network-request-failed' || message.includes('network')) {
    return new AppError(
      'auth/network-request-failed',
      toUserMessage({ code: 'auth/network-request-failed' }),
      error,
    );
  }

  if (code === 'auth/captcha-check-failed' || message.includes('recaptcha')) {
    return new AppError(
      'auth/captcha-check-failed',
      'Security check failed. Try again.',
      error,
    );
  }

  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed')) {
    return new AppError(
      'auth/popup-closed-by-user',
      'Google sign-in was cancelled.',
      error,
    );
  }

  if (
    message.includes('redirect_uri_mismatch') ||
    message.includes('invalid request')
  ) {
    return new AppError(
      'auth/redirect-uri-mismatch',
      'Google redirect URI is not allowed. On web we use Firebase popup - refresh and try again.',
      error,
    );
  }

  if (
    message.includes('password_login_disabled') ||
    message.includes('PASSWORD_LOGIN_DISABLED'.toLowerCase())
  ) {
    return new AppError(
      'auth/password-login-disabled',
      'Email/Password is off in Firebase. Enable it under Authentication - Sign-in method - Email/Password.',
      error,
    );
  }

  if (
    message.includes('BILLING_NOT_ENABLED') ||
    (message.includes('billing') && message.includes('not enabled'))
  ) {
    return new AppError(
      'auth/billing-not-enabled',
      'Phone SMS needs Firebase Blaze (pay-as-you-go). Spark no longer sends OTP. Use Google or Email for now.',
      error,
    );
  }

  if (
    message.includes('region enabled') ||
    message.includes('SMS unable to be sent')
  ) {
    return new AppError(
      'auth/sms-region-blocked',
      'India SMS is blocked in Firebase. Enable region IN under Authentication - Settings - SMS region policy.',
      error,
    );
  }

  if (code === 'auth/operation-not-allowed') {
    // Could be Phone OR Email provider disabled - keep message generic.
    return new AppError(
      'auth/operation-not-allowed',
      'This sign-in method is disabled in Firebase Authentication - Sign-in method. Enable Email/Password or Phone there.',
      error,
    );
  }

  return new AppError(code || 'unknown', toUserMessage(error), error);
}
