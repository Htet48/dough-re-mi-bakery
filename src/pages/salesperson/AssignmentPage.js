// src/pages/salesperson/AssignmentPage.js
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { todayStr, formatDisplay } from "../../utils/helpers";
import { getAssignment, getAllProducts, getSalesByDateAndCar } from "../../services/firestoreService";
import toast from "react-hot-toast";

export default function AssignmentPage() {
  const { profile } = useAuth();
  const today = todayStr();

  const [assignment,  setAssignment]  = useState(null);
  const [products,    setProducts]    = useState([]);
  const [todaySales,  setTodaySales]  = useState([]);
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!profile?.carId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [a, p, s] = await Promise.all([
        getAssignment(today, profile.carId),
        getAllProducts(),
        getSalesByDateAndCar(today, profile.carId),
      ]);
      setAssignment(a);
      setProducts(p);
      setTodaySales(s);
    } catch(e) {
      toast.error("Load failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [profile, today]);

  useEffect(() => { load(); }, [load]);

  // Build product lookup
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  // Build sold qty per product
  const soldMap = {};
  todaySales.forEach(sale => {
    (sale.items||[]).forEach(item => {
      soldMap[item.productId] = (soldMap[item.productId]||0) + (parseInt(item.saleQty,10)||0);
    });
  });

  // Assignment items with progress
  const assignedItems = Object.entries(assignment?.items || {}).map(([productId, assignedQty]) => {
    const product  = productMap[productId] || {};
    const soldQty  = soldMap[productId] || 0;
    const remaining = Math.max(0, assignedQty - soldQty);
    const pct = assignedQty > 0 ? Math.min(100, Math.round((soldQty/assignedQty)*100)) : 0;
    const status = soldQty === 0 ? "pending"
                 : soldQty > assignedQty ? "over"
                 : soldQty === assignedQty ? "done"
                 : "partial";
    return {
      productId, productName: product.name || productId,
      category: product.category || "", price: product.price || 0,
      barcode: product.barcode || "",
      assignedQty, soldQty, remaining, pct, status,
    };
  }).sort((a,b) => a.productName.localeCompare(b.productName));

  // Extra items (not in assignment) — includes both extra sold AND extra returned
  const extraSoldItems = [];
  todaySales.forEach(sale => {
    (sale.items||[]).forEach(item => {
      if (item.isExtra && ((item.saleQty||0) > 0 || (item.returnQty||0) > 0)) {
        const ex = extraSoldItems.find(e=>e.productId===item.productId);
        if (ex) {
          ex.soldQty   += item.saleQty   || 0;
          ex.returnQty += item.returnQty || 0;
          ex.shops.push(sale.shopName);
        } else {
          extraSoldItems.push({
            productId:   item.productId,
            productName: item.productName,
            soldQty:     item.saleQty   || 0,
            returnQty:   item.returnQty || 0,
            price:       item.pricePerPiece || 0,
            shops:       [sale.shopName],
          });
        }
      }
    });
  });

  const totalAssigned = assignedItems.reduce((s,i)=>s+i.assignedQty,0);
  const totalSold     = assignedItems.reduce((s,i)=>s+i.soldQty,0);
  const doneCount     = assignedItems.filter(i=>i.status==="done").length;
  const overallPct    = totalAssigned>0 ? Math.min(100,Math.round((totalSold/totalAssigned)*100)) : 0;

  // ── RENDER ─────────────────────────────────────────────
  if (loading) return (
    <div style={S.center}><p style={{color:"#6B6B6B"}}>Loading…</p></div>
  );

  if (!profile?.carId) return (
    <div style={S.center}>
      <div style={{fontSize:48}}>🚗</div>
      <h3 style={{color:"#1A1A2E"}}>No car assigned</h3>
      <p style={{color:"#6B6B6B"}}>Ask your manager to assign a car to your account.</p>
    </div>
  );

  if (!assignment || assignedItems.length === 0) return (
    <div style={S.center}>
      <div style={{fontSize:52}}>📋</div>
      <h3 style={{color:"#1A1A2E"}}>No assignment today</h3>
      <p style={{color:"#6B6B6B",maxWidth:280,textAlign:"center"}}>
        Manager hasn't assigned products yet. Check back soon!
      </p>
      <button style={S.refreshBtn} onClick={load}>Refresh</button>
    </div>
  );

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>📋 Assigned Sales</h2>
          <p style={S.sub}>{formatDisplay(today)} · {assignment.carName || profile.carId}</p>
        </div>
        <button style={S.refreshBtn} onClick={load}>Refresh</button>
      </div>

      {/* Overall progress */}
      <div style={S.progressCard}>
        <div style={S.progressTop}>
          <div>
            <div style={S.progressTitle}>Overall Progress</div>
            <div style={S.progressSub}>
              {totalSold} of {totalAssigned} pcs sold · {doneCount}/{assignedItems.length} products done
            </div>
          </div>
          <div style={S.progressPct}>{overallPct}%</div>
        </div>
        <div style={S.bigBarBg}>
          <div style={{
            ...S.bigBar,
            width:`${overallPct}%`,
            background:overallPct===100?"#1A1A2E":overallPct>=50?"#C9A84C":"#1A1A2E",
          }}/>
        </div>
        <div style={S.progressStats}>
          <StatBox label="Assigned"    value={totalAssigned} unit="pcs" />
          <StatBox label="Sold"        value={totalSold}     unit="pcs" green />
          <StatBox label="Remaining"   value={totalAssigned-totalSold} unit="pcs" amber />
          <StatBox label="Total Value" value="xxx Ks" />
        </div>
      </div>

      {/* Product list */}
      <div style={S.list}>
        {assignedItems.map((item,i) => {
          const ss = {
            done:    {bg:"#F0F7F2",color:"#2D7A4F",label:"Done"},
            partial: {bg:"#FAF7F2",color:"#A67C3A",label:"Partial"},
            pending: {bg:"#F1EFE8",color:"#6B6B6B",   label:"Pending"},
            over:    {bg:"#FEE2E2",color:"#DC2626", label:"Over Sold"},
          }[item.status] || {bg:"#F1EFE8",color:"#6B6B6B",label:"Pending"};
          return (
            <div key={i} style={{
              ...S.itemCard,
              borderLeft:`4px solid ${
                item.status==="done"?"#1A1A2E":
                item.status==="over"?"#DC2626":
                item.status==="partial"?"#C9A84C":"#E5DDD0"}`}}>
              <div style={S.itemTop}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={S.itemName}>{item.productName}</div>
                  <div style={S.itemMeta}>
                    {item.category&&<span style={S.catTag}>{item.category}</span>}
                    <span style={{color:"#bbb",letterSpacing:"0.5px"}}>xxx Ks/pc</span>
                    {item.barcode&&<span style={{color:"#bbb"}}>· {item.barcode}</span>}
                  </div>
                </div>
                <span style={{...S.statusBadge,background:ss.bg,color:ss.color}}>{ss.label}</span>
              </div>
              {item.status==="over"&&(
                <div style={{background:"#FEE2E2",borderRadius:8,padding:"7px 12px",marginBottom:8,fontSize:12,color:"#DC2626",fontWeight:600}}>
                  ⚠️ Sold {item.soldQty} but only assigned {item.assignedQty} — {item.soldQty-item.assignedQty} extra!
                </div>
              )}
              <div style={S.barBg}>
                <div style={{...S.bar,width:`${item.pct}%`,
                  background:item.status==="done"?"#1A1A2E":item.status==="partial"?"#C9A84C":"#E5DDD0"}}/>
              </div>
              <div style={S.qtyRow}>
                <QtyBox label="Assigned" value={item.assignedQty} />
                <QtyBox label="Sold"     value={item.soldQty}   green />
                <QtyBox label="Left"     value={item.remaining} amber={item.remaining>0} />
                <QtyBox label="Value"    value="xxx Ks" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra items — not in assignment (sold or returned) */}
      {extraSoldItems.length>0&&(
        <div style={S.extraSection}>
          <div style={S.extraTitle}>⚠️ Items Outside Assignment</div>
          <p style={{fontSize:12,color:"#A67C3A",margin:"0 0 10px"}}>
            These products were NOT in today's assignment.
          </p>
          {extraSoldItems.map((item,i)=>(
            <div key={i} style={S.extraCard}>
              <div style={{fontWeight:700,fontSize:14,color:"#DC2626"}}>{item.productName}</div>
              <div style={{fontSize:12,color:"#6B6B6B",marginTop:3,display:"flex",gap:12,flexWrap:"wrap"}}>
                {item.soldQty>0   && <span>Sold: <b style={{color:"#1A1A2E"}}>{item.soldQty} pcs</b></span>}
                {item.returnQty>0 && <span>Returned: <b style={{color:"#A67C3A"}}>{item.returnQty} pcs</b></span>}
                <span style={{color:"#bbb"}}>{item.shops.filter((v,i,a)=>a.indexOf(v)===i).join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total bar */}
      <div style={S.totalBar}>
        <div>
          <div style={{fontSize:12,opacity:0.8,marginBottom:2}}>Sold value so far</div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:"0.5px"}}>xxx Ks</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:12,opacity:0.8,marginBottom:2}}>Total assignment value</div>
          <div style={{fontSize:18,fontWeight:600,opacity:0.9,letterSpacing:"0.5px"}}>xxx Ks</div>
        </div>
      </div>
    </div>
  );
}

function StatBox({label,value,unit,green,amber}) {
  return (
    <div style={S.statBox}>
      <div style={{fontSize:16,fontWeight:700,color:green?"#1A1A2E":amber?"#C9A84C":"#1A1A2E"}}>
        {value}{unit&&<span style={{fontSize:11,fontWeight:400,marginLeft:2}}>{unit}</span>}
      </div>
      <div style={{fontSize:10,color:"#6B6B6B",marginTop:2}}>{label}</div>
    </div>
  );
}

function QtyBox({label,value,green,amber}) {
  return (
    <div style={S.qtyBox}>
      <div style={{fontSize:15,fontWeight:700,color:green?"#1A1A2E":amber?"#C9A84C":"#1A1A2E"}}>{value}</div>
      <div style={{fontSize:10,color:"#6B6B6B",marginTop:1}}>{label}</div>
    </div>
  );
}

const S = {
  root:          {padding:"12px 14px",maxWidth:700,margin:"0 auto",fontFamily:"'Inter',sans-serif",paddingBottom:80},
  center:        {textAlign:"center",marginTop:60,padding:24,fontFamily:"'Inter',sans-serif"},
  header:        {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16},
  h2:            {margin:0,fontSize:20,fontWeight:700,color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  sub:           {margin:"4px 0 0",fontSize:13,color:"#6B6B6B"},
  refreshBtn:    {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600},
  scanBtn:       {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600},
  progressCard:  {background:"#fff",borderRadius:8,padding:18,border:"1px solid #E5DDD0",borderTop:"2px solid #C9A84C",marginBottom:16},
  progressTop:   {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12},
  progressTitle: {fontSize:15,fontWeight:700,color:"#1A1A2E"},
  progressSub:   {fontSize:12,color:"#6B6B6B",marginTop:3},
  progressPct:   {fontSize:32,fontWeight:700,color:"#1A1A2E"},
  bigBarBg:      {height:12,background:"#E5DDD0",borderRadius:6,overflow:"hidden",marginBottom:14},
  bigBar:        {height:12,borderRadius:6,transition:"width 0.5s"},
  progressStats: {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8},
  statBox:       {background:"#FAF7F2",borderRadius:10,padding:"10px 8px",textAlign:"center"},
  list:          {display:"flex",flexDirection:"column",gap:10},
  itemCard:      {background:"#fff",borderRadius:8,padding:"14px 16px",border:"1px solid #E5DDD0"},
  itemTop:       {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8},
  itemName:      {fontWeight:700,fontSize:15,color:"#1A1A2E",marginBottom:4},
  itemMeta:      {display:"flex",gap:8,fontSize:12,color:"#6B6B6B",flexWrap:"wrap",alignItems:"center"},
  catTag:        {background:"#FAF7F2",border:"1px solid #E8D5C0",borderRadius:8,padding:"2px 8px",fontSize:11,color:"#1A1A2E",fontWeight:600},
  statusBadge:   {fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:10,flexShrink:0},
  barBg:         {height:6,background:"#E5DDD0",borderRadius:3,overflow:"hidden",marginBottom:10},
  bar:           {height:6,borderRadius:3,transition:"width 0.4s"},
  qtyRow:        {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8},
  qtyBox:        {background:"#FAF7F2",borderRadius:8,padding:"8px 6px",textAlign:"center"},
  totalBar:      {background:"#1A1A2E",color:"#fff",borderRadius:8,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16},
  extraSection:  {background:"#FAF7F2",border:"1.5px solid #F59E0B",borderRadius:8,padding:"14px 16px",marginTop:12,marginBottom:4},
  extraTitle:    {fontWeight:700,fontSize:14,color:"#A67C3A",marginBottom:6},
  extraCard:     {background:"rgba(255,255,255,0.7)",borderRadius:8,padding:"10px 12px",marginBottom:6},
};
