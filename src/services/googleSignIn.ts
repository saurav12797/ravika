import { Platform } from 'react-native';
import { env } from '@/config/env';
import { AppError } from '@/utils/errors';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin').GoogleSignin;

let configured = false;

function getGoogleSignin(): GoogleSigninModule | null {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    // Lazy require so a missing native module never crashes app boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as {
      GoogleSignin: GoogleSigninModule;
    };
    return mod.GoogleSignin;
  } catch (err) {
    console.warn('[google] native module unavailable', err);
    return null;
  }
}

export function configureGoogleSignIn(): void {
  if (configured || Platform.OS === 'web') {
    return;
  }
  if (!env.googleWebClientId) {
    return;
  }
  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) {
    return;
  }
  try {
    GoogleSignin.configure({
      webClientId: env.googleWebClientId,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
    configured = true;
  } catch (err) {
    console.warn('[google] configure failed', err);
  }
}

export function isGoogleSignInConfigured(): boolean {
  if (!env.googleWebClientId) {
    return false;
  }
  if (Platform.OS === 'web') {
    return true;
  }
  return getGoogleSignin() != null;
}

/**
 * Native Google Sign-In → Firebase ID token.
 * Never throws uncaught native errors to the JS root.
 */
export async function getGoogleIdTokenNative(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new AppError(
      'auth/invalid-credential',
      'Use the web Google button on this platform.',
    );
  }

  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) {
    throw new AppError(
      'auth/invalid-credential',
      'Google sign-in is unavailable on this build.',
    );
  }

  configureGoogleSignIn();
  if (!env.googleWebClientId) {
    throw new AppError('auth/invalid-credential', 'Google sign-in is not configured.');
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (err) {
    throw new AppError(
      'auth/invalid-credential',
      'Google Play Services is required for Google sign-in.',
      err,
    );
  }

  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore stale session clear failures
  }

  let response: Awaited<ReturnType<GoogleSigninModule['signIn']>>;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel|12501|SIGN_IN_CANCELLED/i.test(message)) {
      throw new AppError('auth/cancelled', 'Google sign-in was cancelled.');
    }
    throw new AppError(
      'auth/invalid-credential',
      'Google sign-in failed. Try again.',
      err,
    );
  }

  if (response.type !== 'success') {
    throw new AppError('auth/cancelled', 'Google sign-in was cancelled.');
  }

  const idToken = response.data.idToken;
  if (idToken) {
    return idToken;
  }

  try {
    const tokens = await GoogleSignin.getTokens();
    if (tokens.idToken) {
      return tokens.idToken;
    }
  } catch (err) {
    throw new AppError(
      'auth/invalid-credential',
      'Google did not return an ID token. Try again.',
      err,
    );
  }

  throw new AppError(
    'auth/invalid-credential',
    'Google did not return an ID token. Try again.',
  );
}
