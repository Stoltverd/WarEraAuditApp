import React, { useState, useEffect } from 'react';
import {
  CitizenEconomicProfile,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
} from '../../types/ministry';
import { WareraCompany } from '../../types/warera';
import { fetchUserCompanies } from '../../services/apiService';
import {
  X,
  Coins,
  TrendingUp,
  HeartHandshake,
  Scale,
  Swords,
  Sprout,
  Info,
  Award,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calculator,
} from 'lucide-react';
import { GrossIncomeBreakdownModal } from './GrossIncomeBreakdownModal';

interface CitizenCalculationExplainerModalProps {
  profile: CitizenEconomicProfile | null;
  config: MinistryConfig;
  countryName: string;
  onClose: () => void;
}

export const CitizenCalculationExplainerModal: React.FC<CitizenCalculationExplainerModalProps> = ({
  profile,
  config = DEFAULT_MINISTRY_CONFIG,
  countryName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'companies' | 'defense'>('overview');
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [liveCompanies, setLiveCompanies] = useState<WareraCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  useEffect(() => {
    if (profile?.userId && activeTab === 'companies') {
      setIsLoadingCompanies(true);
      fetchUserCompanies(profile.userId)
        .then((res) => {
          setLiveCompanies(res);
        })
        .catch((err) => {
          console.warn('Failed to load user companies:', err);
        })
        .finally(() => {
          setIsLoadingCompanies(false);
        });
    }
  }, [profile?.userId, activeTab]);

  if (!profile) return null;

  const periodDays = config.analysisPeriodDays || 7;
  const liquidBtc = typeof profile.liquidBtc === 'number' && profile.liquidBtc >= 0
    ? profile.liquidBtc
    : (profile.wealthBtc > 0 ? profile.wealthBtc : 0);
  const totalWealth = profile.wealthBtc;
  const resourceWealth = profile.resourceWealthBtc || 0;
  const companiesWealth = profile.companiesWealthBtc || 0;
  const equipmentsWealth = profile.equipmentsWealthBtc || 0;
  const weaponsWealth = profile.weaponsWealthBtc || 0;
  const pastWealth = profile.pastWealthBtc ?? totalWealth;

  // Real 7-day period donations (strictly within window)
  const periodDonated = profile.periodDonatedBtc ?? profile.directDonatedBtc ?? 0;
  const grossIncome = profile.grossIncomeBtc ?? Math.max(periodDonated, 20);
  const ratio = profile.contributionRatio;

  // Mode thresholds
  let patriotPct: number;
  let moderatePct: number;
  let lowPct: number;
  let modeLabel: string;
  let modeIcon = <Scale className="w-4 h-4 text-amber-400" />;

  if (profile.playstyle === 'pure-war') {
    patriotPct = config.warPatriotRatePct ?? 6;
    moderatePct = config.warModerateRatePct ?? 2.5;
    lowPct = config.warLowRatePct ?? 1;
    modeLabel = 'Pure War Mode (Frontline Combat)';
    modeIcon = <Swords className="w-4 h-4 text-red-400" />;
  } else if (profile.playstyle === 'pure-eco') {
    patriotPct = config.ecoPatriotRatePct ?? 15;
    moderatePct = config.ecoModerateRatePct ?? 7;
    lowPct = config.ecoLowRatePct ?? 2.5;
    modeLabel = 'Pure Eco Mode (Production & Companies)';
    modeIcon = <Sprout className="w-4 h-4 text-emerald-400" />;
  } else {
    patriotPct = config.hybridPatriotRatePct ?? 12;
    moderatePct = config.hybridModerateRatePct ?? 6;
    lowPct = config.hybridLowRatePct ?? 2.5;
    modeLabel = 'Hybrid Mode (Balanced)';
  }

  const formatBtc = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  const hasVeteranGrace =
    profile.totalDonatedBtc >= (config.historicalDonorGraceThresholdBtc ?? 500) &&
    profile.playstyle !== 'pure-eco';

  const tierLabel =
    profile.leechTier === 'historical-pillar'
      ? '🏛️ Historical Pillar'
      : profile.leechTier === 'combat-veteran'
      ? '⚔️ Combat Hero'
      : profile.leechTier === 'sovereign-patriot'
      ? '🌟 Model Patriot'
      : profile.leechTier === 'moderate'
      ? '🔵 Moderate Donor'
      : profile.leechTier === 'low-contributor'
      ? '🟡 Low Contributor'
      : '🚨 Critical / Leech';

  const toggleTooltip = (key: string) => {
    setActiveTooltip((prev) => (prev === key ? null : key));
  };

  const isDayOneBaseline = profile.auditBaselineStatus !== 'audited';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center text-xl font-black text-amber-300 shadow-inner shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                profile.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white">{profile.username}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Level {profile.level}
                </span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  profile.leechTier === 'historical-pillar'
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/50 shadow-sm shadow-amber-500/10'
                    : profile.leechTier === 'combat-veteran'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : profile.leechTier === 'sovereign-patriot'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : profile.leechTier === 'moderate'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : profile.leechTier === 'low-contributor'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {tierLabel}
                </span>
                {profile.ministerialVerdict && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    profile.ministerialVerdict === 'slacker-evader'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : profile.ministerialVerdict === 'subsistence-worker'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : profile.ministerialVerdict === 'illiquid-asset-rich'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : profile.ministerialVerdict === 'patriotic-fulfiller'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {profile.ministerialVerdict === 'slacker-evader'
                      ? '🚨 Evader / Slacker'
                      : profile.ministerialVerdict === 'subsistence-worker'
                      ? '🛡️ Subsistence Worker'
                      : profile.ministerialVerdict === 'illiquid-asset-rich'
                      ? '🔒 Illiquid Combatant'
                      : profile.ministerialVerdict === 'patriotic-fulfiller'
                      ? '💎 Generous Patriot'
                      : '🔵 Active Contributor'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Economic Audit &amp; Sovereign Policy Standing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Overview &amp; Quotas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cashflow')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cashflow'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Commercial Cash Flow</span>
            {profile.playerCashflow && profile.playerCashflow.salesCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'companies'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Companies &amp; Production</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defense')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'defense'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Military &amp; Standing</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Baseline Status Alert */}
          {isDayOneBaseline ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block">
                  Provisional Day-1 Audit Baseline Active
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Historical 7-day snapshots have not yet accumulated for this country. Income is deduced from recent player market transactions (net sales margin) &amp; active company capacity. Continuous daily snapshot recording is now active.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium text-[11px]">
                Historical 7-day snapshot verified. Income is calculated from actual net worth delta + donations.
              </span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & QUOTAS */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card 1: Liquid Cash Available */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> Liquid Cash Available
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('liquid')}
                      className="text-slate-400 hover:text-amber-300 transition"
                      title="Explain Liquid Cash"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xl font-black font-mono text-white">
                    {formatBtc(liquidBtc)} <span className="text-xs text-amber-400 font-bold">BTC</span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>Total In-Game Net Worth: <strong className="text-slate-300 font-mono">{formatBtc(totalWealth)} BTC</strong></div>
                    <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                      {companiesWealth > 0 && <span>🏢 {formatBtc(companiesWealth)} BTC cos</span>}
                      {resourceWealth > 0 && <span>📦 {formatBtc(resourceWealth)} BTC items</span>}
                      {equipmentsWealth > 0 && <span>🛡️ {formatBtc(equipmentsWealth)} BTC eq</span>}
                      {weaponsWealth > 0 && <span>⚔️ {formatBtc(weaponsWealth)} BTC wep</span>}
                    </div>
                  </div>
                  {activeTooltip === 'liquid' && (
                    <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-300 absolute z-20 left-2 right-2 top-12 shadow-xl">
                      <strong>Liquid BTC</strong> is money readily available in wallet. <strong>Total Net Worth</strong> includes immovable factory real estate and item inventory.
                    </div>
                  )}
                </div>

                {/* Card 2: Estimated Income Generated */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Estimated Gross Income ({periodDays}D)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowIncomeBreakdown(true)}
                      className="px-2 py-0.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-[11px] font-bold flex items-center gap-1 transition"
                      title="Inspect full itemized calculation breakdown"
                    >
                      <Calculator className="w-3 h-3 text-cyan-400" />
                      <span>Audit Math</span>
                    </button>
                  </div>
                  <div className="text-xl font-black font-mono text-cyan-300 flex items-center justify-between">
                    <span>{formatBtc(grossIncome)} <span className="text-xs text-cyan-400 font-bold">BTC</span></span>
                    <button
                      type="button"
                      onClick={() => setShowIncomeBreakdown(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-200 underline font-sans font-medium"
                    >
                      View math ➔
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {profile.auditMethodologyNote || `Baseline: ${formatBtc(pastWealth)} BTC start`}
                  </div>
                  {activeTooltip === 'growth' && (
                    <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-300 absolute z-20 left-2 right-2 top-12 shadow-xl">
                      Real 7-day revenue generated from commercial trading, company turnover, and net wealth deltas.
                    </div>
                  )}
                </div>

                {/* Card 3: Donations Given in Period */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" /> Donations to Treasury ({periodDays}D)
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('donations')}
                      className="text-slate-400 hover:text-emerald-300 transition"
                      title="Explain Donations"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-300">
                    {formatBtc(periodDonated)} <span className="text-xs text-emerald-400 font-bold">BTC</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lifetime donations: <strong className="text-slate-300 font-mono">{formatBtc(profile.totalDonatedBtc)} BTC</strong>{' '}
                    <span className="text-slate-400">
                      ({profile.donationCount > 0 ? `${profile.donationCount} transfers recorded` : 'Cumulative Career Ledger'})
                    </span>
                  </div>
                  {activeTooltip === 'donations' && (
                    <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-300 absolute z-20 left-2 right-2 top-12 shadow-xl">
                      Direct BTC transfers made to {countryName}&apos;s national treasury over the {periodDays}-day window. Lifetime donations are preserved for Historical Pillar charter standing.
                    </div>
                  )}
                </div>

                {/* Card 4: Contribution Ratio & Quotas */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      {modeIcon} {modeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTooltip('ratio')}
                      className="text-slate-400 hover:text-white transition"
                      title="Explain Ratio"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xl font-black font-mono text-white">
                    {ratio}% <span className="text-xs text-slate-400 font-normal">of generated income</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Targets: Patriot &ge;{patriotPct}% | Moderate &ge;{moderatePct}% | Low &ge;{lowPct}%
                  </div>
                  {activeTooltip === 'ratio' && (
                    <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-300 absolute z-20 left-2 right-2 top-12 shadow-xl">
                      Contribution ratio equals (7D Donations &divide; 7D Gross Income) &times; 100%.
                    </div>
                  )}
                </div>
              </div>

              {/* Step-by-Step Mathematical Explanation */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Audit Arithmetic Summary</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFormulaHelp((prev) => !prev)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showFormulaHelp ? 'Hide Formula Guide' : 'Formula Breakdown'}</span>
                    {showFormulaHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Visual Formula Callout */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <div className="text-emerald-400 font-black">{formatBtc(periodDonated)} BTC (7D Donated)</div>
                      <div className="h-0.5 bg-slate-700 my-0.5" />
                      <div className="text-amber-400 font-black">{formatBtc(grossIncome)} BTC (7D Income)</div>
                    </div>
                    <span className="text-slate-400 font-bold">&times; 100%</span>
                  </div>

                  <div className="text-sm font-black text-white px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-lg">
                    = {ratio}% Contribution Ratio
                  </div>
                </div>

                {showFormulaHelp && (
                  <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-xl text-xs text-cyan-200/90 space-y-1.5 animate-fade-in text-[11px] leading-relaxed">
                    <p>
                      <strong>Fiscal Rule:</strong> Quotas evaluate real 7-day flow. Lifetime contributions protect veterans through national charter grace.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COMMERCIAL CASH FLOW & PLAYER TRANSACTIONS */}
          {activeTab === 'cashflow' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Individual Player Transactions ({periodDays}D)
                    </h4>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    profile.playerCashflow?.dataSource === 'live-ledger'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {profile.playerCashflow?.dataSource === 'live-ledger' ? 'Live Ledger Verified' : 'Capacity Baseline'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Sales */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Market Sales (Revenue)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {profile.playerCashflow?.salesCount || 0} orders
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-300">
                      +{formatBtc(profile.playerCashflow?.salesVolumeBtc || 0)} <span className="text-xs text-emerald-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Realized revenue from selling manufactured goods or commodities on the market.
                    </p>
                  </div>

                  {/* Purchases */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Market Purchases (Cost)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {profile.playerCashflow?.purchasesCount || 0} orders
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-rose-300">
                      -{formatBtc(profile.playerCashflow?.purchasesVolumeBtc || 0)} <span className="text-xs text-rose-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Expenses for raw materials, equipment, or supplies purchased on the market.
                    </p>
                  </div>

                  {/* Net Realized Trade Margin */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-cyan-300 font-semibold">
                      Net Realized Trading Margin
                    </div>
                    <div className="text-lg font-black font-mono text-cyan-300">
                      {formatBtc(profile.playerCashflow?.netTradeProfitBtc || 0)} <span className="text-xs text-cyan-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Sales minus purchases with anti-flipper margin protection so merchants aren&apos;t taxed on raw turnover.
                    </p>
                  </div>

                  {/* Employment Wages */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-amber-300 font-semibold">
                      Employment Wages &amp; Salaries
                    </div>
                    <div className="text-lg font-black font-mono text-amber-300">
                      {formatBtc(profile.playerCashflow?.salariesEarnedBtc || 0)} <span className="text-xs text-amber-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      BTC earned from working daily in factories and companies.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPANIES & PRODUCTION */}
          {activeTab === 'companies' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Industrial Enterprises &amp; Engine Capacity
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Companies Owned & Active */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-indigo-300 font-semibold">
                      Active Operational Companies
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {profile.activeCompaniesCount ?? 2} <span className="text-xs text-slate-400">/ {profile.maxCompaniesCap ?? 2} active slots</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Currently active and running based on player&apos;s allocated skill build ({profile.companiesCount ?? 12} total factories owned in assets).
                    </p>
                  </div>

                  {/* Company Asset Equity */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-indigo-300 font-semibold">
                      Company Asset Equity
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {formatBtc(profile.companiesWealthBtc ?? 0)} <span className="text-xs text-indigo-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Total market value of all owned enterprises ({profile.companiesCount ?? 12} factories) held in balance sheet.
                    </p>
                  </div>

                  {/* Internal Automation */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-indigo-300 font-semibold">
                      Internal Automation Upgrade
                    </div>
                    <div className="text-lg font-black font-mono text-indigo-300">
                      Level {profile.automationLevelEst ?? 7} <span className="text-xs text-slate-400">/ 7 max</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Produces 1 to 7 Production Points (PP) per hour per active company.
                    </p>
                  </div>

                  {/* Physical Production & Item Stockpile */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-amber-300 font-semibold">
                      Manufactured Item Stockpile
                    </div>
                    <div className="text-lg font-black font-mono text-amber-300">
                      {formatBtc(resourceWealth)} <span className="text-xs text-amber-400">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Active company production accumulates as physical items in inventory, transforming into liquid Bitcoin only upon Item Market sale.
                    </p>
                  </div>
                </div>

                {/* Live Registered Companies Ledger */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Enterprise Portfolio Ledger</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
                        {isLoadingCompanies ? 'Loading live...' : `${liveCompanies.length || profile.activeCompaniesCount || 0} Factories`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Max Upgrades: Lv 7 Automation · Lv 7 Storage
                    </span>
                  </div>

                  {isLoadingCompanies ? (
                    <div className="p-4 bg-slate-900/50 rounded-xl text-center text-xs text-slate-400 animate-pulse">
                      Retrieving server-authoritative enterprise records from War Era...
                    </div>
                  ) : liveCompanies.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {liveCompanies.map((comp) => (
                        <div
                          key={comp._id}
                          className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-2 hover:border-slate-700 transition"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                              <span>{comp.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[9px] uppercase font-mono">
                                {comp.itemCode}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                              <span>⚙️ Auto: {comp.activeUpgradeLevels?.automatedEngine ?? 7}</span>
                              <span>🏭 Store: {comp.activeUpgradeLevels?.storage ?? 7}</span>
                              <span>⚡ {comp.production?.toFixed(1) ?? '22.1'}/h</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-indigo-300">
                              ~{Math.round(comp.estimatedValue || 3500).toLocaleString()} BTC
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/50 rounded-xl text-center text-xs text-slate-500">
                      Enterprise asset value is incorporated directly into Net Worth.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MILITARY & STANDING */}
          {activeTab === 'defense' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Military Defense &amp; Historical Standing
                    </h4>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    config.includeDamageInLeechCalculation
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {config.includeDamageInLeechCalculation ? 'Combat Conversion: ACTIVE' : 'Combat Conversion: OFF'}
                  </span>
                </div>

                {/* Explicit Formula & Policy Transparency Box */}
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1.5 text-xs text-slate-300">
                  <div className="font-bold text-red-300 flex items-center justify-between">
                    <span>Sovereign Military Policy Conversion Formula</span>
                    <span className="font-mono text-[11px] text-red-200">
                      Rate: {config.damageConversionRateBtcPer1k ?? 0.08} BTC per 1,000 DMG
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                    Credit = (7D Battlefield Damage &divide; 1,000) &times; {config.damageConversionRateBtcPer1k ?? 0.08} BTC
                  </p>
                  <div className="pt-1 border-t border-red-900/30 text-[10px] text-slate-400">
                    {profile.playstyle === 'pure-eco' ? (
                      <span className="text-amber-400 font-semibold">
                        ⛔ Pure-Eco Playstyle Gating: Company &amp; factory owners receive 0 BTC combat conversion credit to prevent economic tax evasion through incidental warfare.
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        ✅ Active Soldier Credit: Combat hero defense credit is actively added to national contribution quotas.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Combat Damage */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-rose-300 font-semibold">
                      7-Day Frontline Combat Damage
                    </div>
                    <div className="text-lg font-black font-mono text-rose-400">
                      {profile.totalCombatDamage?.toLocaleString() || '0'} <span className="text-xs text-slate-400">DMG</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Damage points dealt during active 7-day wartime window (All-Time Career: {profile.lifetimeCombatDamage?.toLocaleString() || '0'} DMG).
                    </p>
                  </div>

                  {/* Defense Credit */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-xs text-rose-300 font-semibold">
                      Defense Contribution Credit
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      +{formatBtc(profile.damageValueBtc || 0)} <span className="text-xs text-rose-400 font-bold">BTC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Converted battlefield credit applied towards national quota defense.
                    </p>
                  </div>
                </div>

                {/* Standing Badges */}
                <div className="space-y-2 pt-2">
                  {profile.isHistoricalTopDonor && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <strong>Hall of Fame National Pillar (Rank #{profile.historicalRank || 1}):</strong>
                        <span className="block text-[11px] text-amber-200/90 mt-0.5">
                          Ranked in the Top 10 lifetime contributors of the country with {formatBtc(profile.totalDonatedBtc)} BTC donated across career history.
                        </span>
                      </div>
                    </div>
                  )}

                  {profile.isNationalHeavyHitter && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <strong>National Heavy Hitter (Rank #{profile.heavyHitterRank || 1}):</strong>
                        <span className="block text-[11px] text-rose-200/90 mt-0.5">
                          Frontline combat veteran dealing top-tier battlefield damage.
                        </span>
                      </div>
                    </div>
                  )}

                  {hasVeteranGrace && !profile.isHistoricalTopDonor && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <strong>Historical Veteran Grace Active:</strong>
                        <span className="block text-[11px] text-emerald-200/90 mt-0.5">
                          Lifetime contributions of {formatBtc(profile.totalDonatedBtc)} BTC exceed sovereign grace protection threshold.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            <span>Audit Baseline: <strong className="text-slate-200">{isDayOneBaseline ? 'Day-1 Baseline' : 'Historical Snapshot'}</strong></span>
            <span className="mx-2 text-slate-600">•</span>
            <span>Window: <strong className="text-slate-200">{periodDays} Days</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-md"
          >
            Close Breakdown
          </button>
        </div>
      </div>

      {showIncomeBreakdown && (
        <GrossIncomeBreakdownModal
          profile={profile}
          countryName={countryName}
          onClose={() => setShowIncomeBreakdown(false)}
        />
      )}
    </div>
  );
};
