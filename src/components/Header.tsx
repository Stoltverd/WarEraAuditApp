import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';

interface HeaderProps {
  countries: WareraCountry[];
  selectedCountry: WareraCountry | null;
  onSelectCountry: (country: WareraCountry) => void;
  isSyncing: boolean;
  onSync: () => void;
  isOnline: boolean;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  countries,
  selectedCountry,
  onSelectCountry,
  isSyncing,
  onSync,
  isOnline,
  apiKey,
  onSaveApiKey,
}) => {
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputKey, setInputKey] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handleSaveKey = () => {
    onSaveApiKey(inputKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsKeyModalOpen(false);
    }, 1200);
  };

  // Close modal on Escape key press
  useEffect(() => {
    if (!isKeyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsKeyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyModalOpen]);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo / Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-lg text-slate-100">
                WAR<span className="text-amber-400">ERA</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold">
                BTC Donations
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Daily, Weekly & Monthly Citizen Audit
            </p>
          </div>
        </div>

        {/* Center: Country Selector */}
        <div className="relative flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setIsCountryMenuOpen(!isCountryMenuOpen)}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl transition text-left text-sm shadow-sm ${
              !selectedCountry
                ? 'bg-slate-800 border-2 border-amber-500/60 ring-2 ring-amber-500/20 hover:border-amber-400'
                : 'bg-slate-800/90 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <span className="text-xl">
                {selectedCountry ? getFlagEmoji(selectedCountry.code) : '🌐'}
              </span>
              <span className={`truncate ${!selectedCountry ? 'font-black text-amber-300' : 'font-extrabold text-slate-200'}`}>
                {selectedCountry ? selectedCountry.name : 'Choose Country to Audit...'}
              </span>
              {selectedCountry && (
                <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-mono font-bold hidden md:inline">
                  {formatBtc(getCountryWealthValue(selectedCountry))}
                </span>
              )}
            </div>
            <Globe className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Country Dropdown Menu */}
          {isCountryMenuOpen && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 max-h-96 flex flex-col">
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search 180 countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="px-2 py-1 text-[11px] text-slate-500 font-mono flex justify-between">
                <span>{filteredCountries.length} countries (Alphabetical)</span>
                <span>Select for audit</span>
              </div>

              <div className="overflow-y-auto space-y-1 flex-1 pr-1 max-h-72">
                {filteredCountries.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-6">
                    No countries matching "{searchQuery}"
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-lg shrink-0">{getFlagEmoji(c.code)}</span>
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-mono">
                            {c.code}
                          </span>
                        </div>
                        <span className="text-xs text-amber-400/90 font-mono font-bold shrink-0 ml-2">
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

        {/* Right Actions: API Token Button & Sync */}
        <div className="flex items-center gap-2.5">
          {/* API Key Status Pill */}
          <button
            type="button"
            onClick={() => {
              setInputKey(apiKey);
              setIsKeyModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              apiKey
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 animate-pulse'
            }`}
            title="Configure War Era API Token for live daily/weekly transaction streams"
          >
            {apiKey ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Key className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">
              {apiKey ? 'API Key Active' : 'Connect API Token'}
            </span>
          </button>

          {/* Online status */}
          <div
            className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </div>

          {/* Sync Button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 shadow-md shadow-amber-500/20"
            title="Refresh donations from War Era API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Donors'}</span>
          </button>
        </div>
      </div>

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsKeyModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto flex min-h-full items-center justify-center p-4 sm:p-6"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">War Era API Token</h3>
                  <p className="text-[11px] text-slate-400">Private key for authenticating transaction receipts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto pr-1 my-4 space-y-3.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                To calculate <strong>genuine Daily (24h) and Weekly (7d) rankings</strong> and view individual transaction records (such as 10 BTC donations), War Era requires an API token to access the individual transaction stream via{' '}
                <code className="text-amber-400 bg-slate-800 px-1 py-0.5 rounded font-mono">
                  transaction.getPaginatedTransactions
                </code>
                .
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Your War Era API Key / Token
                </label>
                <input
                  type="password"
                  placeholder="Paste your War Era API token here..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  autoFocus
                />
              </div>

              {savedSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <span>✓</span> API Token saved! Syncing granular transaction logs...
                </div>
              )}

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-200">Where do I get my token?</span>
                  <br />
                  Log into War Era $\rightarrow$ Settings / Profile $\rightarrow$ API Access, and copy your private key. It is stored securely on your browser device only.
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInputKey('');
                  onSaveApiKey('');
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition"
              >
                Clear Token
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md shadow-amber-500/20 transition"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
