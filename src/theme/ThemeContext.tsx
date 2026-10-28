import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeId =
  | 'tactical-command'
  | 'obsidian-oled'
  | 'midnight-navy'
  | 'bunker-olive'
  | 'crimson-command'
  | 'daylight-alabaster'
  | 'warm-parchment'
  | 'nordic-frost'
  | 'mint-ledger';

export type ThemeMode = 'dark' | 'light';

export interface ThemeDefinition {
  id: ThemeId;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  mode: ThemeMode;
  isDefault?: boolean;
  swatches: [string, string, string, string]; // [bg, card, text, accent]
}

export const THEME_CATALOG: ThemeDefinition[] = [
  // 1 Default + 4 Dark Themes
  {
    id: 'tactical-command',
    nameEn: 'Tactical Command (Default)',
    nameEs: 'Comando Táctico (Predeterminado)',
    descEn: 'Sovereign Slate & Amber',
    descEs: 'Pizarra Soberana y Ámbar',
    mode: 'dark',
    isDefault: true,
    swatches: ['#020617', '#0f172a', '#f8fafc', '#f59e0b'],
  },
  {
    id: 'obsidian-oled',
    nameEn: 'Obsidian OLED',
    nameEs: 'Obsidiana OLED',
    descEn: 'Pitch Carbon & Crisp Silver',
    descEs: 'Carbón Puro y Plata Nítida',
    mode: 'dark',
    swatches: ['#000000', '#0b0c10', '#ffffff', '#22d3ee'],
  },
  {
    id: 'midnight-navy',
    nameEn: 'Midnight Navy',
    nameEs: 'Azul Medianoche',
    descEn: 'Deep Maritime & Ice Cyan',
    descEs: 'Marítimo Profundo y Cian Hielo',
    mode: 'dark',
    swatches: ['#030b17', '#09192e', '#f0f9ff', '#38bdf8'],
  },
  {
    id: 'bunker-olive',
    nameEn: 'Bunker Olive',
    nameEs: 'Oliva Búnker',
    descEn: 'Tactical Field Green & Warm Ivory',
    descEs: 'Verde Táctico y Marfil Cálido',
    mode: 'dark',
    swatches: ['#060d08', '#0e1b12', '#ecfdf5', '#10b981'],
  },
  {
    id: 'crimson-command',
    nameEn: 'Crimson Command',
    nameEs: 'Comando Carmesí',
    descEn: 'Warm Charcoal & Imperial Gold',
    descEs: 'Carbón Cálido y Oro Imperial',
    mode: 'dark',
    swatches: ['#100608', '#1d0d12', '#fff1f2', '#f59e0b'],
  },
  // 4 High-Readability Light Themes
  {
    id: 'daylight-alabaster',
    nameEn: 'Daylight Alabaster',
    nameEs: 'Alabastro Diurno',
    descEn: 'Crisp Studio White & Deep Slate Ink',
    descEs: 'Blanco Estudio y Tinta Pizarra',
    mode: 'light',
    swatches: ['#eef2f6', '#ffffff', '#0f172a', '#d97706'],
  },
  {
    id: 'warm-parchment',
    nameEn: 'Warm Parchment',
    nameEs: 'Pergamino Cálido',
    descEn: 'Editorial Ivory Paper & Espresso Ink',
    descEs: 'Papel Marfil Editorial y Tinta Expreso',
    mode: 'light',
    swatches: ['#efeae1', '#fffdf9', '#1c1917', '#b45309'],
  },
  {
    id: 'nordic-frost',
    nameEn: 'Nordic Frost',
    nameEs: 'Escarcha Nórdica',
    descEn: 'Cool Arctic Daylight & Navy Ink',
    descEs: 'Luz Ártica y Tinta Azul Marino',
    mode: 'light',
    swatches: ['#e8f0f8', '#ffffff', '#0f2942', '#0284c7'],
  },
  {
    id: 'mint-ledger',
    nameEn: 'Mint Ledger',
    nameEs: 'Libro Mayor Menta',
    descEn: 'Central Bank Sage & Forest Ink',
    descEs: 'Salvia Bancaria y Tinta Bosque',
    mode: 'light',
    swatches: ['#e8f2ec', '#ffffff', '#0d2618', '#059669'],
  },
];

const THEME_STORAGE_KEY = 'warera_app_theme_v1';

interface ThemeContextValue {
  themeId: ThemeId;
  activeTheme: ThemeDefinition;
  setThemeId: (id: ThemeId) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'tactical-command',
  activeTheme: THEME_CATALOG[0],
  setThemeId: () => {},
  themes: THEME_CATALOG,
});

function resolveInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'tactical-command';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEME_CATALOG.some((t) => t.id === saved)) {
      return saved as ThemeId;
    }
  } catch {
    // ignore storage errors
  }
  return 'tactical-command';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(resolveInitialTheme);

  const activeTheme = useMemo(
    () => THEME_CATALOG.find((t) => t.id === themeId) || THEME_CATALOG[0],
    [themeId]
  );

  const setThemeId = (nextId: ThemeId) => {
    if (!THEME_CATALOG.some((t) => t.id === nextId)) return;
    setThemeIdState(nextId);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextId);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', activeTheme.id);
    root.setAttribute('data-theme-mode', activeTheme.mode);
  }, [activeTheme]);

  const value = useMemo(
    () => ({
      themeId,
      activeTheme,
      setThemeId,
      themes: THEME_CATALOG,
    }),
    [themeId, activeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
