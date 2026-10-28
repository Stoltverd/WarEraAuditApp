import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WareraCountry } from '../../types/warera';
import {
  StateWarReadinessReport,
  WarReadinessRole,
} from '../../types/ministry';
import {
  evaluateStateWarReadiness,
  getCachedWarReadinessReport,
} from '../../services/warReadinessService';
import { WareraCountryFlag } from '../common/WareraCountryFlag';
import {
  Swords,
  Shield,
  Users,
  Factory,
  Calculator,
  Plus,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Info,
  Scale,
  Award,
} from 'lucide-react';

interface WarReadinessEvaluationProps {
  auditedCountryId: string;
  auditedCountryName: string;
  countries: WareraCountry[];
}

export const WarReadinessEvaluation: React.FC<WarReadinessEvaluationProps> = ({
  auditedCountryId,
  auditedCountryName,
  countries,
}) => {
  // Step A: Participant State Selection
  // Automatically defaults Allied Primary State to the currently audited state
  const [alliedMainId, setAlliedMainId] = useState<string>(auditedCountryId);
  const [alliedSupporterIds, setAlliedSupporterIds] = useState<string[]>([]);
  const [opponentMainId, setOpponentMainId] = useState<string>('');
  const [opponentSupporterIds, setOpponentSupporterIds] = useState<string[]>([]);

  // Supporter selector search inputs
  const [alliedSearch, setAlliedSearch] = useState('');
  const [opponentSearch, setOpponentSearch] = useState('');
  const [opponentMainSearch, setOpponentMainSearch] = useState('');
  const [isAlliedDropdownOpen, setIsAlliedDropdownOpen] = useState(false);
  const [isOpponentDropdownOpen, setIsOpponentDropdownOpen] = useState(false);

  // Per-state evaluation reports keyed by countryId
  const [reportsByCountryId, setReportsByCountryId] = useState<
    Record<string, StateWarReadinessReport>
  >({});

  // Expanded citizen rosters per countryId
  const [expandedRosterCountryIds, setExpandedRosterCountryIds] = useState<
    Record<string, 'war-ready' | 'tier5' | null>
  >({});

  // Keep alliedMainId synced when user switches audited country in the top header
  useEffect(() => {
    if (auditedCountryId && auditedCountryId !== alliedMainId) {
      setAlliedMainId(auditedCountryId);
      setAlliedSupporterIds((prev) => prev.filter((id) => id !== auditedCountryId));
      if (opponentMainId === auditedCountryId) {
        setOpponentMainId('');
      }
      setOpponentSupporterIds((prev) => prev.filter((id) => id !== auditedCountryId));
    }
  }, [auditedCountryId]);

  const sortedCountries = useMemo(() => {
    return [...countries].sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  const countryMap = useMemo(() => {
    const map = new Map<string, WareraCountry>();
    countries.forEach((c) => map.set(c._id, c));
    return map;
  }, [countries]);

  // All selected participant descriptors in evaluation order
  const selectedParticipants = useMemo(() => {
    const list: Array<{ country: WareraCountry; role: WarReadinessRole }> = [];

    if (alliedMainId) {
      const c = countryMap.get(alliedMainId);
      if (c) list.push({ country: c, role: 'allied-main' });
    }
    alliedSupporterIds.forEach((id) => {
      const c = countryMap.get(id);
      if (c) list.push({ country: c, role: 'allied-supporter' });
    });
    if (opponentMainId) {
      const c = countryMap.get(opponentMainId);
      if (c) list.push({ country: c, role: 'opponent-main' });
    }
    opponentSupporterIds.forEach((id) => {
      const c = countryMap.get(id);
      if (c) list.push({ country: c, role: 'opponent-supporter' });
    });

    return list;
  }, [
    alliedMainId,
    alliedSupporterIds,
    opponentMainId,
    opponentSupporterIds,
    countryMap,
  ]);

  const allSelectedIds = useMemo(() => {
    return new Set(selectedParticipants.map((p) => p.country._id));
  }, [selectedParticipants]);

  // Track active evaluation runs to avoid duplicate concurrent scans for the same country
  const activeScanSetRef = useRef<Set<string>>(new Set());

  const triggerEvaluationForState = async (
    country: WareraCountry,
    role: WarReadinessRole,
    forceRefresh = false
  ) => {
    const cid = country._id;
    if (!forceRefresh && activeScanSetRef.current.has(cid)) {
      return;
    }

    if (!forceRefresh) {
      const cached = getCachedWarReadinessReport(cid, role);
      if (cached && cached.scanStatus === 'completed') {
        setReportsByCountryId((prev) => ({
          ...prev,
          [cid]: cached,
        }));
        return;
      }
    }

    activeScanSetRef.current.add(cid);
    try {
      await evaluateStateWarReadiness(country, role, {
        forceRefresh,
        onProgress: (updatedReport) => {
          setReportsByCountryId((prev) => ({
            ...prev,
            [cid]: {
              ...updatedReport,
              role,
            },
          }));
        },
      });
    } finally {
      activeScanSetRef.current.delete(cid);
    }
  };

  // Automatically evaluate any newly selected state
  useEffect(() => {
    selectedParticipants.forEach(({ country, role }) => {
      const existing = reportsByCountryId[country._id];
      if (!existing) {
        triggerEvaluationForState(country, role, false);
      } else if (existing.role !== role) {
        setReportsByCountryId((prev) => ({
          ...prev,
          [country._id]: {
            ...existing,
            role,
          },
        }));
      }
    });
  }, [selectedParticipants]);

  const handleRefreshAll = () => {
    selectedParticipants.forEach(({ country, role }) => {
      triggerEvaluationForState(country, role, true);
    });
  };

  const handleAddAlliedSupporter = (cid: string) => {
    if (!cid || allSelectedIds.has(cid)) return;
    setAlliedSupporterIds((prev) => [...prev, cid]);
    setAlliedSearch('');
    setIsAlliedDropdownOpen(false);
  };

  const handleRemoveAlliedSupporter = (cid: string) => {
    setAlliedSupporterIds((prev) => prev.filter((id) => id !== cid));
  };

  const handleAddOpponentSupporter = (cid: string) => {
    if (!cid || allSelectedIds.has(cid)) return;
    setOpponentSupporterIds((prev) => [...prev, cid]);
    setOpponentSearch('');
    setIsOpponentDropdownOpen(false);
  };

  const handleRemoveOpponentSupporter = (cid: string) => {
    setOpponentSupporterIds((prev) => prev.filter((id) => id !== cid));
  };

  // Separate reports into Allied Coalition vs Opponent Coalition
  const alliedParticipants = selectedParticipants.filter(
    (p) => p.role === 'allied-main' || p.role === 'allied-supporter'
  );
  const opponentParticipants = selectedParticipants.filter(
    (p) => p.role === 'opponent-main' || p.role === 'opponent-supporter'
  );

  const computeCoalitionTotals = (
    items: Array<{ country: WareraCountry; role: WarReadinessRole }>
  ) => {
    let activePopulation = 0;
    let warReadyCitizensCount = 0;
    let averageWarParticipants = 0;
    let tier5IndustrialCitizensCount = 0;
    let isScanning = false;

    items.forEach(({ country }) => {
      const rep = reportsByCountryId[country._id];
      if (rep) {
        activePopulation += rep.activePopulation;
        warReadyCitizensCount += rep.warReadyCitizensCount;
        averageWarParticipants += rep.averageWarParticipants;
        tier5IndustrialCitizensCount += rep.tier5IndustrialCitizensCount;
        if (
          rep.scanStatus === 'fetching-census' ||
          rep.scanStatus === 'scanning-companies'
        ) {
          isScanning = true;
        }
      }
    });

    return {
      stateCount: items.length,
      activePopulation,
      warReadyCitizensCount,
      averageWarParticipants: Number(averageWarParticipants.toFixed(1)),
      tier5IndustrialCitizensCount,
      isScanning,
    };
  };

  const alliedTotals = useMemo(
    () => computeCoalitionTotals(alliedParticipants),
    [alliedParticipants, reportsByCountryId]
  );

  const opponentTotals = useMemo(
    () => computeCoalitionTotals(opponentParticipants),
    [opponentParticipants, reportsByCountryId]
  );

  const isAnyScanning = alliedTotals.isScanning || opponentTotals.isScanning;

  const availableForAlliedSupporter = useMemo(() => {
    const q = alliedSearch.trim().toLowerCase();
    return sortedCountries.filter(
      (c) =>
        !allSelectedIds.has(c._id) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)))
    );
  }, [sortedCountries, allSelectedIds, alliedSearch]);

  const availableForOpponentMain = useMemo(() => {
    const q = opponentMainSearch.trim().toLowerCase();
    return sortedCountries.filter(
      (c) =>
        c._id !== alliedMainId &&
        !alliedSupporterIds.includes(c._id) &&
        !opponentSupporterIds.includes(c._id) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)))
    );
  }, [
    sortedCountries,
    alliedMainId,
    alliedSupporterIds,
    opponentSupporterIds,
    opponentMainSearch,
  ]);

  const availableForOpponentSupporter = useMemo(() => {
    const q = opponentSearch.trim().toLowerCase();
    return sortedCountries.filter(
      (c) =>
        !allSelectedIds.has(c._id) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)))
    );
  }, [sortedCountries, allSelectedIds, opponentSearch]);

  const renderComparisonBar = (
    label: string,
    subtitle: string,
    alliedVal: number,
    opponentVal: number,
    accentClass: string
  ) => {
    const total = alliedVal + opponentVal;
    const alliedPct = total > 0 ? Math.round((alliedVal / total) * 100) : 50;
    const opponentPct = total > 0 ? 100 - alliedPct : 50;

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
              <span>{label}</span>
            </div>
            <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{subtitle}</div>
          </div>
          {opponentParticipants.length > 0 && total > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200 font-bold shrink-0">
              {alliedPct}% vs {opponentPct}%
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between font-mono pt-1">
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {alliedVal.toLocaleString()}
            <span className="text-xs sm:text-sm text-emerald-400/90 font-sans ml-1.5 font-bold">
              Allied
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-400">
            {opponentParticipants.length > 0 ? opponentVal.toLocaleString() : '—'}
            <span className="text-xs sm:text-sm text-rose-400/90 font-sans ml-1.5 font-bold">
              Opponent
            </span>
          </div>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${accentClass}`}
            style={{
              width: `${
                opponentParticipants.length === 0 ? 100 : Math.max(5, Math.min(95, alliedPct))
              }%`,
            }}
          />
          {opponentParticipants.length > 0 && (
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300"
              style={{ width: `${Math.max(5, Math.min(95, opponentPct))}%` }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderStateCard = (
    country: WareraCountry,
    role: WarReadinessRole
  ) => {
    const report = reportsByCountryId[country._id];
    const isAllied = role === 'allied-main' || role === 'allied-supporter';
    const isMain = role === 'allied-main' || role === 'opponent-main';
    const expandedTab = expandedRosterCountryIds[country._id] || null;

    const scanPct =
      report && report.totalCandidates > 0
        ? Math.min(100, Math.round((report.scannedCandidates / report.totalCandidates) * 100))
        : 0;

    return (
      <div
        key={country._id}
        className={`p-5 sm:p-6 rounded-2xl bg-slate-900/95 border shadow-xl space-y-5 transition ${
          isAllied
            ? isMain
              ? 'border-emerald-500/50 shadow-emerald-950/20'
              : 'border-emerald-500/25'
            : isMain
            ? 'border-rose-500/50 shadow-rose-950/20'
            : 'border-rose-500/25'
        }`}
      >
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-base border ${
                isAllied
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              <WareraCountryFlag
                countryName={country.name}
                countryCode={country.code}
                size="lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-lg sm:text-xl font-black text-white">{country.name}</h4>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                    role === 'allied-main'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : role === 'allied-supporter'
                      ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                      : role === 'opponent-main'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                  }`}
                >
                  {role === 'allied-main' && '🛡️ Allied Primary State'}
                  {role === 'allied-supporter' && '🤝 Allied Supporting State'}
                  {role === 'opponent-main' && '⚔️ Opponent Primary State'}
                  {role === 'opponent-supporter' && '🚩 Opponent Supporting State'}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono mt-1 flex items-center gap-2">
                <span>ID: {country._id.slice(-8)}</span>
                {report?.lastEvaluatedAt && (
                  <>
                    <span>·</span>
                    <span>
                      Evaluated {new Date(report.lastEvaluatedAt).toLocaleTimeString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status & Refresh / Remove Controls */}
          <div className="flex items-center gap-2">
            {report?.scanStatus === 'fetching-census' && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Resolving Active Census...
              </span>
            )}
            {report?.scanStatus === 'scanning-companies' && (
              <span className="px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scanning Auto-5 Companies ({report.scannedCandidates}/{report.totalCandidates})
              </span>
            )}
            {report?.scanStatus === 'completed' && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Verified
              </span>
            )}

            <button
              type="button"
              onClick={() => triggerEvaluationForState(country, role, true)}
              disabled={
                report?.scanStatus === 'fetching-census' ||
                report?.scanStatus === 'scanning-companies'
              }
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition disabled:opacity-50"
              title="Re-evaluate state war readiness from live API"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  report?.scanStatus === 'fetching-census' ||
                  report?.scanStatus === 'scanning-companies'
                    ? 'animate-spin text-cyan-400'
                    : ''
                }`}
              />
            </button>

            {role === 'allied-supporter' && (
              <button
                type="button"
                onClick={() => handleRemoveAlliedSupporter(country._id)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 transition"
                title="Remove supporting state"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {role === 'opponent-supporter' && (
              <button
                type="button"
                onClick={() => handleRemoveOpponentSupporter(country._id)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 transition"
                title="Remove opponent supporting state"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Scan Progress Bar when verifying 12-company automation levels */}
        {report &&
          (report.scanStatus === 'fetching-census' ||
            report.scanStatus === 'scanning-companies') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                <span>
                  {report.scanStatus === 'fetching-census'
                    ? `Step 1/2: Fetching active citizen census for ${country.name}...`
                    : `Step 2/2: Inspecting citizen company upgrades (12x Automation Lvl 5+) — ${report.scannedCandidates} of ${report.totalCandidates} citizens checked`}
                </span>
                <span>{scanPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.max(8, scanPct)}%` }}
                />
              </div>
            </div>
          )}

        {/* 4 Separate Data Point Cards (Active Pop, War-Ready Lvl 25+, Average War Participants, Tier-5 Industrial Citizens) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Metric 1: Active Population */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Active Population</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
              {report ? report.activePopulation.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Every active citizen (Lvl 10+)
            </div>
          </div>

          {/* Metric 2 (Step B): War-Ready Citizens (Lvl 25+) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/35 flex flex-col justify-between">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-amber-400 shrink-0" />
              <span>War-Ready Citizens</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 mt-2">
              {report ? report.warReadyCitizensCount.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Active citizens at <strong className="text-white">Lvl 25+</strong>
            </div>
          </div>

          {/* Metric 3 (Step C): Average War Participants */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/35 flex flex-col justify-between">
            <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Avg. War Participants</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 mt-2">
              {report ? report.averageWarParticipants.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Active Population ÷ 2
            </div>
          </div>

          {/* Metric 4 (Step D): Tier-5 Industrial Citizens */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/35 flex flex-col justify-between">
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Tier-5 Industrial</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300 mt-2 flex items-center gap-2">
              <span>
                {report ? report.tier5IndustrialCitizensCount.toLocaleString() : '—'}
              </span>
              {report?.scanStatus === 'scanning-companies' && (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              )}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              12 Companies @ Auto Lvl 5+
            </div>
          </div>
        </div>

        {/* Step F: Explicit Calculation & Formula Breakdown Box for this State */}
        {report && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/85 border border-slate-800/90 space-y-3 text-sm">
            <div className="font-extrabold text-slate-100 flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>How {country.name}&apos;s Metrics Were Calculated</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 font-mono text-xs sm:text-sm text-slate-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-amber-300 font-bold font-sans">
                  1. War-Ready Citizens (Lvl 25+):
                </span>
                <span>
                  {report.activePopulation} active citizens filtered by{' '}
                  <span className="text-amber-300 font-bold">Level ≥ 25</span> ={' '}
                  <strong className="text-white text-base">{report.warReadyCitizensCount}</strong>{' '}
                  citizens (
                  {report.activePopulation > 0
                    ? Math.round(
                        (report.warReadyCitizensCount / report.activePopulation) * 100
                      )
                    : 0}
                  % of active pop)
                </span>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-cyan-300 font-bold font-sans">
                  2. Average War Participants:
                </span>
                <span>
                  {report.activePopulation} active citizens{' '}
                  <span className="text-cyan-300 font-bold">÷ 2</span> ={' '}
                  <strong className="text-white text-base">
                    {report.averageWarParticipants}
                  </strong>{' '}
                  expected frontline participants
                </span>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-emerald-300 font-bold font-sans">
                  3. Tier-5 Industrial Citizens:
                </span>
                <span>
                  Active citizens owning{' '}
                  <span className="text-emerald-300 font-bold">
                    12 companies all at Automation Level ≥ 5
                  </span>{' '}
                  ={' '}
                  <strong className="text-white text-base">
                    {report.tier5IndustrialCitizensCount}
                  </strong>{' '}
                  citizens
                  {report.warReadyCitizensCount > 0 && (
                    <span className="text-slate-300">
                      {' '}
                      (
                      {Math.round(
                        (report.tier5IndustrialCitizensCount /
                          report.warReadyCitizensCount) *
                          100
                      )}
                      % of War-Ready cohort)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Expandable Citizen Roster Drill-Down */}
            <div className="pt-1.5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setExpandedRosterCountryIds((prev) => ({
                    ...prev,
                    [country._id]:
                      prev[country._id] === 'tier5' ? null : 'tier5',
                  }))
                }
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition ${
                  expandedTab === 'tier5'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
              >
                <Factory className="w-4 h-4 text-emerald-400" />
                <span>
                  Inspect Tier-5 Industrial Citizens ({report.tier5IndustrialRoster.length})
                </span>
                {expandedTab === 'tier5' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setExpandedRosterCountryIds((prev) => ({
                    ...prev,
                    [country._id]:
                      prev[country._id] === 'war-ready' ? null : 'war-ready',
                  }))
                }
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition ${
                  expandedTab === 'war-ready'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>
                  Inspect War-Ready Lvl 25+ Roster ({report.warReadyRoster.length})
                </span>
                {expandedTab === 'war-ready' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {expandedTab && (
              <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 max-h-64 overflow-y-auto space-y-2">
                {expandedTab === 'tier5' ? (
                  report.tier5IndustrialRoster.length === 0 ? (
                    <div className="text-center py-4 text-slate-300 text-sm">
                      {report.scanStatus === 'scanning-companies'
                        ? 'Scanning citizen companies for 12x Automation Level 5+...'
                        : 'No active citizens in this state currently have 12 companies all at Automation Level 5+.'}
                    </div>
                  ) : (
                    report.tier5IndustrialRoster.map((c) => (
                      <div
                        key={c.userId}
                        className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-950/90 border border-slate-800 text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-white">{c.username}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs font-semibold">
                            Lvl {c.level}
                          </span>
                        </div>
                        <div className="font-mono text-emerald-300 font-bold text-xs sm:text-sm">
                          {c.auto5CompaniesCount}/{c.totalCompanies} Companies @ Auto Lvl 5+
                        </div>
                      </div>
                    ))
                  )
                ) : report.warReadyRoster.length === 0 ? (
                  <div className="text-center py-4 text-slate-300 text-sm">
                    No active citizens at Level 25+ found in this state.
                  </div>
                ) : (
                  report.warReadyRoster.map((c) => (
                    <div
                      key={c.userId}
                      className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-950/90 border border-slate-800 text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white">{c.username}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-semibold">
                          Lvl {c.level}
                        </span>
                      </div>
                      <div className="font-mono text-xs sm:text-sm flex items-center gap-2">
                        {c.isTier5Industrial ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                            🏭 Tier-5 Industrial ({c.auto5CompaniesCount}/12 Auto-5)
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            {c.auto5CompaniesCount}/{c.totalCompanies} Auto-5 Companies
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Module Header & Methodology Callout */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/30 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
              <Swords className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                  Strategic Coalition Intelligence
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold">
                  Primary State Auto-Locked: {auditedCountryName}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Economic War-Readiness &amp; Coalition Evaluation
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Compare Allied and Opponent states across Active Population, War-Ready Citizens (Lvl 25+), Average War Participants (Active ÷ 2), and Tier-5 Industrial Citizens (12 Companies @ Automation Lvl 5).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isAnyScanning}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 transition shadow-md disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isAnyScanning ? 'animate-spin' : ''}`}
              />
              <span>
                {isAnyScanning
                  ? 'Scanning Coalition States...'
                  : 'Re-Evaluate All Selected States'}
              </span>
            </button>
          </div>
        </div>

        {/* 4-Step Doctrine Pill Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-sm">
          <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800/80 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black shrink-0">
              STEP A
            </span>
            <div className="text-xs sm:text-sm text-slate-200 leading-snug">
              <strong className="text-white block">Coalition Roster</strong>
              Primary states + custom diplomatic supporting states.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800/80 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-black shrink-0">
              STEP B
            </span>
            <div className="text-xs sm:text-sm text-slate-200 leading-snug">
              <strong className="text-white block">War-Ready Citizens</strong>
              Active citizens filtered by <strong>Level 25+</strong>.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800/80 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-black shrink-0">
              STEP C
            </span>
            <div className="text-xs sm:text-sm text-slate-200 leading-snug">
              <strong className="text-white block">Avg. War Participants</strong>
              Total Active Population <strong>divided by 2</strong>.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800/80 flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-black shrink-0">
              STEP D
            </span>
            <div className="text-xs sm:text-sm text-slate-200 leading-snug">
              <strong className="text-white block">Tier-5 Industrial Citizens</strong>
              Active citizens with <strong>12 companies all at Auto Lvl 5+</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* STEP A: Coalition & Participant State Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Box: Allied Coalition Builder */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Allied Coalition States
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Your primary audited state + allied supporting states
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-xs sm:text-sm font-bold">
              {alliedParticipants.length} State{alliedParticipants.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Allied Primary State Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-slate-200">
              Allied Primary State (Auto-selected from current audit)
            </label>
            <select
              value={alliedMainId}
              onChange={(e) => {
                const nextId = e.target.value;
                setAlliedMainId(nextId);
                setAlliedSupporterIds((prev) => prev.filter((id) => id !== nextId));
              }}
              className="w-full h-10 px-3.5 bg-slate-950 border border-emerald-500/40 rounded-xl text-sm text-white font-bold focus:outline-none focus:border-emerald-400"
            >
              {sortedCountries.map((c) => (
                <option
                  key={c._id}
                  value={c._id}
                  disabled={
                    c._id === opponentMainId || opponentSupporterIds.includes(c._id)
                  }
                >
                  {c.name} ({c.code}) — Official Active Pop:{' '}
                  {c.rankings?.countryActivePopulation?.value ?? 0}
                </option>
              ))}
            </select>
          </div>

          {/* Allied Supporting States Multi-Selector */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-bold text-slate-200">
              Allied Supporting States ({alliedSupporterIds.length})
            </label>

            {/* Selected Allied Supporter Chips */}
            {alliedSupporterIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alliedSupporterIds.map((cid) => {
                  const c = countryMap.get(cid);
                  if (!c) return null;
                  return (
                    <span
                      key={cid}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2"
                    >
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAlliedSupporter(cid)}
                        className="text-emerald-400 hover:text-white"
                        title="Remove supporter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Add Allied Supporter Searchable Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={alliedSearch}
                    onFocus={() => setIsAlliedDropdownOpen(true)}
                    onChange={(e) => {
                      setAlliedSearch(e.target.value);
                      setIsAlliedDropdownOpen(true);
                    }}
                    placeholder="Search country to add as Allied Supporter..."
                    className="w-full h-10 pl-10 pr-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {isAlliedDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => setIsAlliedDropdownOpen(false)}
                    className="h-10 px-3 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs sm:text-sm font-bold"
                  >
                    Close
                  </button>
                )}
              </div>

              {isAlliedDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-slate-950 border border-slate-700 shadow-2xl divide-y divide-slate-800/60">
                  {availableForAlliedSupporter.length === 0 ? (
                    <div className="p-3.5 text-center text-sm text-slate-400">
                      No matching unassigned countries found.
                    </div>
                  ) : (
                    availableForAlliedSupporter.slice(0, 40).map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => handleAddAlliedSupporter(c._id)}
                        className="w-full px-3.5 py-2.5 text-left text-sm text-slate-200 hover:bg-emerald-500/15 hover:text-emerald-300 flex items-center justify-between transition"
                      >
                        <span className="font-bold">
                          {c.name}{' '}
                          <span className="text-slate-400 font-mono">({c.code})</span>
                        </span>
                        <span className="font-mono text-xs text-slate-300 flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add Supporter
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Box: Opponent Coalition Builder */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Opponent Coalition States
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Select main adversary state + opponent supporting states
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono text-xs sm:text-sm font-bold">
              {opponentParticipants.length} State
              {opponentParticipants.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Opponent Primary State Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-slate-200">
              Opponent Primary State
            </label>
            <div className="flex items-center gap-2">
              <select
                value={opponentMainId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setOpponentMainId(nextId);
                  setOpponentSupporterIds((prev) =>
                    prev.filter((id) => id !== nextId)
                  );
                }}
                className="w-full h-10 px-3.5 bg-slate-950 border border-rose-500/40 rounded-xl text-sm text-white font-bold focus:outline-none focus:border-rose-400"
              >
                <option value="">-- Select Opponent Primary State --</option>
                {availableForOpponentMain.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code}) — Official Active Pop:{' '}
                    {c.rankings?.countryActivePopulation?.value ?? 0}
                  </option>
                ))}
              </select>
              {opponentMainId && (
                <button
                  type="button"
                  onClick={() => setOpponentMainId('')}
                  className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold shrink-0"
                  title="Clear opponent primary state"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Opponent Supporting States Multi-Selector */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-bold text-slate-200">
              Opponent Supporting States ({opponentSupporterIds.length})
            </label>

            {opponentSupporterIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {opponentSupporterIds.map((cid) => {
                  const c = countryMap.get(cid);
                  if (!c) return null;
                  return (
                    <span
                      key={cid}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2"
                    >
                      <span>{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOpponentSupporter(cid)}
                        className="text-rose-400 hover:text-white"
                        title="Remove opponent supporter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={opponentSearch}
                    onFocus={() => setIsOpponentDropdownOpen(true)}
                    onChange={(e) => {
                      setOpponentSearch(e.target.value);
                      setIsOpponentDropdownOpen(true);
                    }}
                    placeholder="Search country to add as Opponent Supporter..."
                    className="w-full h-10 pl-10 pr-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
                  />
                </div>
                {isOpponentDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => setIsOpponentDropdownOpen(false)}
                    className="h-10 px-3 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs sm:text-sm font-bold"
                  >
                    Close
                  </button>
                )}
              </div>

              {isOpponentDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-slate-950 border border-slate-700 shadow-2xl divide-y divide-slate-800/60">
                  {availableForOpponentSupporter.length === 0 ? (
                    <div className="p-3.5 text-center text-sm text-slate-400">
                      No matching unassigned countries found.
                    </div>
                  ) : (
                    availableForOpponentSupporter.slice(0, 40).map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => handleAddOpponentSupporter(c._id)}
                        className="w-full px-3.5 py-2.5 text-left text-sm text-slate-200 hover:bg-rose-500/15 hover:text-rose-300 flex items-center justify-between transition"
                      >
                        <span className="font-bold">
                          {c.name}{' '}
                          <span className="text-slate-400 font-mono">({c.code})</span>
                        </span>
                        <span className="font-mono text-xs text-slate-300 flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-rose-400" /> Add Opponent Supporter
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* COMBINED COALITION TOTALS COMPARISON BANNER */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span>Combined Coalition Force &amp; Industrial Readiness Totals</span>
            </h3>
            <p className="text-sm text-slate-300 mt-0.5">
              Aggregate comparison across all selected Allied ({alliedTotals.stateCount}) vs. Opponent ({opponentTotals.stateCount}) coalition states
            </p>
          </div>
          {opponentParticipants.length === 0 && (
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              Select an Opponent State above for head-to-head coalition ratios
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderComparisonBar(
            'Active Population',
            'Every active citizen (Lvl 10+)',
            alliedTotals.activePopulation,
            opponentTotals.activePopulation,
            'bg-gradient-to-r from-emerald-500 to-teal-400'
          )}
          {renderComparisonBar(
            'War-Ready Citizens (Lvl 25+)',
            'Active citizens filtered by Level ≥ 25',
            alliedTotals.warReadyCitizensCount,
            opponentTotals.warReadyCitizensCount,
            'bg-gradient-to-r from-amber-500 to-yellow-400'
          )}
          {renderComparisonBar(
            'Average War Participants',
            'Active Population ÷ 2',
            alliedTotals.averageWarParticipants,
            opponentTotals.averageWarParticipants,
            'bg-gradient-to-r from-cyan-500 to-sky-400'
          )}
          {renderComparisonBar(
            'Tier-5 Industrial Citizens',
            'Active citizens with 12 Companies @ Auto Lvl 5+',
            alliedTotals.tier5IndustrialCitizensCount,
            opponentTotals.tier5IndustrialCitizensCount,
            'bg-gradient-to-r from-emerald-500 to-lime-400'
          )}
        </div>
      </div>

      {/* PER-STATE BREAKDOWN CARDS & FORMULA EXPLANATIONS (STEP F) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Allied State Breakdown Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base sm:text-lg font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Allied Per-State Breakdown ({alliedParticipants.length})</span>
            </h3>
          </div>
          {alliedParticipants.map(({ country, role }) =>
            renderStateCard(country, role)
          )}
        </div>

        {/* Opponent State Breakdown Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base sm:text-lg font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <Swords className="w-5 h-5" />
              <span>Opponent Per-State Breakdown ({opponentParticipants.length})</span>
            </h3>
          </div>
          {opponentParticipants.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2.5">
              <Swords className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-slate-200">
                No Opponent States Selected Yet
              </div>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Choose an Opponent Primary State or add Opponent Supporting States above to evaluate their War-Ready Citizens (Lvl 25+), Average War Participants, and Tier-5 Industrial Citizens side by side.
              </p>
            </div>
          ) : (
            opponentParticipants.map(({ country, role }) =>
              renderStateCard(country, role)
            )
          )}
        </div>
      </div>
    </div>
  );
};
