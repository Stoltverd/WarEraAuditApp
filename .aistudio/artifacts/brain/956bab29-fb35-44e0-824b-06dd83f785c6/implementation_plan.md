# Implementation Plan

## Overview

We are upgrading the **War Era Sovereign Ministry of Economy** workspace across three focused objectives:

1. **Unified Single-Tier Citizen Radar Filter Bar**: Restructure the filter and control bar in `CitizenRadar.tsx` so that the search input, `7D Audit Active` pill, `>7d Inactive` toggle button, and the three classification `<select>` dropdowns share an identical height (`h-9` / `36px`), unified border/focus styling, and clean responsive grid/flex alignment—replacing the raw native browser checkbox with a custom segmented toggle pill.
2. **Scroll-Free Audit Experience (Radar Table & Forensic Audit Modal)**:
   - **Citizen Radar Table**: Remove the forced `min-w-[960px]` horizontal scroll trigger and compact the 7 columns (`Citizen`, `Net Worth`, `7D Inflow & Net Flow`, `7D Donated`, `Fiscal Standing`, `Build & Grade`, `Actions`) using tight horizontal padding, tabular monospace numerals, and responsive wrapping so the table fits standard desktop viewports without a horizontal scrollbar.
   - **Citizen Forensic Audit Modal**: Fix the dual/nested scrollbar on the modal navigation tab strip (`overflow-x-auto` causing a tiny vertical scrollbar next to `Military & Battlefield Defense`) and streamline the modal header and card vertical density so audit panels fit cleanly without cramped double scrollbars.
3. **Dedicated "Economic War-Readiness Evaluation" Top-Level Ministry Tab**:
   - Add a dedicated top-level tab in `MinistryWorkspace.tsx` (`⚔️ War-Readiness Evaluation`) alongside Citizen Radar, Workforce & Bot Advisor, National Treasury, Sovereign Stockpiles, and Market & Trade.
   - **Participant & Coalition Builder (Step A)**: Automatically pre-select the currently audited country (`countryId`) as the **Allied Primary State**. Allow the user to select an **Opponent Primary State**, plus any number of **Allied Supporting States** and **Opponent Supporting States** from the global `WareraCountry[]` roster (with search and duplicate-selection prevention across sides).
   - **Live Multi-State Census & Company Scanner (Steps B, C, D)**: For each participating state, fetch and evaluate active citizens (`fetchCountryCitizens` + `batchResolveUsers`) and inspect company automation rosters (`fetchUserCompanies`) with progressive status feedback and local caching:
     - **Active Population**: Total verified active citizens in the state.
     - **War-Ready Citizens (Step B)**: Active citizens filtered to **Level 25+** (`isActive && level >= 25`).
     - **Average War Participants (Step C)**: Estimated battlefield turnout calculated as **Active Population ÷ 2** (`activePopulation / 2`).
     - **Tier-5 Industrial Citizens (Step D)**: Active citizens who own **12 companies, all upgraded to Automation Engine Level 5+** (`companies.length >= 12` and at least 12 companies with `activeUpgradeLevels.automatedEngine >= 5`).
   - **Per-State Formula Transparency & Head-to-Head Coalition Totals (Step F)**: Display a **Coalition Comparison Banner** (Allied Bloc vs. Opponent Bloc totals and ratios) at the top, followed by individual **State War-Readiness Cards** showing every metric separately alongside an explicit formula breakdown badge explaining how each number was derived.

---

## User Choices & Decisions

- **Module Placement**: Dedicated top-level tab in `MinistryWorkspace.tsx` (`Economic War-Readiness Evaluation`) for full-width coalition building and side-by-side state cards.
- **Terminology for 12x Auto-5 Citizens**: **Tier-5 Industrial Citizens** (representing active citizens with 12 companies all at Automation Level 5+).
- **Aggregation Scope**: Display both **Head-to-Head Coalition Totals** (Allied Bloc vs. Opponent Bloc) and **Per-State Breakdown Cards** with individual formula explanations.
- **Audit Scroll Fixes**: Fix both the **Citizen Audit Modal** (eliminating the tab-strip scrollbar and compacting modal vertical layout) and the **Citizen Radar Table** (eliminating horizontal scroll on desktop viewports).

---

## Architecture & Design

### Comparative Architecture Proposals

#### Proposal 1: On-Demand Multi-State Scanner with Two-Stage Hydration & IndexedDB Caching (Recommended)
- **Architecture**: Create a dedicated `WarReadinessEvaluation.tsx` component and a `warReadinessService.ts` engine. Stage 1 immediately computes **Active Population**, **War-Ready Citizens (Lvl 25+)**, and **Average War Participants (`Active / 2`)** via bulk `fetchCountryCitizens` + cached `usersMap` in ~1 second per country. Stage 2 filters candidates who can hold 12 companies (citizens with `skills.companies.value >= 12` or `stats.companiesCount >= 12` or `stats.wealth.companies > 0`, falling back to active Lvl 25+ citizens if skill metadata is unhydrated) and queries `fetchUserCompanies(userId)` via the rate-limited queue to verify **Tier-5 Industrial Citizens** (`12 companies @ automatedEngine >= 5`), caching results in `localStorage`/`IndexedDB` so subsequent comparisons are instantaneous.
- **Pros**:
  - Instant feedback for Steps B & C while Step D (company automation verification) streams live progress (`Scanning 12-company industrial rosters: 14/38 candidates...`).
  - Avoids unnecessary `company.getCompanies` API calls for low-level citizens who do not own 12 companies, cutting API traffic by 70%–85%.
  - Persists evaluated state snapshots so switching tabs or adding a new supporter country does not re-scan already-verified states.
