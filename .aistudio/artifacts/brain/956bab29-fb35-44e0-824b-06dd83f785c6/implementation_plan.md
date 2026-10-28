# Implementation Plan: Policy Calibration Modal Fix, Official Country Flags & Official WarEra Item Icons

## 1. Architectural Diagnosis & Root Cause Analysis

### Issue 1: Policy & Leech Calibration Modal Untranslated Text, Dynamic `{countryName}` Tag & Header Scroll Overflow
1. **Header Scroll Bleed (`src/components/ministry/CitizenRadar.tsx`, lines 1669–1673)**:
   - The modal container currently uses `p-6 ... max-h-[90vh] overflow-y-auto` on the outer shell while the header bar inside uses `sticky top-0 bg-slate-900 z-10`.
   - Because `p-6` (`padding-top: 1.5rem / 24px`) is applied to the scrolling container itself, `sticky top-0` sticks `24px` below the top border of the modal. As the user scrolls down, content passes behind the sticky header and becomes visible in the `24px` top padding gap above the title banner (where `"General Default Income Quotas (%)"` is seen peeking above `"Calibración de Políticas Soberanas y Leeches"` in the screenshot).
   - **Fix**: Refactor the modal container into a 3-zone flex layout (`flex flex-col max-h-[90vh] overflow-hidden` without `p-6` on the outer shell):
     1. **Fixed Top Header** (`px-6 pt-5 pb-4 border-b border-slate-800 bg-slate-900 shrink-0 z-20`)
     2. **Dedicated Scrollable Body** (`p-6 overflow-y-auto flex-1 space-y-5`)
     3. **Fixed Bottom Action Bar** (`px-6 py-4 border-t border-slate-800 bg-slate-900 shrink-0 z-20`)
2. **Untranslated Strings & 100% Dynamic `{countryName}` Interpolation (`src/components/ministry/CitizenRadar.tsx` & `src/i18n/I18nContext.tsx`)**:
   - The Policy & Leech Calibration modal must work dynamically for **every country in the world** using the active `countryName` prop (`selectedCountry?.name || tx('Selected Nation', 'Nación Seleccionada')`), never hardcoding any specific country name.
   - Currently, strings with dynamic `{countryName}` interpolation—such as ``Customizable income donation ratios by playstyle for ${countryName}`` and ``Only citizens in the upper wealth brackets of ${countryName} (e.g. Top 25% / 75th percentile) can be classified as Critical Leeches if donating 0...``—as well as JSX blocks containing inline `<strong>` tags or Lucide icons (`<Swords />`), are split across multiple DOM text nodes or lack dynamic pattern rules in `I18nContext.tsx`.
   - **Fix**: Explicitly localize every heading, subtitle, Policy Guide bullet, quota label, description paragraph, percentile button, checkbox label, and action button inside `CitizenRadar.tsx` using `tx(en, es)` with dynamic `${countryName}` template variables (e.g., `tx(\`Customizable income donation ratios by playstyle for \${countryName}\`, \`Proporciones personalizables de donación de ingresos según estilo de juego para \${countryName}\`)`), AND add universal dynamic regex rules (`/^Customizable income donation ratios by playstyle for (.+)$/i` $\rightarrow$ `'Proporciones personalizables de donación de ingresos según estilo de juego para $1'`) and static dictionary entries to `src/i18n/I18nContext.tsx` so all languages and any selected country translate seamlessly.

### Issue 2: Official Country Flags from `https://arcana.warera.wiki/company`
- Inspection of `https://arcana.warera.wiki/js/utils.js` and `https://arcana.warera.wiki/js/data.js` confirms that Arcana renders country flags using FlagCDN (`https://flagcdn.com/20x15/${iso.toLowerCase()}.png`, width `20`, height `15`, with `COUNTRY_ISO` mapping country names and 2-letter ISO codes).
- In `src/components/Header.tsx`, the country selector currently uses a Unicode regional indicator helper (`getFlagEmoji(c.code)`, which renders as two-letter text abbreviations like `CO`, `US`, `PL` on Windows/Chromium desktop browsers) AND displays a raw `<span className="text-xs text-slate-400 uppercase font-mono">{c.code}</span>` abbreviation on the right side of each country option.
- **Fix**: Create a reusable `<WareraCountryFlag />` component backed by the complete `COUNTRY_ISO` lookup table from `https://arcana.warera.wiki/js/data.js` + ISO-2 code normalization, rendering `<img src="https://flagcdn.com/20x15/${iso.toLowerCase()}.png" srcSet="https://flagcdn.com/40x30/${iso.toLowerCase()}.png 2x" width="20" height="15" ... />`. Replace the country code abbreviations and emoji fallbacks in the `Header.tsx` country selector button and dropdown list (as well as country lists in `CompanyPortfolioAnalyzer.tsx`, `TreasuryLedger.tsx`, and `WarReadinessEvaluation.tsx`) with the crisp graphical flag.

