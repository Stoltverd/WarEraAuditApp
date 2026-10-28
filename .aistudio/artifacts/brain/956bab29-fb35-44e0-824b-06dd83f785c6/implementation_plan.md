# Implementation Plan: Real-Time Policy & Quota Enforcement, Exact Battlefield Credit & Donor Classification Clarity

## 1. Executive Summary & Root Cause Analysis

Our forensic code audit identified three interlocking issues preventing **Policies & Quotas** from governing the **Citizen Radar (Overview)** and **Citizen Audit Modal**:

1. **Frozen Audited Profiles Bypassing Policy Updates (`ministryService.ts` & `App.tsx`)**:
   - In `auditCitizensIncomeGrowth` (`src/services/ministryService.ts`, lines 1282–1298), any citizen with `auditBaselineStatus === 'audited'` hits an early `continue;` statement that returns their previously cached `leechTier`, `contributionRatio`, `damageValueBtc`, and `economicStanding` without re-evaluating against the updated `MinistryConfig`.
   - In `App.tsx` (`citizenEconomicProfiles` `useMemo`, lines 952–975), the UI reads `audited.leechTier`, `audited.contributionRatio`, and `audited.damageValueBtc` directly from the cached `auditedProfilesMap` instead of dynamically recomputing them when `ministryConfig` changes.
   - In `CitizenRadar.tsx`, `displayedProfiles` holds a buffered state snapshot that did not immediately flush when `config` was updated.

2. **Hidden Playstyle Exclusion & Artificial Caps on Combat Damage (`ministryService.ts` & `CitizenAuditModal.tsx`)**:
   - In `evaluateLeechTier` (`src/services/ministryService.ts`, lines 1060–1077), combat damage conversion was gated behind `playstyle !== 'pure-eco'` and secretly capped for Hybrid and non-Top-10 War players. Citizens like `Cali_Botera`—who dealt **1,775,094 DMG** in the 7-day war tournament and switched to an Eco build 1 day ago—received **+0.0 BTC** credit instead of the calibrated `(1,775,094 ÷ 1,000) × 0.08 = +142.01 BTC`.
   - In `CitizenAuditModal.tsx` (line 434), the **Military & Battlefield Defense** tab read the stale `currentProfile.damageValueBtc` (`0`) rather than computing live credit from `config.includeDamageInLeechCalculation` and `config.damageConversionRateBtcPer1k`.

3. **Unlabeled Percentage Under Donor Classification (`CitizenRadar.tsx`)**:
   - In the `ESTADO FISCAL` (Donor Classification) column, the sub-label displayed a bare percentage (`4.8% · Auditado`) without stating what the percentage measures or what target quota the citizen is being judged against under the active **Policies & Quotas** rules.

---

## 2. Comparative Architectural Solutions

### Proposal A: Cache-Invalidation & Full Re-Audit on Policy Save
- **Mechanism**: Whenever the user clicks **Save & Apply Policy**, invalidate `auditedProfilesMap` in `localStorage` and re-run `auditCitizensIncomeGrowth` across all cached personal transaction ledgers in IndexedDB.
- **Pros**:
  - Guarantees persisted profiles in `localStorage` are overwritten with updated standing values.
- **Cons**:
  - Requires asynchronous IndexedDB reads for every citizen on each policy slider change.
  - Introduces a noticeable loading spinner delay (1–3 seconds) when toggling policies.

### Proposal B: Pure Reactive `useMemo` Re-Evaluation + Canonical Policy Engine (Recommended)
- **Mechanism**:
  1. Refactor `evaluateLeechTier` and `buildAuditedCitizenProfile` in `src/services/ministryService.ts` so that all **Policies & Quotas** parameters (Playstyle Quotas, Exact Combat Damage Conversion `(Damage ÷ 1,000) × Rate` for all builds without hidden caps, Wealth Percentile Floor, Historical Donor Grace Floor, Hall of Fame Top X Rank, and Raw Resource Wealth inclusion) are evaluated through a single deterministic pure function.
  2. Update `auditCitizensIncomeGrowth` so already-audited citizens preserve their verified cashflow receipts (`grossInflowBtc`, `netCashflowBtc`, `periodDonatedBtc`, `receiptCount`) while **always re-evaluating** their `leechTier`, `contributionRatio`, `damageValueBtc`, `ministerialVerdict`, and `economicStanding` against the new `MinistryConfig`.
  3. Update `App.tsx` (`citizenEconomicProfiles` `useMemo`), `CitizenRadar.tsx`, and `CitizenAuditModal.tsx` to reactively compute `evaluateLeechTier` and `resolveMasterCitizenStanding` using the live `ministryConfig` and verified cashflow metrics.
