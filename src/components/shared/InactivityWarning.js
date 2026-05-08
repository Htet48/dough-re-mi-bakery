// src/components/shared/InactivityWarning.js
// Modal shown 1 minute before auto-logout
import React, { useState, useEffect } from "react";

export default function InactivityWarning({ onStay, onLogout }) {
  const [secs, setSecs] = useState(60);

  useEffect(() => {
    if (secs <= 0) { onLogout(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onLogout]);

  return (
    <div style={S.overlay}>
      <div style={S.box}>
        <div style={{fontSize:48, textAlign:"center"}}>⏰</div>
        <h3 style={S.title}>Still there?</h3>
        <p style={S.sub}>
          You'll be logged out in <b style={{color:"#DC2626"}}>{secs}s</b> due to inactivity.
        </p>
        <div style={S.barBg}>
          <div style={{
            ...S.bar,
            width: `${(secs/60)*100}%`,
            background: secs > 30 ? "#C9A84C" : "#DC2626",
          }}/>
        </div>
        <div style={S.btns}>
          <button style={S.logoutBtn} onClick={onLogout}>
            Log out now
          </button>
          <button style={S.stayBtn} onClick={onStay}>
            ✅ Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position:"fixed", inset:0, background:"rgba(26,26,46,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  box:     { background:"#fff", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:340, textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" },
  title:   { margin:"10px 0 6px", fontSize:20, fontWeight:700, color:"#1A1A2E" },
  sub:     { fontSize:14, color:"#555", margin:"0 0 16px", lineHeight:1.6 },
  barBg:   { height:6, background:"#E5DDD0", borderRadius:3, overflow:"hidden", marginBottom:20 },
  bar:     { height:6, borderRadius:3, transition:"width 1s linear, background 0.5s" },
  btns:    { display:"flex", flexDirection:"column", gap:10 },
  stayBtn: { background:"#C9A84C",color:"#1A1A2E", color:"#fff", border:"none", borderRadius:10, padding:"13px", fontSize:15, fontWeight:700, cursor:"pointer" },
  logoutBtn:{ background:"#F5F5F5", color:"#888", border:"none", borderRadius:10, padding:"11px", fontSize:13, cursor:"pointer" },
};