### Issue 3: Official Item & Product Icons from `https://arcana.warera.wiki/company`
- Inspection of `https://arcana.warera.wiki/js/data.js` and `https://arcana.warera.wiki/js/utils.js` confirms the canonical item icon endpoint:
  `https://media.warera.io/images/items/${imgName}.png?v=31`
- Complete canonical item & equipment icon identifiers from `arcana.warera.wiki`:
  - **Raw Materials & Manufactured Products (20 items)**: `grain`, `limestone`, `lead`, `petroleum`, `coca`, `iron`, `livestock`, `fish`, `wood`, `steel`, `concrete`, `oil`, `bread`, `steak`, `cookedFish`, `lightAmmo`, `ammo`, `heavyAmmo`, `cocain`, `paper`.
  - **Cases & Salvage (4 items)**: `case1` (`case`), `case2` (`case_2` / elite case), `woodenCase` (`wooden_case`), `scraps` (`scrap`).
  - **Combat Equipment & Weapons (`DC_ITEM_IMG`)**: `knife`, `gun`, `rifle`, `sniper`, `tank`, `jet`, `helmet` (`helmet1`–`helmet6`), `chest` (`chest1`–`chest6`), `pants` (`pants1`–`pants6`), `boots` (`boots1`–`boots6`), `gloves` (`gloves1`–`gloves6`).
- Furthermore, `src/components/ministry/StockpileTracker.tsx` (line 833) and `src/components/ministry/MarketAdvisor.tsx` (line 294) currently point to a broken legacy URL (`https://warera.io/${item.id}.png`), which fails to load and falls back to generic Lucide icons.
- **Fix**: Upgrade `src/components/common/WareraItemIcon.tsx` to load the official `https://media.warera.io/images/items/${imgName}.png?v=31` sprites for all commodities, company products, cases, scraps, and equipment across the entire application, and replace the broken `https://warera.io/${item.id}.png` image tags in `StockpileTracker.tsx` and `MarketAdvisor.tsx` with `<WareraItemIcon />`.

---

## 2. Comparative Architectural Proposals

### Proposal A: Direct Inline Patching (Minimal Component Edits)
- **Architecture**: Patch the modal container classes in `CitizenRadar.tsx`, rely primarily on `I18nContext.tsx` DOM text-node replacements for translations, and inline `flagcdn.com` and `media.warera.io` `<img>` tags directly inside `Header.tsx`, `StockpileTracker.tsx`, and `MarketAdvisor.tsx`.
- **Pros**:
  - Fastest initial file touch count.
- **Cons**:
  - Inline `<strong>` tags and icons inside `CitizenRadar.tsx` split strings into multiple DOM text nodes, causing fragile translations when only relying on DOM `MutationObserver`.
  - Duplicating flag and item URL logic across multiple components makes fallback handling inconsistent.

### Proposal B: Dedicated Shared Visual Components (`WareraCountryFlag` & `WareraItemIcon`) + Explicit Bilingual `tx()` & Dictionary Sync (Recommended)
- **Architecture**:
  1. Refactor the `CitizenRadar.tsx` Policy Calibration modal into a 3-zone flex container (`shrink-0` header, `flex-1 overflow-y-auto` body, `shrink-0` footer) so scrolled content can never bleed behind or above the header banner.
  2. Explicitly wrap every Policy Calibration modal string and Policy Guide paragraph in `CitizenRadar.tsx` with `tx(en, es)` using dynamic `${countryName}` interpolation for **any** selected nation, AND register all corresponding static strings and dynamic `{countryName}` regex rules in `src/i18n/I18nContext.tsx`.
  3. Create `src/components/common/WareraCountryFlag.tsx` containing the complete `COUNTRY_ISO` mapping from `arcana.warera.wiki/js/data.js` and rendering `https://flagcdn.com/20x15/${iso.toLowerCase()}.png` (with `2x` retina `srcSet`). Replace both the broken emoji flags and the raw country code abbreviation badge in `Header.tsx` (plus country displays in `CompanyPortfolioAnalyzer.tsx`, `TreasuryLedger.tsx`, and `WarReadinessEvaluation.tsx`).
  4. Upgrade `src/components/common/WareraItemIcon.tsx` with the complete `ITEMS` and `DC_ITEM_IMG` mapping from `arcana.warera.wiki` (`https://media.warera.io/images/items/${imgName}.png?v=31`), with automatic SVG fallback if offline, and use it across `CompanyPortfolioAnalyzer.tsx`, `StockpileTracker.tsx`, `MarketAdvisor.tsx`, and `CitizenRadar.tsx`.