- **Pros**:
  - **Zero-latency updates**: Toggling damage conversion or changing quota percentages immediately updates every row in the Citizen Radar, KPI summary counters, Donated column, and Citizen Audit Modal without re-fetching receipts.
  - **100% Parity**: Guarantees the Overview table and all tabs of the Citizen Audit Modal always show the exact same BTC credit, contribution ratio, and fiscal standing.
- **Cons**:
  - Requires synchronizing both the reactive `useMemo` selector in `App.tsx` and the persisted `auditedProfilesMap` updater so page reloads retain the newly saved policy state.

### Proposal C: Separate Frontend Display Overlay for Policy Simulation
- **Mechanism**: Keep `auditedProfilesMap` unchanged and apply a UI-only calculation layer inside `CitizenRadar.tsx` and `CitizenAuditModal.tsx`.
- **Pros**:
  - Minimal changes to `ministryService.ts`.
- **Cons**:
  - Creates risk of state drift between exported CSV/Telegram nudges and the table UI.

### Expert Recommendation
**Proposal B** is the superior architectural choice. Separating **Receipt Aggregation** (expensive, cached from live in-game transactions) from **Policy & Quota Evaluation** (fast, deterministic math governed by `MinistryConfig`) ensures that any change in **Policies & Quotas** instantaneously recalculates every citizen's standing, quota target, and battlefield credit across the entire application and persists cleanly.

---

## 3. Edge Case Mitigation

1. **Citizens Who Respecced Mid-Week (e.g., War to Eco Build After Dealing Combat Damage)**:
   - *Edge Case*: A citizen deals 1.77M combat damage during the week, then switches to an Eco build (`Cali_Botera`).
   - *Mitigation*: When `includeDamageInLeechCalculation` is enabled, any citizen with `combatDamage > 0` receives the exact converted credit `(combatDamage / 1000) * damageConversionRateBtcPer1k` regardless of their current playstyle build, with zero hidden caps.
2. **Contribution Ratio Calculation with War Credit Enabled vs. Disabled**:
   - *Edge Case*: When `includeDamageInLeechCalculation` is active, a citizen may have `0 BTC` direct treasury donations but `+142.0 BTC` in converted war credit.
   - *Mitigation*: Effective contribution is `periodDonatedBtc + damageValueBtc`. The citizen's effective contribution ratio (`(periodDonatedBtc + damageValueBtc) / grossInflowBtc`) is compared directly against their active Playstyle Quota target (`Eco`, `Hybrid`, or `War` quota in Policies & Quotas).
3. **Zero Gross Inflow / Subsistence Citizens**:
   - *Edge Case*: An audited citizen has `0 BTC` gross cash inflow during the window, causing division-by-zero when computing percentage of inflow, or has low wealth below the country's subsistence percentile floor.
   - *Mitigation*: Guard all ratio divisions (`grossInflow > 0`), fallback cleanly to wealth-based quota or `+X.X BTC Credit` when inflow is zero, and honor the `minWealthFilterBtc` / subsistence floor configured in Policies & Quotas.
4. **30-Day Audit Window in Citizen Audit Modal**:
   - *Edge Case*: The user switches the Citizen Audit Modal between `7 Days` and `30 Days` while damage conversion is enabled.
   - *Mitigation*: Compute live military credit in `CitizenAuditModal.tsx` using the active combat damage for the selected window (`snapshot30DayDamage ?? combatDamage`) multiplied by `config.damageConversionRateBtcPer1k` when `config.includeDamageInLeechCalculation` is enabled (and display the reference value clearly when disabled).
5. **Buffered Table State During Background Audit Stream**:
   - *Edge Case*: `CitizenRadar.tsx` buffers incoming background stream updates while the user inspects the table, which could block a manual **Policies & Quotas** change from appearing immediately.
   - *Mitigation*: Track a `config` signature in `CitizenRadar.tsx` so any change to `MinistryConfig` immediately flushes and updates `displayedProfiles` and any open `selectedAuditProfile`.

---

## 4. Phased Task Decomposition

