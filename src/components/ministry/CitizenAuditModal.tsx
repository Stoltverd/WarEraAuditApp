import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CitizenEconomicProfile,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
  WealthSnapshot,
  CountryEconomicBenchmark,
  CommodityTrend,
} from '../../types/ministry';
import { WareraCompany, WareraTransaction, WareraBotEmployee, EmployeeTraitId, LiveCounterpartyProfile } from '../../types/warera';
import {
  fetchUserCompanies,
  fetchUserTransactions,
  fetchUserLite,
  getCountries,
  resolveLiveCounterpartiesBatch,
  extractItemTimestampMs,
  compareTransactionsNewestFirst,
  isNonMonetaryInventoryNoise,
} from '../../services/apiService';
import { storage, AUDIT_PROFILE_SCHEMA_VERSION } from '../../services/storage';
import {
  buildAuditedCitizenProfile,
  calculatePlayerCashflowSummary,
  evaluateLeechTier,
  evaluateMinisterialAuditVerdict,
  resolveMasterCitizenStanding,
  getPlaystyleQuotaThresholds,
} from '../../services/ministryService';
import {
  PIRATERERS_TRAIT_CATALOG,
  TRAIT_MAP,
  evaluateCitizenSkillBuild,
  evaluateCompanyWorkforce,
  createEmptyEmployeeSlot,
  isManufacturedCommodity,
} from '../../services/workforceService';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateUtils';
import { WareraItemIcon } from '../common/WareraItemIcon';
import { WareraCountryFlag } from '../common/WareraCountryFlag';
import { CompanyPortfolioAnalyzer } from './CompanyPortfolioAnalyzer';
import { useI18n, translateRawStringEs } from '../../i18n/I18nContext';
import {
  X,
  Coins,
  TrendingUp,
  HeartHandshake,
  Scale,
  Swords,
  Sprout,
  HelpCircle,
  Building2,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  RefreshCw,
  Briefcase,
  Package,
  Shield,
  FileText,
  Search,
  Filter,
  Check,
  Copy,
  Clock,
  Layers,
  Archive,
  Users,
  Info,
  Square,
  StopCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';

interface CitizenAuditModalProps {
  profile: CitizenEconomicProfile | null;
  config?: MinistryConfig;
  countryName: string;
  apiKey?: string;
  countryBenchmark?: CountryEconomicBenchmark;
  commodities?: CommodityTrend[];
  onClose: () => void;
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
  onUpdateConfig?: (updated: MinistryConfig) => void;
  onOpenNudge?: (profile: CitizenEconomicProfile) => void;
}

export const CitizenAuditModal: React.FC<CitizenAuditModalProps> = ({
  profile,
  config = DEFAULT_MINISTRY_CONFIG,
  countryName,
  apiKey,
  countryBenchmark,
  commodities = [],
  onClose,
  onUpdateProfile,
  onUpdateConfig,
  onOpenNudge,
}) => {
  const { lang, translateCommodity, tx } = useI18n();
  const [activeTab, setActiveTab] = useState<'cashflow' | 'transactions' | 'companies' | 'defense'>('cashflow');
  const [localProfile, setLocalProfile] = useState<CitizenEconomicProfile | null>(profile);
  const [auditPeriodDays, setAuditPeriodDays] = useState<number>(config.analysisPeriodDays || 7);
  const [activeExplainerCard, setActiveExplainerCard] = useState<
    'grossInflow' | 'netCashflow' | 'disposableCashflow' | 'treasuryContribution' | 'wages' | 'sales' | 'purchases' | 'tradingMargin' | null
  >(null);
  const [showHeaderTagsExplainer, setShowHeaderTagsExplainer] = useState<boolean>(false);
  const autoStreamInitiatedRef = useRef<string | null>(null);

  // Industrial state
  const [liveCompanies, setLiveCompanies] = useState<WareraCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companyCommodityFilter, setCompanyCommodityFilter] = useState<string>('all');
  const [expandedWorkforceCompId, setExpandedWorkforceCompId] = useState<string | null>(null);
  const [companyWorkforceOverrides, setCompanyWorkforceOverrides] = useState<
    Record<string, { breakRoom?: number; hasManager?: boolean; employees?: WareraBotEmployee[] }>
  >({});

  // Forensic Transactions state
  const [personalTransactions, setPersonalTransactions] = useState<WareraTransaction[]>([]);
  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<{ loaded: number; page: number } | null>(null);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'wage' | 'market' | 'trading' | 'donation' | 'other'>('all');
  const [txPage, setTxPage] = useState<number>(1);
  const [txPageSize, setTxPageSize] = useState<100 | 250 | 500>(100);
  const [counterpartyMap, setCounterpartyMap] = useState<Record<string, LiveCounterpartyProfile>>({});
  const [isResolvingCounterparties, setIsResolvingCounterparties] = useState<boolean>(false);
  const [copiedCounterpartyKey, setCopiedCounterpartyKey] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestedCounterpartyIdsRef = useRef<Set<string>>(new Set());
  const liveIdentityRefreshedUserIdRef = useRef<string | null>(null);

  // Snapshots state for honest historical damage verification
  const [snapshots, setSnapshots] = useState<WealthSnapshot[]>([]);

  // Copy ID state
  const [copiedId, setCopiedId] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Lock background window scroll while modal is active, listen for Escape key & cleanup abort controller on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Only abort in-flight receipt streaming when the modal actually unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Sync state when input profile changes & load cached data.
  // If IndexedDB already contains personal receipts for this citizen (e.g., 2,993 receipts for N3V1T5)
  // while the passed-in profile shows 0 receipts or unverified status, immediately rebuild and commit
  // the verified profile from the cached receipts!
  // Keep localProfile synchronized whenever the parent profile updates policy-derived fields
  useEffect(() => {
    if (profile) {
      setLocalProfile((prev) =>
        prev && prev.userId === profile.userId
          ? {
              ...prev,
              ...profile,
              grossIncomeBtc: prev.grossIncomeBtc ?? profile.grossIncomeBtc,
              grossInflowBtc: prev.grossInflowBtc ?? profile.grossInflowBtc,
              netCashflowBtc: prev.netCashflowBtc ?? profile.netCashflowBtc,
              receiptCount: Math.max(prev.receiptCount || 0, profile.receiptCount || 0),
            }
          : profile
      );
    }
  }, [profile]);

  useEffect(() => {
    setLocalProfile(profile);
    if (profile?.userId) {
      let isCancelled = false;
      Promise.all([
        storage.getUserPersonalTransactions(profile.userId),
        profile.countryId ? storage.getTransactionsByCountry(profile.countryId) : Promise.resolve([]),
      ]).then(([cached, countryTxs]) => {
        if (isCancelled) return;
        const mergedMap = new Map<string, WareraTransaction>();
        for (const tx of countryTxs || []) {
          if (!tx?._id || isNonMonetaryInventoryNoise(tx)) continue;
          const donorId = tx.userId || tx.buyerId;
          if (donorId === profile.userId) {
            mergedMap.set(tx._id, {
              ...tx,
              userId: profile.userId,
              buyerId: tx.buyerId || profile.userId,
              sellerCountryId: tx.sellerCountryId || tx.countryId || profile.countryId,
              isPersonalReceipt: true,
            });
          }
        }
        for (const tx of cached || []) {
          if (tx?._id && !isNonMonetaryInventoryNoise(tx)) {
            mergedMap.set(tx._id, tx);
          }
        }
        const sortedCached = Array.from(mergedMap.values()).sort(compareTransactionsNewestFirst);
        const hasPersonalNonDonationReceipts = (cached || []).some(
          (tx) => !isNonMonetaryInventoryNoise(tx) && !String(tx.transactionType || '').toLowerCase().includes('donat')
        );
        if (sortedCached.length > 0 && hasPersonalNonDonationReceipts) {
          setPersonalTransactions(sortedCached);
          const needsAutoHealFromCache =
            profile.auditBaselineStatus !== 'audited' ||
            profile.auditSchemaVersion !== AUDIT_PROFILE_SCHEMA_VERSION ||
            ((profile.receiptCount || 0) === 0 && (profile.grossInflowBtc || 0) === 0) ||
            ((profile.periodDonatedBtc || 0) === 0 && sortedCached.some((t) => String(t.transactionType || '').toLowerCase().includes('donat')));
          if (needsAutoHealFromCache) {
            const healedProfile = buildAuditedCitizenProfile(
              profile,
              sortedCached,
              { ...config, analysisPeriodDays: auditPeriodDays },
              countryBenchmark,
              auditPeriodDays
            );
            setLocalProfile(healedProfile);
            onUpdateProfile?.(healedProfile);
            storage.saveAuditedProfile(healedProfile);
            setSyncStatusMsg(
              `Loaded ${healedProfile.receiptCount || sortedCached.length} verified in-game receipts (${healedProfile.playerCashflow?.wagesCount || 0} wage shifts, ${healedProfile.playerCashflow?.salesCount || 0} market sales across ${auditPeriodDays}D).`
            );
          }
        } else {
          if (sortedCached.length > 0) {
            setPersonalTransactions(sortedCached);
          }
          if (
            apiKey &&
            (profile.auditBaselineStatus !== 'audited' ||
              profile.auditSchemaVersion !== AUDIT_PROFILE_SCHEMA_VERSION ||
              !hasPersonalNonDonationReceipts) &&
            autoStreamInitiatedRef.current !== `${profile.userId}-${auditPeriodDays}`
          ) {
            autoStreamInitiatedRef.current = `${profile.userId}-${auditPeriodDays}`;
            handleSyncLiveReceipts(auditPeriodDays);
          }
        }
      });

      // Live-refresh the audited citizen's own identity (username, avatarUrl, country, level) once per modal open
      if (liveIdentityRefreshedUserIdRef.current !== profile.userId) {
        liveIdentityRefreshedUserIdRef.current = profile.userId;
        Promise.all([
          fetchUserLite(profile.userId, true),
          storage.getCountries().then((list) => (list && list.length > 0 ? list : getCountries().catch(() => []))),
        ]).then(([liveUser, countries]) => {
          if (isCancelled || !liveUser) return;
          const liveCountryId =
            typeof liveUser.country === 'string' && liveUser.country
              ? liveUser.country
              : liveUser.countryId || profile.countryId;
          const matchedCountry = Array.isArray(countries)
            ? countries.find((c) => c._id === liveCountryId)
            : undefined;
          const updatedUsername = liveUser.username || profile.username;
          const updatedAvatar = liveUser.avatarUrl || liveUser.avatar || profile.avatarUrl;
          const updatedCountryName = matchedCountry?.name || profile.countryName;
          const updatedLevel = liveUser.level !== undefined && liveUser.level > 0 ? liveUser.level : profile.level;

          if (
            updatedUsername !== profile.username ||
            updatedAvatar !== profile.avatarUrl ||
            liveCountryId !== profile.countryId ||
            updatedCountryName !== profile.countryName ||
            updatedLevel !== profile.level
          ) {
            setLocalProfile((prev) => {
              if (!prev || prev.userId !== profile.userId) return prev;
              const refreshed: CitizenEconomicProfile = {
                ...prev,
                username: updatedUsername,
                avatarUrl: updatedAvatar,
                countryId: liveCountryId,
                countryName: updatedCountryName,
                level: updatedLevel,
              };
              storage.saveAuditedProfile(refreshed);
              return refreshed;
            });
          }
        });
      }

      // Load damage and wealth snapshots for honest 30-day combat calculations
      storage.getCitizenSnapshots(profile.userId).then((list) => {
        if (!isCancelled) {
          setSnapshots(list || []);
        }
      });

      return () => {
        isCancelled = true;
      };
    }
  }, [profile?.userId]);

  // Load companies live when modal opens so company names and manager identities are always fresh
  useEffect(() => {
    if (localProfile?.userId) {
      setIsLoadingCompanies(true);
      fetchUserCompanies(localProfile.userId, true)
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
  }, [localProfile?.userId]);

  const handleRefreshCompanies = async () => {
    if (!localProfile?.userId || isLoadingCompanies) return;
    setIsLoadingCompanies(true);
    try {
      const res = await fetchUserCompanies(localProfile.userId, true);
      setLiveCompanies(res);
    } catch (err) {
      console.warn('Failed to refresh user companies:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleSwitchTimeframe = (days: number) => {
    if (days === auditPeriodDays) return;
    setAuditPeriodDays(days);
    onUpdateConfig?.({ ...config, analysisPeriodDays: days });
    handleSyncLiveReceipts(days);
  };

  // Clear transient auditDeltaAlert when citizen is inspected
  useEffect(() => {
    if (localProfile?.auditDeltaAlert) {
      const cleared = { ...localProfile, auditDeltaAlert: undefined };
      setLocalProfile(cleared);
      onUpdateProfile?.(cleared);
      storage.saveAuditedProfile(cleared);
    }
  }, [localProfile?.userId]);

  if (!localProfile) return null;

  const currentProfile = localProfile;
  const periodDays = auditPeriodDays;

  // Compute dynamic cashflow from personalTransactions whenever available (or fallback to currentProfile.playerCashflow)
  const dynamicCashflow = useMemo(() => {
    if (
      currentProfile.auditBaselineStatus === 'audited' &&
      currentProfile.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION &&
      currentProfile.playerCashflow &&
      ((currentProfile.receiptCount || 0) > 0 || (personalTransactions?.length || 0) === 0) &&
      auditPeriodDays === (config.analysisPeriodDays || 7)
    ) {
      return currentProfile.playerCashflow;
    }
    if (personalTransactions && personalTransactions.length > 0) {
      const reconstructedUser: any = {
        _id: currentProfile.userId,
        username: currentProfile.username,
        avatarUrl: currentProfile.avatarUrl,
        country: currentProfile.countryId,
        level: currentProfile.level,
        money: currentProfile.liquidBtc,
        skills: {
          companies: { value: currentProfile.activeCompaniesCount || 2 },
        },
        stats: {
          wealth: {
            total: currentProfile.wealthBtc,
            money: currentProfile.liquidBtc || 0,
            companies: currentProfile.companiesWealthBtc || 0,
          },
        },
      };
      const res = calculatePlayerCashflowSummary(
        currentProfile.userId,
        reconstructedUser,
        personalTransactions,
        auditPeriodDays,
        countryBenchmark
      );
      return res.summary;
    }
    return currentProfile.playerCashflow;
  }, [personalTransactions, auditPeriodDays, currentProfile, countryBenchmark, config.analysisPeriodDays]);

  const cashflow = dynamicCashflow;

  const formatBtc = (val?: number) =>
    (val || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  const handleCopyId = () => {
    if (!currentProfile.userId) return;
    navigator.clipboard?.writeText(currentProfile.userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Cashflow & Financial values strictly computed
  const wagesEarned = cashflow?.wagesEarnedBtc ?? cashflow?.salariesEarnedBtc ?? 0;
  const wagesCount = cashflow?.wagesCount ?? 0;
  const wagesPaid = cashflow?.wagesPaidBtc ?? 0;
  const wagesPaidCount = cashflow?.wagesPaidCount ?? 0;
  const salesVolume = cashflow?.salesVolumeBtc ?? 0;
  const salesCount = cashflow?.salesCount ?? 0;
  const purchasesVolume = cashflow?.purchasesVolumeBtc ?? 0;
  const purchasesCount = cashflow?.purchasesCount ?? 0;
  const commoditySales = cashflow?.commoditySalesBtc ?? 0;
  const equipmentSales = cashflow?.equipmentSalesBtc ?? 0;
  const commodityPurchases = cashflow?.commodityPurchasesBtc ?? 0;
  const equipmentPurchases = cashflow?.equipmentPurchasesBtc ?? 0;
  // Real Net Trading Balance = Market Sales minus Market Purchases
  const netTradeMargin = Math.round((salesVolume - purchasesVolume) * 100) / 100;
  // Country Treasury Donations strictly within the active window (excludes Military Unit donations)
  const periodDonated =
    cashflow && typeof cashflow.donationsGivenBtc === 'number'
      ? cashflow.donationsGivenBtc
      : Number(currentProfile.periodDonatedBtc ?? currentProfile.directDonatedBtc ?? 0);
  // Military Unit Donations (count toward cashflow outflows, never toward country leaderboard or standing)
  const muDonated = cashflow?.muDonationsBtc ?? currentProfile.muDonationsBtc ?? 0;
  const muDonationsCount = cashflow?.muDonationsCount ?? 0;
  const tipsReceived = cashflow?.tipsReceivedBtc ?? 0;
  const tipsSent = cashflow?.tipsSentBtc ?? 0;
  const craftingExpenses = (cashflow?.craftingExpensesBtc || 0) + (cashflow?.dismantleExpensesBtc || 0) + (cashflow?.caseOpeningExpensesBtc || 0);
  const applicationFees = cashflow?.applicationFeesBtc || 0;
  // Gross Cash Inflow = labor wages + market sales + tips received (NEVER artificially inflated by donations)
  const calculatedGrossInflow = Math.round((wagesEarned + salesVolume + tipsReceived) * 100) / 100;
  const grossIncome =
    currentProfile.auditBaselineStatus === 'audited' &&
    currentProfile.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION &&
    typeof currentProfile.grossInflowBtc === 'number' &&
    ((currentProfile.receiptCount || 0) > 0 || calculatedGrossInflow === 0) &&
    auditPeriodDays === (config.analysisPeriodDays || 7)
      ? currentProfile.grossInflowBtc
      : calculatedGrossInflow;
  // Net Cashflow = Gross Inflow minus all Outflows (Purchases + Payroll + Crafting/Fees + Tips Sent + Country Donations + MU Donations)
  const netDisposableIncome =
    currentProfile.auditBaselineStatus === 'audited' &&
    currentProfile.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION &&
    typeof currentProfile.netCashflowBtc === 'number' &&
    ((currentProfile.receiptCount || 0) > 0 || calculatedGrossInflow === 0) &&
    auditPeriodDays === (config.analysisPeriodDays || 7)
      ? currentProfile.netCashflowBtc
      : cashflow && typeof cashflow.netCashflowBtc === 'number'
      ? cashflow.netCashflowBtc
      : Math.round(
          (calculatedGrossInflow -
            purchasesVolume -
            wagesPaid -
            craftingExpenses -
            applicationFees -
            tipsSent -
            periodDonated -
            muDonated) *
            100
        ) / 100;

  // Capital Balance Sheet Assets
  const liquidBtc = typeof currentProfile.liquidBtc === 'number' && currentProfile.liquidBtc >= 0
    ? currentProfile.liquidBtc
    : (currentProfile.wealthBtc > 0 ? currentProfile.wealthBtc : 0);
  const totalWealth = currentProfile.wealthBtc;
  const resourceWealth = currentProfile.resourceWealthBtc || 0;
  const companiesWealth = currentProfile.companiesWealthBtc || 0;
  const equipmentsWealth = (currentProfile.equipmentsWealthBtc || 0) + (currentProfile.weaponsWealthBtc || 0);

  // Snapshot recording & honest 30-day damage log evaluation
  const weeklyCombatDamage = currentProfile.totalCombatDamage || 0;
  const lifetimeCombatDamage = currentProfile.lifetimeCombatDamage || weeklyCombatDamage;

  useEffect(() => {
    if (currentProfile?.userId) {
      const today = new Date().toISOString().slice(0, 10);
      const snapshot: WealthSnapshot = {
        id: `${currentProfile.userId}_${today}`,
        userId: currentProfile.userId,
        countryId: currentProfile.countryId,
        wealthBtc: currentProfile.wealthBtc || 0,
        weeklyDamage: weeklyCombatDamage,
        lifetimeDamage: lifetimeCombatDamage,
        timestamp: Date.now(),
        dateStr: today,
      };
      storage.saveWealthSnapshotsBatch([snapshot]).then(() => {
        storage.getCitizenSnapshots(currentProfile.userId).then((list) => {
          if (list && list.length > 0) setSnapshots(list);
        });
      });
    }
  }, [currentProfile?.userId]);

  const has30DaySnapshots = useMemo(() => {
    if (snapshots.length < 2) return false;
    const earliest = snapshots[0].timestamp;
    const latest = snapshots[snapshots.length - 1].timestamp;
    return (latest - earliest) >= 28 * 24 * 60 * 60 * 1000;
  }, [snapshots]);

  const snapshot30DayDamage = useMemo(() => {
    if (!has30DaySnapshots || snapshots.length < 2) return null;
    const earliest = snapshots[0];
    const latest = snapshots[snapshots.length - 1];
    if (typeof latest.lifetimeDamage === 'number' && typeof earliest.lifetimeDamage === 'number' && latest.lifetimeDamage >= earliest.lifetimeDamage) {
      return latest.lifetimeDamage - earliest.lifetimeDamage;
    }
    return snapshots.reduce((sum, s) => sum + (s.weeklyDamage || 0), 0);
  }, [snapshots, has30DaySnapshots]);

  // Defense metrics & Live Policy Evaluation (100% reactive to Policies & Quotas and active window)
  const isCombatPolicyActive = Boolean(config.includeDamageInLeechCalculation);
  const combatDamage = currentProfile.totalCombatDamage || 0;
  const activeCombatDamage =
    auditPeriodDays === 30 && has30DaySnapshots && snapshot30DayDamage !== null
      ? snapshot30DayDamage
      : combatDamage;
  const militaryCreditRate = config.damageConversionRateBtcPer1k ?? 0.08;
  const militaryCredit =
    isCombatPolicyActive && activeCombatDamage > 0
      ? Math.round(((activeCombatDamage / 1000) * militaryCreditRate) * 100) / 100
      : 0;
  const totalSovereignContribution = Math.round((periodDonated + militaryCredit) * 100) / 100;

  const { moderatePct: targetQuotaPct, patriotPct: targetPatriotPct } = getPlaystyleQuotaThresholds(
    currentProfile.playstyle,
    config
  );

  const liveTierEval = evaluateLeechTier(
    currentProfile.wealthBtc,
    periodDonated,
    { ...config, analysisPeriodDays: auditPeriodDays },
    grossIncome,
    currentProfile.playstyle,
    currentProfile.totalDonatedBtc,
    resourceWealth,
    activeCombatDamage,
    currentProfile.isHistoricalTopDonor || false,
    currentProfile.historicalRank,
    currentProfile.isNationalHeavyHitter || false,
    currentProfile.heavyHitterRank,
    countryBenchmark,
    liquidBtc,
    {
      companiesCount: liveCompanies.length > 0 ? liveCompanies.length : currentProfile.companiesCount,
      companiesWealthBtc: companiesWealth,
      pastWealthBtc: currentProfile.pastWealthBtc,
      lifetimeCombatDamage,
      donationCount: currentProfile.donationCount,
      daysSinceLastDonation: currentProfile.daysSinceLastDonation,
      daysInBuild: currentProfile.daysInBuild,
    }
  );

  const liveVerdictEval = evaluateMinisterialAuditVerdict(
    currentProfile,
    periodDonated,
    liveTierEval,
    { ...config, analysisPeriodDays: auditPeriodDays },
    countryBenchmark
  );

  // Standing & Solvency (always derived dynamically via resolveMasterCitizenStanding for 100% parity with Overview)
  const standing = resolveMasterCitizenStanding(
    liveTierEval.tier,
    liveVerdictEval.ministerialVerdict,
    currentProfile.isHistoricalTopDonor,
    currentProfile.isNationalHeavyHitter
  );

  // On-demand fetch of citizen's live personal transaction ledger (Wages, Item Market, etc.)
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSyncingLedger(false);
    setSyncStatusMsg('Streaming halted by user. Retaining verified receipts loaded so far.');
  };

  const handleSyncLiveReceipts = async (targetWindowDays?: number) => {
    if (!apiKey || !apiKey.trim()) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const windowDays = targetWindowDays || auditPeriodDays;
    setIsSyncingLedger(true);
    setStreamProgress({ loaded: 0, page: 0 });
    setSyncStatusMsg(`Connecting to War Era transaction stream (${windowDays}D window)...`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Always read existing cached receipts and verified country donations from IndexedDB first
      const [cachedFromDb, countryTxs] = await Promise.all([
        storage.getUserPersonalTransactions(currentProfile.userId),
        currentProfile.countryId ? storage.getTransactionsByCountry(currentProfile.countryId) : Promise.resolve([]),
      ]);
      const personalTxs = await fetchUserTransactions(
        currentProfile.userId,
        apiKey,
        (loadedCount, pageNum) => {
          setStreamProgress({ loaded: loadedCount, page: pageNum });
          setSyncStatusMsg(`Streaming page ${pageNum} (${loadedCount} receipts verified)...`);
        },
        controller.signal,
        windowDays
      );

      const mergedMap = new Map<string, WareraTransaction>();
      for (const tx of countryTxs || []) {
        if (!tx?._id || isNonMonetaryInventoryNoise(tx)) continue;
        const donorId = tx.userId || tx.buyerId;
        if (donorId === currentProfile.userId) {
          mergedMap.set(tx._id, {
            ...tx,
            userId: currentProfile.userId,
            buyerId: tx.buyerId || currentProfile.userId,
            sellerCountryId: tx.sellerCountryId || tx.countryId || currentProfile.countryId,
            isPersonalReceipt: true,
          });
        }
      }
      for (const tx of cachedFromDb || []) if (tx?._id && !isNonMonetaryInventoryNoise(tx)) mergedMap.set(tx._id, tx);
      for (const tx of personalTransactions) if (tx?._id && !isNonMonetaryInventoryNoise(tx)) mergedMap.set(tx._id, tx);
      for (const tx of personalTxs) if (tx?._id && !isNonMonetaryInventoryNoise(tx)) mergedMap.set(tx._id, tx);
      const mergedTxs = Array.from(mergedMap.values()).sort(compareTransactionsNewestFirst);

      setPersonalTransactions(mergedTxs);

      if (mergedTxs.length === 0) {
        const updatedProfile = buildAuditedCitizenProfile(
          currentProfile,
          [],
          { ...config, analysisPeriodDays: windowDays },
          countryBenchmark,
          windowDays
        );
        setLocalProfile(updatedProfile);
        onUpdateProfile?.(updatedProfile);
        storage.saveAuditedProfile(updatedProfile);
        setSyncStatusMsg(`Queried personal stream: 0 receipts found for this ${windowDays}D period.`);
      } else {
        await storage.saveUserPersonalTransactions(currentProfile.userId, mergedTxs);

        // Use the single canonical buildAuditedCitizenProfile so manual streaming produces
        // 100% identical LeechTier, MinisterialVerdict, and EconomicStanding as the Radar!
        const updatedProfile = buildAuditedCitizenProfile(
          currentProfile,
          mergedTxs,
          { ...config, analysisPeriodDays: windowDays },
          countryBenchmark,
          windowDays
        );

        setLocalProfile(updatedProfile);
        onUpdateProfile?.(updatedProfile);
        storage.saveAuditedProfile(updatedProfile);
        setSyncStatusMsg(
          `Successfully verified ${updatedProfile.receiptCount || mergedTxs.length} receipts (${updatedProfile.playerCashflow?.wagesCount || 0} wage shifts, ${updatedProfile.playerCashflow?.salesCount || 0} market sales across ${windowDays}D)!`
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setSyncStatusMsg('Stream paused by user.');
      } else {
        setSyncStatusMsg(`Sync notice: ${err?.message || 'Stream interrupted'}`);
      }
    } finally {
      setIsSyncingLedger(false);
      abortControllerRef.current = null;
    }
  };

  // Defensive string extractors to prevent any type mismatches or unhandled exceptions in ledger
  const safelyExtractItemString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (typeof val.name === 'string') return val.name;
      if (typeof val.code === 'string') return val.code;
      if (typeof val.type === 'string') return val.type;
      if (typeof val.title === 'string') return val.title;
      if (val.name && typeof val.name === 'object') {
        return String(val.name.en || val.name.name || Object.values(val.name)[0] || 'Item');
      }
      return val.id || val._id ? String(val.id || val._id) : 'Item';
    }
    return String(val);
  };

  const safelyExtractIdString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return String(val._id || val.id || val.userId || '');
    return String(val);
  };

  // Transactions strictly within the active audit timeframe (7D or 30D)
  const activeCutoffTime = useMemo(() => {
    return Date.now() - (auditPeriodDays * 24 * 60 * 60 * 1000);
  }, [auditPeriodDays]);

  const timeframeTransactions = useMemo(() => {
    return personalTransactions
      .filter((tx) => {
        if (!tx || isNonMonetaryInventoryNoise(tx)) return false;
        const t = extractItemTimestampMs(tx);
        if (isNaN(t)) {
          // Undated transactions only qualify for broad 30D window, never 7D
          return auditPeriodDays >= 30;
        }
        return t >= activeCutoffTime;
      })
      .sort(compareTransactionsNewestFirst);
  }, [personalTransactions, activeCutoffTime, auditPeriodDays]);

  // Tab live transaction counts across all categories for the active timeframe
  const tabCounts = useMemo(() => {
    let all = 0;
    let wage = 0;
    let trading = 0;
    let market = 0;
    let donation = 0;
    let other = 0;

    for (const tx of timeframeTransactions) {
      if (!tx || isNonMonetaryInventoryNoise(tx)) continue;
      const t = (tx.transactionType || '').toLowerCase();

      all++;
      if (t.includes('wage') || t.includes('work') || t.includes('salary')) {
        wage++;
      } else if (t.includes('itemmarket') || t.includes('item_market')) {
        market++;
      } else if (t.includes('trading') || t === 'trade' || (t.includes('market') && !t.includes('item'))) {
        trading++;
      } else if (t.includes('donat')) {
        donation++;
      } else if (t.includes('tip') || t.includes('article') || t.includes('fee') || t.includes('application') || t.includes('statetransfer')) {
        other++;
      }
    }
    return { all, wage, trading, market, donation, other };
  }, [timeframeTransactions]);

  // Filtered transactions for the Forensic Ledger Tab within active timeframe
  const filteredTransactions = useMemo(() => {
    return timeframeTransactions.filter((tx) => {
      if (!tx || isNonMonetaryInventoryNoise(tx)) return false;
      const txType = (tx.transactionType || '').toLowerCase();
      if (txTypeFilter === 'wage' && !txType.includes('wage') && !txType.includes('work') && !txType.includes('salary')) {
        return false;
      }
      if (txTypeFilter === 'market' && !txType.includes('itemmarket') && !txType.includes('item_market')) {
        return false;
      }
      if (txTypeFilter === 'trading' && !txType.includes('trading') && !txType.includes('market') && txType !== 'trade') {
        return false;
      }
      if (txTypeFilter === 'donation' && !txType.includes('donat')) {
        return false;
      }
      if (txTypeFilter === 'other') {
        const isTipOrFee =
          txType.includes('tip') ||
          txType.includes('article') ||
          txType.includes('fee') ||
          txType.includes('application') ||
          txType.includes('statetransfer');
        if (!isTipOrFee) return false;
      }

      if (txSearch.trim()) {
        const q = txSearch.toLowerCase().trim();
        const rawItemStr = safelyExtractItemString(tx.itemCode || tx.item || tx.resourceType);
        const itemStr = rawItemStr.toLowerCase();
        const translatedItemStr = rawItemStr ? translateCommodity(rawItemStr).toLowerCase() : '';
        const compStr = safelyExtractIdString(tx.companyId);
        const sellerStr = safelyExtractIdString(tx.sellerId);
        const buyerStr = safelyExtractIdString(tx.buyerId);
        const recipientStr = safelyExtractIdString(tx.recipientId);
        const senderStr = safelyExtractIdString(tx.senderId);
        const countryTargetStr = safelyExtractIdString(tx.sellerCountryId || tx.buyerCountryId || tx.countryId);

        const sellerProf = sellerStr ? counterpartyMap[sellerStr] : undefined;
        const buyerProf = buyerStr ? counterpartyMap[buyerStr] : undefined;
        const recipientProf = recipientStr ? counterpartyMap[recipientStr] : undefined;
        const senderProf = senderStr ? counterpartyMap[senderStr] : undefined;
        const compProf = compStr ? counterpartyMap[compStr] : undefined;
        const countryProf = countryTargetStr ? counterpartyMap[countryTargetStr] : undefined;

        const resolvedNamesBlob = [
          sellerProf?.username,
          sellerProf?.companyName,
          sellerProf?.countryName,
          buyerProf?.username,
          buyerProf?.companyName,
          buyerProf?.countryName,
          recipientProf?.username,
          recipientProf?.companyName,
          senderProf?.username,
          compProf?.username,
          compProf?.companyName,
          compProf?.countryName,
          countryProf?.countryName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          itemStr.includes(q) ||
          translatedItemStr.includes(q) ||
          compStr.toLowerCase().includes(q) ||
          sellerStr.toLowerCase().includes(q) ||
          buyerStr.toLowerCase().includes(q) ||
          recipientStr.toLowerCase().includes(q) ||
          txType.includes(q) ||
          resolvedNamesBlob.includes(q)
        );
      }
      return true;
    }).sort(compareTransactionsNewestFirst);
  }, [timeframeTransactions, txTypeFilter, txSearch, counterpartyMap, translateCommodity]);

  // Reset pagination to page 1 when filters or search change
  useEffect(() => {
    setTxPage(1);
  }, [txTypeFilter, txSearch, auditPeriodDays, currentProfile.userId, txPageSize]);

  // Reset requested counterparty ID tracker when switching audited citizen
  useEffect(() => {
    requestedCounterpartyIdsRef.current.clear();
  }, [currentProfile.userId]);

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txPageSize));
  const safeTxPage = Math.min(txPage, totalTxPages);
  const paginatedTransactions = useMemo(() => {
    const startIdx = (safeTxPage - 1) * txPageSize;
    return filteredTransactions.slice(startIdx, startIdx + txPageSize);
  }, [filteredTransactions, safeTxPage, txPageSize]);

  // Deterministic string signature of the visible page's counterparty & company IDs (prevents object-reference render loops)
  const visibleCounterpartySignature = useMemo(() => {
    const ids = new Set<string>();
    for (const tx of paginatedTransactions) {
      if (!tx) continue;
      const sId = safelyExtractIdString(tx.sellerId);
      const bId = safelyExtractIdString(tx.buyerId);
      const rId = safelyExtractIdString(tx.recipientId);
      const sndId = safelyExtractIdString(tx.senderId);
      const cId = safelyExtractIdString(tx.companyId);
      const scId = safelyExtractIdString(tx.sellerCountryId || tx.countryId);
      const bcId = safelyExtractIdString(tx.buyerCountryId);
      if (sId && sId !== currentProfile.userId) ids.add(`a:${sId}`);
      if (bId && bId !== currentProfile.userId) ids.add(`a:${bId}`);
      if (rId && rId !== currentProfile.userId) ids.add(`a:${rId}`);
      if (sndId && sndId !== currentProfile.userId) ids.add(`a:${sndId}`);
      if (scId) ids.add(`a:${scId}`);
      if (bcId) ids.add(`a:${bcId}`);
      if (cId) ids.add(`c:${cId}`);
    }
    return Array.from(ids).sort().join('|');
  }, [paginatedTransactions, currentProfile.userId]);

  // Reference-stable state merger: returns exact `prev` reference if all incoming profiles are already identical in state
  const mergeCounterpartyBatchStable = (
    prev: Record<string, LiveCounterpartyProfile>,
    incoming: Record<string, LiveCounterpartyProfile>
  ): Record<string, LiveCounterpartyProfile> => {
    const entries = Object.entries(incoming);
    if (entries.length === 0) return prev;
    let hasChanges = false;
    for (const [id, prof] of entries) {
      const existing = prev[id];
      if (
        !existing ||
        existing.username !== prof.username ||
        existing.avatarUrl !== prof.avatarUrl ||
        existing.companyName !== prof.companyName ||
        existing.countryName !== prof.countryName ||
        existing.countryCode !== prof.countryCode
      ) {
        hasChanges = true;
        break;
      }
    }
    if (!hasChanges) return prev;
    return { ...prev, ...incoming };
  };

  // Viewport-first live counterparty & company owner resolution + background hydration for full-ledger search
  useEffect(() => {
    if (timeframeTransactions.length === 0) return;
    const controller = new AbortController();

    const extractUnrequestedIdsFromTxList = (list: WareraTransaction[]) => {
      const actorIds = new Set<string>();
      const companyIds = new Set<string>();
      for (const tx of list) {
        if (!tx) continue;
        const sId = safelyExtractIdString(tx.sellerId);
        const bId = safelyExtractIdString(tx.buyerId);
        const rId = safelyExtractIdString(tx.recipientId);
        const sndId = safelyExtractIdString(tx.senderId);
        const cId = safelyExtractIdString(tx.companyId);
        const scId = safelyExtractIdString(tx.sellerCountryId || tx.countryId);
        const bcId = safelyExtractIdString(tx.buyerCountryId);

        if (sId && sId !== currentProfile.userId && !requestedCounterpartyIdsRef.current.has(`a:${sId}`)) actorIds.add(sId);
        if (bId && bId !== currentProfile.userId && !requestedCounterpartyIdsRef.current.has(`a:${bId}`)) actorIds.add(bId);
        if (rId && rId !== currentProfile.userId && !requestedCounterpartyIdsRef.current.has(`a:${rId}`)) actorIds.add(rId);
        if (sndId && sndId !== currentProfile.userId && !requestedCounterpartyIdsRef.current.has(`a:${sndId}`)) actorIds.add(sndId);
        if (scId && !requestedCounterpartyIdsRef.current.has(`a:${scId}`)) actorIds.add(scId);
        if (bcId && !requestedCounterpartyIdsRef.current.has(`a:${bcId}`)) actorIds.add(bcId);
        if (cId && !requestedCounterpartyIdsRef.current.has(`c:${cId}`)) companyIds.add(cId);
      }
      return {
        actorIds: Array.from(actorIds),
        companyIds: Array.from(companyIds),
      };
    };

    const runResolution = async () => {
      // 1. Immediately resolve the currently visible page's unique counterparties & companies
      const visible = extractUnrequestedIdsFromTxList(paginatedTransactions);
      if (visible.actorIds.length > 0 || visible.companyIds.length > 0) {
        visible.actorIds.forEach((id) => requestedCounterpartyIdsRef.current.add(`a:${id}`));
        visible.companyIds.forEach((id) => requestedCounterpartyIdsRef.current.add(`c:${id}`));
        setIsResolvingCounterparties(true);
        try {
          const resolvedVisible = await resolveLiveCounterpartiesBatch(
            visible.actorIds,
            visible.companyIds,
            controller.signal
          );
          if (!controller.signal.aborted && Object.keys(resolvedVisible).length > 0) {
            setCounterpartyMap((prev) => mergeCounterpartyBatchStable(prev, resolvedVisible));
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsResolvingCounterparties(false);
          }
        }
      }

      if (controller.signal.aborted || activeTab !== 'transactions') return;

      // 2. Background-hydrate remaining counterparties in chunks so full-ledger name search works seamlessly
      const remaining = extractUnrequestedIdsFromTxList(timeframeTransactions);
      if (remaining.actorIds.length === 0 && remaining.companyIds.length === 0) return;

      const bgChunkSize = 24;
      const maxLen = Math.max(remaining.actorIds.length, remaining.companyIds.length);
      for (let i = 0; i < maxLen; i += bgChunkSize) {
        if (controller.signal.aborted) break;
        const aChunk = remaining.actorIds.slice(i, i + bgChunkSize);
        const cChunk = remaining.companyIds.slice(i, i + bgChunkSize);
        aChunk.forEach((id) => requestedCounterpartyIdsRef.current.add(`a:${id}`));
        cChunk.forEach((id) => requestedCounterpartyIdsRef.current.add(`c:${id}`));
        const resolvedBg = await resolveLiveCounterpartiesBatch(aChunk, cChunk, controller.signal);
        if (!controller.signal.aborted && Object.keys(resolvedBg).length > 0) {
          setCounterpartyMap((prev) => mergeCounterpartyBatchStable(prev, resolvedBg));
        }
      }
    };

    runResolution();

    return () => {
      controller.abort();
    };
  }, [visibleCounterpartySignature, timeframeTransactions, currentProfile.userId, activeTab]);

  const handleCopyCounterpartyId = (idToCopy: string, uniqueRowKey: string) => {
    if (!idToCopy) return;
    navigator.clipboard?.writeText(idToCopy);
    setCopiedCounterpartyKey(uniqueRowKey);
    setTimeout(() => {
      setCopiedCounterpartyKey((prev) => (prev === uniqueRowKey ? null : prev));
    }, 1800);
  };

  // Authentic Live-API-Only Multi-Company Aggregation for Industrial Tab (Zero Fake Fallback Companies)
  const companiesToRender = useMemo(() => {
    type AuthenticCompany = WareraCompany & {
      isOperatingActive: boolean;
    };
    const activeSlots = currentProfile.activeCompaniesCount ?? 2;

    const list: AuthenticCompany[] = liveCompanies.map((c, idx) => {
      const isOperatingActive = (c.workerCount && c.workerCount > 0) || idx < activeSlots;
      return {
        ...c,
        isOperatingActive,
      };
    });

    if (companyCommodityFilter !== 'all') {
      return list.filter((c) => (c.itemCode || '').toLowerCase() === companyCommodityFilter.toLowerCase());
    }
    return list;
  }, [liveCompanies, currentProfile.activeCompaniesCount, companyCommodityFilter]);

  const allCommodityTypes = useMemo(() => {
    const codes = new Set<string>();
    if (Array.isArray(liveCompanies)) {
      liveCompanies.forEach((c) => {
        const code = c?.itemCode;
        if (code) codes.add(code.toLowerCase());
      });
    }
    return Array.from(codes);
  }, [liveCompanies]);

  const maxStorageAcrossCompanies = useMemo(() => {
    if (companiesToRender.length === 0) return 0;
    return companiesToRender.reduce((acc, c) => Math.max(acc, c.activeUpgradeLevels?.storage || 1), 1);
  }, [companiesToRender]);

  const maxAutoAcrossCompanies = useMemo(() => {
    if (companiesToRender.length === 0) return 0;
    return companiesToRender.reduce((acc, c) => Math.max(acc, c.activeUpgradeLevels?.automatedEngine || 1), 1);
  }, [companiesToRender]);

  // Retrieve verified v0.27 Skill Breakdown (never fabricate 25% placeholder splits)
  const hasVerifiedSkillBreakdown = Boolean(currentProfile.skillBreakdown);
  const activeSkillBreakdown = useMemo(() => {
    if (currentProfile.skillBreakdown) return currentProfile.skillBreakdown;
    const comps = currentProfile.activeCompaniesCount ?? 2;
    return {
      companies: comps,
      leadership: 0,
      management: 0,
      energy: 0,
      production: 0,
      lootChance: 0,
      legacyEntrepreneurship: 0,
      attack: 0,
      criticalChance: 0,
      criticalDamages: 0,
      armor: 0,
      precision: 0,
      dodge: 0,
      health: 0,
      stamina: 0,
    };
  }, [currentProfile]);

  const activeBuildEvaluation = useMemo(() => {
    if (currentProfile.buildEvaluation) return currentProfile.buildEvaluation;
    return evaluateCitizenSkillBuild(
      currentProfile.level || 20,
      currentProfile.playstyle,
      activeSkillBreakdown,
      currentProfile.activeCompaniesCount ?? 2
    );
  }, [currentProfile, activeSkillBreakdown]);

  const getCompanyEffectiveRoster = (comp: WareraCompany) => {
    const saved = companyWorkforceOverrides[comp._id] || storage.getCompanyWorkforceOverride(comp._id);
    const hasOverride = Boolean(saved);
    const liveBreakRoom = comp.activeUpgradeLevels?.breakRoom ?? 1;
    const defaultBreakRoom = saved?.breakRoom ?? (saved as any)?.breakRoomLevel ?? liveBreakRoom;
    const hasManager = saved?.hasManager ?? comp.hasManager ?? false;
    const hasLiveEmployees = Array.isArray(comp.employees) && comp.employees.length > 0;
    const hasVerifiedWorkerCount = typeof comp.workerCount === 'number' || hasLiveEmployees || hasOverride;

    // STRICT DATA HONESTY: Never fabricate default employees unless the user explicitly created a Manual Inspector Override
    const baseEmployees: WareraBotEmployee[] = Array.isArray(saved?.employees)
      ? saved.employees
      : hasLiveEmployees
      ? comp.employees!
      : [];

    return {
      breakRoom: defaultBreakRoom,
      hasManager,
      employees: baseEmployees.slice(0, Math.max(1, defaultBreakRoom)),
      hasOverride,
      hasLiveEmployees,
      hasVerifiedWorkerCount,
      reportedWorkerCount: hasVerifiedWorkerCount
        ? Number(comp.workerCount ?? (hasLiveEmployees ? comp.employees!.length : baseEmployees.length))
        : null,
    };
  };

  const handleUpdateCompanyOverride = (
    comp: WareraCompany,
    patch: { breakRoom?: number; hasManager?: boolean; employees?: WareraBotEmployee[] }
  ) => {
    const current = getCompanyEffectiveRoster(comp);
    const nextBreakRoom = patch.breakRoom ?? current.breakRoom;
    const nextHasManager = patch.hasManager ?? current.hasManager;
    let nextEmployees = Array.isArray(patch.employees) ? [...patch.employees] : [...current.employees];
    if (nextEmployees.length > nextBreakRoom) {
      nextEmployees = nextEmployees.slice(0, nextBreakRoom);
    }

    const updated = {
      breakRoom: nextBreakRoom,
      breakRoomLevel: nextBreakRoom,
      hasManager: nextHasManager,
      employees: nextEmployees,
    };
    setCompanyWorkforceOverrides((prev) => ({
      ...prev,
      [comp._id]: updated,
    }));
    storage.saveCompanyWorkforceOverride(comp._id, updated);
  };

  const handleResetCompanyOverride = (compId: string) => {
    storage.clearCompanyWorkforceOverride(compId);
    setCompanyWorkforceOverrides((prev) => {
      const next = { ...prev };
      delete next[compId];
      return next;
    });
  };

  const handleAddManualBotSlot = (comp: WareraCompany) => {
    const current = getCompanyEffectiveRoster(comp);
    const nextSlotIdx = current.employees.length;
    const targetBreakRoom = Math.max(current.breakRoom, Math.min(3, nextSlotIdx + 1));
    if (nextSlotIdx >= 3) return;
    const newSlot = createEmptyEmployeeSlot(
      comp._id,
      nextSlotIdx,
      comp.itemCode || 'steel',
      currentProfile.countryName || countryName
    );
    handleUpdateCompanyOverride(comp, {
      breakRoom: targetBreakRoom,
      employees: [...current.employees, newSlot],
    });
    setExpandedWorkforceCompId(comp._id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-[1480px] w-full p-5 sm:p-6 shadow-2xl relative max-h-[95vh] flex flex-col overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 overflow-hidden shrink-0 flex items-center justify-center font-black text-amber-300 text-lg shadow-lg">
              {currentProfile.avatarUrl ? (
                <img
                  src={currentProfile.avatarUrl}
                  alt={currentProfile.username || 'Citizen'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentProfile.username || currentProfile.userId || 'CZ').slice(0, 2).toUpperCase()
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {currentProfile.username || `Citizen #${(currentProfile.userId || '').slice(-6)}`}
                </h3>
                {/* Unified Master Standing Badge (only shown once audited or historical pillar or special context) */}
                {currentProfile.auditBaselineStatus !== 'audited' &&
                timeframeTransactions.length === 0 &&
                standing !== 'historical-pillar' &&
                !liveTierEval.specialContextTag ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/15 text-amber-300 border-amber-500/40">
                    {tx('⏳ Pending Receipt Verification', '⏳ Verificación de Recibos Pendiente')}
                  </span>
                ) : (
                  <>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      standing === 'evader-leech'
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : standing === 'low-contributor'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : standing === 'subsistence-worker'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : standing === 'illiquid-fighter'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : standing === 'combat-veteran'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : standing === 'sovereign-patriot'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : standing === 'historical-pillar'
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {standing === 'evader-leech' && tx('🚨 Evader / Leech', '🚨 Evasor / Leech')}
                      {standing === 'low-contributor' && tx('⚠️ Low Donor', '⚠️ Bajo Donante')}
                      {standing === 'subsistence-worker' && tx('🛡️ Subsistence Worker', '🛡️ Trabajador de Subsistencia')}
                      {standing === 'illiquid-fighter' && tx('🔒 Illiquid Combatant', '🔒 Combatiente Ilíquido')}
                      {standing === 'combat-veteran' && tx('⚔️ Frontline Hero', '⚔️ Héroe del Frente')}
                      {standing === 'sovereign-patriot' && tx('🌟 Sovereign Patriot', '🌟 Patriota Soberano')}
                      {standing === 'historical-pillar' && tx('🏛️ Historical Pillar', '🏛️ Pilar Histórico')}
                      {standing === 'standard-contributor' && tx('🔵 Standard Contributor', '🔵 Contribuyente Estándar')}
                    </span>
                    {standing === 'historical-pillar' && liveTierEval.isDormantPillar && (
                      <span
                        onClick={() => setShowHeaderTagsExplainer((prev) => !prev)}
                        className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-400/50 cursor-pointer hover:bg-amber-500/30 transition"
                        title={`Dormant Historical Pillar: Retains Pillar standing from ${formatBtc(currentProfile.totalDonatedBtc)} BTC lifetime donations, but contributed ${formatBtc(periodDonated)} BTC in the active ${auditPeriodDays}D window. Dual Nudge options (Patriot Commendation + Secondary Treasury Nudge) are recommended.`}
                      >
                        {`⚠️ ${liveTierEval.dormantWarningBadge || tx('Dormant Period', 'Período Inactivo')}`}
                      </span>
                    )}
                    {liveTierEval.specialContextBadge && (
                      <span
                        onClick={() => setShowHeaderTagsExplainer((prev) => !prev)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border cursor-pointer transition ${
                          liveTierEval.specialContextTag === 'industrial-war-sacrifice'
                            ? 'bg-rose-500/20 text-rose-200 border-rose-400/50 hover:bg-rose-500/30'
                            : liveTierEval.specialContextTag === 'war-vet-in-eco'
                            ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50 hover:bg-indigo-500/30'
                            : 'bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30'
                        }`}
                        title={
                          lang === 'es' && liveTierEval.specialContextReason
                            ? translateRawStringEs(liveTierEval.specialContextReason)
                            : liveTierEval.specialContextReason
                        }
                      >
                        {lang === 'es'
                          ? translateRawStringEs(liveTierEval.specialContextBadge)
                          : liveTierEval.specialContextBadge}
                      </span>
                    )}
                  </>
                )}

                {/* Clickable ? Button Explaining All Audit Header Tags */}
                <button
                  type="button"
                  onClick={() => setShowHeaderTagsExplainer((prev) => !prev)}
                  className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border inline-flex items-center gap-1 transition ${
                    showHeaderTagsExplainer
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm'
                      : 'bg-slate-800/90 text-cyan-300 border-slate-700 hover:bg-cyan-500/20 hover:border-cyan-400/60'
                  }`}
                  title={tx(
                    'Click to explain all status tags, Dormant Pillar rules, and veteran protections for this citizen',
                    'Haz clic para explicar todas las etiquetas de estatus, reglas de Pilar Inactivo y protecciones de veterano'
                  )}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{tx('Explain Tags', 'Explicar Etiquetas')}</span>
                </button>

                <span className="text-xs font-mono text-slate-400">
                  {`Level ${currentProfile.level} · ${countryName}`}
                </span>
              </div>

              {/* Citizen ID & Respec Tenure Subtitle */}
              <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-0.5 font-mono flex-wrap">
                <span className="flex items-center gap-1">
                  <span>{`Citizen ID: ${currentProfile.userId}`}</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-0.5 hover:text-white transition rounded hover:bg-slate-800"
                    title="Copy Citizen ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </span>
                <span>·</span>
                <span className="text-cyan-400">
                  {`${
                    currentProfile.playstyle === 'pure-eco'
                      ? tx('🌾 Eco Build', '🌾 Build Eco')
                      : currentProfile.playstyle === 'pure-war'
                      ? tx('⚔️ War Build', '⚔️ Build Guerra')
                      : tx('⚖️ Hybrid Build', '⚖️ Build Híbrida')
                  } · ${
                    typeof currentProfile.daysInBuild === 'number'
                      ? tx(
                          `Active for ${currentProfile.daysInBuild}d${currentProfile.daysInBuild >= 7 ? ' (Cooldown cleared)' : ''}`,
                          `Activa por ${currentProfile.daysInBuild}d${currentProfile.daysInBuild >= 7 ? ' (Enfriamiento finalizado)' : ''}`
                        )
                      : currentProfile.buildDurationSource === 'weekly-combat-bound'
                      ? tx('≤ 7d (Recent Switch)', '≤ 7d (Cambio Reciente)')
                      : tx('Reset date unverified', 'Reinicio no verificado')
                  }`}
                </span>
                <span>·</span>
                <span>
                  <span>Strategic Tag:</span>{' '}
                  <strong className="text-slate-200">{currentProfile.manualTag !== 'none' ? currentProfile.manualTag.toUpperCase() : 'Unassigned'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Timeframe Window Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
              <span className="text-[10px] text-slate-500 uppercase px-2 font-bold font-sans">Window:</span>
              <button
                type="button"
                disabled={isSyncingLedger}
                onClick={() => handleSwitchTimeframe(7)}
                className={`px-2.5 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1.5 disabled:cursor-not-allowed ${
                  auditPeriodDays === 7
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white disabled:opacity-50'
                }`}
              >
                {auditPeriodDays === 7 && isSyncingLedger && (
                  <RefreshCw className="w-3 h-3 animate-spin text-white" />
                )}
                <span>7 Days</span>
              </button>
              <button
                type="button"
                disabled={isSyncingLedger}
                onClick={() => handleSwitchTimeframe(30)}
                className={`px-2.5 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1.5 disabled:cursor-not-allowed ${
                  auditPeriodDays === 30
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white disabled:opacity-50'
                }`}
              >
                {auditPeriodDays === 30 && isSyncingLedger && (
                  <RefreshCw className="w-3 h-3 animate-spin text-white" />
                )}
                <span>30 Days</span>
              </button>
            </div>

            {onOpenNudge && (
              <button
                type="button"
                onClick={() => onOpenNudge(currentProfile)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                title="Generate pre-formatted in-game telegram"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Nudge</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Audit Header Tags & Dormant Pillar Explainer Panel */}
        {showHeaderTagsExplainer && (
          <div className="shrink-0 mt-2.5 p-4 rounded-2xl theme-popover-surface border-2 shadow-xl space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-black text-white uppercase tracking-wider text-xs">
                  {tx(
                    `Audit Tags & Classification Guide for ${currentProfile.username}`,
                    `Guía de Etiquetas y Clasificación de Auditoría para ${currentProfile.username}`
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHeaderTagsExplainer(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Master Standing */}
              <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-700/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">
                  {tx('1. Master Fiscal Standing', '1. Clasificación Fiscal Principal')}
                </div>
                <div className="font-bold text-white">
                  {standing === 'historical-pillar' && tx('🏛️ Historical Pillar', '🏛️ Pilar Histórico')}
                  {standing === 'combat-veteran' && tx('⚔️ Frontline Hero', '⚔️ Héroe del Frente')}
                  {standing === 'sovereign-patriot' && tx('🌟 Sovereign Patriot', '🌟 Patriota Soberano')}
                  {standing === 'standard-contributor' && tx('🔵 Standard Contributor', '🔵 Contribuyente Estándar')}
                  {standing === 'low-contributor' && tx('⚠️ Low Donor', '⚠️ Bajo Donante')}
                  {standing === 'illiquid-fighter' && tx('🔒 Illiquid Combatant / Sacrifice', '🔒 Combatiente Ilíquido / Sacrificio')}
                  {standing === 'subsistence-worker' && tx('🛡️ Subsistence Worker', '🛡️ Trabajador de Subsistencia')}
                  {standing === 'evader-leech' && tx('🚨 Evader / Leech', '🚨 Evasor / Leech')}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'es'
                    ? translateRawStringEs(liveVerdictEval.ministerialVerdictReason)
                    : liveVerdictEval.ministerialVerdictReason}
                </p>
              </div>

              {/* Card 2: Dormant Historical Pillar Explanation */}
              <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/45 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                  {tx('2. Dormant Pillar Tag (🏛️ + ⚠️)', '2. Etiqueta Pilar Inactivo (🏛️ + ⚠️)')}
                </div>
                <div className="font-bold text-amber-200">
                  {standing === 'historical-pillar'
                    ? liveTierEval.isDormantPillar
                      ? tx('Active on This Citizen (Dormant Pillar)', 'Activa en Este Ciudadano (Pilar Inactivo)')
                      : tx('Active Pillar (Donating in Period)', 'Pilar Activo (Donando en el Período)')
                    : tx('How Dormant Pillar Works', 'Cómo Funciona el Pilar Inactivo')}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {tx(
                    `Citizens in the Top Lifetime Donors who meet the Policy Grace Floor (≥${(config.historicalDonorGraceThresholdBtc ?? 500).toLocaleString()} BTC) keep their 🏛️ Historical Pillar shield permanently. When their ${auditPeriodDays}D donation is 0 or below quota (${formatBtc(periodDonated)} BTC), they receive the ⚠️ Dormant badge and unlock Dual Nudge Recommendations (Primary Commendation + Secondary Treasury Nudge).`,
                    `Los ciudadanos en el Top de Donantes Históricos que cumplen el Piso de Gracia (≥${(config.historicalDonorGraceThresholdBtc ?? 500).toLocaleString()} BTC) conservan su escudo de 🏛️ Pilar Histórico. Cuando su donación en ${auditPeriodDays}D es 0 o bajo cuota (${formatBtc(periodDonated)} BTC), reciben la etiqueta ⚠️ Inactivo y desbloquean la Doble Recomendación en Nudge (Condecoración + Solicitud Secundaria).`
                  )}
                </p>
              </div>

              {/* Card 3: Special Context & Median-Based Protections */}
              <div className="p-3 rounded-xl bg-indigo-950/35 border border-indigo-500/45 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-indigo-300 font-bold">
                  {tx('3. Special Context & Median Shield', '3. Contexto Especial y Escudo por Mediana')}
                </div>
                <div className="font-bold text-indigo-200">
                  {liveTierEval.specialContextBadge
                    ? lang === 'es'
                      ? translateRawStringEs(liveTierEval.specialContextBadge)
                      : liveTierEval.specialContextBadge
                    : tx('Standard Country-Median Evaluation', 'Evaluación Estándar por Mediana del País')}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {liveTierEval.specialContextReason
                    ? lang === 'es'
                      ? translateRawStringEs(liveTierEval.specialContextReason)
                      : liveTierEval.specialContextReason
                    : tx(
                        `Evaluated dynamically against ${countryName}'s medians: Lifetime Donated ${formatBtc(currentProfile.totalDonatedBtc)} BTC (vs. ${formatBtc(countryBenchmark?.lifetimeDonationMedian ?? 150)} BTC median / ${formatBtc(countryBenchmark?.lifetimeDonationP75 ?? 500)} BTC P75), Career Damage ${lifetimeCombatDamage.toLocaleString()} (vs. ${(countryBenchmark?.careerDamageP75 ?? 200000).toLocaleString()} P75), Company Equity ${formatBtc(companiesWealth)} BTC. Protects proven veterans, war-to-eco farmers, and company sacrificers from false Leech shaming.`,
                        `Evaluado dinámicamente frente a las medianas de ${countryName}: Donado Histórico ${formatBtc(currentProfile.totalDonatedBtc)} BTC (vs. ${formatBtc(countryBenchmark?.lifetimeDonationMedian ?? 150)} BTC mediana / ${formatBtc(countryBenchmark?.lifetimeDonationP75 ?? 500)} BTC P75), Daño Histórico ${lifetimeCombatDamage.toLocaleString()} (vs. ${(countryBenchmark?.careerDamageP75 ?? 200000).toLocaleString()} P75), Empresas ${formatBtc(companiesWealth)} BTC. Protege a donantes veteranos, guerreros en modo eco y sacrificios industriales.`
                      )}
                </p>
              </div>

              {/* Card 4: Build Mode & Respec Tenure */}
              <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-700/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                  {tx('4. Build Mode & Policy Quotas', '4. Modo de Build y Cuotas')}
                </div>
                <div className="font-bold text-emerald-200">
                  {`${currentProfile.playstyle === 'pure-eco' ? '🌾 Eco Build' : currentProfile.playstyle === 'pure-war' ? '⚔️ War Build' : '⚖️ Hybrid Build'} (${targetQuotaPct}% / ${targetPatriotPct}%)`}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {tx(
                    `Detected from v0.27.3 skill allocation (${currentProfile.ecoSkillPoints} Eco SP / ${currentProfile.warSkillPoints} War SP${
                      typeof currentProfile.daysInBuild === 'number'
                        ? `, active ${currentProfile.daysInBuild}d`
                        : currentProfile.buildDurationSource === 'weekly-combat-bound'
                        ? ', switched ≤7d ago'
                        : ', reset date unverified'
                    }). Sets this citizen's standard quota to ${targetQuotaPct}% and Model Patriot quota to ${targetPatriotPct}% of verified ${auditPeriodDays}D gross cashflow.`,
                    `Detectado por puntos de habilidad v0.27.3 (${currentProfile.ecoSkillPoints} Eco SP / ${currentProfile.warSkillPoints} War SP${
                      typeof currentProfile.daysInBuild === 'number'
                        ? `, activo por ${currentProfile.daysInBuild}d`
                        : currentProfile.buildDurationSource === 'weekly-combat-bound'
                        ? ', cambio reciente ≤7d'
                        : ', reinicio no verificado'
                    }). Fija la cuota estándar en ${targetQuotaPct}% y la cuota Patriota Modelo en ${targetPatriotPct}% del flujo bruto de ${auditPeriodDays}D.`
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs (no vertical scrollbar) */}
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-slate-800 py-2.5 px-0.5 text-xs font-bold overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab('cashflow')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'cashflow'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span>Financial &amp; Solvency Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>{`Line-Item Transaction Ledger (${timeframeTransactions.length})`}</span>
            {isSyncingLedger && <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'companies'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Companies &amp; Bot Workforce</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defense')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'defense'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>Military &amp; Battlefield Defense</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="pt-3 px-1 sm:px-2 overflow-y-auto space-y-3 flex-1">
          {/* TAB 1: FINANCIAL & SOLVENCY AUDIT */}
          {activeTab === 'cashflow' && (
            <div className="space-y-3 animate-fade-in">
              {/* Sync Action Header */}
              {apiKey ? (
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <RefreshCw className={`w-4 h-4 text-cyan-400 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                      <span>
                        {syncStatusMsg || (timeframeTransactions.length > 0 ? `Loaded ${timeframeTransactions.length} verified in-game receipts (${wagesCount} wage slips, ${salesCount} market sales across ${periodDays}D).` : 'Personal receipts pending. Click to stream line-item ledger.')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSyncingLedger && (
                        <button
                          type="button"
                          onClick={handleStopStreaming}
                          className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Halt Stream</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSyncLiveReceipts()}
                        disabled={isSyncingLedger}
                        className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                        {isSyncingLedger ? 'Streaming receipts...' : 'Stream Live In-Game Receipts'}
                      </button>
                    </div>
                  </div>

                  {/* High-Integrity Streaming Shield Banner */}
                  {isSyncingLedger && (
                    <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl space-y-2 animate-fade-in shadow-inner">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-mono text-cyan-200">
                          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                          <span className="font-bold">Streaming Personal Receipts: Page {streamProgress?.page ?? 1} ({streamProgress?.loaded ?? 0} receipts verified)...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-500/30 text-cyan-300">
                            Staging Buffer Active
                          </span>
                          <button
                            type="button"
                            onClick={handleStopStreaming}
                            className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-sans font-semibold border border-slate-700 transition"
                            title="Stop streaming and calculate financial totals with receipts collected so far"
                          >
                            Halt &amp; Keep Loaded
                          </button>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 animate-pulse rounded-full w-full" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">
                        Financial metrics are shielded under skeleton loaders until receipt stream completes, preventing temporary misleading figures.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-2xl text-xs text-amber-300/90 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Connect War Era API token in the top header to stream live line-item wage contracts, item sales, and market purchases.</span>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>{`Gross Cash Inflow (${periodDays}D)`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveExplainerCard('grossInflow')}
                      className="text-slate-400 hover:text-cyan-300 p-1 rounded-lg hover:bg-slate-800 transition"
                      title="Inspect how Gross Cash Inflow is calculated"
                    >
                      <HelpCircle className="w-4 h-4 text-cyan-400" />
                    </button>
                  </div>
                  {isSyncingLedger ? (
                    <div className="flex items-center gap-2 mt-2 py-1">
                      <div className="h-8 w-36 rounded-xl bg-cyan-950/60 border border-cyan-800/40 animate-pulse flex items-center px-3 gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                        <span className="text-xs font-mono text-cyan-300 font-semibold">Calculating...</span>
                      </div>
                    </div>
                  ) : currentProfile.auditBaselineStatus !== 'audited' && timeframeTransactions.length === 0 ? (
                    <div className="mt-2 py-1">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold inline-block">
                        Unverified · Stream Receipts First
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl font-black font-mono text-cyan-300">
                        {formatBtc(grossIncome)} <span className="text-xs text-cyan-400 font-bold">BTC</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Total BTC passing into wallet from wages, commodity/gear sales turnover, and tips.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span>{`Net Cashflow (${periodDays}D)`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveExplainerCard('netCashflow')}
                      className="text-slate-400 hover:text-emerald-300 p-1 rounded-lg hover:bg-slate-800 transition"
                      title="Inspect how Net Cashflow is calculated"
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                  {isSyncingLedger ? (
                    <div className="flex items-center gap-2 mt-2 py-1">
                      <div className="h-8 w-36 rounded-xl bg-emerald-950/60 border border-emerald-800/40 animate-pulse flex items-center px-3 gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                        <span className="text-xs font-mono text-emerald-300 font-semibold">Calculating net...</span>
                      </div>
                    </div>
                  ) : currentProfile.auditBaselineStatus !== 'audited' && timeframeTransactions.length === 0 ? (
                    <div className="mt-2 py-1">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold inline-block">
                        Unverified · Stream Receipts First
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="text-2xl font-black font-mono text-emerald-300">
                        {formatBtc(netDisposableIncome)} <span className="text-xs text-emerald-400 font-bold">BTC</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Net BTC gained or lost from wages and market trading after subtracting purchases and payroll.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-amber-400" /> Period Treasury Contribution
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveExplainerCard('treasuryContribution')}
                      className="text-slate-400 hover:text-amber-300 p-1 rounded-lg hover:bg-slate-800 transition"
                      title="Inspect how Treasury Contribution is calculated"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                  {isSyncingLedger ? (
                    <div className="flex items-center gap-2 mt-2 py-1">
                      <div className="h-8 w-36 rounded-xl bg-amber-950/60 border border-amber-800/40 animate-pulse flex items-center px-3 gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                        <span className="text-xs font-mono text-amber-300 font-semibold">Verifying ratio...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                      <div className="text-2xl font-black font-mono text-amber-300">
                        {formatBtc(periodDonated)} <span className="text-xs text-amber-400 font-bold">BTC</span>
                      </div>
                      {isCombatPolicyActive && militaryCredit > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs font-mono font-bold text-rose-300"
                          title={`Converted Battlefield Defense Credit: (${activeCombatDamage.toLocaleString()} DMG ÷ 1,000) × ${militaryCreditRate} BTC = +${formatBtc(militaryCredit)} BTC`}
                        >
                          {`+${formatBtc(militaryCredit)} BTC War Credit`}
                        </span>
                      )}
                    </div>
                  )}
                  {isSyncingLedger ? (
                    <div className="h-3 w-48 rounded bg-slate-800 animate-pulse mt-2" />
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      {`${
                        grossIncome > 0 || currentProfile.auditBaselineStatus === 'audited'
                          ? `${liveTierEval.ratio.toFixed(1)}% / ${targetQuotaPct}% Quota (${targetPatriotPct}% Patriot)`
                          : 'Pending live stream verification'
                      } · ${formatBtc(currentProfile.totalDonatedBtc)} BTC lifetime`}
                    </p>
                  )}
                </div>
              </div>

              {/* Multi-Stream Accounting Breakdown */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Itemized Income Streams &amp; Hoarding Analysis</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Wages Earned Stream */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Wages Earned (Labor Salary)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-emerald-300 font-bold text-sm">+{formatBtc(wagesEarned)} BTC</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveExplainerCard('wages')}
                          className="text-slate-400 hover:text-emerald-300 p-0.5 rounded transition"
                          title="Explain Wages calculation"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {`${wagesCount} work shifts completed. Earned from daily labor contracts.`}
                    </div>
                  </div>

                  {/* Wages Paid Out Stream */}
                  {wagesPaid > 0 && (
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-rose-400" /> Wages Paid (Employee Payroll)
                        </span>
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-rose-300 font-bold text-sm">-{formatBtc(wagesPaid)} BTC</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {`${wagesPaidCount} payroll disbursements to hired factory workers.`}
                      </div>
                    </div>
                  )}

                  {/* Market Sales (Converted to BTC) */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" /> Market Sales (Trading &amp; Gear)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-cyan-300 font-bold text-sm">+{formatBtc(salesVolume)} BTC</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveExplainerCard('sales')}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 rounded transition"
                          title="Explain Market Sales calculation"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {`${salesCount} filled orders. Converted manufactured goods (lead, steel, ammo) & gear into liquid BTC.`}
                    </div>
                  </div>

                  {/* Market Purchases (Hoarded / Spent) */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" /> Purchases (Supplies &amp; Gear)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-rose-300 font-bold text-sm">-{formatBtc(purchasesVolume)} BTC</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveExplainerCard('purchases')}
                          className="text-slate-400 hover:text-rose-300 p-0.5 rounded transition"
                          title="Explain Purchases calculation"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {`${purchasesCount} filled purchase orders. BTC spent buying resources or equipment.`}
                    </div>
                  </div>

                  {/* Net Realized Trade Balance */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /> Net Trading Balance
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className={`font-mono font-bold text-sm ${netTradeMargin >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                            {netTradeMargin >= 0 ? '+' : ''}{formatBtc(netTradeMargin)} BTC
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveExplainerCard('tradingMargin')}
                          className="text-slate-400 hover:text-amber-300 p-0.5 rounded transition"
                          title="Explain Net Trading Balance calculation"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Net difference between market sales turnover and purchase orders.
                    </div>
                  </div>

                  {/* Journalism Tips & Operating Fees */}
                  {(tipsReceived > 0 || craftingExpenses > 0) && (
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" /> Journalism Tips &amp; Crafting
                        </span>
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-indigo-300 font-bold text-sm">
                            {tipsReceived > craftingExpenses ? '+' : ''}{formatBtc(tipsReceived - craftingExpenses)} BTC
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tips: +{formatBtc(tipsReceived)} BTC · Crafting/cases: -{formatBtc(craftingExpenses)} BTC
                      </div>
                    </div>
                  )}

                  {/* Military Unit Donations (Cashflow Outflow Only) */}
                  {muDonated > 0 && (
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Swords className="w-3.5 h-3.5 text-rose-400" /> Military Unit Donations (Cashflow Outflow)
                        </span>
                        {isSyncingLedger ? (
                          <div className="h-5 w-20 rounded bg-slate-800 animate-pulse" />
                        ) : (
                          <span className="font-mono text-rose-400 font-bold text-sm">
                            -{formatBtc(muDonated)} BTC
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {`${muDonationsCount} transfer(s) · Deducted from Net Cashflow only (excluded from country leaderboard & citizen classification).`}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Balance Sheet Capital Stock */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>{`Balance Sheet Portfolio (Total Net Worth: ${formatBtc(totalWealth)} BTC)`}</span>
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-400" /> Liquid Cash
                    </div>
                    <div className="text-base font-black text-amber-300 mt-0.5">{formatBtc(liquidBtc)} BTC</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Available in wallet</div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-400" /> Companies Capital
                    </div>
                    <div className="text-base font-black text-indigo-300 mt-0.5">{formatBtc(companiesWealth)} BTC</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">{`${liveCompanies.length || currentProfile.companiesCount || 0} companies owned`}</div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <Package className="w-3 h-3 text-cyan-400" /> Resource Stockpile
                    </div>
                    <div className="text-base font-black text-cyan-300 mt-0.5">{formatBtc(resourceWealth)} BTC</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Items &amp; commodities</div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <Shield className="w-3 h-3 text-rose-400" /> Equipment &amp; Weapons
                    </div>
                    <div className="text-base font-black text-rose-300 mt-0.5">{formatBtc(equipmentsWealth)} BTC</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Equipped military armor/guns</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LINE-ITEM TRANSACTION LEDGER */}
          {activeTab === 'transactions' && (
            <div className="space-y-3 animate-fade-in">
              {/* Controls bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('all')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {`All (${tabCounts.all})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('wage')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'wage' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-950/40'
                    }`}
                  >
                    {`Wages (${tabCounts.wage})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('trading')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'trading' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-cyan-400 border border-cyan-900/40 hover:bg-cyan-950/40'
                    }`}
                  >
                    {`Trading Commodities (${tabCounts.trading})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('market')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'market' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-950 text-indigo-400 border border-indigo-900/40 hover:bg-indigo-950/40'
                    }`}
                  >
                    {`Item Market (${tabCounts.market})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('donation')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'donation' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-amber-400 border border-amber-900/40 hover:bg-amber-950/40'
                    }`}
                  >
                    {`Donations (${tabCounts.donation})`}
                  </button>
                  {tabCounts.other > 0 && (
                    <button
                      type="button"
                      onClick={() => setTxTypeFilter('other')}
                      className={`px-3 py-1 rounded-xl font-bold transition ${
                        txTypeFilter === 'other' ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-950 text-purple-400 border border-purple-900/40 hover:bg-purple-950/40'
                      }`}
                    >
                      {`Tips & Fees (${tabCounts.other})`}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {apiKey && (
                    <div className="flex items-center gap-1.5">
                      {isSyncingLedger && (
                        <button
                          type="button"
                          onClick={handleStopStreaming}
                          className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Pause or stop streaming receipts"
                        >
                          <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden sm:inline">Halt</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSyncLiveReceipts()}
                        disabled={isSyncingLedger}
                        className="px-2.5 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                        title="Stream verified in-game receipts from War Era tRPC"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{isSyncingLedger ? 'Streaming...' : 'Stream Receipts'}</span>
                      </button>
                    </div>
                  )}

                  <div className="relative w-48 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder={tx('Search player, company, item, ID...', 'Buscar jugador, empresa, ítem, ID...')}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Live Streaming Status Notification Banner */}
              {syncStatusMsg && (
                <div className="px-3.5 py-2 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    {isSyncingLedger ? (
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">{syncStatusMsg}</span>
                  </div>
                  {streamProgress && isSyncingLedger && (
                    <span className="text-cyan-400 font-bold shrink-0">
                      Page {streamProgress.page} ({streamProgress.loaded} txs)
                    </span>
                  )}
                </div>
              )}

              {/* Color Representation Legend & Viewport Pagination Controls */}
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-slate-400 font-sans font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-400" /> {tx('Color Guide:', 'Guía de Color:')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {tx('+ Inflow (Wages, Sales, Tips)', '+ Ingreso (Salarios, Ventas, Propinas)')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    {tx('- Outflow (Purchases, Payroll, Fees)', '- Egreso (Compras, Nómina, Tarifas)')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {tx('Tithes (Treasury / Military Donations)', 'Diezmos (Donaciones Tesorería / UM)')}
                  </span>
                </div>

                {filteredTransactions.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto font-sans">
                    {isResolvingCounterparties && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        {tx('Live-resolving counterparties...', 'Resolviendo contrapartes en vivo...')}
                      </span>
                    )}
                    <select
                      value={txPageSize}
                      onChange={(e) => setTxPageSize(Number(e.target.value) as 100 | 250 | 500)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                      title={tx('Receipts per page', 'Recibos por página')}
                    >
                      <option value={100}>{tx('100 / page', '100 / pág')}</option>
                      <option value={250}>{tx('250 / page', '250 / pág')}</option>
                      <option value={500}>{tx('500 / page', '500 / pág')}</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={safeTxPage <= 1}
                        className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition"
                        title={tx('Previous page', 'Página anterior')}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono text-slate-300 px-1.5">
                        {safeTxPage} / {totalTxPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                        disabled={safeTxPage >= totalTxPages}
                        className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition"
                        title={tx('Next page', 'Página siguiente')}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[28rem]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-mono sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">{tx('Date / Time', 'Fecha / Hora')}</th>
                        <th className="py-2.5 px-3">{tx('Type', 'Tipo')}</th>
                        <th className="py-2.5 px-3">{tx('Role', 'Rol')}</th>
                        <th className="py-2.5 px-3">{tx('Item / Resource', 'Artículo / Recurso')}</th>
                        <th className="py-2.5 px-3 text-right">{tx('Amount (BTC)', 'Monto (BTC)')}</th>
                        <th className="py-2.5 px-3">{tx('Counterparty / Details', 'Contraparte / Detalles')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {isSyncingLedger && (
                        <tr className="bg-cyan-950/40 border-b border-cyan-800/40 text-cyan-300 font-mono text-xs">
                          <td colSpan={6} className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-2">
                              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                              <span>
                                {tx(
                                  `Live streaming and verifying in-game receipts (${timeframeTransactions.length} receipts verified for ${auditPeriodDays}D window)...`,
                                  `Transmitiendo y verificando recibos del juego en vivo (${timeframeTransactions.length} recibos verificados para ventana de ${auditPeriodDays}D)...`
                                )}
                              </span>
                            </span>
                          </td>
                        </tr>
                      )}
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-sans">
                            {timeframeTransactions.length === 0
                              ? tx(
                                  `No receipts found within the active ${auditPeriodDays}-day timeframe. Click "Stream Receipts" to refresh history.`,
                                  `No se encontraron recibos dentro de la ventana activa de ${auditPeriodDays} días. Haz clic en "Transmitir Recibos" para actualizar el historial.`
                                )
                              : tx(
                                  'No transactions match the selected filter criteria.',
                                  'Ninguna transacción coincide con los criterios de filtro seleccionados.'
                                )}
                          </td>
                        </tr>
                      ) : (
                        paginatedTransactions.map((txItem, idx) => {
                          if (!txItem) return null;
                          const amt = isNaN(Number(txItem.money || txItem.amount || 0)) ? 0 : Number(txItem.money || txItem.amount || 0);
                          const rawType = String(txItem.transactionType || '');
                          const typeLower = rawType.toLowerCase();
                          const isWage = typeLower.includes('wage') || typeLower.includes('salary');

                          const sellerStr = safelyExtractIdString(txItem.sellerId);
                          const buyerStr = safelyExtractIdString(txItem.buyerId);
                          const recipientStr = safelyExtractIdString(txItem.recipientId);
                          const senderStr = safelyExtractIdString(txItem.senderId);
                          const companyStr = safelyExtractIdString(txItem.companyId);

                          const isSeller = sellerStr === currentProfile.userId;
                          const isBuyer = buyerStr === currentProfile.userId;
                          const isDonation = typeLower.includes('donat');
                          const isMuDonation = isDonation && Boolean(txItem.sellerMuId);
                          const dateStr = txItem.createdAt
                            ? formatDateTimeDDMMYYYY(txItem.createdAt, 'Recent')
                            : 'Recent';

                          // Accurately determine if wage was earned as worker or paid out as employer
                          const isEmployerWage = isWage && (buyerStr === currentProfile.userId || senderStr === currentProfile.userId || (Boolean(recipientStr) && recipientStr !== currentProfile.userId));
                          const isWorkerWage = isWage && !isEmployerWage;

                          const isPositiveInflow = isSeller || isWorkerWage || (typeLower.includes('tip') && sellerStr === currentProfile.userId);
                          const isNegativeOutflow = isBuyer || isEmployerWage || isDonation || typeLower.includes('craft') || typeLower.includes('dismantle') || typeLower.includes('case');

                          const roleLabel = isEmployerWage
                            ? tx('Employer (Wage Outflow)', 'Empleador (Pago de Salario)')
                            : isWorkerWage
                            ? tx('Worker (Wage Inflow)', 'Trabajador (Cobro de Salario)')
                            : isDonation
                            ? isMuDonation
                              ? tx('Donor (Military Unit)', 'Donante (Unidad Militar)')
                              : tx('Donor (Treasury Transfer)', 'Donante (Transferencia al Tesoro)')
                            : isSeller
                            ? tx('Seller (Market Sale)', 'Vendedor (Venta de Mercado)')
                            : isBuyer
                            ? tx('Buyer (Market Purchase)', 'Comprador (Compra de Mercado)')
                            : tx('Participant', 'Participante');

                          const itemStr = safelyExtractItemString(txItem.itemCode || txItem.item || txItem.resourceType);

                          // Determine counterparty role & IDs for live profile display
                          let counterpartyRolePrefix = '';
                          let primaryActorId = '';
                          if (isEmployerWage) {
                            counterpartyRolePrefix = tx('Worker:', 'Trabajador:');
                            primaryActorId =
                              (recipientStr && recipientStr !== currentProfile.userId ? recipientStr : '') ||
                              (sellerStr && sellerStr !== currentProfile.userId ? sellerStr : '');
                          } else if (isWorkerWage) {
                            counterpartyRolePrefix = tx('Employer:', 'Empleador:');
                            primaryActorId =
                              (buyerStr && buyerStr !== currentProfile.userId ? buyerStr : '') ||
                              (senderStr && senderStr !== currentProfile.userId ? senderStr : '') ||
                              companyStr;
                          } else if (isSeller) {
                            counterpartyRolePrefix = tx('Buyer:', 'Comprador:');
                            primaryActorId =
                              (buyerStr && buyerStr !== currentProfile.userId ? buyerStr : '') ||
                              (recipientStr && recipientStr !== currentProfile.userId ? recipientStr : '') ||
                              safelyExtractIdString(txItem.buyerCountryId);
                          } else if (isBuyer) {
                            counterpartyRolePrefix = tx('Seller:', 'Vendedor:');
                            primaryActorId =
                              (sellerStr && sellerStr !== currentProfile.userId ? sellerStr : '') ||
                              (senderStr && senderStr !== currentProfile.userId ? senderStr : '') ||
                              safelyExtractIdString(txItem.sellerCountryId);
                          } else {
                            if (sellerStr && sellerStr !== currentProfile.userId) {
                              counterpartyRolePrefix = tx('Seller:', 'Vendedor:');
                              primaryActorId = sellerStr;
                            } else if (buyerStr && buyerStr !== currentProfile.userId) {
                              counterpartyRolePrefix = tx('Buyer:', 'Comprador:');
                              primaryActorId = buyerStr;
                            } else if (companyStr) {
                              counterpartyRolePrefix = tx('Employer:', 'Empleador:');
                              primaryActorId = companyStr;
                            }
                          }

                          const actorProfile = primaryActorId ? counterpartyMap[primaryActorId] : undefined;
                          const explicitCompanyProfile = companyStr ? counterpartyMap[companyStr] : undefined;

                          const resolvedPlayerName =
                            actorProfile?.username ||
                            explicitCompanyProfile?.username ||
                            (primaryActorId ? `Citizen #${primaryActorId.slice(-6)}` : '');
                          const resolvedPlayerAvatar =
                            actorProfile?.avatarUrl || explicitCompanyProfile?.avatarUrl;
                          const resolvedCountryName =
                            actorProfile?.countryName || explicitCompanyProfile?.countryName;
                          const resolvedCountryCode =
                            actorProfile?.countryCode || explicitCompanyProfile?.countryCode;
                          const resolvedCompanyName =
                            explicitCompanyProfile?.companyName || actorProfile?.companyName;
                          const resolvedCopyableId =
                            actorProfile?.userId ||
                            explicitCompanyProfile?.userId ||
                            primaryActorId ||
                            companyStr;
                          const rowCopyKey = `${txItem._id || idx}-${resolvedCopyableId}`;
                          const isRowCopied = copiedCounterpartyKey === rowCopyKey;

                          const donationTargetCountryId = safelyExtractIdString(
                            txItem.sellerCountryId || txItem.countryId || currentProfile.countryId
                          );
                          const donationCountryProf = donationTargetCountryId
                            ? counterpartyMap[donationTargetCountryId]
                            : undefined;
                          const donationCountryName =
                            donationCountryProf?.countryName || currentProfile.countryName || countryName;
                          const donationCountryCode = donationCountryProf?.countryCode;

                          return (
                            <tr key={txItem._id || `tx-${idx}`} className="hover:bg-slate-900/50 transition">
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{dateStr}</td>
                              <td className="py-2.5 px-3 font-bold font-sans">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  isWorkerWage
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : isEmployerWage
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : isDonation
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : isSeller
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {rawType || 'Transaction'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                                {roleLabel}
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                {itemStr ? (
                                  <span className="capitalize font-bold text-white flex items-center gap-1.5">
                                    <WareraItemIcon itemCode={itemStr} size="xs" />
                                    <span>{translateCommodity(itemStr.replace(/_/g, ' '))}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                                isPositiveInflow
                                  ? 'text-emerald-400'
                                  : isNegativeOutflow
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}>
                                {isPositiveInflow ? '+' : isNegativeOutflow ? '-' : ''}{formatBtc(amt)} BTC
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 text-[11px] font-sans">
                                {isMuDonation && txItem.sellerMuId ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>{tx('Military Unit:', 'Unidad Militar:')}</span>
                                    <span className="font-mono">{String(txItem.sellerMuId).slice(-6)}</span>
                                  </div>
                                ) : isDonation ? (
                                  <div className="inline-flex items-center gap-1.5 flex-wrap">
                                    <WareraCountryFlag
                                      countryName={donationCountryName}
                                      countryCode={donationCountryCode}
                                      size="xs"
                                    />
                                    <span className="font-bold text-white">{donationCountryName}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-semibold">
                                      🏛️ {tx('National Treasury', 'Tesorería Nacional')}
                                    </span>
                                  </div>
                                ) : actorProfile?.kind === 'country' ? (
                                  <div className="inline-flex items-center gap-1.5 flex-wrap">
                                    {counterpartyRolePrefix && (
                                      <span className="text-slate-400 text-[10px] font-semibold">
                                        {counterpartyRolePrefix}
                                      </span>
                                    )}
                                    <WareraCountryFlag
                                      countryName={actorProfile.countryName || actorProfile.username}
                                      countryCode={actorProfile.countryCode}
                                      size="xs"
                                    />
                                    <span className="font-bold text-white">
                                      {actorProfile.countryName || actorProfile.username}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-semibold">
                                      🏛️ {tx('Treasury', 'Tesorería')}
                                    </span>
                                  </div>
                                ) : primaryActorId || companyStr ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCounterpartyId(resolvedCopyableId, rowCopyKey)}
                                    title={tx(
                                      `Click to copy Player ID: ${resolvedCopyableId}`,
                                      `Clic para copiar ID de Jugador: ${resolvedCopyableId}`
                                    )}
                                    className="group inline-flex items-center gap-1.5 text-left hover:bg-slate-800/80 px-1.5 py-1 -mx-1.5 -my-1 rounded-lg transition max-w-full"
                                  >
                                    {counterpartyRolePrefix && (
                                      <span className="text-slate-400 text-[10px] font-semibold shrink-0">
                                        {counterpartyRolePrefix}
                                      </span>
                                    )}

                                    {/* Live Counterparty Avatar */}
                                    <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 overflow-hidden shrink-0 inline-flex items-center justify-center text-[9px] font-bold text-cyan-300">
                                      {resolvedPlayerAvatar ? (
                                        <img
                                          src={resolvedPlayerAvatar}
                                          alt={resolvedPlayerName}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      ) : !actorProfile && !explicitCompanyProfile && isResolvingCounterparties ? (
                                        <span className="w-full h-full bg-slate-700 animate-pulse" />
                                      ) : (
                                        (resolvedPlayerName || 'CZ').slice(0, 2).toUpperCase()
                                      )}
                                    </span>

                                    {/* Live Counterparty Username */}
                                    <span className="font-bold text-white group-hover:text-cyan-300 transition truncate max-w-[130px] sm:max-w-[170px]">
                                      {resolvedPlayerName}
                                    </span>

                                    {/* Live Counterparty Country Flag */}
                                    {resolvedCountryName && (
                                      <WareraCountryFlag
                                        countryName={resolvedCountryName}
                                        countryCode={resolvedCountryCode}
                                        size="xs"
                                      />
                                    )}

                                    {/* Company Badge when transaction involves a Company */}
                                    {resolvedCompanyName && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold truncate max-w-[130px]">
                                        <Building2 className="w-2.5 h-2.5 shrink-0" />
                                        <span className="truncate">{resolvedCompanyName}</span>
                                      </span>
                                    )}

                                    {/* Copy Player ID feedback */}
                                    {isRowCopied ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                                        <Check className="w-3 h-3" />
                                        <span>{tx('Copied ID!', '¡ID Copiado!')}</span>
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-500">
                                    {tx('Domestic sovereign ledger', 'Libro soberano nacional')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPANIES & BOT WORKFORCE PORTFOLIO */}
          {activeTab === 'companies' && (
            <div className="space-y-4 animate-fade-in">
              {/* v0.27 BuhDeuce Skill Build & Workforce Evaluation Scorecard */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        v0.27 Skill Build &amp; BuhDeuce Workforce Evaluation
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          activeBuildEvaluation.grade === 'optimal-meta'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : activeBuildEvaluation.grade === 'optimal-early-selfwork'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : activeBuildEvaluation.grade === 'viable-selfwork'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : activeBuildEvaluation.grade === 'war-ready'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {activeBuildEvaluation.badgeLabel || activeBuildEvaluation.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {activeBuildEvaluation.summary}
                    </p>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Mgmt Bot Boost</div>
                    <div className="text-base font-black text-emerald-400">
                      {`+${activeSkillBreakdown.management * 2}% Output`}
                    </div>
                  </div>
                </div>

                {/* v0.27.3 Skill Points Breakdown Strip (Leadership fused into Management) */}
                {hasVerifiedSkillBreakdown ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-sans">Companies</div>
                      <div className="font-black text-white mt-0.5">{activeSkillBreakdown.companies}</div>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl" title="Hotfix 0.27.3 fused Leadership into Management: +2% employee output/lvl + better training card draws & event odds">
                      <div className="text-[10px] text-slate-400 font-sans">Management (0.27.3)</div>
                      <div className="font-black text-emerald-300 mt-0.5">
                        {activeSkillBreakdown.management} <span className="text-[10px] text-emerald-400">(+{activeSkillBreakdown.management * 2}%)</span>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-sans">Energy</div>
                      <div className="font-black text-cyan-300 mt-0.5">{activeSkillBreakdown.energy}</div>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-sans">Production</div>
                      <div className="font-black text-blue-300 mt-0.5">{activeSkillBreakdown.production}</div>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-sans">Luck / Loot</div>
                      <div className="font-black text-purple-300 mt-0.5">{activeSkillBreakdown.lootChance ?? 0}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono text-center">
                    {`Individual skill node breakdown not exposed by API for this citizen (Total SP: ${currentProfile.ecoSkillPoints} Eco / ${currentProfile.warSkillPoints} War). No synthetic split displayed.`}
                  </div>
                )}

                {/* Recommendations & Warnings */}
                {(activeBuildEvaluation.recommendations.length > 0 || activeBuildEvaluation.warnings.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    {activeBuildEvaluation.recommendations.map((rec, idx) => (
                      <div
                        key={`rec-${idx}`}
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                    {activeBuildEvaluation.warnings.map((warn, idx) => (
                      <div
                        key={`warn-${idx}`}
                        className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 flex items-start gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Company, Manager & Bot Workforce Portfolio Analyzer (v0.27) */}
              <CompanyPortfolioAnalyzer
                initialUserId={currentProfile.userId}
                initialUsername={currentProfile.username}
                showPlayerSearch={false}
              />

              {/* Itemized Multi-Company Trait Simulator & Infrastructure Cards Deck */}
              <details className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 group">
                <summary className="flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none">
                  <div className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Piraterers 29-Trait Sandbox &amp; Breakroom Override Inspector</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
                      {`${companiesToRender.length} Live API Record(s)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRefreshCompanies}
                      disabled={isLoadingCompanies}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold border border-indigo-500/40 flex items-center gap-1.5 transition disabled:opacity-50 font-sans shadow-sm"
                      title="Fetch live company and upgrade records from War Era API"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-white ${isLoadingCompanies ? 'animate-spin' : ''}`} />
                      <span>{isLoadingCompanies ? 'Syncing Live Companies...' : 'Sync Live Companies'}</span>
                    </button>

                    {/* Commodity Quick Filters */}
                    {allCommodityTypes.length > 1 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setCompanyCommodityFilter('all')}
                          className={`px-2.5 py-1 rounded-xl font-bold transition ${
                            companyCommodityFilter === 'all'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          All
                        </button>
                        {allCommodityTypes.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setCompanyCommodityFilter(code)}
                            className={`px-2 py-1 rounded-xl uppercase font-bold transition ${
                              companyCommodityFilter === code
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                            }`}
                          >
                            {translateCommodity(code)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </summary>
                <div className="pt-3 border-t border-slate-800 space-y-3">

                {isLoadingCompanies ? (
                  <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 animate-pulse">
                    Retrieving live company and upgrade records from War Era server...
                  </div>
                ) : companiesToRender.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3.5">
                    {companiesToRender.map((comp) => {
                      const storageLevel = comp.activeUpgradeLevels?.storage ?? 1;
                      const autoLevel = comp.activeUpgradeLevels?.automatedEngine ?? 1;
                      const effectiveRoster = getCompanyEffectiveRoster(comp);
                      const breakRoomLevel = effectiveRoster.breakRoom;
                      const hasManager = effectiveRoster.hasManager;
                      const employees = effectiveRoster.employees;
                      const hasOverride = effectiveRoster.hasOverride;
                      const hasLiveEmployees = effectiveRoster.hasLiveEmployees;
                      const reportedWorkers = effectiveRoster.reportedWorkerCount;

                      const evalComp: WareraCompany = {
                        ...comp,
                        activeUpgradeLevels: {
                          ...comp.activeUpgradeLevels,
                          storage: storageLevel,
                          automatedEngine: autoLevel,
                          breakRoom: breakRoomLevel,
                        },
                        hasManager,
                        employees,
                      };
                      const wfEval = evaluateCompanyWorkforce(
                        evalComp,
                        employees,
                        activeSkillBreakdown.management,
                        10,
                        commodities
                      );
                      const isExpanded = expandedWorkforceCompId === comp._id;
                      const isManufactured = isManufacturedCommodity(comp.itemCode || '');

                      return (
                        <div
                          key={comp._id}
                          className="p-4 sm:p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3.5 hover:border-slate-700 transition shadow-sm"
                        >
                          {/* Clean Decluttered Company Summary Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3.5">
                              <WareraItemIcon itemCode={comp.itemCode} size="md" />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-white text-base tracking-tight">
                                    {comp.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] uppercase font-mono font-bold">
                                    {translateCommodity(comp.itemCode || '')}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                      comp.isOperatingActive
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        comp.isOperatingActive ? 'bg-emerald-400' : 'bg-slate-500'
                                      }`}
                                    />
                                    {comp.isOperatingActive ? 'Active Slot' : 'Idle Reserve'}
                                  </span>
                                  {hasOverride && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono font-bold text-amber-300">
                                      🛠️ Manual Override
                                    </span>
                                  )}
                                </div>

                                {/* Unboxed Single-Line Recipe, Live Price & Infrastructure Metadata */}
                                <div className="text-xs text-slate-300 font-mono flex items-center gap-2 flex-wrap leading-relaxed">
                                  <span className="text-emerald-300 font-bold">
                                    Live Price: {wfEval.unitMarketPriceBtc.toFixed(3)} BTC / {wfEval.commodityUnit}
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-amber-300">
                                    Recipe: {wfEval.recipeSummary}
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-400">
                                    Breakroom Lvl {breakRoomLevel}/3 ({employees.length > 0 ? `${employees.length} Configured` : reportedWorkers !== null ? `${reportedWorkers} API Workers` : 'Unverified'})
                                  </span>
                                  {hasManager && (
                                    <>
                                      <span className="text-slate-600">·</span>
                                      <span className="text-emerald-400 font-bold">👔 Manager (+5 Happy)</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right Action Cluster: Reset (if overridden) + Inspect Bots & Traits Drawer Toggle */}
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              {hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => handleResetCompanyOverride(comp._id)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                                  title="Clear manual inspector overrides and revert to strict live API data"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Reset to Live API</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWorkforceCompId(isExpanded ? null : comp._id)
                                }
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                                  isExpanded
                                    ? 'bg-indigo-500/30 text-white border-indigo-400 shadow-sm'
                                    : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
                                }`}
                              >
                                <Users className="w-4 h-4" />
                                <span>{isExpanded ? 'Close Bot Inspector' : 'Inspect Bots & Traits'}</span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* 4 Clean Tabular KPI Tiles */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs font-mono pt-1">
                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                              <div className="text-[11px] text-slate-400 font-sans">Total Daily Output</div>
                              <div className="font-black text-cyan-300 text-sm mt-0.5 tabular-nums">
                                {comp.isOperatingActive ? `${wfEval.totalDailyPP} PP/day (${wfEval.dailyUnitsProduced.toFixed(1)} u)` : '0 PP/day'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                                Engine {wfEval.engineHourlyPP.toFixed(1)}/h + Bots {wfEval.workforceHourlyPP.toFixed(1)}/h
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                              <div className="text-[11px] text-slate-400 font-sans">Bot Payroll Cost</div>
                              <div className="font-black text-rose-300 text-sm mt-0.5 tabular-nums">
                                {employees.length > 0 ? `-${wfEval.totalDailyWagesBtc.toFixed(1)} BTC` : 'Unverified'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                                {employees.length > 0
                                  ? `${employees.length} Configured Bot(s)`
                                  : reportedWorkers !== null
                                  ? `${reportedWorkers} API Worker(s) (Traits Private)`
                                  : 'Traits Private on API'}
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                              <div className="text-[11px] text-slate-400 font-sans">
                                Real Daily Profit (@ {wfEval.unitMarketPriceBtc.toFixed(2)} BTC)
                              </div>
                              <div className={`font-black text-sm mt-0.5 tabular-nums ${wfEval.estimatedDailyNetProfitBtc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {comp.isOperatingActive ? `${wfEval.estimatedDailyNetProfitBtc >= 0 ? '+' : ''}${wfEval.estimatedDailyNetProfitBtc.toFixed(2)} BTC` : '0 BTC'}
                              </div>
                              <div className="text-[11px] text-emerald-500/80 font-sans mt-0.5">
                                Gross Rev: {wfEval.estimatedDailyRevenueBtc.toFixed(2)} BTC/d ({wfEval.dailyUnitsProduced.toFixed(1)} {wfEval.commodityUnit})
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80">
                              <div className="text-[11px] text-slate-400 font-sans">Infrastructure &amp; Score</div>
                              <div className="font-black text-amber-300 text-sm mt-0.5 tabular-nums">
                                {employees.length > 0 ? `${wfEval.overallScore} / 100` : `Engine Lvl ${autoLevel}/7`}
                              </div>
                              <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                                Storage Lvl {storageLevel}/7 · Engine Lvl {autoLevel}/7
                              </div>
                            </div>
                          </div>

                          {/* Compact Trait Chips Preview when collapsed (only shown if traits are configured) */}
                          {!isExpanded && employees.length > 0 && (
                            <div className="flex items-center justify-between flex-wrap gap-2 px-1 pt-1 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-400 font-semibold">Configured Bot Traits:</span>
                                {employees.flatMap((e) => e.traits || []).slice(0, 6).map((tId, idx) => {
                                  const tDef = TRAIT_MAP[tId];
                                  if (!tDef) return null;
                                  return (
                                    <span
                                      key={`${comp._id}-t-${idx}`}
                                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                                        tDef.tier === 'must-have'
                                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                          : tDef.tier === 'good-to-have'
                                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      }`}
                                    >
                                      {tDef.name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Expandable Bot Employee Roster & Trait Inspector Drawer */}
                          {isExpanded && (
                            <div className="pt-4 border-t border-slate-800 space-y-3.5 animate-fade-in">
                              {/* Drawer Control Bar: Breakroom, Manager, Add Bot Slot, Re-Sync, Reset */}
                              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-xs text-slate-300 space-y-0.5">
                                  <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                                    <span>Bot Workforce &amp; Trait Simulator</span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      ({isManufactured ? 'Manufactured Good: Craftsman +3' : 'Raw Resource: Laborer +3'})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {hasOverride
                                      ? 'Manual Inspector Override active — saved locally. Click "Reset to Live API" to revert anytime.'
                                      : `Live API reports ${reportedWorkers ?? 0} worker(s), Breakroom Lvl ${breakRoomLevel}/3, Storage Lvl ${storageLevel}/7, Engine Lvl ${autoLevel}/7.`}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  <select
                                    value={breakRoomLevel}
                                    onChange={(e) =>
                                      handleUpdateCompanyOverride(comp, { breakRoom: Number(e.target.value) })
                                    }
                                    className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                                    title="Set Breakroom Upgrade Level (1 = 1 slot, 2 = 2 slots [20 Steel], 3 = 3 slots [80 Steel])"
                                  >
                                    <option value={1}>Breakroom Lvl 1 (1 Bot)</option>
                                    <option value={2}>Breakroom Lvl 2 (2 Bots)</option>
                                    <option value={3}>Breakroom Lvl 3 (3 Bots)</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCompanyOverride(comp, { hasManager: !hasManager })}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                      hasManager
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                                    }`}
                                    title="Toggle whether a trusted Manager is assigned (+5 Happiness to saddest worker & boost to top earner)"
                                  >
                                    {hasManager ? '👔 Manager Active (+5 Happy)' : 'No Manager'}
                                  </button>

                                  {employees.length < 3 && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddManualBotSlot(comp)}
                                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
                                    >
                                      + Configure Bot Slot #{employees.length + 1}
                                    </button>
                                  )}

                                  {hasOverride && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetCompanyOverride(comp._id)}
                                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition"
                                    >
                                      Reset to Live API
                                    </button>
                                  )}
                                </div>
                              </div>

                              {employees.length === 0 ? (
                                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                  <div className="space-y-1">
                                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                                      <span>Private Employee Traits Not Returned by Public War Era API</span>
                                    </div>
                                    <p className="text-slate-300 text-xs leading-relaxed">
                                      The live War Era API verified this company&apos;s infrastructure (<strong>Storage Lvl {storageLevel}</strong>, <strong>Automated Engine Lvl {autoLevel}</strong>, <strong>{reportedWorkers ?? 0} active worker(s)</strong>), but restricts private employee trait arrays on third-party queries. Click <strong>&quot;+ Configure Bot Slot #1&quot;</strong> above to simulate bot traits and wages.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleRefreshCompanies}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Re-Sync API</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {employees.map((emp, empIdx) => {
                                    const empEval = wfEval.employeeBreakdown[empIdx];
                                    const hourlyWage = Number(emp.hourlyWageBtc ?? (emp as any).wageBtc ?? 0.45);
                                    const trainUsed = Number(emp.trainingUsed ?? (emp as any).trainingSessionsUsed ?? 0);
                                    const trainMax = Number(emp.trainingPotential ?? (emp as any).trainingSessionsMax ?? 10);
                                    const isSpec = Boolean(emp.isSpecializedInGood ?? (emp as any).isSpecializedInCompanyItem ?? true);

                                    return (
                                      <div
                                        key={emp.id || `slot-${empIdx}`}
                                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs"
                                      >
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                          <div>
                                            <div className="font-bold text-white text-xs">{emp.name || `Bot Employee #${empIdx + 1}`}</div>
                                            <div className="text-[11px] font-mono text-slate-400">
                                              Age {emp.age} · {trainUsed}/{trainMax} Trainings
                                            </div>
                                          </div>
                                          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-black">
                                            {(empEval?.effectivePP ?? 0).toFixed(1)} PP/hr
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                          <div>
                                            <label className="text-slate-400 block mb-0.5">Age</label>
                                            <input
                                              type="number"
                                              min={18}
                                              max={75}
                                              value={emp.age}
                                              onChange={(e) => {
                                                const next = employees.map((item, i) =>
                                                  i === empIdx ? { ...item, age: Number(e.target.value) } : item
                                                );
                                                handleUpdateCompanyOverride(comp, { employees: next });
                                              }}
                                              className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-slate-400 block mb-0.5">Happy</label>
                                            <input
                                              type="number"
                                              min={0}
                                              max={100}
                                              value={emp.happiness}
                                              onChange={(e) => {
                                                const next = employees.map((item, i) =>
                                                  i === empIdx ? { ...item, happiness: Number(e.target.value) } : item
                                                );
                                                handleUpdateCompanyOverride(comp, { employees: next });
                                              }}
                                              className={`w-full px-2 py-1 bg-slate-950 border rounded font-mono ${
                                                emp.happiness < 30 ? 'border-rose-500 text-rose-400' : 'border-slate-800 text-emerald-300'
                                              }`}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-slate-400 block mb-0.5">Wage/hr</label>
                                            <input
                                              type="number"
                                              step="0.05"
                                              min={0.05}
                                              value={hourlyWage}
                                              onChange={(e) => {
                                                const next = employees.map((item, i) =>
                                                  i === empIdx ? { ...item, hourlyWageBtc: Number(e.target.value) } : item
                                                );
                                                handleUpdateCompanyOverride(comp, { employees: next });
                                              }}
                                              className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-amber-300 font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(emp.hasTool)}
                                              onChange={(e) => {
                                                const next = employees.map((item, i) =>
                                                  i === empIdx ? { ...item, hasTool: e.target.checked } : item
                                                );
                                                handleUpdateCompanyOverride(comp, { employees: next });
                                              }}
                                              className="rounded accent-amber-500"
                                            />
                                            <span>Equipped Tool</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isSpec}
                                              onChange={(e) => {
                                                const next = employees.map((item, i) =>
                                                  i === empIdx
                                                    ? { ...item, isSpecializedInGood: e.target.checked }
                                                    : item
                                                );
                                                handleUpdateCompanyOverride(comp, { employees: next });
                                              }}
                                              className="rounded accent-emerald-500"
                                            />
                                            <span>Specialized</span>
                                          </label>
                                        </div>

                                        {/* 3 Trait Dropdowns */}
                                        <div className="space-y-1.5 pt-1 border-t border-slate-800">
                                          {[0, 1, 2].map((slotIdx) => {
                                            const selectedTrait = (emp.traits || [])[slotIdx] || '';
                                            return (
                                              <select
                                                key={slotIdx}
                                                value={selectedTrait}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  const next = employees.map((item, i) => {
                                                    if (i !== empIdx) return item;
                                                    const updatedTraits = [...(item.traits || [])];
                                                    if (!val) {
                                                      updatedTraits.splice(slotIdx, 1);
                                                    } else {
                                                      updatedTraits[slotIdx] = val as EmployeeTraitId;
                                                    }
                                                    const unique = Array.from(new Set(updatedTraits.filter(Boolean))) as EmployeeTraitId[];
                                                    return { ...item, traits: unique.slice(0, 3) };
                                                  });
                                                  handleUpdateCompanyOverride(comp, { employees: next });
                                                }}
                                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:border-amber-500"
                                              >
                                                <option value="">— Trait Slot #{slotIdx + 1} —</option>
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
                                            );
                                          })}
                                        </div>

                                        {/* Synergies & Warnings */}
                                        {empEval && (
                                          <div className="space-y-1 pt-1">
                                            {empEval.activeSynergies.map((syn, sIdx) => (
                                              <div key={sIdx} className="text-[11px] font-mono text-emerald-300">
                                                ✓ {syn}
                                              </div>
                                            ))}
                                            {empEval.warnings.map((w, wIdx) => (
                                              <div key={wIdx} className="text-[11px] font-mono text-rose-300">
                                                ⚠️ {w}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-950 border border-amber-500/30 rounded-2xl text-center space-y-3">
                    <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {liveCompanies.length === 0 && (currentProfile.companiesCount || 0) > 0
                          ? `Live Company Records Not Yet Synced (Profile Reports ${currentProfile.companiesCount} Owned Companies)`
                          : 'No Live Company Records Returned by War Era API'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                      Zero fabricated or estimated companies are displayed. Click below to query the live War Era API (`company.getCompanies` &amp; `company.getById`) for verified company infrastructure and upgrades.
                    </p>
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={handleRefreshCompanies}
                        disabled={isLoadingCompanies}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition shadow-md disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCompanies ? 'animate-spin' : ''}`} />
                        <span>{isLoadingCompanies ? 'Querying War Era API...' : 'Sync Live Companies Now'}</span>
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </details>
            </div>
          )}

          {/* TAB 4: MILITARY DEFENSE */}
          {activeTab === 'defense' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-white text-xs uppercase tracking-wider">
                    <Swords className="w-4 h-4 text-rose-400" /> Frontline Combat &amp; Battlefield Defense
                  </span>
                  <div className="flex items-center gap-2">
                    {isSyncingLedger && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing military records...
                      </span>
                    )}
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isCombatPolicyActive
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isCombatPolicyActive ? 'Combat Credit Conversion: ACTIVE' : 'Combat Credit Conversion: INACTIVE'}
                    </span>
                  </div>
                </div>

                {/* 30-Day Snapshot Honest Notice when 30D is selected */}
                {auditPeriodDays === 30 && (
                  has30DaySnapshots && snapshot30DayDamage !== null ? (
                    <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-1.5 text-xs font-mono">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>30-Day Combat Log Verified from Snapshots</span>
                      </div>
                      <p className="text-slate-300 font-sans text-[11px]">
                        Exact 30-day combat damage calculated from {snapshots.length} historical snapshots spanning {formatDateDDMMYYYY(snapshots[0].timestamp)} to {formatDateDDMMYYYY(snapshots[snapshots.length - 1].timestamp)}.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-900 border border-amber-800/40 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-400 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>30-Day Combat Data Notice</span>
                      </div>
                      <p className="text-slate-300 font-sans leading-relaxed text-[11px]">
                        Only weekly damage is provided by the API. The APP saves snapshots of each user as you audit them. Once enough snapshots are provided to calculate a 30 day damage log, they will be displayed here.
                      </p>
                      <div className="flex items-center gap-3 pt-1 border-t border-slate-800/80 font-mono text-[10px] text-slate-400 flex-wrap">
                        <span>Recorded Snapshots for Citizen: <strong className="text-cyan-400">{snapshots.length}</strong></span>
                        {snapshots.length > 0 && (
                          <span>First Snapshot: <strong className="text-slate-200">{formatDateDDMMYYYY(snapshots[0].timestamp)}</strong></span>
                        )}
                        <span>Active War Tournament Cycle: <strong className="text-white">7 Days</strong></span>
                      </div>
                    </div>
                  )
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative">
                    <div className="text-[10px] text-slate-400 font-sans">
                      {auditPeriodDays === 30 && has30DaySnapshots ? '30-Day Snapshot Combat Output' : '7-Day War Tournament Output'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="text-lg font-black text-white">
                        {auditPeriodDays === 30 && has30DaySnapshots && snapshot30DayDamage !== null
                          ? `${snapshot30DayDamage.toLocaleString()} DMG`
                          : `${combatDamage.toLocaleString()} DMG`}
                      </div>
                      {isSyncingLedger && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                      {auditPeriodDays === 30 && has30DaySnapshots
                        ? 'Computed from historical audit snapshots'
                        : 'Weekly tournament ranking cycle'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative">
                    <div className="text-[10px] text-slate-400 font-sans">Converted Military Credit</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="text-lg font-black text-rose-300">
                        +{formatBtc(militaryCredit)} BTC
                      </div>
                      {isSyncingLedger && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                      {`Calibrated at ${militaryCreditRate} BTC per 1,000 DMG`}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-sans">Total National Contribution</div>
                    <div className="text-lg font-black text-emerald-300 mt-0.5">
                      +{formatBtc(totalSovereignContribution)} BTC
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                      Direct BTC donations + combat credit
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Fighters deployed to sovereign battlefields spend substantial liquid BTC on munitions, armor, and weapons. Frontline soldiers dealing high combat damage are recognized through military defense credits against national ministerial quotas.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between rounded-b-3xl">
          <div className="text-[11px] text-slate-400 font-mono">
            <span>Audit Baseline:</span> <strong className="text-slate-200">{currentProfile.auditBaselineStatus === 'audited' ? `${auditPeriodDays}D Verified Receipts` : 'Day-1 Provisional Baseline'}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            {onOpenNudge && (
              <button
                type="button"
                onClick={() => onOpenNudge(currentProfile)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                title="Generate pre-formatted in-game telegram"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Nudge</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              Close Audit
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Forensic Calculation Explainer Dialog */}
      {activeExplainerCard && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveExplainerCard(null);
            }
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Explainer Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {(activeExplainerCard === 'netCashflow' || activeExplainerCard === 'disposableCashflow') && 'Net Cashflow'}
                    {activeExplainerCard === 'grossInflow' && 'Gross Cash Inflow'}
                    {activeExplainerCard === 'treasuryContribution' && 'Period Treasury Contribution'}
                    {activeExplainerCard === 'wages' && 'Wages Earned (Labor Salary)'}
                    {activeExplainerCard === 'sales' && 'Market Sales Turnover'}
                    {activeExplainerCard === 'purchases' && 'Market Sourcing Purchases'}
                    {activeExplainerCard === 'tradingMargin' && 'Net Trading Balance'}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Calculation Methodology &amp; Mathematical Reconciliation ({auditPeriodDays}-Day Window)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveExplainerCard(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. NET CASHFLOW */}
            {(activeExplainerCard === 'netCashflow' || activeExplainerCard === 'disposableCashflow') && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-emerald-300 font-bold">Calculated Net Cashflow:</span>
                  <span className="text-lg font-black text-emerald-400">{formatBtc(netDisposableIncome)} BTC</span>
                </div>

                {/* Plain-English Definition & Wallet Balance Clarification */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Why is this {formatBtc(netDisposableIncome)} BTC when their wallet has {formatBtc(liquidBtc)} BTC?</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Net Cashflow measures the net liquid BTC gained or lost from all verified transactions timestamped strictly within this <strong>{auditPeriodDays}-day audit window</strong>. It computes incoming revenue (wages, sales, tips) minus outgoing expenses (purchases, payroll, crafting fees).
                  </p>
                  <div className="space-y-1.5 text-slate-400 font-sans pt-1">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>
                        <strong className="text-slate-200">Current Wallet Balance ({formatBtc(liquidBtc)} BTC):</strong> The static amount of BTC currently stored in this citizen's wallet right now, as reported by the game profile.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>
                        <strong className="text-slate-200">Audit Window Net Cashflow ({formatBtc(netDisposableIncome)} BTC):</strong> The net cashflow generated strictly within the active {auditPeriodDays}-day audit window from labor wages, market sales, and expenses.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Itemized Formula */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
                  <div className="text-slate-400 font-bold uppercase tracking-wider font-sans text-xs">
                    Step-by-Step Mathematical Reconciliation:
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>+ Wages Earned (Daily labor shifts):</span>
                    <span className="text-emerald-400 font-bold">+{formatBtc(wagesEarned)} BTC</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>+ Market Sales Turnover (Commodities &amp; Gear):</span>
                    <span className="text-emerald-400 font-bold">+{formatBtc(salesVolume)} BTC</span>
                  </div>
                  {tipsReceived > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>+ Article Journalism Tips Received:</span>
                      <span className="text-emerald-400 font-bold">+{formatBtc(tipsReceived)} BTC</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>- Market Sourcing Purchases:</span>
                    <span className="text-rose-400 font-bold">-{formatBtc(purchasesVolume)} BTC</span>
                  </div>
                  {wagesPaid > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Employee Payroll Wages Paid Out:</span>
                      <span className="text-rose-400 font-bold">-{formatBtc(wagesPaid)} BTC</span>
                    </div>
                  )}
                  {craftingExpenses > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Gear Crafting &amp; Dismantle Fees:</span>
                      <span className="text-rose-400 font-bold">-{formatBtc(craftingExpenses)} BTC</span>
                    </div>
                  )}
                  {applicationFees > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Application &amp; Registration Fees:</span>
                      <span className="text-rose-400 font-bold">-{formatBtc(applicationFees)} BTC</span>
                    </div>
                  )}
                  {tipsSent > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Journalism Tips Sent:</span>
                      <span className="text-rose-400 font-bold">-{formatBtc(tipsSent)} BTC</span>
                    </div>
                  )}
                  {periodDonated > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Country Treasury Donations:</span>
                      <span className="text-amber-400 font-bold">-{formatBtc(periodDonated)} BTC</span>
                    </div>
                  )}
                  {muDonated > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>- Military Unit Donations (Cashflow Only):</span>
                      <span className="text-rose-400 font-bold">-{formatBtc(muDonated)} BTC</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-xs">
                    <span>= Net Cashflow:</span>
                    <span className={netDisposableIncome >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                      ={formatBtc(netDisposableIncome)} BTC
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GROSS CASH INFLOW */}
            {activeExplainerCard === 'grossInflow' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-cyan-300 font-bold">Total Gross Cash Inflow:</span>
                  <span className="text-lg font-black text-cyan-400">{formatBtc(grossIncome)} BTC</span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Definition</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Gross Cash Inflow represents the total incoming BTC collected by this citizen during the {auditPeriodDays}-day window (wages, commodity/gear sales, and article tips) before deducting market purchases, payroll, or crafting fees.
                  </p>
                  <p className="text-amber-300 text-[11px] font-sans pt-1">
                    <strong>Note on Donations:</strong> In War Era, citizen donations are voluntary contributions tithed out to the national treasury, military units, or political parties — they are outlays deducted from a citizen's wallet, not incoming revenue.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
                  <div className="text-slate-400 font-bold uppercase tracking-wider font-sans text-xs">
                    Inflow Stream Aggregation:
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>+ Wages Earned (Daily shifts):</span>
                    <span className="text-cyan-400 font-bold">+{formatBtc(wagesEarned)} BTC</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>+ Market Sales Turnover (Commodities &amp; Gear):</span>
                    <span className="text-cyan-400 font-bold">+{formatBtc(salesVolume)} BTC</span>
                  </div>
                  {tipsReceived > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>+ Journalism Tips Received:</span>
                      <span className="text-cyan-400 font-bold">+{formatBtc(tipsReceived)} BTC</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-xs">
                    <span>= Total Gross Inflow:</span>
                    <span className="text-cyan-300">={formatBtc(grossIncome)} BTC</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TREASURY CONTRIBUTION */}
            {activeExplainerCard === 'treasuryContribution' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-amber-300 font-bold">Period Treasury Donations:</span>
                  <span className="text-lg font-black text-amber-400">{formatBtc(periodDonated)} BTC</span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Civic Contribution Overview</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Measures direct BTC tithed to the national treasury during the active {auditPeriodDays}-day cycle. In War Era, donations are voluntary transfers from a citizen to their country, military unit, or political party.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
                  <div className="text-slate-400 font-bold uppercase tracking-wider font-sans text-xs">
                    Contribution Metrics:
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Period Donations Tithed:</span>
                    <span className="text-amber-400 font-bold">{formatBtc(periodDonated)} BTC</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Contribution Ratio:</span>
                    <span className="text-amber-300 font-bold">
                      {grossIncome > 0 ? ((periodDonated / grossIncome) * 100).toFixed(1) : 0}% of Gross Inflow
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>National Policy Minimum Quota:</span>
                    <span className="text-slate-400">{config.lowContributorIncomeRatePct ?? 2.5}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Lifetime Historical Donations:</span>
                    <span className="text-amber-400 font-bold">{formatBtc(currentProfile.totalDonatedBtc)} BTC</span>
                  </div>
                  {militaryCredit > 0 && (
                    <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                      <span>Combat Defense Credit:</span>
                      <span className="text-rose-400 font-bold">+{formatBtc(militaryCredit)} BTC</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. WAGES */}
            {activeExplainerCard === 'wages' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-emerald-300 font-bold">Wages Earned from Labor:</span>
                  <span className="text-lg font-black text-emerald-400">+{formatBtc(wagesEarned)} BTC</span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Labor Contract Mechanics</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    In War Era, citizens sign daily employment contracts to work at domestic or foreign factories. Each work shift disburses the agreed salary in BTC directly to their wallet upon shift completion.
                  </p>
                  <div className="pt-1 text-slate-400 font-mono text-[11px]">
                    Verified shifts completed in {auditPeriodDays}D window: <strong>{wagesCount}</strong>
                    {wagesCount > 0 && ` (avg ${formatBtc(wagesEarned / wagesCount)} BTC / shift)`}
                  </div>
                </div>
              </div>
            )}

            {/* 5. SALES */}
            {activeExplainerCard === 'sales' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-cyan-300 font-bold">Market Sales Turnover:</span>
                  <span className="text-lg font-black text-cyan-400">+{formatBtc(salesVolume)} BTC</span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Item Market &amp; Commodity Orders</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Turnover from open-market orders where this citizen sold commodities (Lead, Steel, Oil, Food, Munitions) or manufactured gear/weapons to other players.
                  </p>
                  <div className="pt-1 text-slate-400 font-mono text-[11px]">
                    Verified market sales completed: <strong>{salesCount} orders</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 6. PURCHASES */}
            {activeExplainerCard === 'purchases' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-rose-300 font-bold">Market Purchases Sunk Outflow:</span>
                  <span className="text-lg font-black text-rose-400">-{formatBtc(purchasesVolume)} BTC</span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Sourcing Expenses</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Total BTC spent acquiring raw materials, commodities, armor, or weapons from the open market.
                  </p>
                  <div className="pt-1 text-slate-400 font-mono text-[11px]">
                    Verified buy orders executed: <strong>{purchasesCount} orders</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 7. TRADING BALANCE */}
            {activeExplainerCard === 'tradingMargin' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-center justify-between font-mono">
                  <span className="text-amber-300 font-bold">Net Realized Trading Balance:</span>
                  <span className={`text-lg font-black ${netTradeMargin >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {netTradeMargin >= 0 ? '+' : ''}{formatBtc(netTradeMargin)} BTC
                  </span>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-white">Mathematical Difference</div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    Net Trading Balance shows the direct mathematical difference between market sales turnover and market purchases within this {auditPeriodDays}-day audit window. If purchases exceed sales, the resulting negative balance represents net BTC spent on sourcing goods.
                  </p>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span>Gross Sales Turnover:</span>
                      <span className="text-emerald-400">+{formatBtc(salesVolume)} BTC</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sourcing Purchases:</span>
                      <span className="text-rose-400">-{formatBtc(purchasesVolume)} BTC</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800 font-bold">
                      <span>= Net Realized Trading Balance:</span>
                      <span className={netTradeMargin >= 0 ? 'text-amber-300' : 'text-rose-400'}>
                        ={netTradeMargin >= 0 ? '+' : ''}{formatBtc(netTradeMargin)} BTC
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Explainer Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveExplainerCard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                Dismiss Explainer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
