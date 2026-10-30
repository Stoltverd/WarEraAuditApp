# Implementation Plan: Same-Build Skill Reset vs. Cross-Build Switch Detection & Dual Tenure Display

## 1. Root Cause Analysis (Confirming Your Assumption on `N3V1T5`)

Your assumption is **100% accurate**:
1. **Single-Timer Collapse (`daysInBuild` = `daysSinceLastReset`)**:
   - Currently, `resolveCitizenBuildTenure()` in `/src/services/ministryService.ts` conflates **how long a citizen has been in their current build archetype (`Eco`, `War`, `Hybrid`)** with **how many days ago they last pressed the skill reset button (`dates.lastSkillsResetAt` or local SP change)**.
   - Similarly, `detectCitizenRespecAlerts()` overwrites `buildStartedAt` whenever *any* skill level decreases or `lastSkillsResetAt` advances—even when `prior.playstyle === profile.playstyle` (e.g., `pure-eco` → `pure-eco`).
2. **Why `N3V1T5` Displayed `🌾 Eco Build · Active for 0d`**:
   - `N3V1T5` (`ID: 6997269c5215be8ca6e9d9be`) has been an established Eco player for a long time (8,878 verified ledger transactions, active industrial/economic footprint, and **0 weekly combat damage**).
   - They performed a skill reset today (`0d` ago) to **redistribute points within Eco (`Eco ↻ Eco`)**.
   - Because `lastSkillsResetAt` updated to today, `resolveCitizenBuildTenure()` set `daysInBuild = 0` and rendered **`🌾 Eco Build · Active for 0d`**, making it look like a brand-new switch into Eco today rather than an in-place Eco point redistribution.

---

## 2. Comparative Architectural Proposals

### Proposal A: Local-Only Dual Timers (`buildStartedAt` vs. `lastSkillsResetAt`)
- **Mechanism**: Separate `buildStartedAt` (only updated when `prior.playstyle !== current.playstyle` in local storage) from `lastSkillsResetAt` (updated on any skill reset).
- **Pros**:
  - Simple state model for transitions observed while the app is open.
- **Cons**:
  - **Fails for resets that happened before local tracking started**: If a citizen reset `Eco ↻ Eco` 1 day ago on the War Era server and the user syncs the country today, local storage has no prior playstyle record before that reset, so it cannot tell if the API `lastSkillsResetAt` (`1d ago`) was `War → Eco` or `Eco ↻ Eco`.

### Proposal B: Heuristic-Only Classification on API Reset Timestamps
- **Mechanism**: Ignore local playstyle history and infer whether a recent API `lastSkillsResetAt` (`≤ 7d`) was a same-build reset purely from current `weeklyCombatDamage` and `worksCount`.
- **Pros**:
  - Works on cold start without local storage history.
- **Cons**:
  - Ignores deterministic local transition history (`CitizenPlaystyleRecord` and `RespecAlert` logs) when available, and cannot track the exact multi-week archetype tenure duration once 7 days have passed.

