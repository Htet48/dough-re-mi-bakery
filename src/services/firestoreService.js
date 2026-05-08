// src/services/firestoreService.js
import {
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, query,
  where, orderBy, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "./firebase";

const COL = {
  users:"users", products:"products", customers:"customers",
  cars:"cars", assignments:"assignments", sales:"sales", dailyReports:"dailyReports",
};

// ── USERS ─────────────────────────────────────────────────
export const createUser = (uid, data) =>
  setDoc(doc(db, COL.users, uid), { ...data, createdAt: serverTimestamp() });
export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, COL.users, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, COL.users));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateUser = (uid, data) => updateDoc(doc(db, COL.users, uid), data);
export const deleteUser = (uid)       => deleteDoc(doc(db, COL.users, uid));

// Find user by username (for login)
export const getUserByUsername = async (username) => {
  const q = query(collection(db, COL.users), where("username", "==", username.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

// Find user by email field in Firestore (to get their username etc)
export const getUserByEmail = async (email) => {
  const q = query(collection(db, COL.users), where("email", "==", email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

// ── PRODUCTS ──────────────────────────────────────────────
export const addProduct = (data) =>
  addDoc(collection(db, COL.products), { ...data, createdAt: serverTimestamp() });
export const getAllProducts = async () => {
  const snap = await getDocs(collection(db, COL.products));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateProduct = (id, data) => updateDoc(doc(db, COL.products, id), data);
export const deleteProduct = (id)       => deleteDoc(doc(db, COL.products, id));
export const getProductByBarcode = async (barcode) => {
  const q = query(collection(db, COL.products), where("barcode", "==", String(barcode)));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

// ── CUSTOMERS ─────────────────────────────────────────────
export const addCustomer = (data) =>
  addDoc(collection(db, COL.customers), { ...data, createdAt: serverTimestamp() });
export const getAllCustomers = async () => {
  const snap = await getDocs(collection(db, COL.customers));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateCustomer = (id, data) => updateDoc(doc(db, COL.customers, id), data);
export const deleteCustomer = (id)       => deleteDoc(doc(db, COL.customers, id));

// ── CARS ──────────────────────────────────────────────────
export const addCar = (data) =>
  addDoc(collection(db, COL.cars), { ...data, createdAt: serverTimestamp() });
export const getAllCars = async () => {
  const snap = await getDocs(collection(db, COL.cars));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateCar = (id, data) => updateDoc(doc(db, COL.cars, id), data);
export const deleteCar = (id)       => deleteDoc(doc(db, COL.cars, id));

// ── ASSIGNMENTS ───────────────────────────────────────────
export const setAssignment = (dateStr, carId, data) =>
  setDoc(doc(db, COL.assignments, `${dateStr}_${carId}`), {
    ...data, date: dateStr, carId, updatedAt: serverTimestamp(),
  });
export const getAssignment = async (dateStr, carId) => {
  const snap = await getDoc(doc(db, COL.assignments, `${dateStr}_${carId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
export const getAssignmentsByDate = async (dateStr) => {
  const q = query(collection(db, COL.assignments), where("date", "==", dateStr));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── SALES ─────────────────────────────────────────────────
// KEY FIX: use deterministic doc ID = date_carId_customerId
// This prevents duplicates — saving again overwrites the same doc
export const upsertSale = (dateStr, carId, customerId, data) =>
  setDoc(
    doc(db, COL.sales, `${dateStr}_${carId}_${customerId}`),
    { ...data, updatedAt: serverTimestamp() },
    { merge: false }  // full overwrite — not merge — so old items are replaced
  );

// Keep addSale for backward compat but redirect to upsertSale
export const addSale = (data) => {
  if (data.date && data.carId && data.customerId) {
    return upsertSale(data.date, data.carId, data.customerId, {
      ...data, createdAt: serverTimestamp()
    });
  }
  return addDoc(collection(db, COL.sales), { ...data, createdAt: serverTimestamp() });
};

export const updateSale = (id, data) => updateDoc(doc(db, COL.sales, id), data);

// Increment save count atomically — called after every addSale / updateSale
export const incrementSaveCount = (saleId) =>
  updateDoc(doc(db, COL.sales, saleId), {
    saveCount:   increment(1),
    lastSavedAt: serverTimestamp(),
  });

// Increment print count atomically — called when receipt is printed
export const incrementPrintCount = (saleId) =>
  updateDoc(doc(db, COL.sales, saleId), {
    printCount:    increment(1),
    lastPrintedAt: serverTimestamp(),
  });

export const getSalesByDate = async (dateStr) => {
  const q = query(collection(db, COL.sales), where("date", "==", dateStr));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const getSalesByDateAndCar = async (dateStr, carId) => {
  const q = query(
    collection(db, COL.sales),
    where("date", "==", dateStr),
    where("carId", "==", carId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const getSalesByDateRange = async (startStr, endStr) => {
  const q = query(
    collection(db, COL.sales),
    where("date", ">=", startStr),
    where("date", "<=", endStr),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── DAILY REPORTS ─────────────────────────────────────────
export const submitDailyReport = (dateStr, carId, data) =>
  setDoc(doc(db, COL.dailyReports, `${dateStr}_${carId}`), {
    ...data, date: dateStr, carId, submittedAt: serverTimestamp(),
  });
export const getDailyReport = async (dateStr, carId) => {
  const snap = await getDoc(doc(db, COL.dailyReports, `${dateStr}_${carId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
export const getDailyReportsByDate = async (dateStr) => {
  const q = query(collection(db, COL.dailyReports), where("date", "==", dateStr));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── RETURN SCAN PROGRESS (per-car — works across devices) ───
// Per-car: keyed by `${dateStr}_${carId}`
export const saveReturnScanByCar = async (dateStr, carId, items, remainingItems=[], meta={}) => {
  const ref = doc(db, "returnScans", `${dateStr}_${carId}`);
  await setDoc(ref, {
    date: dateStr, carId,
    carName:         meta.carName         || "",
    salespersonName: meta.salespersonName || "",
    items, remainingItems,
    updatedAt: new Date().toISOString(),
  });
};
export const getReturnScanByCar = async (dateStr, carId) => {
  const ref  = doc(db, "returnScans", `${dateStr}_${carId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};
export const getReturnScansByDate = async (dateStr) => {
  const q    = query(collection(db, "returnScans"), where("date", "==", dateStr));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
// Legacy (date-only key) kept for backward compat
export const saveReturnScan = async (dateStr, items, remainingItems=[]) => {
  const ref = doc(db, "returnScans", dateStr);
  await setDoc(ref, { date: dateStr, items, remainingItems, updatedAt: new Date().toISOString() });
};
export const getReturnScan = async (dateStr) => {
  const ref  = doc(db, "returnScans", dateStr);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

// ── ADMIN DELETE FUNCTIONS ────────────────────────────────
export const deleteAssignment = (dateStr, carId) =>
  deleteDoc(doc(db, COL.assignments, `${dateStr}_${carId}`));

export const deleteSale = (id) =>
  deleteDoc(doc(db, COL.sales, id));

export const deleteDailyReport = (dateStr, carId) =>
  deleteDoc(doc(db, COL.dailyReports, `${dateStr}_${carId}`));

// ── AUTO CLEANUP (client-side, Spark plan) ────────────────
// Deletes records older than `daysToKeep` days.
// Returns count of deleted docs.
export const cleanupOldData = async (daysToKeep = 30) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // "yyyy-mm-dd"

  let deleted = 0;
  // Only clean date-bound transactional collections.
  // products, users, customers, cars are permanent reference data — never deleted.
  const colsWithDate = [COL.sales, COL.assignments, "returnScans"];
  for (const col of colsWithDate) {
    try {
      const q    = query(collection(db, col), where("date", "<", cutoffStr));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        deleted++;
      }
    } catch (_) { /* collection may not exist yet — ignore */ }
  }
  return deleted;
};
