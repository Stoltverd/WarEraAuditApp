# Leaderboard Integrity, I18n DOM Reconciliation & Citizen Badge Plan

## 1. Root Cause Diagnosis (Issues #1, #2, #3, #7, #8)
All five state-corruption symptoms across the Leaderboard, KPI Summary Cards (`RankingStats`), Top Navigation (`Header`), and Theme Switcher stem from a single underlying mechanism in `src/i18n/I18nContext.tsx`:

1. **Unfiltered Text-Node Caching in `originalTextMapRef`**:
   - When `lang === 'es'` is active, `processTree(document.body)` walks every `Node.TEXT_NODE` and executes:
     ```ts
     if (!originalTextMapRef.current.has(node)) {
       originalTextMapRef.current.set(node, currentVal);
     }
     ```
   - Because it caches `currentVal` **even when `translateTextNodeValue(currentVal) === currentVal`** (i.e., when no translation occurred), every dynamic numeric text node (`"0.00"`, `"0"`, `"#12"`, `"15.00"`, `"28.8%"`) and every React-managed `tx(en, es)` text node is trapped in `originalTextMapRef` with whatever text it held at that exact instant.
2. **Why Header & Theme Switcher Get Stuck in Spanish (Issues #7 & #8)**:
   - `Header.tsx` already localizes its labels via React (`tx('Rankings', 'Clasificación')` and `lang === 'es' ? activeTheme.nameEs : activeTheme.nameEn`).
   - When switching to `ES`, React renders the Spanish strings (`"Clasificación"`, `"Comando Táctico"`, `"Sincronizar"`, `"API Key Activa"`) into the DOM text nodes first. Then `I18nContext`'s `useEffect` runs `processTree` and saves those **Spanish** strings into `originalTextMapRef` as if they were the original English strings.
   - When switching back to `EN`, React updates the text nodes to English, and immediately afterward `I18nContext`'s `lang === 'en'` branch overwrites `node.nodeValue = orig`—forcing the DOM text nodes back to Spanish (`"Clasificación"`, `"Comando Táctico"`) out of sync with React's virtual DOM fiber.
3. **Why Leaderboard Ranks/Amounts & KPI Stats Desync Across Country/Timeframe/Language Switches (Issues #1, #2, #3)**:
   - When switching countries, `App.tsx` briefly clears `transactions = []`, causing `RankingStats` to render `"0.00"` for Total BTC and Median Contribution, and `"0"` for Contributing Citizens. `originalTextMapRef` captures `"0.00"` and `"0"`. When transactions finish loading or the user toggles `EN`/`ES` or timeframes (`24h` ↔ `7d` ↔ `30d`), `I18nContext` overwrites the updated DOM text nodes with the stale values cached in `originalTextMapRef`—resulting in `"0.00 BTC"` in KPI cards and mismatched rank/BTC/percentage cells inside `LeaderboardTable` rows (`key={donor.userId}`).

---

## 2. Comparative Architectural Proposals

### Proposal A: Targeted `I18nContext` Guardrails + Explicit React `tx()` Bypass (`data-i18n-managed`) (Recommended)
- **How it works**:
  1. **Strict Translation-Only Caching**: In `I18nContext.tsx`, only store a text node in `originalTextMapRef` when `translated !== currentVal` (meaning `translateTextNodeValue` actually matched an English dictionary rule and produced a different Spanish string). Pure numbers (`"0.00"`, `"1,000.00"`), rank numbers (`"#12"`), usernames, and already-Spanish strings are never stored in `originalTextMapRef`.
  2. **Clean Restoration & Eviction on `ES` → `EN`**: When switching from `ES` to `EN`, restore only nodes present in `originalTextMapRef` and immediately `originalTextMapRef.current.delete(node)` so stale baselines can never persist across future renders.
  3. **Live `characterData` Reconciliation**: In the `MutationObserver`'s `characterData` handler, if React updates a text node in `ES` mode, check if ` currentVal === lastTranslatedMapRef.current.get(node)`. If not, React itself mutated the text node with fresh data—so recompute `baseEn = currentVal` before translating (or delete from map if untranslated).
  4. **Explicit `data-no-dom-i18n` Attribute on `tx()`-Managed Containers**: Add `data-no-dom-i18n="true"` on `Header.tsx` (and any component fully translated via `tx()`), instructing `processTree` to skip that subtree entirely so React has 100% exclusive control over header & theme labels.
- **Pros**:
  - Eliminates 100% of numeric, rank, header, and theme text-node corruption while preserving all automatic Spanish DOM translations across the entire app.
  - Zero performance overhead; actually speeds up `TreeWalker` by skipping numeric nodes and `Header`.
- **Cons**:
  - Requires careful tracking of `lastTranslatedMapRef` alongside `originalTextMapRef` so React updates and DOM-observer updates are cleanly distinguished.

### Proposal B: Force Full React Subtree Remount (`key={lang}-${countryId}-${timeframe}`)
- **How it works**:
  - Keep `I18nContext` mostly as-is, but attach a composite `key={`${lang}-${selectedCountry?._id}-${timeframe}`}` to the root wrapper in `App.tsx` so React destroys and recreates all DOM nodes on every language, country, or timeframe change.
- **Pros**:
  - Simple one-line change in `App.tsx` that discards mutated DOM text nodes on switch.
- **Cons**:
  - **Poor UX**: Destroys component state (open modals, scroll position, search inputs, pagination page, expanded drawers) whenever the user switches language or timeframe.
  - Does **not** fix async updates within the same country/language (e.g., when `transactions` finish loading after initial `"0.00"` render, or when sorting leaderboard columns).

### Proposal C: Remove `MutationObserver` & Migrate All Components Exclusively to `tx(en, es)`
- **How it works**:
  - Delete `TreeWalker` and `MutationObserver` from `I18nContext.tsx` and manually wrap every string in all 20+ components with `tx(en, es)`.
- **Pros**:
  - Pure React rendering with zero direct DOM manipulation.
- **Cons**:
  - High regression risk for the hundreds of deep ministry tooltips, badges, and dynamic audit phrases that rely on the dictionary rules in `I18nContext.tsx`.

### Expert Recommendation
**Proposal A** is the optimal engineering choice, combined with scoped composite keys on data-driven rows (`key={`${donor.userId}-${donor.rank}-${donor.totalAmount}`}`) in `LeaderboardTable.tsx` and `RankingStats.tsx`. It permanently fixes the root cause in `I18nContext.tsx`, guarantees React fiber consistency during live data hydration and sorting, preserves scroll/modal state, and keeps 100% of existing Spanish translations intact.

---

## 3. Edge Case Mitigation Strategy

1. **Async Data Hydration While in Spanish Mode (`0.00` → Live BTC Totals)**:
   - *Edge Case*: When switching countries while in `ES`, `RankingStats` initially renders `0.00 BTC` and `0 patrons`, then updates 500ms later when API data resolves.
   - *Mitigation*: Numeric values (`0.00`, `47,850.00`) have `translateTextNodeValue(val) === val` and are never added to `originalTextMapRef`. For mixed text nodes (e.g., `"Showing 1–25 of 75 patrons"`), `lastTranslatedMapRef` tracks the exact Spanish output written by the observer; when React writes a new English string (`"Showing 1–25 of 92 patrons"`), `currentVal !== lastTranslated` triggers an immediate baseline refresh in `originalTextMapRef` before translating.
2. **Theme Selection & Language Toggle Interaction**:
   - *Edge Case*: User selects a non-default theme (e.g., `"Nordic Frost"` / `"Escarcha Nórdica"`), then toggles `ES` ↔ `EN`, and the theme button label either stays in Spanish or appears to revert to `"Comando Táctico"`.
   - *Mitigation*: `Header.tsx` is marked with `data-no-dom-i18n="true"` because every single label in `Header.tsx` already uses reactive `tx(en, es)` and `activeTheme.nameEn` / `activeTheme.nameEs`. This prevents the DOM observer from ever touching the header or theme dropdown.
3. **Unresolved or Newly Hydrated Citizens on the Leaderboard**:
   - *Edge Case*: A donor in `LeaderboardTable` may initially only have transaction records before `user.getUserLite` resolves their `level` and `skills` (build role).
   - *Mitigation*: When `usersMap[donor.userId]` is available, compute and display the Citizen Level badge (`Lv. X` / `Nvl X`) and Build Role badge (`Eco`, `War`, `Hybrid`). If `usersMap[donor.userId]` is still hydrating or lacks skill points, gracefully omit the build badge until hydrated without layout shift.
4. **Long Spanish Text in "Cuota del período" (`Period Share`)**:
   - *Edge Case*: On narrower desktop viewports (`1024px–1280px`), placing `"28.8%"` and `"de los fondos del período"` on the same horizontal row causes awkward multi-line wrapping.
   - *Mitigation*: Restyle the cell into a vertical 3-tier stack:
     1. Top row: Bold monospace percentage (`28.8%`).
     2. Middle row: Full-width visual progress bar (`h-2 rounded-full`).
     3. Bottom row: Single-line subtitle (`of period funds` / `de los fondos del período`) with `text-[11px] text-slate-400 whitespace-nowrap`.

---

## 4. Phased Task Decomposition

### Phase 1: Fix `I18nContext` DOM Observer & Text-Node Reconciliation (Issues #1, #2, #3, #7, #8)
- **Phase 1.1**: Update `src/i18n/I18nContext.tsx` to add `lastTranslatedMapRef = useRef<WeakMap<Node, string>>(new WeakMap())` and skip subtrees inside `[data-no-dom-i18n="true"]`.
- **Phase 1.2**: In `processTree`, only record `originalTextMapRef.current.set(node, baseEn)` when `translated !== baseEn`. If `translated === baseEn`, remove any stale entry from `originalTextMapRef` and `lastTranslatedMapRef`.
- **Phase 1.3**: When `characterData` fires in `ES` mode, detect when React has updated a text node (`currentVal !== lastTranslatedMapRef.current.get(node)`) and update `originalTextMapRef` to the new React value before translating. When switching `ES` → `EN`, restore original text and clear `originalTextMapRef` / `lastTranslatedMapRef` entries.
- **Phase 1.4**: Add `data-no-dom-i18n="true"` to the `<header>` root in `src/components/Header.tsx` and audit all header strings (`tx(en, es)`) and theme selector labels so switching `EN` ↔ `ES` and changing themes updates instantaneously and never gets stuck in Spanish.

### Phase 2: Leaderboard & KPI Stats State Synchronization + Citizen Level & Build Badges (Issues #1, #2, #4, #6)
- **Phase 2.1**: Extend `DonorRankingItem` in `src/types/warera.ts` and `src/services/rankingCalculator.ts` (or pass `usersMap` lookup into `LeaderboardTable.tsx`) to include citizen `level?: number` and `playstyle?: 'pure-eco' | 'pure-war' | 'hybrid'` using the existing `calculateWarSkillPoints`, `calculateEcoSkillPoints`, and `evaluatePlaystyle` utilities.
- **Phase 2.2**: Update `src/components/LeaderboardTable.tsx` to render each citizen's **Level badge (`Lv. X` / `Nvl X`)** and **Build Role badge (`Eco` / `War` / `Hybrid`)** inline next to their username.
- **Phase 2.3**: Redesign the `Period Share` (`Cuota del período`) column in `src/components/LeaderboardTable.tsx` into a clean stacked layout (bold percentage on top, progress bar in the middle, single-line subtitle below).
- **Phase 2.4**: Harden row and metric keys in `src/components/LeaderboardTable.tsx` and `src/components/RankingStats.tsx` so country, timeframe, and sort transitions always reflect live calculated numbers.

### Phase 3: Verification & Build Audit
- **Phase 3.1**: Audit other tables and cards (`Podium.tsx`, `CitizenRadar.tsx`, `DonorAuditModal.tsx`) for any similar text-node caching edge cases.
- **Phase 3.2**: Run `lint_applet` and `compile_applet` to verify zero TypeScript or build errors.
