import toast from "react-hot-toast";
// src/pages/admin/DayReportsAdminPage.js  ← FIXED: export button color + style alignment
import React, { useEffect, useState } from "react";
import { todayStr, formatDisplay, fmtNum, exportCSV } from "../../utils/helpers";
import { getDailyReportsByDate, getAssignmentsByDate, getAllCars, deleteDailyReport } from "../../services/firestoreService";

export default function DayReportsAdminPage() {
  const [date, setDate]               = useState(todayStr());
  const [reports, setReports]         = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [cars, setCars]               = useState([]);
  const [loading, setLoading]         = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, a, c] = await Promise.all([
      getDailyReportsByDate(date),
      getAssignmentsByDate(date),
      getAllCars(),
    ]);
    setReports(r); setAssignments(a); setCars(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, [date]);

  // Build assigned qty per car per product
  const assignedMap = {};
  assignments.forEach(a => {
    Object.entries(a.items || {}).forEach(([pid, qty]) => {
      assignedMap[`${a.carId}_${pid}`] = qty;
    });
  });

  // Export day report as CSV
  const exportDayReport = (report) => {
    const rows = (report.productSummary || []).map(p => ({
      date,
      car:         report.carName,
      salesperson: report.salespersonName,
      product:     p.name,
      sold:        p.sold,
      returned:    p.returned || 0,
      revenue:     p.revenue,
      isExtra:     p.isExtra ? "YES" : "NO",
    }));
    exportCSV(rows, `QB_DayReport_${report.carName}_${date}.csv`);
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>Day Reports</h2>
          <p style={S.sub}>{formatDisplay(date)}</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.datePicker} />
      </div>

      {loading ? (
        <p style={{ color: "#6B6B6B" }}>Loading…</p>
      ) : reports.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 48 }}>📭</div>
          <p>No reports submitted for {formatDisplay(date)} yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reports.map((r, i) => (
            <div key={i} style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <div style={S.carName}>{r.carName} · {r.salespersonName}</div>
                  <div style={S.submitted}>
                    Submitted · {r.submittedAt?.toDate?.()?.toLocaleTimeString() || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {/* ── FIXED: export button was color:"#C9A84C" on gold bg = invisible ── */}
                  <button style={S.exportBtn} onClick={() => exportDayReport(r)}>
                    ↓ Export CSV
                  </button>
                  <button
                    style={S.deleteBtn}
                    onClick={async () => {
                      if (!window.confirm(`Delete day report for ${r.carName} on ${date}?`)) return;
                      await deleteDailyReport(date, r.carId);
                      setReports(prev => prev.filter(x => x.id !== r.id));
                      toast.success("Day report deleted");
                    }}>
                    🗑 Delete
                  </button>
                  <div style={S.statusBadge}>✅ Submitted</div>
                </div>
              </div>

              <div style={S.stats}>
                <StatBox label="Shops Visited" value={r.shopsVisited} />
                <StatBox label="Revenue"        value={`${fmtNum(r.totalRevenue)} Ks`} green />
                <StatBox label="Returns"        value={`${fmtNum(r.totalReturns)} Ks`} red />
                <StatBox label="Discount"       value={`${fmtNum(r.totalDisc)} Ks`} />
              </div>

              {r.productSummary?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.secTitle}>Product Summary</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr style={S.thead}>
                          <th style={S.th}>Product</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Sold</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Returned</th>
                          <th style={{ ...S.th, textAlign: "center" }}>Remain</th>
                          <th style={{ ...S.th, textAlign: "right" }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.productSummary.map((p, j) => {
                          const assignedQty = assignedMap[`${r.carId}_${p.productId}`] || 0;
                          const remainQty   = Math.max(0, assignedQty - (p.sold || 0) + (p.returned || 0));
                          return (
                            <tr key={j} style={S.tr}>
                              <td style={S.td}>
                                {p.name}
                                {p.isExtra && <span style={S.extraTag}>⚠️ Extra</span>}
                              </td>
                              <td style={{ ...S.td, textAlign: "center" }}>{p.sold}</td>
                              <td style={{ ...S.td, textAlign: "center", color: "#DC2626" }}>
                                {p.returned || "—"}
                              </td>
                              <td style={{ ...S.td, textAlign: "center", fontWeight: remainQty > 0 ? 700 : 400, color: remainQty > 0 ? "#1A1A2E" : "#aaa" }}>
                                {assignedQty > 0 ? remainQty : "—"}
                              </td>
                              <td style={{ ...S.td, textAlign: "right", color: "#2D7A4F", fontWeight: 600 }}>
                                {fmtNum(p.revenue)} Ks
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {r.note && (
                <div style={S.note}><b>Note:</b> {r.note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, green, red }) {
  return (
    <div style={S.statBox}>
      <div style={{ fontSize: 16, fontWeight: 700, color: red ? "#DC2626" : "#1A1A2E" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const S = {
  root:        { fontFamily: "'Inter',sans-serif" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  h2:          { margin: 0, fontSize: 22, fontWeight: 700, color: "#1A1A2E", fontFamily: "'Playfair Display',serif" },
  sub:         { margin: "4px 0 0", fontSize: 12, color: "#6B6B6B" },
  datePicker:  { border: "1px solid #E5DDD0", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", background: "#FAF7F2" },
  empty:       { textAlign: "center", marginTop: 60, color: "#6B6B6B" },
  card:        { background: "#fff", borderRadius: 8, padding: 20, border: "1px solid #E5DDD0" },
  cardHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 },
  carName:     { fontSize: 16, fontWeight: 700, color: "#1A1A2E", fontFamily: "'Playfair Display',serif" },
  submitted:   { fontSize: 12, color: "#6B6B6B", marginTop: 3 },
  statusBadge: { background: "#F0F7F2", color: "#2D7A4F", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600 },
  // ── FIXED: was background:"#C9A84C" color:"#C9A84C" → gold text on gold bg = invisible
  exportBtn:   { background: "#C9A84C", color: "#1A1A2E", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  deleteBtn:   { background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  stats:       { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 },
  statBox:     { background: "#FAF7F2", borderRadius: 6, padding: "10px 8px", textAlign: "center" },
  secTitle:    { fontSize: 12, fontWeight: 600, color: "#6B6B6B", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px" },
  table:       { width: "100%", borderCollapse: "collapse", minWidth: 500 },
  thead:       { background: "#1A1A2E" },
  th:          { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#C9A84C", borderBottom: "2px solid #E8D5C0", textAlign: "left", letterSpacing: "0.5px" },
  tr:          { borderBottom: "1px solid #F5E8D8" },
  td:          { padding: "8px 12px", fontSize: 13 },
  extraTag:    { marginLeft: 6, fontSize: 10, background: "#FAF7F2", color: "#A67C3A", padding: "2px 6px", borderRadius: 8, fontWeight: 700 },
  note:        { marginTop: 12, background: "#FAF7F2", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#555", borderLeft: "3px solid #C9A84C" },
};
