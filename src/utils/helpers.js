// src/utils/helpers.js
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
         startOfYear, endOfYear } from "date-fns";

// ── DATE HELPERS ─────────────────────────────────────────
export const todayStr = () => format(new Date(), "yyyy-MM-dd");
export const formatDisplay = (dateStr) => format(new Date(dateStr), "dd MMM yyyy");
export const weekRange  = (date=new Date()) => ({
  start: format(startOfWeek(date,{weekStartsOn:1}),"yyyy-MM-dd"),
  end:   format(endOfWeek(date,  {weekStartsOn:1}),"yyyy-MM-dd"),
});
export const monthRange = (date=new Date()) => ({
  start: format(startOfMonth(date),"yyyy-MM-dd"),
  end:   format(endOfMonth(date),  "yyyy-MM-dd"),
});
export const yearRange  = (date=new Date()) => ({
  start: format(startOfYear(date),"yyyy-MM-dd"),
  end:   format(endOfYear(date),  "yyyy-MM-dd"),
});

// ── INVOICE NUMBER ────────────────────────────────────────
export const generateInvoiceNo = (dateStr, index) => {
  const d   = dateStr.replace(/-/g, "");
  const seq = String(index + 1).padStart(4, "0");
  return `QB-${d}-${seq}`;
};

// ── RECEIPT CALCULATION ───────────────────────────────────
export const calcReceipt = (items, discountPct=0) => {
  let subTotal=0, returnTotal=0;
  const lines = items.map(item => {
    const saleTotal = item.saleQty   * item.pricePerPiece;
    const retTotal  = item.returnQty * item.pricePerPiece;
    subTotal    += saleTotal;
    returnTotal += retTotal;
    return {...item, saleTotal, retTotal};
  });
  const actualSale  = subTotal - returnTotal;
  const discountAmt = Math.round(actualSale * discountPct / 100);
  const total       = actualSale - discountAmt;
  return {lines, subTotal, returnTotal, actualSale, discountAmt, discountPct, total};
};

// ── CSV EXPORT (UTF-8 BOM for Myanmar font) ───────────────
export const exportCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(",");
  const body    = rows.map(r =>
    Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(",")
  ).join("\n");
  // UTF-8 BOM ensures Myanmar characters show correctly in Excel
  const BOM  = "\uFEFF";
  const blob = new Blob([BOM + headers + "\n" + body], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
};

// ── REPORT 1: Detailed (with barcode) ────────────────────
export const salesToCSVRows = (sales, products=[]) => {
  // Build barcode lookup
  const barcodeMap = {};
  products.forEach(p => { barcodeMap[p.id] = p.barcode || ""; });

  return sales.flatMap(sale =>
    (sale.items||[])
      .filter(item => (item.saleQty||0)>0 || (item.returnQty||0)>0)
      .map(item => ({
        invoiceNo:     sale.invoiceNo       || "",
        date:          sale.date,
        time:          sale.printTime       || "",
        car:           sale.carName         || sale.carId,
        salesperson:   sale.salespersonName || "",
        shop:          sale.shopName        || sale.customerId,
        product:       item.productName,
        barcode:       barcodeMap[item.productId] || item.barcode || "",
        isExtra:       item.isExtra ? "YES" : "NO",
        saleQty:       item.saleQty         || 0,
        returnQty:     item.returnQty        || 0,
        pricePerPiece: item.pricePerPiece,
        saleTotal:     (item.saleQty||0)    * item.pricePerPiece,
        returnTotal:   (item.returnQty||0)  * item.pricePerPiece,
        discount:      sale.discountPct      || 0,
        netTotal:      sale.total            || 0,
      }))
  );
};

