# Sovereign Audit & Diplomatic Engine Refinement Plan

This update fixes the unresponsive **Reset to Live API** button, declutters the **Companies & Bot Workforce** cards by moving manual controls into a clean collapsible drawer, fixes tab clipping, scales up modal width and typography for effortless reading, introduces a **3x–5x Growth & Speculation Buffer** so productive traders can compound their economy while extreme hoarders (like `N3V1T5`) are still flagged, and upgrades the Diplomatic Telegram Generator with **3 Adaptive Modes (`Treasury Nudge`, `Merit-Based Patriot Commendation`, and `Over-Donation Burnout Warning`)**—including **custom merit-based congratulations** for **Active Historical Pillars** (who keep giving via donations or combat damage), **Sovereign Treasury Patriots**, **Battlefield Frontline Heroes**, and **Dual-Crown Vanguards**.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> **Confirmed Product & UX Decisions:**
> - **Confirmed Decision 1 — Decluttered Company Cards & Drawer Controls**: Each company card in the **Companies & Bot Workforce** tab will be a clean, uncluttered summary card (Company Icon, Title, Item & Recipe line, 4 KPI tiles, and a single `"Inspect Bots & Traits"` toggle). All manual configuration controls (Breakroom level selector, Manager toggle, Reset to Live API button, and Bot Slot Trait editors) are moved inside the collapsible drawer.
> - **Confirmed Decision 2 — Healthy Speculation & Economic Growth Buffer (3x–5x Shield)**: Citizens are granted a **Growth & Speculation Buffer** (shielding up to `3.5x` the country median stockpile, or `2.5x` weekly company input/expansion needs, whichever is higher) so active traders can reinvest, upgrade factories, or buy better war gear without being penalized. Only **excess hoards above this growth buffer** (such as `N3V1T5` at `35.22x` country median) are taxed under the Resource Stockpiler archetype.
> - **Confirmed Decision 3 — Adaptive Diplomatic Modes (`Nudge`, `Merit Commendation`, `Over-Donation Warning`)**: The Diplomatic Modal automatically evaluates each citizen relative to their own solvency, combat record, lifetime standing, and country benchmarks, displaying an **Evaluation & Recommendation Banner** that pre-selects the appropriate mode while allowing the user to freely switch modes and sub-archetypes.
> - **Confirmed Decision 4 — Custom Merit-Based Commendations (Updated per Feedback)**: Congratulations are dynamically tailored to the specific merits of the citizen, with **4 selectable Commendation Archetypes** (auto-selecting the best match):
>   1. **🏛️ Active Historical Pillar (Still Giving)**: For lifetime pillars (`isHistoricalPillar` / top all-time donors) who continue contributing in the current period—whether through fresh **treasury BTC donations**, **frontline battlefield damage**, or **both**.
>   2. **🌟 Sovereign Treasury Patriot**: For citizens meeting or exceeding their playstyle's Patriot donation quota through active economic contributions.
>   3. **⚔️ Battlefield Frontline Hero**: For warriors and illiquid combatants who pour their capital into weapons/ammo and deal heavy battlefield damage for the nation.
>   4. **👑 Dual-Crown Vanguard (Treasury + Combat)**: For elite citizens who simultaneously donate BTC to the national treasury AND deal substantial combat damage on the frontlines.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Working "Reset to Live API" Action**: Fixes the storage key mismatch (`warera_company_workforce_overrides` vs. `warera_company_workforce_overrides_v1`) and property synchronization (`breakRoom` vs. `breakRoomLevel`) so clicking **Reset to Live API** immediately purges the manual override from both React state and `localStorage` and restores live API values.
  2. **Clean Company Summary Cards & Working "Inspect Bots & Traits" Drawer**: Eliminates stacked badge clutter and duplicate footer buttons on company cards. Clicking **Inspect Bots & Traits** opens a dedicated workspace drawer where users can adjust Breakroom level, toggle Manager, configure 1–3 bot slots, or reset to Live API—even when the public API returns 0 private worker traits.
  3. **Spacious, Unclipped Navigation Tabs**: Adds `shrink-0` and generous vertical padding (`py-3`) to the modal tab bar so tabs never clip vertically or spawn a miniature scrollbar.
  4. **Enhanced Readability on Text-Heavy Modals**: Expands the Diplomatic Modal container to `max-w-4xl` / `max-w-5xl` and upgrades body text from cramped `10px–11px` micro-text to comfortable `13px–15px` (`text-sm` / `text-base`) with `leading-relaxed` line height.
  5. **Growth-Aware Speculation Buffer**: Distinguishes healthy market speculation and capital compounding (`1.5x–3.5x` country median or active company expansion reserve) from extreme dead-weight hoarding (`>3.5x` country median, e.g., `N3V1T5` at `35.22x`).
  6. **Adaptive Diplomatic Feedback (`Nudge`, `Merit Commendation`, `Over-Donation Warning`)**: Evaluates each citizen's exact merits—treasury BTC donated, lifetime pillar status, battlefield damage dealt, and personal solvency—to recommend either a **Treasury Nudge**, a **Merit-Specific Commendation**, or a **Protective Over-Donation Warning**.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Company Inspection Flow**:
    1. User opens **Companies & Bot Workforce** in the Citizen Audit Modal.
    2. Each company renders as a clean single-elevation card: Company Name + Item Icon on the left, unboxed metadata (`Recipe: 10 PP + 10 Limestone = 1 Concrete · Live Price: 1.725 BTC · Breakroom Lvl 2/3`), and one **Inspect Bots & Traits** button on the right, followed by the 4-column tabular KPI row (`Daily Output`, `Bot Payroll`, `Real Daily Profit`, `Infrastructure`).
    3. Clicking **Inspect Bots & Traits** smoothly expands the interactive inspector drawer containing the Breakroom level dropdown, Manager toggle, **+ Configure Bot Slot** button, 3-slot trait selectors, and **Reset to Live API** button.
  - **Adaptive Diplomatic Modal Flow**:
    1. User clicks the diplomatic action button on any citizen row in the Citizen Radar.
    2. The widened, high-legibility modal opens with a prominent **Ministerial Evaluation & Recommended Action Banner** at the top explaining the citizen's standing, growth capacity, and combat/donation merits relative to their country.
    3. Below the banner is the **3-Mode Segmented Selector**:
       - **Mode 1: Treasury Nudge** — Sub-archetypes: `Weekly Cashflow Step-Up`, `Idle Liquid BTC Hoarder`, `Resource Stockpiler (Above 3.5x Growth Buffer)`.
       - **Mode 2: Patriot Commendation (Merit-Tailored)** — Sub-archetypes:
         - **🏛️ Active Historical Pillar (Continuing Legacy)**: Recognizes top all-time donors who *keep on giving* in the current window via fresh BTC donations, frontline combat damage, or both (citing their exact lifetime total alongside their active period BTC/damage).
         - **🌟 Sovereign Treasury Patriot**: Commends citizens whose current-period BTC donations meet or exceed their playstyle's Patriot threshold.
         - **⚔️ Battlefield Frontline Hero**: Salutes combat veterans and illiquid fighters based on their exact battlefield damage dealt (`damageDealt` / `damageValueBtc`war credit) and combat gear commitment.
         - **👑 Dual-Crown Vanguard**: Honors citizens contributing both significant treasury BTC and high frontline combat damage in the same period.
       - **Mode 3: Over-Donation Warning (Protect Citizen Growth)** — Sub-archetypes:
         - **⚠️ Economic Burnout / Under-Capitalized Donor**: Warns citizens who are donating a high share of their income (`>35%`) while their liquid cash or company infrastructure is below healthy national benchmarks, advising them to pause donations and upgrade their companies first.
         - **🛡️ Combatant Liquidity Drain Warning**: Advises frontline fighters who are over-donating liquid BTC needed for ammo, armor repairs, and combat consumables to prioritize their war chest.
    4. The recommended mode and sub-archetype are pre-selected automatically, and the user can click any mode, sub-archetype, or tone (`Warm / Diplomatic`, `Audit / Analytical`, `Firm / Urgent`) to customize the message.

