// src/hooks/useBarcodeScanner.js
// USB/Wireless external scanner hook only

import { useEffect, useRef } from "react";

// USB / Wireless scanner — types fast then sends Enter
export function useExternalScanner(onDetected, enabled = true) {
  const bufferRef = useRef("");
  const timerRef  = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e) => {
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code.length >= 3) onDetected(code);
        bufferRef.current = "";
        clearTimeout(timerRef.current);
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { bufferRef.current = ""; }, 80);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timerRef.current);
    };
  }, [enabled, onDetected]);
}
