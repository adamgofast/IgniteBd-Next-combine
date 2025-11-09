'use client';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDNsO_LnQ7t3L_KWejjCuUQxxkI3r0iRxM',
  authDomain: 'ignite-strategies-313c0.firebaseapp.com',
  projectId: 'ignite-strategies-313c0',
  storageBucket: 'ignite-strategies-313c0.firebasestorage.app',
  messagingSenderId: '252461468255',
  appId: '1:252461468255:web:0d62b1a63e3e8da77329ea',
  measurementId: 'G-J2YCGRF1ZJ',
};

const app = initializeApp(firebaseConfig);

let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    photoURL: user.photoURL,
  };
}

export async function signOutUser() {
  await signOut(auth);
}

export async function signUpWithEmail(email, password, displayName) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || displayName,
    photoURL: user.photoURL,
  };
}

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const user = result.user;

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    photoURL: user.photoURL,
  };
}

export function getCurrentUser() {
  return auth.currentUser;
}

export { app, analytics };

