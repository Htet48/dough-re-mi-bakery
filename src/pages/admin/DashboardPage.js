// src/pages/admin/DashboardPage.js
import React, { useEffect, useState, useCallback } from "react";
import { getSalesByDate } from "../../services/firestoreService";
import { todayStr, formatDisplay, fmtNum } from "../../utils/helpers";

const FOREST = "#1C3829";
const HONEY  = "#E4B950";
const SAGE   = "#4A8C6B";
const CREAM  = "#FAFAF7";
const RED    = "#B83232";
const AMBER  = "#A67C3A";

// Pastel tile colours per discount tier (cycles if more than 4 tiers)
const TIER_PALETTES = [
  { bg:"rgba(74,140,107,0.08)",  border:"rgba(74,140,107,0.25)",  label:"#2D6B4A", val:SAGE  },
  { bg:"rgba(58,100,180,0.08)",  border:"rgba(58,100,180,0.25)",  label:"#2D4DA0", val:"#2D4DA0" },
  { bg:"rgba(160,100,30,0.08)",  border:"rgba(160,100,30,0.25)",  label:AMBER,     val:AMBER },
  { bg:"rgba(180,50,50,0.08)",   border:"rgba(180,50,50,0.25)",   label:RED,       val:RED   },
];

function tsToTime(ts) {
  if (!ts?.toDate) return null;
  return ts.toDate().toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
}