- **Pros**:
  - Completely eliminates scroll bleed above the modal header.
  - Guarantees 100% instant, flicker-free Spanish/English translation inside the Policy Calibration modal for **every country dynamically** (`${countryName}`), even on paragraphs with bold formatting and icons.
  - Centralizes official WarEra item sprites and FlagCDN country flags in reusable components with clean fallback states.
- **Cons**:
  - Requires touching a few more files (`Header.tsx`, `WareraCountryFlag.tsx`, `WareraItemIcon.tsx`, `StockpileTracker.tsx`, `MarketAdvisor.tsx`, `CitizenRadar.tsx`, `I18nContext.tsx`), which is well worth the maintainability and visual consistency.

### Proposal C: Build-Time Local Asset Mirroring
- **Architecture**: Download all 195 country flags from `flagcdn.com` and all 35+ item PNGs from `media.warera.io` into `/public/assets/` and reference them locally.
- **Pros**:
  - Works without external CDN requests.
- **Cons**:
  - Bloats the repository with over 230 binary files and goes against directly referencing the live `arcana.warera.wiki` asset URLs (`?v=31`) when game sprites update.

### Expert Recommendation
**Proposal B** is the best engineering choice. It directly uses the canonical URLs and mappings from `https://arcana.warera.wiki/company`, fixes the broken `https://warera.io/${item.id}.png` URLs in `StockpileTracker` and `MarketAdvisor`, eliminates the modal scroll overflow permanently via flexbox layout isolation, and guarantees complete Spanish/English localization in the Policy Calibration modal with 100% dynamic `{countryName}` support for every country.

---

## 3. Edge Case Mitigation

1. **Dynamic Country Name Interpolation (`{countryName}`) Across All ~195 Countries**:
   - *Edge Case*: Any player from any country (e.g., Poland, Argentina, United States, Colombia, Spain, Japan) selects their nation in the header and opens Policy Calibration. If any string or translation rule hardcoded a specific country name, it would break for other nations or fail to translate.
   - *Mitigation*: Pass the dynamic `countryName` prop (`selectedCountry?.name || tx('Selected Nation', 'Nación Seleccionada')`) into every `tx()` template string in `CitizenRadar.tsx` (e.g., `tx(\`Customizable income donation ratios by playstyle for \${countryName}\`, \`Proporciones personalizables de donación de ingresos según estilo de juego para \${countryName}\`)`), and add dynamic capture-group regexes in `I18nContext.tsx` (`/for (.+)$/i`, `/of (.+) \(e\.g\./i`) so any country name is dynamically preserved and translated. Also update `src/App.tsx` so the fallback when `selectedCountry` is loading is generic rather than a specific country.
2. **Unmapped or Custom Country Names / API Country Codes**:
   - *Edge Case*: The WarEra API returns a country with either an ISO-2 `code` (e.g. `"CO"`, `"PL"`, `"US"`), a full country name (`"Bosnia and Herzegovina"`, `"Côte d'Ivoire"`), or a non-standard internal ID.
   - *Mitigation*: `WareraCountryFlag` will resolve the 2-letter ISO code by first checking if `code` is already a valid 2-letter ISO alpha-2 code (`/^[A-Za-z]{2}$/`), and if not, looking up `COUNTRY_ISO[name]` (case-insensitive and accent-normalized). If neither resolves or if the image fails to load (`onError`), it gracefully renders a clean globe badge.