---

## 3. Comparative Architectural Solutions & Trade-Offs

### Decision 1: Decluttering Company Cards & Fixing "Inspect Bots & Traits"
- **Proposal A (Chosen & Recommended)**: **Clean Summary Card + Consolidated Collapsible Inspector Drawer**
  - *Pros*: Removes 70% of visual noise from the default company list; gives the **Inspect Bots & Traits** button a clear, predictable purpose (opening all workforce simulation and override tools in one place); prevents accidental overrides while scrolling.
  - *Cons*: Requires one click on **Inspect Bots & Traits** to change Breakroom or Manager overrides.
- **Proposal B**: **Compact Table View + Slide-Out Drawer**
  - *Pros*: Ultra-compact for citizens with 12+ companies.
  - *Cons*: Loses immediate visibility of the 4 key production/profit metrics per company.
- **Proposal C**: **Keep Controls on Card Header, Remove Text Footer Only**
  - *Pros*: Minimal code change.
  - *Cons*: Header still wraps awkwardly on 4+ controls and still looks cluttered.

### Decision 2: Balancing Healthy Speculation & Economic Growth vs. Extreme Hoarding
- **Proposal A (Chosen & Recommended)**: **Dynamic Growth & Speculation Shield (`3.5x` Country Median + Company Upgrade Reserve Deduction)**
  - *Pros*: Explicitly protects a citizen's working capital and speculative growth buffer (`Protected Growth Reserve = max(3.5 × Country Resource Median, 1.5 × 7D Factory Input Cost + Next Upgrade Reserve)`). A moderate speculator holding `2x–3.5x` median resources to flip or upgrade factories is recognized as **Healthy Growth Speculation** (taxed lightly on regular cashflow rather than forced to liquidate inventory), whereas an extreme hoarder like `N3V1T5` holding `35.22x` country median (`43,742 BTC` vs. `~4,300 BTC` protected growth buffer) still has `~39,400 BTC` in taxable excess hoard.
  - *Cons*: Slightly more detailed formula, which we make transparent in the `[?]` breakdown popover.
