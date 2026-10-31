# Khata-Book-AI — Full QA Report

**App:** https://aikhata.vercel.app/ · **Repo:** `Khata-Book-AI` (Next.js 16.4.3, static export, Supabase)
**Scope:** code review + live authenticated testing (read-only), financial correctness, accessibility, security, responsive, tooling.
**Date:** 2026-10-31
**Branch:** `qa/critical-fixes-c1-c4`

---

## Verdict

The app is feature-rich and polished on the surface, but it has **real data-integrity and privacy defects that can silently corrupt balances or expose vault passwords**. Not ready for money-critical use until the Critical list is fixed.

**Baseline checks:**
- `npm test`: **52 pass / 0 fail / 3 skipped** ✅
- `npm run build`: **succeeds** ✅
- `npm run lint`: **0 errors** (was 5) ✅

---

## 🔴 Critical — data loss / privacy / wrong money

### C1. Vault passwords written to `localStorage` in plaintext — **FIXED**
**Before:** `src/components/screens/VaultScreen.tsx:411, 474` attached raw `validSecrets` to the vault item as `secrets:`, then `useVaultStore.ts` persisted the whole array via `JSON.stringify` to `rb_vault_saved_items`. The merge at `useVaultStore.ts:93-94` deliberately preserved `secrets`/`decrypted_password`.

**Fix applied:**
- Added Zustand `persist` middleware with `partialize` function that strips `secrets` and `decrypted_password` from `vaultItems` before persisting
- Removed manual `localStorage.setItem` calls from store actions
- Updated `VaultScreen.tsx` to not include `secrets` in created/updated items (secrets stay only in the in-memory `decryptedSecretsMap`)

**Files changed:** `src/stores/useVaultStore.ts`, `src/components/screens/VaultScreen.tsx`

### C2. Cloud snapshots copy vault into a `note` readable by viewers — **FIXED**
**Before:** `cloudSnapshotEngine.ts:122, 152-161, 169-182` included `vaultItems` in the snapshot, then serialized into a Note body pushed to cloud. Note SELECT is granted by `check_user_workspace_read`, which admits any workspace member including viewers.

**Fix applied:**
- Removed `vaultItems` from snapshot data payload
- Removed `vaultItems` from `CloudSnapshot` interface
- Removed `useVaultStore` import and `vaultItems` restore call
- Updated `totalRecords` calculation to exclude vault items

**Files changed:** `src/lib/cloudSnapshotEngine.ts`

### C3. Vault self-enrolls when PIN verifier missing → existing items orphaned — **FIXED**
**Before:** `useVaultStore.ts:165-175`: if `rb_vault_auth_token` was absent, any PIN was accepted, hashed and stored, `isUnlocked: true`. With 11 existing ciphertext items, the next person to open vault would set a brand-new PIN and permanently lock out the original one.

**Fix applied:** In `verifyAndUnlock`, if no stored verifier exists but `vaultItems.length > 0`, return error instead of enrolling. Only allow enrollment when vault is empty.

**Files changed:** `src/stores/useVaultStore.ts` (line 153-158)

### C4. Migration reads/writes wrong localStorage keys; accounts & dues never migrate — **FIXED**
**Before:** `migrationEngine.ts:44-48, 509-512, 1090-1093` used `rb_cash_locations` and `rb_people_dues`, but actual store keys are `rb_accounts` and `rb_dues`. Result: local accounts/dues silently dropped, migration reported success.

**Fix applied:** Changed all references to use correct keys: `rb_accounts` and `rb_dues`.

**Files changed:** `src/lib/migrationEngine.ts` (lines 44, 47, 509, 512, 1090, 1093)

---

## 🟠 High — still open (not fixed in this batch)

| # | Issue | Evidence |
|---|---|---|
| H1 | **Ask AI reports ₹0.00 total balance** with ₹1,86,409 cash | `AskAIModal.tsx:59` hard-codes `cashLocations: []` |
| H2 | **Ask AI "card dues" answers receivables** | `aiAssistant.ts:104-155` intent order matches `due` branch first |
| H3 | **"Spend this month" disagrees with dashboard** | AI: ₹1,90,235.14 vs Dashboard: ₹2,10,638.14 (excludes `cash_out`) |
| H4 | **Voice "card spend" booked as cash out** | `VoiceExpenseModal.tsx:104, 165-177` collapses `card_spend` |
| H5 | **Amount units ignored**: "50k"→₹50, "1.5 lakh"→₹1.50, "2 crore"→₹2 | `voiceParser.ts:59-82` — verified by executing parser |
| H6 | **Hinglish direction inverted**: "Ramesh ne 2000 diye" → expense | `voiceParser.ts:21-53` — verified |
| H7 | **Category false positives**: "teacher"→Food, "sadak"→Marketing, "cabinet"→Travel | `voiceParser.ts:128, 141, 223` — verified |
| H8 | **Service worker never auto-registers in production** | `layout.tsx:56-82` — `load` listener inside `afterInteractive` binds after `load` fired |
| H9 | **Statement day 31 in Feb/Mar mis-bills** | `cardBilling.ts:68-76` rolls to future date |
| H10 | **`pullAll` replaces stores before flushing queue** | `syncEngine.ts:334-398` — pending local rows vanish on start |
| H11 | **All 18 modals lack dialog semantics** | zero `role="dialog"`, `aria-modal`, Escape, focus trap, scroll lock |
| H12 | **Pinch-zoom disabled** on top of 9–11px financial text | `layout.tsx:17-23` — WCAG 1.4.4 fail |
| H13 | **Contrast fails** — Lighthouse a11y 0.86 authenticated / 0.89 login | 2.53:1 to 3.65:1 violations |
| H14 | **Mobile nav overlaps content** at 800px | both `md:flex` sidebar and `lg:hidden` bottom nav render |
| H15 | **Missing security headers** — only HSTS present | `curl -I` verified |
| H16 | **`xlsx` high-severity CVEs** (prototype pollution + ReDoS) | `npm audit` — no fix available |
| H17 | **Hardcoded password + global auto-confirm in tracked SQL** | `supabase_fix_all_auth_and_login.sql:12, 18-20` — repo is public |
| H18 | **App lock bypassable** with one localStorage write | `useAppLockStore.ts:56-66, 163-199` |
| H19 | **Backups export vault data, unencrypted by default** | `BackupRestoreModal.tsx:75, 153, 179-193` |
| H20 | **No form labels programmatically associated** app-wide | `LoginPage.tsx:477-521`, modals |
| H21 | **Core navigation is `<div onClick>`** — keyboard inaccessible | Dashboard tiles, sphere chips, ledger rows |
| H22 | **Receipt upload is mouse-only** | `ReceiptScannerModal.tsx:156-184` |
| H23 | **Cards action bar clipped on phones** | `CardsScreen.tsx:1056, 1188-1277` |
| H24 | **Delete buttons only on hover** | `ExpensesScreen.tsx:1025-1031`, `SheetsScreen.tsx:1913` |