// ── Compact per-car summary card ──────────────────────────
function CarSummaryCard({ car }) {
  const p = car.prodTotals;
  const s = car.shopTotals;
  const net = p.saleAmt - p.retAmt;
  return (
    <div style={{ background:"#fff", border:"1px solid #DDE8E2", borderRadius:10, marginBottom:14, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 16px", background:`linear-gradient(135deg,${FOREST} 0%,#254D35 100%)` }}>
        <div>
          <span style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:700, color:HONEY }}>{car.carName}</span>
          {car.salesperson && <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginLeft:8 }}>{car.salesperson}</span>}
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginLeft:8 }}>· {car.shopCount} shop{car.shopCount!==1?"s":""}</span>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:14, fontWeight:700, color:HONEY }}>{fmtNum(s.netTotal)} Ks</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.8px" }}>Net Revenue</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
        <div style={{ padding:"12px 16px", borderRight:"1px solid #EEF3EF" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#7A8C84", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>📦 Product Summary</div>
          <KV label="Sale Amt"   value={`${fmtNum(p.saleAmt)} Ks`} color={FOREST}  />
          <KV label="Return Amt" value={`${fmtNum(p.retAmt)} Ks`}  color={RED}     />
          <KV label="Net"        value={`${fmtNum(net)} Ks`}        color={SAGE} bold />
        </div>
        <div style={{ padding:"12px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#7A8C84", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>🏪 Shop Summary</div>
          <KV label="Sub Total"   value={`${fmtNum(s.subTotal)} Ks`}      color={FOREST} />
          <KV label="Returns"     value={`${fmtNum(s.returnTotal)} Ks`}   color={RED}    />
          <KV label="Discount"    value={`${fmtNum(s.discountAmt)} Ks`}   color={AMBER}  />
          <KV label="Net Total"   value={`${fmtNum(s.netTotal)} Ks`}      color={SAGE} bold />
          <KV label="Before Disc" value={`${fmtNum(s.beforeDiscount)} Ks`} color="#555"  />
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, color, bold }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"2px 0", borderBottom:"1px solid rgba(0,0,0,0.04)" }}>
      <span style={{ fontSize:11, color:"#7A8C84" }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:bold?700:500, color:color||FOREST }}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const today = todayStr();
  const [allSales,    setAllSales]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filterCar,   setFilterCar]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getSalesByDate(today);
    setAllSales(s);
    setLastRefresh(new Date());
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  // ── Car list ─────────────────────────────────────────────
  const carList = [...new Map(
    allSales.map(s => [s.carId, { carId:s.carId, carName:s.carName||s.carId, salesperson:s.salespersonName||"" }])
  ).values()].sort((a,b)=>a.carName.localeCompare(b.carName));

  const sales = filterCar ? allSales.filter(s=>s.carId===filterCar) : allSales;

  // ── Top-level stats ───────────────────────────────────────
  const totalRevenue  = sales.reduce((s,x)=>s+(x.total||0),       0);
  const totalReturns  = sales.reduce((s,x)=>s+(x.returnTotal||0), 0);
  const totalDiscount = sales.reduce((s,x)=>s+(x.discountAmt||0), 0);
  const shopsVisited  = new Set(sales.map(s=>s.customerId)).size;
  const carsActive    = new Set(allSales.map(s=>s.carId)).size;

  // ── Discount-tier breakdown ──────────────────────────────
  // Group sales by discount % → one summary tile per tier
  const tierMap = {};
  sales.forEach(s => {
    const pct = s.discountPct ?? s.discountAmt ?? 0;
    if (!tierMap[pct]) tierMap[pct] = { pct, net:0, shops:0 };
    tierMap[pct].net   += s.total || 0;
    tierMap[pct].shops += 1;
  });
  const tiers = Object.values(tierMap).sort((a,b)=>a.pct-b.pct);

  // ── Per-car aggregation ──────────────────────────────────
  const salesByCar = {};
  sales.forEach(s => {
    if (!salesByCar[s.carId]) salesByCar[s.carId] = { carName:s.carName||s.carId, salesperson:s.salespersonName||"", sales:[] };
    salesByCar[s.carId].sales.push(s);
  });
  const perCar = Object.entries(salesByCar).map(([carId, car]) => {
    const prodMap = {};
    car.sales.forEach(s => {
      (s.items||[]).forEach(item => {
        const pid = item.productId||item.productName;
        if (!prodMap[pid]) prodMap[pid] = { name:item.productName||pid, saleQty:0, saleAmt:0, retQty:0, retAmt:0 };
        prodMap[pid].saleQty += parseInt(item.saleQty,10)||0;
        prodMap[pid].saleAmt += (parseInt(item.saleQty,10)||0)*(item.pricePerPiece||0);
        prodMap[pid].retQty  += parseInt(item.returnQty,10)||0;
        prodMap[pid].retAmt  += (parseInt(item.returnQty,10)||0)*(item.pricePerPiece||0);
      });
    });
    const prodTotals = Object.values(prodMap).reduce(
      (acc,p)=>({ saleQty:acc.saleQty+p.saleQty, saleAmt:acc.saleAmt+p.saleAmt,
                  retQty:acc.retQty+p.retQty,     retAmt:acc.retAmt+p.retAmt }),
      { saleQty:0, saleAmt:0, retQty:0, retAmt:0 }
    );
    const shops = car.sales.map(s=>({
      name:s.shopName||s.customerId, subTotal:s.subTotal||0,
      returnTotal:s.returnTotal||0, discountAmt:s.discountAmt||0,
      netTotal:s.total||0, beforeDiscount:(s.discountAmt||0)+(s.total||0),
    }));
    const shopTotals = shops.reduce(
      (acc,s)=>({ subTotal:acc.subTotal+s.subTotal, returnTotal:acc.returnTotal+s.returnTotal,
                  discountAmt:acc.discountAmt+s.discountAmt, netTotal:acc.netTotal+s.netTotal,
                  beforeDiscount:acc.beforeDiscount+s.beforeDiscount }),
      { subTotal:0, returnTotal:0, discountAmt:0, netTotal:0, beforeDiscount:0 }
    );
    // Top products for this car
    const topProds = Object.values(prodMap).sort((a,b)=>b.saleAmt-a.saleAmt).slice(0,5);
    return { carId, carName:car.carName, salesperson:car.salesperson,
             shopCount:car.sales.length, shops, prodTotals, shopTotals, topProds };
  }).sort((a,b)=>a.carName.localeCompare(b.carName));

  // ── Recent sales (sorted by updatedAt then createdAt) ────
  const recentSales = [...sales]
    .sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0))
    .slice(0,5);

  const STATS = [
    { label:"Today's Revenue",  val:`${fmtNum(totalRevenue)} Ks`,  color:SAGE,   top:HONEY    },
    { label:"Shops Visited",    val:shopsVisited,                   color:FOREST, top:FOREST   },
    { label:"Cars Active",      val:carsActive,                     color:FOREST, top:"#7A8C84"},
    { label:"Total Returns",    val:`${fmtNum(totalReturns)} Ks`,  color:RED,    top:RED      },
    { label:"Total Discount",   val:`${fmtNum(totalDiscount)} Ks`, color:AMBER,  top:AMBER    },
  ];

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:CREAM, minHeight:"100vh", padding:"20px 20px 40px" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, color:FOREST, marginBottom:3 }}>Dashboard</div>
          <div style={{ fontSize:12, color:"#7A8C84" }}>{formatDisplay(today)} · Refreshes every 60 s</div>
        </div>
        <button
          style={{ background:FOREST, color:HONEY, border:"none", borderRadius:8, padding:"9px 18px",
                   cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}
          onClick={load}>{loading?"Loading…":"↻ Refresh"}</button>
      </div>

      {/* ── Car filter ── */}
      {carList.length > 0 && (
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:16 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#7A8C84", textTransform:"uppercase", letterSpacing:"0.5px" }}>Filter by car:</span>
          {[{ carId:null, carName:"All Cars", salesperson:"" }, ...carList].map((car,i) => {
            const active = filterCar === car.carId;
            return (
              <button key={i}
                style={{ border:`1.5px solid ${active?FOREST:"#DDE8E2"}`, borderRadius:8, padding:"6px 14px",
                         cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
                         background:active?FOREST:"#fff", color:active?HONEY:FOREST }}
                onClick={()=>setFilterCar(car.carId)}>
                {car.carName}
                {car.salesperson && <span style={{ opacity:0.55, fontSize:10 }}> · {car.salesperson}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:10, marginBottom:14 }}>
        {STATS.map((s,i) => (
          <div key={i} style={{ background:"#fff", border:"1px solid #DDE8E2", borderRadius:10,
            padding:"14px 16px", borderTop:`3px solid ${s.top}` }}>
            <div style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:700, color:s.color, marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:10, color:"#7A8C84", textTransform:"uppercase", letterSpacing:"0.8px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Discount-tier breakdown tiles ── */}
      {tiers.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(tiers.length,4)},1fr)`, gap:10, marginBottom:14 }}>
          {tiers.map((tier, i) => {
            const pal = TIER_PALETTES[i % TIER_PALETTES.length];
            return (
              <div key={tier.pct} style={{ background:pal.bg, border:`1px solid ${pal.border}`,
                borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:pal.label, textTransform:"uppercase",
                  letterSpacing:"0.8px", marginBottom:6 }}>
                  {tier.pct}% Discount · {tier.shops} shop{tier.shops!==1?"s":""}
                </div>
                <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:700, color:pal.val }}>
                  {fmtNum(tier.net)} Ks
                </div>
                <div style={{ fontSize:10, color:pal.label, marginTop:2 }}>Net total · {tier.pct}% discount shops</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Recent Sales ── */}
      <div style={{ background:"#fff", border:"1px solid #DDE8E2", borderRadius:10, padding:16, marginBottom:14 }}>
        <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:FOREST, marginBottom:12 }}>Recent Sales</div>
        {recentSales.length === 0
          ? <div style={{ textAlign:"center", color:"#B5C9BD", fontSize:13, padding:"24px 0" }}>No sales recorded today</div>
          : recentSales.map((s,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"8px 0", borderBottom:"1px solid #EEF3EF" }}>
              <div>
                <div style={{ fontSize:11, color:HONEY, fontFamily:"monospace" }}>{s.invoiceNo||"—"}</div>
                <div style={{ fontSize:11, color:"#7A8C84", marginTop:1 }}>{s.shopName} · {s.carName}</div>
                {/* Save + print status inline */}
                <div style={{ display:"flex", gap:10, marginTop:3 }}>
                  {(s.saveCount||0) > 0 && (
                    <span style={{ fontSize:10, color:"#555" }}>
                      💾 {s.saveCount}× {tsToTime(s.updatedAt) && <span style={{ color:"#999" }}>{tsToTime(s.updatedAt)}</span>}
                    </span>
                  )}
                  {(s.printCount||0) > 0 && (
                    <span style={{ fontSize:10, color:SAGE, fontWeight:600 }}>
                      🖨 {s.printCount}× {tsToTime(s.lastPrintedAt) && <span style={{ color:"#999", fontWeight:400 }}>{tsToTime(s.lastPrintedAt)}</span>}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:FOREST }}>{fmtNum(s.total)} Ks</div>
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Per-car summary + top products ── */}
      {perCar.length === 0
        ? <div style={{ background:"#fff", border:"1px solid #DDE8E2", borderRadius:10, padding:16 }}>
            <div style={{ textAlign:"center", color:"#B5C9BD", fontSize:13, padding:"24px 0" }}>No sales recorded yet today</div>
          </div>
        : perCar.map(car => (
          <div key={car.carId}>
            <CarSummaryCard car={car} />

            {/* Top Products for this car */}
            {car.topProds.length > 0 && (
              <div style={{ background:"#fff", border:"1px solid #DDE8E2", borderRadius:10,
                padding:16, marginBottom:14, marginTop:-8 }}>
                <div style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, color:FOREST, marginBottom:10 }}>
                  Top Products Today{filterCar ? "" : ` (${car.carName})`}
                </div>
                {car.topProds.map((p,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"7px 0", borderBottom:"1px solid #EEF3EF" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:22, height:22, borderRadius:6, background:FOREST, color:HONEY,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:700, flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontSize:12, color:"#2C4A3A" }}>{p.name}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:FOREST }}>{fmtNum(p.saleAmt)} Ks</div>
                      <div style={{ fontSize:10, color:"#7A8C84" }}>{p.saleQty} pcs</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      }

      <div style={{ textAlign:"right", fontSize:10, color:"#B5C9BD", marginTop:12 }}>
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
