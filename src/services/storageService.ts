import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { getFirebaseStorage } from '@/services/firebase';
import { AppError } from '@/utils/errors';

const UPLOAD_TIMEOUT_MS = 8_000;

/**
 * Upload a local image URI to Firebase Storage and return the download URL.
 * Path must match storage.rules: users/{uid}/profile.jpg
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<string> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const path = `users/${userId}/profile.jpg`;
    const storageRef = ref(getFirebaseStorage(), path);

    await Promise.race([
      uploadBytes(storageRef, blob, { contentType: 'image/jpeg' }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('upload-timeout')),
          UPLOAD_TIMEOUT_MS,
        );
      }),
    ]);

    return getDownloadURL(storageRef);
  } catch (error) {
    throw new AppError(
      'storage/upload-failed',
      'Could not upload photo. Continuing without it.',
      error,
    );
  }
}
