// firebase-config.js

// Import modular Firebase SDKs (v9+)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPbc82p3XWtzH0X4Ougj9MPeDiJF9vzYk",
  authDomain: "sms-db-7b1c7.firebaseapp.com",
  databaseURL: "https://sms-db-7b1c7-default-rtdb.firebaseio.com",
  projectId: "sms-db-7b1c7",
  storageBucket: "sms-db-7b1c7.appspot.com", // ✅ corrected from .firebasestorage.app to .appspot.com
  messagingSenderId: "848657966289",
  appId: "1:848657966289:web:3d4ab0afabc6bc9b57d1f0",
  measurementId: "G-45LBM5CTZ0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export initialized Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export default app;
