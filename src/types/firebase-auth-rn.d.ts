/**
 * Ambient augmentation: React Native Firebase Auth exports
 * `getReactNativePersistence`, which is omitted from the default web typings.
 */
declare module 'firebase/auth' {
  import type { Persistence } from 'firebase/auth';

  export interface ReactNativeAsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}

export {};
