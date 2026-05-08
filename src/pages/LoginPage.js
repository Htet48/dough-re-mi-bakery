// src/pages/LoginPage.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserByUsername } from "../services/firestoreService";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { user, profile, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]             = useState({ username:"", password:"" });
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 640);

  // DOM refs — fallback for mobile autofill that skips React onChange
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // ── Show error if a previous login attempt couldn't load the profile ──
  useEffect(() => {
    if (sessionStorage.getItem("profileError")) {
      sessionStorage.removeItem("profileError");
      toast.error("Could not load your profile — please try again.");
    }
  }, []);

  // ── Navigate only once BOTH user AND profile are confirmed ──
  // Waiting for profile means we know the role before navigating, so there
  // is no intermediate "/" hop and no flicker. AuthContext retries getUser
  // up to 4 times (≤ 6 s) so this reliably fires even on slow Android Chrome.
  useEffect(() => {
    if (user && profile) {
      navigate(
        profile.role === "admin" ? "/admin" : "/sale",
        { replace: true }
      );
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Read from React state OR DOM directly (handles mobile browser autofill)
    const username = (form.username || usernameRef.current?.value || "").trim().toLowerCase();
    const password  =  form.password || passwordRef.current?.value || "";
    if (!username || !password) { toast.error("Please fill in all fields"); return; }

    setLoading(true);
    // Safety net — never freeze the button longer than 20 s
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      toast.error("Timed out — check your internet connection and try again.");
    }, 20000);

    let loginSucceeded = false;
    try {
      const userDoc = await getUserByUsername(username);
      if (!userDoc?.email) { toast.error("Username not found"); return; }
      await login(userDoc.email, password);
      loginSucceeded = true;
      // ✅ Do NOT call navigate() here.
      // The useEffect above watches user+profile and navigates once
      // Firebase confirms auth state — works correctly on all browsers.
    } catch (err) {
      const code = err.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Incorrect password");
      } else if (code === "auth/user-not-found") {
        toast.error("No account found with that username");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error — check your internet connection");
      } else if (code === "auth/web-storage-unsupported") {
        toast.error("Browser storage blocked — try turning off private mode");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts — please wait a moment and try again");
      } else {
        toast.error("Login failed: " + (err.message || code || "unknown error"));
      }
    } finally {
      clearTimeout(safetyTimer);
      // Keep "Signing in…" visible until navigation happens.
      // Only reset if login failed.
      if (!loginSucceeded) setLoading(false);
    }
  };

  // While Firebase is determining auth state show a branded splash screen.
  // This prevents the login form from flashing on Android Chrome when the
  // user is already logged in (cached session) — they'd otherwise briefly
  // see the form before being redirected to the dashboard.
  // authLoading is true only once on first app load; after that it's always
  // false so there is zero delay for users who genuinely need to log in.
  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"100vh",background:"#FAFAF7",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Lora',serif",fontSize:22,
          color:"#1C3829",marginBottom:8,letterSpacing:"0.5px"}}>
          Dough-Re-Mi Bakery
        </div>
        <div style={{fontSize:12,color:"#E4B950",letterSpacing:"2px"}}>Loading…</div>
      </div>
    </div>
  );

  // On mobile: always hide left panel (mobileHeader inside form shows brand)
  const hideLeft = isMobile;

  return (
    <div style={S.root}>
      {/* Left brand panel — desktop only */}
      {!hideLeft && (
        <div style={S.left}>
          <div style={S.goldLineTop}/>
          <div style={S.leftInner}>
            <div style={S.logoWrap}>
              <div style={S.logoIcon}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18V5l12-2v13" stroke="#E4B950" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6" cy="18" r="3" stroke="#E4B950" strokeWidth="1.6"/>
                  <circle cx="18" cy="16" r="3" stroke="#E4B950" strokeWidth="1.6"/>
                </svg>
              </div>
              <div style={S.brandName}>Dough-Re-Mi</div>
              <div style={S.brandSub}>Sales Management System</div>
            </div>
            <div style={S.goldDivider}/>
            <div style={S.tagline}>
              "Baked with love.<br/>Tracked with care."
            </div>
            <div style={S.leftFooter}>EST. 2024 · MYANMAR</div>
          </div>
          <div style={S.goldLineBottom}/>
        </div>
      )}

      {/* Right form panel */}
      <div style={{...S.right, ...(hideLeft ? S.rightFull : {})}}>
        <form onSubmit={handleSubmit} style={S.form}>

          {/* Mobile logo */}
          {isMobile && (
            <div style={S.mobileHeader}>
              <div style={S.mobileLogoIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18V5l12-2v13" stroke="#E4B950" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="6" cy="18" r="3" stroke="#E4B950" strokeWidth="1.8"/>
                  <circle cx="18" cy="16" r="3" stroke="#E4B950" strokeWidth="1.8"/>
                </svg>
              </div>
              <span style={S.mobileBrand}>Dough-Re-Mi Bakery</span>
            </div>
          )}

          <div style={S.formTitle}>Welcome back</div>
          <div style={S.formSub}>Sign in to your account</div>

          <div style={S.fields}>
            {/* Username */}
            <div style={S.field}>
              <label style={S.label}>Username</label>
              <div style={S.inputWrap}>
                <svg style={S.inputIcon} width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 1a3 3 0 100 6 3 3 0 000-6zm-5 9a5 5 0 0110 0H3z" fill="#4A8C6B"/>
                </svg>
                <input
                  ref={usernameRef}
                  style={S.input}
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => setForm(f=>({...f, username:e.target.value}))}
                  onInput={e  => setForm(f=>({...f, username:e.target.value}))}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                />
              </div>
            </div>

            {/* Password */}
            <div style={S.field}>
              <label style={S.label}>Password</label>
              <div style={S.inputWrap}>
                <svg style={S.inputIcon} width="16" height="16" viewBox="0 0 16 16">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" fill="#4A8C6B"/>
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="#4A8C6B" strokeWidth="1.5" fill="none"/>
                </svg>
                <input
                  ref={passwordRef}
                  style={S.input}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f=>({...f, password:e.target.value}))}
                  onInput={e  => setForm(f=>({...f, password:e.target.value}))}
                  autoComplete="current-password"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  style={S.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  title={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOffIcon/> : <EyeIcon/>}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{...S.submitBtn, opacity: loading ? 0.7 : 1}}
              disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </div>

          <div style={S.formFooter}>Dough-Re-Mi Bakery · Sales Management</div>
        </form>
      </div>
    </div>
  );
}

