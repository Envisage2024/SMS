// authGuard.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBPbc82p3XWtzH0X4Ougj9MPeDiJF9vzYk",
  authDomain: "sms-db-7b1c7.firebaseapp.com",
  databaseURL: "https://sms-db-7b1c7-default-rtdb.firebaseio.com",
  projectId: "sms-db-7b1c7",
  storageBucket: "sms-db-7b1c7.appspot.com",
  messagingSenderId: "848657966289",
  appId: "1:848657966289:web:3d4ab0afabc6bc9b57d1f0",
  measurementId: "G-45LBM5CTZ0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Not logged in, redirect to login
    window.location.href = 'login.html';
  }
});
