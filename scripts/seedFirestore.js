// scripts/seedFirestore.js
// Run once to import your existing Excel data into Firebase
// Usage: node scripts/seedFirestore.js
//
// Requirements:
//   npm install xlsx firebase-admin
//   Set GOOGLE_APPLICATION_CREDENTIALS env to your service account JSON

const admin = require("firebase-admin");
const XLSX  = require("xlsx");
const path  = require("path");

// ── Initialize Firebase Admin ────────────────────────────
const serviceAccount = require("./serviceAccountKey.json"); // download from Firebase console
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Load Excel files ─────────────────────────────────────
const productsWb  = XLSX.readFile(path.join(__dirname, "../QB_Customers_List.xlsx"));  // adjust path
const customersWb = XLSX.readFile(path.join(__dirname, "../QR_Product_List.xlsx"));

const toJSON = (wb, sheetName) => {
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
};

async function seed() {
  // ── Products ─────────────────────────────────────────
  const productSheet = toJSON(customersWb, "Item Price");
  const productBatch = db.batch();
  for (const row of productSheet) {
    const ref = db.collection("products").doc();
    productBatch.set(ref, {
      name:     row["Products"] || "",
      category: row["Category"] || "",
      barcode:  String(row["Barcode"] || ""),
      price:    Number(row["Price"]) || 0,
      active:   true,
    });
  }
  await productBatch.commit();
  console.log(`✅ Imported ${productSheet.length} products`);

  // ── Customers ────────────────────────────────────────
  const customerSheet = toJSON(productsWb, "Customers");
  const custBatch = db.batch();
  for (const row of customerSheet) {
    const ref = db.collection("customers").doc();
    custBatch.set(ref, {
      name:              row["name"]              || "",
      address:           row["address"]           || "",
      phone_no:          String(row["phone_no"]   || ""),
      assigned_discount: Number(row["assigned_discount"]) || 0,
      latitude:          Number(row["latitude"])  || 0,
      longitude:         Number(row["longitude"]) || 0,
      active:            true,
    });
  }
  await custBatch.commit();
  console.log(`✅ Imported ${customerSheet.length} customers`);

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
