// src/hooks/useAutoLogout.js
// Auto-logout after 5 hours of inactivity.
// Inactivity = no mouse move, click, keypress, scroll, or touch.

import { useEffect, useRef, useCallback } from "react";

const INACTIVE_MS = 5 * 60 * 60 * 1000;   // 5 hours  (18 000 000 ms)
const WARNING_MS  = 5 * 60 * 1000;         // warn 5 minutes before logout

export function useAutoLogout({ onLogout, onWarn, onReset, enabled }) {
  const logoutTimer = useRef(null);
  const warnTimer   = useRef(null);
  const warned      = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimeout(logoutTimer.current);
    clearTimeout(warnTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    warned.current = false;

    // Warn 1 minute before logout
    warnTimer.current = setTimeout(() => {
      warned.current = true;
      onWarn?.();
    }, INACTIVE_MS - WARNING_MS);

    // Auto-logout after full inactive period
    logoutTimer.current = setTimeout(() => {
      onLogout?.();
    }, INACTIVE_MS);
  }, [enabled, onLogout, onWarn, clearTimers]);

  useEffect(() => {
    if (!enabled) { clearTimers(); return; }

    const events = [
      "mousemove", "mousedown", "keydown",
      "touchstart", "touchmove", "scroll", "click",
    ];

    const handleActivity = () => {
      if (warned.current) onReset?.(); // dismiss warning if shown
      resetTimers();
    };

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers(); // start timer immediately

    return () => {
      clearTimers();
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [enabled, resetTimers, clearTimers, onReset]);
}
