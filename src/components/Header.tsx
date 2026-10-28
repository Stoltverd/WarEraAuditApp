import React, { useState } from 'react';
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
} from 'lucide-react';

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
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
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
                BTC Donations
              </span>
            </div>
            <p className="text-xs text-slate-300 hidden sm:block">
              Daily, Weekly &amp; Monthly Citizen Audit
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
                {selectedCountry ? selectedCountry.name : 'Choose Country to Audit...'}
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
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
              activeMode === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Public citizen donation rankings"
          >
            <span>Leaderboard</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleMode('ministry')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
              activeMode === 'ministry'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Executive Ministry of Economy tools (Leech radar, inter-state transfers, market advisor)"
          >
            <span>🏛️ Ministry</span>
          </button>
        </div>

        {/* Right Actions: API Token Button & Sync */}
        <div className="flex items-center gap-2.5">
          {/* API Key Status Pill */}
          <button
            type="button"
            onClick={onOpenKeyModal}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition ${
              apiKey
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 animate-pulse'
            }`}
            title="Configure War Era API Token for live daily/weekly transaction streams"
          >
            {apiKey ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
            <span className="hidden sm:inline">
              {apiKey ? 'API Key Active' : 'Connect API Token'}
            </span>
          </button>

          {/* Diagnostics Inspector Button */}
          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
              title="Open War Era API Outbound Request Diagnostics Inspector"
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-xs">Inspector</span>
            </button>
          )}

          {/* Online status */}
          <div
            className={`hidden md:flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>

          {/* Sync Button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 shadow-md shadow-amber-500/20"
            title="Refresh donations from War Era API"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Donors'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
