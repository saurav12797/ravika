import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import firebaseCompat from 'firebase/compat/app';
import 'firebase/compat/auth';
import { firebaseConfig, isFirebaseConfigured } from '@/config/env';
import { assertConfigured } from '@/utils/errors';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;
let storageInstance: FirebaseStorage | null = null;

function buildOptions() {
  return {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    ...(firebaseConfig.measurementId
      ? { measurementId: firebaseConfig.measurementId }
      : {}),
  };
}

/**
 * expo-firebase-recaptcha uses the compat SDK and expects a default app.
 * Keep modular + compat in sync.
 */
export function ensureCompatFirebaseApp(): void {
  if (!isFirebaseConfigured) {
    return;
  }
  if (!firebaseCompat.apps.length) {
    firebaseCompat.initializeApp(buildOptions());
  }
}

function initFirebase(): void {
  if (appInstance || !isFirebaseConfigured) {
    return;
  }

  const options = buildOptions();

  appInstance = getApps().length > 0 ? getApp() : initializeApp(options);
  ensureCompatFirebaseApp();

  try {
    if (Platform.OS === 'web') {
      authInstance = initializeAuth(appInstance, {
        persistence: browserLocalPersistence,
      });
    } else {
      authInstance = initializeAuth(appInstance, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch {
    authInstance = getAuth(appInstance);
  }

  dbInstance = getFirestore(appInstance);
  functionsInstance = getFunctions(
    appInstance,
    firebaseConfig.functionsRegion,
  );
  storageInstance = getStorage(appInstance);
}

if (isFirebaseConfigured) {
  initFirebase();
}

function ensureInit(): void {
  assertConfigured(isFirebaseConfigured);
  if (!appInstance) {
    initFirebase();
  }
}

export function getFirebaseApp(): FirebaseApp {
  ensureInit();
  if (!appInstance) {
    throw new Error('Firebase App failed to initialize');
  }
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  ensureInit();
  if (!authInstance) {
    throw new Error('Firebase Auth failed to initialize');
  }
  return authInstance;
}

export function getDb(): Firestore {
  ensureInit();
  if (!dbInstance) {
    throw new Error('Firestore failed to initialize');
  }
  return dbInstance;
}

export function getFirebaseFunctions(): Functions {
  ensureInit();
  if (!functionsInstance) {
    throw new Error('Firebase Functions failed to initialize');
  }
  return functionsInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  ensureInit();
  if (!storageInstance) {
    throw new Error('Firebase Storage failed to initialize');
  }
  return storageInstance;
}

export const auth = getFirebaseAuth;
export const db = getDb;
export const functions = getFirebaseFunctions;
export const storage = getFirebaseStorage;

export { isFirebaseConfigured };
