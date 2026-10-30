# Theme Readability, Contrast, Tooltip & Hover Overhaul Plan

## 1. Architectural Strategy & User Decisions
Based on your selections and feedback, we will implement **Proposal C: Hybrid WCAG Token Remap + Component & Hover Polish** across all 9 themes (`tactical-command`, `obsidian-oled`, `midnight-navy`, `bunker-olive`, `crimson-command`, `daylight-alabaster`, `warm-parchment`, `nordic-frost`, `mint-ledger`), while strictly maintaining **Bilingual Parity (English as the primary default language + Spanish translation)**:

1. **Complete Multi-Palette WCAG Token Matrix (`src/index.css`)**:
   - Remap all missing `-50` and `-100` foreground shades (`cyan-50/100`, `amber-50/100`, `orange-50/100`, `emerald-50/100`, `rose-50/100`, `red-50/100`, `indigo-50/100`, `purple-50/100`) in `html[data-theme-mode="light"]` to high-contrast dark ink tones (`700–900` equivalents), eliminating pale-on-pale text like the `text-cyan-100` Audit Scope banner in `CitizenDetailModal.tsx`.
   - Add complete light-mode token inversions for all previously unmapped Tailwind palettes used across components: `sky`, `blue`, `violet`, `teal`, `yellow`, `green`, `fuchsia`, `pink`, `stone`, `zinc`, `gray`, and `neutral`.
   - Boost muted text luminance (`--color-slate-400`, `--color-slate-500`) across tinted dark themes (`bunker-olive`, `crimson-command`, `midnight-navy`) so secondary captions, formulas, and timestamps achieve WCAG AA+ legibility.

2. **Hover, Focus, Opacity & Solid-Fill Button Safeguards (`src/index.css`)**:
   - Fix `.text-white` and `.hover:text-white` / `.group-hover:text-white` in light mode so surface text and hovered table headers/buttons transition to crisp dark ink (`var(--theme-text-strong)`) rather than turning invisible white on light backgrounds.
   - Protect solid-fill badges and CTA buttons (`bg-emerald-600`, `bg-cyan-600`, `bg-rose-600`, `bg-red-600`, `bg-indigo-600`, `bg-purple-600`, `bg-amber-600`, `bg-orange-600`, `from-amber-700`, `from-amber-500`) so white text inside dark/vibrant solid buttons stays pure `#ffffff` across all themes.
   - Remap `.text-white/10`, `.text-white/20`, `.text-white/70`, `.text-white/80`, `.text-white/90` in light mode to `rgba(15, 23, 42, ...)` so watermarks and semi-transparent labels remain clearly visible.

3. **Theme-Matched Light Card Tooltips & Explanation Popovers**:
   - Introduce semantic tooltip/popover tokens (`--theme-popover-bg`, `--theme-popover-border`, `--theme-popover-text`, `--theme-popover-shadow`) so floating tooltips and Fiscal Standing explanation popovers render with a crisp, opaque theme-matched card surface, dark ink, and distinct border/elevation shadow in the 4 Light Themes (and high-contrast dark slate in the 5 Dark Themes).

4. **Tinted Gold, Silver & Bronze Podium Pedestals with Bold Rank Numbers (`src/components/Podium.tsx`)**:
   - Style the `#1`, `#2`, and `#3` podium blocks with distinct Gold, Silver, and Bronze tinted gradients and borders that work harmoniously in both Light and Dark modes (replacing the unmapped `stone-800` dark gray block on 3rd place).
   - Upgrade the pedestal rank numbers (`#1`, `#2`, `#3`) and bilingual rank titles (**English default**: `1st Place / 2nd Place / 3rd Place` — **Spanish translation**: `Primero / Segundo / Tercero`) from `text-white/10` to bold, high-contrast metallic-tinted numerals (`text-amber-500/35`, `text-slate-400/45`, `text-amber-600/40`) so they are immediately legible at a glance in every theme and both languages.

5. **Strict Bilingual (`EN` Default + `ES` Translation) Guarantee**:
   - All source strings in components remain in **English (`EN`)** by default and use `tx(en, es)` or the `domTranslator` dictionary for **Spanish (`ES`)** translation so both languages always stay in sync.

---

## 2. Edge Case Mitigation Matrix