// ── Eye icons ─────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

const FOREST = "#1C3829";
const HONEY  = "#E4B950";

const S = {
  root:          { display:"flex", minHeight:"100vh", fontFamily:"'DM Sans',sans-serif" },
  left:          { width:"42%", background:FOREST, display:"flex", flexDirection:"column",
                   position:"relative", flexShrink:0 },
  goldLineTop:   { height:"3px", background:`linear-gradient(90deg,transparent,${HONEY},transparent)`, flexShrink:0 },
  goldLineBottom:{ height:"3px", background:`linear-gradient(90deg,transparent,${HONEY},transparent)`, flexShrink:0 },
  leftInner:     { flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                   justifyContent:"center", padding:"48px 40px" },
  logoWrap:      { textAlign:"center", marginBottom:40 },
  logoIcon:      { width:80, height:80, border:`2px solid rgba(228,185,80,0.4)`, borderRadius:"50%",
                   display:"flex", alignItems:"center", justifyContent:"center",
                   margin:"0 auto 20px", background:"rgba(228,185,80,0.08)" },
  brandName:     { fontFamily:"'Lora',serif", fontSize:26, fontWeight:700,
                   color:HONEY, letterSpacing:"0.5px", marginBottom:8 },
  brandSub:      { color:"rgba(255,255,255,0.3)", fontSize:11, letterSpacing:"2px", textTransform:"uppercase" },
  goldDivider:   { width:60, height:1, background:`linear-gradient(90deg,transparent,${HONEY},transparent)`,
                   margin:"32px auto" },
  tagline:       { color:"rgba(255,255,255,0.38)", fontSize:14, fontStyle:"italic",
                   textAlign:"center", lineHeight:1.8, fontFamily:"'Lora',serif" },
  leftFooter:    { position:"absolute", bottom:28, color:"rgba(255,255,255,0.15)",
                   fontSize:10, letterSpacing:"3px", textTransform:"uppercase" },
  right:         { flex:1, background:"#FAFAF7", display:"flex", alignItems:"center",
                   justifyContent:"center", padding:"32px 24px" },
  rightFull:     { width:"100%" },
  form:          { width:"100%", maxWidth:380, display:"flex", flexDirection:"column" },
  mobileHeader:  { display:"flex", alignItems:"center", gap:10, marginBottom:28 },
  mobileLogoIcon:{ width:36, height:36, borderRadius:10, border:`1.5px solid rgba(228,185,80,0.4)`,
                   background:FOREST, display:"flex", alignItems:"center", justifyContent:"center" },
  mobileBrand:   { fontFamily:"'Lora',serif", fontSize:16, fontWeight:600, color:FOREST },
  formTitle:     { fontFamily:"'Lora',serif", fontSize:28, fontWeight:700,
                   color:FOREST, marginBottom:6 },
  formSub:       { color:"#6B7A6B", fontSize:13, marginBottom:36 },
  fields:        { display:"flex", flexDirection:"column", gap:18 },
  field:         { display:"flex", flexDirection:"column", gap:7 },
  label:         { fontSize:11, fontWeight:600, color:FOREST,
                   letterSpacing:"0.8px", textTransform:"uppercase" },
  inputWrap:     { position:"relative" },
  inputIcon:     { position:"absolute", left:14, top:"50%", transform:"translateY(-50%)",
                   pointerEvents:"none" },
  input:         { width:"100%", padding:"13px 44px 13px 42px",
                   background:"#FFFFFF", border:"1px solid #DDD9D0",
                   borderRadius:8, fontSize:14, color:"#1A1A1A",
                   outline:"none", boxSizing:"border-box" },
  eyeBtn:        { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                   background:"none", border:"none", cursor:"pointer", padding:4,
                   color:"#4A8C6B", display:"flex", alignItems:"center",
                   justifyContent:"center", borderRadius:4 },
  submitBtn:     { background:FOREST, color:HONEY, border:"none",
                   borderRadius:8, padding:"14px", fontSize:14, fontWeight:600,
                   letterSpacing:"0.3px", cursor:"pointer", marginTop:6,
                   fontFamily:"'DM Sans',sans-serif" },
  formFooter:    { textAlign:"center", marginTop:32, fontSize:11,
                   color:"#8A9A8A", letterSpacing:"0.5px" },
};