- **Proposal B**: **Flat 50% Stockpile Exemption**
  - *Pros*: Simple math.
  - *Cons*: Under-protects developing players in poor countries while over-rewarding mega-whales holding `40,000+ BTC`.
- **Proposal C**: **Level-Only Tiered Multipliers**
  - *Pros*: Easy to compute from player level.
  - *Cons*: Ignores actual company count, live commodity prices, and country median wealth.

### Decision 3: Custom Merit-Based Congratulations & Over-Donation Warnings
- **Proposal A (Chosen & Recommended)**: **Unified 3-Mode Adaptive Diplomatic Modal with 4 Merit-Specific Commendation Sub-Archetypes & 2 Over-Donation Warning Sub-Archetypes**
  - *Pros*: Automatically distinguishes *why* a citizen deserves praise—whether they are an **Active Historical Pillar** who keeps giving in BTC or combat damage, a **Sovereign Treasury Patriot** funding the state, a **Battlefield Hero** dealing heavy combat damage, or a **Dual-Crown Vanguard** doing both—and generates telegrams citing their exact numbers (`totalDonatedBtc`, `periodDonatedBtc`, `damageDealt`, `damageValueBtc`, `contributionRatio`). Also lets the user manually switch between any of the 4 commendation types or 2 warning types.
  - *Cons*: Requires comprehensive merit classification and template generation in `ministryService.ts`.
- **Proposal B**: **Single Generic "Thank You" Template**
  - *Pros*: Fast to implement.
  - *Cons*: Fails to distinguish a frontline warrior dealing millions of damage from an eco industrialist donating BTC or a historic pillar still contributing every week.
- **Proposal C**: **Separate Modals for Nudge vs. Commendation**
  - *Pros*: Dedicated UI per action.
  - *Cons*: Prevents the user from seamlessly comparing all 3 options and switching modes inside a single unified workflow.

---

## 4. Technical Architecture, Edge Case Mitigation & Phased Plan

### Architecture & Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CITIZEN AUDIT & DIPLOMATIC ENGINE                     │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┴───────────────────────────────┐
        ▼                                                               ▼
