import React, { useState, useRef, useEffect } from 'react';
import { WareraCountry } from '../types/warera';
import {
  Globe,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Coins,
  Key,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Palette,
  Moon,
  Sun,
  Check,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  countries: WareraCountry[];
  selectedCountry: WareraCountry | null;
  onSelectCountry: (country: WareraCountry) => void;
  isSyncing: boolean;
  onSync: () => void;
  isOnline: boolean;
  apiKey: string;
  onOpenKeyModal: () => void;
  onOpenDiagnostics?: () => void;
  activeMode: 'leaderboard' | 'ministry';
  onToggleMode: (mode: 'leaderboard' | 'ministry') => void;
}

export const Header: React.FC<HeaderProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  isSyncing,
  onSync,
  isOnline,
  apiKey,
  onOpenKeyModal,
  onOpenDiagnostics,
  activeMode,
  onToggleMode,
}) => {
  const { lang, setLang, tx } = useI18n();
  const { activeTheme, setThemeId, themes } = useTheme();
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isThemeMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isThemeMenuOpen]);

  const darkThemes = themes.filter((t) => t.mode === 'dark');
  const lightThemes = themes.filter((t) => t.mode === 'light');

  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const formatBtc = (val?: number) => {
    if (val === undefined || val === null) return '0 BTC';
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(3)}M BTC`;
    }
    if (val >= 1_000) {
      return `${(val / 1_000).toFixed(3)}K BTC`;
    }
    return `${val.toFixed(2)} BTC`;
  };

  const getCountryWealthValue = (c: WareraCountry) => {
    return c.countryWealth?.value ?? c.rankings?.countryWealth?.value ?? c.money ?? 0;
  };

  return (
    <header
      data-no-dom-i18n="true"
      className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white"
    >
      <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 xl:px-10 h-18 py-2.5 flex items-center justify-between gap-4">
        {/* Logo / Branding */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-black tracking-tight text-xl text-slate-100">
                WAR<span className="text-amber-400">ERA</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold">
                {tx('BTC Donations', 'Donaciones BTC')}
              </span>
            </div>
            <p className="text-xs text-slate-300 hidden sm:block">
              {tx('Daily, Weekly & Monthly Citizen Audit', 'Auditoría Ciudadana Diaria, Semanal y Mensual')}
            </p>
          </div>
        </div>

        {/* Center: Country Selector */}
        <div className="relative flex-1 max-w-xl">
          <button
            type="button"
            onClick={() => setIsCountryMenuOpen(!isCountryMenuOpen)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition text-left text-sm sm:text-base shadow-sm ${
              !selectedCountry
                ? 'bg-slate-800 border-2 border-amber-500/60 ring-2 ring-amber-500/20 hover:border-amber-400'
                : 'bg-slate-800/90 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <span className="text-2xl">
                {selectedCountry ? getFlagEmoji(selectedCountry.code) : '🌐'}
              </span>
              <span className={`truncate ${!selectedCountry ? 'font-black text-amber-300' : 'font-extrabold text-slate-100'}`}>
                {selectedCountry ? selectedCountry.name : tx('Choose Country to Audit...', 'Elegir País a Auditar...')}
              </span>
              {selectedCountry && (
                <span className="text-xs sm:text-sm text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20 font-mono font-bold hidden md:inline">
                  {formatBtc(getCountryWealthValue(selectedCountry))}
                </span>
              )}
            </div>
            <Globe className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Country Dropdown Menu */}
          {isCountryMenuOpen && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 max-h-96 flex flex-col">
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search 180 countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="px-2 py-1 text-xs text-slate-400 font-mono flex justify-between">
                <span>{filteredCountries.length} countries (Alphabetical)</span>
                <span>Select for audit</span>
              </div>

              <div className="overflow-y-auto space-y-1 flex-1 pr-1 max-h-72">
                {filteredCountries.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-6">
                    No countries matching &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = selectedCountry?._id === c._id;
                    const wealth = getCountryWealthValue(c);

                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => {
                          onSelectCountry(c);
                          setIsCountryMenuOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-lg shrink-0">{getFlagEmoji(c.code)}</span>
                          <span className="truncate">{c.name}</span>
                          <span className="text-xs text-slate-400 uppercase font-mono">
                            {c.code}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm text-amber-400/90 font-mono font-bold shrink-0 ml-2">
                          {formatBtc(wealth)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Workspace Mode Switcher: Leaderboard vs Ministry */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => onToggleMode('leaderboard')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeMode === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
            title={tx('Public citizen donation rankings', 'Clasificación pública de donaciones ciudadanas')}
          >
            <span>{tx('Leaderboard', 'Clasificación')}</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleMode('ministry')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeMode === 'ministry'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
            title={tx(
              'Executive Ministry of Economy tools (Leech radar, inter-state transfers, market advisor)',
              'Herramientas del Ministerio de Economía (Radar de contribución, transferencias y mercado)'
            )}
          >
            <span>{tx('🏛️ Ministry', '🏛️ Ministerio')}</span>
          </button>
        </div>

        {/* Right Actions: Theme Switcher, Language Pill, API Token Button & Sync */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher Dropdown */}
          <div className="relative shrink-0" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold transition whitespace-nowrap shadow-sm"
              title={tx(
                'Change color theme (5 Dark & 4 Light high-readability themes)',
                'Cambiar tema de color (5 temas oscuros y 4 claros de alta legibilidad)'
              )}
              aria-label={tx('Theme Switcher', 'Selector de Tema')}
            >
              <Palette className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden xl:inline max-w-[130px] truncate">
                {lang === 'es' ? activeTheme.nameEs.replace(' (Predeterminado)', '') : activeTheme.nameEn.replace(' (Default)', '')}
              </span>
              <span className="flex items-center gap-0.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-600"
                  style={{ backgroundColor: activeTheme.swatches[0] }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-600"
                  style={{ backgroundColor: activeTheme.swatches[3] }}
                />
              </span>
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-800">
                  <div className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-400" />
                    <span>{tx('Readability Color Themes', 'Temas de Alta Legibilidad')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {tx('WCAG Contrast', 'Contraste WCAG')}
                  </span>
                </div>

                {/* Dark Themes Group (Default + 4 Dark) */}
                <div className="space-y-1">
                  <div className="px-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Moon className="w-3 h-3 text-amber-400" />
                    <span>{tx('Dark Themes (5)', 'Temas Oscuros (5)')}</span>
                  </div>
                  <div className="space-y-1">
                    {darkThemes.map((t) => {
                      const isSelected = t.id === activeTheme.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setThemeId(t.id);
                            setIsThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition border ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-slate-950/60 hover:bg-slate-800 border-transparent text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{lang === 'es' ? t.nameEs : t.nameEn}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {lang === 'es' ? t.descEs : t.descEn}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center -space-x-1">
                              {t.swatches.map((hex, i) => (
                                <span
                                  key={i}
                                  className="w-3.5 h-3.5 rounded-full border border-slate-600 shadow-sm"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Light Themes Group (4 Light) */}
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <div className="px-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>{tx('Light Themes (4)', 'Temas Claros (4)')}</span>
                  </div>
                  <div className="space-y-1">
                    {lightThemes.map((t) => {
                      const isSelected = t.id === activeTheme.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setThemeId(t.id);
                            setIsThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition border ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-slate-950/60 hover:bg-slate-800 border-transparent text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{lang === 'es' ? t.nameEs : t.nameEn}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {lang === 'es' ? t.descEs : t.descEn}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center -space-x-1">
                              {t.swatches.map((hex, i) => (
                                <span
                                  key={i}
                                  className="w-3.5 h-3.5 rounded-full border border-slate-500 shadow-sm"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher Pill (EN | ES) */}
          <div
            className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0"
            role="group"
            aria-label={tx('Language Switcher', 'Selector de Idioma')}
          >
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Switch language to English (Default)"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap shrink-0 ${
                lang === 'es'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Cambiar idioma a Español (terminología oficial War Era)"
            >
              ES
            </button>
          </div>

          {/* API Key Status Pill */}
          <button
            type="button"
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition whitespace-nowrap shrink-0 ${
              apiKey
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 animate-pulse'
            }`}
            title={tx(
              'Configure War Era API Token for live daily/weekly transaction streams',
              'Configurar Token API de War Era para recibos diarios y semanales en vivo'
            )}
          >
            {apiKey ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
            <span className="hidden sm:inline">
              {apiKey ? tx('API Key Active', 'API Key Activa') : tx('Connect API Token', 'Conectar Token API')}
            </span>
          </button>

          {/* Diagnostics Inspector Button */}
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
              title={tx(
                'Open War Era API Outbound Request Diagnostics Inspector',
                'Abrir Inspector de Diagnóstico de Solicitudes API de War Era'
              )}
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-xs">{tx('Inspector', 'Inspector')}</span>
            </button>
          )}

          {/* Online status */}
          <div
            className={`hidden md:flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
            title={isOnline ? tx('Online', 'En línea') : tx('Offline', 'Sin conexión')}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>

          {/* Sync Button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 shadow-md shadow-amber-500/20 whitespace-nowrap shrink-0"
            title={tx('Refresh donations from War Era API', 'Actualizar donaciones desde la API de War Era')}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? tx('Syncing...', 'Sincronizando...') : tx('Sync Donors', 'Sincronizar')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
