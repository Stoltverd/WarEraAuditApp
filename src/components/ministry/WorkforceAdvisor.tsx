import React, { useState, useMemo } from 'react';
import {
  PIRATERERS_TRAIT_CATALOG,
  TRAIT_MAP,
  BUHDEUCE_TRAINING_GUIDE,
  BUHDEUCE_HIRING_RULES,
  evaluateCompanyWorkforce,
  isManufacturedCommodity,
  resolveCommodityLivePriceBtc,
} from '../../services/workforceService';
import { CANONICAL_24_COMMODITIES } from '../../services/marketService';
import {
  EmployeeTraitTier,
  EmployeeTraitId,
  WareraBotEmployee,
  WareraCompany,
} from '../../types/warera';
import { CitizenEconomicProfile, CommodityTrend } from '../../types/ministry';
import { WareraItemIcon } from '../common/WareraItemIcon';
import {
  Users,
  Award,
  Search,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  SlidersHorizontal,
  Building2,
  Heart,
  Zap,
  Image as ImageIcon,
  Info,
  Hammer,
  UserCheck,
  TrendingUp,
  Coins,
  RotateCcw,
} from 'lucide-react';

interface WorkforceAdvisorProps {
  countryName: string;
  profiles?: CitizenEconomicProfile[];
  commodities?: CommodityTrend[];
}

