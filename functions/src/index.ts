import * as admin from 'firebase-admin';

admin.initializeApp();

export { requestOtp } from './callables/requestOtp';
export { verifyOtp } from './callables/verifyOtp';
export { sendInteraction } from './callables/sendInteraction';
export { updateAdminSettings } from './callables/updateAdminSettings';
export {
  matchContacts,
  matchContactsByPhoneHashes,
} from './callables/matchContacts';
export { registerDevice } from './callables/registerDevice';
export { seedDefaults } from './seedDefaults';
