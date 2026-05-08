import toast from "react-hot-toast";
// src/pages/admin/ReportsPage.js
import React, { useState, useRef, useEffect } from "react";
import ExportButton from "../../components/shared/ExportButton";
import { getAllProducts, getAssignmentsByDate, getSalesByDateRange, deleteSale } from "../../services/firestoreService";
import { exportCarExcel, exportAllCarsExcel } from "../../utils/excelExport";
import { todayStr, weekRange, monthRange, yearRange,
         formatDisplay, exportCSV,
         salesToCSVRows, shopsToCSVRows, productsToCSVRows,
         carDetailRows, carIds, fmtNum } from "../../utils/helpers";
import { format, addMonths, subMonths, startOfMonth, endOfMonth,
         eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval,
         parseISO, startOfWeek, endOfWeek } from "date-fns";

// ── CALENDAR RANGE PICKER ─────────────────────────────────
function CalendarPicker({ startDate, endDate, onChange, onClose }) {
  const [viewMonth, setViewMonth] = useState(startDate ? parseISO(startDate) : new Date());
  const [selecting, setSelecting] = useState("start");
  const [hoverDate, setHoverDate] = useState(null);

  const start = startDate ? parseISO(startDate) : null;
  const end   = endDate   ? parseISO(endDate)   : null;

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth),     { weekStartsOn: 1 }),
  });

  const handleDayClick = (day) => {
    const ds = format(day, "yyyy-MM-dd");
    if (selecting === "start") {
      onChange(ds, ds);
      setSelecting("end");
    } else {
      const s = start;
      if (day < s) {
        onChange(ds, format(s, "yyyy-MM-dd"));
      } else {
        onChange(format(s, "yyyy-MM-dd"), ds);
      }
      setSelecting("start");
      onClose();
    }
  };

  const isInRange = (day) => {
    if (!start) return false;
    const compareEnd = hoverDate && selecting === "end" ? hoverDate : end;
    if (!compareEnd) return false;
    const rangeStart = start < compareEnd ? start : compareEnd;
    const rangeEnd   = start < compareEnd ? compareEnd : start;
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  };

  const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div style={CAL.wrap}>
      <div style={CAL.header}>
        <button style={CAL.navBtn} onClick={() => setViewMonth(m => subMonths(m, 1))}>‹</button>
        <span style={CAL.monthLabel}>{format(viewMonth, "MMMM yyyy")}</span>
        <button style={CAL.navBtn} onClick={() => setViewMonth(m => addMonths(m, 1))}>›</button>
      </div>
      <div style={CAL.info}>
        {selecting === "start" ? "Select start date" : "Select end date"}
      </div>
      <div style={CAL.grid}>
        {DAYS.map(d => <div key={d} style={CAL.dayHeader}>{d}</div>)}
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isStart = start && isSameDay(day, start);
          const isEnd   = end   && isSameDay(day, end);
          const inRange = isInRange(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={i}
              style={{
                ...CAL.day,
                opacity:      inMonth ? 1 : 0.25,
                background:   isStart || isEnd ? "#1A1A2E" : inRange ? "#E5DDD0" : "transparent",
                color:        isStart || isEnd ? "#C9A84C" : isToday ? "#C9A84C" : "#333",
                fontWeight:   isStart || isEnd ? 700 : 400,
                borderRadius: isStart ? "50% 0 0 50%" : isEnd ? "0 50% 50% 0" : inRange ? 0 : 6,
              }}
              onClick={() => inMonth && handleDayClick(day)}
              onMouseEnter={() => setHoverDate(day)}
              onMouseLeave={() => setHoverDate(null)}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
      <div style={CAL.footer}>
        <button style={CAL.quickBtn} onClick={() => { const t = todayStr(); onChange(t, t); onClose(); }}>Today</button>
        <button style={CAL.quickBtn} onClick={() => { const r = weekRange();  onChange(r.start, r.end); onClose(); }}>This Week</button>
        <button style={CAL.quickBtn} onClick={() => { const r = monthRange(); onChange(r.start, r.end); onClose(); }}>This Month</button>
        <button style={CAL.quickBtn} onClick={() => { const r = yearRange();  onChange(r.start, r.end); onClose(); }}>This Year</button>
      </div>
    </div>
  );
}

