// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useAutoLogout } from "./hooks/useAutoLogout";
import InactivityWarning from "./components/shared/InactivityWarning";

import LoginPage           from "./pages/LoginPage";
import AdminLayout         from "./components/admin/AdminLayout";
import AssignPage          from "./pages/admin/AssignPage";
import ReportsPage         from "./pages/admin/ReportsPage";
import CarsPage            from "./pages/admin/CarsPage";
import UsersPage           from "./pages/admin/UsersPage";
import ProductsPage        from "./pages/admin/ProductsPage";
import ShopsPage           from "./pages/admin/ShopsPage";
import DayReportsAdminPage  from "./pages/admin/DayReportsAdminPage";
import ReturnScannerPage   from "./pages/admin/ReturnScannerPage";
import DashboardPage        from "./pages/admin/DashboardPage";
import SalePage            from "./pages/salesperson/SalePage";
import AssignmentPage      from "./pages/salesperson/AssignmentPage";
import SpReturnScannerPage from "./pages/salesperson/SpReturnScannerPage";

function PagePlaceholder({ title }) {
  return (
    <div style={{ textAlign:"center", marginTop:80, color:"#5C3317" }}>
      <div style={{ fontSize:48 }}>🚧</div>
      <h2 style={{ marginTop:16 }}>{title}</h2>
      <p style={{ color:"#888" }}>Coming soon</p>
    </div>
  );
}
const Dashboard = DashboardPage;

function SpLayout() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]               = React.useState("assignment");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const TABS = [
    { key:"assignment", label:"Assignment",
      icon:<svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 2h10v2H3V2zm0 4h10v2H3V6zm0 4h7v2H3v-2z" fill="currentColor"/></svg> },
    { key:"sale",       label:"Sell",
      icon:<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 13V7l6-5 6 5v6H2zm4 0v-4h4v4H6z" fill="currentColor"/></svg> },
    { key:"returns",    label:"Returns",
      icon:<svg width="14" height="14" viewBox="0 0 16 16"><path d="M5.5 3L2 6.5 5.5 10V7.5h5a3 3 0 0 1 0 6H6v2h4.5A5 5 0 0 0 10.5 5.5H5.5V3z" fill="currentColor"/></svg> },
  ];

  const FOREST = "#1C3829";
  const HONEY  = "#E4B950";

  return (
    <div style={{minHeight:"100vh",background:"#FAFAF7",display:"flex",flexDirection:"column",position:"relative",fontFamily:"'DM Sans',sans-serif"}}>

      {/* Topbar */}
      <header style={{background:FOREST,padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setDrawerOpen(true)}
            style={{background:"none",border:"none",cursor:"pointer",
              minWidth:44,minHeight:44,display:"flex",alignItems:"center",
              justifyContent:"center",touchAction:"manipulation",margin:"-8px 0"}}>
            <svg width="20" height="20" viewBox="0 0 18 18">
              <path d="M2 4h14M2 9h14M2 14h14" stroke={HONEY} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {/* inline brand — no image needed */}
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13" stroke={HONEY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke={HONEY} strokeWidth="1.8"/>
              <circle cx="18" cy="16" r="3" stroke={HONEY} strokeWidth="1.8"/>
            </svg>
            <span style={{fontFamily:"'Lora',serif",fontSize:14,color:HONEY,fontWeight:600}}>Dough-Re-Mi</span>
          </div>
        </div>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{profile?.name}</span>
      </header>

      {/* Backdrop */}
      {drawerOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:299}}
          onClick={()=>setDrawerOpen(false)}/>
      )}

      {/* Left drawer */}
      <div style={{
        position:"fixed",top:0,left:0,bottom:0,width:220,
        background:FOREST,zIndex:300,display:"flex",flexDirection:"column",
        transform:drawerOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.25s ease",boxShadow:"6px 0 32px rgba(0,0,0,0.35)"
      }}>
        {/* Logo header */}
        <div style={{padding:"16px 16px 14px",borderBottom:"1px solid rgba(228,185,80,0.12)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(228,185,80,0.1)",
            border:"1px solid rgba(228,185,80,0.3)",display:"flex",alignItems:"center",
            justifyContent:"center",flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13" stroke={HONEY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke={HONEY} strokeWidth="1.8"/>
              <circle cx="18" cy="16" r="3" stroke={HONEY} strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Lora',serif",color:HONEY,fontSize:12,fontWeight:600}}>Dough-Re-Mi</div>
            <div style={{color:"rgba(255,255,255,0.28)",fontSize:10,letterSpacing:"1px"}}>{profile?.name}</div>
          </div>
          <button style={{background:"none",border:"none",color:"rgba(228,185,80,0.5)",
              fontSize:18,cursor:"pointer",minWidth:44,minHeight:44,
              display:"flex",alignItems:"center",justifyContent:"center",
              touchAction:"manipulation"}}
            onClick={()=>setDrawerOpen(false)}>✕</button>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2,
          overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          {TABS.map(t=>(
            <button key={t.key}
              style={{display:"flex",alignItems:"center",gap:10,padding:"14px 12px",
                minHeight:48,
                background:tab===t.key?"rgba(228,185,80,0.13)":"transparent",
                borderLeft:tab===t.key?`2px solid ${HONEY}`:"2px solid transparent",
                border:"none",borderRadius:7,cursor:"pointer",textAlign:"left",
                color:tab===t.key?HONEY:"rgba(255,255,255,0.42)",
                fontFamily:"'DM Sans',sans-serif",touchAction:"manipulation"}}
              onClick={()=>{setTab(t.key);setDrawerOpen(false);}}>
              {t.icon}
              <span style={{fontSize:13,fontWeight:500,color:"inherit"}}>{t.label}</span>
            </button>
          ))}
        </nav>

        <div style={{borderTop:"1px solid rgba(228,185,80,0.1)",
          padding:"14px 12px",
          paddingBottom:"max(16px, env(safe-area-inset-bottom, 16px))"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(228,185,80,0.1)",
              border:"1px solid rgba(228,185,80,0.25)",color:HONEY,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>
              {(profile?.name||"S")[0].toUpperCase()}
            </div>
            <div>
              <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontWeight:500}}>{profile?.name}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>Salesperson</div>
            </div>
          </div>
          <button onClick={async()=>{ await logout(); navigate("/login"); }}
            style={{width:"100%",background:"rgba(228,185,80,0.08)",
              border:`1.5px solid rgba(228,185,80,0.28)`,
              color:HONEY,borderRadius:8,padding:"12px 8px",
              cursor:"pointer",fontSize:13,fontWeight:600,
              fontFamily:"'DM Sans',sans-serif",touchAction:"manipulation",
              minHeight:48}}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",minHeight:0,background:"#FAFAF7"}}>
        {tab==="assignment" && <AssignmentPage />}
        {tab==="sale"       && <SalePage />}
        {tab==="returns"    && <SpReturnScannerPage />}
      </div>
    </div>
  );
}

const LoadingScreen = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#FAFAF7"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontFamily:"'Lora',serif",fontSize:18,color:"#1C3829",marginBottom:8}}>Dough-Re-Mi Bakery</div>
      <div style={{fontSize:12,color:"#E4B950",letterSpacing:"1px"}}>Loading…</div>
    </div>
  </div>
);

