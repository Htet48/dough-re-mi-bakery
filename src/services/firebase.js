// src/services/firebase.js
// ── Firebase is configured via environment variables ──────────────────────────
// Copy .env.example → .env and fill in your own Firebase project values.
// NEVER commit .env — it is gitignored.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId:     process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use long-polling instead of WebSocket for Firestore.
// WebSocket connections are often blocked on mobile networks, VPNs, and
// corporate proxies — long-polling works everywhere and is automatically
// chosen by experimentalAutoDetectLongPolling when WebSocket fails.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

export const storage = getStorage(app);
export default app;
