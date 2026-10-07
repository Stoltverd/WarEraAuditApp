import React, { useState, useEffect, useMemo } from 'react';
import {
  CitizenEconomicProfile,
  LeechTier,
  PlaystyleMode,
  PlayerTag,
  MinisterialMessage,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
} from '../../types/ministry';
import { sanitizePolicyConfig } from '../../services/storage';
import { generateMinisterialNudge } from '../../services/ministryService';
import { CitizenCalculationExplainerModal } from './CitizenCalculationExplainerModal';
import { GrossIncomeBreakdownModal } from './GrossIncomeBreakdownModal';
import {
  Search,
  Filter,
  Copy,
  Check,
  Shield,
  Coins,
  Swords,
  Sprout,
  Scale,
  AlertTriangle,
  Send,
  X,
  Tag,
  ChevronDown,
  Info,
  SlidersHorizontal,
  Clock,
  Settings,
  Users,
  Eye,
  EyeOff,
  Calculator,
  Loader2,
  HelpCircle,
  RotateCcw,
  Award,
  Package,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

interface CitizenRadarProps {
  profiles: CitizenEconomicProfile[];
  countryName: string;
  config?: MinistryConfig;
  watchedUserIds?: Set<string>;
  onUpdateConfig?: (cfg: MinistryConfig) => void;
  onUpdateTag: (userId: string, tag: PlayerTag, notes?: string) => void;
  onPutOnWatch?: (profile: CitizenEconomicProfile, reasonNote: string) => void;
  onRemoveFromWatch?: (userId: string) => void;
  onRunIncomeAudit?: () => void;
  isAuditing?: boolean;
  onOpenBackup?: () => void;
  apiKey?: string;
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
}

export const CitizenRadar: React.FC<CitizenRadarProps> = ({
  profiles,
  countryName,
  config = DEFAULT_MINISTRY_CONFIG,
  watchedUserIds = new Set(),
  onUpdateConfig,
  onUpdateTag,
  onPutOnWatch,
  onRemoveFromWatch,
  onRunIncomeAudit,
  isAuditing = false,
  onOpenBackup,
  apiKey,
  onUpdateProfile,
}) => {
  const [search, setSearch] = useState('');
  const [filterPlaystyle, setFilterPlaystyle] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [onlyInactiveDonors, setOnlyInactiveDonors] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [showPolicyHelp, setShowPolicyHelp] = useState<boolean>(false);
  const [showBaselineBanner, setShowBaselineBanner] = useState<boolean>(true);
  const [policyDraft, setPolicyDraft] = useState<MinistryConfig>(() => sanitizePolicyConfig(config));

  // Sync draft whenever config prop updates or modal opens
  useEffect(() => {
    setPolicyDraft(sanitizePolicyConfig(config));
  }, [config, isPolicyModalOpen]);

  // Validate threshold hierarchy: Patriot > Moderate > Low for all playstyles
  const isGeneralValid =
    (policyDraft.patriotIncomeRatePct ?? 15) > (policyDraft.moderateIncomeRatePct ?? 7) &&
    (policyDraft.moderateIncomeRatePct ?? 7) > (policyDraft.lowContributorIncomeRatePct ?? 2.5);

  const isWarValid =
    (policyDraft.warPatriotRatePct ?? 6) > (policyDraft.warModerateRatePct ?? 2.5) &&
    (policyDraft.warModerateRatePct ?? 2.5) > (policyDraft.warLowRatePct ?? 1);

  const isEcoValid =
    (policyDraft.ecoPatriotRatePct ?? 15) > (policyDraft.ecoModerateRatePct ?? 7) &&
    (policyDraft.ecoModerateRatePct ?? 7) > (policyDraft.ecoLowRatePct ?? 2.5);

  const isPolicyValid = isGeneralValid && isWarValid && isEcoValid;

  const [activeNudgeProfile, setActiveNudgeProfile] = useState<CitizenEconomicProfile | null>(null);
  const [selectedExplainerProfile, setSelectedExplainerProfile] = useState<CitizenEconomicProfile | null>(null);
  const [selectedIncomeBreakdownProfile, setSelectedIncomeBreakdownProfile] = useState<CitizenEconomicProfile | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Watchlist modal state
  const [watchTargetProfile, setWatchTargetProfile] = useState<CitizenEconomicProfile | null>(null);
  const [watchNoteDraft, setWatchNoteDraft] = useState<string>('');

  // Active citizens counts (all profiles in radar are verified level 10+ active citizens)
  const activeCount = profiles.length;
  const inactiveDonorCount = useMemo(() => {
    return profiles.filter((p) => p.isInactiveDonor).length;
  }, [profiles]);

  // Filtered and sorted profiles (memoized to prevent redundant sorting and layout recalculations)
  const filtered = useMemo(() => {
    const list = profiles.filter((p) => {
      if (onlyInactiveDonors && !p.isInactiveDonor) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.username.toLowerCase().includes(q) && !p.userId.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterPlaystyle !== 'all' && p.playstyle !== filterPlaystyle) return false;
      if (filterTier !== 'all' && p.leechTier !== filterTier) return false;
      if (filterVerdict !== 'all') {
        const v = p.ministerialVerdict || p.playerCashflow?.ministerialVerdict;
        if (v !== filterVerdict) return false;
      }
      if (filterTag !== 'all' && p.manualTag !== filterTag) return false;
      return true;
    });

    return [...list].sort((a, b) => b.wealthBtc - a.wealthBtc);
  }, [profiles, onlyInactiveDonors, search, filterPlaystyle, filterTier, filterVerdict, filterTag]);

  // Single-pass computation for fast KPI metrics
  const { criticalLeechCount, inactiveCount, ecoCount, warCount, hybridCount } = useMemo(() => {
    let criticalLeechCount = 0;
    let inactiveCount = 0;
    let ecoCount = 0;
    let warCount = 0;
    let hybridCount = 0;

    for (const p of filtered) {
      if (p.leechTier === 'critical-leech') criticalLeechCount++;
      if (p.isInactiveDonor) inactiveCount++;
      if (p.playstyle === 'pure-eco') ecoCount++;
      else if (p.playstyle === 'pure-war') warCount++;
      else if (p.playstyle === 'hybrid') hybridCount++;
    }

    return { criticalLeechCount, inactiveCount, ecoCount, warCount, hybridCount };
  }, [filtered]);

  // Memoized verdict category counts
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'slacker-evader': 0,
      'subsistence-worker': 0,
      'illiquid-asset-rich': 0,
      'patriotic-fulfiller': 0,
    };
    for (const p of profiles) {
      const v = p.ministerialVerdict || p.playerCashflow?.ministerialVerdict;
      if (v && counts[v] !== undefined) {
        counts[v]++;
      }
    }
    return counts;
  }, [profiles]);

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizePolicyConfig(policyDraft);
    onUpdateConfig?.(sanitized);
    setIsPolicyModalOpen(false);
  };

  const handleOpenWatchModal = (c: CitizenEconomicProfile) => {
    setWatchTargetProfile(c);
    setWatchNoteDraft(c.notes || 'Flagged for surveillance: low contribution ratio relative to income growth.');
  };

  const handleSaveWatchTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchTargetProfile) return;
    onPutOnWatch?.(watchTargetProfile, watchNoteDraft.trim());
    setWatchTargetProfile(null);
    setWatchNoteDraft('');
  };

  const messages: MinisterialMessage[] = activeNudgeProfile
    ? generateMinisterialNudge(activeNudgeProfile, countryName, 'MoE', config.analysisPeriodDays || 7)
    : [];

  return (
    <div className="space-y-6">
      {/* Prominent Ministerial Directive Banner & Policy Calibration Entry Point */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Sovereign Citizen &amp; Leech Radar — {countryName}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wider">
              Economy Ministry
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time income growth audits, patriotic quotas, and diplomatic treasury alerts for {countryName}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPolicyDraft(sanitizePolicyConfig(config));
              setIsPolicyModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition active:scale-95 shadow-md shadow-amber-500/10"
            title="Calibrate Sovereign Contribution Thresholds & Leech Ratios"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-950" />
            <span>Policy Calibration &amp; Quotas</span>
          </button>
        </div>
      </div>
      {/* Executive KPI Summary for Economy Minister */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Monitored Net Worth
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {activeCount} Active (Lvl 10+)
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {formatBtc(filtered.reduce((acc, p) => acc + p.wealthBtc, 0))} <span className="text-xs text-amber-400 font-bold">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Active citizens in {countryName} (level 10+ verified)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Critical Leeches Flagged
          </div>
          <div className="text-2xl font-black font-mono text-red-400">
            {criticalLeechCount}
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Contributing under {config.lowContributorIncomeRatePct ?? 5}% of BTC income growth ({config.analysisPeriodDays ?? 7}D window)
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Inactive Donors (&gt;7d)
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {inactiveCount}
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Active citizens with no treasury contribution in 7+ days
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" /> Eco vs War Stance
          </div>
          <div className="text-xl font-black font-mono text-white flex items-center gap-2">
            <span className="text-emerald-400 font-bold">{ecoCount} 🌾</span>
            <span className="text-slate-500">/</span>
            <span className="text-red-400 font-bold">{warCount} ⚔️</span>
            <span className="text-slate-500">/</span>
            <span className="text-amber-400 font-bold">{hybridCount} ⚖️</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Pure Eco / Pure War / Hybrid citizens</div>
        </div>
      </div>

      {/* Control Bar: Filters, Audit Trigger, Search & Policy Calibration Button */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search citizen username or ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Continuous 7-Day Income Audit Disclaimer & Status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs shadow-inner">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>7-Day Continuous Audit Active</span>
            </div>
            <span className="text-cyan-700 hidden lg:inline">•</span>
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Auto-computed on country switch &amp; donor sync
            </span>
            {onRunIncomeAudit && (
              <button
                type="button"
                onClick={onRunIncomeAudit}
                disabled={isAuditing}
                title="Force refresh 7-day income growth audit"
                className="ml-auto p-1 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-900/40 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Inactive Donor Alert Toggle */}
          <label className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold cursor-pointer select-none transition ${
            onlyInactiveDonors
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={onlyInactiveDonors}
              onChange={(e) => setOnlyInactiveDonors(e.target.checked)}
              className="rounded accent-amber-500 w-3.5 h-3.5"
            />
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>&gt;7d Inactive Donors ({inactiveDonorCount})</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Playstyle Filter */}
          <select
            value={filterPlaystyle}
            onChange={(e) => setFilterPlaystyle(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            <option value="all">All Playstyles</option>
            <option value="pure-eco">🌾 Pure Eco Mode</option>
            <option value="pure-war">⚔️ Pure War Mode</option>
            <option value="hybrid">⚖️ Hybrid Mode</option>
          </select>

          {/* Leech Status Filter */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            <option value="all">All Contribution Ratios</option>
            <option value="critical-leech">🔴 Critical Leeches</option>
            <option value="low-contributor">🟡 Low Contributors</option>
            <option value="moderate">⚪ Moderate Donors</option>
            <option value="sovereign-patriot">🟢 Model Patriots</option>
            <option value="historical-pillar">🏛️ Historical Pillars</option>
            <option value="combat-veteran">⚔️ Combat Heroes</option>
          </select>

          {/* Ministerial Audit Status Filter */}
          <select
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-cyan-500 transition cursor-pointer"
          >
            <option value="all">All Ministerial Audits</option>
            <option value="slacker-evader">🚨 Identified Slackers (Evaders)</option>
            <option value="subsistence-worker">🛡️ Subsistence Workers (Exempt)</option>
            <option value="illiquid-asset-rich">🔒 Illiquid Combatants</option>
            <option value="patriotic-fulfiller">💎 Patriotic Fulfillers</option>
            <option value="moderate-contributor">🔵 Moderate Contributors</option>
            <option value="exempted-recruit">🌱 New Recruits (&lt; Lvl 15)</option>
          </select>

          {/* Tag Filter */}
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            <option value="all">All Tags</option>
            <option value="perma-war">Perma War</option>
            <option value="perma-eco">Perma Eco</option>
            <option value="mixed-style">Mixed Style</option>
            <option value="mercenary">Mercenary</option>
            <option value="vip">VIP</option>
          </select>

          {/* Policy Calibration Button */}
          <button
            type="button"
            onClick={() => {
              setPolicyDraft(sanitizePolicyConfig(config));
              setIsPolicyModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            title="Configure High Wealth Threshold & Fair Share Tax Rates"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>Policy Calibration</span>
          </button>
        </div>
      </div>

      {/* Day-1 Baseline Audit Notice Banner */}
      {showBaselineBanner && profiles.some((p) => p.auditBaselineStatus === 'baseline-today') && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/50 text-xs text-cyan-200 flex items-start justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-cyan-300 block">
                Continuous Fiscal Audit Active — Day-1 Provisional Baseline
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Because this is the initial audit run without prior 7-day wealth snapshots, gross income is deduced from <strong>recent player market transactions (net sales margin)</strong>, <strong>company engine capacity</strong>, and <strong>direct treasury donations</strong>. Daily wealth snapshots are now continuously recorded to establish verified historical deltas. Click &quot;Audit&quot; on any citizen to inspect their individual cashflow and capacity breakdown.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBaselineBanner(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Audit Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterVerdict('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            filterVerdict === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All Citizens ({profiles.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterVerdict('slacker-evader')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            filterVerdict === 'slacker-evader'
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-slate-900 text-red-400 hover:bg-red-950/40 border border-red-900/40'
          }`}
        >
          🚨 Identified Slackers ({verdictCounts['slacker-evader'] || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterVerdict('subsistence-worker')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            filterVerdict === 'subsistence-worker'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-slate-900 text-blue-400 hover:bg-blue-950/40 border border-blue-900/40'
          }`}
        >
          🛡️ Subsistence Workers ({verdictCounts['subsistence-worker'] || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterVerdict('illiquid-asset-rich')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            filterVerdict === 'illiquid-asset-rich'
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-slate-900 text-purple-400 hover:bg-purple-950/40 border border-purple-900/40'
          }`}
        >
          🔒 Illiquid Combatants ({verdictCounts['illiquid-asset-rich'] || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilterVerdict('patriotic-fulfiller')}
          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            filterVerdict === 'patriotic-fulfiller'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-emerald-400 hover:bg-emerald-950/40 border border-emerald-900/40'
          }`}
        >
          💎 Generous Patriots ({verdictCounts['patriotic-fulfiller'] || 0})
        </button>
      </div>

      {/* Citizen Economic Radar Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full min-w-[960px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Citizen</th>
              <th className="py-3.5 px-4 text-right">Net Worth (BTC)</th>
              <th className="py-3.5 px-4 text-right">Est. 7D Gross Income</th>
              <th className="py-3.5 px-4 text-right">Total Donated (BTC)</th>
              <th className="py-3.5 px-4 text-center">Leech / Contribution Ratio</th>
              <th className="py-3.5 px-4 text-center">Skill Mode &amp; Build</th>
              <th className="py-3.5 px-4 text-center">Minister Tag</th>
              <th className="py-3.5 px-4 text-right">Diplomatic Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 text-xs font-sans">
                  No citizens match the active filters in {countryName}.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isPillar = c.leechTier === 'historical-pillar';
                const isCombatVeteran = c.leechTier === 'combat-veteran';
                const isLeech = c.leechTier === 'critical-leech';
                const isLow = c.leechTier === 'low-contributor';
                const isPatriot = c.leechTier === 'sovereign-patriot';

                return (
                  <tr key={c.userId} className="hover:bg-slate-800/40 transition group">
                    {/* Citizen Avatar & Username */}
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => setSelectedExplainerProfile(c)}
                          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-300 text-xs cursor-pointer hover:border-cyan-400 transition"
                          title="Click to view economic audit breakdown"
                        >
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.username} className="w-full h-full object-cover" />
                          ) : (
                            c.username.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="truncate max-w-[150px] sm:max-w-[220px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedExplainerProfile(c)}
                              className="font-bold text-white hover:text-cyan-400 transition truncate text-xs inline-flex items-center gap-1 text-left"
                              title="Click to inspect contribution ratio formula and in-game comparison"
                            >
                              <span>{c.username}</span>
                              <HelpCircle className="w-3 h-3 text-cyan-400 shrink-0 opacity-70 hover:opacity-100" />
                            </button>
                            {c.isHistoricalTopDonor && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold font-mono flex items-center gap-0.5"
                                title={`Top ${c.historicalRank ? `#${c.historicalRank}` : '10'} Lifetime Donor of nation`}
                              >
                                ⭐ Top {c.historicalRank ? `#${c.historicalRank}` : '10'}
                              </span>
                            )}
                            {c.isInactiveDonor && !c.isHistoricalTopDonor && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold font-mono"
                                title={`Has not donated in ${c.daysSinceLastDonation} days`}
                              >
                                ⚠️ &gt;7d inactive
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            ID: {c.userId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Net Worth (Clickable Audit Breakdown) */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedIncomeBreakdownProfile(c)}
                        className="group/nw text-right hover:bg-slate-800/60 p-1.5 rounded-xl transition border border-transparent hover:border-slate-700 inline-block"
                        title="Click to view full asset portfolio & income audit calculation"
                      >
                        <div className="font-bold text-slate-200 text-sm group-hover/nw:text-amber-300">
                          {formatBtc(c.wealthBtc)}
                        </div>
                        <span className="text-[10px] text-slate-500 font-sans group-hover/nw:text-amber-400 block">
                          assets in game
                        </span>
                      </button>
                    </td>

                    {/* Est. 7D Gross Income (Clickable Calculation Breakdown) */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <button
                        type="button"
                        onClick={() => setSelectedIncomeBreakdownProfile(c)}
                        className="group/inc text-right hover:bg-cyan-950/40 p-1.5 rounded-xl transition border border-transparent hover:border-cyan-800/60 inline-block"
                        title="Click to inspect how this income was calculated: wages, market sales, expenses, and margin"
                      >
                        <div className="font-bold text-cyan-300 text-sm flex items-center justify-end gap-1.5 group-hover/inc:text-cyan-200">
                          <span>{formatBtc(c.grossIncomeBtc || 0)}</span>
                          <Calculator className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover/inc:opacity-100" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-sans group-hover/inc:text-cyan-400 block">
                          {c.playerCashflow?.dataSource === 'live-ledger' ? 'verified receipts' : 'baseline turnover'}
                        </span>
                      </button>
                    </td>

                    {/* Total Donated */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-amber-400 text-sm">
                        {formatBtc(c.totalDonatedBtc)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {c.lastDonationAt ? (
                          <span>Last: {new Date(c.lastDonationAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-red-400">0 donation events</span>
                        )}
                      </div>
                      {typeof c.damageValueBtc === 'number' && c.damageValueBtc > 0 && (
                        <div className="text-[9px] text-red-300 font-mono font-bold mt-0.5" title="Converted combat defense credit">
                          +{c.damageValueBtc.toFixed(1)} BTC combat
                        </div>
                      )}
                    </td>

                    {/* Leech Ratio & Tier */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPillar
                              ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50 shadow-sm shadow-amber-500/10'
                              : isCombatVeteran
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : isLeech
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isPatriot
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isPillar
                            ? '🏛️ Historical Pillar'
                            : isCombatVeteran
                            ? '⚔️ Combat Hero'
                            : isLeech
                            ? '🚨 Critical Leech'
                            : isLow
                            ? 'Low Contributor'
                            : isPatriot
                            ? '🌟 Model Patriot'
                            : 'Moderate'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-300">
                          {c.contributionRatio}% ratio
                        </span>
                        {/* Ministerial Verdict Badge */}
                        {(() => {
                          const v = c.ministerialVerdict || c.playerCashflow?.ministerialVerdict;
                          if (!v) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => setSelectedIncomeBreakdownProfile(c)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border transition hover:opacity-80 ${
                                v === 'slacker-evader'
                                  ? 'bg-red-950/60 text-red-300 border-red-700/60'
                                  : v === 'subsistence-worker'
                                  ? 'bg-blue-950/60 text-blue-300 border-blue-700/60'
                                  : v === 'illiquid-asset-rich'
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-700/60'
                                  : v === 'patriotic-fulfiller'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                              title={c.ministerialVerdictReason || c.playerCashflow?.ministerialVerdictReason || 'Click for audit details'}
                            >
                              {v === 'slacker-evader'
                                ? '🚨 Evader / Slacker'
                                : v === 'subsistence-worker'
                                ? '🛡️ Subsistence Worker'
                                : v === 'illiquid-asset-rich'
                                ? '🔒 Illiquid Assets'
                                : v === 'patriotic-fulfiller'
                                ? '💎 Generous Patriot'
                                : '🔵 Active Worker'}
                            </button>
                          );
                        })()}
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          c.auditBaselineStatus === 'audited'
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                        }`}>
                          {c.auditBaselineStatus === 'audited' ? '7D Verified' : 'Day-1 Baseline'}
                        </span>
                      </div>
                    </td>

                    {/* Playstyle Mode & Build Tenure */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-semibold flex items-center gap-1 text-slate-300">
                          {c.playstyle === 'pure-eco' ? (
                            <>
                              <Sprout className="w-3.5 h-3.5 text-emerald-400" /> Eco Mode
                            </>
                          ) : c.playstyle === 'pure-war' ? (
                            <>
                              <Swords className="w-3.5 h-3.5 text-red-400" /> War Mode
                            </>
                          ) : (
                            <>
                              <Scale className="w-3.5 h-3.5 text-amber-400" /> Hybrid
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {c.ecoSkillPoints} eco · {c.warSkillPoints} war
                        </span>
                        {typeof c.daysInBuild === 'number' && c.daysInBuild >= 0 && (
                          <span className="text-[9px] text-cyan-400 font-mono bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            {c.daysInBuild}d in build
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Minister Tag & Notes */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      <div className="relative inline-block text-left">
                        <select
                          value={c.manualTag}
                          onChange={(e) => onUpdateTag(c.userId, e.target.value as PlayerTag, c.notes)}
                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-semibold text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="none">No Tag</option>
                          <option value="perma-war">Perma War</option>
                          <option value="perma-eco">Perma Eco</option>
                          <option value="mixed-style">Mixed Style</option>
                          <option value="mercenary">Mercenary</option>
                          <option value="vip">VIP</option>
                        </select>
                      </div>
                    </td>

                    {/* Diplomatic & Watch Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedExplainerProfile(c)}
                          className="px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 font-semibold rounded-xl text-xs transition active:scale-95 inline-flex items-center gap-1"
                          title="Click to view detailed formula, liquid BTC vs wealth, and why citizen received this classification"
                        >
                          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="hidden sm:inline">Audit</span>
                        </button>

                        {watchedUserIds.has(c.userId) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenWatchModal(c)}
                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs transition active:scale-95 inline-flex items-center gap-1"
                            title="Citizen currently on watch. Click to view/edit surveillance note."
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">On Watch</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenWatchModal(c)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold rounded-xl text-xs transition active:scale-95 inline-flex items-center gap-1"
                            title="Place citizen on watch list with surveillance note"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span className="hidden sm:inline">Watch</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveNudgeProfile(c)}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                          title="Generate pre-formatted in-game telegram"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Nudge</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Ministerial Policy Threshold Calibration */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sovereign Policy &amp; Leech Calibration</h3>
                  <p className="text-xs text-slate-400">Customizable income donation ratios by playstyle for {countryName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyHelp((prev) => !prev)}
                  className="text-xs text-amber-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                  title="Toggle Policy Guide & Rules"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{showPolicyHelp ? 'Hide Guide' : 'Policy Guide'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Comprehensive Help & Calibration Guide Drawer */}
            {showPolicyHelp && (
              <div className="mt-4 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-slate-300 space-y-2.5 animate-fade-in">
                <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>How Policy Calibration Works in War Era</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <strong>Income Quotas (%):</strong> Set the minimum percentage of weekly BTC earnings a citizen must donate to earn each tier. For example, a Patriot quota of 15% means a citizen earning 1,000 BTC must donate &ge;150 BTC to receive Model Patriot status.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <strong>Playstyle Roles:</strong> Soldiers fighting on the frontlines in <strong>War Mode</strong> spend heavily on tanks and munitions; their quotas are lower (e.g. 5% Patriot / 2.5% Moderate / 1% Low). Industrialists in <strong>Eco Mode</strong> reap passive company dividends; their quotas are higher (e.g. 15% / 10% / 5%).
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <strong>Veteran Grace Floor:</strong> Citizens ranked in the nation&apos;s Top Lifetime Donors who meet this lifetime contribution floor are honored as Historical Pillars and protected from Critical Leech designation during active military campaigns.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  <strong>Immediate Effect:</strong> Saving your policy updates recalculates citizen audits and contribution ratios instantly!
                </p>
              </div>
            )}

            {!isPolicyValid && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>Invalid Quota Hierarchy:</strong> Quotas must satisfy <strong>Patriot &gt; Moderate &gt; Low Contributor</strong> for each playstyle.
                </span>
              </div>
            )}

            <form noValidate onSubmit={handleSavePolicy} className="mt-5 space-y-5 text-xs font-sans">
              {/* Analysis Period */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <label className="block text-slate-300 font-bold mb-1">
                  Analysis Period Window (Days)
                </label>
                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                  Timeframe over which citizen BTC income growth is audited (default: 7 days / 1 week).
                </p>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[1, 3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPolicyDraft((prev) => ({ ...prev, analysisPeriodDays: d }))}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                        policyDraft.analysisPeriodDays === d
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="90"
                  step="1"
                  value={policyDraft.analysisPeriodDays ?? 7}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({
                      ...prev,
                      analysisPeriodDays: Math.max(1, parseInt(e.target.value) || 7),
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Standard General Quotas */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>General Default Income Quotas (%)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-emerald-400 text-[11px] font-bold mb-1">Patriot &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.patriotIncomeRatePct ?? 15}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, patriotIncomeRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-400 text-[11px] font-bold mb-1">Moderate &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.moderateIncomeRatePct ?? 10}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, moderateIncomeRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 text-[11px] font-bold mb-1">Low Contributor &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.lowContributorIncomeRatePct ?? 5}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, lowContributorIncomeRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* War Mode Specific Quotas */}
              <div className="p-3.5 bg-slate-950/70 border border-red-900/30 rounded-2xl space-y-2.5">
                <div className="font-bold text-red-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-red-400" />
                    <span>⚔️ War Mode Quotas (Frontline Combatants)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Spends on munitions &amp; combat</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-emerald-400 text-[11px] font-bold mb-1">War Patriot &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.warPatriotRatePct ?? 5}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, warPatriotRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-400 text-[11px] font-bold mb-1">War Moderate &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.warModerateRatePct ?? 2.5}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, warModerateRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 text-[11px] font-bold mb-1">War Low &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.warLowRatePct ?? 1}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, warLowRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Eco Mode Specific Quotas */}
              <div className="p-3.5 bg-slate-950/70 border border-emerald-900/30 rounded-2xl space-y-2.5">
                <div className="font-bold text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                    <span>🌾 Eco Mode Quotas (Industrialists &amp; Companies)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Higher passive margins</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-emerald-400 text-[11px] font-bold mb-1">Eco Patriot &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.ecoPatriotRatePct ?? 15}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, ecoPatriotRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-400 text-[11px] font-bold mb-1">Eco Moderate &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.ecoModerateRatePct ?? 10}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, ecoModerateRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 text-[11px] font-bold mb-1">Eco Low &ge;</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={policyDraft.ecoLowRatePct ?? 5}
                      onChange={(e) => setPolicyDraft((prev) => ({ ...prev, ecoLowRatePct: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Historical Big Donor Grace Floor */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <label className="block text-amber-300 font-bold mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Historical Big Contributor Grace Floor (BTC)</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Citizens ranked in the nation&apos;s Top Lifetime Donors with cumulative donations &ge; this floor are honored as <strong>Historical Pillars</strong> and protected from being classified as critical leeches during military mobilization.
                </p>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={policyDraft.historicalDonorGraceThresholdBtc ?? 500}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({
                      ...prev,
                      historicalDonorGraceThresholdBtc: Math.max(0, parseFloat(e.target.value) || 0),
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-400"
                />
              </div>

              {/* Top Historical Donors Protection */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <label className="block text-amber-300 font-bold mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Top Lifetime Donors Hall of Fame Protection (Rank)</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Citizens ranked in the nation&apos;s Top X lifetime donors (default: Top 10) are honored as <strong>Historical Pillars</strong> and protected from leech designation even if currently in war munitions mode or inactive.
                </p>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={policyDraft.topHistoricalDonorProtectionRank ?? 10}
                  onChange={(e) =>
                    setPolicyDraft((prev) => ({
                      ...prev,
                      topHistoricalDonorProtectionRank: Math.max(1, parseInt(e.target.value) || 10),
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-400"
                />
              </div>

              {/* Country-Proportional Leech Wealth Percentile Threshold */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <label className="block text-amber-300 font-bold mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>National Wealth Percentile Floor for Critical Leech</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Only citizens in the upper wealth brackets of {countryName} (e.g. Top 25% / 75th percentile) can be classified as Critical Leeches if donating 0. Working-class and modest-wealth citizens are protected as Low Contributors.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Top 50% (Median)', val: 50 },
                    { label: 'Top 25% (P75 - Default)', val: 75 },
                    { label: 'Top 20% (P80)', val: 80 },
                    { label: 'Top 10% (P90)', val: 90 },
                  ].map((tier) => (
                    <button
                      key={tier.val}
                      type="button"
                      onClick={() =>
                        setPolicyDraft((prev) => ({
                          ...prev,
                          leechWealthPercentileCutoff: tier.val,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition border ${
                        (policyDraft.leechWealthPercentileCutoff ?? 75) === tier.val
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Damage to BTC Conversion Toggle & Presets */}
              <div className="p-3.5 bg-slate-950/70 border border-red-950/40 rounded-2xl space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(policyDraft.includeDamageInLeechCalculation)}
                    onChange={(e) =>
                      setPolicyDraft((prev) => ({
                        ...prev,
                        includeDamageInLeechCalculation: e.target.checked,
                      }))
                    }
                    className="mt-0.5 rounded accent-amber-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-red-400" /> Convert Battlefield Damage to Defense Credit
                    </span>
                    <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                      Awards frontline warriors who deal massive combat damage (even with 0 direct BTC donations) with defense contribution credit, recognizing them as Combat Heroes instead of leeches.
                    </span>
                  </div>
                </label>

                {policyDraft.includeDamageInLeechCalculation && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2 pl-6">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300">
                        Conversion Rate (BTC per 1,000 damage dealt):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.001"
                        value={policyDraft.damageConversionRateBtcPer1k ?? 0.08}
                        onChange={(e) =>
                          setPolicyDraft((prev) => ({
                            ...prev,
                            damageConversionRateBtcPer1k: Math.max(0.001, parseFloat(e.target.value) || 0.08),
                          }))
                        }
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs text-right focus:border-amber-400"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Presets:</span>
                      {[0.05, 0.08, 0.09, 0.1, 0.12].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setPolicyDraft((prev) => ({
                              ...prev,
                              damageConversionRateBtcPer1k: preset,
                            }))
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition border ${
                            policyDraft.damageConversionRateBtcPer1k === preset
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-red-900/30 text-[10px] space-y-1">
                      <div className="font-mono text-red-300 font-bold">
                        Formula: (Battlefield Damage ÷ 1,000) × {policyDraft.damageConversionRateBtcPer1k ?? 0.08} BTC
                      </div>
                      <div className="text-slate-400">
                        🛡️ <strong>Playstyle Gating:</strong> Applied to active frontline warriors (Pure-War &amp; Hybrid). Pure-Eco industrialists receive 0 BTC credit to prevent tax evasion through incidental warfare.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Wealth Inclusion Toggle */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(policyDraft.includeResourceWealth)}
                    onChange={(e) =>
                      setPolicyDraft((prev) => ({
                        ...prev,
                        includeResourceWealth: e.target.checked,
                      }))
                    }
                    className="mt-0.5 rounded accent-amber-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block">
                      Include Raw Resource Wealth (Commodities, excluding equipment)
                    </span>
                    <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                      Counts resource stockpiles (iron, lead, oil, bread, narcotics) in donation capacity calculations, as displayed in player stats.
                    </span>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setPolicyDraft(sanitizePolicyConfig(config))}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Reset all thresholds to live country API-calculated defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Country Defaults
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md active:scale-95"
                  >
                    Save &amp; Apply Policy
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Put Citizen On Watch with Custom Observation Note */}
      {watchTargetProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center font-bold text-amber-300 text-sm shrink-0 shadow-inner">
                  {watchTargetProfile.avatarUrl ? (
                    <img src={watchTargetProfile.avatarUrl} alt={watchTargetProfile.username} className="w-full h-full object-cover" />
                  ) : (
                    watchTargetProfile.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Citizens on Watch</h3>
                  <p className="text-xs text-slate-400">Surveillance dossier for <strong className="text-amber-300">{watchTargetProfile.username}</strong> (Level {watchTargetProfile.level})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWatchTargetProfile(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWatchTarget} className="mt-5 space-y-4 text-xs font-sans">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex justify-between">
                <div>
                  <span className="text-slate-500">Net Worth:</span>{' '}
                  <strong className="text-white">{formatBtc(watchTargetProfile.wealthBtc)} BTC</strong>
                </div>
                <div>
                  <span className="text-slate-500">Donations:</span>{' '}
                  <strong className="text-amber-400">{formatBtc(watchTargetProfile.totalDonatedBtc)} BTC</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Surveillance Reason / Observation Note
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5 leading-relaxed">
                  Document why this citizen is placed on watch (e.g. low donation ratio, sudden wealth spike, or failure to contribute).
                </p>
                <textarea
                  rows={3}
                  value={watchNoteDraft}
                  onChange={(e) => setWatchNoteDraft(e.target.value)}
                  placeholder="e.g. Wealth exceeds 5,000 BTC but 0 BTC donated; flagged for periodic auditing."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                {watchedUserIds.has(watchTargetProfile.userId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveFromWatch?.(watchTargetProfile.userId);
                      setWatchTargetProfile(null);
                    }}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold transition flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Remove from Watch
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWatchTargetProfile(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Save to Watchlist
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Diplomatic Nudge Telegram Generator (ZERO AI, 100% Deterministic) */}
      {activeNudgeProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center font-black text-amber-300 text-sm shrink-0 shadow-inner">
                  {activeNudgeProfile.avatarUrl ? (
                    <img src={activeNudgeProfile.avatarUrl} alt={activeNudgeProfile.username} className="w-full h-full object-cover" />
                  ) : (
                    activeNudgeProfile.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Diplomatic Treasury Notice
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pre-formatted in-game telegram for <strong className="text-amber-300">{activeNudgeProfile.username}</strong> (Level {activeNudgeProfile.level})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveNudgeProfile(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center justify-between font-mono">
              <div>
                <span className="text-slate-500">Net Worth:</span>{' '}
                <strong className="text-white">{formatBtc(activeNudgeProfile.wealthBtc)} BTC</strong>
              </div>
              <div>
                <span className="text-slate-500">Donations:</span>{' '}
                <strong className="text-amber-400">{formatBtc(activeNudgeProfile.totalDonatedBtc)} BTC</strong>
              </div>
              <div>
                <span className="text-slate-500">Style:</span>{' '}
                <strong className="text-emerald-300 capitalize">{activeNudgeProfile.playstyle.replace('-', ' ')}</strong>
              </div>
            </div>

            {/* Template Options */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.map((msg, idx) => {
                const charsExcludingName = msg.body.replace(activeNudgeProfile.username, '').length;
                return (
                  <div
                    key={idx}
                    className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-2.5 text-xs text-slate-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-amber-400" /> {msg.title}
                        </span>
                        <div className="text-[10px] font-mono mt-0.5 flex items-center gap-2 text-slate-400">
                          <span className={charsExcludingName <= 492 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            ✓ {charsExcludingName} / 492 chars (excl. name)
                          </span>
                          <span>•</span>
                          <span>{msg.body.length} / 512 max</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.body, idx)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-300" /> Copy Telegram
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 rounded-xl font-sans text-xs text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800/80">
                      {msg.body}
                    </pre>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveNudgeProfile(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Citizen Calculation Breakdown & Audit Explainer */}
      <CitizenCalculationExplainerModal
        profile={selectedExplainerProfile}
        config={config}
        countryName={countryName}
        onClose={() => setSelectedExplainerProfile(null)}
      />

      {/* Modal: Estimated Gross Income Itemized Calculation Breakdown */}
      <GrossIncomeBreakdownModal
        profile={selectedIncomeBreakdownProfile}
        countryName={countryName}
        config={config}
        apiKey={apiKey}
        onClose={() => setSelectedIncomeBreakdownProfile(null)}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  );
};
