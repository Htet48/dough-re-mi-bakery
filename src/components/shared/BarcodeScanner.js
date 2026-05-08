import React, { useState, useRef, useEffect, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/browser";

export default function BarcodeScanner({ onDetected, onClose, title="📷 Scan Barcode" }) {
  const videoRef   = useRef(null);
  const controlRef = useRef(null);   // ZXing IScannerControls
  const doneRef    = useRef(false);  // hard lock — prevents double-fire
  const [manual,   setManual]   = useState("");
  const [lastScan, setLastScan] = useState("");
  const [camOn,    setCamOn]    = useState(false);
  const [camErr,   setCamErr]   = useState(""); // "" | "permission" | "unavailable"

  // Single-fire detected handler
  const handleDetected = useCallback((code) => {
    if (doneRef.current) return;
    doneRef.current = true;
    controlRef.current?.stop();
    setLastScan(code);
    onDetected(code);
    setTimeout(() => onClose(), 700);
  }, [onDetected, onClose]);

  // ── Physical / USB / Bluetooth keyboard-emulator scanner ──────────────────
  // Works with any scanner that acts as a HID keyboard (BWHS-1501, Zebra, etc.)
  // Scanner sends characters quickly then hits Enter — we buffer and detect.
  useEffect(() => {
    const buf = { v: "", t: null };
    const fn = (e) => {
      if (e.key === "Enter") {
        if (buf.v.trim().length >= 3) handleDetected(buf.v.trim());
        buf.v = "";
        clearTimeout(buf.t);
        return;
      }
      if (e.key.length === 1) {
        buf.v += e.key;
        clearTimeout(buf.t);
        // Physical scanners fire all chars within ~80ms; human typing is slower
        buf.t = setTimeout(() => { buf.v = ""; }, 80);
      }
    };
    window.addEventListener("keydown", fn);
    return () => { window.removeEventListener("keydown", fn); clearTimeout(buf.t); };
  }, [handleDetected]);

  // ── Camera scanner (ZXing — works on iOS Safari, Android Chrome, desktop) ──
  const startCamera = useCallback(async () => {
    setCamErr("");
    doneRef.current = false;

    const attach = async () => {
      if (!videoRef.current) { setTimeout(attach, 50); return; }

      try {
        const reader = new BrowserMultiFormatReader();
        // facingMode: ideal "environment" = back camera on phones
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result, err) => {
            if (result && !doneRef.current) {
              handleDetected(result.getText());
            }
            // NotFoundException fires on every empty frame — safe to ignore
          }
        );
        controlRef.current = controls;
        setCamOn(true);
      } catch (e) {
        setCamOn(false);
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setCamErr("permission");
        } else {
          setCamErr("unavailable");
        }
      }
    };

    attach();
  }, [handleDetected]);

  // Auto-start on mount, clean up on unmount
  useEffect(() => {
    const t = setTimeout(() => startCamera(), 200);
    return () => {
      clearTimeout(t);
      controlRef.current?.stop();
    };
  }, []); // eslint-disable-line

  const handleManual = (e) => {
    e.preventDefault();
    const code = manual.trim();
    if (code) { handleDetected(code); setManual(""); }
  };

  // ── Success screen ────────────────────────────────────────
  if (lastScan) return (
    <div style={S.overlay}>
      <div style={S.successBox}>
        <div style={{fontSize:52}}>✅</div>
        <div style={{color:"#4ADE80",fontWeight:700,fontSize:18,marginTop:10}}>Scanned!</div>
        <div style={{color:"#aaa",fontSize:13,marginTop:4}}>{lastScan}</div>
      </div>
    </div>
  );

  return (
    <div style={S.overlay}>
      <div style={S.box}>
        <div style={S.head}>
          <span style={S.headTitle}>{title}</span>
          <button style={S.closeBtn} onClick={onClose}>✕ Close</button>
        </div>

        {/* Camera — top */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📷 Camera Scan</div>
          {!camOn && !camErr && (
            <div style={{color:"#C8973A",fontSize:13,textAlign:"center",padding:8}}>
              🔄 Starting camera…
            </div>
          )}
          {camErr === "permission" && (
            <div style={S.errBox}>
              <b>🔒 Camera Permission Required</b><br/><br/>
              <b>iPhone/iPad:</b> Settings → Safari → Camera → Allow<br/>
              <b>Android:</b> Tap 🔒 in address bar → Camera → Allow<br/><br/>
              <button style={S.retryBtn} onClick={startCamera}>Try Again</button>
            </div>
          )}
          {camErr === "unavailable" && (
            <div style={S.errBox}>
              Camera not available on this device.<br/>
              Use the manual entry below instead.<br/><br/>
              <button style={S.retryBtn} onClick={startCamera}>Retry</button>
            </div>
          )}
          {/* Video element always mounted so ZXing can attach to it */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{...S.video, display: camOn ? "block" : "none"}}
          />
          {camOn && (
            <div style={S.badge}>✅ Point camera at barcode — auto-detects</div>
          )}
          <div style={S.camNote}>
            Works on iPhone, Android &amp; desktop · Auto-closes after scan
          </div>
        </div>

        {/* Manual / physical scanner input — bottom */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🔢 Manual / Physical Scanner Entry</div>
          <form onSubmit={handleManual} style={S.manualForm}>
            <input
              style={S.manualInput}
              placeholder="Type or scan with physical scanner…"
              value={manual}
              onChange={e => setManual(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              inputMode="numeric"
            />
            <button type="submit" style={S.manualBtn}>✓</button>
          </form>
          <p style={S.usbNote}>
            🔌 BWHS-1501 / USB / Bluetooth scanner: plug in and scan — auto-detected
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  box:        {background:"#1C1C1E",borderRadius:20,padding:20,width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:10},
  successBox: {background:"#1A3A2A",borderRadius:20,padding:40,display:"flex",flexDirection:"column",alignItems:"center",border:"2px solid #1D9E75"},
  head:       {display:"flex",justifyContent:"space-between",alignItems:"center"},
  headTitle:  {fontWeight:700,fontSize:16,color:"#fff"},
  closeBtn:   {background:"#3A3A3C",border:"none",color:"#fff",borderRadius:10,padding:"7px 14px",cursor:"pointer",fontSize:13},
  section:    {background:"#2C2C2E",borderRadius:12,padding:14},
  sectionTitle:{fontSize:12,fontWeight:600,color:"#C8973A",marginBottom:10},
  video:      {width:"100%",borderRadius:10,objectFit:"cover",maxHeight:220},
  badge:      {background:"#1A3A2A",color:"#4ADE80",fontSize:12,fontWeight:600,padding:"7px 12px",borderRadius:8,marginTop:6,textAlign:"center"},
  errBox:     {background:"#2C1515",borderRadius:10,padding:14,fontSize:12,color:"#F87171",lineHeight:1.8},
  retryBtn:   {background:"#1D9E75",border:"none",color:"#fff",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600,marginTop:4},
  camNote:    {color:"#636366",fontSize:10,marginTop:8,textAlign:"center",lineHeight:1.5},
  manualForm: {display:"flex",gap:8},
  manualInput:{flex:1,background:"#3A3A3C",border:"1.5px solid #48484A",color:"#fff",borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none"},
  manualBtn:  {background:"#C8973A",border:"none",color:"#fff",borderRadius:10,padding:"11px 20px",cursor:"pointer",fontSize:18,fontWeight:700,flexShrink:0},
  usbNote:    {color:"#636366",fontSize:10,margin:"6px 0 0"},
};