function RequireAuth({ children, role }) {
  const { user, profile, loading } = useAuth();
  // loading=true means auth OR profile is still resolving — show spinner.
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;
  // Safety: profile null while user is set means AuthContext is mid-retry.
  // Show spinner rather than redirecting to /login (avoids redirect loops).
  if (!profile) return <LoadingScreen />;
  if (role && profile.role !== role) return <Navigate to="/login" replace />;
  return children;
}

// ── AUTO LOGOUT WRAPPER ──────────────────────────────────
function AutoLogoutWrapper({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = React.useState(false);
  const warningTimer = React.useRef(null);

  const handleLogout = React.useCallback(async () => {
    setWarning(false);
    await logout();
    navigate("/login");
    // Show message on login page
    sessionStorage.setItem("autoLogout", "1");
  }, [logout, navigate]);

  const handleWarn = React.useCallback(() => {
    setWarning(true);
  }, []);

  const handleReset = React.useCallback(() => {
    setWarning(false);
  }, []);

  useAutoLogout({
    onLogout: handleLogout,
    onWarn:   handleWarn,
    onReset:  handleReset,
    enabled:  !!user,
  });

  return (
    <>
      {children}
      {/* Warning toast */}
      {warning && (
        <div style={{
          position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
          background:"#5C3317", color:"#fff", borderRadius:12,
          padding:"14px 24px", zIndex:9999, fontSize:14, fontWeight:600,
          boxShadow:"0 4px 20px rgba(0,0,0,0.3)", display:"flex",
          alignItems:"center", gap:14, maxWidth:340, width:"calc(100% - 32px)"
        }}>
          <span style={{fontSize:22}}>⏱</span>
          <div style={{flex:1}}>
            <div>Session expiring soon</div>
            <div style={{fontSize:12,fontWeight:400,opacity:0.8,marginTop:2}}>
              You'll be logged out in 5 minutes due to inactivity
            </div>
          </div>
          <button
            style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",
              borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:600}}
            onClick={handleReset}>
            Stay
          </button>
        </div>
      )}
    </>
  );
}

function RootRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading)  return <LoadingScreen />;
  if (!user)    return <Navigate to="/login" replace />;
  // Safety: profile null while user is set = AuthContext still retrying.
  // Never redirect to /login here — it creates a redirect loop with LoginPage.
  if (!profile) return <LoadingScreen />;
  if (profile.role==="admin")       return <Navigate to="/admin" replace />;
  if (profile.role==="salesperson") return <Navigate to="/sale"  replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ duration:3000 }} />
        <AutoLogoutWrapper>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
            <Route index              element={<Dashboard />} />
            <Route path="assign"      element={<AssignPage />} />
            <Route path="products"    element={<ProductsPage />} />
            <Route path="customers"   element={<ShopsPage />} />
            <Route path="cars"        element={<CarsPage />} />
            <Route path="users"       element={<UsersPage />} />
            <Route path="dayreports"   element={<DayReportsAdminPage />} />
            <Route path="returns"     element={<ReturnScannerPage />} />
            <Route path="reports"     element={<ReportsPage />} />
          </Route>
          <Route path="/sale" element={<RequireAuth role="salesperson"><SpLayout /></RequireAuth>} />
          <Route path="*"     element={<RootRedirect />} />
        </Routes>
        </AutoLogoutWrapper>
      </BrowserRouter>
    </AuthProvider>
  );
}
