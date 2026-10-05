/**
 * War Era Country Donation Rankings & Citizen Leaderboard
 * Live ranking engine for country donations in War Era BTC across Daily, Weekly, and Monthly periods.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  WareraCountry,
  WareraTransaction,
  WareraCumulativeDonation,
  WareraUserLite,
  RankingTimeframe,
  SyncProgress,
  DonorRankingItem,
} from './types/warera';
import { storage } from './services/storage';
import { getCountries, ensureDonorsDamageStats, fetchCountryCitizens } from './services/apiService';
import {
  calculateGranularRankings,
  calculateCumulativeRankings,
  syncCountryData,
} from './services/rankingService';
import { Header } from './components/Header';
import { RankingStats } from './components/RankingStats';
import { Podium } from './components/Podium';
import { LeaderboardTable } from './components/LeaderboardTable';
import { CitizenDetailModal } from './components/CitizenDetailModal';
import { ExportModal } from './components/ExportModal';
import {
  CalendarDays,
  Share2,
  AlertCircle,
  Key,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Calculator,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { CustomDateRange, DamageDonationConfig } from './types/warera';

export default function App() {
  const [countries, setCountries] = useState<WareraCountry[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<WareraCountry | null>(null);
  const [transactions, setTransactions] = useState<WareraTransaction[]>([]);
  const [cumulative, setCumulative] = useState<WareraCumulativeDonation[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, WareraUserLite>>({});

  const [timeframe, setTimeframe] = useState<RankingTimeframe>('daily');
  const [apiKey, setApiKey] = useState<string>('');
  const [isGranularActive, setIsGranularActive] = useState<boolean>(false);

  // Helper date strings for Custom Range (defaults to last 14 days)
  const todayStr = new Date().toISOString().split('T')[0];
  const fourteenDaysAgoStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [customRange, setCustomRange] = useState<CustomDateRange>({
    startDate: fourteenDaysAgoStr,
    endDate: todayStr,
  });

  // Damage Donations (War Mode) State
  const [includeDamage, setIncludeDamage] = useState<boolean>(false);
  const [damageRateInput, setDamageRateInput] = useState<string>('0.5');
  const [appliedDamageConfig, setAppliedDamageConfig] = useState<DamageDonationConfig>({
    enabled: false,
    ratePer1k: 0.5,
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize API Key from storage
  useEffect(() => {
    const savedKey = storage.getApiKey();
    setApiKey(savedKey);
  }, []);

  // Load countries on startup
  useEffect(() => {
    async function loadCountryList() {
      try {
        const list = await getCountries();
        setCountries(list);
        if (list.length > 0 && !selectedCountry) {
          // Default to Colombia (or first country)
          const col = list.find((c) => c.name.toLowerCase() === 'colombia' || c.code === 'co');
          setSelectedCountry(col || list[0]);
        }
      } catch (err) {
        console.error('Failed to load countries:', err);
      }
    }
    loadCountryList();
  }, []);

  // Sync execution
  const executeSync = useCallback(
    async (country: WareraCountry, currentKey: string) => {
      setIsSyncing(true);
      setSyncError(null);

      try {
        const result = await syncCountryData(
          country._id,
          country.name,
          currentKey,
          (progress) => setSyncProgress(progress)
        );

        setTransactions(result.transactions);
        setCumulative(result.cumulative);
        setIsGranularActive(result.isGranular);
        setUsersMap((prev) => ({ ...prev, ...result.users }));
      } catch (err: any) {
        setSyncError(err?.message || 'Sync failed');
        // Fallback to cached
        const cachedTx = await storage.getTransactionsByCountry(country._id);
        const cachedCum = await storage.getCumulativeDonationsByCountry(country._id);
        const cachedUsers = await storage.getAllUsers();
        setTransactions(cachedTx);
        setCumulative(cachedCum);
        setIsGranularActive(cachedTx.length > 0);
        setUsersMap(cachedUsers);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncProgress(null), 3500);
      }
    },
    []
  );

  // Sync whenever country changes or API key updates
  useEffect(() => {
    if (selectedCountry?._id) {
      executeSync(selectedCountry, apiKey);
    }
  }, [selectedCountry?._id, apiKey, executeSync]);

  const handleManualSync = () => {
    if (selectedCountry) {
      executeSync(selectedCountry, apiKey);
    }
  };

  const handleSaveApiKey = (newKey: string) => {
    storage.setApiKey(newKey);
    setApiKey(newKey);
  };

  const setPresetDays = (days: number) => {
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setCustomRange({ startDate: start, endDate: todayStr });
  };

  const setThisMonth = () => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    setCustomRange({ startDate: firstDay, endDate: todayStr });
  };

  // Compute rankings with optional War Mode combat damage conversion
  const summary = useMemo(() => {
    // 1. If timeframe is 'all', always use the complete All-Time cumulative ledger
    if (timeframe === 'all' && cumulative.length > 0) {
      return calculateCumulativeRankings(cumulative, usersMap, appliedDamageConfig, 'all');
    }

    // 2. For Daily, Weekly, Monthly, and Custom Range, use the granular transaction stream
    if (isGranularActive && transactions.length > 0) {
      return calculateGranularRankings(
        transactions,
        usersMap,
        timeframe,
        customRange,
        appliedDamageConfig
      );
    }

    // 3. If no API key or no granular data, fallback to cumulative ledger with active timeframe
    if (cumulative.length > 0) {
      return calculateCumulativeRankings(cumulative, usersMap, appliedDamageConfig, timeframe, customRange);
    }

    return {
      timeframe,
      startDate: '',
      endDate: new Date().toISOString(),
      totalDonors: 0,
      totalAmountDonated: 0,
      totalDirectDonated: 0,
      totalDamageDonated: 0,
      averageDonationAmount: 0,
      leaderboard: [],
      isGranular: false,
      damageConfig: appliedDamageConfig,
    };
  }, [timeframe, customRange, isGranularActive, transactions, cumulative, usersMap, appliedDamageConfig]);

  const [isCalculatingDamage, setIsCalculatingDamage] = useState<boolean>(false);

  // Handle calculating new rankings with damage donations config
  const handleCalculateNewRankings = async () => {
    const parsedRate = Math.max(0, parseFloat(damageRateInput) || 0);

    if (includeDamage && parsedRate > 0) {
      setIsCalculatingDamage(true);
      try {
        // Also fetch national citizens if selectedCountry exists to include pure fighters
        let citizenIds: string[] = [];
        if (selectedCountry?._id) {
          citizenIds = await fetchCountryCitizens(selectedCountry._id);
        }

        // Collect all distinct user IDs from the active dataset and national citizens
        const relevantUserIds = Array.from(
          new Set([
            ...transactions.map((t) => t.userId).filter(Boolean),
            ...cumulative.map((c) => c.userId).filter(Boolean),
            ...citizenIds,
          ])
        ) as string[];

        // Hydrate combat damage stats from user.getUserLite for any missing
        const updatedUsers = await ensureDonorsDamageStats(relevantUserIds);
        setUsersMap((prev) => ({ ...prev, ...updatedUsers }));
      } catch (err) {
        console.error('Failed to ensure damage stats:', err);
      } finally {
        setIsCalculatingDamage(false);
      }
    }

    setAppliedDamageConfig({
      enabled: includeDamage,
      ratePer1k: parsedRate,
    });
  };

  const isDamageConfigDirty =
    includeDamage !== appliedDamageConfig.enabled ||
    (includeDamage && (parseFloat(damageRateInput) || 0) !== appliedDamageConfig.ratePer1k);

  // Selected donor for modal drill-down
  const selectedDonor: DonorRankingItem | null = useMemo(() => {
    if (!selectedDonorId) return null;
    return (
      summary.leaderboard.find((d) => d.userId === selectedDonorId) || null
    );
  }, [selectedDonorId, summary.leaderboard]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectCountry={(c) => setSelectedCountry(c)}
        isSyncing={isSyncing}
        onSync={handleManualSync}
        isOnline={isOnline}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Offline Banner if disconnected */}
        {!isOnline && (
          <div className="mb-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline Mode:</strong> Viewing cached donation records from local storage.
              </span>
            </div>
            <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded font-bold">
              Cached locally
            </span>
          </div>
        )}

        {/* API Key Status Notice */}
        {!apiKey && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="text-white block text-sm">Unlock True Daily (24h) & Weekly (7d) Transaction Logs</strong>
                <span>
                  Currently viewing public all-time cumulative sums. To view exact individual donation receipts (e.g. 10 BTC) and accurate daily totals, connect your War Era API Token.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                // Focus header key button or trigger key modal
                const btn = document.querySelector('header button[title*="API Token"]') as HTMLButtonElement;
                btn?.click();
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shrink-0 shadow-md shadow-amber-500/20"
            >
              Connect API Token
            </button>
          </div>
        )}

        {/* Active Granular Mode Indicator */}
        {apiKey && isGranularActive && (
          <div className="mb-6 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Granular Transaction Stream Active:</strong> Displaying exact individual donation receipts and precise Daily, Weekly, and Monthly rollups.
              </span>
            </div>
            <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded font-bold text-emerald-300">
              {transactions.length} Verified Receipts
            </span>
          </div>
        )}

        {/* Live Sync Progress Indicator */}
        {syncProgress && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                {syncProgress.message}
              </span>
              <span className="font-mono text-slate-400 font-semibold">
                {syncProgress.fetchedItems} items loaded
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  syncProgress.status === 'error'
                    ? 'bg-rose-500 w-full'
                    : syncProgress.status === 'completed'
                    ? 'bg-emerald-500 w-full'
                    : 'bg-amber-400 w-3/4 animate-pulse'
                }`}
              />
            </div>
            {syncError && (
              <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{syncError}</span>
              </div>
            )}
          </div>
        )}

        {/* Period Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-slate-900/60 border border-slate-800/80 p-3 sm:p-4 rounded-2xl">
          {/* Timeframe Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTimeframe('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                timeframe === 'daily'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Daily (24h)</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeframe('weekly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                timeframe === 'weekly'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly (7d)</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeframe('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                timeframe === 'monthly'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Monthly (30d)</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                timeframe === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All-Time</span>
            </button>

            {/* Extra Tab: Custom Range */}
            <button
              type="button"
              onClick={() => setTimeframe('custom')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                timeframe === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Custom Range</span>
            </button>
          </div>

          {/* Right Action: Export Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-sm"
              title="Export leaderboard to Discord or CSV"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Inline Custom Date Range Picker Toolbar */}
        {timeframe === 'custom' && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Start Date:</label>
                <input
                  type="date"
                  value={customRange.startDate}
                  max={customRange.endDate}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">End Date:</label>
                <input
                  type="date"
                  value={customRange.endDate}
                  min={customRange.startDate}
                  max={todayStr}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setPresetDays(14)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                Last 14d
              </button>
              <button
                type="button"
                onClick={() => setPresetDays(30)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={() => setPresetDays(60)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                Last 60d
              </button>
              <button
                type="button"
                onClick={setThisMonth}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                This Month
              </button>
            </div>
          </div>
        )}

        {/* War Mode & Damage Donations Control Card */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Checkbox: Include Damage Donations */}
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={includeDamage}
                onChange={(e) => setIncludeDamage(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <Swords
                  className={`w-4 h-4 transition ${
                    includeDamage ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                />
                <span className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                  Include Damage Donations (War Mode)
                </span>
                {appliedDamageConfig.enabled && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                    Active: {appliedDamageConfig.ratePer1k} BTC / 1k dmg
                  </span>
                )}
              </div>
            </label>

            <span className="text-xs text-slate-400">
              Optionally add citizen combat damage in this timeframe to rankings as money.
            </span>
          </div>

          {/* Conditional Box: Appears when box is checked */}
          {includeDamage && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                    BTC per 1k damage:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={damageRateInput}
                      onChange={(e) => setDamageRateInput(e.target.value)}
                      placeholder="0.5"
                      className="w-32 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1.5 text-[11px] text-slate-500 font-mono">
                      BTC
                    </span>
                  </div>
                </div>

                {/* Quick Presets for conversion rate */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Presets:
                  </span>
                  {[0.1, 0.25, 0.5, 1.0, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDamageRateInput(preset.toString())}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition border ${
                        damageRateInput === preset.toString()
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action: Calculate new rankings */}
              <div className="flex items-center gap-3 shrink-0">
                {isDamageConfigDirty && !isCalculatingDamage && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold animate-pulse">
                    <Sparkles className="w-3 h-3" /> Changes pending
                  </span>
                )}
                <button
                  type="button"
                  disabled={isCalculatingDamage}
                  onClick={handleCalculateNewRankings}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition shadow-lg ${
                    isCalculatingDamage
                      ? 'bg-amber-600 text-slate-950 opacity-90 cursor-wait'
                      : isDamageConfigDirty
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-400/50 scale-[1.02]'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isCalculatingDamage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Calculator className="w-4 h-4" />
                  )}
                  <span>
                    {isCalculatingDamage
                      ? 'Calculating & Hydrating Combat Stats...'
                      : 'Calculate new rankings'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Formula preview and audit explanation note */}
          {includeDamage && (
            <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between flex-wrap gap-2 font-mono">
              <span className="text-slate-300">
                Formula: <strong className="text-white">(Damage ÷ 1,000) × {damageRateInput || '0'} BTC</strong> added to citizen donations for {timeframe}.
              </span>
              <span className="text-amber-400/90">
                Audits clearly display Direct BTC vs. Combat Damage BTC breakdown.
              </span>
            </div>
          )}
        </div>

        {/* Aggregate KPI Summary Stats */}
        <RankingStats
          summary={summary}
          countryName={selectedCountry?.name || 'Selected Country'}
          onSelectDonor={(uid) => setSelectedDonorId(uid)}
        />

        {/* Visual Top-3 Podium */}
        {summary.leaderboard.length >= 2 && (
          <Podium
            topDonors={summary.leaderboard.slice(0, 3)}
            onSelectDonor={(uid) => setSelectedDonorId(uid)}
          />
        )}

        {/* Detailed Leaderboard Table with All Donors */}
        <LeaderboardTable
          leaderboard={summary.leaderboard}
          totalAmountDonated={summary.totalAmountDonated}
          onSelectDonor={(uid) => setSelectedDonorId(uid)}
          timeframe={
            timeframe === 'daily'
              ? 'Today (Past 24 Hours)'
              : timeframe === 'weekly'
              ? 'This Week (Past 7 Days)'
              : timeframe === 'monthly'
              ? 'This Month (Past 30 Days)'
              : timeframe === 'custom'
              ? `Custom Window (${customRange.startDate} to ${customRange.endDate})`
              : 'All-Time Record'
          }
        />
      </main>

      {/* Citizen Drill-down Audit Modal */}
      {selectedDonorId && (
        <CitizenDetailModal
          donor={selectedDonor}
          onClose={() => setSelectedDonorId(null)}
          countryName={selectedCountry?.name || 'Country'}
        />
      )}

      {/* Export Report Modal */}
      {isExportOpen && (
        <ExportModal
          summary={summary}
          countryName={selectedCountry?.name || 'Country'}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-400">WAR<span className="text-amber-500">ERA</span></span>
            <span>Live Country BTC Donation Rankings</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-400 font-mono">
              Individual Transaction Engine • War Era tRPC
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