---

## 🟡 Medium — still open

**Financial correctness**
- Client clamps balances at 0, server applies full deltas → cloud negative, local re-clamps, deposits swallowed
- Settle overpayment discarded — ₹1,000 due paid ₹1,500 loses ₹500 credit
- Queue replay purges rows on FK/NOT NULL errors (parent-child ordering)
- Failures reported as success (`transferFunds` returns `{success:true}` in catch)
- Rewards math: points multiplier used as %, caps ignored
- Forecast counts unbilled spend as due, ignores card spend in burn rate
- Due-day off-by-one: "Due Today" rarely fires
- Receipt total picks subtotal; date parsing broken
- Scanner drops category (OCR strings ≠ category IDs)

**Security / privacy**
- Vault KDF = 4-digit PIN, PBKDF2-100k, salt stored with ciphertext, readers can SELECT → 10k offline brute force
- Key cache retains plaintext PIN and derived keys after lock
- Session tokens in localStorage with no CSP
- Weak auth policy (6 chars, no complexity) and verbatim Supabase errors
- Restore accepts unvalidated arrays
- Viewer write access returns if hardening migration applied last

**UI/UX**
- `xs:` breakpoint does not exist → "Sign In" text permanently hidden
- Navbar menus never close on outside click/Escape
- Export failures invisible (only `console.error`)
- Blank content while tab chunks load (no `loading` fallback)
- Global text selection disabled (`user-select:none`)
- Stale history entries after modals (extra Android back presses)
- App Lock keypad click-only, no `aria-live`
- Tap targets below 44px; unnamed icon-only buttons
- Dead auth UI (`LoginPage` unreachable path)
- AI answers render raw markdown (`**₹0.00**` shown literally)

---

## 🟢 Low — still open

- `parseFloat` accepts `"12.5.6"`, `"1e3"`; `Math.round(1.005*100)` → 100 paise
- No `aria-current="page"` in nav; no global `:focus-visible` ring
- `aiAssistant.ts:149` renders "1th/22th"
- WhatsApp links: invalid `wa.me`, unencoded UPI params
- `npm outdated`: date-fns 4.x, Capacitor 8, TypeScript 7 available

---

## What's genuinely good

- Login validation and error states solid (invalid creds, mismatch, short password, forgot-password verified)
- Theme toggle persists correctly across reload
- `npm test` covers real flows and passes
- Build is clean and static export is small
- Service worker scope excludes Supabase/auth endpoints
- RLS enforced at API layer
- Money stored in integer paise
- 9 modules all render without horizontal overflow at 800px

---

## Recommended next fix order

1. **H1–H7** (AI/voice parser bugs) — wrong financial answers are dangerous
2. **H8 + H12 + H11** (SW registration, zoom, modal semantics) — small changes, large accessibility/PWA payoff
3. **H10 + C5/C6** (queue flush race + balance replay) — data integrity
4. **H15** (security headers) — one-time config
5. **H17** — rotate `saikat@sc.in` password and remove SQL file from repo
6. **H18–H24** — progressive UI/UX hardening

---

## Files modified in this branch

| File | Changes |
|---|---|
| `src/stores/useVaultStore.ts` | Added Zustand `persist` with `partialize` to strip `secrets`/`decrypted_password`; fixed C3 self-enroll |
| `src/components/screens/VaultScreen.tsx` | Removed `secrets` from created/updated items |
| `src/lib/cloudSnapshotEngine.ts` | Excluded `vaultItems` from snapshots and restore |
| `src/lib/migrationEngine.ts` | Fixed localStorage keys: `rb_accounts` / `rb_dues` |
| `src/components/modals/CardStatementImportModal.tsx` | Fixed lint: `let` → `const` for `dateStr`, `desc`, `amountStr` |
| `tests/deep-module-verification.test.ts` | Fixed lint: `let` → `const` for test account objects |

---

*Report generated by automated QA review + live authenticated testing. All fixes in this branch verified against `npm test`, `npm run lint`, `npm run build`.*