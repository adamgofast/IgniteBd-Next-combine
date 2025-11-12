import { getFirebaseAdmin } from './firebaseAdmin';

/**
 * Ensure Firebase user exists for email
 * Returns { user, wasCreated: boolean }
 */
export async function ensureFirebaseUser(email) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new Error('Firebase admin not configured');
  }

  const auth = admin.auth();
  
  try {
    // Try to get existing user
    const user = await auth.getUserByEmail(email);
    return { user, wasCreated: false };
  } catch (err) {
    // User doesn't exist - create new
    if (err.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        emailVerified: false,
        disabled: false,
      });
      return { user, wasCreated: true };
    }
    throw err;
  }
}