const CAL = {
  wrap:       { background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", width: 280, zIndex: 100 },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  navBtn:     { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#1A1A2E", padding: "0 8px", fontFamily: "'Playfair Display',serif" },
  monthLabel: { fontWeight: 700, fontSize: 14, color: "#1A1A2E", fontFamily: "'Playfair Display',serif" },
  info:       { textAlign: "center", fontSize: 12, color: "#C9A84C", fontWeight: 600, marginBottom: 8 },
  grid:       { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 },
  dayHeader:  { textAlign: "center", fontSize: 11, fontWeight: 600, color: "#C4B5A5", padding: "4px 0" },
  day:        { textAlign: "center", fontSize: 12, padding: "6px 2px", cursor: "pointer", userSelect: "none" },
  footer:     { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, borderTop: "1px solid #F0E0CC", paddingTop: 10 },
  quickBtn:   { flex: 1, background: "#FAF7F2", border: "1px solid #C8973A", color: "#1A1A2E", borderRadius: 8, padding: "5px 4px", cursor: "pointer", fontSize: 11, fontWeight: 600, textAlign: "center" },
};

// ── MAIN PAGE ─────────────────────────────────────────────
export default function ReportsPage() {
  const today = todayStr();
  const [startDate,   setStartDate]   = useState(today);
  const [endDate,     setEndDate]     = useState(today);
  const [showCal,     setShowCal]     = useState(false);
  const [sales,       setSales]       = useState([]);
  const [products,    setProducts]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  const [filterCar,   setFilterCar]   = useState(null);
  const calRef = useRef(null);

  // ── Close calendar on outside click ───────────────────
  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── AUTO-LOAD on mount (fixes the "report not coming" bug) ──
  // Without this useEffect, the page renders but load() is never called.
  // eslint-disable-next-line
  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, a] = await Promise.all([
        getSalesByDateRange(startDate, endDate),
        getAllProducts(),
        getAssignmentsByDate(startDate),
      ]);
      setSales(s);
      setProducts(p);
      setAssignments(a);
      setLoaded(true);
    } catch (err) {
      toast.error("Failed to load report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Over-assignment alerts ────────────────────────────
  const carProductSold = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const sq = parseInt(item.saleQty, 10) || 0;
      if (sq <= 0) return;
      const key = `${sale.carId}_${item.productId || item.productName}`;
      if (!carProductSold[key]) {
        carProductSold[key] = {
          carId: sale.carId, carName: sale.carName || sale.carId,
          salesperson: sale.salespersonName || "—",
          productId: item.productId || item.productName,
          productName: item.productName,
          assignedQty: parseInt(item.assignedQty, 10) || 0,
          totalSold: 0, shops: [], isExtra: item.isExtra || false,
        };
      }
      carProductSold[key].totalSold += sq;
      carProductSold[key].shops.push(`${sale.shopName}(${sq})`);
      const aq = parseInt(item.assignedQty, 10) || 0;
      if (aq > carProductSold[key].assignedQty) carProductSold[key].assignedQty = aq;
      if (item.isExtra) carProductSold[key].isExtra = true;
    });
  });

  const overAssignAlerts = Object.values(carProductSold)
    .filter(cp => (cp.assignedQty > 0 && cp.totalSold > cp.assignedQty) || (cp.isExtra && cp.totalSold > 0))
    .map(cp => ({
      date: sales[0]?.date || "", car: cp.carName, salesperson: cp.salesperson,
      productName: cp.productName, assignedQty: cp.assignedQty, totalSold: cp.totalSold,
      excess: cp.totalSold - cp.assignedQty, shops: cp.shops.join(" + "),
      alertType: cp.isExtra ? "NOT ASSIGNED" : "OVER TOTAL",
    }))
    .sort((a, b) => b.excess - a.excess);

  const perShopAlerts = sales.flatMap(sale =>
    (sale.items || [])
      .filter(item => {
        const sq = parseInt(item.saleQty, 10) || 0;
        const aq = parseInt(item.assignedQty, 10) || 0;
        return sq > 0 && aq > 0 && sq > aq && !item.isExtra;
      })
      .map(item => ({
        date: sale.date, car: sale.carName || sale.carId,
        salesperson: sale.salespersonName || "—", shopName: sale.shopName,
        productName: item.productName,
        assignedQty: parseInt(item.assignedQty, 10) || 0,
        soldQty: parseInt(item.saleQty, 10) || 0,
        excess: (parseInt(item.saleQty, 10) || 0) - (parseInt(item.assignedQty, 10) || 0),
        alertType: "OVER SHOP",
      }))
  );

  // ── Exports ───────────────────────────────────────────
  const fileTag = startDate === endDate ? startDate : `${startDate}_${endDate}`;

  const exportCarSummary = () => {
    const ids = carIds(sales);
    if (!ids.length) { alert("No data"); return; }
    ids.forEach(carId => {
      const carSales = sales.filter(s => s.carId === carId);
      const carName  = carSales[0]?.carName || carId;
      const rows     = carDetailRows(sales, products, carId);
      if (rows.length) exportCSV(rows, `QB_Car_${carName}_${fileTag}.csv`);
    });
    toast.success(`Exported ${ids.length} car report${ids.length > 1 ? "s" : ""}!`);
  };

  const exportAlerts = () => {
    const all = [...overAssignAlerts, ...perShopAlerts];
    if (!all.length) { alert("No over-assignment issues found"); return; }
    exportCSV(all, `QB_OverAssignment_${fileTag}.csv`);
  };

  // ── Summary stats (filter-aware) ──────────────────────
  const filteredForStats = filterCar ? sales.filter(s => s.carId === filterCar) : sales;
  const totalRevenue  = filteredForStats.reduce((s, r) => s + (r.total      || 0), 0);
  const totalShops    = new Set(filteredForStats.map(r => r.customerId)).size;
  const totalCars     = new Set(sales.map(r => r.carId)).size; // always all cars
  const totalReturns  = filteredForStats.reduce((s, r) => s + (r.returnTotal || 0), 0);
  const totalDiscount = filteredForStats.reduce((s, r) => s + (r.discountAmt || 0), 0);

  const displayRange = startDate === endDate
    ? formatDisplay(startDate)
    : `${formatDisplay(startDate)} → ${formatDisplay(endDate)}`;

  return (
    <div style={S.root}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Sales Reports</h2>
          <p style={S.sub}>{displayRange}</p>
        </div>
        <button style={S.loadBtn} onClick={load} disabled={loading}>
          {loading ? "Loading…" : "↺ Refresh"}
        </button>
      </div>

      {/* ── Calendar date picker ── */}
      <div style={{ marginBottom: 16, position: "relative" }} ref={calRef}>
        <div style={S.dateBar} onClick={() => setShowCal(v => !v)}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="#C9A84C" strokeWidth="1.3"/>
            <path d="M5 1v4M11 1v4M1 7h14" stroke="#C9A84C" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 600, color: "#1A1A2E", fontFamily: "'Playfair Display',serif" }}>
            {displayRange}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#C4B5A5" }}>
            Click to change ▾
          </span>
        </div>
        {showCal && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200 }}>
            <CalendarPicker
              startDate={startDate} endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              onClose={() => setShowCal(false)}
            />
          </div>
        )}
      </div>

      {/* ── Load button (secondary, below date bar) ── */}
      <div style={{ marginBottom: 16 }}>
        <button
          style={{ ...S.loadBtn, fontSize: 13, padding: "9px 20px" }}
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load Report"}
        </button>
        {loaded && !loading && (
          <span style={{ marginLeft: 12, fontSize: 12, color: "#6B6B6B" }}>
            {sales.length} transactions for {displayRange}
          </span>
        )}
      </div>

      {/* ── Loading spinner / empty ── */}
      {loading && (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          <p style={{ color: "#6B6B6B", margin: "12px 0 0", fontSize: 14 }}>
            Loading report for {displayRange}…
          </p>
        </div>
      )}

      {/* ── Over-assignment alert banner ── */}
      {loaded && !loading && (overAssignAlerts.length + perShopAlerts.length) > 0 && (
        <div style={S.alertBanner}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#A67C3A" }}>
                ⚠️ {overAssignAlerts.length} Over-Assignment {overAssignAlerts.length === 1 ? "Issue" : "Issues"} Detected
              </div>
              <div style={{ fontSize: 12, color: "#6B6B6B" }}>
                Salesperson sold more than assigned quantity
              </div>
            </div>
            <button style={S.alertExportBtn} onClick={exportAlerts}>
              ↓ Export Alert Report
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {overAssignAlerts.slice(0, 5).map((a, i) => (
              <div key={i} style={S.alertRow}>
                <span style={{ fontWeight: 600, color: "#1A1A2E" }}>{a.salesperson} · {a.car}</span>
                <span style={{ color: "#A67C3A", fontWeight: 600 }}>{a.productName}</span>
                <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                  Assigned: {a.assignedQty} · Sold: {a.totalSold}
                </span>
                <span style={{ fontWeight: 700, color: "#DC2626" }}>+{a.excess} extra</span>
              </div>
            ))}
            {overAssignAlerts.length > 5 && (
              <div style={{ fontSize: 12, color: "#A67C3A", textAlign: "center" }}>
                +{overAssignAlerts.length - 5} more — export CSV to see all
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export row removed — use per-car 3-sheet export in the car filter below */}

      {/* ── Stat Cards (update when car filter changes) ── */}
      {loaded && !loading && sales.length > 0 && (
        <div style={S.cards}>
          <StatCard label="Total Revenue"  value={`${fmtNum(totalRevenue)} Ks`}  green />
          <StatCard label="Shops Visited"  value={totalShops} />
          <StatCard label="Cars Active"    value={totalCars} />
          <StatCard label="Total Returns"  value={`${fmtNum(totalReturns)} Ks`}  red />
          <StatCard label="Total Discount" value={`${fmtNum(totalDiscount)} Ks`} amber />
        </div>
      )}

      {/* ── Car Filter + 3-Sheet Export ── */}
      {loaded && !loading && sales.length > 0 && (() => {
        const carList = [...new Map(
          sales.map(s => [s.carId, { carId: s.carId, carName: s.carName || s.carId, salesperson: s.salespersonName || "" }])
        ).values()];
        const selectedCarName = filterCar ? (sales.find(s => s.carId === filterCar)?.carName || filterCar) : null;
        const fileTag = startDate === endDate ? startDate : `${startDate}_${endDate}`;
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: filterCar ? 10 : 0 }}>
              <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 600, letterSpacing: "0.4px", textTransform:"uppercase" }}>Filter by Car:</span>
              <button
                style={{ ...S.carFilterBtn, background: !filterCar ? "#1A1A2E" : "#fff", color: !filterCar ? "#C9A84C" : "#1A1A2E", border: !filterCar ? "1.5px solid #1A1A2E" : "1.5px solid #C9A84C" }}
                onClick={() => setFilterCar(null)}>
                All Cars
              </button>
              {carList.map(car => (
                <button key={car.carId}
                  style={{ ...S.carFilterBtn, background: filterCar === car.carId ? "#1A1A2E" : "#fff", color: filterCar === car.carId ? "#C9A84C" : "#1A1A2E", border: filterCar === car.carId ? "1.5px solid #1A1A2E" : "1.5px solid #C9A84C" }}
                  onClick={() => setFilterCar(filterCar === car.carId ? null : car.carId)}>
                  {car.carName} · {car.salesperson}
                </button>
              ))}
            </div>
            {/* 3-sheet export when a car is selected */}
            {filterCar && (
              <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(201,168,76,0.07)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:8, padding:"10px 16px" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="10" height="13" rx="1.5" stroke="#C9A84C" strokeWidth="1.3"/>
                  <path d="M4 5h6M4 8h6M4 11h4" stroke="#C9A84C" strokeWidth="1.1" strokeLinecap="round"/>
                  <rect x="10" y="8" width="5" height="7" rx="1" fill="#C9A84C" opacity="0.2" stroke="#C9A84C" strokeWidth="1"/>
                </svg>
                <span style={{ fontSize: 13, color: "#1A1A2E", fontWeight: 600 }}>
                  {selectedCarName} · {sales.filter(s => s.carId === filterCar).length} transactions
                </span>
                <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
                  {/* Local save */}
                  <button
                    style={{ background:"#1A1A2E", color:"#C9A84C", border:"none", borderRadius:"8px 0 0 8px", padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:700 }}
                    onClick={() => {
                      const filteredSales = sales.filter(s => s.carId === filterCar);
                      exportCarExcel(filteredSales, products, assignments, filterCar, selectedCarName, fileTag);
                      toast.success(`Saved ${selectedCarName}.xlsx — 3 sheets`);
                    }}>
                    Save Excel
                  </button>
                  {/* Drive save */}
                  <button
                    style={{ background:"#1A1A2E", color:"#C9A84C", border:"none", borderLeft:"1px solid rgba(201,168,76,0.3)", borderRadius:"0 8px 8px 0", padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}
                    title="Save to Google Drive"
                    onClick={async () => {
                      try {
                        const filteredSales = sales.filter(s => s.carId === filterCar);
                        const result = exportCarExcel(filteredSales, products, assignments, filterCar, selectedCarName, fileTag, true);
                        const { uploadExcelToDrive: upDrive } = await import("../../utils/driveExport");
                        toast("Uploading to Drive…", { duration: 60000, id:"drive-up" });
                        const url = await upDrive(result.buffer, result.fileName);
                        toast.dismiss("drive-up");
                        toast.success(
                          <div>
                            <div style={{ fontWeight:700 }}>Saved to Google Drive!</div>
                            <a href={url} target="_blank" rel="noreferrer" style={{ color:"#2D7A4F", fontSize:12 }}>
                              Open {selectedCarName} →
                            </a>
                          </div>, { duration: 8000 });
                      } catch(e) { toast.dismiss("drive-up"); toast.error("Drive upload failed: " + e.message); }
                    }}>
                    Drive
                  </button>
                </div>
                <span style={{ fontSize:10, color:"#C4B5A5" }}>Detailed · Shop Summary · Product Summary</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Sales Table ── */}
      {loaded && !loading && (() => {
        const filteredSales = filterCar ? sales.filter(s => s.carId === filterCar) : sales;
        if (filteredSales.length === 0) {
          return (
            <div style={S.empty}>
              <div style={{ marginBottom: 12, opacity: 0.3 }}>
                <svg width="48" height="48" viewBox="0 0 16 16" fill="none">
                  <path d="M1 13h3v2H1v-2zm4-6h3v8H5V7zm4-3h3v11H9V4zm4-3h3v14h-3V1z" fill="#C9A84C"/>
                </svg>
              </div>
              <p>No sales found for {displayRange}</p>
            </div>
          );
        }
        return (
          <div style={S.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6B6B6B" }}>
              {filteredSales.length} transactions · {displayRange}
              {filterCar && (
                <span style={{ marginLeft: 8, background: "rgba(201,168,76,0.1)", padding: "2px 10px", borderRadius: 8, color: "#A67C3A", fontWeight: 600, fontSize:11 }}>
                  {sales.find(s => s.carId === filterCar)?.carName}
                </span>
              )}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Invoice</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Car</th>
                    <th style={S.th}>Salesperson</th>
                    <th style={S.th}>Shop</th>
                    <th style={S.th}>Sub Total</th>
                    <th style={S.th}>Returns</th>
                    <th style={S.th}>Discount</th>
                    <th style={S.th}>Net Total</th>
                    <th style={S.th}>Save / Print</th>
                    <th style={S.th}>Alert</th>
                    <th style={S.th}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => {
                    const hasAlert =
                      overAssignAlerts.some(a => a.car === (s.carName || s.carId) && (s.items || []).some(i => i.productName === a.productName)) ||
                      perShopAlerts.some(a => a.shopName === s.shopName && (s.items || []).some(i => i.productName === a.productName));
                    return (
                      <tr key={s.id} style={{ ...S.tr, background: hasAlert ? "#FFFBEB" : "transparent" }}>
                        <td style={{ ...S.td, fontSize: 11, color: "#C9A84C", fontFamily: "monospace" }}>{s.invoiceNo || "—"}</td>
                        <td style={S.td}>{formatDisplay(s.date)}</td>
                        <td style={S.td}>{s.carName || s.carId}</td>
                        <td style={S.td}>{s.salespersonName || "—"}</td>
                        <td style={S.td}>{s.shopName || s.customerId}</td>
                        <td style={S.td}>{fmtNum(s.subTotal)} Ks</td>
                        <td style={{ ...S.td, color: "#DC2626" }}>{fmtNum(s.returnTotal)} Ks</td>
                        <td style={{ ...S.td, color: "#A67C3A" }}>{s.discountPct}%</td>
                        <td style={{ ...S.td, fontWeight: 700, color: "#1A1A2E" }}>{fmtNum(s.total)} Ks</td>
                        <td style={{ ...S.td }}>
                          {/* Save count + last save time */}
                          <div style={{ fontSize: 11, color: "#555", display:"flex", alignItems:"center", gap:4 }}>
                            <span>💾</span>
                            <span style={{ fontWeight: 600 }}>{s.saveCount || 1}×</span>
                            {s.updatedAt?.toDate &&
                              <span style={{ color: "#999" }}>
                                · {s.updatedAt.toDate().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                              </span>}
                          </div>
                          {/* Print count — only shown when > 0 */}
                          {(s.printCount || 0) > 0 &&
                            <div style={{ fontSize: 11, color: "#2D7A4F", fontWeight: 600, display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                              <span>🖨</span>
                              <span>{s.printCount}×</span>
                            </div>}
                        </td>
                        <td style={S.td}>
                          {hasAlert && <span style={S.alertPill}>⚠️ Over</span>}
                        </td>
                        <td style={S.td}>
                          <button
                            style={{ background: "#FEE2E2", border: "none", color: "#DC2626", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                            onClick={async () => {
                              if (!window.confirm(`Delete sale ${s.invoiceNo}?\nThis cannot be undone.`)) return;
                              await deleteSale(s.id);
                              setSales(prev => prev.filter(x => x.id !== s.id));
                              toast.success("Sale deleted");
                            }}>
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Prompt before first load ── */}
      {!loaded && !loading && (
        <div style={S.empty}>
          <div style={{ marginBottom: 12, opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 16 16" fill="none">
              <path d="M1 13h3v2H1v-2zm4-6h3v8H5V7zm4-3h3v11H9V4zm4-3h3v14h-3V1z" fill="#C9A84C"/>
            </svg>
          </div>
          <p style={{ color: "#6B6B6B" }}>
            Pick a date range above and click <b>Load Report</b>
          </p>
        </div>
      )}
    </div>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────

function CarExportButton({ sales, products, fileTag, exportCarSummary }) {
  const [showMenu, setShowMenu] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const downloadAllExcel = () => {
    exportCarSummary();
    setShowMenu(false);
  };

  const uploadAllToDrive = async () => {
    setShowMenu(false);
    setUploading(true);
    try {
      const { uploadToDrive, rowsToCSV } = await import("../../utils/driveExport");
      const { carIds: getCarIds, carDetailRows: getCarDetailRows } = await import("../../utils/helpers");
      const ids = getCarIds(sales);
      if (!ids.length) { toast.error("No data"); return; }
      const links = [];
      for (const carId of ids) {
        const carSales = sales.filter(s => s.carId === carId);
        const carName  = carSales[0]?.carName || carId;
        const rows     = getCarDetailRows(sales, products, carId);
        if (!rows.length) continue;
        const csv = rowsToCSV(rows);
        const url = await uploadToDrive(csv, `QB_Car_${carName}_${fileTag}.csv`);
        links.push({ carName, url });
      }
      toast.success(
        <div>
          <div style={{ fontWeight: 600 }}>Saved {links.length} car reports to Drive!</div>
          {links.map(l => (
            <a key={l.carName} href={l.url} target="_blank" rel="noreferrer"
              style={{ color: "#2D7A4F", fontSize: 12, display: "block", marginTop: 3 }}>
              Open {l.carName} →
            </a>
          ))}
        </div>,
        { duration: 8000 }
      );
    } catch (e) {
      toast.error("Drive upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ display: "flex" }}>
        <button style={{ ...SB.mainBtn }} onClick={downloadAllExcel} disabled={uploading}>
          {uploading ? "⏳ Uploading…" : "↓ Per-Car Excel"}
        </button>
        <button style={{ ...SB.chevronBtn }} onClick={() => setShowMenu(v => !v)} disabled={uploading}>▾</button>
      </div>
      {showMenu && (
        <>
          <div style={SB.backdrop} onClick={() => setShowMenu(false)} />
          <div style={SB.menu}>
            <button style={SB.menuItem} onClick={() => { setShowMenu(false); exportCarSummary(); }}>
              <span style={{ fontSize: 16 }}>💾</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Download to device</div>
                <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 1 }}>One file per car in Downloads</div>
              </div>
            </button>
            <div style={SB.divider} />
            <button style={SB.menuItem} onClick={uploadAllToDrive}>
              <span style={{ fontSize: 16 }}>☁️</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Save all to Google Drive</div>
                <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 1 }}>All car files → QB_Reports folder</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const SB = {
  mainBtn:   { background: "#1A1A2E", color: "#C9A84C", border: "none", borderRadius: "8px 0 0 8px", padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  chevronBtn:{ background: "#1A1A2E", color: "#C9A84C", border: "none", borderLeft: "1px solid rgba(201,168,76,0.3)", borderRadius: "0 8px 8px 0", padding: "9px 10px", cursor: "pointer", fontSize: 12 },
  backdrop:  { position: "fixed", inset: 0, zIndex: 99 },
  menu:      { position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", borderRadius: 8, boxShadow: "0 8px 28px rgba(0,0,0,0.15)", border: "1px solid #F0E0CC", zIndex: 100, minWidth: 230, overflow: "hidden" },
  menuItem:  { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "#333" },
  divider:   { height: 1, background: "#E5DDD0", margin: "0 12px" },
};

function StatCard({ label, value, green, red, amber }) {
  const color = green ? "#2D7A4F" : red ? "#A32D2D" : amber ? "#A67C3A" : "#1A1A2E";
  const top   = green ? "#2D7A4F" : red ? "#A32D2D" : amber ? "#C9A84C" : "#C9A84C";
  return (
    <div style={{...S.statCard, borderTop:`2px solid ${top}`}}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'Playfair Display',serif", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.8px" }}>
        {label}
      </div>
    </div>
  );
}

const S = {
  root:          { fontFamily: "'Inter',sans-serif" },
  header:        { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  h2:            { margin: 0, fontSize: 22, fontWeight: 700, color: "#1A1A2E", fontFamily: "'Playfair Display',serif" },
  sub:           { margin: "4px 0 0", fontSize: 12, color: "#6B6B6B" },
  loadBtn:       { background: "#1A1A2E", color: "#C9A84C", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "'Inter',sans-serif" },
  dateBar:       { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E5DDD0", borderRadius: 8, padding: "12px 16px", cursor: "pointer", userSelect: "none" },
  loadingBox:    { textAlign: "center", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center" },
  spinner:       { width: 32, height: 32, border: "3px solid #E5DDD0", borderTop: "3px solid #C9A84C", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  alertBanner:   { background: "#FAF7F2", border: "1.5px solid #F59E0B", borderRadius: 8, padding: "14px 18px", marginBottom: 16 },
  alertExportBtn:{ background: "#A67C3A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 },
  alertRow:      { display: "flex", gap: 12, alignItems: "center", background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "7px 12px", fontSize: 13, flexWrap: "wrap" },
  alertPill:     { background: "#FEF2E8", color: "#A32D2D", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4 },
  exportRow:     { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center", background: "#fff", borderRadius: 8, padding: "14px 18px", boxShadow: "0 2px 8px rgba(92,51,23,0.08)", border: "1px solid #E5DDD0" },
  cards:         { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 },
  statCard:      { background: "#fff", borderRadius: 8, padding: 16, textAlign: "center", border: "1px solid #E5DDD0", borderTop: "2px solid #C9A84C" },
  card:          { background: "#fff", border: "1px solid #E5DDD0", borderRadius: 8, padding: 16, marginBottom: 14 },
  table:         { width: "100%", borderCollapse: "collapse", minWidth: 700 },
  thead:         { background: "#1A1A2E" },
  th:            { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.6px", whiteSpace: "nowrap" },
  tr:            { borderBottom: "1px solid #F0E8DC" },
  td:            { padding: "9px 12px", fontSize: 13 },
  empty:         { textAlign: "center", color: "#C4B5A5", marginTop: 40, padding: "40px 0", fontSize: 15 },
  carFilterBtn:  { border: "1px solid #E5DDD0", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "'Inter',sans-serif" },
};

// Inject spinner CSS into document head (runs once)
if (typeof document !== "undefined" && !document.getElementById("qb-spinner-css")) {
  const style = document.createElement("style");
  style.id = "qb-spinner-css";
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
