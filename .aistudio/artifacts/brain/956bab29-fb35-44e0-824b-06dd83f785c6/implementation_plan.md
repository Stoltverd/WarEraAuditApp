# Implementation Plan: Complete Spanish Localization, Multi-Check Universal Build Timer & Respec Engine, and Hotfix 0.27.3 Economy Meta

## 1. Executive Summary & Architectural Overview

This revised plan addresses the four issues identified in your screenshots and incorporates all of your review feedback:

1. **Complete Spanish Localization (`LeaderboardTable`, `CitizenRadar`, `CitizenAuditModal`)**:
   - **Active Window Badge (`Ventana Activa:`)**: Localize the dynamic `timeframe` prop (`"in the last 24 hours"`, `"in the last 7 days"`, `"in the last month"`, `"during this custom period"`, etc.) inside `LeaderboardTable.tsx` so Spanish mode renders `"Ventana Activa: en los últimos 30 días"` instead of `"Ventana Activa: in the last month"`.
   - **Dynamic Fiscal Classification & Badge Explanations**: Replace hardcoded English reason strings (`Dual-Index Alert (Idle Liquid Hoarder)...`, `Proven Above-Median Veteran Donor...`, `Verified Career War Veteran...`, `Verified Industrial Sacrifice...`, `Hoarding (X BTC)`) with structured bilingual formatters in `I18nContext.tsx` so both the clickable `?` Popover in `CitizenRadar.tsx` and the 4-card Tag & Standing Guide in `CitizenAuditModal.tsx` are 100% localized in Spanish and English.

2. **Universal Multi-Check Build Timer, Non-Deletable `RespecAlert` History, & `war-vet-in-eco` Calibration (For ALL Citizens)**:
   - **Root Cause Audit of `RespecAlert` & Build Timer**:
     - Previously, `batchResolveUsers` in `apiService.ts` skipped re-fetching citizen profiles from the API if `cached.skills` already existed in IndexedDB—meaning citizen skill trees and `dates.lastSkillsResetAt` were frozen after their first-ever fetch!
     - Second, `detectCitizenRespecAlerts` in `ministryService.ts` only checked whether the top-level `playstyle` enum (`pure-eco` | `pure-war` | `hybrid`) flipped, and was only called when a user manually clicked `Run Income Audit`.
     - Third, `calculateDaysInBuild` fell back to `user.createdAt` (account creation date) whenever `user.dates?.lastSkillsResetAt` was absent, falsely displaying `256d` (account age) in Eco mode for citizens who used a free respec or transitioned recently.
   - **Universal 4-Signal Respec & Build-Switch Engine (Applied to Every Citizen)**:
     - **Check 1 — Fresh API Skill & Date Hydration**: Update `batchResolveUsers` (`apiService.ts`) with a skill-refresh TTL so country syncs and background audits always pull fresh `skills` and `dates.lastSkillsResetAt` from `user.getUserById` rather than serving stale IndexedDB skills.
     - **Check 2 — API `lastSkillsResetAt` Timestamp**: Use `user.dates?.lastSkillsResetAt` whenever reported by the API and newer than locally recorded transitions.
     - **Check 3 — Granular Skill-Level Decrease & SP-Shift Fingerprint**: Store a per-citizen skill snapshot (`skillSignature` of individual skill levels, `warPoints`, `ecoPoints`, `playstyle`, `buildStartedAt`, `lastSkillsResetAt`) in `storage.ts`. Because individual skill levels in War Era can **never decrease** without a respec (paid or free), any decrease in any individual skill level, any opposing shift in `warPoints` vs. `ecoPoints`, or any `playstyle` transition deterministically proves a respec occurred—even when the API omits `lastSkillsResetAt` for free respecs!
     - **Check 4 — Combat Activity vs. Eco Build Heuristic & `war-vet-in-eco` Shield**: For any citizen currently in an Eco build (`pure-eco` or Eco-heavy `hybrid`) whose exact respec timestamp predates local tracking, cross-check their recent 7-day combat damage (`weeklyUserDamages > 0` implies they fought in War build within the last `≤ 7d`) and country-relative career combat damage (`careerDmg >= careerDamageP75 || careerDmg >= careerDamageMedian * 2.5`). Never fall back to `user.createdAt` for `daysInBuild` (`null` = unverified duration).
   - **Automatic Background Tracking & Non-Deletable Alert History**:
     - Run the multi-check respec detector automatically inside `executeSync`, `onChunkUsers`, `handleResolveUsers`, and the 4-worker `auditStreamService` background receipt stream so every citizen is tracked continuously without requiring manual audits.
     - Remove all delete/clear controls for `RespecAlert` and build-transition records (`storage.ts`, `MinistryWorkspace.tsx`, `App.tsx`) so fallback build-timer history can never be erased.

