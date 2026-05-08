// src/components/admin/AdminLayout.js
import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAutoCleanup } from "../../hooks/useAutoCleanup";
import toast from "react-hot-toast";

const NAV = [
  { path:"/admin",            label:"Dashboard",     icon:<DashIcon/>,   end:true },
  { path:"/admin/assign",     label:"Assign Today",  icon:<AssignIcon/>  },
  { path:"/admin/products",   label:"Products",      icon:<ProductIcon/> },
  { path:"/admin/customers",  label:"Shops",         icon:<ShopIcon/>    },
  { path:"/admin/cars",       label:"Cars / Routes", icon:<CarIcon/>     },
  { path:"/admin/users",      label:"Users",         icon:<UserIcon/>    },
  { path:"/admin/returns",    label:"Return Scanner",icon:<ReturnIcon/>  },
  { path:"/admin/reports",    label:"Sales Reports", icon:<ReportIcon/>  },
];

export default function AdminLayout() {
  const { profile, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen]       = useState(false);
  const [desktop, setDesktop] = useState(window.innerWidth >= 768);

  // Auto-cleanup old data once per day (client-side, Spark plan safe)
  useAutoCleanup({ enabled: profile?.role === "admin" });

  useEffect(() => {
    const h = () => setDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => { if (!desktop) setOpen(false); }, [location.pathname, desktop]);

  const handleLogout = async () => {
    await logout(); navigate("/login"); toast.success("Logged out");
  };

  const sidebar = (
    <>
      {/* Logo */}
      <div style={S.sideHeader}>
        <BrandLogo />
        <div style={{flex:1, minWidth:0}} />
        {!desktop && (
          <button style={S.closeBtn} onClick={() => setOpen(false)}>✕</button>
        )}
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} end={item.end}
            style={({ isActive }) => ({
              ...S.navItem,
              background: isActive ? "rgba(228,185,80,0.13)" : "transparent",
              borderLeft: isActive ? "2px solid #E4B950" : "2px solid transparent",
              color: isActive ? "#E4B950" : "rgba(255,255,255,0.42)",
            })}>
            <span style={{flexShrink:0}}>{item.icon}</span>
            <span style={S.navLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={S.sideFooter}>
        <div style={S.userRow}>
          <div style={S.avatar}>{(profile?.name||"A")[0].toUpperCase()}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={S.userName}>{profile?.name||"Admin"}</div>
            <div style={S.userRole}>Administrator</div>
          </div>
        </div>
        <button style={S.logoutBtn} onClick={handleLogout}>Sign Out</button>
      </div>
    </>
  );

  return (
    <div style={S.root}>
      {/* Desktop sidebar */}
      {desktop && <aside style={S.sidebar}>{sidebar}</aside>}

      {/* Mobile backdrop */}
      {!desktop && open && (
        <div style={S.backdrop} onClick={() => setOpen(false)}/>
      )}

      {/* Mobile drawer */}
      {!desktop && (
        <aside style={{...S.drawer, transform: open ? "translateX(0)" : "translateX(-100%)"}}>
          {sidebar}
        </aside>
      )}

      {/* Main */}
      <div style={S.main}>
        <header style={S.topbar}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            {!desktop && (
              <button style={S.hamburger} onClick={() => setOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M2 4h14M2 9h14M2 14h14" stroke="#E4B950" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <span style={S.topTitle}>Admin Panel</span>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <span style={S.topUser}><UserSvgIcon/> {profile?.name || "Admin"}</span>
            {desktop && (
              <button style={S.topLogoutBtn} onClick={handleLogout}>Sign Out</button>
            )}
          </div>
        </header>
        <div style={S.content}><Outlet /></div>
      </div>
    </div>
  );
}

// ── Brand logo — no image file needed ─────────────────────
function BrandLogo() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:36,height:36,borderRadius:10,background:"rgba(228,185,80,0.15)",
        border:"1px solid rgba(228,185,80,0.35)",display:"flex",alignItems:"center",
        justifyContent:"center",flexShrink:0}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 18V5l12-2v13" stroke="#E4B950" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="6" cy="18" r="3" stroke="#E4B950" strokeWidth="1.6"/>
          <circle cx="18" cy="16" r="3" stroke="#E4B950" strokeWidth="1.6"/>
        </svg>
      </div>
      <div>
        <div style={{fontFamily:"'Lora',serif",color:"#E4B950",fontSize:13,fontWeight:600,
          letterSpacing:"0.3px",lineHeight:1.2}}>Dough-Re-Mi</div>
        <div style={{color:"rgba(255,255,255,0.28)",fontSize:9,letterSpacing:"2px",
          textTransform:"uppercase",marginTop:2}}>Bakery</div>
      </div>
    </div>
  );
}

// Icon components
function DashIcon()   { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M1 9h6V1H1v8zm0 6h6v-4H1v4zm8 0h6V7H9v8zm0-14v4h6V1H9z" fill="currentColor"/></svg>; }
function AssignIcon() { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 2h10v2H3V2zm0 4h10v2H3V6zm0 4h7v2H3v-2z" fill="currentColor"/></svg>; }
function ProductIcon(){ return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2l5 3-5 3L3 6l5-3z" fill="currentColor"/></svg>; }
function ShopIcon()   { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 13V7l6-5 6 5v6H2zm4 0v-4h4v4H6z" fill="currentColor"/></svg>; }
function CarIcon()    { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 7l1-3h8l1 3H3zm-1 1h12v4H2V8zM4 13a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/></svg>; }
function UserIcon()   { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1a3 3 0 100 6 3 3 0 000-6zm-5 9a5 5 0 0110 0H3z" fill="currentColor"/></svg>; }
function ReturnIcon() { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 8h8a3 3 0 010 6H6v-2h4a1 1 0 000-2H2V8zm0 0V3l4 4-4 1z" fill="currentColor"/></svg>; }
function DayIcon()    { return <svg width="14" height="14" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5" cy="11" r="1" fill="currentColor"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="11" cy="11" r="1" fill="currentColor"/></svg>; }
function ReportIcon() { return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M1 13h3v2H1v-2zm4-6h3v8H5V7zm4-3h3v11H9V4zm4-3h3v14h-3V1z" fill="currentColor"/></svg>; }
function UserSvgIcon(){ return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1a3 3 0 100 6 3 3 0 000-6zm-5 9a5 5 0 0110 0H3z" fill="currentColor"/></svg>; }

const FOREST = "#1C3829";
const HONEY  = "#E4B950";

const S = {
  root:         { display:"flex", minHeight:"100vh", fontFamily:"'DM Sans',sans-serif" },
  sidebar:      { width:224, flexShrink:0, background:FOREST, display:"flex", flexDirection:"column", minHeight:"100vh" },
  drawer:       { position:"fixed", top:0, left:0, width:240, height:"100vh", background:FOREST,
                  display:"flex", flexDirection:"column", zIndex:300,
                  transition:"transform 0.25s ease", boxShadow:"6px 0 32px rgba(0,0,0,0.35)" },
  backdrop:     { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:299 },
  sideHeader:   { display:"flex", alignItems:"center", gap:10, padding:"20px 16px 16px",
                  borderBottom:"1px solid rgba(228,185,80,0.12)" },
  closeBtn:     { background:"none", border:"none", color:"rgba(228,185,80,0.55)", fontSize:16, cursor:"pointer",
                  minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center",
                  touchAction:"manipulation", flexShrink:0 },
  nav:          { flex:1, padding:"14px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" },
  navItem:      { display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  borderRadius:7, textDecoration:"none", transition:"all 0.15s",
                  borderLeft:"2px solid transparent" },
  navLabel:     { fontSize:12, fontWeight:500, color:"inherit", whiteSpace:"nowrap" },
  sideFooter:   { padding:"14px 12px", borderTop:"1px solid rgba(228,185,80,0.1)",
                  paddingBottom:"max(14px, env(safe-area-inset-bottom, 14px))" },
  userRow:      { display:"flex", alignItems:"center", gap:9, marginBottom:10 },
  avatar:       { width:30, height:30, borderRadius:"50%", background:"rgba(228,185,80,0.12)",
                  border:"1px solid rgba(228,185,80,0.28)", color:HONEY,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:600, flexShrink:0 },
  userName:     { color:"rgba(255,255,255,0.72)", fontSize:12, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  userRole:     { color:"rgba(255,255,255,0.28)", fontSize:10, letterSpacing:"0.5px" },
  logoutBtn:    { width:"100%", background:"none", border:"1px solid rgba(228,185,80,0.22)",
                  color:"rgba(228,185,80,0.65)", borderRadius:7, padding:"10px 8px",
                  cursor:"pointer", fontSize:12, letterSpacing:"0.3px",
                  fontFamily:"'DM Sans',sans-serif", minHeight:44, touchAction:"manipulation" },
  main:         { flex:1, display:"flex", flexDirection:"column", background:"#FAFAF7", minWidth:0 },
  topbar:       { background:"#FFFFFF", padding:"12px 20px", display:"flex",
                  alignItems:"center", justifyContent:"space-between",
                  borderBottom:"1px solid #E8E4DC", flexShrink:0 },
  hamburger:    { background:"none", border:"none", cursor:"pointer",
                  minWidth:44, minHeight:44, margin:"-10px -4px",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  touchAction:"manipulation" },
  topTitle:     { fontFamily:"'Lora',serif", fontWeight:600, fontSize:16, color:FOREST },
  topUser:      { fontSize:12, color:"#6B6B6B", display:"flex", alignItems:"center", gap:6 },
  topLogoutBtn: { background:FOREST, color:HONEY, border:"none",
                  borderRadius:7, padding:"7px 16px", cursor:"pointer",
                  fontSize:12, fontWeight:500, fontFamily:"'DM Sans',sans-serif" },
  content:      { flex:1, padding:20, overflowY:"auto" },
};
