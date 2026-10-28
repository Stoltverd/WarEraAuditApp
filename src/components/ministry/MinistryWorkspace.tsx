import React, { useState, useEffect } from 'react';
import { CitizenRadar } from './CitizenRadar';
import { TreasuryLedger } from './TreasuryLedger';
import { StockpileTracker } from './StockpileTracker';
import { MarketAdvisor } from './MarketAdvisor';
import { WorkforceAdvisor } from './WorkforceAdvisor';
import { WarReadinessEvaluation } from './WarReadinessEvaluation';
import { AuditProgressDock } from './AuditProgressDock';
import { auditStreamService, AutoAuditStreamState } from '../../services/auditStreamService';
import {
  CitizenEconomicProfile,
  NationalTransaction,
  ResourceReserveItem,
  CommodityTrend,
  RespecAlert,
  PlayerTag,
  MinistryConfig,
  WatchedCitizen,
  WealthSnapshot,
  CountryEconomicBenchmark,
  NudgeArchetype,
  DiplomaticActionMode,
  CommendationArchetype,
  OverDonationWarningArchetype,
} from '../../types/ministry';
import { WareraCountry, SyncProgress } from '../../types/warera';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { compareTransactionsNewestFirst } from '../../services/apiService';
import {
  Shield,
  Coins,
  TrendingUp,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  Users,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  X,
  Check,
  Send,
  Edit2,
  HardDrive,
  Download,
  Upload,
  ShieldCheck,
  FileJson,
  Info,
  Tag,
  Copy,
  ShieldAlert,
  Camera,
  Lock,
  RefreshCw,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Swords,
} from 'lucide-react';
import {
  generateMinisterialNudge,
  calculateCitizenSuggestedDonation,
  exportConsolidatedExecutiveDigest,
} from '../../services/ministryService';
import { storage } from '../../services/storage';

