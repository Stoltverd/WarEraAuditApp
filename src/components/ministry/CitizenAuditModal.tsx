import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CitizenEconomicProfile,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
  WealthSnapshot,
  CountryEconomicBenchmark,
} from '../../types/ministry';
import { WareraCompany, WareraTransaction } from '../../types/warera';
import { fetchUserCompanies, fetchUserTransactions, extractItemTimestampMs } from '../../services/apiService';
import { storage } from '../../services/storage';
import {
  calculatePlayerCashflowSummary,
  evaluateLeechTier,
  resolveMasterCitizenStanding,
} from '../../services/ministryService';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
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
} from 'lucide-react';

interface CitizenAuditModalProps {
  profile: CitizenEconomicProfile | null;
  config?: MinistryConfig;
  countryName: string;
  apiKey?: string;
  countryBenchmark?: CountryEconomicBenchmark;
  onClose: () => void;
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
  onUpdateConfig?: (updated: MinistryConfig) => void;
}

export const CitizenAuditModal: React.FC<CitizenAuditModalProps> = ({
  profile,
  config = DEFAULT_MINISTRY_CONFIG,
  countryName,
  apiKey,
  countryBenchmark,
  onClose,
  onUpdateProfile,
  onUpdateConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'transactions' | 'companies' | 'defense'>('cashflow');
  const [localProfile, setLocalProfile] = useState<CitizenEconomicProfile | null>(profile);
  const [auditPeriodDays, setAuditPeriodDays] = useState<number>(config.analysisPeriodDays || 7);
  const [activeExplainerCard, setActiveExplainerCard] = useState<
    'grossInflow' | 'netCashflow' | 'disposableCashflow' | 'treasuryContribution' | 'wages' | 'sales' | 'purchases' | 'tradingMargin' | null
  >(null);
  const autoStreamInitiatedRef = useRef<string | null>(null);

  // Industrial state
  const [liveCompanies, setLiveCompanies] = useState<WareraCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companyCommodityFilter, setCompanyCommodityFilter] = useState<string>('all');

  // Forensic Transactions state
  const [personalTransactions, setPersonalTransactions] = useState<WareraTransaction[]>([]);
  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<{ loaded: number; page: number } | null>(null);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'wage' | 'market' | 'trading' | 'donation' | 'other'>('all');
  const abortControllerRef = useRef<AbortController | null>(null);

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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [onClose]);

  // Sync state when input profile changes & load cached data
  useEffect(() => {
    setLocalProfile(profile);
    if (profile?.userId) {
      // Load cached personal transactions if present in offline storage
      storage.getUserPersonalTransactions(profile.userId).then((cached) => {
        if (cached && cached.length > 0) {
          setPersonalTransactions(cached);
        }
      });

      // Load damage and wealth snapshots for honest 30-day combat calculations
      storage.getCitizenSnapshots(profile.userId).then((list) => {
        setSnapshots(list || []);
      });
    }
  }, [profile]);

  // Load companies when modal opens or companies tab active
  useEffect(() => {
    if (localProfile?.userId) {
      setIsLoadingCompanies(true);
      fetchUserCompanies(localProfile.userId)
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

  // Automatic live receipts streaming on modal mount or citizen switch
  useEffect(() => {
    if (localProfile?.userId && apiKey && autoStreamInitiatedRef.current !== `${localProfile.userId}-${auditPeriodDays}`) {
      autoStreamInitiatedRef.current = `${localProfile.userId}-${auditPeriodDays}`;
      handleSyncLiveReceipts(auditPeriodDays);
    }
  }, [localProfile?.userId, apiKey, auditPeriodDays]);

  if (!localProfile) return null;

  const currentProfile = localProfile;
  const periodDays = auditPeriodDays;

  // Dynamically compute cashflow metrics from personal receipts according to selected window (7D vs 30D)
  const dynamicCashflow = useMemo(() => {
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
        auditPeriodDays
      );
      return res.summary;
    }
    return currentProfile.playerCashflow;
  }, [personalTransactions, auditPeriodDays, currentProfile]);

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
  const periodDonated = cashflow?.donationsGivenBtc && cashflow.donationsGivenBtc > 0
    ? cashflow.donationsGivenBtc
    : (currentProfile.periodDonatedBtc ?? currentProfile.directDonatedBtc ?? 0);
  const tipsReceived = cashflow?.tipsReceivedBtc ?? 0;
  const tipsSent = cashflow?.tipsSentBtc ?? 0;
  const craftingExpenses = (cashflow?.craftingExpensesBtc || 0) + (cashflow?.dismantleExpensesBtc || 0) + (cashflow?.caseOpeningExpensesBtc || 0);
  const applicationFees = cashflow?.applicationFeesBtc || 0;
  // Gross Cash Inflow = labor wages + market sales + tips received
  const calculatedGrossInflow = Math.round((wagesEarned + salesVolume + tipsReceived) * 100) / 100;
  // If verified personal receipts have not yet been streamed, respect the profile's unified audited gross income:
  const grossIncome = calculatedGrossInflow > 0
    ? calculatedGrossInflow
    : (typeof currentProfile.grossIncomeBtc === 'number' && currentProfile.grossIncomeBtc > 0
        ? currentProfile.grossIncomeBtc
        : Math.round((periodDonated + 20) * 100) / 100);
  // Net Disposable Cashflow = Gross Inflow minus Purchases minus Employer Payroll minus Crafting/Fees
  const netDisposableIncome = calculatedGrossInflow > 0
    ? Math.round((calculatedGrossInflow - purchasesVolume - wagesPaid - craftingExpenses - applicationFees) * 100) / 100
    : grossIncome;

  // Capital Balance Sheet Assets
  const liquidBtc = typeof currentProfile.liquidBtc === 'number' && currentProfile.liquidBtc >= 0
    ? currentProfile.liquidBtc
    : (currentProfile.wealthBtc > 0 ? currentProfile.wealthBtc : 0);
  const totalWealth = currentProfile.wealthBtc;
  const resourceWealth = currentProfile.resourceWealthBtc || 0;
  const companiesWealth = currentProfile.companiesWealthBtc || 0;
  const equipmentsWealth = (currentProfile.equipmentsWealthBtc || 0) + (currentProfile.weaponsWealthBtc || 0);

  // Standing & Solvency
  const standing = currentProfile.economicStanding || resolveMasterCitizenStanding(
    currentProfile.leechTier,
    currentProfile.ministerialVerdict,
    currentProfile.isHistoricalTopDonor,
    currentProfile.isNationalHeavyHitter
  );

  // Defense metrics
  const isCombatPolicyActive = Boolean(config.includeDamageInLeechCalculation);
  const combatDamage = currentProfile.totalCombatDamage || 0;
  const militaryCreditRate = config.damageConversionRateBtcPer1k ?? 0.08;
  const militaryCredit = typeof currentProfile.damageValueBtc === 'number' ? currentProfile.damageValueBtc : 0;
  const totalSovereignContribution = periodDonated + militaryCredit;

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

      setPersonalTransactions((prev) => {
        const map = new Map<string, WareraTransaction>();
        for (const tx of prev) if (tx?._id) map.set(tx._id, tx);
        for (const tx of personalTxs) if (tx?._id) map.set(tx._id, tx);
        return Array.from(map.values());
      });

      if (personalTxs.length === 0) {
        setSyncStatusMsg(`Queried personal stream: 0 receipts found for this ${windowDays}D period.`);
      } else {
        await storage.saveUserPersonalTransactions(currentProfile.userId, personalTxs);

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

        const recalculated = calculatePlayerCashflowSummary(
          currentProfile.userId,
          reconstructedUser,
          personalTxs,
          windowDays
        );
        const newWages = recalculated.summary.wagesEarnedBtc;
        const newSales = recalculated.summary.salesVolumeBtc;
        const newTips = recalculated.summary.tipsReceivedBtc || 0;
        // Gross Cash Inflow = wages earned + market sales + tips (matches top Gross Cash Inflow card exactly)
        const verifiedGrossInflow = Math.round((newWages + newSales + newTips) * 100) / 100;
        const newPeriodDonated = recalculated.summary.donationsGivenBtc > 0 ? recalculated.summary.donationsGivenBtc : periodDonated;
        const newGross = Math.max(verifiedGrossInflow, newPeriodDonated);
        const verifiedRatio = newGross > 0 ? Math.round((newPeriodDonated / newGross) * 1000) / 10 : 0;

        const currentWealthBasis = currentProfile.wealthBtc + (currentProfile.resourceWealthBtc || 0);
        const tierEval = evaluateLeechTier(
          currentWealthBasis,
          newPeriodDonated,
          { ...config, analysisPeriodDays: windowDays },
          newGross,
          currentProfile.playstyle,
          currentProfile.totalDonatedBtc,
          currentProfile.resourceWealthBtc,
          currentProfile.totalCombatDamage,
          currentProfile.isHistoricalTopDonor,
          currentProfile.historicalRank,
          currentProfile.isNationalHeavyHitter,
          currentProfile.heavyHitterRank,
          countryBenchmark
        );

        const newStanding = resolveMasterCitizenStanding(
          tierEval.tier,
          recalculated.summary.ministerialVerdict,
          currentProfile.isHistoricalTopDonor,
          currentProfile.isNationalHeavyHitter
        );

        const updatedProfile: CitizenEconomicProfile = {
          ...currentProfile,
          playerCashflow: recalculated.summary,
          grossIncomeBtc: newGross,
          grossInflowBtc: verifiedGrossInflow,
          netCashflowBtc: recalculated.summary.netCashflowBtc ?? recalculated.summary.netDisposableIncomeBtc,
          periodDonatedBtc: newPeriodDonated,
          directDonatedBtc: newPeriodDonated,
          contributionRatio: verifiedRatio,
          leechTier: tierEval.tier,
          economicStanding: newStanding,
          damageValueBtc: tierEval.damageValueBtc,
          tierReasonBadge: tierEval.reason || currentProfile.tierReasonBadge,
          ministerialVerdict: recalculated.summary.ministerialVerdict || currentProfile.ministerialVerdict,
          ministerialVerdictReason: recalculated.summary.ministerialVerdictReason || currentProfile.ministerialVerdictReason,
          companiesCount: recalculated.companiesCount,
          activeCompaniesCount: recalculated.activeCompaniesCount,
          auditBaselineStatus: 'audited',
          auditedAt: new Date().toISOString(),
          receiptCount: personalTxs.length,
          auditMethodologyNote: `Verified via ${personalTxs.length} live in-game personal receipts (${windowDays}D window).`,
        };

        setLocalProfile(updatedProfile);
        onUpdateProfile?.(updatedProfile);
        setSyncStatusMsg(`Successfully streamed ${personalTxs.length} verified receipts (${recalculated.summary.wagesCount} wage shifts, ${recalculated.summary.salesCount} market sales across ${windowDays}D)!`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setSyncStatusMsg('Stream paused by user.');
      } else {
        setSyncStatusMsg(`Sync notice: ${err.message || 'Stream interrupted'}`);
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
    return personalTransactions.filter((tx) => {
      if (!tx) return false;
      const t = extractItemTimestampMs(tx);
      if (isNaN(t)) {
        // Undated transactions only qualify for broad 30D window, never 7D
        return auditPeriodDays >= 30;
      }
      return t >= activeCutoffTime;
    });
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
      if (!tx) continue;
      const t = (tx.transactionType || '').toLowerCase();
      const amt = Number(tx.money || tx.amount || 0);
      // Suppress zero-BTC non-monetary operations (e.g. dismantling items or crafting with 0 BTC)
      if (amt === 0 && (t.includes('dismantle') || t.includes('craft') || t.includes('upgrade'))) continue;

      all++;
      if (t.includes('wage') || t.includes('work') || t.includes('salary')) {
        wage++;
      } else if (t.includes('itemmarket') || t.includes('item_market')) {
        market++;
      } else if (t.includes('trading') || t === 'trade' || (t.includes('market') && !t.includes('item'))) {
        trading++;
      } else if (t.includes('donat')) {
        donation++;
      } else {
        other++;
      }
    }
    return { all, wage, trading, market, donation, other };
  }, [timeframeTransactions]);

  // Filtered transactions for the Forensic Ledger Tab within active timeframe
  const filteredTransactions = useMemo(() => {
    return timeframeTransactions.filter((tx) => {
      if (!tx) return false;
      const txType = (tx.transactionType || '').toLowerCase();
      const amt = Number(tx.money || tx.amount || 0);
      // Suppress zero-BTC non-monetary operations from standard financial ledger
      if (amt === 0 && (txType.includes('dismantle') || txType.includes('craft') || txType.includes('upgrade'))) {
        return false;
      }
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
        const isKnown =
          txType.includes('wage') || txType.includes('work') || txType.includes('salary') ||
          txType.includes('itemmarket') || txType.includes('item_market') ||
          txType.includes('trading') || txType === 'trade' || (txType.includes('market') && !txType.includes('item')) ||
          txType.includes('donat');
        if (isKnown) return false;
      }

      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const itemStr = safelyExtractItemString(tx.item || tx.resourceType).toLowerCase();
        const compStr = safelyExtractIdString(tx.companyId).toLowerCase();
        const sellerStr = safelyExtractIdString(tx.sellerId).toLowerCase();
        const buyerStr = safelyExtractIdString(tx.buyerId).toLowerCase();
        return (
          itemStr.includes(q) ||
          compStr.includes(q) ||
          sellerStr.includes(q) ||
          buyerStr.includes(q) ||
          txType.includes(q)
        );
      }
      return true;
    });
  }, [timeframeTransactions, txTypeFilter, txSearch]);

  // Authentic Multi-Company Aggregation for Industrial Tab
  const companiesToRender = useMemo(() => {
    type AuthenticCompany = WareraCompany & {
      isOperatingActive: boolean;
    };
    let list: AuthenticCompany[] = [];
    const activeSlots = currentProfile.activeCompaniesCount ?? 2;

    if (liveCompanies.length > 0) {
      list = liveCompanies.map((c, idx) => {
        const isOperatingActive = (c.workerCount && c.workerCount > 0) || idx < activeSlots;
        return {
          ...c,
          isOperatingActive,
        };
      });
    } else {
      const totalCount = currentProfile.companiesCount || currentProfile.activeCompaniesCount || 0;
      if (totalCount > 0) {
        const commoditiesList = ['lead', 'steel', 'oil', 'food', 'munitions', 'iron'];

        list = Array.from({ length: Math.min(totalCount, 8) }, (_, idx) => {
          const isOperatingActive = idx < activeSlots;
          const sLevel = Math.min(7, Math.max(1, (currentProfile.storageLevelEst || 5) - (idx % 2)));
          const aLevel = isOperatingActive
            ? Math.min(7, Math.max(1, (currentProfile.automationLevelEst || 7)))
            : Math.max(1, (currentProfile.automationLevelEst || 7) - 2);
          const compObj: WareraCompany = {
            _id: `comp-spec-${currentProfile.userId}-${idx}`,
            user: currentProfile.userId,
            region: currentProfile.countryName || currentProfile.countryId,
            name: `${currentProfile.username || 'Citizen'} Factory ${idx + 1}`,
            itemCode: commoditiesList[idx % commoditiesList.length],
            isFull: false,
            production: isOperatingActive ? 20 + idx * 3.5 : 12,
            activeUpgradeLevels: {
              storage: sLevel,
              automatedEngine: aLevel,
            },
            workerCount: isOperatingActive ? 2 : 0,
          };
          return {
            ...compObj,
            isOperatingActive,
          };
        });
      }
    }

    if (companyCommodityFilter !== 'all') {
      return list.filter((c) => (c.itemCode || '').toLowerCase() === companyCommodityFilter.toLowerCase());
    }
    return list;
  }, [liveCompanies, currentProfile, companyCommodityFilter]);

  const allCommodityTypes = useMemo(() => {
    const source = liveCompanies.length > 0 ? liveCompanies : (currentProfile.companiesCount ? ['lead', 'steel', 'oil', 'food', 'iron', 'munitions'] : []);
    const codes = new Set<string>();
    if (Array.isArray(source)) {
      source.forEach((c) => {
        const code = typeof c === 'string' ? c : c.itemCode;
        if (code) codes.add(code.toLowerCase());
      });
    }
    return Array.from(codes);
  }, [liveCompanies, currentProfile.companiesCount]);

  const maxStorageAcrossCompanies = useMemo(() => {
    return companiesToRender.reduce((acc, c) => Math.max(acc, c.activeUpgradeLevels?.storage || 1), 1);
  }, [companiesToRender]);

  const maxAutoAcrossCompanies = useMemo(() => {
    return companiesToRender.reduce((acc, c) => Math.max(acc, c.activeUpgradeLevels?.automatedEngine || 1), 1);
  }, [companiesToRender]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 overflow-hidden shrink-0 flex items-center justify-center font-black text-amber-300 text-xl shadow-lg">
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
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentProfile.username || `Citizen #${(currentProfile.userId || '').slice(-6)}`}
                </h3>
                {/* Unified Master Standing Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  standing === 'evader-leech'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : standing === 'subsistence-worker'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : standing === 'illiquid-fighter'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : standing === 'sovereign-patriot'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : standing === 'historical-pillar'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {standing === 'evader-leech' && '🚨 Evader / Leech'}
                  {standing === 'subsistence-worker' && '🛡️ Subsistence Worker'}
                  {standing === 'illiquid-fighter' && '🔒 Illiquid Combatant'}
                  {standing === 'sovereign-patriot' && '🌟 Sovereign Patriot'}
                  {standing === 'historical-pillar' && '🏛️ Historical Pillar'}
                  {standing === 'standard-contributor' && '🔵 Standard Contributor'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Level {currentProfile.level} · {countryName}
                </span>
              </div>

              {/* Citizen ID & Respec Tenure Subtitle */}
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono flex-wrap">
                <span className="flex items-center gap-1">
                  Citizen ID: {currentProfile.userId}
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1 hover:text-white transition rounded hover:bg-slate-800"
                    title="Copy Citizen ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </span>
                <span>·</span>
                <span className="text-cyan-400">
                  {currentProfile.playstyle === 'pure-eco' ? '🌾 Eco Build' : currentProfile.playstyle === 'pure-war' ? '⚔️ War Build' : '⚖️ Hybrid Build'}
                  {typeof currentProfile.daysInBuild === 'number' && ` · Active for ${currentProfile.daysInBuild}d (Cooldown cleared)`}
                </span>
                <span>·</span>
                <span>
                  Strategic Tag: <strong className="text-slate-200">{currentProfile.manualTag !== 'none' ? currentProfile.manualTag.toUpperCase() : 'Unassigned'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-800 pt-3 pb-2 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('cashflow')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cashflow'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Financial &amp; Solvency Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Line-Item Transaction Ledger ({timeframeTransactions.length})</span>
            {isSyncingLedger && <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'companies'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Companies ({liveCompanies.length || currentProfile.companiesCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('defense')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'defense'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Military &amp; Battlefield Defense</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: FINANCIAL & SOLVENCY AUDIT */}
          {activeTab === 'cashflow' && (
            <div className="space-y-4 animate-fade-in">
              {/* Sync Action Header */}
              {apiKey ? (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
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
                      <TrendingUp className="w-4 h-4 text-cyan-400" /> Gross Cash Inflow ({periodDays}D)
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
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-black font-mono text-cyan-300">
                      {formatBtc(grossIncome)} <span className="text-xs text-cyan-400 font-bold">BTC</span>
                    </div>
                    {isSyncingLedger && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/80 text-cyan-300 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Total BTC passing into wallet from wages, commodity/gear sales turnover, and tips.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" /> Net Cashflow ({periodDays}D)
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
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-black font-mono text-emerald-300">
                      {formatBtc(netDisposableIncome)} <span className="text-xs text-emerald-400 font-bold">BTC</span>
                    </div>
                    {isSyncingLedger && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/80 text-emerald-300 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing...
                      </span>
                    )}
                  </div>
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
                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="text-2xl font-black font-mono text-amber-300">
                      {formatBtc(periodDonated)} <span className="text-xs text-amber-400 font-bold">BTC</span>
                    </div>
                    {isSyncingLedger && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800/80 text-amber-300 animate-pulse flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Syncing...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    {(grossIncome > 0 ? (periodDonated / grossIncome) * 100 : (currentProfile.contributionRatio || 0)).toFixed(1)}% contribution ratio · {formatBtc(currentProfile.totalDonatedBtc)} BTC lifetime
                  </p>
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
                        <span className="font-mono text-emerald-300 font-bold text-sm">+{formatBtc(wagesEarned)} BTC</span>
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
                      {wagesCount} work shifts completed. Earned from daily labor contracts.
                    </div>
                  </div>

                  {/* Wages Paid Out Stream */}
                  {wagesPaid > 0 && (
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-rose-400" /> Wages Paid (Employee Payroll)
                        </span>
                        <span className="font-mono text-rose-300 font-bold text-sm">-{formatBtc(wagesPaid)} BTC</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {wagesPaidCount} payroll disbursements to hired factory workers.
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
                        <span className="font-mono text-cyan-300 font-bold text-sm">+{formatBtc(salesVolume)} BTC</span>
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
                      {salesCount} filled orders. Converted manufactured goods (lead, steel, ammo) &amp; gear into liquid BTC.
                    </div>
                  </div>

                  {/* Market Purchases (Hoarded / Spent) */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" /> Purchases (Supplies &amp; Gear)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-rose-300 font-bold text-sm">-{formatBtc(purchasesVolume)} BTC</span>
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
                      {purchasesCount} filled purchase orders. BTC spent buying resources or equipment.
                    </div>
                  </div>

                  {/* Net Realized Trade Balance */}
                  <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /> Net Trading Balance
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-sm ${netTradeMargin >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                          {netTradeMargin >= 0 ? '+' : ''}{formatBtc(netTradeMargin)} BTC
                        </span>
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
                        <span className="font-mono text-indigo-300 font-bold text-sm">
                          {tipsReceived > craftingExpenses ? '+' : ''}{formatBtc(tipsReceived - craftingExpenses)} BTC
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tips: +{formatBtc(tipsReceived)} BTC · Crafting/cases: -{formatBtc(craftingExpenses)} BTC
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
                    <span>Balance Sheet Portfolio (Total Net Worth: {formatBtc(totalWealth)} BTC)</span>
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
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">{liveCompanies.length || currentProfile.companiesCount || 0} companies owned</div>
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
                    All ({tabCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('wage')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'wage' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-950/40'
                    }`}
                  >
                    Wages ({tabCounts.wage})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('trading')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'trading' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-cyan-400 border border-cyan-900/40 hover:bg-cyan-950/40'
                    }`}
                  >
                    Trading Commodities ({tabCounts.trading})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('market')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'market' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-950 text-indigo-400 border border-indigo-900/40 hover:bg-indigo-950/40'
                    }`}
                  >
                    Item Market ({tabCounts.market})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('donation')}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      txTypeFilter === 'donation' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-950 text-amber-400 border border-amber-900/40 hover:bg-amber-950/40'
                    }`}
                  >
                    Donations ({tabCounts.donation})
                  </button>
                  {tabCounts.other > 0 && (
                    <button
                      type="button"
                      onClick={() => setTxTypeFilter('other')}
                      className={`px-3 py-1 rounded-xl font-bold transition ${
                        txTypeFilter === 'other' ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-950 text-purple-400 border border-purple-900/40 hover:bg-purple-950/40'
                      }`}
                    >
                      Tips &amp; Fees ({tabCounts.other})
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

                  <div className="relative w-44 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search item, ID..."
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

              {/* Color Representation Legend */}
              <div className="flex items-center gap-3 text-[11px] font-mono bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 flex-wrap">
                <span className="text-slate-400 font-sans font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400" /> Color Guide:
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  + Inflow (Wages, Sales, Tips)
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  - Outflow (Purchases, Payroll, Fees)
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Tithes (Treasury / Military Donations)
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  Neutral / Admin
                </span>
              </div>

              {/* Transactions Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-mono sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Date / Time</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Item / Resource</th>
                        <th className="py-2.5 px-3 text-right">Amount (BTC)</th>
                        <th className="py-2.5 px-3">Counterparty / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {isSyncingLedger && (
                        <tr className="bg-cyan-950/40 border-b border-cyan-800/40 text-cyan-300 font-mono text-xs">
                          <td colSpan={6} className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-2">
                              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                              <span>Live streaming and verifying in-game receipts ({timeframeTransactions.length} receipts verified for {auditPeriodDays}D window)...</span>
                            </span>
                          </td>
                        </tr>
                      )}
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-sans">
                            {timeframeTransactions.length === 0
                              ? `No receipts found within the active ${auditPeriodDays}-day timeframe. Click "Stream Live In-Game Receipts" to refresh history.`
                              : 'No transactions match the selected filter criteria.'}
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((tx, idx) => {
                          if (!tx) return null;
                          const amt = isNaN(Number(tx.money || tx.amount || 0)) ? 0 : Number(tx.money || tx.amount || 0);
                          const rawType = String(tx.transactionType || '');
                          const typeLower = rawType.toLowerCase();
                          const isWage = typeLower.includes('wage') || typeLower.includes('salary');

                          const sellerStr = safelyExtractIdString(tx.sellerId);
                          const buyerStr = safelyExtractIdString(tx.buyerId);
                          const recipientStr = safelyExtractIdString(tx.recipientId);
                          const senderStr = safelyExtractIdString(tx.senderId);
                          const companyStr = safelyExtractIdString(tx.companyId);

                          const isSeller = sellerStr === currentProfile.userId;
                          const isBuyer = buyerStr === currentProfile.userId;
                          const isDonation = typeLower.includes('donat');
                          const dateStr = tx.createdAt
                            ? formatDateDDMMYYYY(tx.createdAt, 'Recent')
                            : 'Recent';

                          // Accurately determine if wage was earned as worker or paid out as employer
                          const isEmployerWage = isWage && (buyerStr === currentProfile.userId || senderStr === currentProfile.userId || (Boolean(recipientStr) && recipientStr !== currentProfile.userId));
                          const isWorkerWage = isWage && !isEmployerWage;

                          const isPositiveInflow = isSeller || isWorkerWage || (typeLower.includes('tip') && sellerStr === currentProfile.userId);
                          const isNegativeOutflow = isBuyer || isEmployerWage || isDonation || typeLower.includes('craft') || typeLower.includes('dismantle') || typeLower.includes('case');

                          const roleLabel = isEmployerWage
                            ? 'Employer (Wage Outflow)'
                            : isWorkerWage
                            ? 'Worker (Wage Inflow)'
                            : isSeller
                            ? 'Seller (Market Inflow)'
                            : isBuyer
                            ? 'Buyer (Market Outflow)'
                            : isDonation
                            ? 'Donor (Treasury Transfer)'
                            : 'Participant';

                          const itemStr = safelyExtractItemString(tx.item || tx.resourceType);

                          return (
                            <tr key={tx._id || `tx-${idx}`} className="hover:bg-slate-900/50 transition">
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
                                  <span className="capitalize font-bold text-white flex items-center gap-1">
                                    <Package className="w-3 h-3 text-cyan-400 shrink-0" />
                                    {itemStr.replace(/_/g, ' ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-black ${
                                isPositiveInflow
                                  ? 'text-emerald-400'
                                  : isNegativeOutflow
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}>
                                {isPositiveInflow ? '+' : isNegativeOutflow ? '-' : ''}{formatBtc(amt)} BTC
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-xs font-sans">
                                {isEmployerWage && recipientStr
                                  ? `Worker: ${recipientStr.slice(-6)}`
                                  : companyStr
                                  ? `Company: ${companyStr.slice(-6)}`
                                  : sellerStr && sellerStr !== currentProfile.userId
                                  ? `Seller: ${sellerStr.slice(-6)}`
                                  : buyerStr && buyerStr !== currentProfile.userId
                                  ? `Buyer: ${buyerStr.slice(-6)}`
                                  : 'Domestic sovereign ledger'}
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

          {/* TAB 3: COMPANIES PORTFOLIO */}
          {activeTab === 'companies' && (
            <div className="space-y-4 animate-fade-in">
              {/* Aggregate Portfolio Summary */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-sans">Total Owned Companies</div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {liveCompanies.length || currentProfile.companiesCount || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                    {currentProfile.activeCompaniesCount ?? 2} / {currentProfile.maxCompaniesCap ?? 2} active slots
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-sans">Verified Company Wealth</div>
                  <div className="text-xl font-black text-indigo-300 mt-0.5">
                    {formatBtc(companiesWealth)} BTC
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">Reported in Game Profile</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-sans">Highest Storage Upgrade</div>
                  <div className="text-xl font-black text-amber-300 mt-0.5">
                    Level {maxStorageAcrossCompanies} <span className="text-xs text-slate-400 font-normal">/ 7</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">PP storage buffer</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-sans">Max Automation Engine</div>
                  <div className="text-xl font-black text-cyan-300 mt-0.5">
                    Level {maxAutoAcrossCompanies} <span className="text-xs text-slate-400 font-normal">/ 7</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">Peak engine upgrade</div>
                </div>
              </div>

              {/* Itemized Multi-Company Cards Deck */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Registered Companies &amp; Upgrade Inspection</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
                      {companiesToRender.length} Verified Companies
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRefreshCompanies}
                      disabled={isLoadingCompanies}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50 font-sans"
                      title="Fetch live company and upgrade records from War Era"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoadingCompanies ? 'animate-spin' : ''}`} />
                      <span>{isLoadingCompanies ? 'Refreshing...' : 'Refresh Companies'}</span>
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
                            {code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isLoadingCompanies ? (
                  <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 animate-pulse">
                    Retrieving verified company records from War Era server...
                  </div>
                ) : companiesToRender.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {companiesToRender.map((comp) => {
                      const storageLevel = comp.activeUpgradeLevels?.storage ?? 1;
                      const autoLevel = comp.activeUpgradeLevels?.automatedEngine ?? 1;

                      return (
                        <div
                          key={comp._id}
                          className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 hover:border-slate-700 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  comp.isOperatingActive
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${comp.isOperatingActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                  {comp.isOperatingActive ? 'Active Production Slot' : 'Reserve / Idle Company'}
                                </span>
                                {comp.workerCount !== undefined && comp.workerCount > 0 && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {comp.workerCount} Active Worker{comp.workerCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span>{comp.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-mono font-bold">
                                  {comp.itemCode}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Company ID: {String(comp._id || '').slice(-6) || 'N/A'} · Territory: {comp.region || currentProfile.countryName || 'Active'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${
                                comp.isOperatingActive
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                {comp.isOperatingActive ? '⚡ Operating' : '💤 Idle'}
                              </span>
                            </div>
                          </div>

                          {/* Authentic In-Game Upgrades Grid */}
                          <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                              <div className="text-[9px] text-slate-400 font-sans">Storage Limit</div>
                              <div className="font-black text-amber-300 mt-0.5">
                                Lv {storageLevel} <span className="text-[9px] text-slate-500 font-normal">/ 7</span>
                              </div>
                              <div className="text-[8px] text-slate-500 font-sans mt-0.5">PP Buffer Cap</div>
                            </div>

                            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                              <div className="text-[9px] text-slate-400 font-sans">Automation Engine</div>
                              <div className="font-black text-cyan-300 mt-0.5">
                                Lv {autoLevel} <span className="text-[9px] text-slate-500 font-normal">/ 7</span>
                              </div>
                              <div className="text-[8px] text-cyan-500 font-sans mt-0.5">PP Gen / hr</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                    No company entities registered directly to this user ID. Industrial equity is derived from general asset valuation.
                  </div>
                )}
              </div>
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
                      Calibrated at {militaryCreditRate} BTC per 1,000 DMG
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
            Audit Baseline: <strong className="text-slate-200">{currentProfile.auditBaselineStatus === 'audited' ? `${auditPeriodDays}D Verified Receipts` : 'Day-1 Provisional Baseline'}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Close Audit
          </button>
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