3. **War Era Hotfix 0.27.3 — `Leadership` Fused into `Management` & Exact Level 50 Cap + Prestige Math**:
   - **Exact Level 50 Cap & Prestige Mechanics**:
     - The maximum player level in War Era is **Level 50** (granting `50 × 4 = 200` base Skill Points). There are no "Level 50+" or "Level 55" levels. After reaching Level 50, players **Prestige**, earning **+1 extra respec-able Skill Point of their choosing per prestige** that ignores normal skill caps.
     - Maxing a 10-level skill tree costs `1 + 2 + ... + 10 = 55 SP`.
     - **Why Hotfix 0.27.3 Changed the Level 26–50 Economy Meta**: Prior to Hotfix 0.27.3, maxing all 4 workforce/company Eco skills (`Companies` 55 SP + `Leadership` 55 SP + `Management` 55 SP + `Energy` 55 SP) cost **220 SP**—which was **mathematically impossible at the Level 50 cap (200 base SP)**! High-level Eco players had zero SP left for `Production`.
     - In **Hotfix 0.27.3**, `Leadership` was removed and fused into `Management` (which now grants both up to +22% employee production output AND improved employee training card draws / event odds). Maxing `Companies` (55 SP) + `Management` (55 SP) + `Energy` (55 SP) now costs at most **165 SP**, freeing **35+ base SP at Level 50 (plus any Prestige SP)**—enough to invest heavily into **Level 7–8+ `Production` (28–36 SP)** alongside a maxed workforce!
   - **Updated Grading & Guide**:
     - Remove all references to `Leadership` across data models, skill calculators, and guides, and remove the outdated BuhDeuce screenshot (`/assets/aistudio/WhatsApp_Image_2026-10-26_at_5.47.26_PM_b22c7181.jpeg`) from `WorkforceAdvisor.tsx`.
     - Update `workforceService.ts` and `ministryService.ts` so Level 26–50 (and Prestige) Eco players are never penalized for having high `Production` alongside `Companies`, `Management`, and `Energy`, while still flagging `Production`-only builds that neglect `Companies` and `Management` when running an employee workforce.

---

## 2. Comparative Solutions Analysis

### Problem A: Multi-Check Respec Detection & Build Duration (`daysInBuild`) for All Citizens When Free Respecs Do Not Report `lastSkillsResetAt`

* **Proposal A1: Rely Only on API `lastSkillsResetAt` and Show "Unknown" Otherwise**
  * *Pros*: Minimal code changes.
  * *Cons*: Ignores local skill-snapshot comparisons, fails to detect free respecs, and leaves cached citizens with stale `skills` in IndexedDB.
* **Proposal A2: Multi-Check Respec Engine (Fresh API Skill Hydration + API `lastSkillsResetAt` + Granular Skill-Level Decrease / SP-Shift Fingerprinting + 7D/Career Combat Heuristic) with Non-Deletable History (Recommended)**
  * *Pros*:
    1. Refreshes citizen `skills` and `dates` from the API during syncs (`batchResolveUsers` TTL) so cached citizens are never stuck on old skill trees.
    2. Combines 4 independent checks: (a) API `user.dates?.lastSkillsResetAt`, (b) any decrease in an individual skill level (impossible without a respec) or shift in `warPoints` vs. `ecoPoints` / `playstyle`, (c) permanent `RespecAlert` history, and (d) active 7-day combat damage (`weeklyUserDamages > 0`) when currently in an Eco build (`≤ 7d` bound).
    3. Runs automatically for **every citizen** during country syncs, progressive chunk hydration, and background 4-worker audits, and locks `RespecAlert` history against deletion.
    4. Evaluates `war-vet-in-eco` dynamically for all citizens in Eco builds who have top-quartile (`>= P75`) or `>= 2.5x` country median career combat damage without requiring `daysInBuild <= 21` when the exact timestamp is unverified.
  * *Cons*: Requires expanding the persisted citizen skill snapshot schema in `storage.ts` and adding a TTL timestamp to cached user skills in `apiService.ts`.