export const WorkforceAdvisor: React.FC<WorkforceAdvisorProps> = ({
  countryName,
  profiles = [],
  commodities = [],
}) => {
  const [subTab, setSubTab] = useState<'traits' | 'guide' | 'sandbox' | 'posters'>('traits');

  // Trait Explorer Filters
  const [traitSearch, setTraitSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | EmployeeTraitTier>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Sandbox State
  const [sandboxCommodity, setSandboxCommodity] = useState<string>('steel');
  const [customPriceOverride, setCustomPriceOverride] = useState<string>('');
  const [sandboxBreakroom, setSandboxBreakroom] = useState<number>(3);
  const [sandboxAutoEngine, setSandboxAutoEngine] = useState<number>(7);
  const [sandboxStorage, setSandboxStorage] = useState<number>(7);
  const [sandboxManagementLvl, setSandboxManagementLvl] = useState<number>(8);
  const [sandboxHasManager, setSandboxHasManager] = useState<boolean>(true);
  const [sandboxSafeRegion, setSandboxSafeRegion] = useState<boolean>(true);
  const [sandboxHighTax, setSandboxHighTax] = useState<boolean>(false);

  const [sandboxEmployees, setSandboxEmployees] = useState<WareraBotEmployee[]>([
    {
      id: 'sb-emp-1',
      name: 'Employee #1 (Lead Producer)',
      age: 20,
      sex: 'female',
      nationality: countryName || 'Homeland',
      isForeigner: false,
      happiness: 86,
      hourlyWageBtc: 0.56,
      trainingPotential: 12,
      trainingUsed: 7,
      hasTool: true,
      toolTier: 'epic',
      isSpecializedInGood: true,
      tenureDays: 32,
      stats: {
        production: 16,
        luck: 5,
        responsibility: 9,
      },
      traits: ['handy', 'sociable', 'craftsman'],
    },
    {
      id: 'sb-emp-2',
      name: 'Employee #2 (Synergy Specialist)',
      age: 21,
      sex: 'female',
      nationality: 'Allied Foreign',
      isForeigner: true,
      happiness: 82,
      hourlyWageBtc: 0.50,
      trainingPotential: 11,
      trainingUsed: 6,
      hasTool: true,
      toolTier: 'rare',
      isSpecializedInGood: true,
      tenureDays: 24,
      stats: {
        production: 14,
        luck: 4,
        responsibility: 8,
      },
      traits: ['specialist', 'girl_power', 'trainer'],
    },
    {
      id: 'sb-emp-3',
      name: 'Employee #3 (Support & Output)',
      age: 19,
      sex: 'female',
      nationality: 'Allied Foreign',
      isForeigner: true,
      happiness: 78,
      hourlyWageBtc: 0.44,
      trainingPotential: 10,
      trainingUsed: 5,
      hasTool: false,
      toolTier: 'none',
      isSpecializedInGood: true,
      tenureDays: 18,
      stats: {
        production: 13,
        luck: 4,
        responsibility: 8,
      },
      traits: ['improviser', 'cosmopolitan', 'modest'],
    },
  ]);

  // National Build Readiness Statistics
  const nationalBuildStats = useMemo(() => {
    let optimalMeta = 0;
    let optimalEarly = 0;
    let viableSelfWork = 0;
    let warReady = 0;
    let suboptimal = 0;

    for (const p of profiles) {
      const grade = p.buildEvaluation?.grade;
      if (grade === 'optimal-meta') optimalMeta++;
      else if (grade === 'optimal-early-selfwork') optimalEarly++;
      else if (grade === 'viable-selfwork') viableSelfWork++;
      else if (grade === 'war-ready') warReady++;
      else if (grade === 'suboptimal-sp') suboptimal++;
    }
    return { optimalMeta, optimalEarly, viableSelfWork, warReady, suboptimal };
  }, [profiles]);

  const filteredTraits = useMemo(() => {
    return PIRATERERS_TRAIT_CATALOG.filter((t) => {
      if (tierFilter !== 'all' && t.tier !== tierFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (traitSearch.trim()) {
        const q = traitSearch.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.effectText.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.bestFor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [traitSearch, tierFilter, categoryFilter]);

  const sandboxCompany: WareraCompany = useMemo(() => {
    const activeRoster = sandboxEmployees.slice(0, sandboxBreakroom);
    return {
      _id: 'sandbox-company',
      user: 'sandbox-owner',
      region: sandboxSafeRegion ? `${countryName} Core Safe Region` : 'Contested Border Region',
      name: 'Sovereign Benchmark Factory',
      itemCode: sandboxCommodity,
      isFull: activeRoster.length >= sandboxBreakroom,
      production: 18,
      activeUpgradeLevels: {
        breakRoom: sandboxBreakroom,
        automatedEngine: sandboxAutoEngine,
        storage: sandboxStorage,
      },
      workerCount: activeRoster.length,
      employees: activeRoster,
      hasManager: sandboxHasManager,
      isHomelandSafeRegion: sandboxSafeRegion,
    };
  }, [
    sandboxEmployees,
    sandboxBreakroom,
    sandboxCommodity,
    sandboxAutoEngine,
    sandboxStorage,
    sandboxHasManager,
    sandboxSafeRegion,
    countryName,
  ]);

  const parsedPriceOverride = useMemo(() => {
    const trimmed = customPriceOverride.trim();
    if (!trimmed) return null;
    const val = parseFloat(trimmed);
    return !isNaN(val) && val > 0 ? val : null;
  }, [customPriceOverride]);

  const activeCommodityPriceInfo = useMemo(() => {
    return resolveCommodityLivePriceBtc(sandboxCommodity, commodities, parsedPriceOverride);
  }, [sandboxCommodity, commodities, parsedPriceOverride]);

  const sandboxCommoditiesList = useMemo(() => {
    return CANONICAL_24_COMMODITIES.map((c) => {
      const code = c.itemCode || (c as any).id || 'steel';
      const resolved = resolveCommodityLivePriceBtc(code, commodities);
      return {
        code,
        name: c.name,
        unit: c.unit,
        isManufactured: isManufacturedCommodity(code),
        livePriceBtc: resolved.liveMarketPriceBtc,
      };
    });
  }, [commodities]);

  const sandboxEvaluation = useMemo(() => {
    return evaluateCompanyWorkforce(
      sandboxCompany,
      sandboxCompany.employees,
      sandboxManagementLvl,
      sandboxHighTax ? 25 : 10,
      activeCommodityPriceInfo.unitPriceBtc,
      commodities,
      parsedPriceOverride
    );
  }, [
    sandboxCompany,
    sandboxManagementLvl,
    sandboxHighTax,
    activeCommodityPriceInfo.unitPriceBtc,
    commodities,
    parsedPriceOverride,
  ]);

  const updateSandboxEmployee = (idx: number, patch: Partial<WareraBotEmployee>) => {
    setSandboxEmployees((prev) =>
      prev.map((emp, i) => (i === idx ? { ...emp, ...patch } : emp))
    );
  };

  const updateSandboxEmployeeTrait = (empIdx: number, slotIdx: number, traitId: string) => {
    setSandboxEmployees((prev) =>
      prev.map((emp, i) => {
        if (i !== empIdx) return emp;
        const nextTraits = [...emp.traits];
        if (!traitId) {
          nextTraits.splice(slotIdx, 1);
        } else {
          nextTraits[slotIdx] = traitId as EmployeeTraitId;
        }
        // Deduplicate while keeping order
        const unique = Array.from(new Set(nextTraits.filter(Boolean))) as EmployeeTraitId[];
        return { ...emp, traits: unique.slice(0, 3) };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-amber-950/30 border border-slate-800 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              War Era v0.27 Workforce, Trait Tier List &amp; Build Advisor — {countryName}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
              BuhDeuce &amp; Piraterers Standard
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Complete reference and interactive simulator for the War Era v0.27 Company &amp; Bot Employee overhaul: Breakroom Level 3 capacity, Leadership &amp; Management (+2%/lvl) skill builds, level-aware Production caveats, and all 29 Piraterers employee traits.
          </p>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('traits')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'traits'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Piraterers Trait Tier List (29)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('guide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'guide'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>BuhDeuce Employee &amp; Build Guide</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sandbox')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'sandbox'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Company Workforce Simulator</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('posters')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'posters'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Reference Infographics</span>
          </button>
        </div>
      </div>

      {/* National Build Readiness KPI Strip */}
      {profiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              🌟 Lvl 26+ Eco Meta
            </div>
            <div className="text-xl font-black font-mono text-white mt-0.5 tabular-nums">
              {nationalBuildStats.optimalMeta}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Leadership + Mgmt/Energy
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              ⚡ Lvl 1–25 Self-Work
            </div>
            <div className="text-xl font-black font-mono text-white mt-0.5 tabular-nums">
              {nationalBuildStats.optimalEarly}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Optimal early Prod + Energy
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
              🛠️ Lvl 26+ Viable Self-Work
            </div>
            <div className="text-xl font-black font-mono text-white mt-0.5 tabular-nums">
              {nationalBuildStats.viableSelfWork}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Max Prod + Energy (No Lead)
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              ⚔️ War-Ready Spec
            </div>
            <div className="text-xl font-black font-mono text-white mt-0.5 tabular-nums">
              {nationalBuildStats.warReady}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Combat + Companies &amp; Luck
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              ⚠️ SP Optimization Needed
            </div>
            <div className="text-xl font-black font-mono text-amber-400 mt-0.5 tabular-nums">
              {nationalBuildStats.suboptimal}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Missing Leadership / Mgmt
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: PIRATERERS TRAIT TIER LIST EXPLORER */}
      {subTab === 'traits' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={traitSearch}
                onChange={(e) => setTraitSearch(e.target.value)}
                placeholder="Search trait name, bonus, or synergy..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'must-have', 'good-to-have', 'ok-to-have'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    tierFilter === tier
                      ? tier === 'must-have'
                        ? 'bg-red-500/20 text-red-300 border-red-500/50'
                        : tier === 'good-to-have'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                        : tier === 'ok-to-have'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tier === 'all' && 'All Tiers (29)'}
                  {tier === 'must-have' && '🔥 MUST HAVE! (8)'}
                  {tier === 'good-to-have' && '💎 GOOD TO HAVE (10)'}
                  {tier === 'ok-to-have' && '✅ OK TO HAVE (11)'}
                </button>
              ))}

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Categories</option>
                <option value="production">⚡ Direct Production</option>
                <option value="synergy">🤝 Coworker Synergy</option>
                <option value="happiness">😊 Morale &amp; Happiness</option>
                <option value="training">🏋️ Training &amp; Recruitment</option>
                <option value="wage">💰 Wage Discount</option>
                <option value="luck">🍀 Luck &amp; Toolboxes</option>
              </select>
            </div>
          </div>

          {/* Tier Sections */}
          {(['must-have', 'good-to-have', 'ok-to-have'] as EmployeeTraitTier[]).map((tierKey) => {
            const tierTraits = filteredTraits.filter((t) => t.tier === tierKey);
            if (tierTraits.length === 0) return null;

            const bannerStyles =
              tierKey === 'must-have'
                ? 'from-red-950/70 via-slate-900 to-slate-900 border-red-500/40 text-red-300'
                : tierKey === 'good-to-have'
                ? 'from-sky-950/70 via-slate-900 to-slate-900 border-sky-500/40 text-sky-300'
                : 'from-emerald-950/70 via-slate-900 to-slate-900 border-emerald-500/40 text-emerald-300';

            const tierTitle =
              tierKey === 'must-have'
                ? 'MUST HAVE! — S-Tier Core Production & Multipliers'
                : tierKey === 'good-to-have'
                ? 'GOOD TO HAVE — A-Tier Roster Synergies & Double Training'
                : 'OK TO HAVE — B-Tier Situational & Support Traits';

            return (
              <div key={tierKey} className="space-y-3">
                <div className={`px-4 py-2.5 rounded-xl bg-gradient-to-r border ${bannerStyles} flex items-center justify-between`}>
                  <span className="text-xs font-black uppercase tracking-wider">{tierTitle}</span>
                  <span className="text-[11px] font-mono opacity-80">{tierTraits.length} Traits</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tierTraits.map((trait) => (
                    <div
                      key={trait.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-2.5 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black text-white text-sm">{trait.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-950 text-slate-300 border border-slate-800">
                            {trait.category}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
                          {trait.effectText}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">
                          {trait.summary}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                        <div className="text-slate-300 leading-relaxed">
                          <strong className="text-emerald-400">Best Use:</strong> {trait.bestFor}
                        </div>
                        {trait.caution && (
                          <div className="text-rose-300/90 flex items-start gap-1.5 bg-rose-950/30 border border-rose-800/40 rounded-lg p-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{trait.caution}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: BUHDEUCE EMPLOYEE & BUILD GUIDE */}
      {subTab === 'guide' && (
        <div className="space-y-5">
          {/* Top Golden Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-2">
              <div className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>1. Breakroom Lvl 3 &amp; Safe Homeland</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Employees can earn as much as your company&apos;s Automated Engine. <strong>Insta-upgrade your Breakrooms to LVL 3</strong> (Lvl 2 = 20 Steel, Lvl 3 = 80 Steel) to unlock 3 employee slots per company.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-200 space-y-1">
                <div>• Set your company in the <strong>safest region of your own country</strong> for the rest of the game so taxes go to your country.</div>
                <div>• <strong className="text-rose-400">Warning:</strong> Employees can die if an unsafe region gets invaded, and moving employees makes them sad and strips their product specialization bonus!</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-cyan-500/30 space-y-2">
              <div className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>2. Hiring &amp; 1-Reroll Protocol</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {BUHDEUCE_HIRING_RULES.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold font-mono">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2">
              <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Hammer className="w-4 h-4" />
                <span>3. Manager, Morale &amp; Tools</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <strong className="text-amber-300 block mb-0.5">Hire a Trusted Manager:</strong>
                  1. Click on the saddest employee and give <strong className="text-emerald-400">+5 happiness</strong>.<br />
                  2. Increase production for your highest net earning employee.
                </div>
                <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200">
                  <strong>Morale Walkout Threshold:</strong> Under <strong>30 happiness</strong>, employees will start leaving your company!
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <strong className="text-purple-300">Tools Rule:</strong> Give tools to your highest earner or someone with <em>Handy</em> (+40%). <strong>Scrap legendary and mythic tools</strong> — they earn you more that way.
                </div>
              </div>
            </div>
          </div>

          {/* Training Events Priority Matrix & Player Skill Build Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Training Events Priority */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Training Events Priority Order</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Hire 1 &rarr; Train Immediately &rarr; Hire Next
                </span>
              </div>

              <div className="space-y-2.5">
                {BUHDEUCE_TRAINING_GUIDE.map((ev) => (
                  <div
                    key={ev.rarity}
                    className={`p-3.5 rounded-xl border ${
                      ev.color === 'purple'
                        ? 'bg-purple-950/25 border-purple-500/40'
                        : ev.color === 'blue'
                        ? 'bg-sky-950/25 border-sky-500/40'
                        : 'bg-emerald-950/25 border-emerald-500/40'
                    }`}
                  >
                    <div className="text-xs font-black text-white mb-1">{ev.rarity}</div>
                    <div className="text-xs text-slate-200 font-semibold">
                      1st Priority: <span className="text-amber-300">{ev.primaryChoice}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Fallback: {ev.fallbackChoice}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <strong className="text-amber-400">Special Events Rule:</strong> Way too many players gamble on low-odds outcomes. Always pick safe options so your training sessions aren&apos;t wasted.
              </div>
            </div>

            {/* Player Skill Builds & Level Caveats */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>v0.27 Player Skill Builds &amp; Level Caveats</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  Ministry Evaluation Standard
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/40 space-y-1">
                  <div className="font-black text-cyan-300">
                    ⚡ Caveat 1: Low Levels (Levels 1–25) — Self-Work Production is Optimal
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    At Levels 1–25, paying bot employee wages is less profitable than working your own companies directly. Having SP in <strong>Production</strong> and <strong>Energy</strong> is graded as <strong>Optimal Early Self-Work</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-1">
                  <div className="font-black text-emerald-300">
                    🌟 High Levels (Levels 26+) — BuhDeuce Bot Workforce Meta
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    <strong>12 Companies, Max Leadership</strong> (improves training card draws), and equal <strong>Energy &amp; Management</strong> (+2% employee output/lvl). Spend 1 week all-out Energy (train 3 employees across 12 companies daily), then 1:1 Energy &amp; Management. Avoid investing SP in personal Production once your bot workforce is running.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-950/25 border border-blue-500/40 space-y-1">
                  <div className="font-black text-blue-300">
                    🛠️ Caveat 2: High Levels (Levels 26+) — Max Production + Energy (Viable)
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    A high-level build that ignores Leadership and maxes <strong>Production + Energy</strong> is <em>not recommended</em> compared to a 36-bot workforce empire, but it remains <strong>Viable (if not ideal)</strong> for self-working industrialists.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/40 space-y-1">
                  <div className="font-black text-rose-300">
                    ⚔️ War Players &amp; War Players in Eco
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    <strong>In War:</strong> No extra SP in Eco is needed apart from <strong>Companies</strong> and <strong>Luck</strong>.<br />
                    <strong>War Players in Eco:</strong> Invest SP in <strong>Energy</strong> and <strong>Leadership</strong> to train strong employees that passively fund your next war period.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: INTERACTIVE COMPANY WORKFORCE & TRAIT SIMULATOR */}
      {subTab === 'sandbox' && (
        <div className="space-y-5">
          {/* Company Configuration Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Company Product (All 24 Live Market Commodities)
              </label>
              <select
                value={sandboxCommodity}
                onChange={(e) => {
                  setSandboxCommodity(e.target.value);
                  setCustomPriceOverride('');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-amber-500"
              >
                <optgroup label="🏭 Manufactured Goods &amp; Weapons (Craftsman +3 Prod)">
                  {sandboxCommoditiesList
                    .filter((c) => c.isManufactured)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} — {c.livePriceBtc.toFixed(2)} BTC / {c.unit}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="⛏️ Raw Resources (Laborer +3 Prod)">
                  {sandboxCommoditiesList
                    .filter((c) => !c.isManufactured)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} — {c.livePriceBtc.toFixed(2)} BTC / {c.unit}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Breakroom Level (1–3)
              </label>
              <select
                value={sandboxBreakroom}
                onChange={(e) => setSandboxBreakroom(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              >
                <option value={1}>LVL 1 (1 Employee)</option>
                <option value={2}>LVL 2 (2 Employees · 20 Steel)</option>
                <option value={3}>LVL 3 (3 Employees · 80 Steel)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Automated Engine (1–7)
              </label>
              <select
                value={sandboxAutoEngine}
                onChange={(e) => setSandboxAutoEngine(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Engine Lvl {lvl} ({(lvl * 2.5).toFixed(1)} PP/hr)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Owner Management Skill
              </label>
              <select
                value={sandboxManagementLvl}
                onChange={(e) => setSandboxManagementLvl(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>
                    Lvl {i} (+{i * 2}% Bot Output)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandboxHasManager}
                  onChange={(e) => setSandboxHasManager(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Active Manager (+5 Happy)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandboxSafeRegion}
                  onChange={(e) => setSandboxSafeRegion(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>Safe Homeland Core Region</span>
              </label>
            </div>
          </div>

          {/* Live Commodity Market Price & Transparent Profit Formula Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/25 to-slate-900 border border-emerald-500/30 space-y-3 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <WareraItemIcon itemCode={activeCommodityPriceInfo.canonicalId} size="md" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      {activeCommodityPriceInfo.commodityName} Valuation Basis
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        activeCommodityPriceInfo.priceSource === 'manual-override'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : activeCommodityPriceInfo.priceSource === 'live-market'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      }`}
                    >
                      {activeCommodityPriceInfo.priceSource === 'manual-override'
                        ? '🛠️ Manual Price Override Active'
                        : activeCommodityPriceInfo.priceSource === 'live-market'
                        ? '✓ Live In-Game Market Orderbook Price'
                        : '✓ Canonical Market Baseline Price'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300 font-bold">
                      Recipe: {sandboxEvaluation.recipeSummary}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Active Unit Price:{' '}
                      <strong className="text-emerald-300 font-black">
                        {activeCommodityPriceInfo.unitPriceBtc.toFixed(3)} BTC / {activeCommodityPriceInfo.unit}
                      </strong>
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>
                      Live Market:{' '}
                      <strong className="text-white">
                        {activeCommodityPriceInfo.liveMarketPriceBtc.toFixed(3)} BTC
                      </strong>
                    </span>
                    {sandboxEvaluation.rawInputCostPerUnitBtc > 0 && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span>
                          Raw Input Cost:{' '}
                          <strong className="text-amber-300">
                            {sandboxEvaluation.rawInputCostPerUnitBtc.toFixed(3)} BTC/unit
                          </strong>
                        </span>
                      </>
                    )}
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      Bid: {activeCommodityPriceInfo.highestBidBtc.toFixed(2)} / Ask: {activeCommodityPriceInfo.lowestAskBtc.toFixed(2)} BTC (7D Avg: {activeCommodityPriceInfo.avg7dBtc.toFixed(2)} BTC)
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional Manual Price Override Control */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">
                    Override Price (BTC):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={activeCommodityPriceInfo.liveMarketPriceBtc.toFixed(2)}
                    value={customPriceOverride}
                    onChange={(e) => setCustomPriceOverride(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {parsedPriceOverride !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomPriceOverride('')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition"
                    title="Reset to live in-game market price"
                  >
                    <RotateCcw className="w-3 h-3 text-emerald-400" />
                    <span>Use Live ({activeCommodityPriceInfo.liveMarketPriceBtc.toFixed(2)} BTC)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Step-by-Step Real Net Profit Equation */}
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 font-mono text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 font-sans font-bold uppercase text-[10px]">
                  Real Net Profit Equation:
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                  {sandboxEvaluation.totalDailyPP.toFixed(1)} PP/day
                </span>
                <span className="text-slate-500">&divide; {sandboxEvaluation.ppPerUnit} PP/unit =</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                  {sandboxEvaluation.dailyUnitsProduced.toFixed(2)} {activeCommodityPriceInfo.unit}s/day
                </span>
                <span className="text-slate-500">&times;</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {sandboxEvaluation.unitMarketPriceBtc.toFixed(3)} BTC
                </span>
                <span className="text-slate-500">=</span>
                <span className="text-emerald-300 font-bold">
                  +{sandboxEvaluation.estimatedDailyRevenueBtc.toFixed(2)} BTC Gross Output
                </span>
                {sandboxEvaluation.dailyRawInputCostBtc > 0 && (
                  <>
                    <span className="text-slate-500">&minus;</span>
                    <span className="text-amber-300 font-bold" title="Market value of raw materials consumed per recipe">
                      {sandboxEvaluation.dailyRawInputCostBtc.toFixed(2)} BTC Raw Inputs
                    </span>
                  </>
                )}
                <span className="text-slate-500">&minus;</span>
                <span className="text-rose-300 font-bold">
                  {sandboxEvaluation.totalDailyWagesBtc.toFixed(2)} BTC Wages
                </span>
                <span className="text-slate-500">=</span>
                <span
                  className={`px-2 py-0.5 rounded font-black ${
                    sandboxEvaluation.estimatedDailyNetProfitBtc >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {sandboxEvaluation.estimatedDailyNetProfitBtc >= 0 ? '+' : ''}
                  {sandboxEvaluation.estimatedDailyNetProfitBtc.toFixed(2)} BTC/day (Self-Supplied)
                  {sandboxEvaluation.dailyRawInputCostBtc > 0 && (
                    <span className="text-[10px] font-normal ml-1.5 opacity-90">
                      | {sandboxEvaluation.estimatedDailyNetProfitAfterInputsBtc >= 0 ? '+' : ''}
                      {sandboxEvaluation.estimatedDailyNetProfitAfterInputsBtc.toFixed(2)} BTC/day (Buying Inputs)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Live Evaluation Output Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans uppercase">Total Company Output</div>
              <div className="text-xl font-black text-cyan-300 mt-0.5 tabular-nums">
                {sandboxEvaluation.totalDailyPP} PP/day
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                {sandboxEvaluation.dailyUnitsProduced.toFixed(1)} {activeCommodityPriceInfo.unit}s/day (Engine {sandboxEvaluation.engineHourlyPP.toFixed(1)}/h + Bots {sandboxEvaluation.workforceHourlyPP.toFixed(1)}/h)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans uppercase">Daily Payroll Cost</div>
              <div className="text-xl font-black text-rose-400 mt-0.5 tabular-nums">
                -{sandboxEvaluation.totalDailyWagesBtc.toFixed(2)} BTC
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                Across {sandboxEvaluation.employeeBreakdown.length} active bot slot(s)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans uppercase flex items-center justify-between gap-1">
                <span>Real Daily Net Profit</span>
                <span className="text-[9px] font-mono text-emerald-400">
                  @ {sandboxEvaluation.unitMarketPriceBtc.toFixed(2)} BTC/{activeCommodityPriceInfo.unit}
                </span>
              </div>
              <div className={`text-xl font-black mt-0.5 tabular-nums ${
                sandboxEvaluation.estimatedDailyNetProfitBtc >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {sandboxEvaluation.estimatedDailyNetProfitBtc >= 0 ? '+' : ''}
                {sandboxEvaluation.estimatedDailyNetProfitBtc.toFixed(2)} BTC
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                Gross Rev: {sandboxEvaluation.estimatedDailyRevenueBtc.toFixed(2)} BTC/day ({sandboxEvaluation.dailyUnitsProduced.toFixed(1)} {activeCommodityPriceInfo.unit}s)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans uppercase">BuhDeuce Workforce Score</div>
              <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
                {sandboxEvaluation.overallScore} / 100
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                {isManufacturedCommodity(sandboxCommodity) ? 'Manufactured Good (Craftsman +3)' : 'Raw Resource (Laborer +3)'}
              </div>
            </div>
          </div>

          {/* Employee Slots Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {sandboxEmployees.slice(0, sandboxBreakroom).map((emp, idx) => {
              const evalInfo = sandboxEvaluation.employeeBreakdown[idx];
              return (
                <div
                  key={emp.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-white block">{emp.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Breakroom Slot #{idx + 1} · Age {emp.age}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-black tabular-nums block">
                          {evalInfo?.effectivePP.toFixed(1)} PP/hr
                        </span>
                        {evalInfo && (
                          <span className={`text-[10px] font-mono font-bold mt-0.5 block ${
                            evalInfo.dailyNetProfitBtc >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            Net: {evalInfo.dailyNetProfitBtc >= 0 ? '+' : ''}{evalInfo.dailyNetProfitBtc.toFixed(2)} BTC/d ({evalInfo.dailyUnitsProduced.toFixed(1)} u/d)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Core Employee Controls */}
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Age</label>
                        <input
                          type="number"
                          min={18}
                          max={70}
                          value={emp.age}
                          onChange={(e) => updateSandboxEmployee(idx, { age: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Happiness</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={emp.happiness}
                          onChange={(e) => updateSandboxEmployee(idx, { happiness: Number(e.target.value) })}
                          className={`w-full px-2 py-1 bg-slate-950 border rounded-lg font-mono ${
                            emp.happiness < 30 ? 'border-rose-500 text-rose-400' : 'border-slate-800 text-emerald-300'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Wage/hr (BTC)</label>
                        <input
                          type="number"
                          step="0.05"
                          min={0.05}
                          max={20}
                          value={emp.hourlyWageBtc}
                          onChange={(e) => updateSandboxEmployee(idx, { hourlyWageBtc: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Gender (Synergy)</label>
                        <select
                          value={emp.sex}
                          onChange={(e) =>
                            updateSandboxEmployee(idx, { sex: e.target.value as 'male' | 'female' })
                          }
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        >
                          <option value="female">Female (Girl Power)</option>
                          <option value="male">Male (Band of Brothers)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Origin (Patriot/Expat)</label>
                        <select
                          value={emp.isForeigner ? 'foreign' : 'homeland'}
                          onChange={(e) =>
                            updateSandboxEmployee(idx, {
                              isForeigner: e.target.value === 'foreign',
                              nationality: e.target.value === 'foreign' ? 'Allied Foreign' : countryName || 'Homeland',
                            })
                          }
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                        >
                          <option value="homeland">Homeland Citizen</option>
                          <option value="foreign">Foreign Expat</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emp.hasTool}
                          onChange={(e) => updateSandboxEmployee(idx, { hasTool: e.target.checked })}
                          className="rounded accent-amber-500"
                        />
                        <span>Equipped Tool</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emp.isSpecializedInGood}
                          onChange={(e) =>
                            updateSandboxEmployee(idx, { isSpecializedInGood: e.target.checked })
                          }
                          className="rounded accent-emerald-500"
                        />
                        <span>Product Specialist</span>
                      </label>
                    </div>

                    {/* 3 Trait Selectors */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Assigned Piraterers Traits (Max 3)
                      </div>
                      {[0, 1, 2].map((slotIdx) => {
                        const currentTraitId = emp.traits[slotIdx] || '';
                        const traitDef = currentTraitId ? TRAIT_MAP[currentTraitId] : undefined;
                        return (
                          <div key={slotIdx} className="space-y-0.5">
                            <select
                              value={currentTraitId}
                              onChange={(e) => updateSandboxEmployeeTrait(idx, slotIdx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="">— Empty Trait Slot #{slotIdx + 1} —</option>
                              <optgroup label="🔥 MUST HAVE! (S-Tier)">
                                {PIRATERERS_TRAIT_CATALOG.filter((t) => t.tier === 'must-have').map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.effectText})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="💎 GOOD TO HAVE (A-Tier)">
                                {PIRATERERS_TRAIT_CATALOG.filter((t) => t.tier === 'good-to-have').map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.effectText})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="✅ OK TO HAVE (B-Tier)">
                                {PIRATERERS_TRAIT_CATALOG.filter((t) => t.tier === 'ok-to-have').map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.effectText})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            {traitDef && (
                              <div className="text-[10px] text-slate-400 px-1 truncate">
                                {traitDef.summary}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Synergies & Warnings Footer */}
                  {evalInfo && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-slate-400">Effective Happiness:</span>
                        <span className={evalInfo.effectiveHappiness < 30 ? 'text-rose-400 font-black' : 'text-emerald-400 font-bold'}>
                          {evalInfo.effectiveHappiness}/100
                        </span>
                      </div>
                      {evalInfo.activeSynergies.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {evalInfo.activeSynergies.map((syn, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono"
                            >
                              {syn}
                            </span>
                          ))}
                        </div>
                      )}
                      {evalInfo.warnings.map((w, wIdx) => (
                        <div
                          key={wIdx}
                          className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[10px] flex items-start gap-1.5"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ORIGINAL COMMUNITY REFERENCE POSTERS */}
      {subTab === 'posters' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">
                  War Era Employee Guide — By BuhDeuce
                </h3>
                <p className="text-xs text-slate-400">
                  Breakroom Lvl 3, Safe Region Selection, Hiring Rules, Training Priority &amp; Player Stats
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                v0.27 Reference
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src="/assets/aistudio/WhatsApp_Image_2026-10-26_at_5.47.26_PM_b22c7181.jpeg"
                alt="War Era Employee Guide by BuhDeuce"
                className="w-full h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">
                  Piraterers Employee Trait Tier List
                </h3>
                <p className="text-xs text-slate-400">
                  Must Have! (S-Tier), Good To Have (A-Tier), and OK To Have (B-Tier) Trait Modifiers
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold">
                29 Traits Cataloged
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src="/assets/aistudio/IMG_20261026_104636_90d05088.jpg"
                alt="Piraterers Employee Trait Tier List"
                className="w-full h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
