import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CitizenEconomicProfile,
  LeechTier,
  CitizenEconomicStanding,
  PlaystyleMode,
  PlayerTag,
  MinisterialMessage,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
  CountryEconomicBenchmark,
  NudgeArchetype,
  DiplomaticActionMode,
  CommendationArchetype,
  OverDonationWarningArchetype,
  CommodityTrend,
} from '../../types/ministry';
import { sanitizePolicyConfig, storage, AUDIT_PROFILE_SCHEMA_VERSION } from '../../services/storage';
import {
  generateMinisterialNudge,
  calculateCitizenSuggestedDonation,
  resolveMasterCitizenStanding,
  getPlaystyleQuotaThresholds,
} from '../../services/ministryService';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateUtils';
import { SyncProgress } from '../../types/warera';
import { CitizenAuditModal } from './CitizenAuditModal';
import { CitizenCalculationExplainerModal } from './CitizenCalculationExplainerModal';
import { GrossIncomeBreakdownModal } from './GrossIncomeBreakdownModal';
import { AuditProgressDock } from './AuditProgressDock';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useI18n, translateRawStringEs } from '../../i18n/I18nContext';
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
  Zap,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import {
  auditStreamService,
  AutoAuditStreamState,
  AUDIT_STALE_TTL_MS,
} from '../../services/auditStreamService';

interface CitizenRadarProps {
  profiles: CitizenEconomicProfile[];
  countryName: string;
  config?: MinistryConfig;
  watchedUserIds?: Set<string>;
  totalActiveCitizens?: number;
  isSyncing?: boolean;
  syncProgress?: SyncProgress | null;
  onUpdateConfig?: (cfg: MinistryConfig) => void;
  onUpdateTag: (userId: string, tag: PlayerTag, notes?: string) => void;
  onPutOnWatch?: (profile: CitizenEconomicProfile, reasonNote: string) => void;
  onRemoveFromWatch?: (userId: string) => void;
  onRunIncomeAudit?: () => void;
  isAuditing?: boolean;
  onOpenBackup?: () => void;
  apiKey?: string;
  countryBenchmark?: CountryEconomicBenchmark;
  commodities?: CommodityTrend[];
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
  onUpdateProfilesBatch?: (updatedList: CitizenEconomicProfile[]) => void;
}