* **Proposal A3: Estimate Build Duration Purely from Ratio of Career Damage to Current Level**
  * *Pros*: Stateless.
  * *Cons*: Cannot produce an accurate day count or detect respecs within the same broad playstyle.
* **Expert Recommendation**: **Proposal A2**. Because free respecs in War Era may omit `lastSkillsResetAt`, combining fresh API skill hydration with individual skill-level decrease detection (since skill levels cannot go down without a reset) and 7-day combat activity guarantees reliable respec detection for every citizen across the country.

---

### Problem B: Updating Economy Skill Meta & Grading for Hotfix 0.27.3 (`Leadership` Fused into `Management`, Level 50 Cap + Prestige)

* **Proposal B1: Simply Delete the Word `Leadership` from UI Text**
  * *Pros*: Fast string edit.
  * *Cons*: Leaves the outdated BuhDeuce screenshot visible and keeps the pre-0.27.3 assumption that Level 26–50 Eco builds cannot afford `Production`.
* **Proposal B2: Full 0.27.3 Economy Engine & Level 50 + Prestige Calibration (`Companies` + `Management` + `Energy` + Secondary `Production`) (Recommended)**
  * *Pros*:
    1. Accurately models the **Level 50 max level cap (200 base SP) + Prestige (+1 respec-able SP per prestige ignoring skill caps)**.
    2. Reflects the exact 0.27.3 SP math: fusing `Leadership` into `Management` reduced the 3 core workforce skills (`Companies` + `Management` + `Energy`) from an impossible 220 SP (4 trees) down to **165 SP max (3 trees)**, leaving **35+ base SP at Level 50 (plus Prestige points)** for high `Production` (Level 7–8+).
    3. Updates `analyzeWorkforceEcoSkills` (`workforceService.ts`) to evaluate Level 26–50 Eco players on **Core Workforce Allocation (`Companies` + `Management` + `Energy`)** while treating high `Production` as a positive hybrid self-work multiplier rather than an error, and removes the outdated guide screenshot.
  * *Cons*: Requires updating `workforceService.ts`, `ministryService.ts`, `WorkforceAdvisor.tsx`, `CompanyPortfolioAnalyzer.tsx`, and `I18nContext.tsx`.
* **Proposal B3: Remove All Skill-Based Recommendations**
  * *Pros*: Zero maintenance after game patches.
  * *Cons*: Removes core analytical value from the Workforce Advisor and Portfolio Analyzer.
* **Expert Recommendation**: **Proposal B2**. It aligns the entire application with Hotfix 0.27.3 and the true Level 50 + Prestige skill point economy.

---

### Problem C: Localizing Dynamic Metric-Interpolated Fiscal Explanations & Active Window Labels

* **Proposal C1: Regex String Replacement in JSX**
  * *Pros*: Doesn't touch service layer.
  * *Cons*: Brittle with formatted numbers and currency symbols.
* **Proposal C2: Dedicated Bilingual Explanation Builders & Timeframe Translator Helper in `I18nContext.tsx` (Recommended)**
  * *Pros*: Cleanly formats all classification reason codes (`war-vet-in-eco`, `veteran-donor`, `company-sacrifice`, `dormant-pillar`, `dual-index-leech`, `standard`, etc.) and `timeframe` labels (`24h`, `7d`, `30d`, `custom`) in the active language (`en` / `es`).
  * *Cons*: Requires passing `language` or calling the helper in `CitizenRadar.tsx`, `CitizenAuditModal.tsx`, and `LeaderboardTable.tsx`.
