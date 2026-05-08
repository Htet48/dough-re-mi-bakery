// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { getUser } from "../services/firestoreService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // true only until first auth check

  // Ensures setLoading(false) is called exactly once — on first auth determination.
  // Subsequent onAuthStateChanged calls (logout, token events, etc.) update
  // state silently without flashing the loading spinner again.
  const initializedRef = useRef(false);

  // ── Firebase auth state ──────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Retry getUser up to 4 times with 1.5 s gaps.
        // On Android Chrome the Firestore auth token can take a moment to
        // propagate after signInWithEmailAndPassword, causing getDoc to fail.
        let p = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            p = await getUser(firebaseUser.uid);
            if (p) break;
          } catch (err) {
            console.warn(`[Auth] profile attempt ${attempt + 1}/4:`, err.message);
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
        }

        if (p) {
          setProfile(p);
        } else {
          // All retries failed — sign out cleanly rather than leaving the app
          // stuck in a "user set, profile null" state that causes redirect loops.
          console.warn("[Auth] Profile unavailable after 4 attempts — signing out.");
          sessionStorage.setItem("profileError", "1");
          signOut(auth);
          return; // onAuthStateChanged(null) will handle final cleanup
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      // Release the loading gate exactly once
      if (!initializedRef.current) {
        initializedRef.current = true;
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    // Try local persistence; fall back to in-memory for private/restricted browsers
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (_) {
      try { await setPersistence(auth, inMemoryPersistence); } catch (__) {}
    }
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(() => signOut(auth), []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