export const CitizenRadar: React.FC<CitizenRadarProps> = ({
  profiles,
  countryName,
  config = DEFAULT_MINISTRY_CONFIG,
  watchedUserIds = new Set(),
  totalActiveCitizens,
  isSyncing = false,
  syncProgress = null,
  countryBenchmark,
  commodities = [],
  onUpdateConfig,
  onUpdateTag,
  onPutOnWatch,
  onRemoveFromWatch,
  onRunIncomeAudit,
  isAuditing = false,
  onOpenBackup,
  apiKey,
  onUpdateProfile,
  onUpdateProfilesBatch,
}) => {
  const { tx, lang } = useI18n();
  const [search, setSearch] = useState('');
  const [filterFiscalStanding, setFilterFiscalStanding] = useState<string>('all');
  const [filterBuild, setFilterBuild] = useState<string>('all');
  const [filterBuildGrade, setFilterBuildGrade] = useState<string>('all');
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
  const [diplomaticModeOverride, setDiplomaticModeOverride] = useState<DiplomaticActionMode | undefined>(undefined);
  const [nudgeArchetypeOverride, setNudgeArchetypeOverride] = useState<NudgeArchetype | undefined>(undefined);
  const [commendationArchetypeOverride, setCommendationArchetypeOverride] = useState<CommendationArchetype | undefined>(undefined);
  const [overDonationArchetypeOverride, setOverDonationArchetypeOverride] = useState<OverDonationWarningArchetype | undefined>(undefined);
  const [customNudgeBtc, setCustomNudgeBtc] = useState<number | undefined>(undefined);
  const [showNudgeArchetypeHelp, setShowNudgeArchetypeHelp] = useState<boolean>(false);
  const [showNudgeCalculationHelp, setShowNudgeCalculationHelp] = useState<boolean>(false);
  const [selectedExplainerProfile, setSelectedExplainerProfile] = useState<CitizenEconomicProfile | null>(null);
  const [selectedIncomeBreakdownProfile, setSelectedIncomeBreakdownProfile] = useState<CitizenEconomicProfile | null>(null);
  const [selectedAuditProfile, setSelectedAuditProfile] = useState<CitizenEconomicProfile | null>(null);
  const [standingExplainUserId, setStandingExplainUserId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Reset nudge overrides when target citizen changes
  useEffect(() => {
    setDiplomaticModeOverride(undefined);
    setNudgeArchetypeOverride(undefined);
    setCommendationArchetypeOverride(undefined);
    setOverDonationArchetypeOverride(undefined);
    setCustomNudgeBtc(undefined);
    setShowNudgeArchetypeHelp(false);
    setShowNudgeCalculationHelp(false);
    setCopiedIndex(null);
  }, [activeNudgeProfile?.userId]);

  // Watchlist modal state
  const [watchTargetProfile, setWatchTargetProfile] = useState<CitizenEconomicProfile | null>(null);
  const [watchNoteDraft, setWatchNoteDraft] = useState<string>('');

  // Active citizens counts (authoritative game census aligned with radar profiles)
  const activeCount = totalActiveCitizens || profiles.length;
  const targetCohortSize = totalActiveCitizens && totalActiveCitizens > 0 ? totalActiveCitizens : profiles.length;
  const isCohortAuditing = Boolean(isSyncing);
  const auditProgressPct = targetCohortSize > 0 ? Math.min(100, Math.round((profiles.length / targetCohortSize) * 100)) : 100;

  // High-performance automatic background ledger streamer state
  const [streamState, setStreamState] = useState<AutoAuditStreamState>(() => auditStreamService.getState());

  useEffect(() => {
    const unsub = auditStreamService.subscribe(setStreamState);
    return unsub;
  }, []);

  // ============================================================================
  // BUFFERED BACKGROUND UPDATES & ROW POSITION LOCKING
  // Prevents citizens from jumping positions or disappearing from active filters
  // while background receipt verification is running or while inspecting a modal.
  // ============================================================================
  const [displayedProfiles, setDisplayedProfiles] = useState<CitizenEconomicProfile[]>(profiles);
  const [bufferedUpdatesMap, setBufferedUpdatesMap] = useState<Record<string, CitizenEconomicProfile>>({});
  const [pinnedInViewIds, setPinnedInViewIds] = useState<Set<string>>(() => new Set());
  const prevCountryNameRef = useRef<string>(countryName);
  const prevConfigJsonRef = useRef<string>(JSON.stringify(config));
  const bufferedMapRef = useRef<Record<string, CitizenEconomicProfile>>({});

  useEffect(() => {
    bufferedMapRef.current = bufferedUpdatesMap;
  }, [bufferedUpdatesMap]);

  // Clear pinned row overrides when the user explicitly changes any filter or search
  useEffect(() => {
    setPinnedInViewIds(new Set());
  }, [search, filterFiscalStanding, filterBuild, filterBuildGrade, onlyInactiveDonors]);

  // Sync displayedProfiles immediately when country changes, when policy config changes,
  // during initial census load, or when background streaming is NOT running
  useEffect(() => {
    const countryChanged = prevCountryNameRef.current !== countryName;
    if (countryChanged) {
      prevCountryNameRef.current = countryName;
      prevConfigJsonRef.current = JSON.stringify(config);
      auditStreamService.resetForCountrySwitch();
      bufferedMapRef.current = {};
      setDisplayedProfiles(profiles);
      setBufferedUpdatesMap({});
      setPinnedInViewIds(new Set());
      return;
    }

    const currentConfigJson = JSON.stringify(config);
    const configChanged = prevConfigJsonRef.current !== currentConfigJson;
    if (configChanged) {
      prevConfigJsonRef.current = currentConfigJson;
      const incomingMap = new Map(profiles.map((p) => [p.userId, p]));
      setDisplayedProfiles((prev) =>
        prev.length === 0
          ? profiles
          : prev.map((oldP) => incomingMap.get(oldP.userId) || oldP)
      );
      if (Object.keys(bufferedMapRef.current).length > 0) {
        setBufferedUpdatesMap((prevBuf) => {
          const nextBuf: Record<string, CitizenEconomicProfile> = {};
          for (const [uid, bufProf] of Object.entries(prevBuf)) {
            const refreshed = incomingMap.get(uid);
            nextBuf[uid] = refreshed
              ? {
                  ...bufProf,
                  damageValueBtc: refreshed.damageValueBtc,
                  contributionRatio: refreshed.contributionRatio,
                  leechTier: refreshed.leechTier,
                  economicStanding: refreshed.economicStanding,
                  ministerialVerdict: refreshed.ministerialVerdict,
                  ministerialVerdictReason: refreshed.ministerialVerdictReason,
                  tierReasonBadge: refreshed.tierReasonBadge,
                }
              : bufProf;
          }
          bufferedMapRef.current = nextBuf;
          return nextBuf;
        });
      }
      return;
    }

    const bufferedCount = Object.keys(bufferedMapRef.current).length;
    if (
      isSyncing ||
      displayedProfiles.length === 0 ||
      Math.abs(profiles.length - displayedProfiles.length) > 0 ||
      (!streamState.isRunning && bufferedCount === 0 && !selectedAuditProfile)
    ) {
      setDisplayedProfiles(profiles);
    } else {
      // Preserve locked row order while updating policy-derived fields, tags, and notes in place
      const incomingMap = new Map(profiles.map((p) => [p.userId, p]));
      setDisplayedProfiles((prev) =>
        prev.map((oldP) => {
          const nextP = incomingMap.get(oldP.userId);
          if (!nextP) return oldP;
          if (
            nextP.manualTag !== oldP.manualTag ||
            nextP.notes !== oldP.notes ||
            nextP.damageValueBtc !== oldP.damageValueBtc ||
            nextP.contributionRatio !== oldP.contributionRatio ||
            nextP.leechTier !== oldP.leechTier ||
            nextP.economicStanding !== oldP.economicStanding ||
            nextP.ministerialVerdict !== oldP.ministerialVerdict
          ) {
            return {
              ...oldP,
              manualTag: nextP.manualTag,
              notes: nextP.notes,
              damageValueBtc: nextP.damageValueBtc,
              contributionRatio: nextP.contributionRatio,
              leechTier: nextP.leechTier,
              economicStanding: nextP.economicStanding,
              ministerialVerdict: nextP.ministerialVerdict,
              ministerialVerdictReason: nextP.ministerialVerdictReason,
              tierReasonBadge: nextP.tierReasonBadge,
            };
          }
          return oldP;
        })
      );
    }
  }, [profiles, countryName, config, isSyncing, streamState.isRunning, selectedAuditProfile]);

  // Refs to keep background lifecycle checks stable without re-triggering on every profile/benchmark state commit
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const displayedProfilesRef = useRef(displayedProfiles);
  displayedProfilesRef.current = displayedProfiles;
  const configRef = useRef(config);
  configRef.current = config;
  const benchmarkRef = useRef(countryBenchmark);
  benchmarkRef.current = countryBenchmark;
  const hasActiveFilterRef = useRef(false);
  hasActiveFilterRef.current = Boolean(
    search.trim() ||
      filterFiscalStanding !== 'all' ||
      filterBuild !== 'all' ||
      filterBuildGrade !== 'all' ||
      onlyInactiveDonors
  );
  const selectedAuditProfileRef = useRef(selectedAuditProfile);
  selectedAuditProfileRef.current = selectedAuditProfile;

  // Handler for background stream updates:
  // If the citizen was previously unverified or had 0 receipts, or if no filter/modal is active,
  // apply the verified receipt profile immediately to displayedProfiles and parent state so no citizen
  // ever stays stuck showing 0.0 BTC / 0 receipts after being audited.
  // Only stage in bufferedUpdatesMap when a filter or modal is active AND the citizen was already verified.
  const handleBackgroundStreamUpdate = useCallback(
    (updated: CitizenEconomicProfile) => {
      const currentProfiles = profilesRef.current;
      if (
        currentProfiles.length > 0 &&
        updated.countryId &&
        currentProfiles[0]?.countryId &&
        updated.countryId !== currentProfiles[0].countryId
      ) {
        return;
      }
      if (!currentProfiles.some((p) => p.userId === updated.userId)) {
        return;
      }

      const existingRow = displayedProfilesRef.current.find((p) => p.userId === updated.userId);
      const wasUnverifiedOrEmpty =
        !existingRow ||
        existingRow.auditBaselineStatus !== 'audited' ||
        existingRow.auditSchemaVersion !== AUDIT_PROFILE_SCHEMA_VERSION ||
        ((existingRow.receiptCount || 0) === 0 && (existingRow.grossInflowBtc || 0) === 0);

      if (wasUnverifiedOrEmpty || (!hasActiveFilterRef.current && !selectedAuditProfileRef.current)) {
        if (bufferedMapRef.current[updated.userId]) {
          const nextRef = { ...bufferedMapRef.current };
          delete nextRef[updated.userId];
          bufferedMapRef.current = nextRef;
        }
        setBufferedUpdatesMap((prev) => {
          if (!prev[updated.userId]) return prev;
          const next = { ...prev };
          delete next[updated.userId];
          return next;
        });
        setDisplayedProfiles((prev) =>
          prev.map((p) => (p.userId === updated.userId ? updated : p))
        );
        onUpdateProfile?.(updated);
      } else {
        bufferedMapRef.current = {
          ...bufferedMapRef.current,
          [updated.userId]: updated,
        };
        setBufferedUpdatesMap((prev) => ({
          ...prev,
          [updated.userId]: updated,
        }));
      }
    },
    [onUpdateProfile]
  );

  // Handler for manual user-triggered updates inside CitizenAuditModal:
  // Updates the citizen in-place and pins their row in the current filtered view so they never vanish
  const handleManualModalUpdate = useCallback(
    (updated: CitizenEconomicProfile) => {
      if (bufferedMapRef.current[updated.userId]) {
        const nextRef = { ...bufferedMapRef.current };
        delete nextRef[updated.userId];
        bufferedMapRef.current = nextRef;
      }
      setDisplayedProfiles((prev) =>
        prev.map((p) => (p.userId === updated.userId ? updated : p))
      );
      setBufferedUpdatesMap((prev) => {
        if (!prev[updated.userId]) return prev;
        const next = { ...prev };
        delete next[updated.userId];
        return next;
      });
      setPinnedInViewIds((prev) => {
        const next = new Set(prev);
        next.add(updated.userId);
        return next;
      });
      setSelectedAuditProfile((prev) =>
        prev && prev.userId === updated.userId ? updated : prev
      );
      onUpdateProfile?.(updated);
    },
    [onUpdateProfile]
  );

  // Flush buffered background updates into the table and parent state atomically
  const handleApplyBufferedUpdates = useCallback(() => {
    const validIds = new Set(profiles.map((p) => p.userId));
    const stagedList = (Object.values(bufferedMapRef.current) as CitizenEconomicProfile[]).filter(
      (p) => validIds.has(p.userId)
    );
    bufferedMapRef.current = {};
    setBufferedUpdatesMap({});
    setPinnedInViewIds(new Set());
    if (stagedList.length === 0) {
      setDisplayedProfiles(profiles);
      return;
    }
    const stagedById = new Map<string, CitizenEconomicProfile>(
      stagedList.map((p) => [p.userId, p])
    );
    setDisplayedProfiles((prev) => {
      const base = prev.length > 0 ? prev : profiles;
      return base.map((p) => stagedById.get(p.userId) || p);
    });
    if (onUpdateProfilesBatch) {
      onUpdateProfilesBatch(stagedList);
    } else {
      for (const upd of stagedList) {
        onUpdateProfile?.(upd);
      }
    }
  }, [profiles, onUpdateProfile, onUpdateProfilesBatch]);

  const bufferedCount = Object.keys(bufferedUpdatesMap).length;

  const { auditedCount, staleCount, actionableStaleCount } = useMemo(() => {
    let audited = 0;
    let stale = 0;
    let actionableStale = 0;
    const isPassRecentlyCompleted =
      Boolean(streamState.lastCompletedAt) &&
      Date.now() - (streamState.lastCompletedAt || 0) < AUDIT_STALE_TTL_MS;
    const deferredSet = isPassRecentlyCompleted
      ? new Set(streamState.failedCitizenIds || [])
      : new Set<string>();

    for (const p of displayedProfiles) {
      const effective = bufferedUpdatesMap[p.userId] || p;
      if (effective.auditBaselineStatus === 'audited') {
        audited++;
      }
      if (auditStreamService.isCitizenAuditStale(effective, AUDIT_STALE_TTL_MS)) {
        stale++;
        if (!deferredSet.has(p.userId)) {
          actionableStale++;
        }
      }
    }
    return { auditedCount: audited, staleCount: stale, actionableStaleCount: actionableStale };
  }, [displayedProfiles, bufferedUpdatesMap, streamState.lastCompletedAt, streamState.failedCitizenIds]);
  const pendingAuditCount = Math.max(0, displayedProfiles.length - auditedCount);

  // Stop any running background receipt audit immediately if a national census sync begins
  useEffect(() => {
    if (isSyncing && streamState.isRunning) {
      auditStreamService.stop();
    }
  }, [isSyncing, streamState.isRunning]);

  // Seamless background stream trigger: initiates non-blocking verification ONLY AFTER the national census is complete (!isSyncing && !isCohortAuditing)
  useEffect(() => {
    const currentCountryId = profiles[0]?.countryId;
    const isRunningDifferentCountry =
      streamState.isRunning &&
      Boolean(currentCountryId) &&
      Boolean(streamState.countryId) &&
      streamState.countryId !== currentCountryId;

    if (
      !isSyncing &&
      !isCohortAuditing &&
      apiKey &&
      apiKey.trim() &&
      profiles.length > 0 &&
      actionableStaleCount > 0 &&
      ((!streamState.isRunning && !streamState.isPaused) || isRunningDifferentCountry)
    ) {
      const mergedProfiles = profilesRef.current.map(
        (p) => bufferedMapRef.current[p.userId] || p
      );
      auditStreamService.startStream(
        mergedProfiles,
        apiKey,
        configRef.current,
        benchmarkRef.current,
        handleBackgroundStreamUpdate,
        false
      );
    }
  }, [
    countryName,
    profiles.length,
    actionableStaleCount,
    isSyncing,
    isCohortAuditing,
    apiKey,
    config.analysisPeriodDays,
    streamState.isRunning,
    streamState.isPaused,
    streamState.countryId,
    handleBackgroundStreamUpdate,
  ]);

  // ============================================================================
  // 30-MINUTE AUTOMATIC RE-AUDIT LIFECYCLE
  // 1) Re-audits automatically every 30 minutes while the app is open and in use.
  // 2) If 30+ minutes have passed since the app was last used (or since last country
  //    audit), triggers a full re-audit immediately upon opening or returning to the tab.
  // ============================================================================
  const activeCountryId = profiles[0]?.countryId || countryName;

  useEffect(() => {
    if (!apiKey || !apiKey.trim() || profilesRef.current.length === 0 || isSyncing || isCohortAuditing) return;

    const checkAndTriggerThirtyMinAudit = (fromUserReturn: boolean) => {
      const state = auditStreamService.getState();
      if (state.isRunning || state.isPaused) return;
      const currentProfiles = profilesRef.current;
      if (currentProfiles.length === 0) return;

      const now = Date.now();
      const wasAwayThirtyMins = fromUserReturn
        ? auditStreamService.checkAndRecordAppActivity(now)
        : false;
      const lastCountryAudit = auditStreamService.getLastCountryAuditTime(activeCountryId);
      const isCountryAuditStale =
        lastCountryAudit > 0 && now - lastCountryAudit >= AUDIT_STALE_TTL_MS;

      if (wasAwayThirtyMins || isCountryAuditStale) {
        const mergedProfiles = currentProfiles.map(
          (p) => bufferedMapRef.current[p.userId] || p
        );
        auditStreamService.startStream(
          mergedProfiles,
          apiKey,
          configRef.current,
          benchmarkRef.current,
          handleBackgroundStreamUpdate,
          true
        );
      }
    };

    // Check immediately when component mounts / country loads
    checkAndTriggerThirtyMinAudit(true);

    // Periodic check every 60 seconds while app is open to trigger 30-minute active re-audit
    const intervalId = window.setInterval(() => {
      auditStreamService.checkAndRecordAppActivity(Date.now());
      checkAndTriggerThirtyMinAudit(false);
    }, 60 * 1000);

    // Detect user returning to tab/window after >=30 minutes away (never on keydown or button clicks)
    let lastInteractionCheck = 0;
    const handleUserReturnToTab = () => {
      const now = Date.now();
      if (now - lastInteractionCheck < 15000) return;
      lastInteractionCheck = now;
      if (document.visibilityState === 'hidden') return;
      checkAndTriggerThirtyMinAudit(true);
    };

    window.addEventListener('focus', handleUserReturnToTab);
    document.addEventListener('visibilitychange', handleUserReturnToTab);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleUserReturnToTab);
      window.removeEventListener('visibilitychange', handleUserReturnToTab);
    };
  }, [
    activeCountryId,
    apiKey,
    isSyncing,
    isCohortAuditing,
    config.analysisPeriodDays,
    handleBackgroundStreamUpdate,
  ]);

  const inactiveDonorCount = useMemo(() => {
    return displayedProfiles.filter((p) => p.isInactiveDonor).length;
  }, [displayedProfiles]);
  const zeroContributionCount = useMemo(() => {
    return displayedProfiles.filter((p) => (p.totalDonatedBtc || 0) === 0).length;
  }, [displayedProfiles]);

  // Filtered and sorted profiles (uses locked displayedProfiles so rows never jump during background sync)
  const filtered = useMemo(() => {
    const list = displayedProfiles.filter((p) => {
      // If citizen was just manually audited in the modal, keep them pinned in view so they don't vanish!
      if (pinnedInViewIds.has(p.userId)) return true;

      if (onlyInactiveDonors && !p.isInactiveDonor) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.username.toLowerCase().includes(q) && !p.userId.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Simplified Fiscal Standing filter (strictly requires verified audit unless Historical Pillar or Zero Donations)
      const isVerifiedCitizen = p.auditBaselineStatus === 'audited';
      if (filterFiscalStanding === 'critical') {
        if (!isVerifiedCitizen || (p.leechTier !== 'critical-leech' && p.leechTier !== 'low-contributor')) return false;
      } else if (filterFiscalStanding === 'zero-donations') {
        if ((p.totalDonatedBtc || 0) > 0) return false;
      } else if (filterFiscalStanding === 'moderate') {
        if (!isVerifiedCitizen || p.leechTier !== 'moderate') return false;
      } else if (filterFiscalStanding === 'patriot') {
        if (p.leechTier === 'historical-pillar') {
          // Historical top donors are verified via all-time country treasury ranking
        } else if (!isVerifiedCitizen || p.leechTier !== 'sovereign-patriot') {
          return false;
        }
      }

      // Simplified Build & Commitment filter
      const isEco = p.playstyle === 'pure-eco' || p.manualTag === 'perma-eco';
      const isWar = p.playstyle === 'pure-war' || p.manualTag === 'perma-war';
      const isHybrid = p.playstyle === 'hybrid' || p.manualTag === 'mixed-style';
      const isPinned = p.manualTag && p.manualTag !== 'none';

      if (filterBuild === 'eco' && !isEco) return false;
      if (filterBuild === 'war' && !isWar) return false;
      if (filterBuild === 'hybrid' && !isHybrid) return false;
      if (filterBuild === 'pinned' && !isPinned) return false;

      if (filterBuildGrade !== 'all') {
        if (p.buildEvaluation?.grade !== filterBuildGrade) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => b.wealthBtc - a.wealthBtc);
  }, [displayedProfiles, pinnedInViewIds, onlyInactiveDonors, search, filterFiscalStanding, filterBuild, filterBuildGrade]);

  // Single-pass computation for fast KPI metrics (only counts verified audited citizens as leeches)
  const { criticalLeechCount, inactiveCount, ecoCount, warCount, hybridCount } = useMemo(() => {
    let criticalLeechCount = 0;
    let inactiveCount = 0;
    let ecoCount = 0;
    let warCount = 0;
    let hybridCount = 0;

    for (const p of filtered) {
      if (
        p.auditBaselineStatus === 'audited' &&
        (p.leechTier === 'critical-leech' || p.leechTier === 'low-contributor')
      ) {
        criticalLeechCount++;
      }
      if (p.isInactiveDonor) inactiveCount++;
      if (p.playstyle === 'pure-eco' || p.manualTag === 'perma-eco') ecoCount++;
      else if (p.playstyle === 'pure-war' || p.manualTag === 'perma-war') warCount++;
      else hybridCount++;
    }

    return { criticalLeechCount, inactiveCount, ecoCount, warCount, hybridCount };
  }, [filtered]);

  // Memoized verdict category counts (strictly verified citizens only)
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'slacker-evader': 0,
      'subsistence-worker': 0,
      'illiquid-asset-rich': 0,
      'patriotic-fulfiller': 0,
    };
    for (const p of displayedProfiles) {
      if (p.auditBaselineStatus !== 'audited') continue;
      const v = p.ministerialVerdict || p.playerCashflow?.ministerialVerdict;
      if (v && counts[v] !== undefined) {
        counts[v]++;
      }
    }
    return counts;
  }, [displayedProfiles]);

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

  const nudgeRecommendation = useMemo(() => {
    if (!activeNudgeProfile) return null;
    return calculateCitizenSuggestedDonation(
      activeNudgeProfile,
      countryBenchmark,
      config,
      nudgeArchetypeOverride,
      commodities
    );
  }, [activeNudgeProfile, countryBenchmark, config, nudgeArchetypeOverride, commodities]);

  const activeDiplomaticMode: DiplomaticActionMode =
    diplomaticModeOverride || nudgeRecommendation?.recommendedDiplomaticMode || 'nudge';
  const activeCommendationArchetype: CommendationArchetype =
    commendationArchetypeOverride || nudgeRecommendation?.recommendedCommendationArchetype || 'sovereign-treasury-patriot';
  const activeOverDonationArchetype: OverDonationWarningArchetype =
    overDonationArchetypeOverride || nudgeRecommendation?.recommendedOverDonationArchetype || 'capex-growth-strain';

  const effectiveNudgeBtc = customNudgeBtc ?? nudgeRecommendation?.suggestedAmountBtc ?? 50;

  const messages: MinisterialMessage[] = useMemo(() => {
    if (!activeNudgeProfile) return [];
    return generateMinisterialNudge(
      activeNudgeProfile,
      countryName,
      'MoE',
      config.analysisPeriodDays || 7,
      {
        customSuggestedBtc: effectiveNudgeBtc,
        archetypeOverride: nudgeArchetypeOverride,
        diplomaticMode: activeDiplomaticMode,
        commendationArchetype: activeCommendationArchetype,
        overDonationArchetype: activeOverDonationArchetype,
        countryBenchmark,
        config,
        commodities,
      }
    );
  }, [
    activeNudgeProfile,
    countryName,
    config,
    effectiveNudgeBtc,
    nudgeArchetypeOverride,
    activeDiplomaticMode,
    activeCommendationArchetype,
    activeOverDonationArchetype,
    countryBenchmark,
    commodities,
  ]);

  return (
    <div className="space-y-6">
      {/* Prominent Ministerial Directive Banner & Policy Calibration Entry Point */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>{`Sovereign Citizen & Leech Radar — ${countryName}`}</span>
            </h2>
            <span className="text-[10px] text-amber-300 font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 uppercase tracking-wider">
              Economy Ministry
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {`Real-time income growth audits, patriotic quotas, and diplomatic treasury alerts for ${countryName}.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Direct 7D vs 30D Audit Timeframe Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono shadow-inner">
            <span className="text-[10px] text-slate-500 uppercase px-2 font-bold font-sans">Audit Cycle:</span>
            <button
              type="button"
              disabled={isAuditing}
              onClick={() => onUpdateConfig?.({ ...config, analysisPeriodDays: 7 })}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs flex items-center gap-1.5 disabled:cursor-not-allowed ${
                (config?.analysisPeriodDays ?? 7) === 7
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-400 hover:text-white disabled:opacity-50'
              }`}
            >
              {(config?.analysisPeriodDays ?? 7) === 7 && isAuditing && (
                <Loader2 className="w-3 h-3 animate-spin text-slate-950" />
              )}
              <span>7 Days</span>
            </button>
            <button
              type="button"
              disabled={isAuditing}
              onClick={() => onUpdateConfig?.({ ...config, analysisPeriodDays: 30 })}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs flex items-center gap-1.5 disabled:cursor-not-allowed ${
                (config?.analysisPeriodDays ?? 7) === 30
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-400 hover:text-white disabled:opacity-50'
              }`}
            >
              {(config?.analysisPeriodDays ?? 7) === 30 && isAuditing && (
                <Loader2 className="w-3 h-3 animate-spin text-slate-950" />
              )}
              <span>30 Days</span>
            </button>
          </div>

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
      {/* High-Integrity National Census Ingestion Banner */}
      {isCohortAuditing && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-amber-400 shrink-0 animate-spin mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 text-sm block">
                National Census Ingestion in Progress — {countryName}
              </span>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Processed <strong className="text-white font-mono">{profiles.length}</strong> of <strong className="text-white font-mono">{targetCohortSize}</strong> registered active citizens ({auditProgressPct}%).
                Executive ministerial metrics (total net worth, leech classifications, build stances, and inactive donor counts) are held in pending status until all citizens are audited to prevent misleading fiscal intelligence.
              </p>
              <div className="w-full bg-slate-900/80 rounded-full h-2 mt-2 overflow-hidden border border-amber-500/30">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${auditProgressPct}%` }}
                />
              </div>
              {syncProgress?.message && (
                <div className="text-[11px] font-mono text-amber-400/80 mt-1">
                  {syncProgress.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Executive KPI Summary for Economy Minister */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Monitored Net Worth
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {`${activeCount} Active (Lvl 10+)`}
            </span>
          </div>
          {isCohortAuditing ? (
            <div className="py-1">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <span>Auditing National Assets...</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {`Aggregating complete census (${profiles.length}/${targetCohortSize} verified)`}
              </div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-black font-mono text-white">
                {formatBtc(filtered.reduce((acc, p) => acc + p.wealthBtc, 0))} <span className="text-xs text-amber-400 font-bold">BTC</span>
              </div>
              <div className="text-slate-400 text-[11px] mt-1 flex items-center justify-between">
                <span>
                  <span>{`Assets in ${countryName}`}</span>
                  {zeroContributionCount > 0 && (
                    <span className="text-slate-500 text-[10px] ml-1.5 font-normal">
                      {`(${profiles.length - zeroContributionCount} patrons • ${zeroContributionCount} zero-contrib)`}
                    </span>
                  )}
                </span>
                <span className="text-cyan-400 font-mono font-semibold" title={`Gross economic turnover across ${config?.analysisPeriodDays ?? 7} days`}>
                  {`${formatBtc(filtered.reduce((acc, p) => acc + (p.grossIncomeBtc || 0), 0))} BTC (${config?.analysisPeriodDays ?? 7}D Flow)`}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Critical Leeches Flagged
          </div>
          {isCohortAuditing ? (
            <div className="py-1">
              <div className="flex items-center gap-2 text-red-400 font-mono text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-red-400 shrink-0" />
                <span>Calculating Leech Quotas...</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Pending full {targetCohortSize}-citizen economic evaluation
              </div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-black font-mono text-red-400">
                {criticalLeechCount}
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                {`Contributing under ${config.lowContributorIncomeRatePct ?? 5}% of BTC income growth (${config.analysisPeriodDays ?? 7}D window)`}
              </div>
            </>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Inactive Donors (&gt;7d)
          </div>
          {isCohortAuditing ? (
            <div className="py-1">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <span>Scanning Inactive Donors...</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Verifying donation timestamps for {targetCohortSize} citizens
              </div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-black font-mono text-amber-400">
                {inactiveCount}
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Active citizens with no treasury contribution in 7+ days
              </div>
            </>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" /> Eco vs War Stance
          </div>
          {isCohortAuditing ? (
            <div className="py-1">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                <span>Analyzing Stance Distribution...</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Compiling Eco / War / Hybrid build distribution
              </div>
            </div>
          ) : (
            <>
              <div className="text-xl font-black font-mono text-white flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{ecoCount} 🌾</span>
                <span className="text-slate-500">/</span>
                <span className="text-red-400 font-bold">{warCount} ⚔️</span>
                <span className="text-slate-500">/</span>
                <span className="text-amber-400 font-bold">{hybridCount} ⚖️</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">Pure Eco / Pure War / Hybrid citizens</div>
            </>
          )}
        </div>
      </div>

      {/* Control Bar: Unified Single-Tier Toolbar with Uniform 40px (h-10) Controls */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search citizen or ID..."
              className="w-full h-10 pl-10 pr-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Compact Continuous Audit Status Pill */}
          <div className="h-10 inline-flex items-center gap-2 px-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs sm:text-sm shadow-inner shrink-0">
            {isAuditing ? (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span className="font-semibold whitespace-nowrap">{`${config?.analysisPeriodDays ?? 7}D Audit Active`}</span>
            {onRunIncomeAudit && (
              <button
                type="button"
                onClick={onRunIncomeAudit}
                disabled={isAuditing}
                title={`Force refresh ${config?.analysisPeriodDays ?? 7}-day income growth audit`}
                className="ml-0.5 p-1 text-cyan-400 hover:text-cyan-200 rounded-lg hover:bg-cyan-900/40 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Inactive Donor Alert Toggle Button (replaces raw browser checkbox) */}
          <button
            type="button"
            onClick={() => setOnlyInactiveDonors((prev) => !prev)}
            className={`h-10 inline-flex items-center gap-2 px-3.5 border rounded-xl text-xs sm:text-sm font-semibold select-none transition shrink-0 ${
              onlyInactiveDonors
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700 hover:text-white'
            }`}
            title="Filter citizens who have not donated in over 7 days"
          >
            <span
              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                onlyInactiveDonors
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'bg-slate-900 border-slate-700 text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="whitespace-nowrap">
              {`>7d Inactive (${isCohortAuditing ? `${inactiveDonorCount}...` : inactiveDonorCount})`}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Fiscal Standing Filter */}
          <select
            value={filterFiscalStanding}
            onChange={(e) => setFilterFiscalStanding(e.target.value)}
            className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
            title="Filter by sovereign fiscal standing"
          >
            <option value="all">
              {`All Fiscal Standings ${isCohortAuditing ? `(${profiles.length}/${targetCohortSize}...)` : `(${activeCount})`}`}
            </option>
            <option value="critical">
              {`🚨 Needs Attention / Leeches ${isCohortAuditing ? '(auditing...)' : `(${criticalLeechCount})`}`}
            </option>
            {zeroContributionCount > 0 && !isCohortAuditing && (
              <option value="zero-donations">{`⚠️ Zero Contributions (${zeroContributionCount})`}</option>
            )}
            <option value="moderate">🔵 Fair / Moderate Donors</option>
            <option value="patriot">🟢 Model Patriots &amp; Pillars</option>
          </select>

          {/* Build & Commitment Filter (7-Day Respec Aware) */}
          <select
            value={filterBuild}
            onChange={(e) => setFilterBuild(e.target.value)}
            className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
            title="Filter by build and commitment"
          >
            <option value="all">All Citizen Builds</option>
            <option value="eco">🌾 Eco Players (Dynamic &amp; Perma)</option>
            <option value="war">⚔️ War Players (Dynamic &amp; Perma)</option>
            <option value="hybrid">⚖️ Hybrid Builds</option>
            <option value="pinned">🔒 Pinned Builds Only</option>
          </select>

          {/* v0.27 BuhDeuce Build Evaluation Filter */}
          <select
            value={filterBuildGrade}
            onChange={(e) => setFilterBuildGrade(e.target.value)}
            className="h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 font-medium focus:outline-none focus:border-amber-500 transition cursor-pointer"
            title="Filter by War Era v0.27 BuhDeuce Build Evaluation Grade"
          >
            <option value="all">All v0.27 Build Grades</option>
            <option value="optimal-meta">🌟 Lvl 26+ Eco Meta (Lead + Mgmt)</option>
            <option value="optimal-early-selfwork">⚡ Lvl 1–25 Self-Work (Prod + Energy)</option>
            <option value="viable-selfwork">🛠️ Lvl 26+ Viable Self-Work (Prod + Energy)</option>
            <option value="war-ready">⚔️ War-Ready / War in Eco</option>
            <option value="suboptimal-sp">⚠️ SP Optimization Needed</option>
          </select>
        </div>
      </div>

      {/* Day-1 Baseline Audit Notice Banner */}
      {showBaselineBanner && profiles.some((p) => p.auditBaselineStatus === 'baseline-today') && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/50 text-xs sm:text-sm text-cyan-200 flex items-start justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-cyan-300 block">
                Continuous Fiscal Audit Active — Day-1 Provisional Baseline
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Daily wealth snapshots are recorded to establish verified historical deltas. Click &quot;Audit&quot; on any citizen to inspect their full multi-channel cashflow ledger and company upgrade breakdown.
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

      {/* Citizen Economic Radar Table */}
      <div className="relative overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
        {/* Automated Background Ledger Stream & Buffered Row-Lock Banner (Sticky while scrolling) */}
        {streamState.isRunning ? (
          <div className="sticky top-0 z-20 bg-gradient-to-r from-cyan-950/95 via-slate-900/95 to-indigo-950/95 backdrop-blur-md border-b border-cyan-700/60 px-4 py-3 space-y-2 text-xs sm:text-sm text-cyan-200 font-mono shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Loader2 className="w-4 h-4 text-cyan-400 shrink-0 animate-spin" />
                <span className="font-black text-white uppercase tracking-wide">
                  4-Thread Delta Receipt Verification:
                </span>
                <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold">
                  {streamState.auditedCount} / {streamState.totalTargetCount} Citizens ({streamState.pct}%)
                </span>
                {streamState.activeWorkers && streamState.activeWorkers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {streamState.activeWorkers.map((w) => (
                      <span
                        key={w.workerIndex}
                        className="px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <strong className="text-white">{w.username}</strong>
                        {w.retryAttempt && w.retryAttempt > 1 ? (
                          <span className="text-amber-300">(R#{w.retryAttempt})</span>
                        ) : (
                          <span className="text-emerald-300">({w.receiptCount})</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <span className="px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  🔒 Row Positions Locked While Browsing ({bufferedCount} Staged)
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {streamState.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => auditStreamService.retryFailed()}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                    title="Retry citizens whose receipt stream timed out or hit rate limits"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry {streamState.failedCount} Deferred
                  </button>
                )}
                {bufferedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyBufferedUpdates}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-sm"
                    title="Commit buffered background audits to the table now"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply {bufferedCount} Verified Updates</span>
                  </button>
                )}
                {streamState.isPaused ? (
                  <button
                    type="button"
                    onClick={() => auditStreamService.resume()}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                    title="Resume background ledger stream"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => auditStreamService.pause()}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                    title="Pause background ledger stream"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => auditStreamService.stop()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                  title="Stop background streaming"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
              </div>
            </div>

            {/* Graphical Progress Bar */}
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-cyan-900/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.max(4, streamState.pct)}%` }}
              />
            </div>
          </div>
        ) : bufferedCount > 0 ? (
          <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-amber-950/95 backdrop-blur-md border-b border-emerald-500/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-emerald-200 font-mono shadow-md">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>{`${bufferedCount} Verified Citizen Audits Ready`}</strong>{' '}
                <span>— Table row order was kept locked so rows wouldn&apos;t jump while you were browsing.</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyBufferedUpdates}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{`Apply ${bufferedCount} Verified Updates to Table`}</span>
            </button>
          </div>
        ) : streamState.isPaused ? (
          <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-amber-300 font-mono">
            <span className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-amber-400" />
              <span>{`Background Ledger Stream Paused (${streamState.auditedCount}/${streamState.totalTargetCount} verified)`}</span>
            </span>
            <button
              type="button"
              onClick={() => auditStreamService.resume()}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition"
            >
              <Play className="w-3.5 h-3.5" /> Resume Stream
            </button>
          </div>
        ) : pendingAuditCount === 0 && displayedProfiles.length > 0 ? (
          <div className="bg-emerald-950/60 border-b border-emerald-800/40 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-300 font-mono">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{`100% Truth-Based: All ${displayedProfiles.length} active citizens verified via live personal receipts`}</span>
              {pinnedInViewIds.size > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                  {`🔒 ${pinnedInViewIds.size} updated row(s) pinned in current filter view`}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {pinnedInViewIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setPinnedInViewIds(new Set())}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition"
                >
                  Re-Filter View
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onRunIncomeAudit?.();
                  auditStreamService.startStream(
                    displayedProfiles,
                    apiKey,
                    config,
                    countryBenchmark,
                    handleBackgroundStreamUpdate,
                    true
                  );
                }}
                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                title="Force re-audit of all citizen personal receipts and refresh live national residency"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-Audit All
              </button>
            </div>
          </div>
        ) : (
          displayedProfiles.length > 0 && (
            <div className="bg-amber-950/50 border-b border-amber-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-amber-200 font-mono">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{pendingAuditCount}</strong> of <strong>{displayedProfiles.length}</strong> citizens have unverified personal receipts ({auditedCount}/{displayedProfiles.length} verified). Unverified rows display no fabricated estimates.
                  {streamState.failedCount > 0 && (
                    <span className="ml-2 text-amber-300 font-bold">
                      ({streamState.failedCount} timed out after 3 retries)
                    </span>
                  )}
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {apiKey && apiKey.trim() ? (
                  <>
                    {streamState.failedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => auditStreamService.retryFailed()}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Retry {streamState.failedCount} Failed Citizens
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        auditStreamService.startStream(
                          displayedProfiles,
                          apiKey,
                          config,
                          countryBenchmark,
                          handleBackgroundStreamUpdate,
                          false
                        )
                      }
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5" /> Sync {pendingAuditCount} Pending Citizens Now
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        auditStreamService.startStream(
                          displayedProfiles,
                          apiKey,
                          config,
                          countryBenchmark,
                          handleBackgroundStreamUpdate,
                          true
                        )
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-Audit All
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-amber-300 font-sans">
                    Configure War Era API Key in header to stream live personal receipts
                  </span>
                )}
              </div>
            </div>
          )
        )}
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300 font-bold uppercase tracking-wider text-xs">
              <th className="py-3.5 px-3.5">Citizen</th>
              <th className="py-3.5 px-3.5 text-right">Net Worth</th>
              <th className="py-3.5 px-3.5 text-right">{`Inflow & Net (${config?.analysisPeriodDays ?? 7}D)`}</th>
              <th className="py-3.5 px-3.5 text-right">{`Donated (${config?.analysisPeriodDays ?? 7}D)`}</th>
              <th className="py-3.5 px-3.5 text-center">Fiscal Standing</th>
              <th className="py-3.5 px-3.5 text-center">Build &amp; Commitment</th>
              <th className="py-3.5 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-sm font-sans">
                  {`No citizens match the active filters in ${countryName}.`}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isPillar = c.leechTier === 'historical-pillar';
                const isCombatVeteran = c.leechTier === 'combat-veteran';
                const isLeech = c.leechTier === 'critical-leech';
                const isLow = c.leechTier === 'low-contributor';
                const isPatriot = c.leechTier === 'sovereign-patriot';
                const isPinned = c.manualTag && c.manualTag !== 'none';
                const { moderatePct: targetQuotaPct, patriotPct: targetPatriotPct } = getPlaystyleQuotaThresholds(
                  c.playstyle,
                  config
                );
                const buildLabel = c.playstyle === 'pure-eco' ? 'Eco' : c.playstyle === 'pure-war' ? 'War' : 'Hybrid';

                return (
                  <tr key={c.userId} className="hover:bg-slate-800/45 transition group">
                    {/* Citizen Avatar & Username */}
                    <td className="py-3 px-3.5 font-sans">
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => setSelectedAuditProfile(c)}
                          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-200 text-xs sm:text-sm cursor-pointer hover:border-cyan-400 transition"
                          title="Click to view economic audit breakdown"
                        >
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.username || 'Citizen'} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                          ) : (
                            (c.username || c.userId || 'CZ').slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 max-w-[180px] xl:max-w-[260px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedAuditProfile(c)}
                              className="font-extrabold text-white hover:text-cyan-400 transition truncate text-sm sm:text-base inline-flex items-center gap-1 text-left"
                              title="Click to inspect citizen full financial audit"
                            >
                              <span className="truncate">{c.username || `Citizen #${(c.userId || '').slice(-6)}`}</span>
                              <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 opacity-75 hover:opacity-100" />
                            </button>
                            {c.isHistoricalTopDonor && (
                              <span
                                className="text-xs text-amber-400 font-mono font-bold"
                                title={
                                  isPillar
                                    ? tx(
                                        `Top ${c.historicalRank ? `#${c.historicalRank}` : '10'} Lifetime Donor (${formatBtc(c.totalDonatedBtc)} BTC) — Qualified Historical Pillar`,
                                        `Donante Histórico Top ${c.historicalRank ? `#${c.historicalRank}` : '10'} (${formatBtc(c.totalDonatedBtc)} BTC) — Pilar Histórico Calificado`
                                      )
                                    : tx(
                                        `Top ${c.historicalRank ? `#${c.historicalRank}` : '10'} Lifetime Donor (${formatBtc(c.totalDonatedBtc)} BTC) — Below Rank #3 & ${config?.historicalDonorGraceThresholdBtc ?? 500} BTC Policy Grace Floor`,
                                        `Donante Histórico Top ${c.historicalRank ? `#${c.historicalRank}` : '10'} (${formatBtc(c.totalDonatedBtc)} BTC) — Bajo Rango #3 y Piso de Gracia de ${config?.historicalDonorGraceThresholdBtc ?? 500} BTC`
                                      )
                                }
                              >
                                ⭐ #{c.historicalRank || '10'}
                              </span>
                            )}
                            {c.isInactiveDonor && !c.isHistoricalTopDonor && (
                              <span className="text-xs text-amber-400/90 font-mono font-semibold" title={`Has not donated in ${c.daysSinceLastDonation} days`}>
                                ⚠️ &gt;7d
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono truncate">
                            ID: {c.userId.slice(-8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Net Worth */}
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAuditProfile(c)}
                        className="group/nw text-right hover:bg-slate-800/60 p-1 rounded-lg transition inline-block"
                        title="Click to inspect full asset portfolio & income audit calculation"
                      >
                        <div className="font-extrabold text-slate-100 text-sm sm:text-base group-hover/nw:text-amber-300">
                          {formatBtc(c.wealthBtc)}
                        </div>
                        {typeof c.pastWealthBtc === 'number' && c.auditBaselineStatus === 'audited' ? (
                          <span className={`text-xs font-mono font-bold block ${
                            c.wealthBtc >= c.pastWealthBtc ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {c.wealthBtc >= c.pastWealthBtc ? '+' : ''}{formatBtc(c.wealthBtc - c.pastWealthBtc)} ({config?.analysisPeriodDays ?? 7}d)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-sans group-hover/nw:text-amber-400 block" title="Initial snapshot baseline established today">
                            Baseline: Today
                          </span>
                        )}
                      </button>
                    </td>

                    {/* 7D Gross Inflow & Net Cashflow */}
                    <td className="py-3 px-3.5 text-right font-mono">
                      {c.auditBaselineStatus === 'audited' ? (
                        <div className="inline-flex flex-col items-end max-w-full">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditProfile(c)}
                            className="group/inc text-right hover:bg-cyan-950/40 p-1 rounded-lg transition inline-block max-w-full"
                            title="Click to inspect verified receipts: wages, trades, market orders, and net flow"
                          >
                            {/* Gross Inflow */}
                            <div className="flex items-center justify-end gap-1 font-bold text-cyan-300 text-xs sm:text-sm">
                              <span className="text-[10px] uppercase font-mono text-cyan-400 font-semibold">In</span>
                              <span>+{formatBtc(c.grossInflowBtc ?? c.grossIncomeBtc ?? 0)}</span>
                              <Calculator className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover/inc:opacity-100" />
                            </div>
                            {/* Net Cashflow */}
                            <div className="flex items-center justify-end gap-1 text-xs sm:text-sm font-mono font-bold mt-0.5">
                              <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Net</span>
                              <span className={(c.netCashflowBtc ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {(c.netCashflowBtc ?? 0) >= 0 ? '+' : ''}{formatBtc(c.netCashflowBtc ?? 0)}
                              </span>
                            </div>
                            {/* Verified Receipt Count */}
                            <div className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="font-semibold text-emerald-300">
                                {typeof c.receiptCount === 'number' ? `${c.receiptCount} receipts` : `Verified`}
                              </span>
                            </div>
                          </button>
                          {/* Dismissible Audit Delta Alert Badge */}
                          {c.auditDeltaAlert && (
                            <div
                              className="mt-1 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/50 text-[10px] text-cyan-200 font-sans text-right flex items-center gap-1 shadow-sm"
                              title={`Audited change: +${c.auditDeltaAlert.newReceiptsCount} new receipts found (${c.auditDeltaAlert.differenceBtc >= 0 ? '+' : ''}${formatBtc(c.auditDeltaAlert.differenceBtc)} BTC change). Click × to dismiss.`}
                            >
                              <span>+{c.auditDeltaAlert.newReceiptsCount} ({c.auditDeltaAlert.differenceBtc >= 0 ? '+' : ''}${formatBtc(c.auditDeltaAlert.differenceBtc)})</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dismissed = { ...c, auditDeltaAlert: undefined };
                                  onUpdateProfile?.(dismissed);
                                  storage.saveAuditedProfile(dismissed);
                                }}
                                className="text-cyan-400 hover:text-white ml-0.5 font-bold px-1 rounded hover:bg-cyan-800/50"
                                title="Dismiss notification"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedAuditProfile(c)}
                          className="group/pending text-right p-1 rounded-lg hover:bg-slate-800/60 transition inline-flex flex-col items-end"
                          title="Unverified citizen. No estimates displayed. Click to audit live personal receipts."
                        >
                          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-sans font-semibold flex items-center gap-1.5 group-hover/pending:bg-amber-500/20 group-hover/pending:border-amber-500/40 transition">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Pending Audit</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans mt-0.5 block">
                            Click to stream
                          </span>
                        </button>
                      )}
                    </td>

                    {/* Period Donated & Converted War Credit */}
                    <td className="py-3 px-3.5 text-right font-mono">
                      <div className={`font-extrabold text-sm sm:text-base ${
                        (c.periodDonatedBtc ?? c.directDonatedBtc ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {formatBtc(c.periodDonatedBtc ?? c.directDonatedBtc ?? 0)}
                      </div>
                      {Boolean(config?.includeDamageInLeechCalculation) && typeof c.damageValueBtc === 'number' && c.damageValueBtc > 0 && (
                        <div
                          className="inline-flex items-center justify-end gap-1 px-1.5 py-0.5 mt-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-300 font-mono font-bold"
                          title={tx(
                            `Converted Battlefield Defense Credit: (${(c.totalCombatDamage || 0).toLocaleString()} DMG ÷ 1,000) × ${config?.damageConversionRateBtcPer1k ?? 0.08} BTC = +${formatBtc(c.damageValueBtc)} BTC (Combined Standing Total: ${formatBtc((c.periodDonatedBtc ?? c.directDonatedBtc ?? 0) + c.damageValueBtc)} BTC)`,
                            `Crédito de Defensa por Daño en Combate: (${(c.totalCombatDamage || 0).toLocaleString()} DMG ÷ 1,000) × ${config?.damageConversionRateBtcPer1k ?? 0.08} BTC = +${formatBtc(c.damageValueBtc)} BTC (Total Combinado: ${formatBtc((c.periodDonatedBtc ?? c.directDonatedBtc ?? 0) + c.damageValueBtc)} BTC)`
                          )}
                        >
                          <span>{`+${formatBtc(c.damageValueBtc)} BTC ${tx('War Credit', 'Créd. Guerra')}`}</span>
                        </div>
                      )}
                      <div className="text-xs text-slate-300 font-sans mt-0.5">
                        {`${formatBtc(c.totalDonatedBtc)} life`}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {c.lastDonationAt ? (
                          <span>{formatDateDDMMYYYY(c.lastDonationAt)}</span>
                        ) : (
                          <span className="text-red-400">0 donations</span>
                        )}
                      </div>
                    </td>

                    {/* Fiscal Assessment & Actual vs Policy Target Quota */}
                    <td className="py-3 px-3.5 text-center font-sans relative">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 flex-wrap">
                          {c.auditBaselineStatus !== 'audited' && !isPillar && !c.specialContextTag ? (
                            <span className="text-amber-300/90 font-semibold">
                              {tx('⏳ Pending', '⏳ Pendiente')}
                            </span>
                          ) : isPillar ? (
                            <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                              <span
                                className="text-amber-300"
                                title={tx(
                                  `Historical Pillar: ${formatBtc(c.totalDonatedBtc)} BTC lifetime donated${c.historicalRank ? ` (All-Time Rank #${c.historicalRank})` : ''}`,
                                  `Pilar Histórico: ${formatBtc(c.totalDonatedBtc)} BTC donados de por vida${c.historicalRank ? ` (Rango Histórico #${c.historicalRank})` : ''}`
                                )}
                              >
                                {tx('🏛️ Pillar', '🏛️ Pilar')}
                              </span>
                              {c.isDormantPillar && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-300 cursor-help"
                                  title={tx(
                                    `Dormant Historical Pillar: Retains Pillar standing from ${formatBtc(c.totalDonatedBtc)} BTC lifetime donations, but contributed ${formatBtc(c.periodDonatedBtc ?? c.directDonatedBtc ?? 0)} BTC (${c.contributionRatio.toFixed(1)}% vs ${targetQuotaPct}% quota) this period. Open Nudge for Dual Recommendations (Commendation + Secondary Treasury Nudge).`,
                                    `Pilar Histórico Inactivo: Conserva el rango de Pilar por sus ${formatBtc(c.totalDonatedBtc)} BTC donados de por vida, pero aportó ${formatBtc(c.periodDonatedBtc ?? c.directDonatedBtc ?? 0)} BTC (${c.contributionRatio.toFixed(1)}% vs ${targetQuotaPct}% de cuota) en este período. Abre Nudge para ver la Doble Recomendación (Condecoración + Solicitud Secundaria).`
                                  )}
                                >
                                  {`⚠️ ${c.dormantWarningBadge || tx('Dormant', 'Inactivo')}`}
                                </span>
                              )}
                            </div>
                          ) : isCombatVeteran ? (
                            <span className="text-rose-300">{tx('⚔️ Frontline Hero', '⚔️ Héroe del Frente')}</span>
                          ) : isLeech ? (
                            <span className="text-red-400">{tx('🚨 Critical Leech', '🚨 Leech Crítico')}</span>
                          ) : isLow ? (
                            <span className="text-amber-400">{tx('⚠️ Low Donor', '⚠️ Bajo Donante')}</span>
                          ) : isPatriot ? (
                            <span className="text-emerald-400">{tx('🟢 Model Patriot', '🟢 Patriota Modelo')}</span>
                          ) : (
                            <span className="text-slate-200">{tx('🔵 Moderate', '🔵 Moderado')}</span>
                          )}

                          {/* Clickable ? Fiscal Standing Explanation Trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStandingExplainUserId((prev) => (prev === c.userId ? null : c.userId));
                            }}
                            className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-mono font-black border transition shrink-0 ${
                              standingExplainUserId === c.userId
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm'
                                : 'bg-slate-800/90 text-cyan-300 border-slate-700 hover:bg-cyan-500/20 hover:border-cyan-400/60'
                            }`}
                            title={tx(
                              'Click to see what this classification means and why this citizen is classified this way',
                              'Haz clic para ver qué significa esta clasificación y por qué este ciudadano está clasificado así'
                            )}
                          >
                            ?
                          </button>
                        </div>

                        {/* At-a-Glance Special Context Disclaimer Badge (Veteran on Pause/Hoarding, War Vet in Eco, Industrial Sacrifice) */}
                        {c.specialContextBadge && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStandingExplainUserId((prev) => (prev === c.userId ? null : c.userId));
                            }}
                            title={
                              lang === 'es' && c.specialContextReason
                                ? translateRawStringEs(c.specialContextReason)
                                : c.specialContextReason
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition max-w-[230px] truncate ${
                              c.specialContextTag === 'industrial-war-sacrifice'
                                ? 'bg-rose-500/15 text-rose-200 border-rose-400/40 hover:bg-rose-500/25'
                                : c.specialContextTag === 'war-vet-in-eco'
                                ? 'bg-indigo-500/15 text-indigo-200 border-indigo-400/40 hover:bg-indigo-500/25'
                                : 'bg-amber-500/15 text-amber-200 border-amber-400/40 hover:bg-amber-500/25'
                            }`}
                          >
                            {lang === 'es' ? translateRawStringEs(c.specialContextBadge) : c.specialContextBadge}
                          </button>
                        )}

                        <div
                          className="text-xs text-slate-300 font-mono flex items-center justify-center gap-1 flex-wrap"
                          title={
                            c.auditBaselineStatus === 'audited'
                              ? tx(
                                  `Effective Contribution: ${c.contributionRatio.toFixed(1)}% of Gross Inflow vs. ${targetQuotaPct}% Standard Quota (${targetPatriotPct}% Model Patriot Quota) set in Policies & Quotas for ${buildLabel} build`,
                                  `Contribución Efectiva: ${c.contributionRatio.toFixed(1)}% del Ingreso Bruto vs. ${targetQuotaPct}% Cuota Estándar (${targetPatriotPct}% Cuota Patriota Modelo) en Políticas y Cuotas para build ${buildLabel}`
                                )
                              : tx(
                                  `Policy Quota Target for ${buildLabel} build: ${targetQuotaPct}% Standard / ${targetPatriotPct}% Model Patriot`,
                                  `Cuota Objetivo para build ${buildLabel}: ${targetQuotaPct}% Estándar / ${targetPatriotPct}% Patriota Modelo`
                                )
                          }
                        >
                          {c.auditBaselineStatus === 'audited' ? (
                            <>
                              <span className={c.contributionRatio >= targetQuotaPct ? 'text-emerald-300 font-bold' : 'text-white font-bold'}>
                                {`${c.contributionRatio.toFixed(1)}%`}
                              </span>
                              <span className="text-slate-500">/</span>
                              <span className="text-amber-300 font-semibold">
                                {`${targetQuotaPct}% ${tx('Quota', 'Cuota')}`}
                              </span>
                              <span>·</span>
                              <span className="text-emerald-400 font-medium">{tx('Audited', 'Auditado')}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">
                              {`${targetQuotaPct}% ${tx('Quota', 'Cuota')} · ${tx('Unverified', 'Sin verificar')}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive ? Popover Card Explaining Classification & Exact Numbers */}
                      {standingExplainUserId === c.userId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 p-3.5 rounded-2xl theme-popover-surface border-2 shadow-2xl text-left text-xs space-y-2.5 z-40 relative max-w-[330px] mx-auto animate-in fade-in duration-150"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-700/80 pb-2">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                                {tx('Fiscal Standing Explainer', 'Explicación de Clasificación Fiscal')}
                              </div>
                              <div className="font-black text-white text-xs sm:text-sm mt-0.5">
                                {c.username}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setStandingExplainUserId(null)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* 1. What this classification means */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                              {tx('1. What This Standing Means', '1. Qué Significa Este Estatus')}
                            </div>
                            <p className="text-slate-200 leading-relaxed text-[11px]">
                              {isPillar
                                ? c.isDormantPillar
                                  ? tx(
                                      'Dormant Historical Pillar: Top lifetime national donor protected by the Policy Grace Floor, but with 0 or below-quota donations in the active window.',
                                      'Pilar Histórico Inactivo: Donante histórico top protegido por el Piso de Gracia, pero con 0 o bajas donaciones en el período actual.'
                                    )
                                  : tx(
                                      'Historical Pillar: Foundational all-time treasury donor whose lifetime contributions exceed the national Policy Grace Floor.',
                                      'Pilar Histórico: Donante histórico fundamental cuyos aportes acumulados superan el Piso de Gracia nacional.'
                                    )
                                : isCombatVeteran
                                ? tx(
                                    'Frontline Hero: Active war combatant dealing top-tier battlefield damage for the country.',
                                    'Héroe del Frente: Combatiente activo que inflige daño de primer nivel en batalla por el país.'
                                  )
                                : isPatriot
                                ? tx(
                                    `Model Patriot: Citizen meeting or exceeding the ${targetPatriotPct}% ${buildLabel} Patriot contribution quota.`,
                                    `Patriota Modelo: Ciudadano que cumple o supera la cuota Patriota del ${targetPatriotPct}% para build ${buildLabel}.`
                                  )
                                : isLeech
                                ? tx(
                                    'Critical Leech: Upper-quartile wealth or idle liquidity/stockpile holder contributing <0.2% of wealth and below the playstyle quota, without veteran or sacrifice exemptions.',
                                    'Leech Crítico: Ciudadano en el cuartil superior de riqueza o liquidez/stock inactivo que aporta <0.2% de su patrimonio y bajo la cuota, sin exenciones de veterano o sacrificio.'
                                  )
                                : isLow
                                ? tx(
                                    'Low Donor: Citizen contributing below the standard playstyle quota, or a proven above-median veteran currently on a donation pause.',
                                    'Bajo Donante: Ciudadano que aporta por debajo de la cuota estándar, o un veterano sobre la mediana actualmente en pausa.'
                                  )
                                : tx(
                                    `Moderate Contributor: Citizen meeting the ${targetQuotaPct}% standard quota or protected by verified veteran/sacrifice context.`,
                                    `Contribuyente Moderado: Ciudadano que cumple la cuota estándar del ${targetQuotaPct}% o está protegido por contexto verificado de veterano/sacrificio.`
                                  )}
                            </p>
                          </div>

                          {/* 2. Why this citizen is classified like this (exact numbers) */}
                          <div className="space-y-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80">
                            <div className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                              {tx('2. Why Classified This Way (Live Metrics)', '2. Por Qué Está Clasificado Así (Métricas)')}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1">
                              <div>
                                <span className="text-slate-400">{tx('Period:', 'Período:')}</span>{' '}
                                <strong className="text-amber-300">{formatBtc(c.periodDonatedBtc ?? c.directDonatedBtc ?? 0)} BTC</strong>
                              </div>
                              <div>
                                <span className="text-slate-400">{tx('Ratio:', 'Ratio:')}</span>{' '}
                                <strong className="text-white">{c.contributionRatio.toFixed(1)}%</strong>{' '}
                                <span className="text-slate-500">/ {targetQuotaPct}%</span>
                              </div>
                              <div>
                                <span className="text-slate-400">{tx('Lifetime:', 'Histórico:')}</span>{' '}
                                <strong className="text-emerald-300">{formatBtc(c.totalDonatedBtc)} BTC</strong>
                              </div>
                              <div>
                                <span className="text-slate-400">{tx('Country Med:', 'Med. País:')}</span>{' '}
                                <strong className="text-slate-300">{formatBtc(countryBenchmark?.lifetimeDonationMedian ?? 150)} BTC</strong>
                              </div>
                              <div>
                                <span className="text-slate-400">{tx('Liquid:', 'Líquido:')}</span>{' '}
                                <strong className="text-cyan-300">{formatBtc(c.liquidBtc || 0)} BTC</strong>
                              </div>
                              <div>
                                <span className="text-slate-400">{tx('Stock:', 'Stock:')}</span>{' '}
                                <strong className="text-indigo-300">{formatBtc(c.resourceWealthBtc || 0)} BTC</strong>
                              </div>
                            </div>
                            {(c.specialContextReason || c.tierReasonBadge) && (
                              <p className="text-[11px] text-slate-300 leading-relaxed pt-1.5 border-t border-slate-700/80 font-sans">
                                {lang === 'es'
                                  ? translateRawStringEs((c.specialContextReason || c.tierReasonBadge)!)
                                  : (c.specialContextReason || c.tierReasonBadge)}
                              </p>
                            )}
                          </div>

                          {/* 3. Quick Actions */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setStandingExplainUserId(null);
                                setSelectedAuditProfile(c);
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-bold text-[11px] transition text-center"
                            >
                              {tx('🔍 Open Full Audit', '🔍 Abrir Auditoría')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStandingExplainUserId(null);
                                setDiplomaticModeOverride(undefined);
                                setNudgeArchetypeOverride(undefined);
                                setCommendationArchetypeOverride(undefined);
                                setOverDonationArchetypeOverride(undefined);
                                setCustomNudgeBtc(undefined);
                                setActiveNudgeProfile(c);
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-[11px] transition text-center"
                            >
                              {tx('📨 Diplomatic Nudge', '📨 Enviar Nudge')}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Playstyle & Commitment (7-day Respec Pin) */}
                    <td className="py-3 px-3.5 text-center font-sans">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1 whitespace-nowrap">
                          {isPinned ? (
                            <span className={c.manualTag === 'perma-war' ? 'text-rose-300' : c.manualTag === 'perma-eco' ? 'text-emerald-300' : 'text-amber-300'}>
                              {c.manualTag === 'perma-war' && '🛡️ Perma-War'}
                              {c.manualTag === 'perma-eco' && '🌾 Perma-Eco'}
                              {c.manualTag === 'mercenary' && '⚔️ Mercenary'}
                              {c.manualTag === 'vip' && '⭐ VIP'}
                              {c.manualTag === 'mixed-style' && '🔄 Mixed'}
                            </span>
                          ) : (
                            <span>
                              {c.playstyle === 'pure-eco' ? '🌾 Eco' : c.playstyle === 'pure-war' ? '⚔️ War' : '⚖️ Hybrid'}
                            </span>
                          )}
                          <span className="text-xs text-slate-300 font-mono font-normal">
                            {`· Lvl ${c.level}`}
                          </span>
                        </div>

                        {/* v0.27 Build Evaluation Badge */}
                        {c.buildEvaluation && (
                          <button
                            type="button"
                            onClick={() => setSelectedAuditProfile(c)}
                            title={c.buildEvaluation.summary}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                              c.buildEvaluation.grade === 'optimal-meta'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                : c.buildEvaluation.grade === 'optimal-early-selfwork'
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25'
                                : c.buildEvaluation.grade === 'viable-selfwork'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                                : c.buildEvaluation.grade === 'war-ready'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                            }`}
                          >
                            {c.buildEvaluation.shortLabel}
                          </button>
                        )}

                        {/* Inline Respec Pin Selector */}
                        <select
                          value={c.manualTag}
                          onChange={(e) => onUpdateTag(c.userId, e.target.value as PlayerTag, c.notes)}
                          className="mt-0.5 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-[10px] text-slate-300 hover:text-white hover:border-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                          title="Set commitment pin: protects player from weekly 7-day cooldown skill point shifts"
                        >
                          <option value="none">Dynamic (Auto)</option>
                          <option value="perma-war">Pin: Perma-War</option>
                          <option value="perma-eco">Pin: Perma-Eco</option>
                          <option value="mercenary">Pin: Mercenary</option>
                          <option value="vip">Pin: VIP</option>
                        </select>
                      </div>
                    </td>

                    {/* Diplomatic & Watch Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditProfile(c)}
                          className="px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 font-bold rounded-xl text-xs transition active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
                          title="Open comprehensive forensic financial audit: multi-company inventory, wages, trades, and hoarding analysis"
                        >
                          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Audit</span>
                        </button>

                        {watchedUserIds.has(c.userId) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenWatchModal(c)}
                            className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold rounded-xl text-xs transition active:scale-95 inline-flex items-center"
                            title="Citizen currently on watch. Click to view/edit surveillance note."
                          >
                            <Eye className="w-4 h-4 text-amber-400" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenWatchModal(c)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold rounded-xl text-xs transition active:scale-95 inline-flex items-center"
                            title="Place citizen on watch list with surveillance note"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
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
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
            {/* Fixed Top Header Banner — isolated from scroll body so content never bleeds above or behind it */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800 bg-slate-900 shrink-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {tx('Sovereign Policy & Leech Calibration', 'Calibración de Políticas Soberanas y Leeches')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tx(
                      `Customizable income donation ratios by playstyle for ${countryName}`,
                      `Proporciones personalizables de donación de ingresos según estilo de juego para ${countryName}`
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyHelp((prev) => !prev)}
                  className="text-xs text-amber-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                  title={tx('Toggle Policy Guide & Rules', 'Mostrar/Ocultar Guía de Políticas y Reglas')}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {showPolicyHelp
                      ? tx('Hide Guide', 'Ocultar Guía')
                      : tx('Policy Guide', 'Guía de Políticas')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title={tx('Close', 'Cerrar')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form noValidate onSubmit={handleSavePolicy} className="flex flex-col flex-1 min-h-0 text-xs font-sans">
              {/* Dedicated Scrollable Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* Comprehensive Help & Calibration Guide Drawer */}
                {showPolicyHelp && (
                  <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-slate-300 space-y-2.5 animate-fade-in">
                    <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        {tx('How Policy Calibration Works in War Era', 'Cómo Funciona la Calibración de Políticas en War Era')}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      <strong>{tx('Income Quotas (%):', 'Cuotas de Ingreso (%):')}</strong>{' '}
                      {tx(
                        'Set the minimum percentage of weekly BTC earnings a citizen must donate to earn each tier. For example, a Patriot quota of 15% means a citizen earning 1,000 BTC must donate ≥150 BTC to receive Model Patriot status.',
                        'Define el porcentaje mínimo de ingresos semanales en BTC que un ciudadano debe donar para alcanzar cada nivel. Por ejemplo, una cuota Patriota del 15% significa que un ciudadano que gana 1,000 BTC debe donar ≥150 BTC para recibir el estatus de Patriota Modelo.'
                      )}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      <strong>{tx('Playstyle Roles:', 'Roles por Estilo de Juego:')}</strong>{' '}
                      {tx(
                        'Soldiers fighting on the frontlines in',
                        'Los soldados que combaten en primera línea en'
                      )}{' '}
                      <strong>{tx('War Mode', 'Modo War')}</strong>{' '}
                      {tx(
                        'spend heavily on tanks and munitions; their quotas are lower (e.g. 5% Patriot / 2.5% Moderate / 1% Low). Industrialists in',
                        'gastan fuertemente en tanques y municiones; sus cuotas son menores (ej. 5% Patriota / 2.5% Moderado / 1% Bajo). Los industriales en'
                      )}{' '}
                      <strong>{tx('Eco Mode', 'Modo Eco')}</strong>{' '}
                      {tx(
                        'reap passive company dividends; their quotas are higher (e.g. 15% / 10% / 5%).',
                        'obtienen dividendos pasivos de sus empresas; sus cuotas son mayores (ej. 15% / 10% / 5%).'
                      )}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      <strong>{tx('Veteran Grace Floor:', 'Piso de Gracia para Veteranos:')}</strong>{' '}
                      {tx(
                        "Citizens ranked in the nation's Top Lifetime Donors who meet this lifetime contribution floor are honored as Historical Pillars and protected from Critical Leech designation during active military campaigns.",
                        'Los ciudadanos ubicados en el Top de Donantes Históricos de la nación que alcancen este piso acumulado son honrados como Pilares Históricos y protegidos de ser clasificados como Leeches Críticos durante campañas militares activas.'
                      )}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      <strong>{tx('Immediate Effect:', 'Efecto Inmediato:')}</strong>{' '}
                      {tx(
                        'Saving your policy updates recalculates citizen audits and contribution ratios instantly!',
                        '¡Guardar tus cambios de política recalcula las auditorías ciudadanas y las tasas de contribución al instante!'
                      )}
                    </p>
                  </div>
                )}

                {!isPolicyValid && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>
                      <strong>{tx('Invalid Quota Hierarchy:', 'Jerarquía de Cuotas Inválida:')}</strong>{' '}
                      {tx('Quotas must satisfy', 'Las cuotas deben cumplir')}{' '}
                      <strong>{tx('Patriot > Moderate > Low Contributor', 'Patriota > Moderado > Bajo Contribuyente')}</strong>{' '}
                      {tx('for each playstyle.', 'para cada estilo de juego.')}
                    </span>
                  </div>
                )}

                {/* Analysis Period */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <label className="block text-slate-300 font-bold mb-1">
                    {tx('Analysis Period Window (Days)', 'Ventana del Período de Análisis (Días)')}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                    {tx(
                      'Timeframe over which citizen BTC income growth is audited (default: 7 days / 1 week).',
                      'Período de tiempo sobre el cual se audita el crecimiento de ingresos en BTC del ciudadano (predeterminado: 7 días / 1 semana).'
                    )}
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
                        {d} {d === 1 ? tx('Day', 'Día') : tx('Days', 'Días')}
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

                {/* Hybrid & General Default Quotas */}
                <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="font-bold text-white flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-amber-400" />
                      <span>{tx('⚖️ Hybrid & General Income Quotas (%)', '⚖️ Cuotas Modo Hybrid y General (%)')}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tx('Balanced Eco + War builds', 'Builds equilibradas Eco + War')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-emerald-400 text-[11px] font-bold mb-1">
                        {tx('Patriot ≥', 'Patriota ≥')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={policyDraft.patriotIncomeRatePct ?? 15}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPolicyDraft((prev) => ({
                            ...prev,
                            patriotIncomeRatePct: val,
                            hybridPatriotRatePct: val,
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-400 text-[11px] font-bold mb-1">
                        {tx('Moderate ≥', 'Moderado ≥')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={policyDraft.moderateIncomeRatePct ?? 7}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPolicyDraft((prev) => ({
                            ...prev,
                            moderateIncomeRatePct: val,
                            hybridModerateRatePct: val,
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-400 text-[11px] font-bold mb-1">
                        {tx('Low Contributor ≥', 'Bajo Contribuyente ≥')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={policyDraft.lowContributorIncomeRatePct ?? 2.5}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPolicyDraft((prev) => ({
                            ...prev,
                            lowContributorIncomeRatePct: val,
                            hybridLowRatePct: val,
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* War Mode Specific Quotas */}
                <div className="p-3.5 bg-slate-950/70 border border-red-900/30 rounded-2xl space-y-2.5">
                  <div className="font-bold text-red-300 flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>
                        {tx('⚔️ War Mode Quotas (Frontline Combatants)', '⚔️ Cuotas Modo War (Combatientes del Frente)')}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tx('Spends on munitions & combat', 'Gasta en municiones y combate')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-emerald-400 text-[11px] font-bold mb-1">
                        {tx('War Patriot ≥', 'Patriota War ≥')}
                      </label>
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
                      <label className="block text-blue-400 text-[11px] font-bold mb-1">
                        {tx('War Moderate ≥', 'Moderado War ≥')}
                      </label>
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
                      <label className="block text-amber-400 text-[11px] font-bold mb-1">
                        {tx('War Low ≥', 'Bajo War ≥')}
                      </label>
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
                  <div className="font-bold text-emerald-300 flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Sprout className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {tx('🌾 Eco Mode Quotas (Industrialists & Companies)', '🌾 Cuotas Modo Eco (Industriales y Empresas)')}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tx('Higher passive margins', 'Mayores márgenes pasivos')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-emerald-400 text-[11px] font-bold mb-1">
                        {tx('Eco Patriot ≥', 'Patriota Eco ≥')}
                      </label>
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
                      <label className="block text-blue-400 text-[11px] font-bold mb-1">
                        {tx('Eco Moderate ≥', 'Moderado Eco ≥')}
                      </label>
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
                      <label className="block text-amber-400 text-[11px] font-bold mb-1">
                        {tx('Eco Low ≥', 'Bajo Eco ≥')}
                      </label>
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
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {tx(
                        'Historical Big Contributor Grace Floor (BTC)',
                        'Piso de Gracia para Grandes Contribuyentes Históricos (BTC)'
                      )}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {tx(
                      "Citizens ranked in the nation's Top Lifetime Donors with cumulative donations ≥ this floor are honored as",
                      'Los ciudadanos ubicados en el Top de Donantes Históricos de la nación con donaciones acumuladas ≥ este piso son honrados como'
                    )}{' '}
                    <strong>{tx('Historical Pillars', 'Pilares Históricos')}</strong>{' '}
                    {tx(
                      'and protected from being classified as critical leeches during military mobilization.',
                      'y protegidos de ser clasificados como leeches críticos durante la movilización militar.'
                    )}
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
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {tx(
                        'Top Lifetime Donors Hall of Fame Protection (Rank)',
                        'Protección Salón de la Fama Top Donantes Históricos (Rango)'
                      )}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {tx(
                      "Citizens ranked in the nation's Top X lifetime donors (default: Top 10) are honored as",
                      'Los ciudadanos ubicados en el Top X de donantes históricos de la nación (predeterminado: Top 10) son honrados como'
                    )}{' '}
                    <strong>{tx('Historical Pillars', 'Pilares Históricos')}</strong>{' '}
                    {tx(
                      'and protected from leech designation even if currently in war munitions mode or inactive.',
                      'y protegidos de la designación de leech incluso si actualmente están en modo munición de guerra o inactivos.'
                    )}
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
                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {tx(
                        'National Wealth Percentile Floor for Critical Leech',
                        'Piso de Percentil de Riqueza Nacional para Leech Crítico'
                      )}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {tx(
                      `Only citizens in the upper wealth brackets of ${countryName} (e.g. Top 25% / 75th percentile) can be classified as Critical Leeches if donating 0. Working-class and modest-wealth citizens are protected as Low Contributors.`,
                      `Solo los ciudadanos en los tramos superiores de riqueza de ${countryName} (ej. Top 25% / percentil 75) pueden ser clasificados como Leeches Críticos si donan 0. Los ciudadanos de clase trabajadora y patrimonio modesto están protegidos como Bajos Contribuyentes.`
                    )}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: tx('Top 50% (Median)', 'Top 50% (Mediana)'), val: 50 },
                      { label: tx('Top 25% (P75 - Default)', 'Top 25% (P75 - Predeterminado)'), val: 75 },
                      { label: tx('Top 20% (P80)', 'Top 20% (P80)'), val: 80 },
                      { label: tx('Top 10% (P90)', 'Top 10% (P90)'), val: 90 },
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
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>
                          {tx(
                            'Convert Battlefield Damage to Defense Credit',
                            'Convertir Daño en Campo de Batalla a Crédito de Defensa'
                          )}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                        {tx(
                          'Awards frontline warriors who deal massive combat damage (even with 0 direct BTC donations) with defense contribution credit, recognizing them as Combat Heroes instead of leeches.',
                          'Otorga a los guerreros de primera línea que infligen un daño masivo en combate (incluso con 0 donaciones directas en BTC) crédito de contribución a la defensa, reconociéndolos como Héroes de Combate en lugar de leeches.'
                        )}
                      </span>
                    </div>
                  </label>

                  {policyDraft.includeDamageInLeechCalculation && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2 pl-6">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold text-slate-300">
                          {tx(
                            'Conversion Rate (BTC per 1,000 damage dealt):',
                            'Tasa de Conversión (BTC por cada 1,000 de daño infligido):'
                          )}
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
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          {tx('Presets:', 'Ajustes:')}
                        </span>
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
                          {tx(
                            `Formula: (Battlefield Damage ÷ 1,000) × ${policyDraft.damageConversionRateBtcPer1k ?? 0.08} BTC`,
                            `Fórmula: (Daño en Campo de Batalla ÷ 1,000) × ${policyDraft.damageConversionRateBtcPer1k ?? 0.08} BTC`
                          )}
                        </div>
                        <div className="text-slate-400">
                          ⚔️ <strong>{tx('Universal Defense Credit:', 'Crédito de Defensa Universal:')}</strong>{' '}
                          {tx(
                            'Applied to all citizens with recorded battlefield damage across Eco, Hybrid, and War builds without artificial caps. Combines with direct BTC donations toward playstyle quotas.',
                            'Se aplica a todos los ciudadanos con daño registrado en campo de batalla (builds Eco, Hybrid y War) sin límites artificiales. Se suma a las donaciones directas en BTC para cumplir las cuotas.'
                          )}
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
                        {tx(
                          'Include Raw Resource Wealth (Commodities, excluding equipment)',
                          'Incluir Riqueza en Recursos Brutos (Materias Primas, excluyendo equipamiento)'
                        )}
                      </span>
                      <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                        {tx(
                          'Counts resource stockpiles (iron, lead, oil, bread, narcotics) in donation capacity calculations, as displayed in player stats.',
                          'Contabiliza las reservas de recursos (hierro, plomo, petróleo, pan, narcóticos) en los cálculos de capacidad de donación, tal como se muestra en las estadísticas del jugador.'
                        )}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 shrink-0 z-20 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setPolicyDraft(sanitizePolicyConfig(config))}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  title={tx(
                    'Reset all thresholds to live country API-calculated defaults',
                    'Restablecer todos los umbrales a los valores predeterminados del país'
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{tx('Reset to Country Defaults', 'Restablecer a Valores del País')}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                  >
                    {tx('Cancel', 'Cancelar')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md active:scale-95"
                  >
                    {tx('Save & Apply Policy', 'Guardar y Aplicar Política')}
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

      {/* Modal: Adaptive Diplomatic Telegram Generator (Nudge, Merit Commendation, & Over-Donation Warning) */}
      {activeNudgeProfile && nudgeRecommendation && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
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
                      {activeDiplomaticMode === 'commendation'
                        ? 'Patriot & Hero Diplomatic Commendation'
                        : activeDiplomaticMode === 'over-donation-warning'
                        ? 'Over-Donation Burnout & Solvency Advisory'
                        : 'Dynamic Diplomatic Treasury Nudge'}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-md border text-xs font-mono font-bold ${
                        activeDiplomaticMode === 'commendation'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : activeDiplomaticMode === 'over-donation-warning'
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {activeDiplomaticMode === 'commendation'
                        ? (nudgeRecommendation.commendationOptions ?? nudgeRecommendation.commendationArchetypeOptions ?? []).find((o) => o.id === activeCommendationArchetype)?.title || 'Patriot Commendation'
                        : activeDiplomaticMode === 'over-donation-warning'
                        ? (nudgeRecommendation.overDonationOptions ?? nudgeRecommendation.overDonationArchetypeOptions ?? []).find((o) => o.id === activeOverDonationArchetype)?.title || 'Over-Donation Advisory'
                        : nudgeRecommendation.archetypeLabel}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    <span>Tailored in-game telegram for</span>{' '}
                    <strong className="text-amber-300">{activeNudgeProfile.username}</strong>{' '}
                    <span>{`(Level ${activeNudgeProfile.level} • ${activeNudgeProfile.playstyle.replace('-', ' ')})`}</span>
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

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 my-4">
              {/* 0. Ministerial Evaluation & Adaptive Diplomatic Mode Switcher (With Dual Recommendation Support) */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  nudgeRecommendation.recommendedDiplomaticMode === 'commendation'
                    ? 'bg-emerald-950/35 border-emerald-500/40'
                    : nudgeRecommendation.recommendedDiplomaticMode === 'over-donation-warning'
                    ? 'bg-cyan-950/35 border-cyan-500/40'
                    : 'bg-amber-950/30 border-amber-500/35'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black uppercase tracking-wide border ${
                        nudgeRecommendation.recommendedDiplomaticMode === 'commendation'
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                          : nudgeRecommendation.recommendedDiplomaticMode === 'over-donation-warning'
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                          : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      }`}
                    >
                      {`★ Recommended Action: ${nudgeRecommendation.recommendedDiplomaticModeLabel}`}
                    </span>
                    <span className="text-xs font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                      {nudgeRecommendation.recommendedDiplomaticBadge}
                    </span>
                    {nudgeRecommendation.isDormantPillar && nudgeRecommendation.dormantWarningBadge && (
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 border border-amber-400/50 text-amber-200"
                        title={nudgeRecommendation.dormantWarningTooltip}
                      >
                        {`🏛️⚠️ ${tx('Historical Pillar', 'Pilar Histórico')} • ${nudgeRecommendation.dormantWarningBadge}`}
                      </span>
                    )}
                    {nudgeRecommendation.specialContextBadge && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                          nudgeRecommendation.specialContextTag === 'industrial-war-sacrifice'
                            ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                            : nudgeRecommendation.specialContextTag === 'war-vet-in-eco'
                            ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                            : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        }`}
                        title={nudgeRecommendation.specialContextReason}
                      >
                        {nudgeRecommendation.specialContextBadge}
                      </span>
                    )}
                  </div>
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
                      className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 self-start sm:self-auto shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Auto-Recommended Mode</span>
                    </button>
                  )}
                </div>

                <p className="text-sm text-slate-200 leading-relaxed">
                  {nudgeRecommendation.recommendedDiplomaticReason}
                </p>

                {/* Dual Recommendation Callout Banner for Dormant Historical Pillars & Stockpiling Heroes */}
                {nudgeRecommendation.secondaryDiplomaticMode && nudgeRecommendation.secondaryDiplomaticModeLabel && (
                  <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200 text-xs font-mono font-black uppercase">
                          {`⚡ ${tx('Secondary Recommendation', 'Recomendación Secundaria')}: ${nudgeRecommendation.secondaryDiplomaticModeLabel}`}
                        </span>
                        {nudgeRecommendation.secondaryDiplomaticBadge && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-xs font-mono font-bold text-amber-300">
                            {nudgeRecommendation.secondaryDiplomaticBadge}
                          </span>
                        )}
                      </div>
                      {nudgeRecommendation.secondaryDiplomaticModeReason && (
                        <p className="text-xs text-amber-100/90 leading-relaxed">
                          {nudgeRecommendation.secondaryDiplomaticModeReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeDiplomaticMode !== nudgeRecommendation.secondaryDiplomaticMode ? (
                        <button
                          type="button"
                          onClick={() => setDiplomaticModeOverride(nudgeRecommendation.secondaryDiplomaticMode)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm whitespace-nowrap"
                        >
                          {tx('Switch to Secondary (Treasury Nudge)', 'Cambiar a Secundaria (Solicitud del Tesoro)')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDiplomaticModeOverride(nudgeRecommendation.recommendedDiplomaticMode)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-sm whitespace-nowrap"
                        >
                          {tx('Switch to Primary (Patriot Commendation)', 'Cambiar a Principal (Condecoración)')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 3-Way Diplomatic Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {([
                    {
                      mode: 'nudge' as DiplomaticActionMode,
                      title: 'Treasury Nudge',
                      sub: 'Request fair BTC contribution',
                      activeClass: 'bg-amber-500/20 border-amber-400 text-white shadow-sm',
                      badgeColor: 'text-amber-300',
                    },
                    {
                      mode: 'commendation' as DiplomaticActionMode,
                      title: 'Patriot Commendation',
                      sub: 'Congratulate donors, heroes & pillars',
                      activeClass: 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm',
                      badgeColor: 'text-emerald-300',
                    },
                    {
                      mode: 'over-donation-warning' as DiplomaticActionMode,
                      title: 'Over-Donation Warning',
                      sub: 'Protect citizen growth & ammo',
                      activeClass: 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm',
                      badgeColor: 'text-cyan-300',
                    },
                  ]).map((tab) => {
                    const isSelected = activeDiplomaticMode === tab.mode;
                    const isRec = nudgeRecommendation.recommendedDiplomaticMode === tab.mode;
                    const isSecondaryRec = nudgeRecommendation.secondaryDiplomaticMode === tab.mode;
                    return (
                      <button
                        key={tab.mode}
                        type="button"
                        onClick={() => setDiplomaticModeOverride(tab.mode)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? tab.activeClass
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-black">{tab.title}</span>
                          {isSelected && <Check className={`w-4 h-4 shrink-0 ${tab.badgeColor}`} />}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">{tab.sub}</div>
                        {isRec && (
                          <div className="mt-1.5 inline-block self-start px-2 py-0.5 rounded bg-slate-950/90 border border-emerald-500/50 text-[11px] font-mono font-bold text-emerald-300">
                            {`★ ${tx('Primary Rec. for', 'Rec. Principal para')} ${activeNudgeProfile.username}`}
                          </div>
                        )}
                        {isSecondaryRec && (
                          <div className="mt-1.5 inline-block self-start px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/50 text-[11px] font-mono font-bold text-amber-300">
                            {`⚡ ${tx('Secondary Rec. for', 'Rec. Secundaria para')} ${activeNudgeProfile.username}`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1. Country-Relative Telemetry Comparison Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="text-xs text-slate-400 uppercase font-sans font-bold">Idle Liquid Cash</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">
                    {formatBtc(nudgeRecommendation.liquidBtc)} BTC
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <span className={nudgeRecommendation.liquidRatioToCountryMedian >= 1.8 ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                      {nudgeRecommendation.liquidRatioToCountryMedian}x
                    </span>{' '}
                    <span>country median</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="text-xs text-slate-400 uppercase font-sans font-bold">Resource Stockpile</div>
                  <div className="text-base font-black text-cyan-300 mt-0.5">
                    {formatBtc(nudgeRecommendation.resourceWealthBtc)} BTC
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <span className={nudgeRecommendation.resourceRatioToCountryMedian >= 3.5 ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                      {nudgeRecommendation.resourceRatioToCountryMedian}x
                    </span>{' '}
                    <span>{`median (Buffer: ${formatBtc(nudgeRecommendation.protectedGrowthReserveBtc)} BTC)`}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="text-xs text-slate-400 uppercase font-sans font-bold">Weekly Cashflow</div>
                  <div className="text-base font-black text-white mt-0.5">
                    {formatBtc(nudgeRecommendation.grossIncomeBtc)} BTC
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <span className="text-slate-300">{nudgeRecommendation.incomeRatioToCountryMedian}x</span>{' '}
                    <span>country median</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  <div className="text-xs text-slate-400 uppercase font-sans font-bold">Period Donated</div>
                  <div className="text-base font-black text-amber-400 mt-0.5">
                    {formatBtc(activeNudgeProfile.periodDonatedBtc ?? activeNudgeProfile.directDonatedBtc ?? 0)} BTC
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {`Lifetime: ${formatBtc(activeNudgeProfile.totalDonatedBtc)} BTC`}
                  </div>
                </div>
              </div>

              {/* 2A. NUDGE MODE: Archetype Selector, 3.5x Growth Buffer Audit & Custom BTC Slider */}
              {activeDiplomaticMode === 'nudge' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                        <span>Nudge Profile &amp; Growth-Protected Suggested Donation</span>
                        <button
                          type="button"
                          onClick={() => setShowNudgeArchetypeHelp((prev) => !prev)}
                          className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 text-xs font-mono ${
                            showNudgeArchetypeHelp
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-slate-700 text-amber-300 hover:text-white'
                          }`}
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Which Archetype Should I Choose?</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNudgeCalculationHelp((prev) => !prev)}
                          className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 text-xs font-mono ${
                            showNudgeCalculationHelp
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-slate-900 border-slate-700 text-cyan-300 hover:text-white'
                          }`}
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                          <span>7D Projection &amp; 3.5x Growth Shield Audit</span>
                        </button>
                      </div>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        {nudgeRecommendation.rationaleSummary}
                      </p>
                    </div>
                  </div>

                  {/* Clickable [?] Popover 1: Why Archetypes Differ & Citizen-Specific Recommendation */}
                  {showNudgeArchetypeHelp && (
                    <div className="p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 space-y-3 text-sm animate-fade-in">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="font-black text-amber-300 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{`Why the 3 Donation Archetypes Differ & Recommendation for ${activeNudgeProfile.username}`}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNudgeArchetypeHelp(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100 leading-relaxed">
                        <strong className="text-amber-300 uppercase font-mono">
                          {`★ Recommended for ${activeNudgeProfile.username}: ${nudgeRecommendation.recommendedArchetypeLabel}`}
                        </strong>
                        <p className="mt-1 text-slate-200">{nudgeRecommendation.recommendedArchetypeReason}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                        {(nudgeRecommendation.archetypeComparison ?? []).map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border space-y-1.5 ${
                              item.isRecommended
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-white font-sans text-sm">{item.title}</span>
                              {item.isRecommended && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <div className="text-base font-black text-amber-300">
                              {formatBtc(item.suggestedBtc)} BTC
                            </div>
                            <div className="text-xs text-cyan-300 break-words">{item.formulaBasis}</div>
                            <p className="text-xs text-slate-300 font-sans leading-relaxed pt-0.5">
                              {item.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clickable [?] Popover 2: Sophisticated 7D Recipe Projection & 3.5x Growth Shield Audit */}
                  {showNudgeCalculationHelp && (
                    <div className="p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 space-y-3.5 text-sm animate-fade-in">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="font-black text-cyan-300 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>7-Day Recipe Production + 3.5x Speculation &amp; Economic Growth Shield Audit</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNudgeCalculationHelp(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div
                        className={`p-3.5 rounded-xl border text-sm leading-relaxed ${
                          nudgeRecommendation.capexAuditVerdict === 'verified-construction-capex' ||
                          nudgeRecommendation.capexAuditVerdict === 'healthy-growth-speculation'
                            ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-100'
                            : nudgeRecommendation.capexAuditVerdict === 'iron-steel-speculation'
                            ? 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                            : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
                        }`}
                      >
                        <div className="font-black text-sm mb-1">
                          {nudgeRecommendation.capexAuditBadge}
                        </div>
                        <p className="text-slate-200">{nudgeRecommendation.capexAuditExplanation}</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-xs text-slate-400 font-sans">7D Company Net Output</div>
                          <div className="font-black text-emerald-300 text-sm mt-0.5">
                            +{formatBtc(nudgeRecommendation.projected7dCompanyNetProfitBtc)} BTC
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Gross: {formatBtc(nudgeRecommendation.projected7dCompanyGrossOutputBtc)} | Inputs: -{formatBtc(nudgeRecommendation.projected7dCompanyRawInputBtc)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-xs text-slate-400 font-sans">7D Trade (75% Tax Base)</div>
                          <div className="font-black text-cyan-300 text-sm mt-0.5">
                            +{formatBtc(nudgeRecommendation.taxable7dNetTradingBtc + nudgeRecommendation.verified7dWagesEarnedBtc)} BTC
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            25% Reinvest Shield: {formatBtc(nudgeRecommendation.tradingReinvestmentAllowanceBtc)} BTC
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-xs text-slate-400 font-sans">Protected Growth Reserve</div>
                          <div className="font-black text-amber-300 text-sm mt-0.5">
                            {formatBtc(nudgeRecommendation.protectedGrowthReserveBtc)} BTC
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            3.5x Median / 1.5x Input + CapEx Buffer
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <div className="text-xs text-slate-400 font-sans">Taxable Excess Hoard</div>
                          <div className="font-black text-purple-300 text-sm mt-0.5">
                            {formatBtc(nudgeRecommendation.excessStockpileAboveBufferBtc)} BTC
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Stock above {formatBtc(nudgeRecommendation.protectedGrowthReserveBtc)} BTC shield
                          </div>
                        </div>
                      </div>

                      {nudgeRecommendation.companyProjectionItems.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs font-bold uppercase text-slate-400">
                            Item-Specific Recipe Production Valuation (Strict Live Market Prices):
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {nudgeRecommendation.companyProjectionItems.map((ci, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs"
                              >
                                <div>
                                  <span className="text-white font-bold">{ci.companyName}</span>{' '}
                                  <span className="text-amber-300">[{ci.recipeSummary}]</span>
                                </div>
                                <div className="text-slate-300">
                                  {ci.weeklyUnits.toFixed(1)} u/wk @ {ci.livePriceBtc.toFixed(3)} BTC ={' '}
                                  <span className="text-emerald-300 font-bold">+{ci.weeklyGrossBtc.toFixed(1)} BTC</span>
                                  {ci.weeklyRawInputsBtc > 0 && (
                                    <span className="text-amber-300"> (−{ci.weeklyRawInputsBtc.toFixed(1)} inputs)</span>
                                  )}{' '}
                                  → <strong className="text-white">+{ci.weeklyNetProfitBtc.toFixed(1)} BTC Net/wk</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3 Nudge Archetype Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {([
                      {
                        id: 'weekly-cashflow' as NudgeArchetype,
                        title: 'Weekly Cashflow Step-Up',
                        sub: 'Higher weekly BTC from 7D output',
                      },
                      {
                        id: 'liquid-hoarder' as NudgeArchetype,
                        title: 'Idle Liquid BTC Hoarder',
                        sub: 'One-time lump sum from idle cash',
                      },
                      {
                        id: 'resource-stockpiler' as NudgeArchetype,
                        title: 'Resource Stockpiler',
                        sub: 'Sell 10%–15% excess above 3.5x shield',
                      },
                    ]).map((opt) => {
                      const isSelected = nudgeRecommendation.archetype === opt.id;
                      const isRecommended = nudgeRecommendation.recommendedArchetype === opt.id;
                      const compItem = (nudgeRecommendation.archetypeComparison ?? []).find((c) => c.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setNudgeArchetypeOverride(opt.id);
                            setCustomNudgeBtc(undefined);
                          }}
                          className={`p-3 rounded-xl border text-left transition relative ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                              : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                          }`}
                        >
                          <div className="text-sm font-bold flex items-center justify-between gap-1">
                            <span className="truncate">{opt.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1">
                            <span className="text-xs text-slate-400">{opt.sub}</span>
                            {compItem && (
                              <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
                                {formatBtc(compItem.suggestedBtc)} BTC
                              </span>
                            )}
                          </div>
                          {isRecommended && (
                            <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
                              {`★ Recommended for ${activeNudgeProfile.username}`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Suggested BTC Slider + Direct Input */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-sm font-bold text-slate-200 flex items-center gap-2 flex-wrap">
                        <span>Suggested Donation Amount (BTC):</span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-mono ${
                            nudgeRecommendation.capexAuditVerdict === 'verified-construction-capex' ||
                            nudgeRecommendation.capexAuditVerdict === 'healthy-growth-speculation'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                              : nudgeRecommendation.capexAuditVerdict === 'iron-steel-speculation'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {nudgeRecommendation.capexAuditBadge}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={effectiveNudgeBtc}
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
                      min={nudgeRecommendation.minSuggestedBtc}
                      max={nudgeRecommendation.maxSuggestedBtc}
                      step={nudgeRecommendation.stepBtc}
                      value={Math.min(
                        nudgeRecommendation.maxSuggestedBtc,
                        Math.max(nudgeRecommendation.minSuggestedBtc, effectiveNudgeBtc)
                      )}
                      onChange={(e) => setCustomNudgeBtc(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="text-xs text-slate-400 font-semibold mr-1">Quick Presets:</span>
                      {(nudgeRecommendation.presetsBtc ?? []).map((preset, pIdx) => {
                        const isActivePreset = Math.abs(effectiveNudgeBtc - preset.amount) < 0.5;
                        return (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setCustomNudgeBtc(preset.amount)}
                            title={preset.description}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                              isActivePreset
                                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                            }`}
                          >
                            {`${preset.label}: ${formatBtc(preset.amount)} BTC`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 2B. COMMENDATION MODE: Custom Merit-Based Patriot & Hero Archetypes */}
              {activeDiplomaticMode === 'commendation' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 space-y-3.5">
                  <div>
                    <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span>Custom Merit-Based Patriot Commendation Archetype</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      Select the commendation honor that best matches {activeNudgeProfile.username}&apos;s service record (Historic Pillars that keep giving, Sovereign Treasury Patriots, Battlefield Heroes, or Dual-Crown Vanguards):
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(nudgeRecommendation.commendationOptions ?? nudgeRecommendation.commendationArchetypeOptions ?? []).map((opt) => {
                      const isSelected = activeCommendationArchetype === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCommendationArchetypeOverride(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition space-y-1.5 ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-white">{opt.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-300">
                            {opt.badge}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {opt.explanation}
                          </p>
                          {opt.isRecommended && (
                            <div className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[11px] font-mono font-bold">
                              {`★ Recommended Merit for ${activeNudgeProfile.username}`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2C. OVER-DONATION WARNING MODE: Burnout & Self-Harm Protection */}
              {activeDiplomaticMode === 'over-donation-warning' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-cyan-500/30 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Over-Donation Burnout &amp; Economic Self-Harm Protection</span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        {`${activeNudgeProfile.username} has donated ${nudgeRecommendation.donatedShareOfWeeklyIncomePct}% of their 7D earning power. Sustainable Patriot Ceiling: ${formatBtc(nudgeRecommendation.sustainableWeeklyCapBtc)} BTC/wk.`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(nudgeRecommendation.overDonationOptions ?? nudgeRecommendation.overDonationArchetypeOptions ?? []).map((opt) => {
                      const isSelected = activeOverDonationArchetype === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOverDonationArchetypeOverride(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition space-y-1.5 ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-white">{opt.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                          </div>
                          <div className="text-xs font-mono font-bold text-cyan-300">
                            {opt.badge}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {opt.explanation}
                          </p>
                          {opt.isRecommended && (
                            <div className="inline-block px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-[11px] font-mono font-bold">
                              {`★ Recommended Advisory for ${activeNudgeProfile.username}`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Generated Bilingual Telegram Templates (Comfortable 14px-16px Typography) */}
              <div className="space-y-3.5">
                {messages.map((msg, idx) => {
                  const charsExcludingName = msg.body.replace(activeNudgeProfile.username, '').length;
                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3 text-sm text-slate-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-amber-300 text-sm flex items-center gap-2">
                            <Tag className="w-4 h-4 text-amber-400" />
                            <span>{msg.title}</span>
                          </span>
                          <div className="text-xs font-mono mt-1 flex items-center gap-2 text-slate-400">
                            <span className={charsExcludingName <= 492 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {`✓ ${charsExcludingName} / 492 chars (excl. name)`}
                            </span>
                            {activeDiplomaticMode === 'nudge' && (
                              <>
                                <span>•</span>
                                <span>
                                  <span>Suggested:</span> <strong className="text-amber-300">{formatBtc(effectiveNudgeBtc)} BTC</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.body, idx)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-slate-300" />
                              <span>Copy Telegram</span>
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
                onClick={() => setActiveNudgeProfile(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Comprehensive Forensic Financial & Multi-Company Audit */}
      {selectedAuditProfile && (
        <ErrorBoundary fallbackTitle="Financial Audit Error" onReset={() => setSelectedAuditProfile(null)}>
          <CitizenAuditModal
            profile={
              bufferedUpdatesMap[selectedAuditProfile.userId] ||
              displayedProfiles.find((p) => p.userId === selectedAuditProfile.userId) ||
              profiles.find((p) => p.userId === selectedAuditProfile.userId) ||
              selectedAuditProfile
            }
            config={config}
            countryName={countryName}
            apiKey={apiKey}
            countryBenchmark={countryBenchmark}
            commodities={commodities}
            onClose={() => setSelectedAuditProfile(null)}
            onUpdateProfile={handleManualModalUpdate}
            onUpdateConfig={onUpdateConfig}
            onOpenNudge={(prof) => setActiveNudgeProfile(prof)}
          />
        </ErrorBoundary>
      )}

      {/* Modal: Citizen Calculation Breakdown & Audit Explainer */}
      {selectedExplainerProfile && (
        <ErrorBoundary fallbackTitle="Calculation Explainer Error" onReset={() => setSelectedExplainerProfile(null)}>
          <CitizenCalculationExplainerModal
            profile={
              bufferedUpdatesMap[selectedExplainerProfile.userId] ||
              displayedProfiles.find((p) => p.userId === selectedExplainerProfile.userId) ||
              profiles.find((p) => p.userId === selectedExplainerProfile.userId) ||
              selectedExplainerProfile
            }
            config={config}
            countryName={countryName}
            countryBenchmark={countryBenchmark}
            onClose={() => setSelectedExplainerProfile(null)}
          />
        </ErrorBoundary>
      )}

      {/* Modal: Estimated Gross Income Itemized Calculation Breakdown */}
      {selectedIncomeBreakdownProfile && (
        <ErrorBoundary fallbackTitle="Gross Income Audit Error" onReset={() => setSelectedIncomeBreakdownProfile(null)}>
          <GrossIncomeBreakdownModal
            profile={
              bufferedUpdatesMap[selectedIncomeBreakdownProfile.userId] ||
              displayedProfiles.find((p) => p.userId === selectedIncomeBreakdownProfile.userId) ||
              profiles.find((p) => p.userId === selectedIncomeBreakdownProfile.userId) ||
              selectedIncomeBreakdownProfile
            }
            countryName={countryName}
            config={config}
            apiKey={apiKey}
            countryBenchmark={countryBenchmark}
            onClose={() => setSelectedIncomeBreakdownProfile(null)}
            onUpdateProfile={handleManualModalUpdate}
          />
        </ErrorBoundary>
      )}

      {/* Floating Bottom-Right Audit Progress & "Apply X Verified Updates" Dock (follows user while scrolling) */}
      <AuditProgressDock
        countryName={countryName}
        state={streamState}
        bufferedCount={bufferedCount}
        onApplyBufferedUpdates={handleApplyBufferedUpdates}
      />
    </div>
  );
};