- **Cons**:
  - Requires a lightweight candidate pre-filter and progressive state reducer per country.
- **Expert Reasoning**: Because War Era's tRPC API requires per-user `company.getCompanies` + `company.getById` calls to verify individual factory `automatedEngine` levels, scanning every citizen blindly across 6+ coalition countries could trigger hundreds of requests. Pre-filtering to active citizens capable of holding 12 companies and streaming via the existing rate-limited queue delivers 100% live accuracy without API rate-limit stalls.

#### Proposal 2: Eager Full-Roster Sequential Scan Without Candidate Pre-Filtering
- **Architecture**: Whenever a country is added to either coalition, sequentially call `fetchUserCompanies` for every single citizen in that country regardless of level or company count skill.
- **Pros**: Simple loop implementation.
- **Cons**: For a coalition of 4–6 countries with 100+ citizens each, querying `company.getCompanies` + 12x `company.getById` for every citizen can exceed 3,000 HTTP requests, causing slow evaluation times (60–120s).

#### Proposal 3: Heuristic Estimation from Country Wealth Rankings Only
- **Architecture**: Estimate Tier-5 Industrial Citizens purely from `stats.wealth.companies` thresholds without inspecting actual company upgrade levels.
- **Pros**: Zero `company.getById` network calls.
- **Cons**: Violates strict data honesty—cannot distinguish between a citizen with 12 Level-5 automated companies and a citizen with 8 high-storage manual companies.

> **Recommendation**: **Proposal 1** is strongly recommended because it guarantees 100% authentic verification of `12 companies @ Automation Level 5` while keeping evaluation fast, responsive, and rate-limit safe.

---

### Edge Case Mitigation Strategy

1. **Duplicate State Selection Across Coalitions**:
   - *Risk*: A user accidentally selects the same country as both an Allied Supporter and the Opponent Main State (or Opponent Supporter).
   - *Mitigation*: Automatically exclude any already-assigned country from the other coalition selector dropdowns, and provide a one-click "Swap Role / Remove" action on each state chip.
2. **Primary Audited State Switching**:
   - *Risk*: The user switches the active country in the top Header while viewing the War-Readiness tab.
   - *Mitigation*: Automatically sync the Allied Primary State to the newly selected header country (unless the user has locked a custom scenario) and immediately reuse the already-loaded `profiles` in memory for zero-latency evaluation of the home state.
3. **API Rate Limits & Partial Company Scan Cancellation**:
   - *Risk*: Scanning a large coalition (e.g., 8 countries) takes several seconds and the user removes a country mid-scan or navigates away.
   - *Mitigation*: Track per-country `AbortController` / scan tokens and store per-country evaluation state (`idle | scanning-census | scanning-companies | completed | error`) with a `Refresh State` and `Pause/Cancel Scan` control.
4. **Citizens with >12 Companies vs. Exactly 12 Companies**:
   - *Risk*: Some high-level citizens or historical accounts may have 12+ registered companies in the API where 12 active companies are at Automation Level 5+ (`automatedEngine >= 5`, up to Level 7 in v0.27).
   - *Mitigation*: Count a citizen as a **Tier-5 Industrial Citizen** if they are active and own at least 12 companies whose `activeUpgradeLevels.automatedEngine >= 5` (supporting both exact Level 5 and higher engine upgrades 5–7).
5. **Empty Supporter Lists or Single-State Preview**:
   - *Risk*: The user hasn't picked an Opponent Primary State or any Supporters yet.
   - *Mitigation*: Immediately render the Allied Primary State's full evaluation card and coalition totals on load, while showing a clean interactive selector prompt for the Opponent Primary State and optional Allied/Opponent Supporters.

---

## Implementation Phases

### Phase 1: Citizen Radar Filter Bar Alignment & Citizen Audit Scroll Elimination
- **Phase 1.1 (Citizen Radar Filter Bar Redesign)**:
  - Refactor the filter control bar in `/src/components/ministry/CitizenRadar.tsx` into a structured, single-elevation toolbar where all controls share `h-9` (`36px`) height, consistent `px-3` spacing, and clean flex/grid wrapping.
  - Replace the raw `<input type="checkbox">` inside the `>7d Inactive` pill with a custom interactive toggle button featuring a crisp status indicator dot/check icon, matching the `7D Audit Active` pill height and typography.
- **Phase 1.2 (Citizen Radar Table No-Scroll Layout)**:
  - Remove `min-w-[960px]` on the table in `/src/components/ministry/CitizenRadar.tsx` and optimize column widths, cell padding (`px-2.5 py-2.5`), and compact badge labels so all 7 columns fit comfortably inside the standard container width without horizontal scrolling.
