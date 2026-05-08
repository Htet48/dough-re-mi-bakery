// src/pages/admin/AssignPage.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { todayStr, formatDisplay } from "../../utils/helpers";
import {
  getAllProducts, getAllCars, getAssignment, setAssignment,
  getProductByBarcode, deleteAssignment
} from "../../services/firestoreService";
import BarcodeScanner from "../../components/shared/BarcodeScanner";

export default function AssignPage() {
  const today = todayStr();
  const [cars, setCars]               = useState([]);
  const [products, setProducts]       = useState([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [assignments, setAssignments] = useState({});
  const [qtyDraft, setQtyDraft]       = useState({});
  const [saving, setSaving]           = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [search, setSearch]           = useState("");
  const [showDrop, setShowDrop]       = useState(false);
  const [assignedOrder, setAssignedOrder] = useState({}); // carId → [productId] in add-order
  const searchRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([getAllCars(), getAllProducts()]);
      setCars(c);
      setProducts(p);
      const loaded = {};
      for (const car of c) {
        const a = await getAssignment(today, car.id);
        loaded[car.id] = a?.items || {};
      }
      setAssignments(loaded);
      if (c.length) setSelectedCar(c[0].id);
    })();
  }, []);

  // USB/wireless scanner
  useEffect(() => {
    const buf = { v: "", t: null };
    const fn = (e) => {
      if (e.key === "Enter") {
        if (buf.v.trim().length >= 3) handleBarcodeDetected(buf.v.trim());
        buf.v = ""; clearTimeout(buf.t); return;
      }
      if (e.key.length === 1) {
        buf.v += e.key;
        clearTimeout(buf.t);
        buf.t = setTimeout(() => { buf.v = ""; }, 80);
      }
    };
    window.addEventListener("keydown", fn);
    return () => { window.removeEventListener("keydown", fn); clearTimeout(buf.t); };
  }, [selectedCar, products]);

  const handleBarcodeDetected = async (code) => {
    if (!selectedCar) return;
    const product = await getProductByBarcode(code);
    if (!product) { toast.error(`Barcode not found: ${code}`); return; }
    setAssignments(prev => {
      const items = { ...(prev[selectedCar] || {}) };
      items[product.id] = (items[product.id] || 0) + 1;
      toast.success(`+1 ${product.name}`);
      return { ...prev, [selectedCar]: items };
    });
    setAssignedOrder(prev => {
      const arr = (prev[selectedCar] || []).filter(id => id !== product.id);
      return { ...prev, [selectedCar]: [...arr, product.id] };
    });
  };

  const handleManualBarcode = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      handleBarcodeDetected(manualBarcode.trim());
      setManualBarcode("");
    }
  };

  const handleQtyChange = (productId, raw) => {
    setQtyDraft(prev => ({ ...prev, [`${selectedCar}_${productId}`]: raw }));
  };

  const handleQtyBlur = (productId) => {
    const key = `${selectedCar}_${productId}`;
    const raw  = qtyDraft[key];
    if (raw === undefined) return;
    const qty = parseInt(raw, 10);
    setAssignments(prev => {
      const items = { ...(prev[selectedCar] || {}) };
      if (isNaN(qty) || qty <= 0) delete items[productId];
      else items[productId] = qty;
      return { ...prev, [selectedCar]: items };
    });
    setQtyDraft(prev => { const n={...prev}; delete n[key]; return n; });
  };

  const displayQty = (productId) => {
    const key = `${selectedCar}_${productId}`;
    if (qtyDraft[key] !== undefined) return qtyDraft[key];
    return String(assignments[selectedCar]?.[productId] || "");
  };

  const stepQty = (productId, delta) => {
    setAssignments(prev => {
      const items = { ...(prev[selectedCar] || {}) };
      const next = (items[productId] || 0) + delta;
      if (next <= 0) delete items[productId];
      else items[productId] = next;
      return { ...prev, [selectedCar]: items };
    });
    setQtyDraft(prev => { const n={...prev}; delete n[`${selectedCar}_${productId}`]; return n; });
  };

  const addProduct = (product) => {
    if (!selectedCar) { toast.error("Select a car first"); return; }
    setAssignments(prev => {
      const items = { ...(prev[selectedCar] || {}) };
      if (!items[product.id]) items[product.id] = 1;
      return { ...prev, [selectedCar]: items };
    });
    setAssignedOrder(prev => {
      const arr = (prev[selectedCar] || []).filter(id => id !== product.id);
      return { ...prev, [selectedCar]: [...arr, product.id] };
    });
    setSearch(""); setShowDrop(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const removeProduct = (productId) => {
    setAssignments(prev => {
      const items = { ...(prev[selectedCar] || {}) };
      delete items[productId];
      return { ...prev, [selectedCar]: items };
    });
  };

  const saveAll = async () => {
    if (!cars.length) { toast.error("No cars found."); return; }
    setSaving(true);
    try {
      for (const car of cars) {
        const items = assignments[car.id] || {};
        const hasItems = Object.values(items).some(q => (q||0) > 0);
        if (hasItems) {
          // Save non-empty assignment to Firebase
          await setAssignment(today, car.id, {
            items,
            carName: car.name,
          });
        } else {
          // Empty assignment → DELETE from Firebase so salesperson sees nothing
          try { await deleteAssignment(today, car.id); } catch(_) {}
        }
      }
      toast.success("Assignments saved to Firebase!");
    } catch (e) {
      toast.error("Save failed: " + e.message);
    } finally { setSaving(false); }
  };

  const carAssign      = assignments[selectedCar] || {};
  const orderArr       = assignedOrder[selectedCar] || [];
  // LIFO: products added most recently appear at the top of the table
  const assignedProds  = products
    .filter(p => carAssign[p.id] !== undefined)
    .sort((a, b) => {
      const ia = orderArr.indexOf(a.id);
      const ib = orderArr.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name); // loaded from Firestore: alpha
      if (ia === -1) return 1;   // not in order: push to bottom
      if (ib === -1) return -1;
      return ib - ia;            // higher index = added later = show first
    });
  const filteredSearch = search.length > 0
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) &&
        carAssign[p.id] === undefined
      ).slice(0, 8)
    : [];
  const totalPcs = Object.values(carAssign).reduce((s,q) => s+(q||0), 0);

  if (!cars.length) return (
    <div style={S.empty}>
      <div style={{marginBottom:12,opacity:0.3}}>
        <svg width="52" height="52" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="16" width="32" height="14" rx="3" fill="#C9A84C" opacity="0.2" stroke="#C9A84C" strokeWidth="1.5"/>
          <path d="M8 16l4-8h16l4 8" stroke="#C9A84C" strokeWidth="1.5" strokeLinejoin="round"/>
          <circle cx="11" cy="30" r="4" stroke="#C9A84C" strokeWidth="1.5"/>
          <circle cx="29" cy="30" r="4" stroke="#C9A84C" strokeWidth="1.5"/>
        </svg>
      </div>
      <h2 style={{color:"#1A1A2E",margin:"12px 0 8px",fontFamily:"'Playfair Display',serif"}}>No cars yet</h2>
      <p style={{color:"#6B6B6B"}}>Go to <b>Cars / Routes</b> to add your first delivery car.</p>
    </div>
  );

  return (
    <div>
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
          title="Scan Product to Assign"
        />
      )}

      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Daily Assignment</h2>
          <p style={S.date}>{formatDisplay(today)}</p>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button style={S.scanBtn} onClick={() => setShowScanner(true)}>
            Camera Scan
          </button>
          <button style={S.saveBtn} onClick={saveAll} disabled={saving}>
            {saving ? "Saving…" : "Save All"}
          </button>
        </div>
      </div>

      {/* Scanner info bar
      <div style={S.scanBar}>
        <span style={{display:"flex",alignItems:"center",gap:6}}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="5" height="14" rx="1" stroke="#C9A84C" strokeWidth="1.3"/>
            <rect x="8" y="1" width="2" height="14" rx="0.5" stroke="#C9A84C" strokeWidth="1.3"/>
            <rect x="12" y="1" width="3" height="14" rx="0.5" stroke="#C9A84C" strokeWidth="1.3"/>
          </svg>
          <b>USB / Wireless scanner:</b> Plug in and scan directly — auto-detected
        </span>
        <span style={{margin:"0 10px",color:"#C9A84C",opacity:0.4}}>|</span>
        <span style={{display:"flex",alignItems:"center",gap:6}}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="4" stroke="#C9A84C" strokeWidth="1.3"/>
            <circle cx="8" cy="8" r="1.5" fill="#C9A84C"/>
            <rect x="5" y="1" width="6" height="3" rx="1" stroke="#C9A84C" strokeWidth="1.3"/>
          </svg>
          <b>Camera:</b> Click "Camera Scan" above
        </span>
      </div> */}

      {/* Car tabs */}
      <div style={S.carTabs}>
        {cars.map(car => {
          const count  = Object.keys(assignments[car.id] || {}).length;
          const pcs    = Object.values(assignments[car.id] || {}).reduce((s,q)=>s+(q||0),0);
          const active = selectedCar === car.id;
          return (
            <div key={car.id} style={{display:"flex",gap:4,alignItems:"stretch"}}>
              <button
                style={{...S.carTab,
                  background:active?"#1A1A2E":"#fff",
                  color:active?"#C9A84C":"#1A1A2E",flex:1}}
                onClick={() => setSelectedCar(car.id)}>
                <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="16" width="32" height="14" rx="3"
                    fill={active?"#C9A84C":"#C9A84C"} opacity="0.15"
                    stroke={active?"#C9A84C":"#C9A84C"} strokeWidth="1.5"/>
                  <path d="M8 16l4-8h16l4 8" stroke={active?"#C9A84C":"#C9A84C"} strokeWidth="1.5"/>
                  <circle cx="11" cy="30" r="4" stroke={active?"#C9A84C":"#C9A84C"} strokeWidth="1.5"/>
                  <circle cx="29" cy="30" r="4" stroke={active?"#C9A84C":"#C9A84C"} strokeWidth="1.5"/>
                </svg>
                <span style={{fontWeight:700,fontSize:14}}>{car.name}</span>
                <span style={{fontSize:11,opacity:0.75}}>{count} products · {pcs} pcs</span>
              </button>
              {count > 0 && (
                <button
                  style={{background:"#FEE2E2",border:"1px solid #FCA5A5",color:"#DC2626",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}
                  title="Delete this car's assignment"
                  onClick={async () => {
                    if (!window.confirm(`Delete ALL assignment for ${car.name} on ${today}?`)) return;
                    await deleteAssignment(today, car.id);
                    setAssignments(prev => ({...prev, [car.id]: {}}));
                    toast.success(`${car.name} assignment cleared`);
                  }}>
                  🗑 Clear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>
            {cars.find(c => c.id === selectedCar)?.name}
          </span>
          <span style={S.cardSub}>
            {assignedProds.length} products · {totalPcs} pcs total
          </span>
        </div>

        {/* Search dropdown */}
        <div style={S.searchWrap}>
          <div style={S.searchBox}>
            <span style={{fontSize:16,marginRight:8,opacity:0.45}}>🔍</span>
            <input
              ref={searchRef}
              style={S.searchInput}
              placeholder="Type product name to search and add…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 160)}
            />
            {search && (
              <button style={S.clearBtn}
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}>✕</button>
            )}
          </div>
          {showDrop && filteredSearch.length > 0 && (
            <div style={S.dropdown}>
              {filteredSearch.map(p => (
                <div key={p.id} style={S.dropItem} onMouseDown={() => addProduct(p)}>
                  <div>
                    <span style={{fontWeight:600,fontSize:14,color:"#222"}}>{p.name}</span>
                    <span style={{fontSize:12,color:"#6B6B6B"}}> · {p.category}</span>
                  </div>
                  <span style={{fontSize:13,color:"#1A1A2E",fontWeight:600}}>
                    {p.price?.toLocaleString()} Ks
                  </span>
                </div>
              ))}
            </div>
          )}
          {showDrop && search.length > 0 && filteredSearch.length === 0 && (
            <div style={S.dropdown}>
              <div style={{padding:"14px 16px",color:"#C4B5A5",fontSize:13}}>
                No products found for "{search}"
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        {assignedProds.length === 0 ? (
          <div style={S.noItems}>
            Search above or scan a barcode to add products to this car.
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Product</th>
                <th style={S.th}>Category</th>
                <th style={S.th}>Price (Ks)</th>
                <th style={{...S.th,width:180}}>Qty to Deliver</th>
                <th style={S.th}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {assignedProds.map(p => (
                <tr key={p.id} style={S.tr}>
                  <td style={S.td}><b>{p.name}</b></td>
                  <td style={S.td}>{p.category}</td>
                  <td style={S.td}>{p.price?.toLocaleString()}</td>
                  <td style={S.td}>
                    <div style={S.qtyRow}>
                      <button style={S.qtyBtn}
                        onClick={() => stepQty(p.id, -1)}>−</button>
                      <input
                        style={S.qtyInput}
                        type="number" min={1}
                        value={displayQty(p.id)}
                        onChange={e => handleQtyChange(p.id, e.target.value)}
                        onBlur={() => handleQtyBlur(p.id)}
                        onKeyDown={e => { if(e.key==="Enter") e.target.blur(); }}
                      />
                      <button style={S.qtyBtn}
                        onClick={() => stepQty(p.id, +1)}>+</button>
                    </div>
                  </td>
                  <td style={S.td}>
                    <button style={S.removeBtn} onClick={() => removeProduct(p.id)}>
                      ✕ Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const S = {
  header:     {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16},
  h2:         {margin:0,fontSize:22,fontWeight:700,color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  date:       {margin:"4px 0 0",fontSize:13,color:"#6B6B6B"},
  saveBtn:    {background:"#1A1A2E",color:"#C9A84C",border:"none",borderRadius:8,padding:"11px 24px",cursor:"pointer",fontSize:14,fontWeight:600},
  scanBtn:    {background:"transparent",color:"#1A1A2E",border:"1.5px solid #C9A84C",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontSize:13,fontWeight:600},
  scanBar:    {background:"#FAF7F2",border:"1px solid #E8D5C0",borderRadius:6,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#1A1A2E",display:"flex",alignItems:"center",flexWrap:"wrap",gap:4},
  empty:      {textAlign:"center",marginTop:80},
  carTabs:    {display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"},
  carTab:     {border:"1.5px solid #C9A84C",borderRadius:8,padding:"10px 20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:130},
  card:       {background:"#fff",borderRadius:8,padding:24,border:"1px solid #E5DDD0"},
  cardHeader: {display:"flex",alignItems:"baseline",gap:12,marginBottom:18},
  cardTitle:  {fontSize:17,fontWeight:700,color:"#1A1A2E"},
  cardSub:    {fontSize:13,color:"#6B6B6B"},
  searchWrap: {position:"relative",marginBottom:20},
  searchBox:  {display:"flex",alignItems:"center",border:"1px solid #E5DDD0",borderRadius:6,background:"#FFFDF9",padding:"0 14px"},
  searchInput:{flex:1,border:"none",background:"transparent",padding:"12px 0",fontSize:14,outline:"none",color:"#333"},
  clearBtn:   {background:"none",border:"none",cursor:"pointer",color:"#C4B5A5",fontSize:15,padding:"0 4px"},
  dropdown:   {position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1px solid #E5DDD0",borderRadius:6,boxShadow:"0 8px 28px rgba(0,0,0,0.13)",zIndex:100,maxHeight:300,overflowY:"auto"},
  dropItem:   {padding:"11px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #F5E8D8"},
  noItems:    {color:"#C4B5A5",fontSize:14,padding:"24px 0",textAlign:"center"},
  table:      {width:"100%",borderCollapse:"collapse"},
  thead:      {background:"#FAF7F2"},
  th:         {padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#1A1A2E",borderBottom:"2px solid #E8D5C0"},
  tr:         {borderBottom:"1px solid #F5E8D8"},
  td:         {padding:"10px 14px",fontSize:13,color:"#333"},
  qtyRow:     {display:"flex",alignItems:"center",gap:6},
  qtyBtn:     {width:34,height:34,background:"#FAF7F2",border:"1px solid #E5DDD0",borderRadius:8,cursor:"pointer",fontSize:18,fontWeight:700,color:"#1A1A2E",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, fontFamily:"'Playfair Display',serif" },
  qtyInput:   {width:64,height:34,padding:"0 8px",border:"1px solid #E5DDD0",borderRadius:8,fontSize:15,textAlign:"center",color:"#333",background:"#fff",fontWeight:600},
  removeBtn:  {background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600},
};
