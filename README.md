# 🎵 Dough-Re-Mi Bakery — Sales Management App

React + Firebase web application for managing daily bakery sales, delivery assignments, and reporting.

**Live app:** https://dough-re-mi-bakery.web.app
**GitHub:** https://github.com/Htet48/dough-re-mi-bakery
**Firebase project:** `dough-re-mi-bakery` (stddyhub@gmail.com)

---

## 📁 Folder Structure

```
dough-re-mi-bakery/
├── public/
│   └── index.html                  # HTML entry point
├── src/
│   ├── App.js                      # Main router + role-based routes
│   ├── index.js                    # React entry point
│   ├── index.css                   # Global theme — Forest & Honey palette
│   │
│   ├── context/
│   │   └── AuthContext.js          # Login state + user profile + role
│   │
│   ├── services/
│   │   ├── firebase.js             # Firebase config (put YOUR keys here)
│   │   └── firestoreService.js     # All database read/write functions
│   │
│   ├── hooks/
│   │   ├── useBarcodeScanner.js    # Camera + USB/wireless barcode scanner
│   │   ├── useAutoLogout.js        # Auto logout after inactivity
│   │   └── useAutoCleanup.js       # Auto-clean old Firestore data
│   │
│   ├── utils/
│   │   ├── helpers.js              # Date helpers, receipt calc, CSV export
│   │   ├── excelExport.js          # Multi-sheet Excel export (SheetJS)
│   │   └── driveExport.js          # Google Drive export helper
│   │
│   ├── pages/
│   │   ├── LoginPage.js            # Shared login for admin + salesperson
│   │   ├── admin/
│   │   │   ├── AssignPage.js       # Assign products to cars (barcode scan)
│   │   │   ├── ProductsPage.js     # Products CRUD
│   │   │   ├── ShopsPage.js        # Shops/customers CRUD
│   │   │   ├── CarsPage.js         # Cars / routes CRUD
│   │   │   ├── UsersPage.js        # User management
│   │   │   ├── DashboardPage.js    # Overview + key metrics
│   │   │   ├── ReportsPage.js      # Daily/weekly/monthly/yearly reports
│   │   │   ├── DayReportsAdminPage.js  # Day-end reports
│   │   │   └── ReturnScannerPage.js    # Return scanner (admin side)
│   │   └── salesperson/
│   │       ├── SalePage.js         # Record sales + returns + print receipt
│   │       ├── AssignmentPage.js   # View today's assignment
│   │       ├── SpReturnScannerPage.js  # Return scanner (salesperson)
│   │       └── DayReportPage.js    # Day-end summary
│   │
│   └── components/
│       ├── admin/
│       │   └── AdminLayout.js      # Admin sidebar navigation
│       └── shared/
│           ├── BarcodeScanner.js   # Camera scan modal
│           ├── ExportButton.js     # Export to Excel / Google Drive
│           └── InactivityWarning.js # Auto-logout warning banner
│
├── scripts/
│   └── seedFirestore.js            # One-time import of Excel data to Firebase
│
├── .env.example                    # Environment variable template
├── firebase.json                   # Firebase hosting config
├── firestore.rules                 # Firestore security rules
├── package.json
└── README.md
```

---

## 🚀 Setup Steps

### Step 1 — Clone & Install

```bash
git clone https://github.com/Htet48/dough-re-mi-bakery.git
cd dough-re-mi-bakery
npm install
```

### Step 2 — Firebase Config

1. Go to https://console.firebase.google.com — sign in with `stddyhub@gmail.com`
2. Open the **dough-re-mi-bakery** project
3. Click **Project Settings** (gear icon) → **Your apps** → Web app
4. Copy the `firebaseConfig` values and paste into `src/services/firebase.js`

Enable these Firebase services:
- **Authentication** → Email/Password sign-in
- **Firestore Database** → Production mode
- **Hosting** → already configured

### Step 3 — Run Locally

```bash
npm start
```
App opens at http://localhost:3000

### Step 4 — Create Admin User

In Firebase Console → **Authentication** → Add user:
- Email: `stddyhub@gmail.com`
- Password: (your choice)

Then in **Firestore** → `users` collection → Add document with ID = the user's Firebase UID:
```json
{
  "name": "Admin",
  "username": "admin",
  "role": "admin",
  "email": "stddyhub@gmail.com"
}
```

### Step 5 — Import Excel Data (One-time seed)

```bash
# Download serviceAccountKey.json from:
# Firebase Console → Project Settings → Service accounts → Generate new private key
# Save it to scripts/serviceAccountKey.json (this file is gitignored — keep it safe!)

cd scripts
node seedFirestore.js
```

This imports all your products and customers from the Excel files.

### Step 6 — Create Salesperson Users

In **Firebase Console** → Authentication → Add user for each salesperson.
In **Firestore** → `users` collection → Add document with UID:
```json
{
  "name": "Salesperson Name",
  "username": "theirUsername",
  "role": "salesperson",
  "carId": "car-document-id-from-cars-collection"
}
```

### Step 7 — Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

Live at: **https://dough-re-mi-bakery.web.app**

---

## 📱 How to Use

### Admin (Manager)
1. Login → Admin Panel
2. **Assign Today** → scan barcodes or type qty for each car/route
3. **Products / Shops / Cars / Users** → manage all master data
4. **Sales Reports** → select date range → Export to Excel or Google Drive
5. **Return Scanner** → scan returned products

### Salesperson
1. Login → Sale page (auto-redirect by role)
2. See today's assignment → tap a shop → enter sale qty + return qty
3. **Products fully allocated are hidden automatically** — no risk of overselling
4. Save → Print receipt (80mm thermal printer compatible)
5. Continue to next shop

---

## 🔧 Barcode Scanning

| Method | How to use |
|--------|-----------|
| **USB / Wireless scanner** | Plug in and scan — detected automatically, no setup |
| **Camera (mobile)** | Tap 📷 button → point camera at barcode |

---

## 🎨 Theme

**Forest & Honey** palette — clean and classic bakery look:

| Token | Color | Use |
|-------|-------|-----|
| `--forest` | `#1C3829` | Sidebar, buttons, headings |
| `--honey` | `#E4B950` | Accents, active states, brand |
| `--sage` | `#4A8C6B` | Icons, secondary accents |
| `--cream` | `#FAFAF7` | Page backgrounds |
| Font (headings) | Lora (serif) | Classic bakery feel |
| Font (body) | DM Sans | Clean readability |

---

## 🔐 Security Notes

- `scripts/serviceAccountKey.json` is **gitignored** — never commit it
- `.env` files are **gitignored** — add Google API keys there only
- Firestore rules enforce role-based access (admin vs salesperson)

---

## 📅 Feature Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| 1 | Login, Assignment, Sales, Receipt, Reports | ✅ Done |
| 2 | Products/Shops/Cars/Users CRUD, Dashboard, Return Scanner | ✅ Done |
| 3 | Product auto-hide when fully allocated, barcode block on oversell | ✅ Done |
| 4 | End-of-day report submission, push notifications | 🔜 Next |
| 5 | Production/inventory linking, multi-branch | 🔜 Future |