* **Expert Recommendation**: **Proposal C2**.

---

## 3. Edge Case Mitigation Matrix

| Edge Case | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Cached Citizens in IndexedDB Never Refreshing Skills (`apiService.ts`)** | `batchResolveUsers` previously skipped `fetchUserLite` if `cached.skills` existed, so respecs were never fetched from the API after the first visit. | Track `skillsUpdatedAt` on cached `User` records in IndexedDB and refresh `user.getUserById` during syncs/audits whenever `skillsUpdatedAt` is older than 15 minutes (or missing). |
| **Free Respec Used (API `lastSkillsResetAt` Missing or Stale)** | Relying solely on `lastSkillsResetAt` misses free respecs; falling back to `user.createdAt` shows `200+d`. | Combine 4 checks: (1) API `lastSkillsResetAt`, (2) individual skill-level decrease or SP-shift fingerprint in `warera_citizen_playstyles`, (3) non-deletable `RespecAlert` history, and (4) 7D combat damage (`weeklyUserDamages > 0`) vs. current Eco build. Never fall back to `user.createdAt`. |
| **Same-Playstyle Respec (e.g., Eco Re-allocation or Prestige SP Re-spec)** | Citizen stays `pure-eco` while resetting skills, which previously failed `prior.playstyle !== profile.playstyle`. | Compare individual skill levels (`skillSignature`) against the previous snapshot: if any skill level decreased (impossible without a reset) or total SP shifted between branches, record a respec and update `buildStartedAt`. |
| **Level 50 + Prestige Players Exceeding 200 SP or Normal Caps** | Players at max Level 50 who have Prestiged have `> 200` total SP or extra points ignoring normal caps, and enough SP for maxed `Companies + Management + Energy` (165 SP) plus high `Production` (35+ SP). | Never cap or hardcode player level above 50; display Prestige bonus SP when total allocated SP exceeds `level * 4`, and reward high `Production` alongside `Companies + Management + Energy` in Level 26–50 workforce grading. |
| **Historical `Leadership` Field in Cached Snapshots or Live API Payload** | API or IndexedDB cache may still include `skills.leadership` (`value: 0` or legacy data). | Omit `leadership` from `sumSkillPoints` and `estimatePlaystyle` so legacy cached payloads cannot inflate SP totals or skew Eco/War ratios. |

---

## 4. Phased Task Decomposition

### Phase 1: Complete Spanish Localization (`Ventana Activa` & Dynamic Classification Explanations)
* **Phase 1.1**: In `src/i18n/I18nContext.tsx` and `src/components/LeaderboardTable.tsx`, add a `translateTimeframe(timeframe: string)` helper so the `Ventana Activa:` badge translates `"in the last month"`, `"in the last 7 days"`, `"in the last 24 hours"`, and custom date ranges into Spanish (`"en los últimos 30 días"`, `"en los últimos 7 días"`, `"en las últimas 24 horas"`, etc.).
* **Phase 1.2**: In `src/i18n/I18nContext.tsx`, add bilingual explanation formatters for every fiscal standing reason and special context (`Dual-Index Alert (Idle Liquid Hoarder)`, `Proven Above-Median Veteran Donor`, `Verified Career War Veteran`, `Verified Industrial Sacrifice`, `Dormant Historical Pillar`, `Standard Median-Based Evaluation`, and inline badge labels such as `Acumulando (X BTC)` instead of `Hoarding (X BTC)`).
* **Phase 1.3**: Connect the bilingual formatters in `src/components/ministry/CitizenRadar.tsx` (Fiscal Standing `?` Popover and inline badges) and `src/components/ministry/CitizenAuditModal.tsx` (4-card Tag & Standing Explanation Guide and header badges).