3. **Item ID Naming Variations Across API & Wiki (`cocain` vs `cocaine`, `cookedFish` vs `cooked_fish`, `case1` vs `case`, `helmet1`–`helmet6`)**:
   - *Edge Case*: Different WarEra API endpoints and local services refer to items using snake_case (`cooked_fish`, `heavy_ammo`, `light_ammo`), camelCase (`cookedFish`, `heavyAmmo`, `lightAmmo`), display names (`"Cooked Fish"`, `"Cocaine"`, `"Concrete"`), or tiered equipment codes (`"helmet3"`, `"chest5"`).
   - *Mitigation*: `WareraItemIcon` normalizes any input string (camelCase, snake_case, display label, or tiered gear code like `helmet1..6`) to the exact `media.warera.io/images/items/${imgName}.png?v=31` filename used by `arcana.warera.wiki` (`cookedFish`, `cocain`, `lightAmmo`, `ammo`, `heavyAmmo`, `case1`, `case2`, `woodenCase`, `scraps`, `helmet`, `chest`, `pants`, `boots`, `gloves`, `knife`, `gun`, `rifle`, `sniper`, `tank`, `jet`). If an image ever fails to load (`onError`), it automatically falls back to the bespoke SVG icon.
4. **Modal Scroll Overflow on Small Viewports**:
   - *Edge Case*: Opening the collapsible "Policy Guide" inside the Policy Calibration modal increases content height beyond `90vh` on laptops and mobile screens.
   - *Mitigation*: By separating the modal into a `shrink-0` header, `flex-1 overflow-y-auto` scrollable content area, and `shrink-0` footer, expanding the Policy Guide smoothly scrolls inside the middle container without ever overlapping or bleeding above the header banner.

---

## 4. Phased Task Decomposition

### Phase 1: Policy & Leech Calibration Modal Layout & Dynamic Localization (`CitizenRadar.tsx`, `I18nContext.tsx`, `App.tsx`)
- **Phase 1.1**: Refactor the Policy Calibration modal container in `src/components/ministry/CitizenRadar.tsx` from a single padded scrolling container into a 3-section flex container (`shrink-0` top header bar, `flex-1 overflow-y-auto p-6` scrollable body, and `shrink-0` bottom action bar) so scrolled text never appears behind or above the title banner.
- **Phase 1.2**: Wrap all text inside the Policy Calibration modal and its collapsible Policy Guide in `src/components/ministry/CitizenRadar.tsx` with `tx(en, es)` using 100% dynamic `${countryName}` interpolation, and ensure `src/App.tsx` passes a generic fallback (`selectedCountry?.name || 'State'`) when no country is loaded yet.
- **Phase 1.3**: Add all Policy Calibration static strings and dynamic `{countryName}` regex patterns to `src/i18n/I18nContext.tsx` for full coverage.

### Phase 2: Official Country Flags Integration (`WareraCountryFlag.tsx` & `Header.tsx`)
- **Phase 2.1**: Create `src/components/common/WareraCountryFlag.tsx` implementing the complete `COUNTRY_ISO` dictionary and `https://flagcdn.com/20x15/${iso.toLowerCase()}.png` (`2x` `40x30` retina `srcSet`) flag renderer from `https://arcana.warera.wiki/company`.
- **Phase 2.2**: Update `src/components/Header.tsx` to display `<WareraCountryFlag />` in the country selector button and dropdown items, removing the raw country code abbreviation (`{c.code}`) and replacing `getFlagEmoji`. Also integrate `<WareraCountryFlag />` into `CompanyPortfolioAnalyzer.tsx` (player country & Lowest-Tax Countries badges), `TreasuryLedger.tsx`, and `WarReadinessEvaluation.tsx`.

### Phase 3: Official WarEra Item & Equipment Icons Integration (`WareraItemIcon.tsx`, `StockpileTracker.tsx`, `MarketAdvisor.tsx`)
- **Phase 3.1**: Upgrade `src/components/common/WareraItemIcon.tsx` to resolve all 24 commodities/cases/scraps and 11 combat equipment/weapon categories to `https://media.warera.io/images/items/${imgName}.png?v=31` (matching `https://arcana.warera.wiki/company`), with automatic fallback to the inline SVG icon on network error.
- **Phase 3.2**: Replace the broken `https://warera.io/${item.id}.png` image elements in `src/components/ministry/StockpileTracker.tsx` and `src/components/ministry/MarketAdvisor.tsx` with `<WareraItemIcon />` so all item icons render consistently across every view.
- **Phase 3.3**: Run `compile_applet` and `lint_applet` to verify zero TypeScript or build errors.
