// src/pages/salesperson/DayReportPage.js
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { todayStr, formatDisplay, fmtNum } from "../../utils/helpers";
import {
  getSalesByDateAndCar, submitDailyReport,
  getDailyReport, getAssignment
} from "../../services/firestoreService";
import toast from "react-hot-toast";

export default function DayReportPage() {
  const { profile } = useAuth();
  const today = todayStr();

  const [sales, setSales]           = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [report, setReport]         = useState(null);
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.carId) return;
    setLoading(true);
    const [s, a, r] = await Promise.all([
      getSalesByDateAndCar(today, profile.carId),
      getAssignment(today, profile.carId),
      getDailyReport(today, profile.carId),
    ]);
    setSales(s);
    setAssignment(a);
    setReport(r);
    if (r?.note) setNote(r.note);
    setLoading(false);
  }, [profile, today]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────
  const totalRevenue = sales.reduce((s,r) => s+(r.total||0), 0);
  const totalReturns = sales.reduce((s,r) => s+(r.returnTotal||0), 0);
  const totalDisc    = sales.reduce((s,r) => s+(r.discountAmt||0), 0);
  const shopsVisited = sales.length;

  // Product breakdown
  const productMap = {};
  sales.forEach(sale => {
    (sale.items||[]).forEach(item => {
      if (!productMap[item.productName])
        productMap[item.productName] = { sold:0, returned:0, revenue:0, isExtra: item.isExtra||false };
      productMap[item.productName].sold     += item.saleQty   || 0;
      productMap[item.productName].returned += item.returnQty || 0;
      productMap[item.productName].revenue  += (item.saleQty||0) * item.pricePerPiece;
      if (item.isExtra) productMap[item.productName].isExtra = true;
    });
  });
  const productRows = Object.entries(productMap)
    .map(([name,v]) => ({name,...v}))
    .sort((a,b) => b.revenue - a.revenue);

  // ── Key logic: when can we submit/resubmit? ───────────────
  // Always allow submission if there are sales
  // Allow resubmission anytime — salesperson may have corrected a shop
  const canSubmit = sales.length > 0;
  const isResubmit = report?.status === "submitted";

  // Check if sales were updated AFTER last submission
  const lastSubmitTime  = report?.submittedAt?.toDate?.()?.getTime() || 0;
  const lastSaleUpdated = sales.reduce((max, s) => {
    const t = s.updatedAt?.toDate?.()?.getTime() || s.createdAt?.toDate?.()?.getTime() || 0;
    return Math.max(max, t);
  }, 0);
  const hasUpdatedSince = lastSaleUpdated > lastSubmitTime;

  const handleSubmit = async () => {
    setShowConfirm(false);
    if (!profile?.carId) return;
    setSubmitting(true);
    try {
      await submitDailyReport(today, profile.carId, {
        carName:         assignment?.carName || "",
        salespersonName: profile.name || "",
        shopsVisited,
        totalRevenue,
        totalReturns,
        totalDisc,
        productSummary: productRows,
        saleIds:        sales.map(s => s.id),
        note,
        status:         "submitted",
        resubmitted:    isResubmit,
      });
      toast.success(isResubmit
        ? "Report re-submitted successfully! ✅"
        : "Day report submitted to manager! ✅"
      );
      load();
    } catch(e) {
      toast.error("Submit failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile?.carId) return (
    <div style={S.center}>
      <p style={{color:"#6B6B6B"}}>No car assigned to your account.</p>
    </div>
  );

  if (loading) return (
    <div style={S.center}><p style={{color:"#6B6B6B"}}>Loading…</p></div>
  );

  return (
    <div style={S.root}>

      {/* Confirm dialog */}
      {showConfirm && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <div style={{fontSize:36, textAlign:"center", marginBottom:12}}>
              {isResubmit ? "🔄" : "📤"}
            </div>
            <h3 style={S.modalTitle}>
              {isResubmit ? "Re-submit Report?" : "Submit Day Report?"}
            </h3>
            <p style={S.modalDesc}>
              {isResubmit
                ? "You already submitted a report today. This will replace it with the latest sales data. Your manager will see the updated version."
                : "This will send today's sales summary to your manager. You can re-submit later if you make changes."
              }
            </p>
            <div style={{marginTop:8, background:"#FAF7F2", borderRadius:10, padding:"12px 14px", fontSize:13}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:"#6B6B6B"}}>Shops visited</span>
                <b>{shopsVisited}</b>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:"#6B6B6B"}}>Total revenue</span>
                <b style={{color:"#2D7A4F"}}>{fmtNum(totalRevenue)} Ks</b>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"#6B6B6B"}}>Total returns</span>
                <b style={{color:"#DC2626"}}>{fmtNum(totalReturns)} Ks</b>
              </div>
            </div>
            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button style={S.confirmBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : isResubmit ? "Yes, Re-submit" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div>
          <h2 style={S.h2}>📊 Day Report</h2>
          <p style={S.date}>
            {formatDisplay(today)} · {assignment?.carName || profile?.carId}
          </p>
        </div>

        {/* Status + submit button */}
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6}}>
          {isResubmit && (
            <div style={S.submittedBadge}>
              ✅ Submitted at {report?.submittedAt?.toDate?.()?.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) || "—"}
            </div>
          )}
          {hasUpdatedSince && isResubmit && (
            <div style={S.updateBadge}>
              ⚡ Sales updated since last submission
            </div>
          )}
          {canSubmit && (
            <button
              style={{
                ...S.submitBtn,
                background: isResubmit ? "#C9A84C" : "#1A1A2E",
              }}
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
            >
              {isResubmit ? "🔄 Re-submit Report" : "📤 Submit to Manager"}
            </button>
          )}
        </div>
      </div>

      {sales.length === 0 ? (
        <div style={S.center}>
          <div style={{fontSize:48}}>🛒</div>
          <p style={{color:"#6B6B6B", marginTop:8}}>No sales recorded yet today.</p>
          <p style={{color:"#C4B5A5", fontSize:13}}>
            Complete your shop visits then come back to submit your report.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={S.cards}>
            <StatCard icon="🏪" label="Shops Visited"  value={shopsVisited} />
            <StatCard icon="💰" label="Total Revenue"  value={`${fmtNum(totalRevenue)} Ks`} green />
            <StatCard icon="↩️" label="Total Returns"  value={`${fmtNum(totalReturns)} Ks`} red />
            <StatCard icon="🏷️" label="Total Discount" value={`${fmtNum(totalDisc)} Ks`} />
          </div>

          {/* Product breakdown */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Product Summary</h3>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>Product</th>
                  <th style={{...S.th,textAlign:"center"}}>Sold</th>
                  <th style={{...S.th,textAlign:"center"}}>Returned</th>
                  <th style={{...S.th,textAlign:"right"}}>Revenue (Ks)</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((p,i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}><b>{p.name}</b></td>
                    <td style={{...S.td,textAlign:"center"}}>{p.sold}</td>
                    <td style={{...S.td,textAlign:"center",color:"#DC2626"}}>
                      {p.returned > 0 ? p.returned : "—"}
                    </td>
                    <td style={{...S.td,textAlign:"right",color:"#2D7A4F",fontWeight:600}}>
                      {fmtNum(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shop breakdown */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Shop Breakdown</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sales.map((sale,i) => (
                <div key={i} style={S.saleRow}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#1A1A2E"}}>
                      {sale.shopName}
                    </div>
                    <div style={{fontSize:12,color:"#6B6B6B",marginTop:2}}>
                      Discount {sale.discountPct}%
                      {sale.returnTotal > 0 && ` · Returns: ${fmtNum(sale.returnTotal)} Ks`}
                      {sale.invoiceNo && <span style={{marginLeft:8,color:"#C4B5A5"}}>#{sale.invoiceNo}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#2D7A4F"}}>
                      {fmtNum(sale.total)} Ks
                    </div>
                    <div style={{fontSize:11,color:"#C4B5A5"}}>
                      Sub: {fmtNum(sale.subTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Note to Manager (optional)</h3>
            <textarea
              style={S.textarea}
              placeholder="Any issues, corrections, or feedback for today…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {/* Total bar */}
          <div style={S.totalBar}>
            <span style={{fontSize:14,color:"rgba(255,255,255,0.8)"}}>
              Today's Net Revenue
            </span>
            <span style={{fontSize:22,fontWeight:700}}>
              {fmtNum(totalRevenue)} Ks
            </span>
          </div>

          {/* Bottom submit button */}
          {canSubmit && (
            <button
              style={{
                ...S.submitBtn,
                width:"100%", padding:14, fontSize:15, marginTop:4,
                background: isResubmit ? "#C9A84C" : "#1A1A2E",
              }}
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
            >
              {isResubmit ? "🔄 Re-submit Updated Report" : "📤 Submit Day Report to Manager"}
            </button>
          )}

          {isResubmit && (
            <p style={{textAlign:"center",fontSize:12,color:"#C4B5A5",marginTop:8}}>
              You can re-submit as many times as needed. Manager always sees the latest version.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, green, red }) {
  return (
    <div style={S.statCard}>
      <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:18,fontWeight:700,
        color:green?"#1A1A2E":red?"#DC2626":"#1A1A2E"}}>
        {value}
      </div>
      <div style={{fontSize:11,color:"#6B6B6B",marginTop:2}}>{label}</div>
    </div>
  );
}

const S = {
  root:          { padding:16, maxWidth:700, margin:"0 auto", fontFamily:"'Inter',sans-serif" },
  header:        { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 },
  h2:            { margin:0, fontSize:20, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  date:          { margin:"4px 0 0", fontSize:13, color:"#6B6B6B" },
  submittedBadge:{ background:"#F0F7F2", color:"#2D7A4F", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:600 },
  updateBadge:   { background:"#FAF7F2", color:"#A67C3A", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:600 },
  submitBtn:     { color:"#fff", border:"none", borderRadius:10, padding:"11px 22px", cursor:"pointer", fontSize:14, fontWeight:600 },
  center:        { textAlign:"center", marginTop:60, color:"#6B6B6B" },
  cards:         { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 },
  statCard:      { background:"#fff", borderRadius:8, padding:"14px 12px", textAlign:"center", border:"1px solid #E5DDD0" },
  card:          { background:"#fff", borderRadius:8, padding:16, border:"1px solid #E5DDD0", marginBottom:12 },
  cardTitle:     { margin:"0 0 12px", fontSize:14, fontWeight:700, color:"#1A1A2E" },
  table:         { width:"100%", borderCollapse:"collapse" },
  thead:         { background:"#1A1A2E" },
  th:            { padding:"8px 12px", fontSize:12, fontWeight:700, color:"#C9A84C", borderBottom:"2px solid #E8D5C0", textAlign:"left" },
  tr:            { borderBottom:"1px solid #F5E8D8" },
  td:            { padding:"9px 12px", fontSize:13 },
  saleRow:       { display:"flex", justifyContent:"space-between", background:"#FAF7F2", borderRadius:10, padding:"12px 14px" },
  textarea:      { width:"100%", padding:10, border:"1.5px solid #E8D5C0", borderRadius:10, fontSize:14, resize:"vertical", boxSizing:"border-box", background:"#FAF7F2", outline:"none", fontFamily:"'Inter',sans-serif" },
  totalBar:      { background:"#1A1A2E", color:"#fff", borderRadius:8, padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  // Confirm modal
  modalBg:       { position:"fixed", inset:0, background:"rgba(26,26,46,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  modal:         { background:"#fff", borderRadius:8, padding:28, width:"100%", maxWidth:380, boxShadow:"0 16px 48px rgba(0,0,0,0.2)" },
  modalTitle:    { margin:"0 0 8px", fontSize:17, fontWeight:700, color:"#1A1A2E", textAlign:"center" },
  modalDesc:     { fontSize:13, color:"#666", lineHeight:1.6, textAlign:"center", margin:"0 0 14px" },
  modalBtns:     { display:"flex", gap:10, marginTop:20 },
  cancelBtn:     { flex:1, background:"#F5F5F5", border:"none", borderRadius:10, padding:12, cursor:"pointer", fontSize:14, fontWeight:500 },
  confirmBtn:    { flex:1, background:"#1A1A2E", color:"#fff", border:"none", borderRadius:10, padding:12, cursor:"pointer", fontSize:14, fontWeight:600 },
};