┌───────────────────────────────────────┐     ┌────────────────────────────────────────┐
│   COMPANIES & BOT WORKFORCE TAB       │     │   ADAPTIVE DIPLOMATIC MODAL (max-w-4xl)│
│  • Unclipped Tab Strip (shrink-0)     │     │  • Auto-Evaluation & Recommendation    │
│  • Clean Company Summary Card:        │     │    Banner (Citizen + Country Context)  │
│    - Icon + Name + Unboxed Recipe     │     │  • 3 Selectable Diplomatic Modes:      │
│    - 4 Tabular KPI Tiles              │     │    1. Treasury Nudge (with 3.5x Growth │
│  • Collapsible "Inspect Bots" Drawer: │     │       Speculation Shield & Slider)     │
│    - Breakroom & Manager Controls     │     │    2. Merit Commendation:              │
│    - + Add/Edit Bot Slots (1–3)       │     │       - Active Historical Pillar       │
│    - Fixed "Reset to Live API"        │     │         (Still Giving BTC or Damage)   │
│      (clears state + localStorage)    │     │       - Sovereign Treasury Patriot     │
│                                       │     │       - Battlefield Frontline Hero     │
│                                       │     │       - Dual-Crown Vanguard            │
│                                       │     │    3. Over-Donation Burnout Warning:   │
│                                       │     │       - Economic Growth / CapEx Strain │
│                                       │     │       - Combatant War-Chest Strain     │
└───────────────────────────────────────┘     └────────────────────────────────────────┘
```

### Edge Case Mitigation
1. **Stale LocalStorage Keys on "Reset to Live API"**: `storage.clearCompanyWorkforceOverride(compId)` will purge the company ID from both `warera_company_workforce_overrides` and legacy `warera_company_workforce_overrides_v1`, and normalize `breakRoom` / `breakRoomLevel` so the card immediately reverts to live API state in a single click.
2. **Historical Pillars Resting vs. Historical Pillars Still Giving**: If a Historical Pillar (`isHistoricalPillar === true`) has `periodDonatedBtc > 0` OR `damageDealt > 0` (`damageValueBtc > 0`), the evaluator highlights them as an **Active Historical Pillar (Continuing Legacy)** and commends both their lifetime foundation and their active period contributions (donations, combat damage, or both). If they have 0 period donations and 0 combat damage, the commendation still honors their historic legacy while noting their current peacetime/reserve status.
3. **Inspecting Companies with 0 Public API Bot Traits**: When a user clicks **Inspect Bots & Traits** on a company where the API hides employee traits, the drawer opens cleanly with the Breakroom selector, Manager toggle, and a one-click **+ Add Simulated Bot Slot** workspace so the button always feels responsive and useful.
4. **Zero or Unverified Income When Evaluating Over-Donation**: If a citizen has donated a large sum (`periodDonated > 0`) while their liquid cash + company equity is below the country median (or donation exceeds `35%` of their 7D projected output + liquid buffer), the evaluator safely classifies them as `over-donation-warning` without dividing by zero.
5. **492-Character In-Game Telegram Limit**: All new Merit Commendation and Over-Donation Warning templates pass through `enforceMaxTelegramLength(body, username, 492)` so copied messages never get truncated by the War Era in-game chat box.

### Phased Task Decomposition
- **Phase 1: Fix "Reset to Live API", Tab Clipping & Declutter Company Cards**
  - **Phase 1.1**: Add `clearCompanyWorkforceOverride(companyId)` in `storage.ts` and unify `breakRoom` / `breakRoomLevel` keys so **Reset to Live API** works instantaneously.
  - **Phase 1.2**: Add `shrink-0 py-3` to the navigation tab bar in `CitizenAuditModal.tsx` so tabs never clip vertically.
  - **Phase 1.3**: Redesign each company card in `CitizenAuditModal.tsx` into a clean summary card with unboxed metadata and move the Breakroom dropdown, Manager toggle, Reset button, and Bot Slot configuration inside the **Inspect Bots & Traits** collapsible drawer.
- **Phase 2: Growth-Aware Speculation Shield & Merit-Based Diplomatic Engine**
  - **Phase 2.1**: Update `ministry.ts` and `ministryService.ts` to compute each citizen's **Protected Growth & Speculation Reserve** (`max(3.5 × resourceMedian, 1.5 × weeklyRawInputs + companyUpgradeBuffer)`), deducting it before calculating `taxableExcessResourceBtc` so moderate speculators can grow their economy while extreme hoarders (`>3.5x` median, like `N3V1T5`) are still taxed on their excess above the buffer.
  - **Phase 2.2**: Add the **Diplomatic Mode & Merit Evaluator** (`recommendedDiplomaticMode: 'nudge' | 'commendation' | 'over-donation-warning'`) with the 4 custom **Commendation Sub-Archetypes** (`active-historical-pillar`, `sovereign-treasury-patriot`, `battlefield-frontline-hero`, `dual-crown-vanguard`) and 2 **Over-Donation Warning Sub-Archetypes** (`capex-growth-strain`, `combat-ammo-strain`), plus their deterministic 3-tone telegram generators.
- **Phase 3: High-Legibility Adaptive Diplomatic Modal UI**
  - **Phase 3.1**: Widen the Diplomatic Modal in `CitizenRadar.tsx` and `MinistryWorkspace.tsx` to `max-w-4xl` and increase font sizes (`text-sm` / `text-base`) and padding for comfortable reading.
  - **Phase 3.2**: Render the **Evaluation & Recommendation Banner**, the 3-way **Diplomatic Mode Selector**, and the sub-archetype selector cards (so ministers can see why a citizen was classified as an Active Historical Pillar, Battlefield Hero, Sovereign Patriot, or Over-Donating Citizen, and freely switch between any option).
- **Phase 4: Build & Verification**
  - **Phase 4.1**: Run `compile_applet` to verify zero TypeScript or bundler errors.
