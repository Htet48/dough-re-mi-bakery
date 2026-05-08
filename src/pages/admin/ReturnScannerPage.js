// src/pages/admin/ReturnScannerPage.js
import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { todayStr, formatDisplay, fmtNum, exportCSV } from "../../utils/helpers";
import {
  getAllProducts, getSalesByDate, getAssignmentsByDate,
  saveReturnScanByCar, getReturnScansByDate,
} from "../../services/firestoreService";
import BarcodeScanner from "../../components/shared/BarcodeScanner";

// ── Car icon SVG ─────────────────────────────────────────
function CarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
      <path d="M3 9l1.5-4.5h11L17 9" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export default function ReturnScannerPage() {
  const today = todayStr();
  const [date, setDate]               = useState(today);
  const [sales, setSales]             = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [products, setProducts]       = useState([]);
  const [allCarScans, setAllCarScans] = useState([]);     // per-car Firestore docs
  const [selectedCar, setSelectedCar] = useState(null);  // null = "All"
  const [scannedReturns, setScannedReturns]     = useState([]);
  const [scannedRemaining, setScannedRemaining] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode]       = useState("returns");
  const scanModeRef = React.useRef("returns");
  const [loading, setLoading]         = useState(false);
  const [activeTab, setActiveTab]     = useState("returns");
  const [saving, setSaving]           = useState(false);
  const [hasSaved, setHasSaved]       = useState(false);

  // ── Load data ────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [s, p, a, carScans] = await Promise.all([
      getSalesByDate(date),
      getAllProducts(),
      getAssignmentsByDate(date),
      getReturnScansByDate(date),
    ]);
    setSales(s);
    setProducts(p);
    setAssignments(a);
    setAllCarScans(carScans);
    setLoading(false);
  // eslint-disable-next-line
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // ── Sync scanned state when car selection or allCarScans changes ──
  useEffect(() => {
    if (!selectedCar) {
      // All cars: aggregate
      const allItems      = allCarScans.flatMap(cs => cs.items      || []);
      const allRemaining  = allCarScans.flatMap(cs => cs.remainingItems || []);
      setScannedReturns(allItems);
      setScannedRemaining(allRemaining);
      setHasSaved(false);
    } else {
      const cs = allCarScans.find(c => c.carId === selectedCar);
      setScannedReturns(cs?.items      || []);
      setScannedRemaining(cs?.remainingItems || []);
      setHasSaved(!!(cs?.items?.length || cs?.remainingItems?.length));
    }
  }, [selectedCar, allCarScans]);

  // ── Product lookup ───────────────────────────────────────
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  // ── Build unique car list from sales + existing scans ────
  // Sales carName takes priority over scan doc carName (sales are more reliable)
  const carsFromScans = allCarScans.map(cs => ({ carId: cs.carId, carName: cs.carName || cs.carId }));
  const carsFromSales = sales.map(s => ({ carId: s.carId, carName: s.carName || s.carId }));
  const allCars = [...new Map(
    [...carsFromScans, ...carsFromSales].map(c => [c.carId, c])
  ).values()].sort((a,b)=>a.carName.localeCompare(b.carName));

  // ── Filter sales & assignments by selected car ───────────
  const filteredSales       = selectedCar ? sales.filter(s => s.carId === selectedCar) : sales;
  const filteredAssignments = selectedCar ? assignments.filter(a => a.carId === selectedCar) : assignments;

  // ── EXPECTED RETURNS ────────────────────────────────────
  const expectedReturns = React.useMemo(() => {
    const map = {};
    filteredSales.forEach(sale => {
      (sale.items||[]).forEach(item => {
        const rq = parseInt(item.returnQty,10)||0;
        if (rq <= 0) return;
        if (!map[item.productId]) map[item.productId] = {
          productId: item.productId, productName: item.productName,
          pricePerPiece: item.pricePerPiece||0,
          totalExpected: 0, totalValue: 0, shops: [],
        };
        map[item.productId].totalExpected += rq;
        map[item.productId].totalValue    += rq*(item.pricePerPiece||0);
        map[item.productId].shops.push({
          shopName: sale.shopName, salesperson: sale.salespersonName,
          carName: sale.carName, returnQty: rq,
          value: rq*(item.pricePerPiece||0),
        });
      });
    });
    return Object.values(map);
  // eslint-disable-next-line
  }, [filteredSales]);

  // ── REMAINING STOCK ──────────────────────────────────────
  const remainingStock = React.useMemo(() => {
    const soldMap = {};
    filteredSales.forEach(sale => {
      (sale.items||[]).forEach(item => {
        const key = `${sale.carId}_${item.productId}`;
        if (!soldMap[key]) soldMap[key] = {
          sold:0, returned:0,
          carName:sale.carName, salesperson:sale.salespersonName,
          productName:item.productName, pricePerPiece:item.pricePerPiece||0, shops:[],
        };
        soldMap[key].sold     += parseInt(item.saleQty,10)   || 0;
        soldMap[key].returned += parseInt(item.returnQty,10) || 0;
        if ((parseInt(item.saleQty,10)||0)>0)
          soldMap[key].shops.push(`${sale.shopName}(${item.saleQty}pcs)`);
      });
    });
    const result = [];
    filteredAssignments.forEach(assignment => {
      Object.entries(assignment.items||{}).forEach(([productId, assignedQty]) => {
        const key = `${assignment.carId}_${productId}`;
        const s   = soldMap[key] || {};
        const sold      = s.sold     || 0;
        const returned  = s.returned || 0;
        const remaining = assignedQty - sold;
        if (Math.max(0, remaining) > 0) {
          const prod = productMap[productId];
          result.push({
            carId:       assignment.carId,
            carName:     assignment.carName || assignment.carId,
            salesperson: s.salesperson || "",
            productId,
            productName:    s.productName || prod?.name || productId,
            pricePerPiece:  s.pricePerPiece || prod?.price || 0,
            assignedQty,
            soldQty:        sold,
            returnedQty:    returned,
            remainingQty:   Math.max(0, remaining),
            remainingValue: Math.max(0, remaining) * (s.pricePerPiece || prod?.price || 0),
            shops:          s.shops || [],
          });
        }
      });
    });
    return result.sort((a,b) => b.remainingValue - a.remainingValue);
  // eslint-disable-next-line
  }, [filteredSales, filteredAssignments]);

  // Refs for handleBarcode closure
  const remainingStockRef = React.useRef([]);
  React.useEffect(() => { remainingStockRef.current = remainingStock; }, [remainingStock]);
  React.useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  // Keep latest handleBarcode + selectedCar in refs so the keydown listener
  // never goes stale without needing to be recreated on every render.
  const handleBarcodeRef  = React.useRef(null);
  const selectedCarRef    = React.useRef(selectedCar);
  const showScannerRef    = React.useRef(false);
  React.useEffect(() => { selectedCarRef.current = selectedCar; }, [selectedCar]);
  React.useEffect(() => { showScannerRef.current = showScanner; }, [showScanner]);

  // ── Global physical-scanner listener ─────────────────────
  // USB / Bluetooth HID scanners act as a keyboard: they type all chars
  // in < 80 ms then send Enter.  This listener captures that pattern
  // regardless of which element has focus — no "click to focus" needed.
  React.useEffect(() => {
    const buf = { v: "", t: null };
    const fn = (e) => {
      if (e.key === "Enter") {
        const code = buf.v.trim();
        buf.v = ""; clearTimeout(buf.t);
        if (code.length < 3) return;           // too short → human typed
        if (showScannerRef.current) return;    // camera modal handles its own scan
        if (!selectedCarRef.current) {
          toast.error("Select a car before scanning"); return;
        }
        handleBarcodeRef.current?.(code);
        return;
      }
      if (e.key.length === 1) {
        buf.v += e.key;
        clearTimeout(buf.t);
        buf.t = setTimeout(() => { buf.v = ""; }, 80);
      }
    };
    window.addEventListener("keydown", fn);
    return () => { window.removeEventListener("keydown", fn); clearTimeout(buf.t); };
  }, []); // empty — uses refs so never stale

  // ── Scan barcode ─────────────────────────────────────────
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
        showStatusToast(product.name, newQty, expQty, status);
        if (exists) return prev.map(r => r.productId===product.id ? {...r,scannedQty:newQty,status} : r);
        return [...prev, {
          productId: product.id, productName: product.name,
          pricePerPiece: rem?.pricePerPiece || product.price || 0,
          carName: rem?.carName || "",
          scannedQty: 1, expectedQty: expQty, status, isRemaining: true,
        }];
      });
      return;
    }

    const expected = expectedReturns.find(r => r.productId === product.id);
    setScannedReturns(prev => {
      const exists = prev.find(r => r.productId === product.id);
      const newQty = (exists?.scannedQty||0) + 1;
      const expQty = expected?.totalExpected || 0;
      const status = getStatus(newQty, expQty);
      showStatusToast(product.name, newQty, expQty, status);
      if (exists) return prev.map(r => r.productId===product.id ? {...r,scannedQty:newQty,status} : r);
      return [...prev, {
        productId: product.id, productName: product.name,
        pricePerPiece: expected?.pricePerPiece || product.price || 0,
        scannedQty: 1, expectedQty: expQty, status,
        shops: expected?.shops || [],
      }];
    });
  }, [products, expectedReturns]);
  // Keep ref in sync so the global keydown listener always calls latest version
  React.useEffect(() => { handleBarcodeRef.current = handleBarcode; }, [handleBarcode]);

  const getStatus = (s, e) => {
    if (e===0)  return "unexpected";
    if (s===0)  return "pending";
    if (s<e)    return "partial";
    if (s===e)  return "match";
    return "over";
  };

  const showStatusToast = (name, s, e, status) => {
    if (status==="unexpected") toast(`${name} — NOT in any return report!`, {icon:"⚠️",duration:4000,style:{background:"#FEE2E2",color:"#DC2626",fontWeight:600}});
    else if (status==="over")  toast(`${name} — Scanned ${s}, expected ${e}`, {icon:"⚠️",duration:3000,style:{background:"#FAF7F2",color:"#A67C3A",fontWeight:600}});
    else if (status==="match") toast.success(`${name} — Exact match!`);
    else toast(`+1 ${name} (${s}/${e})`, {duration:1500});
  };

  const stepScanned = (productId, delta) => {
    setScannedReturns(prev => prev.map(r => {
      if (r.productId !== productId) return r;
      const nq = Math.max(0, (r.scannedQty||0) + delta);
      return {...r, scannedQty:nq, status:getStatus(nq, r.expectedQty)};
    }));
  };

  const [qtyDrafts, setQtyDrafts] = useState({});
  const displayQty  = (r) => qtyDrafts[r.productId] !== undefined ? qtyDrafts[r.productId] : String(r.scannedQty||0);
  const handleQtyChange = (pid, raw) => setQtyDrafts(prev => ({...prev,[pid]:raw}));
  const handleQtyBlur   = (pid) => {
    const raw = qtyDrafts[pid]; if (raw===undefined) return;
    const qty = Math.max(0, parseInt(raw,10)||0);
    setScannedReturns(prev => prev.map(r => r.productId!==pid ? r : {...r,scannedQty:qty,status:getStatus(qty,r.expectedQty)}));
    setQtyDrafts(prev => { const n={...prev}; delete n[pid]; return n; });
  };

  // Remaining items — direct-type qty (same pattern as returns)
  const [remQtyDrafts, setRemQtyDrafts] = useState({});
  const displayRemQty     = (r) => remQtyDrafts[r.productId] !== undefined ? remQtyDrafts[r.productId] : String(r.scannedQty||0);
  const handleRemQtyChange = (pid, raw) => setRemQtyDrafts(prev => ({...prev,[pid]:raw}));
  const handleRemQtyBlur  = (pid) => {
    const raw = remQtyDrafts[pid]; if (raw===undefined) return;
    const qty = Math.max(0, parseInt(raw,10)||0);
    setScannedRemaining(prev => prev.map(r => r.productId!==pid ? r : {...r,scannedQty:qty,status:getStatus(qty,r.expectedQty)}));
    setRemQtyDrafts(prev => { const n={...prev}; delete n[pid]; return n; });
  };
  const stepRemaining = (pid, delta) => {
    setScannedRemaining(prev => prev.map(x => {
      if (x.productId !== pid) return x;
      const nq = Math.max(0, (x.scannedQty||0) + delta);
      return {...x, scannedQty:nq, status:getStatus(nq, x.expectedQty)};
    }));
    setRemQtyDrafts(prev => { const n={...prev}; delete n[pid]; return n; });
  };

  // ── Save ─────────────────────────────────────────────────
  const saveProgress = async () => {
    if (!selectedCar) { toast.error("Select a car first to save changes"); return; }
    setSaving(true);
    try {
      const carName = allCars.find(c=>c.carId===selectedCar)?.carName || selectedCar;
      await saveReturnScanByCar(date, selectedCar, scannedReturns, scannedRemaining);
      // Update local allCarScans cache
      setAllCarScans(prev => {
        const exists = prev.find(c=>c.carId===selectedCar);
        if (exists) return prev.map(c=>c.carId===selectedCar?{...c,items:scannedReturns,remainingItems:scannedRemaining}:c);
        return [...prev, {carId:selectedCar,carName,items:scannedReturns,remainingItems:scannedRemaining,date}];
      });
      setHasSaved(true);
      toast.success("Saved! Visible on all devices.");
    } catch(err) { toast.error("Save failed: " + err.message); }
    finally { setSaving(false); }
  };

  // ── CSV Exports ───────────────────────────────────────────
  const carTag = selectedCar
    ? `_${allCars.find(c=>c.carId===selectedCar)?.carName||selectedCar}`
    : "_AllCars";

  const exportVerification = () => {
    // Reliable car name: look up from allCars (built from sales+scans with
    // sales taking priority) — avoids showing raw Firestore doc IDs.
    const csvCarName = selectedCar
      ? (allCars.find(c => c.carId === selectedCar)?.carName || selectedCar)
      : "All Cars";

    const rows = scannedReturns.map(r => {
      // Price fallback chain: item-level → product master → 0
      // Mirrors the same fallback used in the Remaining CSV so both are consistent.
      const price  = Number(r.pricePerPiece) || productMap[r.productId]?.price || 0;
      const expQty = Number(r.expectedQty)   || 0;
      const scnQty = Number(r.scannedQty)    || 0;
      // Car / salesperson from shop-level data when available, else fall back
      // to the selected car name (never the raw car ID).
      const shopCars = r.shops?.map(s=>s.carName).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" | ");
      const shopSPs  = r.shops?.map(s=>s.salesperson).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" | ");
      // Fallback: derive salesperson from expectedReturns (built from sales docs which
      // always carry salespersonName). This covers cases where scanned items were loaded
      // from a Firestore scan doc that pre-dates the salesperson field being saved.
      const expectedEntry = expectedReturns.find(e => e.productId === r.productId);
      const fallbackSPs   = expectedEntry?.shops
        ?.map(s=>s.salesperson).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" | ") || "";
      return {
        date,
        car:           shopCars || csvCarName,
        salesperson:   shopSPs  || fallbackSPs,
        product:       r.productName,
        pricePerPiece: price,
        expectedQty:   expQty,
        expectedValue: expQty * price,
        scannedQty:    scnQty,
        scannedValue:  scnQty * price,
        difference:    scnQty - expQty,
        status:        r.status || "",
        shops:         r.shops?.map(s=>`${s.shopName}(${s.returnQty}pcs)`).join(" | ") || "",
      };
    });
    exportCSV(rows, `QB_Returns${carTag}_${date}.csv`);
    toast.success("Returns CSV exported!");
  };

  const exportRemaining = () => {
    const scanDoc = allCarScans.find(cs=>cs.carId===selectedCar);
    const docCar  = scanDoc?.carName         || selectedCar || "";
    const docSP   = scanDoc?.salespersonName || "";
    const rows = remainingStock.map(r => {
      const scanned = scannedRemaining.find(s=>s.productId===r.productId) || {};
      const price   = Number(r.pricePerPiece) || 0;
      const expQty  = Number(r.remainingQty)  || 0;
      const scnQty  = Number(scanned.scannedQty) || 0;
      return {
        date,
        car:           r.carName   || docCar,
        salesperson:   r.salesperson || docSP,
        product:       r.productName,
        pricePerPiece: price,
        assignedQty:   r.assignedQty,
        soldQty:       r.soldQty,
        expectedQty:   expQty,
        expectedValue: expQty * price,
        scannedQty:    scnQty,
        scannedValue:  scnQty * price,
        difference:    scnQty - expQty,
        status:        scanned.status || "pending",
        shops:         r.shops?.join(" | ") || "",
      };
    });
    exportCSV(rows, `QB_Remaining${carTag}_${date}.csv`);
    toast.success("Remaining CSV exported!");
  };

  // ── Derived totals ────────────────────────────────────────
  const totalExpQty      = expectedReturns.reduce((s,r)=>s+r.totalExpected,0);
  const totalExpValue    = expectedReturns.reduce((s,r)=>s+r.totalValue,0);
  const totalScannedQty  = scannedReturns.reduce((s,r)=>s+(r.scannedQty||0),0);
  const totalRemainQty   = remainingStock.reduce((s,r)=>s+r.remainingQty,0);
  const totalRemainValue = remainingStock.reduce((s,r)=>s+r.remainingValue,0);

  const statusMeta = {
    pending:    {bg:"#F1EFE8", color:"#6B6B6B",  label:"Pending"},
    partial:    {bg:"#FEF3DD", color:"#A67C3A",   label:"Partial"},
    match:      {bg:"#EAF4EE", color:"#2D7A4F",   label:"Match"},
    over:       {bg:"#FEF3DD", color:"#A67C3A",   label:"Over"},
    unexpected: {bg:"#FEE2E2", color:"#DC2626",   label:"Unexpected"},
  };

  const scanDisabled = !selectedCar;

  return (
    <div style={S.root}>
      {showScanner && <BarcodeScanner onDetected={handleBarcode} onClose={()=>setShowScanner(false)} title="Scan Return Barcode"/>}

      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Return Scanner</h2>
          <p style={S.sub}>Verify returns &amp; check remaining stock · Admin view</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={S.refreshBtn} onClick={load} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
              <path d="M13.5 2.5A6.5 6.5 0 1 1 7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13.5 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading?"Refreshing…":"Refresh"}
          </button>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
            <button style={{...S.scanBtn, opacity:scanDisabled?0.45:1}}
              onClick={()=>{ if(scanDisabled){toast.error("Select a car first");return;} setShowScanner(true); }}
              title={scanDisabled?"Select a car to enable scanning":"Scan barcode"}>
              📷 Camera Scan
            </button>
            <span style={{fontSize:10,color:selectedCar?"#2D7A4F":"#A67C3A",fontWeight:600,letterSpacing:"0.3px"}}>
              {selectedCar ? "🔌 USB/BT scanner: scan anytime" : "🔌 USB/BT: select a car first"}
            </span>
          </div>
          {selectedCar && (scannedReturns.length>0||scannedRemaining.length>0) && (
            <button style={{...S.exportBtn,background:saving?"#9E9E9E":"#1A1A2E",color:"#C9A84C"}}
              onClick={saveProgress} disabled={saving}>
              {saving?"Saving…":"Save"}
            </button>
          )}
          {activeTab==="returns" && scannedReturns.length>0 && (
            <button style={S.exportBtn} onClick={exportVerification}>Returns CSV</button>
          )}
          {activeTab==="remaining" && remainingStock.length>0 && (
            <button style={{...S.exportBtn,background:"#1A1A2E",color:"#C9A84C"}} onClick={exportRemaining}>Remaining CSV</button>
          )}
        </div>
      </div>

      {/* Date + summary */}
      <div style={S.topRow}>
        <div style={S.dateWrap}>
          <label style={S.dateLabel}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.datePicker}/>
        </div>
        <div style={S.sumCards}>
          <SumCard label="Expected returns" value={`${totalExpQty} pcs`} />
          <SumCard label="Expected value"   value={`${fmtNum(totalExpValue)} Ks`} />
          <SumCard label="Scanned so far"   value={`${totalScannedQty} pcs`} highlight={totalScannedQty===totalExpQty&&totalExpQty>0} />
          <SumCard label="Remaining stock"  value={`${totalRemainQty} pcs`} amber />
          <SumCard label="Remaining value"  value={`${fmtNum(totalRemainValue)} Ks`} amber />
        </div>
      </div>

      {/* Car filter */}
      <div style={S.carFilter}>
        <span style={S.carFilterLabel}>
          <CarIcon/> Filter by car
        </span>
        <div style={S.carBtnRow}>
          <button
            style={{...S.carBtn, ...(selectedCar===null?S.carBtnActive:S.carBtnInactive)}}
            onClick={()=>setSelectedCar(null)}>
            All Cars
            {allCarScans.length>0&&<span style={S.carBadge}>{allCarScans.length}</span>}
          </button>
          {allCars.map(car=>{
            const hasScan = allCarScans.some(cs=>cs.carId===car.carId);
            const active  = selectedCar===car.carId;
            return (
              <button key={car.carId}
                style={{...S.carBtn, ...(active?S.carBtnActive:S.carBtnInactive)}}
                onClick={()=>setSelectedCar(car.carId)}>
                <CarIcon/> {car.carName}
                {hasScan&&<span style={{...S.carBadge,background:"#C9A84C",color:"#1A1A2E"}}>synced</span>}
              </button>
            );
          })}
        </div>
        {selectedCar===null&&(
          <p style={{margin:"6px 0 0",fontSize:11,color:"#A67C3A"}}>
            Viewing aggregated data across all cars. Select a car to scan or edit items.
          </p>
        )}
      </div>

      {/* Tabs: Returns | Remaining */}
      <div style={S.tabs}>
        <button
          style={{...S.tabBtn, ...(activeTab==="returns"?S.tabBtnActive:S.tabBtnInactive)}}
          onClick={()=>{ setActiveTab("returns"); setScanMode("returns"); }}>
          <svg width="13" height="13" viewBox="0 0 16 16" style={{flexShrink:0}}>
            <path d="M5.5 3L2 6.5 5.5 10V7.5h5a3 3 0 0 1 0 6H6v2h4.5A5 5 0 0 0 10.5 5.5H5.5V3z" fill="currentColor"/>
          </svg>
          Returns ({expectedReturns.length} products)
        </button>
        <button
          style={{...S.tabBtn, ...(activeTab==="remaining"?S.tabBtnActive:S.tabBtnInactive)}}
          onClick={()=>{ setActiveTab("remaining"); setScanMode("remaining"); }}>
          <svg width="13" height="13" viewBox="0 0 16 16" style={{flexShrink:0}}>
            <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2zm0 4h5v2H2v-2z" fill="currentColor"/>
          </svg>
          Remaining ({remainingStock.length} items)
        </button>
      </div>

      {loading ? <p style={{color:"#6B6B6B",padding:20}}>Loading…</p> : (

      activeTab === "returns" ? (
        <div style={S.cols}>
          {/* LEFT: Expected */}
          <div style={S.panel}>
            <h3 style={S.panelTitle}>
              Expected Returns
              <span style={{fontSize:11,fontWeight:400,color:"#6B6B6B"}}>{formatDisplay(date)}</span>
            </h3>
            {expectedReturns.length===0 ? (
              <div style={S.empty}>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={{opacity:0.3,margin:"0 auto 8px",display:"block"}}>
                  <rect x="6" y="8" width="28" height="24" rx="3" stroke="#C4B5A5" strokeWidth="2"/>
                  <path d="M12 16h16M12 22h10" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p>No returns reported for {formatDisplay(date)}</p>
              </div>
            ) : expectedReturns.map((r,i) => {
              const scanned = scannedReturns.find(s=>s.productId===r.productId);
              const sq  = scanned?.scannedQty||0;
              const pct = r.totalExpected>0 ? Math.min(100,Math.round((sq/r.totalExpected)*100)) : 0;
              return (
                <div key={i} style={S.expectedCard}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.productName}</div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,color:"#1A1A2E"}}>{sq}/{r.totalExpected} pcs</div>
                      <div style={{fontSize:11,color:"#2D7A4F"}}>{fmtNum(r.totalValue)} Ks</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:"#6B6B6B",marginBottom:6}}>{fmtNum(r.pricePerPiece)} Ks/pc</div>
                  <div style={S.progressBg}>
                    <div style={{...S.progressBar,width:`${pct}%`,background:pct>=100?"#1A1A2E":"#C9A84C"}}/>
                  </div>
                  {r.shops.map((sh,j)=>(
                    <div key={j} style={S.shopRow}>
                      <span style={{color:"#6B6B6B",fontSize:11}}>{sh.shopName} · {sh.salesperson} · {sh.carName}</span>
                      <span style={{fontWeight:600,fontSize:12,color:"#1A1A2E"}}>{sh.returnQty} pcs · {fmtNum(sh.value)} Ks</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* RIGHT: Scanned */}
          <div style={S.panel}>
            <h3 style={S.panelTitle}>
              Scanned Returns
              {scannedReturns.length>0 && selectedCar && (
                <span style={S.clearAll}
                  onClick={()=>{if(window.confirm("Clear all scanned returns for this car?"))setScannedReturns([]);}}>
                  Clear
                </span>
              )}
            </h3>
            {hasSaved && selectedCar && (
              <div style={S.savedBadge}>Synced from salesperson — last save applied</div>
            )}
            {selectedCar===null && (
              <div style={{background:"#FEF3DD",border:"1px solid #E8D5C0",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#A67C3A",marginBottom:8}}>
                Viewing aggregate (all cars). Select a car to scan or edit.
              </div>
            )}
            {selectedCar && (
              <div style={{background:"#FAF7F2",border:"1px solid #E8D5C0",borderRadius:8,padding:"7px 12px",fontSize:11,color:"#6B6B6B",marginBottom:8}}>
                Admin can edit quantities and remove items. Salesperson synced data is loaded automatically.
              </div>
            )}
            {scannedReturns.length===0 ? (
              <div style={S.empty}>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={{opacity:0.3,margin:"0 auto 8px",display:"block"}}>
                  <rect x="4" y="4" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <rect x="22" y="4" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <rect x="4" y="22" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <path d="M27 27h9M31.5 22.5v9" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p>{selectedCar?"Scan to verify returns":"No scanned returns yet for any car"}</p>
              </div>
            ) : scannedReturns.map((r,i) => {
              const sm = statusMeta[r.status]||statusMeta.pending;
              return (
                <div key={i} style={{...S.scannedCard,borderLeft:`4px solid ${sm.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:6}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.productName}</div>
                      <div style={{fontSize:11,color:"#6B6B6B",marginTop:2}}>{fmtNum(r.pricePerPiece)} Ks/pc · Expected: {r.expectedQty}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <span style={{...S.statusBadge,background:sm.bg,color:sm.color}}>{sm.label}</span>
                      {selectedCar && (
                        <button style={S.removeBtn}
                          onClick={()=>setScannedReturns(prev=>prev.filter(x=>x.productId!==r.productId))}
                          title="Remove (admin only)">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedCar ? (
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{fontSize:12,color:"#6B6B6B",flexShrink:0}}>Scanned:</span>
                      <button style={S.qtyBtn} onClick={()=>stepScanned(r.productId,-1)}>−</button>
                      <input style={S.qtyInput} type="number" min={0}
                        value={displayQty(r)} onChange={e=>handleQtyChange(r.productId,e.target.value)}
                        onBlur={()=>handleQtyBlur(r.productId)} onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}/>
                      <button style={S.qtyBtn} onClick={()=>stepScanned(r.productId,+1)}>+</button>
                      <span style={{fontSize:12,color:"#1A1A2E",fontWeight:600}}>{fmtNum((r.scannedQty||0)*r.pricePerPiece)} Ks</span>
                    </div>
                  ) : (
                    <div style={{fontSize:13,fontWeight:700,color:"#1A1A2E",marginBottom:6}}>
                      Scanned: {r.scannedQty||0} pcs &nbsp;·&nbsp; {fmtNum((r.scannedQty||0)*r.pricePerPiece)} Ks
                    </div>
                  )}
                  {r.status==="unexpected" && <div style={S.warnBox}>Not in any return report.</div>}
                  {r.status==="over"       && <div style={S.warnBox}>Scanned {r.scannedQty} but expected {r.expectedQty}.</div>}
                  {r.status==="partial"    && <div style={{...S.warnBox,background:"#FEF3DD",color:"#A67C3A"}}>{r.scannedQty}/{r.expectedQty} scanned.</div>}
                  {r.status==="match"      && <div style={S.matchBox}>Matches report!</div>}
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        /* REMAINING STOCK TAB */
        <div style={S.cols}>
          {/* LEFT: Expected remaining */}
          <div style={S.panel}>
            <h3 style={S.panelTitle}>
              Expected Remaining
              <span style={{fontSize:11,fontWeight:400,color:"#6B6B6B"}}>Assigned − Sold</span>
            </h3>
            {remainingStock.length===0 ? (
              <div style={S.empty}>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={{opacity:0.3,margin:"0 auto 8px",display:"block"}}>
                  <circle cx="20" cy="20" r="16" stroke="#C4B5A5" strokeWidth="2"/>
                  <path d="M13 20l5 5 9-9" stroke="#C4B5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p>All sold — no remaining stock!</p>
              </div>
            ) : remainingStock.map((r,i)=>{
              const sc  = scannedRemaining.find(s=>s.productId===r.productId);
              const sq  = sc?.scannedQty||0;
              const pct = r.remainingQty>0?Math.min(100,Math.round((sq/r.remainingQty)*100)):0;
              return (
                <div key={i} style={S.expectedCard}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.productName}</div>
                      <div style={{fontSize:11,color:"#6B6B6B"}}>{r.carName} · {fmtNum(r.pricePerPiece)} Ks/pc</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,color:"#1A1A2E"}}>{sq}/{r.remainingQty} pcs</div>
                      <div style={{fontSize:11,color:"#1A1A2E"}}>{fmtNum(r.remainingValue)} Ks</div>
                    </div>
                  </div>
                  <div style={S.progressBg}>
                    <div style={{...S.progressBar,width:`${pct}%`,background:pct>=100?"#1A1A2E":"#C9A84C"}}/>
                  </div>
                  <div style={{fontSize:11,color:"#6B6B6B",marginTop:4}}>
                    Assigned:{r.assignedQty} · Sold:{r.soldQty} · Returned:{r.returnedQty}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Scanned remaining */}
          <div style={S.panel}>
            <h3 style={S.panelTitle}>
              Scanned Remaining
              {scannedRemaining.length>0 && selectedCar && (
                <span style={S.clearAll}
                  onClick={()=>{if(window.confirm("Clear scanned remaining for this car?"))setScannedRemaining([]);}}>
                  Clear
                </span>
              )}
            </h3>
            {selectedCar===null && scannedRemaining.length>0 && (
              <div style={{background:"#FEF3DD",border:"1px solid #E8D5C0",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#A67C3A",marginBottom:8}}>
                Viewing aggregate. Select a car to edit.
              </div>
            )}
            {scannedRemaining.length===0 ? (
              <div style={S.empty}>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={{opacity:0.3,margin:"0 auto 8px",display:"block"}}>
                  <rect x="4" y="4" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <rect x="22" y="4" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <rect x="4" y="22" width="14" height="14" rx="1" stroke="#C4B5A5" strokeWidth="2"/>
                  <path d="M27 27h9M31.5 22.5v9" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p>{selectedCar?"Scan to verify remaining stock":"No scanned remaining for any car"}</p>
              </div>
            ) : scannedRemaining.map((r,i)=>{
              const sm = statusMeta[r.status]||statusMeta.pending;
              return (
                <div key={i} style={{...S.scannedCard,borderLeft:`4px solid ${sm.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#1A1A2E"}}>{r.productName}</div>
                      <div style={{fontSize:11,color:"#6B6B6B"}}>{r.carName} · {fmtNum(r.pricePerPiece)} Ks/pc · Expected: {r.expectedQty}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{...S.statusBadge,background:sm.bg,color:sm.color}}>{sm.label}</span>
                      {selectedCar && (
                        <button style={S.removeBtn}
                          onClick={()=>setScannedRemaining(prev=>prev.filter(x=>x.productId!==r.productId))}
                          title="Remove (admin only)">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedCar ? (
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <button style={S.qtyBtn} onClick={()=>stepRemaining(r.productId,-1)}>−</button>
                      <input style={S.qtyInput} type="number" min={0}
                        value={displayRemQty(r)}
                        onChange={e=>handleRemQtyChange(r.productId,e.target.value)}
                        onBlur={()=>handleRemQtyBlur(r.productId)}
                        onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
                        onFocus={e=>e.target.select()}
                      />
                      <button style={S.qtyBtn} onClick={()=>stepRemaining(r.productId,+1)}>+</button>
                      <span style={{fontSize:12,color:"#1A1A2E",fontWeight:600}}>{fmtNum((r.scannedQty||0)*r.pricePerPiece)} Ks</span>
                    </div>
                  ) : (
                    <div style={{fontSize:13,fontWeight:700,color:"#1A1A2E"}}>
                      Scanned: {r.scannedQty||0} pcs &nbsp;·&nbsp; {fmtNum((r.scannedQty||0)*r.pricePerPiece)} Ks
                    </div>
                  )}
                  {r.status==="match" && <div style={S.matchBox}>Matches expected remaining!</div>}
                  {r.status==="over"  && <div style={S.warnBox}>More than expected remaining.</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SumCard({label,value,highlight,amber}) {
  return (
    <div style={{
      borderRadius:6, padding:"10px 12px", textAlign:"center",
      boxShadow:"0 1px 6px rgba(26,26,46,0.07)", flex:1, minWidth:100,
      background:highlight?"#EAF4EE":amber?"#FEF3DD":"#fff",
    }}>
      <div style={{fontSize:16,fontWeight:700,color:"#1A1A2E"}}>{value}</div>
      <div style={{fontSize:10,color:"#6B6B6B",marginTop:2}}>{label}</div>
    </div>
  );
}

const S = {
  root:        {fontFamily:"'Inter',sans-serif"},
  header:      {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10},
  h2:          {margin:0,fontSize:22,fontWeight:700,color:"#1A1A2E",fontFamily:"'Playfair Display',serif"},
  sub:         {margin:"4px 0 0",fontSize:13,color:"#6B6B6B"},
  refreshBtn:  {background:"#fff",color:"#1A1A2E",border:"1.5px solid #C9A84C",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6},
  scanBtn:     {background:"#1A1A2E",color:"#C9A84C",border:"none",borderRadius:8,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:600},
  exportBtn:   {background:"#C9A84C",color:"#1A1A2E",border:"none",borderRadius:8,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:600},
  topRow:      {display:"flex",gap:14,marginBottom:14,flexWrap:"wrap",alignItems:"center"},
  dateWrap:    {display:"flex",flexDirection:"column",gap:4},
  dateLabel:   {fontSize:12,fontWeight:600,color:"#1A1A2E"},
  datePicker:  {border:"1px solid #E5DDD0",borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none"},
  sumCards:    {display:"flex",gap:8,flex:1,flexWrap:"wrap"},
  // Car filter
  carFilter:   {background:"#fff",border:"1px solid #E5DDD0",borderRadius:8,padding:"12px 14px",marginBottom:14},
  carFilterLabel:{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#1A1A2E",marginBottom:8},
  carBtnRow:   {display:"flex",gap:8,flexWrap:"wrap"},
  carBtn:      {display:"flex",alignItems:"center",gap:6,border:"1.5px solid",borderRadius:6,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif"},
  carBtnActive:{background:"#1A1A2E",color:"#C9A84C",borderColor:"#1A1A2E"},
  carBtnInactive:{background:"#fff",color:"#1A1A2E",borderColor:"#C9A84C"},
  carBadge:    {background:"#1A1A2E",color:"#C9A84C",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10,marginLeft:2},
  // Manual barcode
  manualWrap:  {display:"flex",alignItems:"center",background:"#fff",border:"1px solid #E5DDD0",borderRadius:6,padding:"0 12px"},
  manualInput: {flex:1,border:"none",background:"transparent",padding:"10px 0",fontSize:14,outline:"none"},
  manualBtn:   {background:"#1A1A2E",color:"#C9A84C",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0},
  // Tabs
  tabs:        {display:"flex",gap:10,marginBottom:14},
  tabBtn:      {display:"flex",alignItems:"center",gap:6,border:"1.5px solid",borderRadius:6,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif"},
  tabBtnActive:{background:"#1A1A2E",color:"#C9A84C",borderColor:"#1A1A2E"},
  tabBtnInactive:{background:"#fff",color:"#1A1A2E",borderColor:"#C9A84C"},
  // Content
  cols:        {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14},
  panel:       {background:"#fff",borderRadius:8,padding:18,border:"1px solid #E5DDD0"},
  panelTitle:  {margin:"0 0 14px",fontSize:15,fontWeight:700,color:"#1A1A2E",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  clearAll:    {fontSize:12,fontWeight:500,color:"#DC2626",cursor:"pointer",background:"#FEE2E2",padding:"3px 10px",borderRadius:8},
  savedBadge:  {background:"#FEF3DD",color:"#A67C3A",fontSize:12,fontWeight:600,padding:"7px 12px",borderRadius:8,marginBottom:10},
  empty:       {textAlign:"center",marginTop:20,color:"#C4B5A5",fontSize:13},
  expectedCard:{background:"#FAF7F2",borderRadius:6,padding:"12px 14px",marginBottom:8},
  progressBg:  {height:6,background:"#E5DDD0",borderRadius:3,overflow:"hidden",margin:"6px 0"},
  progressBar: {height:6,borderRadius:3,transition:"width 0.3s"},
  shopRow:     {display:"flex",justifyContent:"space-between",padding:"3px 0"},
  scannedCard: {background:"#fff",borderRadius:6,padding:"12px 14px",border:"0.5px solid #F0E0CC",marginBottom:8},
  statusBadge: {fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,flexShrink:0},
  removeBtn:   {background:"#FEE2E2",border:"none",color:"#DC2626",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:600},
  qtyBtn:      {width:30,height:30,background:"#FAF7F2",border:"1px solid #E5DDD0",borderRadius:7,cursor:"pointer",fontSize:16,fontWeight:700,color:"#1A1A2E"},
  qtyInput:    {width:56,height:30,padding:"0 4px",border:"1px solid #E5DDD0",borderRadius:7,fontSize:14,textAlign:"center",fontWeight:600},
  warnBox:     {marginTop:6,background:"#FEE2E2",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#DC2626"},
  matchBox:    {marginTop:6,background:"#EAF4EE",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#2D7A4F"},
};
