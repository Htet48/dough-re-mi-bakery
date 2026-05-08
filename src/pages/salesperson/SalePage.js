// src/pages/salesperson/SalePage.js — Mobile grid layout
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { todayStr, formatDisplay, calcReceipt, fmtNum, generateInvoiceNo } from "../../utils/helpers";
import { getAssignment, getAllCustomers, getAllProducts,
         addSale, getSalesByDate, getSalesByDateAndCar, updateSale,
         incrementSaveCount, incrementPrintCount } from "../../services/firestoreService";
import BarcodeScanner from "../../components/shared/BarcodeScanner";
import toast from "react-hot-toast";

const QB_PHONE = "09XXXXXXXXX";  // ← replace with Dough-Re-Mi phone number

// ── RECEIPT ─────────────────────────────────────────────
const Receipt = React.forwardRef(
  ({ shop, items, calc, date, carName, salespersonName, invoiceNo, printTime, preview }, ref) => (
  <div ref={ref} style={{...R.page,...(preview?{width:"100%"}:{})}}>

    {/* Header */}
    <div style={R.header}>
      <div style={R.bizName}>Dough-Re-Mi Bakery</div>
      <div style={R.bizPhone}>{QB_PHONE}</div>
      <div style={R.bizSub}>SALES RECEIPT</div>
    </div>

    <div style={R.divider}/>

    {/* Two-column info grid */}
    <div style={R.infoGrid}>
      {/* Left: transaction info */}
      <div style={R.infoCol}>
        <InfoRow label="Invoice No"   value={invoiceNo}            bold />
        <InfoRow label="Date"         value={formatDisplay(date)}  />
        <InfoRow label="Time"         value={printTime}            />
        <InfoRow label="Salesperson"  value={salespersonName}      />
        <InfoRow label="Car"          value={carName}              />
      </div>
      {/* Right: shop info */}
      <div style={R.infoCol}>
        <InfoRow label="Shop"     value={shop.name}                    bold />
        <InfoRow label="Address"  value={shop.address}                 />
        <InfoRow label="Phone"    value={shop.phone_no}                />
        <InfoRow label="Discount" value={`${shop.assigned_discount||0}%`} />
      </div>
    </div>

    <div style={R.divider}/>

    {/* Product table */}
    <table style={R.table}>
      <thead>
        <tr style={R.theadRow}>
          <th style={{...R.th, width:"30%", textAlign:"left"}}>Product</th>
          <th style={{...R.th, textAlign:"center"}}>Sale Qty</th>
          <th style={{...R.th, textAlign:"right"}}>Price (Ks)</th>
          <th style={{...R.th, textAlign:"right"}}>Sale Total</th>
          <th style={{...R.th, textAlign:"center"}}>Ret Qty</th>
          <th style={{...R.th, textAlign:"right", color:"#FF6B6B"}}>Ret Total</th>
        </tr>
      </thead>
      <tbody>
        {items.filter(i=>(i.saleQty||0)>0||(i.returnQty||0)>0).map((item,i)=>(
          <tr key={i} style={i%2===0?R.trEven:R.trOdd}>
            <td style={R.td}>{item.productName}</td>
            <td style={{...R.td,textAlign:"center",fontWeight:700}}>{item.saleQty}</td>
            <td style={{...R.td,textAlign:"right",fontWeight:700}}>{item.pricePerPiece?.toLocaleString()}</td>
            <td style={{...R.td,textAlign:"right",fontWeight:700}}>{(item.saleQty*item.pricePerPiece).toLocaleString()}</td>
            <td style={{...R.td,textAlign:"center",fontWeight:700}}>{item.returnQty||0}</td>
            <td style={{...R.td,textAlign:"right",color:"#DC2626",fontWeight:700}}>
              {(item.returnQty||0)>0 ? ((item.returnQty||0)*item.pricePerPiece).toLocaleString() : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <div style={R.divider}/>

    {/* Totals — right aligned */}
    <div style={R.totalsWrap}>
      <div style={R.totalsBox}>
        <TotalRow label="Sub Total"    value={`${fmtNum(calc.subTotal)} Ks`}  />
        <TotalRow label="Return Total" value={`${fmtNum(calc.returnTotal)} Ks`} red />
        <TotalRow label="Actual Sale"  value={`${fmtNum(calc.actualSale)} Ks`} />
        <TotalRow label={`Discount for ${shop.name} (${calc.discountPct}%)`}
                  value={`${fmtNum(calc.discountAmt)} Ks`} red />
        <div style={R.grandTotal}>
          <span>Total</span>
          <span>{fmtNum(calc.total)} Ks</span>
        </div>
      </div>
    </div>

    <div style={R.divider}/>

    {/* Footer */}
    <div style={R.footer}>
      <div>Thank you for your business!</div>
      <div style={{marginTop:4,color:"#999"}}>Dough-Re-Mi Bakery · {QB_PHONE}</div>
      <div style={{marginTop:3,color:"#bbb",fontSize:9}}>Printed: {printTime} · {formatDisplay(date)}</div>
    </div>

    {/* Signature lines */}
    <div style={R.sigRow}>
      <div style={R.sigBox}>
        <div style={R.sigLine}/>
        <div style={R.sigLabel}>Salesperson Signature</div>
        <div style={R.sigName}>{salespersonName}</div>
      </div>
      <div style={R.sigBox}>
        <div style={R.sigLine}/>
        <div style={R.sigLabel}>Customer Signature</div>
        <div style={R.sigName}>{shop.name}</div>
      </div>
    </div>
  </div>
));

function InfoRow({ label, value, bold }) {
  return (
    <div style={R.infoRow}>
      <span style={R.infoLabel}>{label}</span>
      <span style={{...R.infoValue, fontWeight:bold?700:500}}>{value||"—"}</span>
    </div>
  );
}

function TotalRow({ label, value, red }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between",
      padding:"4px 0", fontSize:14, fontWeight:700,
      color: red?"#DC2626":"#333",
      borderBottom:"0.5px solid #eee",
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// 80mm thermal receipt styles (72mm printable = ~272px at 96dpi)
// fontWeight:700 on `page` cascades bold to every element by default.
const R = {
  page:       { padding:"12px 14px", fontFamily:"'Courier New', monospace", color:"#000",
                width:"72mm", boxSizing:"border-box", background:"#fff",
                fontSize:14, fontWeight:700 },
  header:     { textAlign:"center", marginBottom:8 },
  bizName:    { fontSize:20, fontWeight:700, color:"#1A1A2E", margin:"2px 0" },
  bizPhone:   { fontSize:13, color:"#555", marginBottom:2 },
  bizSub:     { fontSize:11, color:"#6B6B6B", letterSpacing:"0.1em" },
  divider:    { borderTop:"1px dashed #999", margin:"6px 0" },
  // 80mm: single column info (no grid)
  infoGrid:   { display:"block" },
  infoCol:    {},
  infoRow:    { display:"flex", justifyContent:"space-between", fontSize:13, padding:"1px 0" },
  infoLabel:  { color:"#555", flexShrink:0, marginRight:4 },
  infoValue:  { textAlign:"right", fontWeight:700, fontSize:13 },
  table:      { width:"100%", borderCollapse:"collapse", fontSize:13 },
  theadRow:   { borderBottom:"1px solid #000", borderTop:"1px solid #000" },
  th:         { padding:"3px 2px", color:"#000", fontWeight:700, fontSize:11 },
  trEven:     { background:"#fff" },
  trOdd:      { background:"#f9f9f9" },
  td:         { padding:"2px 2px", fontSize:13, fontWeight:700 },
  totalsWrap: { display:"block" },
  totalsBox:  { width:"100%" },
  grandTotal: { display:"flex", justifyContent:"space-between", fontWeight:700,
                fontSize:17, borderTop:"1px solid #000",
                marginTop:4, paddingTop:4, color:"#000" },
  footer:     { textAlign:"center", fontSize:12, color:"#555", margin:"8px 0 6px" },
  sigRow:     { display:"flex", justifyContent:"space-between", marginTop:12, gap:10 },
  sigBox:     { textAlign:"center", flex:1 },
  sigLine:    { borderBottom:"1px solid #555", marginBottom:4, height:24 },
  sigLabel:   { fontSize:12, color:"#6B6B6B" },
  sigName:    { fontSize:12, fontWeight:700, color:"#000", marginTop:2 },
};

// ── QTY EDITOR MODAL ─────────────────────────────────────
// Full-screen modal for editing sale + return qty of one product
function QtyModal({ item, onClose, onSave }) {
  const [saleQty,   setSaleQty]   = useState(String(item.saleQty   || 0));
  const [returnQty, setReturnQty] = useState(String(item.returnQty || 0));

  const sq = parseInt(saleQty,10)   || 0;
  const rq = parseInt(returnQty,10) || 0;

  // Remaining quota logic
  const soldOther      = item.soldElsewhere || 0;
  const assignedQty    = item.assignedQty   || 0;
  const remainForDay   = assignedQty > 0 ? assignedQty - soldOther : null;
  const canAddMore     = remainForDay !== null ? remainForDay - sq : null;
  const isOverLimit    = canAddMore !== null && canAddMore < 0;

  const step = (setter, delta) =>
    setter(prev => String(Math.max(0, (parseInt(prev,10)||0) + delta)));

  const commitAndSave = () => {
    // Hard-cap sale qty at available — never allow saving over the limit
    const rawSale = Math.max(0, parseInt(saleQty,10) || 0);
    const cappedSale = remainForDay !== null ? Math.min(rawSale, Math.max(0, remainForDay)) : rawSale;
    onSave({
      ...item,
      saleQty:   cappedSale,
      returnQty: Math.max(0, parseInt(returnQty,10) || 0),
    });
    onClose();
  };

  return (
    <div style={QM.overlay}>
      <div style={{...QM.box, borderTop: item.returnOnly ? "3px solid #3A7A4F" : "3px solid #E4B950"}}>

        {/* Product info */}
        <div style={QM.productHead}>
          <div style={QM.productName}>{item.productName}</div>
          <div style={QM.productMeta}>
            {item.isExtra && <span style={QM.extraBadge}>⚠️ Not assigned</span>}
          </div>
          {assignedQty > 0 && !item.returnOnly && (
            <div style={QM.assignedInfo}>
              Assigned: {assignedQty} pcs
              {soldOther > 0 && <> · Sold elsewhere: {soldOther} pcs · <b style={{color: isOverLimit?"#DC2626":"#3A7A4F"}}>
                Available: {Math.max(0, remainForDay)} pcs
              </b></>}
            </div>
          )}
        </div>

        {/* ── RETURN-ONLY BANNER ── */}
        {item.returnOnly && (
          <div style={{background:"rgba(58,122,79,0.08)",border:"1px solid rgba(58,122,79,0.25)",
            borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#3A7A4F",marginBottom:2}}>
              📦 Return Entry Only
            </div>
            <div style={{fontSize:11,color:"#6B6B6B"}}>
              This product is fully allocated today — sale not allowed
            </div>
          </div>
        )}

        {/* Quota warning banner (non-returnOnly) */}
        {!item.returnOnly && isOverLimit && (
          <div style={{background:"#FEE2E2",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#DC2626",fontWeight:600,marginBottom:4}}>
            ⚠️ Over limit by {Math.abs(canAddMore)} pcs — Total sold today: {soldOther+sq}/{assignedQty}
          </div>
        )}

        {/* SALE QTY — hidden for returnOnly items */}
        {!item.returnOnly && (
          <div style={QM.section}>
            <div style={QM.sectionLabel}>Sale Quantity</div>
            <div style={QM.qtyRow}>
              <button style={QM.bigBtn} onClick={()=>step(setSaleQty,-1)}>−</button>
              <input
                style={{...QM.bigInput,
                  borderColor: isOverLimit ? "#DC2626"
                             : canAddMore === 0 ? "#4A8C6B"
                             : "#E4B950"}}
                type="number" min={0}
                max={remainForDay !== null ? Math.max(0, remainForDay) : undefined}
                value={saleQty}
                onChange={e => {
                  const val = Math.max(0, parseInt(e.target.value,10) || 0);
                  // Hard-cap: never allow typing above available qty
                  const capped = remainForDay !== null ? Math.min(val, Math.max(0, remainForDay)) : val;
                  setSaleQty(String(capped));
                }}
                onFocus={e=>e.target.select()}
              />
              <button
                style={{...QM.bigBtn,
                  opacity: (canAddMore !== null && canAddMore <= 0) ? 0.35 : 1,
                  cursor:  (canAddMore !== null && canAddMore <= 0) ? "not-allowed" : "pointer"}}
                onClick={()=>{ if (canAddMore === null || canAddMore > 0) step(setSaleQty,+1); }}
              >+</button>
            </div>
            {remainForDay !== null && !isOverLimit && canAddMore > 0 && (
              <div style={{...QM.amtLabel, color:"#6B6B6B", fontSize:12}}>
                Can still sell: <b style={{color:"#3A7A4F"}}>{canAddMore} pcs</b> more today
              </div>
            )}
            {remainForDay !== null && !isOverLimit && canAddMore === 0 && (
              <div style={{...QM.amtLabel, color:"#3A7A4F", fontSize:12}}>
                ✓ Fully allocated — limit reached
              </div>
            )}
          </div>
        )}

        {/* RETURN QTY — always shown, prominent for returnOnly */}
        <div style={{...QM.section,
          borderTop: item.returnOnly ? "none" : "1px dashed #E8D5B8",
          paddingTop: item.returnOnly ? 0 : 16}}>
          <div style={{...QM.sectionLabel, color: item.returnOnly ? "#3A7A4F" : "#A67C3A",
            fontSize: item.returnOnly ? 15 : 13}}>
            {item.returnOnly ? "📦 Return Quantity" : "Return Quantity"}
          </div>
          <div style={QM.qtyRow}>
            <button style={{...QM.bigBtn,
              borderColor: item.returnOnly ? "#3A7A4F" : "#E4B950",
              color:       item.returnOnly ? "#3A7A4F" : "#A67C3A"}}
              onClick={()=>step(setReturnQty,-1)}>−</button>
            <input
              style={{...QM.bigInput,
                borderColor: item.returnOnly ? "#3A7A4F" : "#E4B950",
                fontSize: item.returnOnly ? 28 : 24}}
              type="number" min={0}
              value={returnQty}
              onChange={e=>setReturnQty(e.target.value)}
              onFocus={e=>e.target.select()}
              autoFocus={!!item.returnOnly}
            />
            <button style={{...QM.bigBtn,
              borderColor: item.returnOnly ? "#3A7A4F" : "#E4B950",
              color:       item.returnOnly ? "#3A7A4F" : "#A67C3A"}}
              onClick={()=>step(setReturnQty,+1)}>+</button>
          </div>
        </div>

        {/* Actions */}
        <div style={QM.actions}>
          <button style={QM.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{...QM.saveBtn,
            background: item.returnOnly ? "#3A7A4F" : "#E4B950",
            color:       item.returnOnly ? "#fff"    : "#1C3829"}}
            onClick={commitAndSave}>✓ Done</button>
        </div>
      </div>
    </div>
  );
}

const QM = {
  overlay:      { position:"fixed", inset:0, background:"rgba(26,26,46,0.75)", zIndex:500, display:"flex", alignItems:"flex-end", justifyContent:"center" },
  box:          { background:"#fff", borderRadius:"16px 16px 0 0", padding:"20px 16px 32px", width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:14, boxSizing:"border-box" },
  productHead:  { textAlign:"center" },
  productName:  { fontSize:17, fontWeight:700, color:"#1A1A2E", fontFamily:"'Playfair Display',serif", marginBottom:4 },
  productMeta:  { fontSize:13, color:"#6B6B6B", display:"flex", alignItems:"center", justifyContent:"center", gap:8, flexWrap:"wrap" },
  extraBadge:   { background:"#FAF7F2", color:"#A67C3A", fontSize:11, padding:"2px 8px", borderRadius:8, fontWeight:600 },
  assignedInfo: { fontSize:12, color:"#C4B5A5", marginTop:4 },
  section:      { display:"flex", flexDirection:"column", gap:10 },
  sectionLabel: { fontSize:13, fontWeight:700, color:"#1A1A2E" },
  qtyRow:       { display:"flex", alignItems:"center", gap:8, width:"100%" },
  bigBtn:       { width:52, height:52, minWidth:52, background:"#FAF7F2", border:"1px solid #C9A84C", borderRadius:8, fontSize:26, fontWeight:700, color:"#1A1A2E", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:"'Playfair Display',serif" },
  bigInput:     { flex:1, height:52, border:"1px solid #C9A84C", borderRadius:8, fontSize:24, fontWeight:700, textAlign:"center", outline:"none", color:"#1A1A2E", minWidth:0, width:"100%", boxSizing:"border-box", fontFamily:"'Playfair Display',serif" },
  amtLabel:     { textAlign:"center", fontSize:14, fontWeight:600, color:"#2D7A4F" },
  actions:      { display:"flex", gap:10, marginTop:4 },
  cancelBtn:    { flex:1, background:"#FAF7F2", border:"1px solid #E5DDD0", borderRadius:10, padding:14, fontSize:14, cursor:"pointer", fontWeight:500, fontFamily:"'Inter',sans-serif", color:"#6B6B6B" },
  saveBtn:      { flex:2, background:"#C9A84C", color:"#1A1A2E", border:"none", borderRadius:10, padding:14, fontSize:14, cursor:"pointer", fontWeight:700, fontFamily:"'Inter',sans-serif" },
};

// ── MAIN ─────────────────────────────────────────────────
export default function SalePage() {
  const { profile } = useAuth();
  const today = todayStr();
  const printRef = useRef();

  const [assignment, setAssignment]     = useState(null);
  const [customers, setCustomers]       = useState([]);
  const [products, setProducts]         = useState([]);
  const [todaySales, setTodaySales]     = useState([]);  // this car only
  const [allTodaySales, setAllTodaySales] = useState([]); // ALL cars — for unique invoice#
  const [selectedShop, setSelectedShop] = useState(null);
  const [saleItems, setSaleItems]       = useState([]);
  const [saving, setSaving]             = useState(false);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [receiptData, setReceiptData]   = useState(null);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [shopSearch, setShopSearch]     = useState("");
  const [showScanner, setShowScanner]   = useState(false);
  const [editingItem, setEditingItem]   = useState(null); // for QtyModal
  const [view, setView]                 = useState("shops");
  const [productSearch, setProductSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!profile?.carId) return;
    const [a, c, p, s, allS] = await Promise.all([
      getAssignment(today, profile.carId),
      getAllCustomers(),
      getAllProducts(),
      getSalesByDateAndCar(today, profile.carId),
      getSalesByDate(today),  // all cars — for global invoice counter
    ]);
    setAssignment(a);
    setCustomers(c.filter(cu => cu.active !== false));
    setProducts(p);
    setTodaySales(s);
    setAllTodaySales(allS);
  }, [profile, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const openShop = (customer) => {
    setSelectedShop(customer);
    setShowReceipt(false);
    setReceiptData(null);
    setProductSearch("");
    setView("sale");
    const existing = todaySales.find(s => s.customerId === customer.id);

    if (existing) {
      setEditingSaleId(existing.id);
      // Load only items that have qty — exhausted products are simply absent
      const activeItems = (existing.items||[]).filter(
        i => (parseInt(i.saleQty,10)||0)>0 || (parseInt(i.returnQty,10)||0)>0
      );
      setSaleItems(activeItems);
    } else {
      setEditingSaleId(null);
      const ids = Object.keys(assignment?.items || {});

      // ── Pre-compute sold qty across ALL today's shops for this car ──────
      const soldTodayByProduct = {};
      todaySales.forEach(sale => {
        (sale.items || []).forEach(it => {
          const pid = it.productId;
          soldTodayByProduct[pid] =
            (soldTodayByProduct[pid] || 0) + (parseInt(it.saleQty, 10) || 0);
        });
      });

      setSaleItems(
        products
          .filter(p => ids.includes(p.id))
          .map(p => {
            const assignedQty = parseInt(assignment.items[p.id], 10) || 0;
            const soldQty     = soldTodayByProduct[p.id] || 0;
            // ── Mark fully-allocated products as returnOnly ──────────────
            // They are hidden from the sale grid but remain available
            // so the salesperson can still enter a return for them.
            const returnOnly  = assignedQty > 0 && soldQty >= assignedQty;
            return {
              productId:     p.id,
              productName:   p.name,
              pricePerPiece: p.price,
              assignedQty,
              saleQty: 0, returnQty: 0,
              isAssigned: true,
              returnOnly,
            };
          })
      );
    }
  };

  // Barcode → find product → increment (blocks fully-allocated products)
  const handleBarcode = useCallback((code) => {
    setShowScanner(false);
    const product = products.find(p => String(p.barcode) === String(code));
    if (!product) { toast.error(`Barcode not found: ${code}`); return; }
    const isAssigned  = Object.keys(assignment?.items||{}).includes(product.id);
    const assignedQty = assignment?.items?.[product.id] || 0;

    setSaleItems(prev => {
      const exists     = prev.find(r => r.productId === product.id);
      const currentQty = parseInt(exists?.saleQty,10) || 0;
      const soldOther  = soldElsewhereRef.current[product.id] || 0;
      const newSaleQty = currentQty + 1;
      const totalToday = soldOther + newSaleQty;

      // ── Fully allocated → redirect to return entry modal ────
      if (isAssigned && assignedQty > 0 && soldOther >= assignedQty) {
        toast(`📦 ${product.name} — fully allocated. Opening return entry…`,
          {duration:2500, style:{background:"rgba(58,122,79,0.1)",color:"#3A7A4F",fontWeight:600}});
        // Ensure item exists in saleItems as returnOnly, then open QtyModal
        const returnItem = {
          productId: product.id, productName: product.name,
          pricePerPiece: product.price,
          assignedQty: parseInt(assignedQty,10)||0,
          saleQty: exists ? parseInt(exists.saleQty,10)||0 : 0,
          returnQty: exists ? parseInt(exists.returnQty,10)||0 : 0,
          isAssigned: true, returnOnly: true,
          soldElsewhere: soldOther,
          remainingForDay: 0,
        };
        // Open QtyModal via a ref-safe callback after state settles
        setTimeout(() => setEditingItem(returnItem), 0);
        if (exists) return prev;
        return [...prev, { ...returnItem }];
      }

      // ── Block: adding this 1 would exceed the limit ──────
      if (isAssigned && assignedQty > 0 && totalToday > assignedQty) {
        toast(`🚫 ${product.name} — Limit reached (${soldOther+currentQty}/${assignedQty} already)`,
          {duration:4000, style:{background:"#FEE2E2",color:"#DC2626",fontWeight:600}});
        return prev; // no change
      }

      // ── Unassigned product → return-only mode ───────────────
      if (!isAssigned) {
        toast(`📦 ${product.name} — not assigned. Opening return entry…`,
          {duration:2500, style:{background:"rgba(58,122,79,0.1)",color:"#3A7A4F",fontWeight:600}});
        const returnItem = {
          productId: product.id, productName: product.name,
          pricePerPiece: product.price,
          assignedQty: 0,
          saleQty:   exists ? parseInt(exists.saleQty,10)||0  : 0,
          returnQty: exists ? parseInt(exists.returnQty,10)||0 : 0,
          isAssigned: false, isExtra: true, returnOnly: true,
          soldElsewhere: 0, remainingForDay: null,
        };
        setTimeout(() => setEditingItem(returnItem), 0);
        if (exists) return prev;
        return [...prev, { ...returnItem }];
      }

      toast.success(`+1 ${product.name} · ${totalToday}/${assignedQty} today`);
      if (exists) return prev.map(r => r.productId===product.id ? {...r,saleQty:newSaleQty} : r);
      return [...prev, {
        productId: product.id, productName: product.name,
        pricePerPiece: product.price,
        assignedQty, saleQty: 1, returnQty: 0, isAssigned,
      }];
    });
  }, [products, assignment]);

  // Update item from QtyModal
  const handleItemSave = (updatedItem) => {
    setSaleItems(prev => prev.map(r =>
      r.productId === updatedItem.productId ? updatedItem : r
    ));
  };

  const handleSave = async () => {
    if (!selectedShop) return;
    const committed = saleItems.map(r => ({
      ...r,
      saleQty:    parseInt(r.saleQty,10)    || 0,
      returnQty:  parseInt(r.returnQty,10)  || 0,
      assignedQty: parseInt(r.assignedQty,10) ?? 0,
    }));
    const calc = calcReceipt(committed, selectedShop.assigned_discount || 0);
    const existingSale = todaySales.find(s => s.customerId === selectedShop.id);
    // Use allTodaySales (all cars) for globally unique invoice numbers
    const invoiceNo = existingSale?.invoiceNo || generateInvoiceNo(today, allTodaySales.length);
    const printTime = new Date().toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"});

    setSaving(true);
    try {
      const saleDoc = {
        date: today, carId: profile.carId, carName: assignment?.carName||"",
        salespersonName: profile.name||"",
        customerId: selectedShop.id, shopName: selectedShop.name,
        discountPct: selectedShop.assigned_discount||0,
        items: committed, invoiceNo, printTime, ...calc,
      };
      const savedSaleId = editingSaleId || `${today}_${profile.carId}_${selectedShop.id}`;
      if (editingSaleId) { await updateSale(editingSaleId, saleDoc); toast.success("Sale updated!"); }
      else               { await addSale(saleDoc); toast.success(`Saved for ${selectedShop.name}`); }
      // Track every save/update atomically (fire-and-forget)
      incrementSaveCount(savedSaleId).catch(() => {});
      setSaleItems(committed);
      setReceiptData({ shop:selectedShop, calc, items:committed,
        date:today, carName:assignment?.carName||"",
        salespersonName:profile.name||"", invoiceNo, printTime,
        saleId: savedSaleId });
      setShowReceipt(true);
      await loadData();
    } catch(e) { toast.error("Save failed: "+e.message); }
    finally { setSaving(false); }
  };

  const handlePrint = () => {
    const invoiceNo = receiptData?.invoiceNo || "";
    const filename  = `Receipt ${invoiceNo}`;
    // Track print count in Firestore (fire-and-forget)
    if (receiptData?.saleId) {
      incrementPrintCount(receiptData.saleId).catch(() => {});
    }
    const w = window.open("","_blank","width=400,height=700");
    w.document.write(`<!DOCTYPE html><html><head>
      <title>${filename}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body { margin: 0; padding: 0; width: 80mm; }
        }
        @media screen {
          body {
            margin: 0;
            min-height: 100vh;
            background: #e0e0e0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px 16px;
          }
          .receipt-wrap {
            background: #fff;
            box-shadow: 0 4px 24px rgba(0,0,0,0.2);
            border-radius: 4px;
            padding: 16px;
          }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
      </style>
      </head><body><div class="receipt-wrap">${printRef.current?.innerHTML}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // ── Sold elsewhere (other shops already saved today) ────
  // Exclude the current shop's saved sale so we don't double-count
  const soldElsewhere = React.useMemo(() => {
    const otherSales = todaySales.filter(s => s.id !== editingSaleId);
    const map = {};
    otherSales.forEach(sale => {
      (sale.items||[]).forEach(item => {
        map[item.productId] = (map[item.productId]||0) + (parseInt(item.saleQty,10)||0);
      });
    });
    return map;
  }, [todaySales, editingSaleId]);

  const soldElsewhereRef = React.useRef({});
  React.useEffect(() => { soldElsewhereRef.current = soldElsewhere; }, [soldElsewhere]);

  // ── Global physical-scanner listener ─────────────────────
  // Keeps refs so the listener never needs to be torn down / recreated.
  const handleBarcodeRef   = React.useRef(null);
  const selectedShopRef    = React.useRef(null);
  const showScannerSpRef   = React.useRef(false);
  React.useEffect(() => { handleBarcodeRef.current  = handleBarcode;   }, [handleBarcode]);
  React.useEffect(() => { selectedShopRef.current   = selectedShop;    }, [selectedShop]);
  React.useEffect(() => { showScannerSpRef.current  = showScanner;     }, [showScanner]);

  React.useEffect(() => {
    const buf = { v: "", t: null };
    const fn = (e) => {
      if (e.key === "Enter") {
        const code = buf.v.trim();
        buf.v = ""; clearTimeout(buf.t);
        if (code.length < 3) return;
        if (showScannerSpRef.current) return; // camera modal handles its own scan
        if (!selectedShopRef.current) {
          toast("Select a shop first, then scan", {icon:"ℹ️", duration:2000});
          return;
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
  }, []);

  // Derived
  const soldIds   = new Set(todaySales.map(s => s.customerId));
  const calc      = calcReceipt(
    saleItems.map(r=>({...r, saleQty:parseInt(r.saleQty,10)||0, returnQty:parseInt(r.returnQty,10)||0})),
    selectedShop?.assigned_discount || 0
  );
  const filteredShops = customers.filter(c =>
    c.name?.toLowerCase().includes(shopSearch.toLowerCase()) ||
    c.address?.toLowerCase().includes(shopSearch.toLowerCase())
  );
  const soldCount    = todaySales.length;
  const hasSales     = saleItems.some(i=>(parseInt(i.saleQty,10)||0)>0);

  // ── Total remaining stock for the day ───────────────────
  // totalAssigned  = all pieces assigned to this car today
  // totalSoldElsewhere = pieces sold at OTHER shops (current shop excluded via editingSaleId)
  // totalSoldHere  = pieces being sold at the CURRENT shop (live saleItems state)
  const totalAssigned      = Object.values(assignment?.items||{}).reduce((s,v)=>s+(Number(v)||0), 0);
  const totalSoldElsewhere = Object.values(soldElsewhere).reduce((s,v)=>s+v, 0);
  const totalSoldHere      = saleItems.reduce((s,i)=>s+(parseInt(i.saleQty,10)||0), 0);
  const totalLeft          = Math.max(0, totalAssigned - totalSoldElsewhere - totalSoldHere);

  if (!profile?.carId) return <div style={M.center}><div style={{fontSize:48}}>🚗</div><h3 style={{color:"#1A1A2E"}}>No car assigned</h3></div>;
  if (!assignment)     return <div style={M.center}><div style={{fontSize:48}}>📋</div><h3 style={{color:"#1A1A2E"}}>No assignment today</h3><p style={{color:"#6B6B6B"}}>Check back after manager assigns.</p></div>;

  return (
    <div style={M.root}>
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcode}
          onClose={()=>setShowScanner(false)}
          title="Scan Product"
        />
      )}
      {editingItem && (
        <QtyModal
          item={editingItem}
          onClose={()=>setEditingItem(null)}
          onSave={handleItemSave}
        />
      )}

      {/* Tab bar */}
      <div style={M.tabBar}>
        <button style={{...M.tab,...(view==="shops"?M.tabActive:{})}} onClick={()=>setView("shops")}>
          Shops <span style={M.tabBadge}>{soldCount}/{customers.length}</span>
        </button>
        <button style={{...M.tab,...(view==="sale"?M.tabActive:{})}}
          onClick={()=>setView("sale")} disabled={!selectedShop}>
          🛒 {selectedShop ? selectedShop.name.slice(0,12)+"…" : "Select shop"}
        </button>
      </div>

      <div style={M.body}>
        {/* ── SHOP LIST ── */}
        <div style={{...M.shopPanel, display:view==="shops"||window.innerWidth>768?"flex":"none"}}>
          <div style={M.stats}>
            <div style={M.statBox}>
              <div style={M.statVal}>{soldCount}<span style={{fontSize:11}}>/{customers.length}</span></div>
              <div style={M.statLabel}>Shops done</div>
            </div>
            <div style={M.statBox}>
              <div style={M.statVal}>{customers.length - soldCount}</div>
              <div style={M.statLabel}>Remaining</div>
            </div>
          </div>
          <div style={{padding:"8px 10px 4px"}}>
            <input style={M.searchInput} placeholder="🔍 Search shop…"
              value={shopSearch} onChange={e=>setShopSearch(e.target.value)} />
          </div>
          <div style={M.shopList}>
            {filteredShops.map(c => {
              const sold   = soldIds.has(c.id);
              const active = selectedShop?.id === c.id;
              return (
                <div key={c.id} style={{...M.shopCard,
                  background:active?"#1A1A2E":"#fff",
                  color:active?"#fff":"#333",
                  borderLeft:sold?"3px solid #C9A84C":"3px solid transparent"}}
                  onClick={()=>openShop(c)}>
                  <div style={{fontWeight:600,fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,opacity:0.65,marginTop:2}}>{c.address}</div>
                  <div style={{fontSize:11,marginTop:3,display:"flex",justifyContent:"space-between"}}>
                    <span style={{opacity:0.75}}>Disc: {c.assigned_discount}%</span>
                    {sold&&<span style={{color:active?"#E8C97E":"#C9A84C",fontWeight:600}}>✓ Done</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SALE PANEL ── */}
        <div style={{...M.salePanel, display:view==="sale"||window.innerWidth>768?"flex":"none"}}>
          {!selectedShop ? (
            <div style={M.center}>
              <div style={{fontSize:48}}>👈</div>
              <p style={{color:"#C4B5A5"}}>Select a shop to start</p>
            </div>
          ) : (
            <>
              {/* Shop header */}
              <div style={M.shopHeader}>
                <div style={{flex:1,minWidth:0}}>
                  <h2 style={M.shopTitle}>{selectedShop.name}</h2>
                  <p style={M.shopMeta}>
                    {selectedShop.address} · {selectedShop.assigned_discount}% disc
                    {editingSaleId&&<span style={M.editBadge}>✏️ Editing</span>}
                  </p>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button style={M.iconBtn} onClick={()=>setShowScanner(true)}>📷</button>
                  <button style={M.saveBtn} onClick={handleSave} disabled={saving||!hasSales}>
                    {saving?"…":editingSaleId?"Update":"Save"}
                  </button>
                  {receiptData&&<button style={M.iconBtn} onClick={()=>setShowReceipt(true)} title="View Receipt">🧾</button>}
                </div>
              </div>

              {/* ── PRODUCT GRID ── */}
              <div style={M.gridArea}>
                {saleItems.length > 0 && (
                  <input
                    style={M.productSearchInput}
                    placeholder="🔍 Search product…"
                    value={productSearch}
                    onChange={e=>setProductSearch(e.target.value)}
                  />
                )}
                {saleItems.length === 0 && (
                  <div style={{textAlign:"center",color:"#C4B5A5",padding:"40px 20px"}}>
                    <div style={{fontSize:40}}>🛒</div>
                    <p style={{marginTop:8,fontSize:13}}>No products assigned.<br/>Scan a barcode to add.</p>
                  </div>
                )}
                {/* ── SALE PRODUCTS grid ── */}
                <div style={M.grid}>
                  {(productSearch
                    ? saleItems.filter(i=>i.productName?.toLowerCase().includes(productSearch.toLowerCase()))
                    : saleItems
                  ).map((item, idx) => {
                    const sq        = parseInt(item.saleQty,10)   || 0;
                    const rq        = parseInt(item.returnQty,10)  || 0;
                    const hasQty    = sq > 0 || rq > 0;
                    const soldOther = soldElsewhere[item.productId] || 0;
                    const assigned  = item.assignedQty || 0;
                    const remaining = assigned > 0 ? assigned - soldOther - sq : null;
                    const isAtLimit = remaining !== null && remaining === 0;
                    const isOver    = remaining !== null && remaining < 0;

                    // ── Skip returnOnly items in the main grid
                    //    UNLESS they already have a returnQty entered
                    if (item.returnOnly && rq === 0) return null;

                    return (
                      <div key={idx}
                        style={{
                          ...M.gridCard,
                          borderTop: item.returnOnly ? "3px solid #3A7A4F"
                                   : isOver          ? "3px solid #DC2626"
                                   : isAtLimit       ? "3px solid #3A7A4F"
                                   : item.isExtra    ? "3px solid #F59E0B"
                                   : hasQty          ? "3px solid #E4B950"
                                   :                   "3px solid #E8D5C0",
                          opacity: item.returnOnly ? 0.9 : 1,
                        }}
                        onClick={()=>setEditingItem({
                          ...item,
                          soldElsewhere: soldOther,
                          remainingForDay: assigned > 0 ? assigned - soldOther : null,
                        })}
                      >
                        <div style={M.gridName}>{item.productName}</div>
                        <div style={M.gridQty}>
                          <div style={{
                            ...M.gridQtyBox,
                            background: sq>0 ? "rgba(228,185,80,0.13)" : "#F5F5F5",
                            color:      sq>0 ? "#1C3829" : "#aaa",
                          }}>
                            <div style={{fontSize:20,fontWeight:700}}>{sq}</div>
                            <div style={{fontSize:10}}>sold</div>
                          </div>
                          <div style={{
                            ...M.gridQtyBox,
                            background: rq>0 ? "rgba(58,122,79,0.1)" : "#F5F5F5",
                            color:      rq>0 ? "#3A7A4F" : "#aaa",
                          }}>
                            <div style={{fontSize:20,fontWeight:700}}>{rq}</div>
                            <div style={{fontSize:10}}>return</div>
                          </div>
                        </div>
                        {/* Quota badge for sale items */}
                        {!item.returnOnly && remaining !== null && (
                          <div style={{
                            fontSize:10, fontWeight:700, textAlign:"center", marginTop:3,
                            padding:"2px 6px", borderRadius:6,
                            background: isOver    ? "#FEE2E2"
                                      : isAtLimit ? "rgba(58,122,79,0.1)"
                                      : remaining<=2 ? "#FEF3DD"
                                      :               "rgba(228,185,80,0.1)",
                            color:      isOver    ? "#DC2626"
                                      : isAtLimit ? "#3A7A4F"
                                      : remaining<=2 ? "#A67C3A"
                                      :               "#3A7A4F",
                          }}>
                            {isOver ? `⚠️ ${Math.abs(remaining)} over` : isAtLimit ? `✓ Limit` : `${remaining} left`}
                          </div>
                        )}
                        {item.returnOnly && (
                          <div style={{fontSize:10,fontWeight:700,textAlign:"center",marginTop:3,
                            padding:"2px 6px",borderRadius:6,background:"rgba(58,122,79,0.1)",color:"#3A7A4F"}}>
                            📦 return only
                          </div>
                        )}
                        {item.isExtra && <div style={M.gridExtra}>⚠️ Not assigned</div>}
                        <div style={M.gridTap}>Tap to edit</div>
                      </div>
                    );
                  })}
                </div>

                {/* ── RETURNS SECTION — fully allocated products ── */}
                {(() => {
                  const returnOnlyItems = saleItems.filter(i =>
                    i.returnOnly && (parseInt(i.returnQty,10)||0) === 0
                  );
                  if (returnOnlyItems.length === 0) return null;
                  return (
                    <div style={{marginTop:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#3A7A4F",
                        letterSpacing:"0.8px",textTransform:"uppercase",
                        marginBottom:6,paddingLeft:2,display:"flex",alignItems:"center",gap:6}}>
                        <span>📦</span>
                        <span>Returns Available ({returnOnlyItems.length})</span>
                        <span style={{fontSize:10,fontWeight:400,color:"#8A9A8A",textTransform:"none",letterSpacing:0}}>
                          — tap to enter return qty
                        </span>
                      </div>
                      <div style={M.grid}>
                        {returnOnlyItems.map((item, idx) => (
                          <div key={idx}
                            style={{...M.gridCard,
                              borderTop:"3px solid #3A7A4F",
                              background:"rgba(58,122,79,0.04)",
                              cursor:"pointer"}}
                            onClick={()=>setEditingItem({
                              ...item,
                              soldElsewhere: soldElsewhere[item.productId]||0,
                              remainingForDay: 0,
                            })}
                          >
                            <div style={{...M.gridName,color:"#2D4A3E"}}>{item.productName}</div>
                            <div style={{textAlign:"center",marginTop:8}}>
                              <div style={{width:36,height:36,borderRadius:"50%",
                                background:"rgba(58,122,79,0.12)",
                                border:"1.5px dashed #3A7A4F",
                                display:"flex",alignItems:"center",justifyContent:"center",
                                margin:"0 auto",fontSize:18,color:"#3A7A4F",fontWeight:700}}>
                                +
                              </div>
                            </div>
                            <div style={{fontSize:10,fontWeight:600,textAlign:"center",
                              marginTop:6,color:"#3A7A4F"}}>
                              Tap to return
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Summary — quantities only, no cash amounts */}
              <div style={M.summary}>
                <div style={M.summaryRow}>
                  <div style={M.summaryItem}>
                    <div style={{fontSize:11,color:"#6B6B6B"}}>Items Sold</div>
                    <div style={{fontWeight:700,fontSize:18,color:"#1A1A2E",fontFamily:"'Playfair Display',serif"}}>
                      {saleItems.reduce((s,i)=>s+(parseInt(i.saleQty,10)||0),0)} pcs
                    </div>
                  </div>
                  <div style={M.summaryItem}>
                    <div style={{fontSize:11,color:"#A67C3A"}}>Returns</div>
                    <div style={{fontWeight:700,fontSize:18,color:"#A67C3A",fontFamily:"'Playfair Display',serif"}}>
                      {saleItems.reduce((s,i)=>s+(parseInt(i.returnQty,10)||0),0)} pcs
                    </div>
                  </div>
                  <div style={{...M.summaryItem,
                    background: totalLeft === 0 ? "rgba(45,122,79,0.08)"
                              : totalLeft <= 5  ? "rgba(220,38,38,0.07)"
                              :                   "rgba(45,122,79,0.08)",
                    borderRadius:10, padding:"8px 12px"}}>
                    <div style={{fontSize:11, color: totalLeft===0?"#2D7A4F":totalLeft<=5?"#DC2626":"#2D7A4F"}}>
                      Left
                    </div>
                    <div style={{fontWeight:700, fontSize:16,
                      color: totalLeft===0?"#2D7A4F":totalLeft<=5?"#DC2626":"#2D7A4F",
                      fontFamily:"'Playfair Display',serif"}}>
                      {totalLeft} pcs
                    </div>
                  </div>
                  <div style={{...M.summaryItem, background:"#1A1A2E", borderRadius:10, padding:"8px 12px"}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>SHOPS TODAY</div>
                    <div style={{fontWeight:700,fontSize:16,color:"#C9A84C"}}>
                      {soldCount} / {customers.length}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── RECEIPT PREVIEW MODAL ── */}
      {showReceipt && receiptData && (
        <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.88)",display:"flex",flexDirection:"column",fontFamily:"'Inter',sans-serif"}}>
          {/* Top bar */}
          <div style={{background:"#1A1A2E",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,borderBottom:"2px solid #C9A84C"}}>
            <span style={{color:"#C9A84C",fontWeight:700,fontSize:15}}>🧾 Receipt Preview</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={handlePrint}
                style={{background:"#C9A84C",color:"#1A1A2E",border:"none",borderRadius:8,padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:700,minHeight:44,touchAction:"manipulation"}}>
                🖨️ Print
              </button>
              <button onClick={()=>setShowReceipt(false)}
                style={{background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,padding:"10px 14px",cursor:"pointer",fontSize:13,fontWeight:600,minHeight:44,touchAction:"manipulation"}}>
                ✕ Close
              </button>
            </div>
          </div>
          {/* Scrollable receipt */}
          <div style={{flex:1,overflowY:"auto",padding:"12px 8px",background:"#2a2a3e",display:"flex",justifyContent:"center"}}>
            <div style={{width:"100%",maxWidth:500,background:"#fff",borderRadius:4,overflow:"hidden"}}>
              <Receipt {...receiptData} preview={true}/>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for printing */}
      <div style={{display:"none"}}>
        {receiptData&&<Receipt ref={printRef} {...receiptData}/>}
      </div>
    </div>
  );
}

const M = {
  root:        {display:"flex",flexDirection:"column",height:"calc(100vh - 57px)",fontFamily:"'Inter',sans-serif",background:"#FAF7F2",overflow:"hidden"},
  tabBar:      {display:"flex",background:"#1A1A2E",flexShrink:0},
  tab:         {flex:1,padding:"11px 8px",border:"none",background:"transparent",color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  tabActive:   {color:"#fff",borderBottom:"3px solid #C8973A"},
  tabBadge:    {background:"rgba(255,255,255,0.2)",borderRadius:10,padding:"1px 6px",fontSize:11},
  body:        {display:"flex",flex:1,overflow:"hidden",minHeight:0},
  shopPanel:   {width:200,flexShrink:0,background:"#fff",borderRight:"1px solid #F0E0CC",flexDirection:"column",overflow:"hidden"},
  stats:       {display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"#E5DDD0",flexShrink:0},
  statBox:     {background:"#FAF7F2",padding:"8px 6px",textAlign:"center"},
  statVal:     {fontSize:18,fontWeight:700,color:"#1A1A2E", fontFamily:"'Playfair Display',serif" },
  statLabel:   {fontSize:10,color:"#6B6B6B",marginTop:1},
  searchInput: {width:"100%",padding:"7px 10px",border:"1.5px solid #E8D5C0",borderRadius:8,fontSize:12,boxSizing:"border-box",outline:"none",background:"#FAF7F2"},
  shopList:    {flex:1,overflowY:"auto",padding:"5px 7px"},
  shopCard:    {padding:"9px 10px",borderRadius:10,marginBottom:5,cursor:"pointer",border:"0.5px solid #F0E0CC"},
  salePanel:   {flex:1,flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0},
  center:      {textAlign:"center",margin:"auto",padding:20},
  shopHeader:  {display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 12px",background:"#fff",borderBottom:"1px solid #F0E0CC",gap:8,flexShrink:0},
  shopTitle:   {margin:0,fontSize:15,fontWeight:700,color:"#1A1A2E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  shopMeta:    {margin:"2px 0 0",fontSize:11,color:"#6B6B6B"},
  editBadge:   {marginLeft:6,background:"#FAF7F2",color:"#A67C3A",fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:600},
  iconBtn:     {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16,fontWeight:600},
  saveBtn:     {background:"#1A1A2E",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600},
  // Grid
  gridArea:    {flex:1,overflowY:"auto",padding:"8px 10px",minHeight:0},
  productSearchInput: {width:"100%",padding:"8px 12px",border:"1.5px solid #E8D5C0",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none",background:"#fff",marginBottom:8,fontFamily:"'Inter',sans-serif"},
  grid:        {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8},
  gridCard:    {background:"#fff",borderRadius:8,padding:"10px 10px 6px",cursor:"pointer",boxShadow:"0 1px 4px rgba(92,51,23,0.08)",display:"flex",flexDirection:"column",gap:4,transition:"box-shadow 0.15s"},
  gridName:    {fontSize:12,fontWeight:700,color:"#1A1A2E",lineHeight:1.3,minHeight:32},
  gridPrice:   {fontSize:11,color:"#6B6B6B"},
  gridQty:     {display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:4},
  gridQtyBox:  {borderRadius:8,padding:"6px 4px",textAlign:"center"},
  gridTotal:   {fontSize:12,fontWeight:700,color:"#C9A84C",textAlign:"center",marginTop:2},
  gridExtra:   {background:"#FAF7F2",color:"#A67C3A",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:6,textAlign:"center"},
  gridTap:     {fontSize:9,color:"#ddd",textAlign:"center",marginTop:2},
  // Summary bar
  summary:     {background:"#fff",borderTop:"1px solid #F0E0CC",padding:"8px 10px",flexShrink:0},
  summaryRow:  {display:"flex",gap:6,alignItems:"stretch"},
  summaryItem: {flex:1,textAlign:"center",padding:"6px 4px"},
};
