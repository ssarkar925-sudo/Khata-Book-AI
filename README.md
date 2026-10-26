# Khata Book AI — Smart Personal Ledger & Accounting

A high-speed, zero-legacy financial ledger and Udhar Khata application engineered with Next.js 16, Supabase Cloud, and native Android Studio Capacitor support.

---

## 🌟 Core Features

1. **Ask AI Accountant:** Instant financial intelligence answering queries on monthly spends, customer debtors, credit card deadlines, and cash balances with natural language parsing.
2. **Multiple Bank Accounts & Cash:** Track SBI, HDFC, physical cash counter, and wallets with double-entry inter-account transfers.
3. **Customer & Supplier Khata (Udhar):** Customer ledger balances, settlements, and 1-click WhatsApp payment reminder receipts.
4. **Credit Cards & Billing:** Credit limit utilization gauges, statement cut-off tracking, and 1-click bill settlements.
5. **Daily Notes & Checklists:** Pinned reminders, color codes, and tick-box to-do items.
6. **Zero-Knowledge Encrypted Vault:** AES-256 GCM client-side encryption for banking passwords, ATM PINs, and personal IDs (Aadhaar, PAN).
7. **Android Studio APK:** Capacitor Android project in `android/` ready to compile debug and release APKs.

---

## 🚀 Getting Started

### 1. Install & Run Locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Connect Your Supabase Cloud Database
Run the provided `supabase_schema.sql` file directly in your [Supabase SQL Editor](https://supabase.com/dashboard/project/cjrmoanrcjexxjbrsauh/sql) in 1 click.

### 3. Build Android APK in Android Studio
```bash
npx cap open android
```
In Android Studio: Click **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate your `.apk`.
