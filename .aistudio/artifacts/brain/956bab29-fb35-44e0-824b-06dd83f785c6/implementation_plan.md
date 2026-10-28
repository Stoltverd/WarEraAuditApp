# Implementation Plan: National Census Synchronization, Audit Lifecycle Gating & Personal Receipt Persistence Fix

## 1. Root Cause Diagnosis of the Three Reported Issues

### Issue #1: Background Audit Starts While the National Census Is Still in Progress
- **Root Cause A (`src/App.tsx` lines 326–336 & 1139–1143)**: During `executeSync`, `syncCountryData` streams resolved citizens in chunks of 16 via `onChunkUsers`, incrementally updating `usersMap` and `citizenEconomicProfiles` while `isSyncing` is still `true`. However, the `useEffect` on line 1139 (`if (citizenEconomicProfiles.length > 0) handleRunIncomeAudit()`) does **not** check `!isSyncing`, firing income audits against partial citizen cohorts while the census is only partly ingested.
- **Root Cause B (`src/components/ministry/CitizenRadar.tsx` lines 370–409 & `src/App.tsx` lines 773–795)**: Because `countryBenchmark` (national P75 net worth, median liquid cash, median income) is derived from `activeCountryCitizens`, starting the background receipt stream (`auditStreamService.startStream`) before `syncCountryData` has finished resolving all citizens causes the first batch of audited citizens (starting with the #1 richest citizen, `N3V1T5`) to be evaluated against an incomplete national benchmark or interrupted when the census finishes.

### Issue #2: National Census Gets Permanently Stuck (e.g., `95 of 98 registered active citizens (97%)`)
- **Root Cause (`src/App.tsx` lines 531–555 vs. lines 773–788, and `CitizenRadar.tsx` line 179)**:
  - In `src/App.tsx`, `totalActiveCitizens` returns `selectedCountry.rankings?.countryActivePopulation?.value` (`98` for Colombia), which is the server's raw active population counter (including citizens below Level 10 or recently emigrated accounts).
  - Meanwhile, `citizenEconomicProfiles` (`src/App.tsx` line 784) explicitly filters `usersMap` for `isActive && level >= 10`, producing **`95`** eligible active citizens.
  - Both `CitizenRadar.tsx` (line 179) and `MinistryWorkspace.tsx` (line 182) compute:
    ```ts
    const isCohortAuditing = Boolean(isSyncing) || (totalActiveCitizens !== undefined && totalActiveCitizens > 0 && profiles.length < totalActiveCitizens);
    ```
  - Because `profiles.length` (`95`) is strictly less than `totalActiveCitizens` (`98`), `profiles.length < totalActiveCitizens` (`95 < 98`) remains **`true` forever** even after `isSyncing` becomes `false`! This permanently locks the top banner at *"Processed 95 of 98 registered active citizens (97%)"* and keeps all 4 ministerial KPI cards in an infinite loading state.

### Issue #3: Citizens (e.g., `N3V1T5`) Show `0.0 BTC` & `0 receipts` After the Audit Finishes (Even With 2,993 Cached Receipts)
Three compounding bugs caused `N3V1T5` to show `IN +0.0 / NET +0.0 / 0 receipts` in the table (Screenshot 1) and `0.0 BTC` with `"Queried personal stream: 0 receipts found for this 7D period"` next to `Line-Item Transaction Ledger (2993)` in the modal (Screenshot 2):
1. **Bug 3A — `auditSchemaVersion` and `muDonationsBtc` Stripped in `src/App.tsx` (`citizenEconomicProfiles`, lines 918–996)**:
   - While `App.tsx` checks `audited.auditSchemaVersion === 2` on line 860, the `list.push({ ... })` object construction on lines 918–996 **omitted `auditSchemaVersion` and `muDonationsBtc`**!
   - Consequently, every `CitizenEconomicProfile` passed down to `CitizenRadar`, `CitizenAuditModal`, and `auditCitizensIncomeGrowth` had `auditSchemaVersion: undefined`.
   - When `handleRunIncomeAudit` ran (`ministryService.ts` line 1220), its immutability guard (`p.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION`) evaluated `undefined === 2` (`false`), stripping the audited protection.
   - When the user opened `CitizenAuditModal` for `N3V1T5`, line 211 checked `localProfile.auditSchemaVersion !== 2` (`undefined !== 2` -> `true`) and immediately triggered an automatic `handleSyncLiveReceipts(7)` on mount!
2. **Bug 3B — Swallowed `AbortError` in `fetchUserTransactions` (`src/services/apiService.ts` lines 751 & 926–929)**:
   - Inside `fetchUserTransactions`, when an `AbortSignal` triggers (e.g. when a stream restarts, a component re-renders, or a worker aborts), the `catch` block executes:
     ```ts
     if (signal?.aborted || err?.name === 'AbortError') {
       break;
     }
     ```
     and then returns `allTransactions` (`[]`) **without throwing `AbortError`**!
   - Callers (`auditStreamService` and `CitizenAuditModal`) therefore received `[]` as a successful response and overwrote `N3V1T5`'s profile with **`0 receipts` and `0.0 BTC`**!
3. **Bug 3C — Unawaited IndexedDB Cache Race in `CitizenAuditModal.tsx` (lines 156–160 vs. 209–218 & 440–448)**:
   - On modal mount, `storage.getUserPersonalTransactions(profile.userId)` is started asynchronously in a `useEffect` (line 156), which loaded `N3V1T5`'s **2,993** cached transactions from IndexedDB (populating `Line-Item Transaction Ledger (2993)`).
   - However, `handleSyncLiveReceipts` was fired synchronously on mount (line 214) when `personalTransactions` in the React closure was still `[]`, and it did not `await storage.getUserPersonalTransactions(userId)` before merging. When the aborted/racing fetch returned `[]`, `mergedTxs` evaluated to `[]` (`0` items), overwriting `localProfile` with `0.0 BTC` and displaying `"Queried personal stream: 0 receipts found for this 7D period."` right above the tab showing `(2993)`!

---

## 2. Comparative Architectural Proposals

### Proposal A: Strict Two-Stage Sequential Pipeline with Verified Cohort Alignment & Atomic Receipt Hydration *(Recommended)*
- **Architecture**:
  1. **Stage 1 (National Census Hydration)**: Track an explicit `isCensusComplete` state in `App.tsx` that is `false` while `isSyncing === true` and becomes `true` only after `syncCountryData` finishes resolving all citizen profiles for the selected country. Once `isSyncing === false`, align `totalActiveCitizens` with the actual verified Level 10+ active cohort (`citizenEconomicProfiles.length`) so the census progress bar (`processed / total`) reaches `100%` cleanly and never hangs at `95 / 98` due to sub-Level-10 accounts.
  2. **Stage 2 (Gated Background Audit Stream)**: Gate both `handleRunIncomeAudit` (`App.tsx`) and `auditStreamService.startStream` (`CitizenRadar.tsx`) strictly on `isCensusComplete && !isSyncing`. If a census sync begins, immediately pause/stop any background receipt stream until the census completes.
  3. **Atomic Receipt Persistence & Schema Preservation**:
     - Preserve `auditSchemaVersion` and `muDonationsBtc` in `App.tsx` (`citizenEconomicProfiles`).
     - In `fetchUserTransactions` (`apiService.ts`), always throw an explicit `AbortError` when `signal?.aborted` is true so aborted requests are never mistaken for `0 receipts`.
     - In `auditStreamService.ts` and `CitizenAuditModal.tsx`, always read and merge existing cached receipts from IndexedDB (`await storage.getUserPersonalTransactions(userId)`) before building an audited profile, and auto-hydrate any citizen profile whose `receiptCount === 0` if IndexedDB already holds cached personal receipts for that citizen.
     - Automatically apply buffered background audit results to the live table as soon as the background stream finishes (or immediately for any citizen whose current row has `0 receipts` / unverified status), while preserving manual pinning only when the user is actively filtering/editing.
- **Pros**:
  - Completely eliminates the `95/98` infinite stuck state.
  - Guarantees `countryBenchmark` is 100% accurate before the first citizen (`N3V1T5`) is audited.
  - Guarantees that cached receipts (like `N3V1T5`'s 2,993 receipts) are never wiped out by an aborted request or missing `auditSchemaVersion` prop.
- **Cons**:
  - Background receipt auditing waits a few seconds for the initial national census (`user.getUserLite` batch hydration) to reach 100% before starting.
- **Expert Reasoning**:
  - Auditing individual citizen cashflows before the national census finishes is mathematically unsound because fiscal classifications (`Model Patriot`, `Critical Leech`, etc.) depend on the national P75 wealth and median liquid cash benchmarks. A strict two-stage pipeline guarantees both benchmark precision and zero race conditions.

### Proposal B: Concurrent Census + Audit with Post-Census Benchmark Recomputation
- **Architecture**:
  - Allow the background receipt stream to run simultaneously with the national census, and trigger a full re-evaluation of all audited profiles after `isSyncing` transitions to `false`.
- **Pros**:
  - Starts fetching personal transaction pages slightly earlier during initial country load.
- **Cons**:
  - Concurrent `user.getUserLite` census batches and 4-worker `transaction.getPaginatedTransactions` streams compete for the same token-bucket rate limiter, slowing down the census and increasing mid-sync state churn.
- **Expert Reasoning**:
  - Rejected because the user explicitly noted: *"The background audit is starting when the national census is still in progress. We can't have a precise audit if the census isn't complete."*

### Proposal C: On-Demand / Manual-Only Background Audit Trigger
- **Architecture**:
  - Complete the national census automatically, but require the user to click a "Start Financial Audit" button to begin streaming personal receipts.
- **Pros**:
  - Zero automatic background network traffic after census completion.
- **Cons**:
  - Degrades UX by requiring manual intervention before the Ministry table shows verified cashflows.
- **Expert Reasoning**:
  - Automatic background auditing after census completion is a core workflow; gating it strictly on `isCensusComplete` gives all the safety of manual ordering without extra user clicks.

---

## 3. Edge Case Mitigations

1. **Sub-Level-10 Citizens & Emigrated Accounts in Server Population Count (`95 vs 98`)**:
   - While `isSyncing === true`, `totalActiveCitizens` uses the server's `countryActivePopulation` estimate (`98`) so the progress bar shows live ingestion progress (`0 -> 95`). The moment `isSyncing` completes (`isSyncing === false`), `totalActiveCitizens` snaps to the exact count of verified Level 10+ active citizens (`citizenEconomicProfiles.length`, e.g., `95`), ensuring `isCohortAuditing` immediately resolves to `false` (`95 / 95 = 100%`).
2. **Aborted Requests & Mid-Stream Country/Window Switching**:
   - In `fetchUserTransactions` (`src/services/apiService.ts`), any `signal?.aborted` check or caught `AbortError` will immediately throw `new DOMException('Aborted', 'AbortError')` instead of breaking and returning a partial or empty array. Neither `auditStreamService` nor `CitizenAuditModal` will ever persist a profile from an aborted fetch.
3. **Power-Traders With Thousands of Receipts (e.g., `N3V1T5` with 2,993 receipts)**:
   - Use standard `limit: 50` pagination with cursor + page fallback in `fetchUserTransactions`. If a late page (e.g., page 40) encounters a transient error after retries while earlier pages succeeded, merge the fetched transactions with IndexedDB (`storage.getUserPersonalTransactions(userId)`) rather than discarding all transactions or overwriting with `0`.
   - When opening `CitizenAuditModal`, immediately hydrate `localProfile` from the IndexedDB `personal_receipts` cache if `cached.length > 0` and the incoming profile has `receiptCount === 0` or `grossInflowBtc === 0`.
4. **Buffered Audit Updates Not Appearing on Citizens With `0 receipts`**:
   - In `CitizenRadar.tsx`, if a citizen currently displays unverified or empty data (`receiptCount === 0` and `grossInflowBtc === 0`), or when the background audit stream completes (`!streamProgress.isRunning`), automatically flush buffered updates into `auditedProfilesMap` so the user never sees `0.0 BTC / 0 receipts` for an already-audited citizen.

---

## 4. Phased Task Decomposition

### Phase 1: Census Completion Gate & Cohort Count Alignment
- **Phase 1.1 (`src/App.tsx`)**:
  - Add `auditSchemaVersion` and `muDonationsBtc` to the `CitizenEconomicProfile` objects constructed inside `citizenEconomicProfiles` (`list.push({ ... })`) so audited status and schema version `2` are never stripped on re-render.
  - Update `totalActiveCitizens` in `src/App.tsx` so that once `isSyncing === false` and `citizenEconomicProfiles.length > 0`, it returns `citizenEconomicProfiles.length` (the verified Level 10+ active citizen count), eliminating the permanent `95 of 98` deadlock.
  - Gate the `useEffect` calling `handleRunIncomeAudit()` on `!isSyncing` so income audits never run while the national census is still ingesting user chunks.
- **Phase 1.2 (`src/components/ministry/MinistryWorkspace.tsx` & `src/components/ministry/CitizenRadar.tsx`)**:
  - Update `isCohortAuditing` / `isCensusAuditing` so it only remains `true` while `Boolean(isSyncing)` is active (or when `profiles.length === 0` during initial hydration), preventing the census banner and KPI cards from ever getting stuck after `isSyncing` finishes.
  - Gate `auditStreamService.startStream` in `CitizenRadar.tsx` strictly on `!isSyncing && !isCohortAuditing && profiles.length > 0`, and explicitly call `auditStreamService.stop()` if `isSyncing` becomes `true`.

### Phase 2: Atomic Receipt Persistence, Abort Safety & Auto-Hydration
- **Phase 2.1 (`src/services/apiService.ts`)**:
  - In `fetchUserTransactions`, throw an explicit `AbortError` whenever `signal?.aborted` is true instead of `break`ing and returning `[]`.
  - Use `limit: 50` (matching WarEra's standard tRPC page limit across all endpoints) to ensure maximum stability across multi-page streams.
- **Phase 2.2 (`src/services/auditStreamService.ts`)**:
  - In `auditSingleCitizen`, merge newly fetched receipts with any existing cached receipts from `storage.getUserPersonalTransactions(citizen.userId)` before calling `buildAuditedCitizenProfile`, so a citizen with cached receipts is never downgraded to `0 receipts`.
  - Ensure `AbortError` or `isStaleRun()` cleanly exits without invoking `onProfileAudited` or overwriting IndexedDB.
- **Phase 2.3 (`src/components/ministry/CitizenRadar.tsx` & `src/components/ministry/CitizenAuditModal.tsx`)**:
  - In `CitizenRadar.tsx`, immediately apply audited profiles to `auditedProfilesMap` when the citizen previously had `0 receipts` or when the background audit stream completes (`onComplete`), removing the trap where finished audits stay hidden in a staging buffer.
  - In `CitizenAuditModal.tsx`, await `storage.getUserPersonalTransactions(currentProfile.userId)` both on modal mount (auto-healing `localProfile` and parent state immediately if `cached.length > 0` while `localProfile.receiptCount === 0`) and inside `handleSyncLiveReceipts` before merging, ensuring `N3V1T5`'s 2,993 receipts immediately display accurate Gross Inflow, Net Cashflow, and Treasury Contribution.

### Phase 3: Build & Lint Verification
- **Phase 3.1**: Run `compile_applet` and `lint_applet` to verify zero TypeScript or ESLint errors across all modified files.