- **Phase 1.3 (Citizen Audit Modal Tab & Viewport Scroll Cleanup)**:
  - In `/src/components/ministry/CitizenAuditModal.tsx`, fix the navigation tab bar (`overflow-y-hidden overflow-x-auto no-scrollbar`) so it never renders a miniature vertical scrollbar on the right edge, and tighten header/card vertical padding so the modal content is spacious and easy to read.

### Phase 2: Economic War-Readiness Evaluation Engine (`warReadinessService.ts`)
- **Phase 2.1 (Data Types & State Evaluation Interfaces)**:
  - Add `StateWarReadinessReport` and `CoalitionWarReadinessSummary` interfaces to `/src/types/ministry.ts`, capturing:
    - `countryId`, `countryName`, `role` (`allied-main` | `allied-supporter` | `opponent-main` | `opponent-supporter`)
    - `activePopulation`: Verified active citizens count
    - `warReadyCitizens`: Active citizens with `level >= 25` (plus list of top war-ready citizens)
    - `averageWarParticipants`: `activePopulation / 2` (displayed with exact decimal/rounded breakdown)
    - `tier5IndustrialCitizens`: Active citizens with `>= 12` companies at `automatedEngine >= 5` (plus expandable list of qualifying citizens and their company counts)
    - `scanStatus`, `scannedCompanyCandidates`, `totalCompanyCandidates`, `lastEvaluatedAt`
- **Phase 2.2 (Two-Stage Census & Industrial Verification Service)**:
  - Create `/src/services/warReadinessService.ts` implementing `evaluateCountryWarReadiness(country, existingUsersMap, onProgress, forceRefresh)`:
    - **Stage 1**: Uses existing `profiles`/`usersMap` if the country is already loaded, or calls `fetchCountryCitizens(country._id)` + `batchResolveUsers` to hydrate all active citizens (`isActive && level >= 10`, cross-checked against `country.rankings.countryActivePopulation.value`). Filters `level >= 25` for **War-Ready Citizens** and computes `activePopulation / 2` for **Average War Participants**.
    - **Stage 2**: Identifies active citizens eligible for 12 companies and inspects their live enterprises via `fetchUserCompanies(userId)` to verify those with **12 companies at Automation Level 5+** (`automatedEngine >= 5`). Caches the verified report per country.

### Phase 3: Economic War-Readiness Evaluation UI & Ministry Workspace Integration
- **Phase 3.1 (Coalition Builder & Head-to-Head Comparison UI)**:
  - Create `/src/components/ministry/WarReadinessEvaluation.tsx` featuring:
    - **Participant & Supporter Selector Matrix**: Automatically sets the currently audited country as **Allied Primary State**. Provides searchable country selectors for **Opponent Primary State**, **Allied Supporters (Multi-Select)**, and **Opponent Supporters (Multi-Select)**.
    - **Coalition Force Balance Banner**: Side-by-side comparison of Allied Coalition vs. Opponent Coalition totals across all 4 core metrics (**Total Active Population**, **Total War-Ready Lvl 25+**, **Combined Avg War Participants**, and **Total Tier-5 Industrial Citizens**), with proportional visual bars.
    - **Per-State Breakdown Cards & Formula Explanations**: Dedicated cards for each participating country showing all 4 metrics separately, explicit formula callouts (`Active Citizens filtered by Level ≥ 25`, `Active Population ÷ 2`, `Active Citizens with 12 Companies @ Automation Engine Lvl 5+`), and an expandable roster drawer to inspect the exact citizens who qualified as War-Ready or Tier-5 Industrial Citizens.
- **Phase 3.2 (Top-Level Ministry Tab Wiring)**:
  - Register the new `war-readiness` tab (`⚔️ War-Readiness`) in `/src/components/ministry/MinistryWorkspace.tsx` and pass `countryId`, `countryName`, `countries`, `profiles`, and `usersMap` so the home country is pre-populated and evaluated immediately upon opening.

### Phase 4: Verification & Build Audit
- **Phase 4.1**: Run `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`) to verify zero TypeScript or bundle errors.

---

## Key Technical Details

- **Active Citizen Definition**: Consistent with the rest of the app, active citizens are resolved from `user.getUsersByCountry` + `user.getUserById` where `Boolean(user.isActive !== false)` and `level >= 10`. Both the verified roster count and any official `rankings.countryActivePopulation.value` census delta are displayed transparently in the formula explanation.
- **War-Ready Citizen Filter (Step B)**: `activeCitizens.filter(u => Number(u.leveling?.level ?? u.level ?? 0) >= 25)`.
- **Average War Participants Formula (Step C)**: `activeCitizens.length / 2` (displayed as exact value e.g. `47.5` / `~48 citizens per battle`, alongside official census `/ 2` if applicable).
- **Tier-5 Industrial Citizens Filter (Step D)**: Active citizens where `companies.filter(c => Number(c.activeUpgradeLevels?.automatedEngine ?? 1) >= 5).length >= 12`.
