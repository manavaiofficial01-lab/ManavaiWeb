// firebase.config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDfv0RH0vqnEkdFPPNPDM3EvJ428Iq01to",
  authDomain: "manavai-2adb5.firebaseapp.com",
  projectId: "manavai-2adb5",
  storageBucket: "manavai-2adb5.firebasestorage.app",
  messagingSenderId: "845484440157",
  appId: "1:845484440157:web:2508938b32a437cfb9abb4",
  measurementId: "G-NWMQKLM4YJ"
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // For web, we don't call initializeApp without config
  throw error;
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export default { auth, db, storage, messaging };