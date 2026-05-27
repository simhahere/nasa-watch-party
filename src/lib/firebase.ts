import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  Auth,
  User,
} from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';

// Re-export User type from firebase/auth
export type { User };

const firebaseConfig = {
  apiKey: 'AIzaSyBa4ZQFXSJC51l6OSq5r7TWjIeixDtV6-c',
  authDomain: 'nasa-25483.firebaseapp.com',
  projectId: 'nasa-25483',
  storageBucket: 'nasa-25483.firebasestorage.app',
  messagingSenderId: '289027577424',
  appId: '1:289027577424:web:4c73d09caffffeee9e2355',
  databaseURL: 'https://nasa-25483-default-rtdb.asia-southeast1.firebasedatabase.app',
};

// Initialize Firebase app (check if already initialized to avoid duplicate app error)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth: Auth = getAuth(app);
const database: Database = getDatabase(app);
const firestore: Firestore = getFirestore(app);

// Google Auth Provider instance
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google using a popup.
 * Returns the Firebase User on success, or null on failure.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('[Firebase] signInWithGoogle error:', error);
    return null;
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('[Firebase] signOut error:', error);
  }
}

export { app, auth, database, firestore };
