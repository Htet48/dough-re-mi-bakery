// src/hooks/useAutoCleanup.js
// Client-side auto-cleanup for Spark plan (no Cloud Functions).
// Runs once per day on admin load. Deletes records older than KEEP_DAYS.

import { useEffect } from "react";
import { cleanupOldData } from "../services/firestoreService";

const KEEP_DAYS  = 1;
const LS_KEY     = "qb_last_cleanup";

export function useAutoCleanup({ enabled = false }) {
  useEffect(() => {
    if (!enabled) return;
    const today = new Date().toISOString().slice(0, 10);
    const last  = localStorage.getItem(LS_KEY);
    if (last === today) return; // already ran today

    // Run in background — don't block UI
    cleanupOldData(KEEP_DAYS)
      .then(count => {
        if (count > 0) console.log(`[AutoCleanup] Deleted ${count} records older than ${KEEP_DAYS} days`);
        localStorage.setItem(LS_KEY, today);
      })
      .catch(err => console.warn("[AutoCleanup] Error:", err.message));
  }, [enabled]);
}
