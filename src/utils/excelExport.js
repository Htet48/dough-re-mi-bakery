// src/utils/excelExport.js
// Multi-sheet Excel export using SheetJS (xlsx)
import * as XLSX from "xlsx";
import { salesToCSVRows, shopsToCSVRows, productsToCSVRows } from "./helpers";

// Style helpers for SheetJS
const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "5C3D1E" } }, // Dough-Re-Mi warm brown
  alignment: { horizontal: "center" },
};

const addStyledHeader = (ws, headers) => {
  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) {
      ws[cell].s = headerStyle;
    }
  });
};

// ── Export single car report with 3 sheets ───────────────
export const exportCarExcel = (sales, products, assignments, carId, carName, date, returnBuffer=false) => {
  const carSales = carId ? sales.filter(s => s.carId === carId) : sales;

  // Sheet 1: Detailed (one row per product per sale)
  const detailedRows = salesToCSVRows(carSales, products);

  // Sheet 2: Product Summary
  const productRows = productsToCSVRows(carSales, products, assignments);

  // Sheet 3: Shop Summary
  const shopRows = shopsToCSVRows(carSales);

  const wb = XLSX.utils.book_new();

  // Add sheets
  const wsDetailed = XLSX.utils.json_to_sheet(detailedRows);
  const wsProduct  = XLSX.utils.json_to_sheet(productRows);
  const wsShop     = XLSX.utils.json_to_sheet(shopRows);

  // Set column widths for Detailed sheet
  wsDetailed['!cols'] = [
    {wch:18}, {wch:12}, {wch:10}, {wch:12}, {wch:20}, // invoice,date,car,sp,shop
    {wch:22}, {wch:12}, {wch:8},  {wch:8},  {wch:8},  // product,barcode,isExtra,saleQty,returnQty
    {wch:12}, {wch:12}, {wch:12}, {wch:8},  {wch:12}, // price,saleTotal,returnTotal,discount,netTotal
  ];

  wsProduct['!cols'] = [
    {wch:12},{wch:22},{wch:12},{wch:12},{wch:12},
    {wch:12},{wch:12},{wch:12},{wch:8},{wch:12},{wch:12},
  ];

  wsShop['!cols'] = [
    {wch:12},{wch:18},{wch:10},{wch:12},{wch:20},
    {wch:8},{wch:12},{wch:12},{wch:8},{wch:12},{wch:12},{wch:8},
  ];

  XLSX.utils.book_append_sheet(wb, wsDetailed, "Detailed");
  XLSX.utils.book_append_sheet(wb, wsProduct,  "Product Summary");
  XLSX.utils.book_append_sheet(wb, wsShop,     "Shop Summary");

  // Save locally or return buffer for Drive upload
  const fileName = `QB_${carName}_${date}.xlsx`;
  if (returnBuffer) {
    return { buffer: XLSX.write(wb, { bookType: "xlsx", type: "array" }), fileName };
  }
  XLSX.writeFile(wb, fileName);
  return fileName;
};

// ── Export ALL cars — one Excel file per car ─────────────
export const exportAllCarsExcel = (sales, products, assignments, date) => {
  const carMap = {};
  sales.forEach(s => { carMap[s.carId] = s.carName || s.carId; });

  const exported = [];
  Object.entries(carMap).forEach(([carId, carName]) => {
    const fileName = exportCarExcel(sales, products, assignments, carId, carName, date);
    exported.push({ carName, fileName });
  });
  return exported;
};