### Proposal C (Recommended): Hybrid Dual-Timer & Footprint Verification Engine (`Local History + Combat/Economic Footprint`)
- **Mechanism**:
  1. **Dual Timers**: Track two distinct metrics on every citizen:
     - **Build Archetype Tenure (`daysInBuild` / `continuedBuild`)**: How long the citizen has been in their current `Eco`, `War`, or `Hybrid` archetype (preserved across same-build point redistributions).
     - **Last Skill Reset Timer (`daysSinceSkillReset` & `recentResetType`)**: How many days ago the citizen last reset/redistributed skill points, explicitly classified as either:
       - `same-build-reset` (**Continued Eco (`Eco ↻ Eco`)** / **Continued War (`War ↻ War`)** / **Continued Hybrid**)
       - `build-switch` (**Switched from War (`War → Eco`)** / **Switched from Eco (`Eco → War`)**)
  2. **Multi-Signal Verification (Local History + Combat & Eco Footprint)**:
     - **Signal 1 (Tracked Local History & Alerts)**: If `priorPlaystyleRecord` or `RespecAlert` history shows the citizen was already in the same `playstyle` prior to the reset, preserve their original `buildStartedAt` tenure and mark the reset as `same-build-reset` (`Continued Eco` / `Continued War`).
     - **Signal 2 (Pre-Tracking Footprint Verification)**: When a recent API reset (`lastSkillsResetAt` within `0d–14d`) occurred before local tracking captured a prior state:
       - **Continued Eco (`Eco ↻ Eco`)**: Verified when the citizen is in `pure-eco`, has **0 weekly combat damage** (`weeklyCombatDamage === 0`), no `pure-war` respec alert, and established economic continuity (e.g., owned companies `companiesCount > 0` or `companiesWealthBtc > 0`, work shifts `worksCount >= 10`, or pre-reset wage/production receipts).
       - **Continued War (`War ↻ War`)**: Verified when the citizen is in `pure-war`, has no prior `pure-eco` record/alert, and has established combat history (`weeklyCombatDamage > 0` or `lifetimeCombatDamage > 0` with low/zero industrial company footprint).
  3. **Clear Dual Display in Audit Modal & Overview Table**:
     - When a citizen has a recent same-build reset (e.g., `N3V1T5`), display both the **continued build tenure** and the **recent reset timer**:
       - Audit Modal Header: **`🌾 Eco Build · Continued Eco (Long-term / Active Xd) · 🔄 Reset 0d ago (Eco ↻ Eco)`** (and in Spanish: **`🌾 Build Eco · Eco Continuo · 🔄 Reset hace 0d (Eco ↻ Eco)`**).
       - Overview Table (**Build & Commitment** column): Compact dual badge showing **`🌾 Eco Cont. · 🔄 Reset 0d`** (or **`Active Xd · 🔄 Reset 0d (Eco ↻ Eco)`**) with a full breakdown tooltip.
- **Pros**:
  - Accurately handles `N3V1T5` and all similar citizens immediately—even if their skill reset happened before local tracking began.
  - Preserves true build tenure across point redistributions while still giving the Ministry of Economy full visibility into recent skill resets and 7-day cooldown status.
  - Prevents false `War → Eco` assumptions on long-time Eco players and vice versa for War players.
- **Cons**:
  - Slightly richer data model (`daysSinceSkillReset`, `recentResetType`, `previousPlaystyleBeforeReset`), which is cleanly encapsulated in `resolveCitizenBuildTenure()`.

**Expert Recommendation**: **Proposal C** directly fulfills both of your requirements: it verifies whether a reset was a same-build redistribution using both local history and combat/economic footprints, and surfaces both the build tenure and the last reset timer clearly in the UI.

---

## 3. Edge Case Mitigation

1. **Pre-Tracking Same-Build Reset (`lastSkillsResetAt = 0d`, No Prior Local Record)**:
   - *Case*: Like `N3V1T5`, the API reports a reset `0d` ago, and local storage doesn't have an older `buildStartedAt` before today.
   - *Mitigation*: Footprint verification sees `playstyle === 'pure-eco'`, `weeklyCombatDamage === 0`, and established Eco footprint (`worksCount`, companies, or receipts). Instead of reporting `Active for 0d`, it classifies the reset as `same-build-reset` (`Eco ↻ Eco`), marks build tenure as **Continued Eco** (using earliest verified Eco snapshot/receipt floor or `Continued Eco` label), and displays `🔄 Reset 0d ago (Eco ↻ Eco)`.
2. **True `War → Eco` Switch Within 7 Days**:
   - *Case*: A citizen fought in War this week (`weeklyCombatDamage > 0` or `previousPlaystyle === 'pure-war'`) and reset into `pure-eco` `0d–7d` ago.
   - *Mitigation*: Classified as `build-switch` (`War → Eco`), displaying `🌾 Eco Build · Active for 0d (Switched from War · Reset 0d ago)` and preserving their `⚔️🔄 War Vet in Eco` context if their career damage qualifies.
3. **Peacetime `War ↻ War` Redistribution**:
   - *Case*: A long-time `pure-war` soldier redistributes combat points (e.g., shifting points into Precision/Crit) during a ceasefire when `weeklyCombatDamage` is 0, but has high `lifetimeCombatDamage` and `0` eco skills/companies.
   - *Mitigation*: Footprint check recognizes high career combat damage + pure-war allocation + absence of prior Eco record as `same-build-reset` (`War ↻ War`), displaying `⚔️ War Build · Continued War · 🔄 Reset Xd ago (War ↻ War)`.