### Phase 2: Multi-Check Universal Build Timer, Non-Deletable `RespecAlert` Engine, & `war-vet-in-eco` Calibration
* **Phase 2.1**: In `src/services/apiService.ts` (`batchResolveUsers`), add a `skillsUpdatedAt` TTL check so citizen `skills` and `dates.lastSkillsResetAt` are refreshed from `user.getUserById` during country syncs rather than being permanently bypassed once cached in IndexedDB.
* **Phase 2.2**: In `src/services/storage.ts` and `src/services/ministryService.ts`:
  - Expand `CitizenPlaystyleRecord` to store `skillSignature` (map of individual skill levels), `warPoints`, `ecoPoints`, `playstyle`, `previousPlaystyle`, `buildStartedAt`, and `lastSkillsResetAt`.
  - Upgrade `detectCitizenRespecAlerts` into a multi-check detector that triggers when:
    1. `playstyle` changes (`pure-war` ↔ `pure-eco` ↔ `hybrid`), OR
    2. Any individual skill level in `skillSignature` decreases (proving a skill reset occurred even if `playstyle` stayed the same or `lastSkillsResetAt` was not updated by a free respec), OR
    3. `user.dates?.lastSkillsResetAt` advances to a newer timestamp.
  - Remove `clearRespecAlerts` / delete actions from `storage.ts`, `App.tsx`, and `MinistryWorkspace.tsx` so `RespecAlert` and build-timer history are permanent and non-deletable.
* **Phase 2.3**: In `src/App.tsx` and `src/services/auditStreamService.ts`, invoke `detectCitizenRespecAlerts` automatically for **all citizens** during `executeSync`, `onChunkUsers`, `handleResolveUsers`, and the 4-worker background receipt audit stream.
* **Phase 2.4**: In `src/services/ministryService.ts` (`calculateDaysInBuild` and `classifyCitizens`):
  - Compute `daysInBuild` from the newest verified timestamp among `user.dates?.lastSkillsResetAt`, detected skill-reset/transition `buildStartedAt`, and `RespecAlert.detectedAt`.
  - If no verified timestamp exists yet, never fall back to `user.createdAt`: if the citizen is currently in an Eco build AND has `weeklyUserDamages > 0` (active combat damage in the last 7 days), display `≤ 7d (Cambio Reciente)` / `≤ 7d (Recent Switch)`; otherwise return `null` (`Duración no verificada` / `Unverified duration`).
  - Calibrate `war-vet-in-eco` universally for all citizens currently in an Eco build (`pure-eco` or Eco-focused `hybrid`) who have top-quartile (`>= P75`) or `>= 2.5x` country median career combat damage (`>= 2,000,000` floor), or a verified recent switch from `pure-war`.

### Phase 3: War Era Hotfix 0.27.3 (`Leadership` Fused into `Management` & Level 50 Cap + Prestige Meta)
* **Phase 3.1**: In `src/services/ministryService.ts` and `src/services/workforceService.ts`:
  - Remove `leadership` from `ECO_SKILL_KEYS` (leaving the 5 active 0.27.3 Economy skills: `energy`, `companies`, `production`, `management`, `lootChance`).
  - Update `analyzeWorkforceEcoSkills` (`workforceService.ts`) for the **Level 50 cap (200 base SP) + Prestige (+1 respec-able SP per prestige)** economy: evaluate Level 26–50 workforce builds on their core allocation (`Companies` + `Management` + `Energy`, max 165 SP) while recognizing high `Production` (from the remaining 35+ base SP and Prestige SP) as a strong hybrid self-work bonus rather than a penalty.
* **Phase 3.2**: In `src/components/ministry/WorkforceAdvisor.tsx`, `src/components/ministry/CompanyPortfolioAnalyzer.tsx`, `src/components/ministry/CitizenAuditModal.tsx`, and `src/i18n/I18nContext.tsx`:
  - Remove the outdated BuhDeuce screenshot (`/assets/aistudio/WhatsApp_Image_2026-10-26_at_5.47.26_PM_b22c7181.jpeg`) that referenced `Leadership`.
  - Update all English and Spanish guides, skill labels, and tooltips to explain Hotfix 0.27.3 (`Management` now fuses employee output % + training/event card quality; max Level 50 grants 200 base SP + Prestige points, allowing Level 26–50 Eco players to max `Companies + Management + Energy` at 165 SP and invest 35+ SP + Prestige into `Production`).

### Phase 4: Build & Verification
* **Phase 4.1**: Run `lint_applet` and `compile_applet` to verify zero TypeScript or build errors.