// ── REPORT 2: Shop Summary ────────────────────────────────
export const shopsToCSVRows = (sales) => {
  const map = {};
  sales.forEach(sale => {
    const key = sale.customerId || sale.shopName;
    if (!map[key]) map[key] = {
      date:         sale.date,
      time:         sale.printTime         || "",
      invoiceNo:    sale.invoiceNo         || "",
      car:          sale.carName           || "",
      salesperson:  sale.salespersonName   || "",
      shop:         sale.shopName          || "",
      discountPct:  sale.discountPct       || 0,
      itemsSold:    0, itemsReturned:0,
      subTotal:     0, returnTotal:0, discountAmt:0, netTotal:0,
    };
    map[key].subTotal      += sale.subTotal    || 0;
    map[key].returnTotal   += sale.returnTotal || 0;
    map[key].discountAmt   += sale.discountAmt || 0;
    map[key].netTotal      += sale.total       || 0;
    (sale.items||[]).forEach(item => {
      map[key].itemsSold     += item.saleQty   || 0;
      map[key].itemsReturned += item.returnQty || 0;
    });
  });
  return Object.values(map).sort((a,b) => b.netTotal - a.netTotal);
};

// ── REPORT 3: Product Summary ─────────────────────────────
export const productsToCSVRows = (sales, products=[], assignments=[]) => {
  const barcodeMap = {};
  products.forEach(p => { barcodeMap[p.id] = p.barcode || ""; });

  // Only count assignments for cars that appear in the sales data.
  // Without this filter, a product assigned to Car001 would inflate
  // totalAssignedQty when generating a report for Car002 only.
  const carIdsInSales = new Set(sales.map(s => s.carId).filter(Boolean));
  const assignedMap = {};
  assignments.forEach(a => {
    if (carIdsInSales.size === 0 || !a.carId || carIdsInSales.has(a.carId)) {
      Object.entries(a.items||{}).forEach(([pid, qty]) => {
        assignedMap[pid] = (assignedMap[pid]||0) + (qty||0);
      });
    }
  });

  const map = {};
  sales.forEach(sale => {
    (sale.items||[]).forEach(item => {
      if ((item.saleQty||0)===0 && (item.returnQty||0)===0) return;
      const key = item.productId || item.productName;
      if (!map[key]) map[key] = {
        date:             sale.date,
        product:          item.productName,
        barcode:          barcodeMap[item.productId] || item.barcode || "",
        shopsCount:       0,
        pricePerPiece:    item.pricePerPiece,
        totalAssignedQty: assignedMap[item.productId] || 0,
        totalSaleQty:     0,
        RemainQty:        0,    // computed below
        totalReturnQty:   0,
        totalSaleAmt:     0,
        totalReturnAmt:   0,
        _allExtra:        true, // becomes false if any sale entry is NOT isExtra
      };
      if (!item.isExtra) map[key]._allExtra = false;
      map[key].totalSaleQty   += item.saleQty    || 0;
      map[key].totalReturnQty += item.returnQty   || 0;
      map[key].totalSaleAmt   += (item.saleQty||0)   * item.pricePerPiece;
      map[key].totalReturnAmt += (item.returnQty||0)  * item.pricePerPiece;
      map[key].shopsCount++;
    });
  });

  const rows = Object.values(map).map(({ _allExtra, ...r }) => {
    // If ALL sale entries for this product are isExtra (never actually assigned
    // to this car's route), force assigned qty and remain to 0.
    const effAssigned = _allExtra ? 0 : r.totalAssignedQty;
    return {
      ...r,
      totalAssignedQty: effAssigned,
      RemainQty: effAssigned > 0
        ? Math.max(0, effAssigned - r.totalSaleQty)
        : 0,
    };
  });
  return rows.sort((a,b) => b.totalSaleAmt - a.totalSaleAmt);
};



// ── REPORT 5: Per-car exports (identical columns to Detailed Report) ──
// Same as salesToCSVRows but filtered by car — exports separate file per car
export const carIds = (sales) => [...new Set(sales.map(s => s.carId))];

export const carDetailRows = (sales, products=[], carId=null) => {
  const filtered = carId ? sales.filter(s => s.carId === carId) : sales;
  return salesToCSVRows(filtered, products); // exact same columns as Detailed Report
};

// ── NUMBER FORMAT ─────────────────────────────────────────
export const fmtNum = (n) => new Intl.NumberFormat().format(Math.round(n||0));