4. **Eco Citizen With Old Career Damage Who Has Been Eco for Weeks**:
   - *Case*: A citizen has old `lifetimeCombatDamage` from months ago, has `0` weekly combat damage, and redistributes `Eco ↻ Eco` today.
   - *Mitigation*: `switchedFromWarRecently` only triggers on recent War activity (`weeklyCombatDamage > 0` or verified transition from `pure-war`), never on ancient career damage alone, so their reset is accurately classified as `Eco ↻ Eco`.

---

## 4. Phased Task Decomposition

### Phase 1: Data Model & Multi-Signal Build/Reset Tenure Engine
- **Phase 1.1 (`/src/types/ministry.ts`)**:
  - Extend `CitizenEconomicProfile` and `CitizenPlaystyleRecord` with:
    - `daysSinceSkillReset?: number` (days since most recent skill point reset/redistribution)
    - `recentResetType?: 'same-build-reset' | 'build-switch' | 'none'`
    - `previousPlaystyleBeforeReset?: PlaystyleMode`
    - `verifiedEcoContinuityDays?: number` (optional lower-bound tenure floor from snapshots/ledger when `buildStartedAt` predates local tracking)
- **Phase 1.2 (`/src/services/ministryService.ts`)**:
  - Update `detectCitizenRespecAlerts()` so that when `prior.playstyle === profile.playstyle` and a skill reset occurs, `buildStartedAt` (the start of the current archetype) is **preserved** rather than overwritten with `now`, while `lastSkillsResetAt` records the point redistribution timestamp and `previousPlaystyle` records the same-mode continuation.
  - Upgrade `resolveCitizenBuildTenure()` to accept footprint context (`worksCount`, `companiesCount`, `companiesWealthBtc`, `lifetimeCombatDamage`, `earliestSnapshotDays`) and return:
    - `daysInBuild` (archetype duration, never falsely zeroed out by a same-build reset)
    - `daysSinceSkillReset` (days since the latest skill reset/re-allocation)
    - `recentResetType` (`'same-build-reset'` for `Eco ↻ Eco` / `War ↻ War` / `Hybrid ↻ Hybrid`, or `'build-switch'` for `War → Eco` / `Eco → War`)
    - `previousPlaystyleBeforeReset`
    - `switchedFromWarRecently` (strictly false when `recentResetType === 'same-build-reset'`)
- **Phase 1.3 (`/src/App.tsx` & `/src/services/auditStreamService.ts`)**:
  - Wire the new fields (`daysSinceSkillReset`, `recentResetType`, `previousPlaystyleBeforeReset`) through `App.tsx` profile resolution, `buildAuditedCitizenProfile`, and `auditStreamService.ts`.

### Phase 2: Dual Tenure & Reset UI in Audit Modal and Overview Table
- **Phase 2.1 (`/src/components/ministry/CitizenAuditModal.tsx`)**:
  - Update the Citizen Subtitle & Respec Tenure badge in the Audit Modal header to display both build tenure and the last reset timer:
    - For a same-build reset (`recentResetType === 'same-build-reset'`):
      - e.g., **`🌾 Eco Build · Continued Eco (Active Xd+) · 🔄 Reset 0d ago (Eco ↻ Eco)`** (or if pre-tracking tenure duration is unverified: **`🌾 Eco Build · Continued Eco · 🔄 Reset 0d ago (Eco ↻ Eco)`**).
    - For a cross-build switch (`recentResetType === 'build-switch'`):
      - e.g., **`🌾 Eco Build · Active for 0d · 🔄 Switched from War 0d ago (War → Eco)`**.
    - Update the `Explain Tags` panel and Military/Build tooltips in `CitizenAuditModal` so they also explain the distinction between build tenure and same-build point redistribution.
- **Phase 2.2 (`/src/components/ministry/CitizenRadar.tsx`)**:
  - Update the **Build & Commitment** column in the Overview table to show both build tenure and the reset timer badge (`🌾 Continued Eco · 🔄 Reset 0d (Eco ↻ Eco)` or `Active Xd · 🔄 Reset 0d`), and ensure the fields are preserved in `displayedProfiles` and `bufferedUpdatesMap`.

### Phase 3: Build & TypeScript Verification
- **Phase 3.1**: Run `compile_applet` to verify zero TypeScript or bundle errors.
