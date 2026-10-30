# Implementation Plan — Default Collapsed Company Cards & Expand/Collapse All Control

## 1. Root-Cause Analysis
In `src/components/ministry/CompanyPortfolioAnalyzer.tsx` (lines 818–822), `loadPlayerBundle` currently initializes `openCompanyIds` with the first two companies whenever a citizen's company bundle loads:
```ts
const initialOpen = new Set<string>(
  res.companies.slice(0, 2).map((c) => c.company._id)
);
setOpenCompanyIds(initialOpen);
```
This causes the first two company cards to automatically expand when opening the **Companies & Bot Workforce** tab in the Audit Modal or loading a player in the **Workforce Advisor** tab.

---

## 2. Comparative Solutions

### **Proposal 1 (Recommended): Empty Initial `Set` + Bilingual Portfolio Section Header with `Expand All / Collapse All` Toggle**
- **Architecture**:
  1. In `loadPlayerBundle` (`src/components/ministry/CompanyPortfolioAnalyzer.tsx`), initialize `setOpenCompanyIds(new Set())` (and `setOpenSimCompanyIds(new Set())`) so 100% of company cards start collapsed in both the Audit Modal and the Workforce Advisor tab.
  2. Directly above the expandable company cards list (`line 1605`), add a compact section header bar displaying the company count (`Companies (${companiesState.length})` / `Empresas (${companiesState.length})`) and a bilingual (`EN` / `ES` via `tx(...)`) **Expand All / Collapse All** button (`Expand All (${companiesState.length})` / `Expandir Todas (${companiesState.length})` when any are closed; `Collapse All` / `Contraer Todas` when all are open).
- **Pros**:
  - Clean, scannable overview of all companies at a glance without vertical scroll bloat from auto-expanded 14-day charts and bot tables.
  - One-click bulk inspection when an auditor wants to compare all companies simultaneously.
  - Bilingual (`EN` / `ES`) support built in from the start.
- **Cons**:
  - Adds a compact 1-line header bar above the company list (~25 lines of JSX).
- **Edge Case Mitigation**:
  - *Refreshing Live Telemetry (`Refresh Live Telemetry` button)*: When clicking manual refresh for the **same** player (`bundle?.user?._id === res.user._id`), preserve the user's currently expanded company IDs (`prevOpenIds`) instead of forcefully collapsing cards they just opened, while resetting to `new Set()` (all closed) whenever switching to a different player or opening the modal fresh.
  - *Single Company vs. Multiple Companies*: Only show the `Expand All / Collapse All` button when `companiesState.length > 0`, and compute `areAllExpanded = companiesState.every((c) => openCompanyIds.has(c.company._id))`.

### **Proposal 2: Prop-Driven `defaultOpenCount` on `CompanyPortfolioAnalyzer`**
- **Architecture**:
  - Add a `defaultOpenCount?: number` prop (defaulting to `0`) to `CompanyPortfolioAnalyzerProps` and slice `res.companies.slice(0, defaultOpenCount)`.
- **Pros**:
  - Allows future callers to customize how many cards open initially.
- **Cons**:
  - Since both the Audit Modal and Workforce Advisor tab should start with all companies closed (`0`), a prop alone is unnecessary without the `Expand All / Collapse All` header control.
- **Edge Case Mitigation**:
  - Clamp `defaultOpenCount` to `Math.max(0, defaultOpenCount)`.

### **Proposal 3: Persist Expanded/Collapsed State in `sessionStorage` Per Citizen**
- **Architecture**:
  - Start all companies closed by default, and persist any manually expanded company IDs in `sessionStorage` keyed by `userId`.
- **Pros**:
  - Remembers which company card an auditor was inspecting if they close and reopen the same citizen's modal.
- **Cons**:
  - Violates the expectation that opening an audit starts with all companies cleanly collapsed.
- **Edge Case Mitigation**:
  - Requires clearing `sessionStorage` keys on modal close.

---

## 3. Phased Task Decomposition

- **Phase 1: Default All Company Cards to Collapsed (`src/components/ministry/CompanyPortfolioAnalyzer.tsx`)**
  - **Phase 1.1**: Update `loadPlayerBundle` so `openCompanyIds` and `openSimCompanyIds` initialize to `new Set<string>()` whenever loading a player (while preserving currently open company IDs if the user clicks `Refresh Live Telemetry` on the same player).
  - **Phase 1.2**: Update the state comment on `openCompanyIds` to reflect that all company cards start collapsed by default.

- **Phase 2: Bilingual (`EN` / `ES`) Expand All / Collapse All Header Bar (`src/components/ministry/CompanyPortfolioAnalyzer.tsx`)**
  - **Phase 2.1**: Above the company cards list (`line 1605`), render a compact header bar with:
    - Left label: `tx(\`Company Portfolio (${companiesState.length})\`, \`Portafolio de Empresas (${companiesState.length})\`)` + subtle hint `tx('Click any company to expand details', 'Haz clic en cualquier empresa para expandir detalles')`.
    - Right toggle button: Switches between `tx('Expand All', 'Expandir Todas')` (with `ChevronDown` icon) and `tx('Collapse All', 'Contraer Todas')` (with `ChevronUp` icon).

- **Phase 3: Verification**
  - **Phase 3.1**: Run `lint_applet` and `compile_applet` to verify zero TypeScript or build errors.
