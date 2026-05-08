// src/pages/salesperson/SpReturnScannerPage.js
// Salesperson Return Scanner — scan-only, no cost display, no editing, auto-syncs to admin
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { todayStr, formatDisplay } from "../../utils/helpers";
import {
  getAllProducts, getSalesByDateAndCar, getAssignment,
  saveReturnScanByCar, getReturnScanByCar,
} from "../../services/firestoreService";
import BarcodeScanner from "../../components/shared/BarcodeScanner";
import toast from "react-hot-toast";

const COLORS = {
  pending:    { bg:"#F1EFE8", color:"#6B6B6B",  label:"Pending"  },
  partial:    { bg:"rgba(201,168,76,0.12)", color:"#A67C3A", label:"Partial"  },
  match:      { bg:"rgba(26,26,46,0.08)",   color:"#1A1A2E", label:"Match ✓"  },
  over:       { bg:"rgba(201,168,76,0.15)", color:"#A67C3A", label:"Over"     },
  unexpected: { bg:"#FEF2F2", color:"#A32D2D", label:"Not in list" },
};

const getStatus = (s, e) => {
  if (e === 0) return "unexpected";
  if (s === 0) return "pending";
  if (s < e)   return "partial";
  if (s === e) return "match";
  return "over";
};

export default function SpReturnScannerPage() {
  const { profile } = useAuth();
  const today = todayStr();

  const [products,    setProducts]    = useState([]);
  const [sales,       setSales]       = useState([]);
  const [assignment,  setAssignment]  = useState(null);
  const [scannedReturns,   setScannedReturns]   = useState([]);
  const [scannedRemaining, setScannedRemaining] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode,    setScanMode]    = useState("returns"); // "returns" | "remaining"
  const scanModeRef   = useRef("returns");
  const [activeTab,   setActiveTab]   = useState("returns");
  const [saving,      setSaving]      = useState(false);
  const [hasSaved,    setHasSaved]    = useState(false);
  const [loading,     setLoading]     = useState(true);

  React.useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  const load = useCallback(async () => {
    if (!profile?.carId) return;
    setLoading(true);
    const [p, s, a, saved] = await Promise.all([
      getAllProducts(),
      getSalesByDateAndCar(today, profile.carId),
      getAssignment(today, profile.carId),
      getReturnScanByCar(today, profile.carId),
    ]);
    setProducts(p);
    setSales(s);
    setAssignment(a);
    if (saved?.items?.length)         { setScannedReturns(saved.items);   setHasSaved(true); }
    else                              { setScannedReturns([]);            setHasSaved(false); }
    if (saved?.remainingItems?.length) setScannedRemaining(saved.remainingItems);
    else                               setScannedRemaining([]);
    setLoading(false);
  }, [profile, today]);

  useEffect(() => { load(); }, [load]);

  // ── Build product lookup ──────────────────────────────
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  // ── Expected returns from today's sales ───────────────
  const expectedReturns = React.useMemo(() => {
    const map = {};
    sales.forEach(sale => {
      (sale.items||[]).forEach(item => {
        const rq = parseInt(item.returnQty,10)||0;
        if (rq <= 0) return;
        if (!map[item.productId]) map[item.productId] = {
          productId: item.productId, productName: item.productName,
          pricePerPiece: item.pricePerPiece || 0, // stored for admin, hidden from SP UI
          totalExpected: 0, shops: [],
        };
        map[item.productId].totalExpected += rq;
        // Include carName & salesperson so admin CSV is populated correctly
        map[item.productId].shops.push({
          shopName:    sale.shopName,
          carName:     sale.carName     || "",
          salesperson: sale.salespersonName || "",
          returnQty:   rq,
        });
      });
    });
    return Object.values(map);
  }, [sales]);

  // ── Expected remaining (assigned − sold) ─────────────
  const remainingStock = React.useMemo(() => {
    const soldMap = {};
    sales.forEach(sale => {
      (sale.items||[]).forEach(item => {
        const key = item.productId;
        if (!soldMap[key]) soldMap[key] = { sold:0, productName: item.productName };
        soldMap[key].sold += parseInt(item.saleQty,10)||0;
      });
    });
    const result = [];
    Object.entries(assignment?.items||{}).forEach(([productId, assignedQty]) => {
      const s   = soldMap[productId] || {};
      const rem = assignedQty - (s.sold||0);
      if (rem > 0) {
        const prod = productMap[productId];
        result.push({
          productId,
          productName: s.productName || prod?.name || productId,
          assignedQty,
          soldQty:      s.sold||0,
          remainingQty: rem,
        });
      }
    });
    return result;
  }, [sales, assignment, productMap]);

  const remainingStockRef = useRef([]);
  useEffect(() => { remainingStockRef.current = remainingStock; }, [remainingStock]);

  // ── Scan handler — scan only, no edit ────────────────
  const handleBarcode = useCallback((code) => {
    setShowScanner(false);
    const product = products.find(p => String(p.barcode) === String(code));
    if (!product) { toast.error(`Barcode not found: ${code}`); return; }

    if (scanModeRef.current === "remaining") {
      setScannedRemaining(prev => {
        const rem    = remainingStockRef.current?.find(r => r.productId === product.id);
        const exists = prev.find(r => r.productId === product.id);
        const newQty = (exists?.scannedQty||0) + 1;
        const expQty = rem?.remainingQty || 0;
        const status = getStatus(newQty, expQty);
        if (status === "match") toast.success(`${product.name} — exact match!`);
        else toast(`+1 ${product.name} (${newQty}/${expQty})`, { duration: 1500 });
        if (exists) return prev.map(r => r.productId===product.id ? {...r,scannedQty:newQty,status} : r);
        return [...prev, {
          productId: product.id, productName: product.name,
          scannedQty: 1, expectedQty: expQty, status, isRemaining: true,
        }];
      });
      return;
    }

    // Returns mode
    const expected = expectedReturns.find(r => r.productId === product.id);
    setScannedReturns(prev => {
      const exists = prev.find(r => r.productId === product.id);
      const newQty = (exists?.scannedQty||0) + 1;
      const expQty = expected?.totalExpected || 0;
      const status = getStatus(newQty, expQty);
      if (status === "unexpected") toast.error(`${product.name} — not in return list!`);
      else if (status === "match") toast.success(`${product.name} — exact match!`);
      else toast(`+1 ${product.name} (${newQty}/${expQty})`, { duration: 1500 });
      if (exists) return prev.map(r => r.productId===product.id ? {...r,scannedQty:newQty,status} : r);
      return [...prev, {
        productId: product.id, productName: product.name,
        pricePerPiece: expected?.pricePerPiece || 0, // hidden from SP UI; used by admin for Ks values
        scannedQty: 1, expectedQty: expQty, status,
        shops: expected?.shops || [],
      }];
    });
  }, [products, expectedReturns]);

  const saveProgress = async () => {
    if (!profile?.carId) return;
    setSaving(true);
    try {
      await saveReturnScanByCar(
        today, profile.carId, scannedReturns, scannedRemaining,
        { carName: assignment?.carName || profile.carId, salespersonName: profile.name || "" }
      );
      setHasSaved(true);
      toast.success("Synced to admin — saved!");
    } catch(err) { toast.error("Save failed: " + err.message); }
    finally { setSaving(false); }
  };

  const totalExpected = expectedReturns.reduce((s,r)=>s+r.totalExpected,0);
  const totalScanned  = scannedReturns.reduce((s,r)=>s+(r.scannedQty||0),0);
  const totalRemain   = remainingStock.reduce((s,r)=>s+r.remainingQty,0);
  const totalScannedRem = scannedRemaining.reduce((s,r)=>s+(r.scannedQty||0),0);

  if (!profile?.carId) return (
    <div style={S.center}>
      <p style={{color:"#C4B5A5"}}>No car assigned to your account.</p>
    </div>
  );

  if (loading) return (
    <div style={S.center}><p style={{color:"#C4B5A5"}}>Loading…</p></div>
  );

  return (
    <div style={S.root}>
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcode}
          onClose={() => setShowScanner(false)}
          title={`Scan ${scanMode==="remaining"?"Remaining":"Returns"}`}
        />
      )}

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.pageTitle}>Return Scanner</div>
          <div style={S.pageSub}>{formatDisplay(today)} · {assignment?.carName || profile.carId}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={S.scanBtn} onClick={() => setShowScanner(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="5" height="14" rx="1" stroke="#C9A84C" strokeWidth="1.3"/>
              <rect x="8" y="1" width="2" height="14" rx="0.5" stroke="#C9A84C" strokeWidth="1.3"/>
              <rect x="12" y="1" width="3" height="14" rx="0.5" stroke="#C9A84C" strokeWidth="1.3"/>
            </svg>
            Scan {scanMode==="remaining"?"Remaining":"Returns"}
          </button>
          <button
            style={{...S.saveBtn, opacity: saving?0.6:1}}
            onClick={saveProgress} disabled={saving}>
            {saving ? "Syncing…" : hasSaved ? "Sync Again" : "Sync to Admin"}
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={S.pills}>
        <div style={S.pill}>
          <span style={S.pillVal}>{totalScanned}/{totalExpected}</span>
          <span style={S.pillLabel}>Returns scanned</span>
        </div>
        <div style={S.pill}>
          <span style={S.pillVal}>{totalScannedRem}/{totalRemain}</span>
          <span style={S.pillLabel}>Remaining scanned</span>
        </div>
        {hasSaved && (
          <div style={{...S.pill, background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)"}}>
            <span style={{fontSize:11,color:"#A67C3A",fontWeight:600}}>Synced to admin</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={{...S.tab, ...(activeTab==="returns"?S.tabActive:{})}}
          onClick={() => { setActiveTab("returns"); setScanMode("returns"); }}>
          Returns ({expectedReturns.length} products)
        </button>
        <button style={{...S.tab, ...(activeTab==="remaining"?S.tabActive:{})}}
          onClick={() => { setActiveTab("remaining"); setScanMode("remaining"); }}>
          Remaining ({remainingStock.length} products)
        </button>
      </div>

      {/* Content */}
      {activeTab === "returns" ? (
        <div style={S.cols}>
          {/* Expected */}
          <div style={S.panel}>
            <div style={S.panelTitle}>Expected Returns</div>
            {expectedReturns.length === 0 ? (
              <div style={S.empty}>No returns recorded in today's sales</div>
            ) : expectedReturns.map((r,i) => {
              const sc  = scannedReturns.find(s=>s.productId===r.productId);
              const sq  = sc?.scannedQty||0;
              const pct = r.totalExpected>0 ? Math.min(100,Math.round((sq/r.totalExpected)*100)) : 0;
              return (
                <div key={i} style={S.card}>
                  <div style={S.cardRow}>
                    <div style={S.cardName}>{r.productName}</div>
                    <div style={{fontWeight:700,color:"#1A1A2E",fontSize:13}}>{sq}/{r.totalExpected} pcs</div>
                  </div>
                  <div style={S.progressBg}>
                    <div style={{...S.progressFill, width:`${pct}%`,
                      background: pct===100?"#1A1A2E":"#C9A84C"}}/>
                  </div>
                  {r.shops.map((sh,j) => (
                    <div key={j} style={S.shopLine}>
                      <span>{sh.shopName}</span>
                      <span style={{fontWeight:600}}>{sh.returnQty} pcs</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Scanned */}
          <div style={S.panel}>
            <div style={S.panelTitle}>
              Scanned Returns
              {hasSaved && <span style={S.syncBadge}>Synced</span>}
            </div>
            {scannedReturns.length === 0 ? (
              <div style={S.empty}>Tap Scan to start scanning returns</div>
            ) : scannedReturns.map((r,i) => {
              const cm = COLORS[r.status]||COLORS.pending;
              return (
                <div key={i} style={{...S.scannedCard, borderLeft:`3px solid ${cm.color}`}}>
                  <div style={S.cardRow}>
                    <div style={S.cardName}>{r.productName}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{...S.badge, background:cm.bg, color:cm.color}}>{cm.label}</span>
                      <span style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.scannedQty}</span>
                    </div>
                  </div>
                  <div style={S.cardSub}>Expected: {r.expectedQty} pcs</div>
                  {r.status==="match"      && <div style={S.matchMsg}>Matches report!</div>}
                  {r.status==="unexpected" && <div style={S.warnMsg}>Not in today's return list.</div>}
                  {r.status==="over"       && <div style={S.warnMsg}>Scanned more than expected.</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Remaining tab */
        <div style={S.cols}>
          {/* Expected remaining */}
          <div style={S.panel}>
            <div style={S.panelTitle}>Expected Remaining</div>
            {remainingStock.length === 0 ? (
              <div style={S.empty}>No remaining stock — all sold!</div>
            ) : remainingStock.map((r,i) => {
              const sc  = scannedRemaining.find(s=>s.productId===r.productId);
              const sq  = sc?.scannedQty||0;
              const pct = r.remainingQty>0 ? Math.min(100,Math.round((sq/r.remainingQty)*100)) : 0;
              return (
                <div key={i} style={S.card}>
                  <div style={S.cardRow}>
                    <div style={S.cardName}>{r.productName}</div>
                    <div style={{fontWeight:700,color:"#1A1A2E",fontSize:13}}>{sq}/{r.remainingQty} pcs</div>
                  </div>
                  <div style={S.progressBg}>
                    <div style={{...S.progressFill, width:`${pct}%`,
                      background: pct===100?"#1A1A2E":"#C9A84C"}}/>
                  </div>
                  <div style={S.cardSub}>Assigned: {r.assignedQty} · Sold: {r.soldQty}</div>
                </div>
              );
            })}
          </div>

          {/* Scanned remaining */}
          <div style={S.panel}>
            <div style={S.panelTitle}>Scanned Remaining</div>
            {scannedRemaining.length === 0 ? (
              <div style={S.empty}>Tap Scan to verify remaining stock</div>
            ) : scannedRemaining.map((r,i) => {
              const cm = COLORS[r.status]||COLORS.pending;
              return (
                <div key={i} style={{...S.scannedCard, borderLeft:`3px solid ${cm.color}`}}>
                  <div style={S.cardRow}>
                    <div style={S.cardName}>{r.productName}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{...S.badge, background:cm.bg, color:cm.color}}>{cm.label}</span>
                      <span style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.scannedQty}</span>
                    </div>
                  </div>
                  <div style={S.cardSub}>Expected: {r.expectedQty} pcs</div>
                  {r.status==="match" && <div style={S.matchMsg}>Matches expected!</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:        { fontFamily:"'Inter',sans-serif", padding:"0 0 40px" },
  center:      { display:"flex", alignItems:"center", justifyContent:"center", height:200 },
  header:      { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"12px 12px 8px", flexWrap:"wrap", gap:10 },
  pageTitle:   { fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#1A1A2E" },
  pageSub:     { fontSize:11, color:"#6B6B6B", marginTop:2 },
  scanBtn:     { background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:8, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:7 },
  saveBtn:     { background:"rgba(201,168,76,0.12)", color:"#A67C3A", border:"1.5px solid #C9A84C", borderRadius:8, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600 },
  pills:       { display:"flex", gap:8, padding:"4px 12px 10px", flexWrap:"wrap" },
  pill:        { background:"#fff", border:"1px solid #E5DDD0", borderRadius:8, padding:"8px 14px", display:"flex", flexDirection:"column", alignItems:"center" },
  pillVal:     { fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#1A1A2E" },
  pillLabel:   { fontSize:10, color:"#6B6B6B", marginTop:1, textTransform:"uppercase", letterSpacing:"0.5px" },
  syncBadge:   { fontSize:10, background:"rgba(201,168,76,0.15)", color:"#A67C3A", padding:"2px 8px", borderRadius:6, fontWeight:600, marginLeft:8 },
  tabs:        { display:"flex", borderBottom:"2px solid #E5DDD0", margin:"0 12px 14px" },
  tab:         { flex:1, padding:"10px 8px", border:"none", background:"transparent", fontSize:13, fontWeight:500, cursor:"pointer", color:"#6B6B6B", borderBottom:"2px solid transparent", marginBottom:-2 },
  tabActive:   { color:"#1A1A2E", borderBottom:"2px solid #C9A84C", fontWeight:700 },
  cols:        { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:10, padding:"0 12px" },
  panel:       { background:"#fff", borderRadius:8, padding:14, border:"1px solid #E5DDD0" },
  panelTitle:  { fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#1A1A2E", marginBottom:12, display:"flex", alignItems:"center" },
  card:        { background:"#FAF7F2", borderRadius:6, padding:"10px 12px", marginBottom:8 },
  cardRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 },
  cardName:    { fontWeight:600, fontSize:13, color:"#1A1A2E" },
  cardSub:     { fontSize:11, color:"#6B6B6B", marginTop:2 },
  progressBg:  { height:4, background:"#E5DDD0", borderRadius:2, overflow:"hidden", margin:"6px 0" },
  progressFill:{ height:4, borderRadius:2, transition:"width 0.3s" },
  shopLine:    { display:"flex", justifyContent:"space-between", fontSize:11, color:"#6B6B6B", padding:"2px 0" },
  scannedCard: { background:"#fff", borderRadius:6, padding:"10px 12px", marginBottom:8, border:"0.5px solid #F0E0CC" },
  badge:       { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6 },
  matchMsg:    { fontSize:11, color:"#1A1A2E", background:"rgba(26,26,46,0.06)", borderRadius:6, padding:"4px 8px", marginTop:4 },
  warnMsg:     { fontSize:11, color:"#A32D2D", background:"#FEF2F2", borderRadius:6, padding:"4px 8px", marginTop:4 },
  empty:       { textAlign:"center", color:"#C4B5A5", fontSize:12, padding:"20px 0" },
};