| Edge Case | Root Cause | Mitigation |
| :--- | :--- | :--- |
| **Pale-on-Pale Callout Banners (`CitizenDetailModal.tsx`, `CitizenAuditModal.tsx`, `CitizenRadar.tsx`)** | `bg-*-950/35` inverts to light pastel in light mode while `text-*-100` or `text-*-200/80` stayed pale pastel | Remap `--color-*-50` and `--color-*-100` to deep `800/900` ink in light mode and update callout body text classes for guaranteed ≥7:1 AAA contrast. |
| **Invisible Hover Text (`hover:text-white`, `hover:text-cyan-100`, `group-hover:text-white`)** | Tailwind hover utilities on light surfaces change dark text to `#ffffff` on hover | Explicitly bind `.hover\:text-white:hover` and `.group:hover .group-hover\:text-white` on light surfaces to `var(--theme-text-strong)` while preserving white text on solid accent buttons. |
| **Solid Button Text Inversion (`#3` Podium badge, Export/Audit CTAs)** | Global `html[data-theme-mode="light"] .text-white` forced `#0f172a` dark text onto dark bronze/emerald/rose buttons | Scope `.text-white` override to exclude solid accent backgrounds (`bg-*-600`, `bg-*-700`, `from-amber-700`, `from-amber-500`) and add explicit `.text-on-accent` / solid-fill rules. |
| **Floating Popovers Bleeding Into Dense Tables (`CitizenRadar.tsx`, `CitizenCalculationExplainerModal.tsx`, `WorkforceAdvisor.tsx`)** | Semi-transparent `bg-slate-900/90` or low-contrast borders let table rows bleed through | Enforce solid opaque `var(--theme-popover-bg)` with a 1.5px semantic border and multi-layered drop shadow on all floating tooltips and popovers. |
| **Bilingual EN / ES Consistency** | UI strings or labels accidentally hardcoded in one language | Keep English as the primary default in all JSX/TSX and use `tx(en, es)` / `domTranslator.ts` so switching between `EN` and `ES` works seamlessly. |

---

## 3. Phased Task Decomposition

### Phase 2: Global Theme Engine & CSS Token Overhaul (`src/index.css`)
- **Phase 2.1**: Complete the `html[data-theme-mode="light"]` color variable mappings for `-50`, `-100`, `-200`, `-300`, `-400`, `-500`, `-600`, `-700`, `-800`, `-900`, and `-950` across all Tailwind palettes (`cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `amber`, `yellow`, `orange`, `emerald`, `teal`, `green`, `rose`, `red`, `stone`, `zinc`, `gray`, `neutral`).
- **Phase 2.2**: Add light-mode and dark-theme contrast rules for `.text-white`, opacity variants (`.text-white/10` through `.text-white/90`), `.hover:text-white`, `.group-hover:text-white`, solid-button white-text preservation, and semantic tooltip/popover surfaces (`--theme-popover-bg`, `--theme-popover-border`, `--theme-popover-shadow`).
- **Phase 2.3**: Tune `--color-slate-400` and `--color-slate-500` contrast in tinted dark themes (`bunker-olive`, `crimson-command`, `midnight-navy`).

### Phase 3: Component, Podium, Modal & Tooltip Readability Pass (EN Default + ES Translation)
- **Phase 3.1 (`src/components/Podium.tsx` & `src/components/CitizenDetailModal.tsx`)**:
  - Upgrade `#1` Gold (`1st Place` / `Primero`), `#2` Silver (`2nd Place` / `Segundo`), and `#3` Bronze (`3rd Place` / `Tercero`) podium pedestals, rank badges, and bold `#1 / #2 / #3` rank numerals for crisp visibility across all 9 themes in both English and Spanish.
  - Fix the `CitizenDetailModal.tsx` Audit Scope banner (`text-cyan-100` → high-contrast semantic cyan ink) and lifetime summary card contrast.
- **Phase 3.2 (`src/components/Header.tsx`, `src/components/LeaderboardTable.tsx`, `src/components/RankingStats.tsx`)**:
  - Audit and refine header mode switchers, country dropdown items, table header sort hover states, and pagination hover states across light and dark modes.
- **Phase 3.3 (`src/components/ministry/*` Modals, Popovers & Advisors)**:
  - Audit and upgrade floating explanation popovers, inline help tooltips, and status badges in `CitizenRadar.tsx`, `CitizenAuditModal.tsx`, `CitizenCalculationExplainerModal.tsx`, `GrossIncomeBreakdownModal.tsx`, `WorkforceAdvisor.tsx`, `CompanyPortfolioAnalyzer.tsx`, `WarReadinessEvaluation.tsx`, `MarketAdvisor.tsx`, `StockpileTracker.tsx`, and `TreasuryLedger.tsx`.

### Phase 4: Verification & Build Validation
- **Phase 4.1**: Run `lint_applet` and `compile_applet` to verify zero TypeScript or CSS build errors.
