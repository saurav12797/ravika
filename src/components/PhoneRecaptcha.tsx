import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import {
  FirebaseRecaptchaVerifierModal,
  type FirebaseAuthApplicationVerifier,
} from 'expo-firebase-recaptcha';
import {
  RecaptchaVerifier,
  type ApplicationVerifier,
} from 'firebase/auth';
import {
  ensureCompatFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from '@/services/firebase';
import { firebaseConfig } from '@/config/env';

export type PhoneRecaptchaHandle = {
  getVerifier: () => ApplicationVerifier | FirebaseAuthApplicationVerifier | null;
};

type Props = {
  verifierRef: React.MutableRefObject<PhoneRecaptchaHandle | null>;
};

const CONTAINER_ID = 'ravika-recaptcha';

/**
 * Native: expo-firebase-recaptcha modal (compat app).
 * Web: Firebase JS RecaptchaVerifier on a DOM container.
 */
export function PhoneRecaptcha({ verifierRef }: Props) {
  const modalRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const webVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    if (Platform.OS !== 'web') {
      ensureCompatFirebaseApp();
      verifierRef.current = {
        getVerifier: () => modalRef.current,
      };
      return () => {
        verifierRef.current = null;
      };
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) {
        return;
      }
      try {
        if (typeof document !== 'undefined') {
          let el = document.getElementById(CONTAINER_ID);
          if (!el) {
            el = document.createElement('div');
            el.id = CONTAINER_ID;
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            document.body.appendChild(el);
          } else {
            el.innerHTML = '';
          }
        }

        const auth = getFirebaseAuth();
        const verifier = new RecaptchaVerifier(auth, CONTAINER_ID, {
          size: 'invisible',
        });
        webVerifierRef.current = verifier;
        verifierRef.current = {
          getVerifier: () => webVerifierRef.current,
        };
      } catch (err) {
        console.warn('RecaptchaVerifier init failed', err);
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      webVerifierRef.current?.clear();
      webVerifierRef.current = null;
      verifierRef.current = null;
      if (typeof document !== 'undefined') {
        document.getElementById(CONTAINER_ID)?.remove();
      }
    };
  }, [verifierRef]);

  if (!isFirebaseConfigured) {
    return null;
  }

  if (Platform.OS === 'web') {
    return <View style={{ width: 0, height: 0 }} />;
  }

  ensureCompatFirebaseApp();

  return (
    <FirebaseRecaptchaVerifierModal
      ref={modalRef}
      firebaseConfig={{
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      }}
      attemptInvisibleVerification
    />
  );
}