interface MinistryWorkspaceProps {
  countryName: string;
  countryId: string;
  countries: WareraCountry[];
  profiles: CitizenEconomicProfile[];
  transactions: NationalTransaction[];
  stockpiles: ResourceReserveItem[];
  commodities: CommodityTrend[];
  alerts: RespecAlert[];
  watchedCitizens?: WatchedCitizen[];
  config?: MinistryConfig;
  apiKey?: string;
  isAuditingIncome?: boolean;
  totalActiveCitizens?: number;
  isSyncing?: boolean;
  syncProgress?: SyncProgress | null;
  onUpdateConfig?: (cfg: MinistryConfig) => void;
  onUpdateTag: (userId: string, tag: PlayerTag, notes?: string) => void;
  onAddTransaction: (tx: NationalTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onImportTransactions: (txs: NationalTransaction[]) => void;
  onUpdateStockpile: (updated: ResourceReserveItem[]) => void;
  onAcknowledgeAlert: (id: string) => void;
  onPutOnWatch?: (profile: CitizenEconomicProfile, reasonNote: string) => void;
  onRemoveFromWatch?: (userId: string) => void;
  onRunIncomeAudit?: () => void;
  onRestoreBackup?: () => void;
  onOpenKeyModal?: () => void;
  onOpenDiagnostics?: () => void;
  countryBenchmark?: CountryEconomicBenchmark;
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
  onUpdateProfilesBatch?: (updatedList: CitizenEconomicProfile[]) => void;
}

export const MinistryWorkspace: React.FC<MinistryWorkspaceProps> = ({
  countryName,
  countryId,
  countries,
  profiles,
  transactions,
  stockpiles,
  commodities,
  alerts,
  watchedCitizens = [],
  config,
  apiKey,
  isAuditingIncome = false,
  totalActiveCitizens,
  isSyncing = false,
  syncProgress = null,
  countryBenchmark,
  onUpdateConfig,
  onUpdateTag,
  onAddTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onUpdateStockpile,
  onAcknowledgeAlert,
  onPutOnWatch,
  onRemoveFromWatch,
  onRunIncomeAudit,
  onRestoreBackup,
  onOpenKeyModal,
  onOpenDiagnostics,
  onUpdateProfile,
  onUpdateProfilesBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'radar' | 'war-readiness' | 'workforce' | 'treasury' | 'stockpiles' | 'market' | 'watch'>('radar');
  const [watchSearch, setWatchSearch] = useState('');
  const [isAddWatchModalOpen, setIsAddWatchModalOpen] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [addWatchNote, setAddWatchNote] = useState('');
  const [activeNudgeProfile, setActiveNudgeProfile] = useState<CitizenEconomicProfile | null>(null);
  const [diplomaticModeOverride, setDiplomaticModeOverride] = useState<DiplomaticActionMode | undefined>(undefined);
  const [nudgeArchetypeOverride, setNudgeArchetypeOverride] = useState<NudgeArchetype | undefined>(undefined);
  const [commendationArchetypeOverride, setCommendationArchetypeOverride] = useState<CommendationArchetype | undefined>(undefined);
  const [overDonationArchetypeOverride, setOverDonationArchetypeOverride] = useState<OverDonationWarningArchetype | undefined>(undefined);
  const [customNudgeBtc, setCustomNudgeBtc] = useState<number | undefined>(undefined);
  const [copiedNudgeIndex, setCopiedNudgeIndex] = useState<number | null>(null);

  useEffect(() => {
    setDiplomaticModeOverride(undefined);
    setNudgeArchetypeOverride(undefined);
    setCommendationArchetypeOverride(undefined);
    setOverDonationArchetypeOverride(undefined);
    setCustomNudgeBtc(undefined);
    setCopiedNudgeIndex(null);
  }, [activeNudgeProfile?.userId]);

  // Background Stream Dock State
  const [streamState, setStreamState] = useState<AutoAuditStreamState>(() => auditStreamService.getState());
  useEffect(() => {
    const unsub = auditStreamService.subscribe(setStreamState);
    return unsub;
  }, []);

  // Backup & Safeguard Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);

  // Active Citizens Snapshot State & Integrity Safeguards
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState({ current: 0, total: 0, pct: 0, citizenName: '' });
  const [snapshotResult, setSnapshotResult] = useState<{ count: number; timestamp: string } | null>(null);

  // Authoritative Active Census Calculation
  const authoritativeActiveCount = totalActiveCitizens && totalActiveCitizens > 0 ? totalActiveCitizens : profiles.length;
  const isCensusAuditing = Boolean(isSyncing) || (totalActiveCitizens !== undefined && totalActiveCitizens > 0 && profiles.length < totalActiveCitizens);
  const censusPct = authoritativeActiveCount > 0 ? Math.min(100, Math.round((profiles.length / authoritativeActiveCount) * 100)) : 100;

  const handleStartSnapshotCapture = async () => {
    if (isTakingSnapshot || profiles.length === 0) return;
    setIsTakingSnapshot(true);
    setSnapshotResult(null);
    setSnapshotProgress({ current: 0, total: profiles.length, pct: 0, citizenName: 'Initializing database transaction...' });

    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = Date.now();
      const snapshotsToSave: WealthSnapshot[] = [];

      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i];
        setSnapshotProgress({
          current: i + 1,
          total: profiles.length,
          pct: Math.round(((i + 1) / profiles.length) * 100),
          citizenName: p.username || `Citizen #${p.userId.slice(-6)}`,
        });

        const weeklyDmg = p.totalCombatDamage || 0;
        const lifeDmg = p.lifetimeCombatDamage || weeklyDmg;

        snapshotsToSave.push({
          id: `${p.userId}_${today}`,
          userId: p.userId,
          countryId: p.countryId || countryId,
          wealthBtc: p.wealthBtc || 0,
          weeklyDamage: weeklyDmg,
          lifetimeDamage: lifeDmg,
          timestamp: now,
          dateStr: today,
        });

        if (i % 20 === 0) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      await storage.saveWealthSnapshotsBatch(snapshotsToSave);
      setSnapshotResult({
        count: snapshotsToSave.length,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      console.error('Failed to capture active citizen snapshots:', err);
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const watchedUserIds = new Set(watchedCitizens.map((w) => w.userId));
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  };

  const filteredWatched = watchedCitizens.filter((w) => {
    if (!watchSearch.trim()) return true;
    const q = watchSearch.toLowerCase();
    return w.username.toLowerCase().includes(q) || w.reasonNote.toLowerCase().includes(q) || w.userId.toLowerCase().includes(q);
  });

  const handleExportBackup = async () => {
    try {
      setIsProcessingBackup(true);
      const jsonStr = await storage.exportFullBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `warera-sovereign-backup-${countryName.toLowerCase()}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMessage({ text: 'Sovereign database backup downloaded successfully! Safeguard this file on your drive.' });
    } catch (err: any) {
      setBackupMessage({ text: `Backup export failed: ${err?.message}`, isError: true });
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const handleExportExecutiveDigest = () => {
    try {
      const csvContent = exportConsolidatedExecutiveDigest({
        countryName,
        periodDays: config?.analysisPeriodDays || 7,
        profiles,
        transactions,
        stockpiles,
        commodities,
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `warera-executive-digest-${countryName.toLowerCase()}-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export executive digest:', err);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingBackup(true);
      const text = await file.text();
      const res = await storage.importFullBackup(text);
      if (res.success) {
        setBackupMessage({ text: `${res.message} (${res.count} records restored). Updating workspace...` });
        onRestoreBackup?.();
      } else {
        setBackupMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setBackupMessage({ text: `Restore failed: ${err?.message}`, isError: true });
    } finally {
      setIsProcessingBackup(false);
      e.target.value = '';
    }
  };

  const handleSaveNewWatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddUserId) return;
    const target = profiles.find((p) => p.userId === selectedAddUserId);
    if (!target) return;
    onPutOnWatch?.(target, addWatchNote.trim() || 'Flagged for surveillance by Ministry of Economy.');
    setIsAddWatchModalOpen(false);
    setSelectedAddUserId('');
    setAddWatchNote('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Executive Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-2xl shadow-lg">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Executive Sovereign Command
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  {countryName} Ministry of Economy
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-bold border border-slate-700 flex items-center gap-1.5 shadow-sm">
                  <Users className="w-3 h-3 text-amber-400" />
                  {authoritativeActiveCount} Active Citizens (Lvl 10+)
                </span>
                {isCensusAuditing ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    Auditing Census: {profiles.length}/{authoritativeActiveCount} ({censusPct}%)
                  </span>
                ) : streamState.isRunning || profiles.some((p) => p.auditBaselineStatus !== 'audited') ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40 flex items-center gap-1.5">
                    <Loader2
                      className={`w-3 h-3 text-cyan-400 ${
                        streamState.isRunning && !streamState.isPaused ? 'animate-spin' : ''
                      }`}
                    />
                    {streamState.isRunning
                      ? `Streaming Receipts: ${streamState.auditedCount}/${streamState.totalTargetCount} (${streamState.pct}%)`
                      : `Receipts Verified: ${profiles.filter((p) => p.auditBaselineStatus === 'audited').length}/${profiles.length}`}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    100% Census &amp; Receipts Audited
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black text-white mt-0.5">
                National Treasury &amp; Economic Strategy Office
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Citizen contribution ratios, leech detection, inter-state sovereign transfers, and strategic commodity arbitrage.
              </p>
            </div>
          </div>

          {/* Header Actions: Export Digest, Snapshot & Backup Safeguards */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSnapshotModalOpen(true);
                if (!isTakingSnapshot) {
                  handleStartSnapshotCapture();
                }
              }}
              disabled={isTakingSnapshot}
              className="px-4 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black rounded-2xl text-xs flex items-center gap-2.5 shadow-lg shadow-sky-500/20 border border-sky-400/40 transition transform active:scale-95 disabled:opacity-50"
              title="Record timestamped wealth & combat damage snapshots for all active citizens in the country"
            >
              <div className="p-1 rounded-lg bg-black/20">
                <Camera className="w-4 h-4 text-sky-200" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-sky-200 font-bold leading-none">Historical Audit</div>
                <div className="text-xs font-black text-white leading-tight">
                  {isTakingSnapshot ? 'Recording...' : 'Take Citizen Snapshot'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportExecutiveDigest}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2.5 shadow-lg shadow-amber-500/20 border border-amber-400/40 transition transform active:scale-95"
              title="Download consolidated executive CSV report with Audit, Transfers, Stockpiles, and Commodities"
            >
              <div className="p-1 rounded-lg bg-black/20">
                <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-slate-900 font-bold leading-none">Consolidated Report</div>
                <div className="text-xs font-black text-slate-950 leading-tight">Export Digest (CSV)</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setBackupMessage(null);
                setIsBackupModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black rounded-2xl text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-500/20 border border-emerald-400/40 transition transform active:scale-95"
              title="Daily Backup Recommendation & Storage Safeguard"
            >
              <div className="p-1 rounded-lg bg-black/20">
                <HardDrive className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold leading-none">Disaster Recovery</div>
                <div className="text-xs font-black text-white leading-tight">Backup &amp; Safeguards</div>
              </div>
            </button>
          </div>
        </div>

        {/* Recommended Daily Protocol Banner */}
        <div className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-center gap-2.5 shadow-inner">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="leading-snug">
            <strong>Daily Protocol Recommendation:</strong> Use the <strong>Backup &amp; Safeguards</strong> button above to download a daily backup file, safeguarding your historical citizen wealth snapshots, watchlist, and custom policy configurations against browser cache clearing or disk cleaner utilities.
          </span>
        </div>

        {/* Sub-Office Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'radar'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Citizen Leech &amp; Wealth Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('war-readiness')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'war-readiness'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>War-Readiness Evaluation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workforce')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'workforce'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Workforce &amp; Trait Advisor (v0.27)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('treasury')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'treasury'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Inter-State Transfers</span>
            <span className="text-xs opacity-80 font-mono">({transactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stockpiles')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'stockpiles'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>National Strategic Reserves</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'market'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Market Arbitrage Advisor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('watch')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 relative ${
              activeTab === 'watch'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Citizens on watch</span>
            {watchedCitizens.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-xs font-black">
                {watchedCitizens.length}
              </span>
            )}
            {unacknowledgedAlerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-mono text-xs font-bold" title="Unacknowledged respec alerts">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Render Active Sub-Office */}
      {activeTab === 'radar' && (
        <CitizenRadar
          profiles={profiles}
          countryName={countryName}
          config={config}
          watchedUserIds={watchedUserIds}
          onUpdateConfig={onUpdateConfig}
          onUpdateTag={onUpdateTag}
          onPutOnWatch={onPutOnWatch}
          onRemoveFromWatch={onRemoveFromWatch}
          onRunIncomeAudit={onRunIncomeAudit}
          isAuditing={isAuditingIncome}
          totalActiveCitizens={totalActiveCitizens}
          isSyncing={isSyncing}
          syncProgress={syncProgress}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          apiKey={apiKey}
          countryBenchmark={countryBenchmark}
          commodities={commodities}
          onUpdateProfile={onUpdateProfile}
          onUpdateProfilesBatch={onUpdateProfilesBatch}
        />
      )}

      {activeTab === 'war-readiness' && (
        <WarReadinessEvaluation
          auditedCountryId={countryId}
          auditedCountryName={countryName}
          countries={countries}
        />
      )}

      {activeTab === 'workforce' && (
        <WorkforceAdvisor
          countryName={countryName}
          profiles={profiles}
          commodities={commodities}
        />
      )}

      {activeTab === 'treasury' && (
        <TreasuryLedger
          countryName={countryName}
          countryId={countryId}
          countries={countries}
          transactions={transactions}
          apiKey={apiKey}
          onAddTransaction={onAddTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onImportTransactions={onImportTransactions}
        />
      )}

      {activeTab === 'stockpiles' && (
        <StockpileTracker
          countryName={countryName}
          countryId={countryId}
          stateOrgId={countries?.find((c) => c._id === countryId)?.orgs?.[0]}
          stockpiles={stockpiles}
          commodities={commodities}
          onUpdateStockpile={onUpdateStockpile}
          apiKey={apiKey}
          onOpenKeyModal={onOpenKeyModal}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}

      {activeTab === 'market' && (
        <MarketAdvisor
          countryName={countryName}
          commodities={commodities}
        />
      )}

      {activeTab === 'watch' && (
        <div className="space-y-6">
          {/* KPI Summary for Watched Citizens */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" /> Under Surveillance
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {watchedCitizens.length} Citizens
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Active citizens monitored in {countryName}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> Monitored Net Worth
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                {formatBtc(watchedCitizens.reduce((acc, w) => acc + w.wealthBtc, 0))} <span className="text-xs text-amber-500 font-bold">BTC</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Total combined assets of watched citizens</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Combined Contributions
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {formatBtc(watchedCitizens.reduce((acc, w) => acc + w.totalDonatedBtc, 0))} <span className="text-xs text-emerald-500 font-bold">BTC</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Historical donations from watched group</div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-lg">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={watchSearch}
                onChange={(e) => setWatchSearch(e.target.value)}
                placeholder="Search watched citizen or note..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddWatchModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Citizen to Watch
            </button>
          </div>

          {/* Watched Citizens Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full min-w-[800px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Citizen</th>
                  <th className="py-3.5 px-4">Surveillance Dossier / Note</th>
                  <th className="py-3.5 px-4 text-right">Net Worth</th>
                  <th className="py-3.5 px-4 text-right">Donations</th>
                  <th className="py-3.5 px-4 text-center">Style</th>
                  <th className="py-3.5 px-4 text-center">Added Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredWatched.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs font-sans">
                      No citizens currently on watch. Click &quot;Add Citizen to Watch&quot; or click the Eye button on any citizen in the Citizen Radar.
                    </td>
                  </tr>
                ) : (
                  filteredWatched.map((w) => {
                    const matchedProfile = profiles.find((p) => p.userId === w.userId);
                    return (
                      <tr key={w.userId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-sans font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {w.avatarUrl ? (
                                <img src={w.avatarUrl} alt={w.username} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                w.username.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="text-white text-xs font-bold">{w.username}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {w.userId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-sans text-amber-200/90 max-w-sm">
                          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] leading-relaxed">
                            {w.reasonNote}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                          {formatBtc(w.wealthBtc)} BTC
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                          {formatBtc(w.totalDonatedBtc)} BTC
                        </td>

                        <td className="py-3.5 px-4 text-center font-sans capitalize text-slate-300">
                          {w.playstyle.replace('-', ' ')}
                        </td>

                        <td className="py-3.5 px-4 text-center font-sans text-slate-400 text-[11px]">
                          {formatDateDDMMYYYY(w.addedAt)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {matchedProfile && (
                              <button
                                type="button"
                                onClick={() => setActiveNudgeProfile(matchedProfile)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95"
                                title="Send in-game diplomatic notice"
                              >
                                <Send className="w-3 h-3" /> Nudge
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemoveFromWatch?.(w.userId)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                              title="Remove citizen from watch list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Secondary Respec Alerts Log */}
          {alerts.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Citizen Respec & Playstyle Shifts</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
                    {alerts.length} logged
                  </span>
                </h4>
              </div>

              <div className="space-y-2">
                {[...alerts].sort(compareTransactionsNewestFirst).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      alert.acknowledged
                        ? 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-slate-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-white">
                        <span className="text-amber-400">{alert.username}</span> shifted build: {alert.previousMode.toUpperCase()} ➔ {alert.newMode.toUpperCase()}
                      </div>
                      <div className="text-slate-400 font-mono text-[10px]">
                        {alert.ecoPoints} Eco · {alert.warPoints} War · {formatDateDDMMYYYY(alert.timestamp)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const matched = profiles.find((p) => p.userId === alert.userId);
                          if (matched) {
                            setActiveNudgeProfile(matched);
                          } else {
                            setActiveNudgeProfile({
                              userId: alert.userId,
                              username: alert.username,
                              countryId,
                              countryName,
                              level: 1,
                              wealthBtc: 0,
                              totalDonatedBtc: 0,
                              directDonatedBtc: 0,
                              damageDonatedBtc: 0,
                              donationCount: 0,
                              contributionRatio: 0,
                              leechTier: 'moderate',
                              warSkillPoints: alert.warPoints,
                              ecoSkillPoints: alert.ecoPoints,
                              playstyle: alert.newMode,
                              manualTag: 'none',
                              isActive: true,
                            });
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                        title="Send diplomatic telegram notice regarding build shift"
                      >
                        <Send className="w-3.5 h-3.5" /> Nudge
                      </button>

                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal: Add Citizen to Watch */}
          {isAddWatchModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Add Citizen to Watch</h3>
                      <p className="text-xs text-slate-400">Place under sovereign economic surveillance</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddWatchModalOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveNewWatch} className="mt-5 space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Select Active Citizen</label>
                    <select
                      value={selectedAddUserId}
                      onChange={(e) => setSelectedAddUserId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- Choose citizen from {countryName} --</option>
                      {profiles.map((p) => (
                        <option key={p.userId} value={p.userId}>
                          {p.username} (Net Worth: {formatBtc(p.wealthBtc)} BTC · Donated: {formatBtc(p.totalDonatedBtc)} BTC)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Reason for Surveillance
                    </label>
                    <textarea
                      rows={3}
                      value={addWatchNote}
                      onChange={(e) => setAddWatchNote(e.target.value)}
                      placeholder="e.g. High net worth growth without corresponding treasury donation; suspected leech."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddWatchModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedAddUserId}
                      className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md active:scale-95 disabled:opacity-50"
                    >
                      Confirm Watch
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Sovereign Database Backup & Storage Safeguards */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sovereign Backup &amp; Storage Safeguards</h3>
                  <p className="text-xs text-slate-400">Offline-first database persistence &amp; disaster recovery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent Daily Recommendation Callout */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="uppercase tracking-wider">Crucial Daily Protocol Recommendation</span>
              </div>
              <p className="leading-relaxed text-slate-300 text-[11px]">
                The Ministry of Economy provides comprehensive local database persistence. All citizen wealth baselines, 7-day snapshots, policy calibrations, surveillance watchlists, and inter-state transactions are securely preserved in your application database.
              </p>
              <p className="leading-relaxed text-slate-300 text-[11px]">
                <strong>Warning:</strong> If your browser cache is purged, or if you run PC cleaning software (such as CCleaner, CleanMyMac, or automated disk optimizers), your historical audit snapshots will be wiped.
              </p>
              <div className="pt-1 font-bold text-amber-300 text-[11px] flex items-center gap-1.5">
                <span>⭐ Recommendation: Download a backup file at the end of every active ministerial session.</span>
              </div>
            </div>

            {backupMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                backupMessage.isError
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
              }`}>
                {backupMessage.isError ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>{backupMessage.text}</span>
              </div>
            )}

            {/* Actions: Export vs Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Export Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                    <Download className="w-4 h-4" />
                    <span>Export Daily Backup</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Download a secure JSON archive containing all wealth snapshots, custom quotas, watched citizens, stockpiles, and transfer notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isProcessingBackup}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>{isProcessingBackup ? 'Exporting...' : 'Download Backup (.json)'}</span>
                </button>
              </div>

              {/* Import Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-cyan-400 mb-1">
                    <Upload className="w-4 h-4" />
                    <span>Restore Sovereign Data</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Restore previously exported JSON backup files after switching browsers, clearing disk caches, or moving devices.
                  </p>
                </div>
                <label className="w-full py-2.5 px-3 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md text-center">
                  <Upload className="w-4 h-4" />
                  <span>Restore from File (.json)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    disabled={isProcessingBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <FileJson className="w-3.5 h-3.5 text-slate-400" /> JSON standard archive
              </span>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adaptive Diplomatic Telegram Generator (Nudge, Merit Commendation, & Over-Donation Warning) */}
      {activeNudgeProfile && (() => {
        const nudgeRec = calculateCitizenSuggestedDonation(
          activeNudgeProfile,
          countryBenchmark,
          config,
          nudgeArchetypeOverride,
          commodities
        );
        const activeMode: DiplomaticActionMode =
          diplomaticModeOverride || nudgeRec.recommendedDiplomaticMode || 'nudge';
        const activeCommendation: CommendationArchetype =
          commendationArchetypeOverride || nudgeRec.recommendedCommendationArchetype || 'sovereign-treasury-patriot';
        const activeOverDonation: OverDonationWarningArchetype =
          overDonationArchetypeOverride || nudgeRec.recommendedOverDonationArchetype || 'capex-growth-strain';

        const effectiveBtc = customNudgeBtc ?? nudgeRec.suggestedAmountBtc;
        const nudgeMessages = generateMinisterialNudge(
          activeNudgeProfile,
          countryName,
          'MoE',
          config?.analysisPeriodDays || 7,
          {
            customSuggestedBtc: effectiveBtc,
            archetypeOverride: nudgeArchetypeOverride,
            diplomaticMode: activeMode,
            commendationArchetype: activeCommendation,
            overDonationArchetype: activeOverDonation,
            countryBenchmark,
            config,
            commodities,
          }
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-amber-500/30 overflow-hidden flex items-center justify-center font-black text-amber-300 text-base shrink-0 shadow-inner">
                    {activeNudgeProfile.avatarUrl ? (
                      <img src={activeNudgeProfile.avatarUrl} alt={activeNudgeProfile.username} className="w-full h-full object-cover" />
                    ) : (
                      activeNudgeProfile.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-black text-white">
                        {activeMode === 'commendation'
                          ? 'Patriot & Hero Diplomatic Commendation'
                          : activeMode === 'over-donation-warning'
                          ? 'Over-Donation Burnout & Solvency Advisory'
                          : 'Dynamic Diplomatic Treasury Nudge'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                        {activeMode === 'commendation'
                          ? (nudgeRec.commendationOptions ?? nudgeRec.commendationArchetypeOptions ?? []).find((o) => o.id === activeCommendation)?.title || 'Patriot Commendation'
                          : activeMode === 'over-donation-warning'
                          ? (nudgeRec.overDonationOptions ?? nudgeRec.overDonationArchetypeOptions ?? []).find((o) => o.id === activeOverDonation)?.title || 'Over-Donation Advisory'
                          : nudgeRec.archetypeLabel}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Tailored in-game telegram for <strong className="text-amber-300">{activeNudgeProfile.username}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveNudgeProfile(null);
                    setCopiedNudgeIndex(null);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-1 my-4">
                {/* 0. Ministerial Evaluation & Mode Switcher */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-mono font-black uppercase">
                      ★ Recommended Action: {nudgeRec.recommendedDiplomaticModeLabel} ({nudgeRec.recommendedDiplomaticBadge})
                    </span>
                    {(diplomaticModeOverride || nudgeArchetypeOverride || commendationArchetypeOverride || overDonationArchetypeOverride) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDiplomaticModeOverride(undefined);
                          setNudgeArchetypeOverride(undefined);
                          setCommendationArchetypeOverride(undefined);
                          setOverDonationArchetypeOverride(undefined);
                          setCustomNudgeBtc(undefined);
                        }}
                        className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to Recommended
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{nudgeRec.recommendedDiplomaticReason}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {([
                      { mode: 'nudge' as DiplomaticActionMode, title: 'Treasury Nudge', sub: 'Request fair BTC contribution' },
                      { mode: 'commendation' as DiplomaticActionMode, title: 'Patriot Commendation', sub: 'Congratulate donors, heroes & pillars' },
                      { mode: 'over-donation-warning' as DiplomaticActionMode, title: 'Over-Donation Warning', sub: 'Protect citizen growth & ammo' },
                    ]).map((tab) => {
                      const isSel = activeMode === tab.mode;
                      return (
                        <button
                          key={tab.mode}
                          type="button"
                          onClick={() => setDiplomaticModeOverride(tab.mode)}
                          className={`p-3 rounded-xl border text-left transition ${
                            isSel
                              ? 'bg-amber-500/20 border-amber-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-sm font-black flex items-center justify-between">
                            <span>{tab.title}</span>
                            {isSel && <Check className="w-4 h-4 text-amber-400" />}
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5">{tab.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1. Country-Relative Telemetry Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-xs text-slate-400 uppercase font-sans font-bold">Idle Liquid Cash</div>
                    <div className="text-base font-black text-emerald-400 mt-0.5">
                      {formatBtc(nudgeRec.liquidBtc)} BTC
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {nudgeRec.liquidRatioToCountryMedian}x country median
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-xs text-slate-400 uppercase font-sans font-bold">Resource Stockpile</div>
                    <div className="text-base font-black text-cyan-300 mt-0.5">
                      {formatBtc(nudgeRec.resourceWealthBtc)} BTC
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {nudgeRec.resourceRatioToCountryMedian}x median (Shield: {formatBtc(nudgeRec.protectedGrowthReserveBtc)})
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-xs text-slate-400 uppercase font-sans font-bold">Weekly Cashflow</div>
                    <div className="text-base font-black text-white mt-0.5">
                      {formatBtc(nudgeRec.grossIncomeBtc)} BTC
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {nudgeRec.incomeRatioToCountryMedian}x country median
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <div className="text-xs text-slate-400 uppercase font-sans font-bold">Period Donated</div>
                    <div className="text-base font-black text-amber-400 mt-0.5">
                      {formatBtc(activeNudgeProfile.periodDonatedBtc ?? activeNudgeProfile.directDonatedBtc ?? 0)} BTC
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Lifetime: {formatBtc(activeNudgeProfile.totalDonatedBtc)} BTC
                    </div>
                  </div>
                </div>

                {/* 2. Mode-Specific Controls */}
                {activeMode === 'nudge' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 leading-relaxed">
                      <strong className="text-cyan-300 font-mono">{nudgeRec.capexAuditBadge}:</strong>{' '}
                      <span>{nudgeRec.capexAuditExplanation}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {([
                        { id: 'weekly-cashflow' as NudgeArchetype, title: 'Weekly Cashflow Step-Up', sub: 'Higher weekly BTC from 7D output' },
                        { id: 'liquid-hoarder' as NudgeArchetype, title: 'Idle Liquid BTC Hoarder', sub: 'One-time lump sum from idle cash' },
                        { id: 'resource-stockpiler' as NudgeArchetype, title: 'Resource Stockpiler', sub: 'Sell 10%–15% excess above 3.5x shield' },
                      ]).map((opt) => {
                        const isSelected = nudgeRec.archetype === opt.id;
                        const isRec = nudgeRec.recommendedArchetype === opt.id;
                        const compItem = (nudgeRec.archetypeComparison ?? []).find((c) => c.id === opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setNudgeArchetypeOverride(opt.id);
                              setCustomNudgeBtc(undefined);
                            }}
                            className={`p-3 rounded-xl border text-left transition ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                                : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                          >
                            <div className="text-sm font-bold flex items-center justify-between">
                              <span>{opt.title}</span>
                              {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <span className="text-xs text-slate-400">{opt.sub}</span>
                              {compItem && (
                                <span className="text-xs font-mono font-bold text-amber-300">
                                  {formatBtc(compItem.suggestedBtc)} BTC
                                </span>
                              )}
                            </div>
                            {isRec && (
                              <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
                                ★ Recommended
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-sm font-bold text-slate-200">
                          Suggested Donation Amount (BTC):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={effectiveBtc}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setCustomNudgeBtc(isNaN(val) ? 1 : Math.max(1, val));
                            }}
                            className="w-32 bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-1.5 text-right font-mono font-black text-base text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-sm font-mono font-bold text-amber-400">BTC</span>
                        </div>
                      </div>

                      <input
                        type="range"
                        min={nudgeRec.minSuggestedBtc}
                        max={nudgeRec.maxSuggestedBtc}
                        step={nudgeRec.stepBtc}
                        value={Math.min(
                          nudgeRec.maxSuggestedBtc,
                          Math.max(nudgeRec.minSuggestedBtc, effectiveBtc)
                        )}
                        onChange={(e) => setCustomNudgeBtc(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {activeMode === 'commendation' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(nudgeRec.commendationOptions ?? nudgeRec.commendationArchetypeOptions ?? []).map((opt) => {
                      const isSel = activeCommendation === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCommendationArchetypeOverride(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition space-y-1.5 ${
                            isSel
                              ? 'bg-emerald-500/15 border-emerald-400 text-white'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="text-sm font-black text-white flex items-center justify-between">
                            <span>{opt.title}</span>
                            {isSel && <Check className="w-4 h-4 text-emerald-400" />}
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-300">{opt.badge}</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{opt.explanation}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeMode === 'over-donation-warning' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(nudgeRec.overDonationOptions ?? nudgeRec.overDonationArchetypeOptions ?? []).map((opt) => {
                      const isSel = activeOverDonation === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOverDonationArchetypeOverride(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition space-y-1.5 ${
                            isSel
                              ? 'bg-cyan-500/15 border-cyan-400 text-white'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="text-sm font-black text-white flex items-center justify-between">
                            <span>{opt.title}</span>
                            {isSel && <Check className="w-4 h-4 text-cyan-400" />}
                          </div>
                          <div className="text-xs font-mono font-bold text-cyan-300">{opt.badge}</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{opt.explanation}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Template Options */}
                <div className="space-y-3.5">
                  {nudgeMessages.map((msg, idx) => {
                    const charsExcludingName = msg.body.replace(activeNudgeProfile.username, '').length;
                    return (
                      <div
                        key={idx}
                        className="p-4 sm:p-5 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3 text-sm text-slate-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-amber-300 text-sm flex items-center gap-2">
                              <Tag className="w-4 h-4 text-amber-400" /> {msg.title}
                            </span>
                            <div className="text-xs font-mono mt-1 flex items-center gap-2 text-slate-400">
                              <span className={charsExcludingName <= 492 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                ✓ {charsExcludingName} / 492 chars (excl. name)
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(msg.body);
                                setCopiedNudgeIndex(idx);
                                setTimeout(() => setCopiedNudgeIndex(null), 2500);
                              } catch {}
                            }}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto"
                          >
                            {copiedNudgeIndex === idx ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 text-slate-300" /> Copy Telegram
                              </>
                            )}
                          </button>
                        </div>

                        <pre className="p-4 bg-slate-950 rounded-xl font-sans text-sm sm:text-base text-slate-100 whitespace-pre-wrap leading-relaxed border border-slate-800/80">
                          {msg.body}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 pt-3.5 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNudgeProfile(null);
                    setCopiedNudgeIndex(null);
                  }}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Active Citizens Historical Snapshot with Safety Measures */}
      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-sky-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Citizen Historical Snapshot
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Country: {countryName} ({authoritativeActiveCount} Active Citizens{isCensusAuditing ? ` • ${profiles.length} Audited` : ' • 100% Audited'})
                  </p>
                </div>
              </div>
              {!isTakingSnapshot && (
                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Safety & Integrity Warning */}
            <div className="p-3.5 bg-sky-950/40 border border-sky-800/40 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-sky-300 font-bold">
                <Lock className="w-4 h-4 shrink-0 text-sky-400" />
                <span>Active Safety Measures Enforced</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {isTakingSnapshot
                  ? 'Country switching, tab changes, and background operations are strictly locked during capture to prevent database corruption. Please keep this window open until complete.'
                  : 'Snapshots record exact timestamped wealth and weekly/lifetime damage for all active citizens. This enables honest 30-day combat damage tracking once snapshots span a full month.'}
              </p>
            </div>

            {/* Progress Section */}
            {isTakingSnapshot ? (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    Recording citizen snapshots...
                  </span>
                  <span className="text-sky-300 font-bold">{snapshotProgress.pct}%</span>
                </div>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-150"
                    style={{ width: `${snapshotProgress.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="truncate max-w-[240px]">Processing: <strong className="text-slate-300">{snapshotProgress.citizenName}</strong></span>
                  <span>{snapshotProgress.current} / {snapshotProgress.total}</span>
                </div>
              </div>
            ) : snapshotResult ? (
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-emerald-300 font-bold text-sm">
                  Snapshot Successfully Recorded!
                </div>
                <p className="text-slate-300 text-xs">
                  Recorded historical wealth and combat damage snapshots for <strong className="text-white">{snapshotResult.count}</strong> active citizens at {snapshotResult.timestamp}.
                </p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              {!isTakingSnapshot && (
                <>
                  <button
                    type="button"
                    onClick={handleStartSnapshotCapture}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{snapshotResult ? 'Retake Snapshot' : 'Begin Snapshot Capture'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSnapshotModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-Intrusive Floating Background Audit Dock (for non-radar tabs; CitizenRadar renders its own with bufferedCount) */}
      {activeTab !== 'radar' && (
        <AuditProgressDock countryName={countryName} state={streamState} />
      )}

      {/* Mandatory Sovereign Attribution Disclaimer */}
      <div className="text-center py-6 border-t border-slate-800/80 text-xs text-slate-500 font-medium tracking-wide">
        Designed and made by Colombia&apos;s Ministry of Economy
      </div>
    </div>
  );
};
