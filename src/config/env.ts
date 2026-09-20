import Constants from 'expo-constants';

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  functionsRegion: string;
}

type ExtraRecord = Record<string, unknown>;

function readExtra(): ExtraRecord {
  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === 'object') {
    return extra as ExtraRecord;
  }
  return {};
}

function readString(key: string, fallback = ''): string {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.length > 0) {
    return fromProcess;
  }

  const extra = readExtra();
  const fromExtra = extra[key];
  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra;
  }

  return fallback;
}

export const env = {
  firebaseApiKey: readString('EXPO_PUBLIC_FIREBASE_API_KEY'),
  firebaseAuthDomain: readString('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  firebaseProjectId: readString('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  firebaseStorageBucket: readString('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  firebaseMessagingSenderId: readString(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  ),
  firebaseAppId: readString('EXPO_PUBLIC_FIREBASE_APP_ID'),
  firebaseMeasurementId: readString('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  firebaseFunctionsRegion: readString(
    'EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION',
    'us-central1',
  ),
  googleWebClientId: readString('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  googleAndroidClientId: readString('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  googleIosClientId: readString('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
  /**
   * Opt-in: call Cloud Functions. Default false on Spark (functions 404 / CORS lag).
   * Set EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=true after deploying Blaze Functions.
   */
  useCloudFunctions:
    readString('EXPO_PUBLIC_USE_CLOUD_FUNCTIONS', 'false').toLowerCase() ===
    'true',
} as const;

export const firebaseConfig: FirebaseEnvConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
  measurementId: env.firebaseMeasurementId,
  functionsRegion: env.firebaseFunctionsRegion,
};

const requiredKeys: (keyof FirebaseEnvConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

export const isFirebaseConfigured: boolean = requiredKeys.every(
  (key) => firebaseConfig[key].length > 0,
);