### Phase 1: Canonical Policy & Damage Credit Engine (`src/services/ministryService.ts`)
- **Phase 1.1**: Update `evaluateLeechTier` to credit all citizens who have `combatDamage > 0` using the exact formula `(combatDamage / 1000) * damageConversionRateBtcPer1k` whenever `config.includeDamageInLeechCalculation` is enabled—removing the `playstyle !== 'pure-eco'` restriction and removing all hidden quota-based caps.
- **Phase 1.2**: Ensure `evaluateLeechTier` and `buildAuditedCitizenProfile` evaluate every **Policies & Quotas** setting (Eco/Hybrid/War Patriot & Moderate quotas, Low Contributor floor, Wealth Percentile Floor, Raw Resource Wealth toggle, Historical Donor Grace Floor, and Top X Hall of Fame cutoff) consistently.
- **Phase 1.3**: Update `auditCitizensIncomeGrowth` so that when `customConfig` is applied, already-audited citizens retain their verified cashflow receipts (`playerCashflow`, `grossInflowBtc`, `netCashflowBtc`, `periodDonatedBtc`, `receiptCount`) while dynamically recomputing their `damageValueBtc`, `contributionRatio`, `leechTier`, `ministerialVerdict`, and `economicStanding`.

### Phase 2: Reactive State Propagation (`src/App.tsx`)
- **Phase 2.1**: Update `citizenEconomicProfiles` `useMemo` in `src/App.tsx` so that even for cached audited profiles, `evaluateLeechTier` and `resolveMasterCitizenStanding` are computed live using the current `ministryConfig` and the citizen's verified `grossInflowBtc` and `periodDonatedBtc`.

### Phase 3: Donor Classification Target Quota UX & Donated War Credit Display (`src/components/ministry/CitizenRadar.tsx` & `src/i18n/translations.ts`)
- **Phase 3.1**: Update the sub-label under **Donor Classification (`ESTADO FISCAL`)** in `CitizenRadar.tsx` to display **Actual vs. Policy Target Quota** (e.g., `4.8% / 7% Quota · Audited` or `4.8% / 7% Meta · Auditado` in Spanish), where the target percentage is dynamically pulled from the citizen's build (`pure-eco` → `ecoModerateThresholdPct`, `hybrid` → `hybridModerateThresholdPct`, `pure-war` → `warModerateThresholdPct`) in `MinistryConfig`, with a clear tooltip explaining the exact formula (`(Donated + War Credit) ÷ Gross Cash Inflow vs. Playstyle Policy Quota`).
- **Phase 3.2**: Update the **Donated (`DONADO`)** column in `CitizenRadar.tsx` so that when `includeDamageInLeechCalculation` is enabled and a citizen has combat damage credit, it displays their direct treasury donation alongside a distinct `+X.X BTC War Credit` badge (`+X.X BTC Créd. Guerra`), and reflects the combined contribution in their standing.
- **Phase 3.3**: Ensure `displayedProfiles` and `selectedAuditProfile` in `CitizenRadar.tsx` immediately sync whenever `config` (`MinistryConfig`) updates.

### Phase 4: Citizen Audit Modal Live Defense Credit Synchronization (`src/components/ministry/CitizenAuditModal.tsx`)
- **Phase 4.1**: Update `CitizenAuditModal.tsx` so `militaryCredit` is dynamically calculated from the active combat damage (`(activeCombatDamage / 1000) * militaryCreditRate`) when `config.includeDamageInLeechCalculation` is enabled, ensuring `Cali_Botera` (`1,775,094 DMG` at `0.08 BTC / 1k`) accurately displays `+142.01 BTC` in **Converted Military Credit** and **Total National Contribution**, and updates header standing badges immediately.

### Phase 5: Verification & Build Check
- **Phase 5.1**: Run TypeScript and production build verification (`compile_applet`) to ensure zero type or lint errors.

---

## 5. Contextual State Tracking
- **Current Phase**: Planning & Architecture Review (Pre-Execution).
- **Completed So Far**: Full forensic audit of `ministryService.ts`, `App.tsx`, `CitizenRadar.tsx`, and `CitizenAuditModal.tsx`; alignment on user preferences via clarifying questions; formulation of comparative proposals, edge-case mitigations, and phased execution plan.
- **Immediate Next Steps**: Execute **Phase 1 through Phase 5** upon your approval of this plan.
