/**
 * War Era Country Donation Rankings & Citizen Leaderboard
 * Live ranking engine for country donations in War Era BTC across Daily, Weekly, and Monthly periods.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  normalizeCountryId,
} from './services/rankingService';
import { Header } from './components/Header';
import { RankingStats } from './components/RankingStats';
import { Podium } from './components/Podium';
import { LeaderboardTable } from './components/LeaderboardTable';
import { CitizenDetailModal } from './components/CitizenDetailModal';
import { ExportModal } from './components/ExportModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { MinistryWorkspace } from './components/ministry/MinistryWorkspace';
import {
  CitizenEconomicProfile,
  NationalTransaction,
  ResourceReserveItem,
  RespecAlert,
  PlayerTag,
  MinistryConfig,
  WatchedCitizen,
  DEFAULT_MINISTRY_CONFIG,
} from './types/ministry';
import {
  calculateWarSkillPoints,
  calculateEcoSkillPoints,
  calculateDaysInBuild,
  evaluatePlaystyle,
  evaluateLeechTier,
  calculateCountryEconomicBenchmark,
  synthesizeCountryMinistryConfig,
  auditCitizensIncomeGrowth,
  detectCitizenRespecAlerts,
  DEFAULT_COMMODITIES,
  DEFAULT_STOCKPILES,
} from './services/ministryService';
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
  const [selectedCountry, setSelectedCountry] = useState<WareraCountry | null>(() => storage.getLastViewedCountry());
  const [transactions, setTransactions] = useState<WareraTransaction[]>([]);
  const [cumulative, setCumulative] = useState<WareraCumulativeDonation[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, WareraUserLite>>({});

  const [timeframe, setTimeframe] = useState<RankingTimeframe>('daily');
  const [apiKey, setApiKey] = useState<string>(() => storage.getApiKey());
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
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
  const [damageRateInput, setDamageRateInput] = useState<string>('0.08');
  const [appliedDamageConfig, setAppliedDamageConfig] = useState<DamageDonationConfig>({
    enabled: false,
    ratePer1k: 0.08,
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

  // Mode Switcher: Leaderboard vs Ministry of Economy
  const [activeMode, setActiveMode] = useState<'leaderboard' | 'ministry'>('leaderboard');

  // Ministry of Economy State
  const [playerTags, setPlayerTags] = useState<Record<string, { tag: PlayerTag; notes?: string }>>({});
  const [nationalTransactions, setNationalTransactions] = useState<NationalTransaction[]>([]);
  const [stockpiles, setStockpiles] = useState<ResourceReserveItem[]>(DEFAULT_STOCKPILES);
  const [respecAlerts, setRespecAlerts] = useState<RespecAlert[]>([]);
  const [watchedCitizens, setWatchedCitizens] = useState<WatchedCitizen[]>([]);
  const [isAuditingIncome, setIsAuditingIncome] = useState<boolean>(false);
  const [auditedProfilesMap, setAuditedProfilesMap] = useState<Record<string, CitizenEconomicProfile>>({});
  const [ministryConfig, setMinistryConfig] = useState<MinistryConfig>(DEFAULT_MINISTRY_CONFIG);

  // Sync Ministry Config and Watched Citizens when selected country changes
  useEffect(() => {
    if (selectedCountry?._id) {
      const cfg = storage.getMinistryConfig(selectedCountry._id);
      setMinistryConfig(cfg);
      storage.getWatchedCitizens(selectedCountry._id).then(setWatchedCitizens);
    } else {
      setMinistryConfig(DEFAULT_MINISTRY_CONFIG);
      storage.getWatchedCitizens().then(setWatchedCitizens);
    }
  }, [selectedCountry?._id]);

  const handlePutOnWatch = async (profile: CitizenEconomicProfile, reasonNote: string) => {
    const watched: WatchedCitizen = {
      userId: profile.userId,
      username: profile.username,
      countryId: profile.countryId,
      addedAt: new Date().toISOString(),
      reasonNote,
      wealthBtc: profile.wealthBtc,
      totalDonatedBtc: profile.totalDonatedBtc,
      contributionRatio: profile.contributionRatio,
      playstyle: profile.playstyle,
      avatarUrl: profile.avatarUrl,
    };
    await storage.saveWatchedCitizen(watched);
    setWatchedCitizens((prev) => [...prev.filter((w) => w.userId !== profile.userId), watched]);
  };

  const handleRemoveFromWatch = async (userId: string) => {
    await storage.removeWatchedCitizen(userId);
    setWatchedCitizens((prev) => prev.filter((w) => w.userId !== userId));
  };

  // Load Ministry data from storage on startup and on country switch
  useEffect(() => {
    async function loadMinistryData() {
      try {
        const countryId = selectedCountry?._id;
        const [tags, txs, stocks, alerts, watched] = await Promise.all([
          storage.getPlayerTags(),
          storage.getNationalTransactions(countryId),
          storage.getStockpiles(countryId),
          storage.getRespecAlerts(),
          storage.getWatchedCitizens(countryId),
        ]);
        setPlayerTags(tags);
        setNationalTransactions(txs);
        setStockpiles(stocks && stocks.length > 0 ? stocks : DEFAULT_STOCKPILES);
        if (alerts.length > 0) setRespecAlerts(alerts);
        setWatchedCitizens(watched);
      } catch (err) {
        console.warn('Failed to load ministry state from storage:', err);
      }
    }
    loadMinistryData();
  }, [selectedCountry?._id]);

  // Load countries on startup and restore/reconcile last viewed country
  useEffect(() => {
    async function loadCountryList() {
      try {
        const list = await getCountries();
        setCountries(list);

        // Reconcile or auto-select last viewed country
        const lastSaved = storage.getLastViewedCountry();
        if (lastSaved?._id) {
          const matched = list.find((c) => c._id === lastSaved._id);
          if (matched) {
            setSelectedCountry(matched);
            storage.setLastViewedCountry(matched);
          }
        } else if (list.length > 0) {
          // Default to Colombia or first nation if never previously selected
          const defaultCountry = list.find((c) => c.name.toLowerCase() === 'colombia') || list[0];
          if (defaultCountry) {
            setSelectedCountry(defaultCountry);
            storage.setLastViewedCountry(defaultCountry);
          }
        }
      } catch (err) {
        console.error('Failed to load countries:', err);
      }
    }
    loadCountryList();
  }, []);

  const syncRequestIdRef = useRef<number>(0);

  // Sync execution with race condition protection and immediate country state reset
  const executeSync = useCallback(
    async (country: WareraCountry, currentKey: string) => {
      const currentSyncId = ++syncRequestIdRef.current;
      setIsSyncing(true);
      setSyncError(null);

      // Immediately purge in-memory arrays and user registry when switching countries so records from prior nation never bleed over
      setTransactions([]);
      setCumulative([]);
      setUsersMap({});

      try {
        const result = await syncCountryData(
          country._id,
          country.name,
          currentKey,
          (progress) => {
            if (currentSyncId === syncRequestIdRef.current) {
              setSyncProgress(progress);
            }
          }
        );

        // Discard result if user switched to another country while request was in-flight
        if (currentSyncId !== syncRequestIdRef.current) return;

        setTransactions(result.transactions);
        setCumulative(result.cumulative);
        setIsGranularActive(result.isGranular);
        setUsersMap(result.users);

        // Dynamically synthesize sovereign policy defaults from live API benchmarks for this selected country
        const activeCitizens = Object.values(result.users).filter((u) => {
          if (!u || !u._id) return false;
          if (u.country && typeof u.country === 'string' && u.country !== country._id) return false;
          const isActive = Boolean(u.isActive !== undefined ? u.isActive : true);
          const lvl = Number(u.leveling?.level ?? u.level ?? 0);
          return isActive && lvl >= 10;
        });

        const cumMap = new Map<string, { totalAmount: number; lastDonationAt?: string }>();
        result.cumulative.forEach((c) => {
          if (c.userId) {
            cumMap.set(c.userId, {
              totalAmount: Number(c.amount || 0),
              lastDonationAt: c.updatedAt || c.createdAt,
            });
          }
        });

        const benchmark = calculateCountryEconomicBenchmark(country._id, activeCitizens, cumMap);
        const dynamicPolicy = synthesizeCountryMinistryConfig(benchmark, ministryConfig);
        setMinistryConfig(dynamicPolicy);
      } catch (err: any) {
        if (currentSyncId !== syncRequestIdRef.current) return;
        setSyncError(err?.message || 'Sync failed');
        // Fallback to cached
        const cachedTx = await storage.getTransactionsByCountry(country._id);
        const cachedCum = await storage.getCumulativeDonationsByCountry(country._id);
        const donorIds = [
          ...cachedTx.map((t) => t.userId),
          ...cachedCum.map((c) => c.userId),
        ].filter((id): id is string => Boolean(id));
        const cachedUsers = await storage.getUsersForCountry(country._id, donorIds);
        if (currentSyncId !== syncRequestIdRef.current) return;
        setTransactions(cachedTx);
        setCumulative(cachedCum);
        setIsGranularActive(cachedTx.length > 0);
        setUsersMap(cachedUsers);
      } finally {
        if (currentSyncId === syncRequestIdRef.current) {
          setIsSyncing(false);
          setTimeout(() => {
            if (currentSyncId === syncRequestIdRef.current) {
              setSyncProgress(null);
            }
          }, 3500);
        }
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
    } else {
      // Trigger header country selector dropdown if clicked with no country chosen
      const countryBtn = document.querySelector('header button[type="button"]') as HTMLButtonElement;
      countryBtn?.click();
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
    const targetCountryId = selectedCountry?._id;

    // 1. If timeframe is 'all', always use the complete All-Time cumulative ledger
    if (timeframe === 'all' && cumulative.length > 0) {
      return calculateCumulativeRankings(
        cumulative,
        usersMap,
        appliedDamageConfig,
        'all',
        undefined,
        targetCountryId,
        transactions
      );
    }

    // 2. For Daily, Weekly, Monthly, and Custom Range, use the granular transaction stream
    if (transactions.length > 0) {
      return calculateGranularRankings(
        transactions,
        usersMap,
        timeframe,
        customRange,
        appliedDamageConfig,
        targetCountryId,
        cumulative
      );
    }

    // 3. If no API key or no granular data, fallback to cumulative ledger with active timeframe
    if (cumulative.length > 0) {
      return calculateCumulativeRankings(
        cumulative,
        usersMap,
        appliedDamageConfig,
        timeframe,
        customRange,
        targetCountryId,
        transactions
      );
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
      medianDonationAmount: 0,
      leaderboard: [],
      isGranular: false,
      damageConfig: appliedDamageConfig,
    };
  }, [
    selectedCountry?._id,
    timeframe,
    customRange,
    isGranularActive,
    transactions,
    cumulative,
    usersMap,
    appliedDamageConfig,
  ]);

  // Verified active citizens count (level 10+ and active) for the selected country
  const totalActiveCitizens = useMemo(() => {
    if (!selectedCountry?._id) return 0;
    const countryId = selectedCountry._id;
    return Object.values(usersMap).filter((u) => {
      if (!u || !u._id) return false;
      if (u.country && typeof u.country === 'string' && u.country !== countryId) return false;
      const isActive = Boolean(u.isActive !== undefined ? u.isActive : true);
      const lvl = Number(u.leveling?.level ?? u.level ?? 0);
      return isActive && lvl >= 10;
    }).length;
  }, [usersMap, selectedCountry?._id]);

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

  // Dynamic timeframe subtitle phrase per user specification
  const timeframePhrase = useMemo(() => {
    switch (timeframe) {
      case 'daily':
        return 'in the last 24 hours';
      case 'weekly':
        return 'in the last week';
      case 'monthly':
        return 'in the last month';
      case 'custom':
        return `between ${customRange.startDate} and ${customRange.endDate}`;
      case 'all':
      default:
        return 'across all recorded history';
    }
  }, [timeframe, customRange.startDate, customRange.endDate]);

  // Ministry of Economy: Citizen Economic Profiles
  const citizenEconomicProfiles: CitizenEconomicProfile[] = useMemo(() => {
    const list: CitizenEconomicProfile[] = [];
    const countryId = selectedCountry?._id || '';
    const countryName = selectedCountry?.name || 'Country';

    const donorStatsMap: Record<string, DonorRankingItem> = {};
    summary.leaderboard.forEach((d) => {
      donorStatsMap[d.userId] = d;
    });

    // 1. Build persistent all-time cumulative donation ledger from cumulative data & transactions
    const allTimeCumulativeMap = new Map<string, { totalAmount: number; lastDonationAt?: string }>();
    cumulative.forEach((c) => {
      if (c.userId) {
        allTimeCumulativeMap.set(c.userId, {
          totalAmount: Number(c.amount || 0),
          lastDonationAt: c.updatedAt || c.createdAt,
        });
      }
    });

    // Also include transactions if they exceed or aren't present in cumulative
    transactions.forEach((tx) => {
      if (tx.userId) {
        const existing = allTimeCumulativeMap.get(tx.userId);
        const txAmt = Number(tx.money || tx.amount || 0);
        if (!existing) {
          allTimeCumulativeMap.set(tx.userId, {
            totalAmount: txAmt,
            lastDonationAt: tx.createdAt,
          });
        }
      }
    });

    // 2. Determine nation's true all-time Top Lifetime Donors (Hall of Fame)
    const historicalDonorRanks = new Map<string, number>();
    const allTimeSorted = Array.from(allTimeCumulativeMap.entries())
      .map(([uId, data]) => ({ userId: uId, totalAmount: data.totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const topCutoff = ministryConfig.topHistoricalDonorProtectionRank || 10;
    allTimeSorted.slice(0, topCutoff).forEach((entry, idx) => {
      historicalDonorRanks.set(entry.userId, idx + 1);
    });

    const watchedMap = new Map<string, WatchedCitizen>();
    watchedCitizens.forEach((w) => watchedMap.set(w.userId, w));

    // 3. Filter active citizens belonging to this country
    const activeCountryCitizens = Object.values(usersMap).filter((user) => {
      if (!user || !user._id) return false;
      if (selectedCountry) {
        const userCountryId = normalizeCountryId(user);
        if (userCountryId && userCountryId !== selectedCountry._id) {
          return false;
        }
      }
      const isActive = Boolean(user.isActive !== undefined ? user.isActive : true);
      const level = Number(user.leveling?.level ?? user.level ?? 0);
      return isActive && level >= 10;
    });

    // 4. Dynamically compute country-proportional statistical benchmarks
    const countryBenchmark = calculateCountryEconomicBenchmark(
      countryId,
      activeCountryCitizens,
      allTimeCumulativeMap
    );

    // 5. Determine country-relative Heavy Hitters in active combat mobilization
    const fightersList = activeCountryCitizens
      .map((u) => {
        const donor = donorStatsMap[u._id];
        const weeklyDmg = Number(u.rankings?.weeklyUserDamages?.value ?? (donor && timeframe !== 'all' ? donor.damageAmount : 0));
        const allTimeDmg = Number(u.rankings?.userDamages?.value ?? (u as any).stats?.damage ?? 0);
        const dmg = weeklyDmg > 0 ? weeklyDmg : allTimeDmg;
        return { userId: u._id, damage: dmg };
      })
      .filter((f) => f.damage > 0)
      .sort((a, b) => b.damage - a.damage);

    const heavyHitterCutoff = Math.max(3, Math.min(ministryConfig.topHeavyHitterRankCutoff || 10, countryBenchmark.heavyHitterCohortSize));
    const heavyHitterRanks = new Map<string, number>();
    fightersList.slice(0, heavyHitterCutoff).forEach((f, idx) => {
      heavyHitterRanks.set(f.userId, idx + 1);
    });

    activeCountryCitizens.forEach((user) => {
      const level = Number(user.leveling?.level ?? user.level ?? 0);
      const donor = donorStatsMap[user._id];
      const lifetimeData = allTimeCumulativeMap.get(user._id);

      const wealthObj = typeof user.stats?.wealth === 'object' ? user.stats.wealth : null;
      const wealth = Number(user.rankings?.userWealth?.value || wealthObj?.total || (typeof user.stats?.wealth === 'number' ? user.stats.wealth : 0));
      // Read real liquid cash directly from stats.wealth.money, falling back to user.money (never 35% estimate)
      const liquidMoney = Number(wealthObj?.money !== undefined ? wealthObj.money : (user.money ?? 0));
      const resourceWealth = Number(wealthObj?.items !== undefined ? wealthObj.items : ((user as any).resourceWealth ?? (user as any).resourcesValue ?? 0));
      const companiesWealth = Number(wealthObj?.companies ?? 0);
      const equipmentsWealth = Number(wealthObj?.equipments ?? 0);
      const weaponsWealth = Number(wealthObj?.weapons ?? 0);
      
      // Determine real period donations vs lifetime donations:
      let direct = 0;
      if (transactions && transactions.length > 0) {
        const periodMs = (ministryConfig.analysisPeriodDays || 7) * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - periodMs;
        direct = transactions
          .filter((t) => t.userId === user._id && new Date(t.createdAt).getTime() >= cutoffTime)
          .reduce((sum, t) => sum + Number(t.money || t.amount || 0), 0);
      } else if (donor && timeframe !== 'all') {
        direct = Number(donor.directAmount || 0);
      }
      const totalDonated = lifetimeData ? Number(lifetimeData.totalAmount || 0) : (donor ? Number(donor.totalAmount || 0) : 0);
      const damageDonated = donor && timeframe !== 'all' ? Number(donor.damageAmount || 0) : 0;
      // Actual verified transfer count: only counts individual transaction events if recorded
      const donationCount = donor?.transactionCount || donor?.donations?.length || 0;

      const warPoints = calculateWarSkillPoints(user);
      const ecoPoints = calculateEcoSkillPoints(user);
      const playstyle = evaluatePlaystyle(warPoints, ecoPoints);
      const daysInBuild = calculateDaysInBuild(user);
      const audited = auditedProfilesMap[user._id];
      const currentWealthBasis = (ministryConfig.includeResourceWealth && resourceWealth > 0)
        ? wealth + resourceWealth
        : wealth;

      const historicalRank = historicalDonorRanks.get(user._id);
      const isHistoricalTopDonor = Boolean(historicalRank);
      const heavyHitterRank = heavyHitterRanks.get(user._id);
      const isNationalHeavyHitter = Boolean(heavyHitterRank);

      // 7-day weekly combat damage vs career lifetime damage:
      const weeklyCombatDamage = Number(
        user.rankings?.weeklyUserDamages?.value ??
        (donor && timeframe !== 'all' ? donor.damageAmount : 0)
      );
      const lifetimeCombatDamage = Number(
        user.rankings?.userDamages?.value ??
        (user as any).stats?.damage ??
        donor?.rawDamageDealt ??
        weeklyCombatDamage
      );

      const { ratio, tier, reason, damageValueBtc } = evaluateLeechTier(
        currentWealthBasis,
        direct,
        ministryConfig,
        audited?.grossIncomeBtc,
        playstyle,
        totalDonated,
        resourceWealth,
        weeklyCombatDamage,
        isHistoricalTopDonor,
        historicalRank,
        isNationalHeavyHitter,
        heavyHitterRank,
        countryBenchmark
      );
      const tagInfo = playerTags[user._id];
      const watchedItem = watchedMap.get(user._id);

      // Calculate days since last donation using true all-time records
      const effectiveLastDonation = donor?.lastDonationAt || lifetimeData?.lastDonationAt;
      let daysSinceLastDonation: number | undefined = undefined;
      let isInactiveDonor = false;
      if (effectiveLastDonation) {
        const lastDonationMs = new Date(effectiveLastDonation).getTime();
        daysSinceLastDonation = Math.max(0, Math.floor((Date.now() - lastDonationMs) / (1000 * 60 * 60 * 24)));
        if (daysSinceLastDonation >= 7) {
          isInactiveDonor = true;
        }
      } else {
        // Never donated to this country
        isInactiveDonor = true;
      }

      list.push({
        userId: user._id,
        username: user.username || `Citizen #${user._id.slice(-6)}`,
        avatarUrl: user.avatarUrl,
        countryId,
        countryName,
        level,
        wealthBtc: wealth,
        liquidBtc: liquidMoney,
        resourceWealthBtc: resourceWealth,
        companiesWealthBtc: companiesWealth,
        equipmentsWealthBtc: equipmentsWealth,
        weaponsWealthBtc: weaponsWealth,
        pastWealthBtc: audited?.pastWealthBtc,
        grossIncomeBtc: audited?.grossIncomeBtc,
        periodDonatedBtc: audited?.periodDonatedBtc !== undefined ? audited.periodDonatedBtc : direct,
        totalDonatedBtc: totalDonated,
        directDonatedBtc: direct,
        damageDonatedBtc: damageDonated,
        damageValueBtc: audited?.damageValueBtc !== undefined ? audited.damageValueBtc : damageValueBtc,
        totalCombatDamage: weeklyCombatDamage,
        lifetimeCombatDamage,
        isHistoricalTopDonor,
        historicalRank,
        isNationalHeavyHitter,
        heavyHitterRank,
        tierReasonBadge: audited?.tierReasonBadge || reason,
        donationCount,
        lastDonationAt: effectiveLastDonation,
        contributionRatio: audited ? audited.contributionRatio : ratio,
        leechTier: audited ? audited.leechTier : tier,
        warSkillPoints: warPoints,
        ecoSkillPoints: ecoPoints,
        playstyle,
        manualTag: tagInfo?.tag || 'none',
        notes: tagInfo?.notes,
        isActive: true,
        daysInBuild,
        daysSinceLastDonation,
        isInactiveDonor,
        isOnWatch: Boolean(watchedItem),
        watchReason: watchedItem?.reasonNote,
        auditBaselineStatus: audited?.auditBaselineStatus,
        auditMethodologyNote: audited?.auditMethodologyNote,
        ministerialVerdict: audited?.ministerialVerdict,
        ministerialVerdictReason: audited?.ministerialVerdictReason,
        playerCashflow: audited?.playerCashflow,
        companiesCount: audited?.companiesCount ?? Number(user.skills?.companies?.value ?? user.skills?.companies?.level ?? 2),
        activeCompaniesCount: audited?.activeCompaniesCount ?? Number(user.skills?.companies?.value ?? 2),
        maxCompaniesCap: audited?.maxCompaniesCap ?? Number(user.skills?.companies?.value ?? 2),
        automationLevelEst: audited?.automationLevelEst ?? 7,
        storageLevelEst: audited?.storageLevelEst ?? 7,
        estimatedCompanyCapacityBtc: audited?.estimatedCompanyCapacityBtc,
        worksCount: Number(user.stats?.worksCount || 0),
        employerCompanyId: typeof user.company === 'string' ? user.company : undefined,
      });
    });

    return list;
  }, [summary.leaderboard, cumulative, transactions, usersMap, selectedCountry, playerTags, ministryConfig, watchedCitizens, auditedProfilesMap]);

  // Income Growth Audit Action
  const handleRunIncomeAudit = async (customConfig?: MinistryConfig) => {
    setIsAuditingIncome(true);
    const cfg = customConfig || ministryConfig;
    try {
      const activeCitizens = Object.values(usersMap).filter((user) => {
        if (!user || !user._id) return false;
        if (selectedCountry && user.country && typeof user.country === 'string' && user.country !== selectedCountry._id) {
          return false;
        }
        const isActive = Boolean(user.isActive !== undefined ? user.isActive : true);
        const level = Number(user.leveling?.level ?? user.level ?? 0);
        return isActive && level >= 10;
      });

      const allTimeCumulativeMap = new Map<string, { totalAmount: number; lastDonationAt?: string }>();
      cumulative.forEach((c) => {
        if (c.userId) {
          allTimeCumulativeMap.set(c.userId, {
            totalAmount: Number(c.amount || 0),
            lastDonationAt: c.updatedAt || c.createdAt,
          });
        }
      });

      const countryBenchmark = calculateCountryEconomicBenchmark(
        selectedCountry?._id || '',
        activeCitizens,
        allTimeCumulativeMap
      );

      const audited = await auditCitizensIncomeGrowth(
        citizenEconomicProfiles,
        cfg,
        storage.getClosestWealthSnapshot.bind(storage),
        storage.saveWealthSnapshotsBatch.bind(storage),
        countryBenchmark,
        transactions,
        usersMap
      );
      const map: Record<string, CitizenEconomicProfile> = {};
      audited.forEach((a) => {
        map[a.userId] = a;
      });
      setAuditedProfilesMap(map);

      // Phase 4: Detect playstyle respecs and register alerts
      const priorPlaystyles = storage.getCitizenPlaystyles();
      const { newAlerts, updatedPlaystyles } = detectCitizenRespecAlerts(
        audited,
        respecAlerts,
        priorPlaystyles
      );
      if (newAlerts.length > 0) {
        const merged = [...newAlerts, ...respecAlerts];
        setRespecAlerts(merged);
        await storage.saveRespecAlerts(merged);
      }
      storage.saveCitizenPlaystyles(updatedPlaystyles);
    } catch (err) {
      console.warn('Income audit failed:', err);
    } finally {
      setIsAuditingIncome(false);
    }
  };

  const handleUpdateMinistryConfig = async (cfg: MinistryConfig) => {
    setMinistryConfig(cfg);
    if (selectedCountry?._id) {
      storage.saveMinistryConfig(selectedCountry._id, cfg);
    }
    // Changing policy immediately generates audit calculations
    await handleRunIncomeAudit(cfg);
  };

  // Automatically execute 7-day income growth audit whenever country changes or donors sync
  useEffect(() => {
    if (citizenEconomicProfiles.length > 0) {
      handleRunIncomeAudit();
    }
  }, [selectedCountry?._id, summary.leaderboard.length]);

  // Ministry Handlers
  const handleUpdatePlayerTag = async (userId: string, tag: PlayerTag, notes = '') => {
    await storage.savePlayerTag(userId, tag, notes);
    setPlayerTags((prev) => ({
      ...prev,
      [userId]: { tag, notes },
    }));
  };

  const handleAddNationalTransaction = async (tx: NationalTransaction) => {
    const updated = [tx, ...nationalTransactions];
    setNationalTransactions(updated);
    await storage.saveNationalTransactions(updated, selectedCountry?._id);
  };

  const handleDeleteNationalTransaction = async (id: string) => {
    const updated = nationalTransactions.filter((t) => t.id !== id);
    setNationalTransactions(updated);
    await storage.saveNationalTransactions(updated, selectedCountry?._id);
  };

  const handleImportNationalTransactions = async (imported: NationalTransaction[]) => {
    const existingIds = new Set(nationalTransactions.map((t) => t.id));
    const newItems = imported.filter((t) => !existingIds.has(t.id));
    const merged = [...newItems, ...nationalTransactions];
    setNationalTransactions(merged);
    await storage.saveNationalTransactions(merged, selectedCountry?._id);
  };

  const handleUpdateStockpile = async (updated: ResourceReserveItem[]) => {
    setStockpiles(updated);
    await storage.saveStockpiles(updated, selectedCountry?._id);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    const updated = respecAlerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
    setRespecAlerts(updated);
    await storage.saveRespecAlerts(updated);
  };

  const handleRestoreBackup = async () => {
    if (selectedCountry?._id) {
      const cfg = storage.getMinistryConfig(selectedCountry._id);
      setMinistryConfig(cfg);
    }
    const [tags, txs, stocks, alerts, watched] = await Promise.all([
      storage.getPlayerTags(),
      storage.getNationalTransactions(selectedCountry?._id),
      storage.getStockpiles(selectedCountry?._id),
      storage.getRespecAlerts(),
      storage.getWatchedCitizens(selectedCountry?._id),
    ]);
    setPlayerTags(tags);
    setNationalTransactions(txs);
    setStockpiles(stocks && stocks.length > 0 ? stocks : DEFAULT_STOCKPILES);
    setRespecAlerts(alerts);
    setWatchedCitizens(watched);
    await handleRunIncomeAudit();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectCountry={(c) => {
          setSelectedCountry(c);
          storage.setLastViewedCountry(c);
          setSelectedDonorId(null);
          setTransactions([]);
          setCumulative([]);
        }}
        isSyncing={isSyncing}
        onSync={handleManualSync}
        isOnline={isOnline}
        apiKey={apiKey}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        activeMode={activeMode}
        onToggleMode={(mode) => setActiveMode(mode)}
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
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
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
              onClick={() => setIsKeyModalOpen(true)}
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

        {activeMode === 'ministry' ? (
          <MinistryWorkspace
            countryName={selectedCountry?.name || 'Colombia'}
            countryId={selectedCountry?._id || ''}
            countries={countries}
            profiles={citizenEconomicProfiles}
            transactions={nationalTransactions}
            stockpiles={stockpiles}
            commodities={DEFAULT_COMMODITIES}
            alerts={respecAlerts}
            watchedCitizens={watchedCitizens}
            config={ministryConfig}
            apiKey={apiKey}
            isAuditingIncome={isAuditingIncome}
            onUpdateConfig={handleUpdateMinistryConfig}
            onUpdateTag={handleUpdatePlayerTag}
            onAddTransaction={handleAddNationalTransaction}
            onDeleteTransaction={handleDeleteNationalTransaction}
            onImportTransactions={handleImportNationalTransactions}
            onUpdateStockpile={handleUpdateStockpile}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onPutOnWatch={handlePutOnWatch}
            onRemoveFromWatch={handleRemoveFromWatch}
            onRunIncomeAudit={handleRunIncomeAudit}
            onRestoreBackup={handleRestoreBackup}
          />
        ) : (
          <>
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
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncludeDamage(checked);
                  if (!checked) {
                    // Instant deactivation: immediately revert rankings to pure monetary donations
                    setAppliedDamageConfig((prev) => ({
                      ...prev,
                      enabled: false,
                    }));
                  }
                }}
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
                  {[0.05, 0.08, 0.09, 0.1, 0.12].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDamageRateInput(preset.toString())}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition border ${
                        damageRateInput === preset.toString()
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
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

          {/* Formula preview and strategic audit disclaimer note */}
          {includeDamage && (
            <div className="mt-3.5 space-y-2.5">
              <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between flex-wrap gap-2 font-mono">
                <span className="text-slate-300">
                  Formula: <strong className="text-white">(Damage ÷ 1,000) × {damageRateInput || '0'} BTC</strong> converted as military/munitions contribution for {timeframe}.
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Active {selectedCountry?.name || 'Sovereign'} Citizens Only
                </span>
              </div>

              {/* Strategic War Doctrine Audit Disclaimer */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block mb-0.5 font-bold">
                    Strategic Military Expenditure & War Mode Audit Policy:
                  </strong>
                  In War Era, dealing heavy combat damage requires substantial personal BTC expenditure on weapons, armor, and munitions. Under this national conversion doctrine, combat output is recognized as monetary contribution to {selectedCountry?.name || 'the nation'}. Non-donating combatants are strictly verified by active sovereign citizenship. Deployed fighters returning home have their full combat records recognized for the national cause.
                </div>
              </div>
            </div>
          )}
        </div>

        {!selectedCountry ? (
          <div className="my-8 p-8 rounded-3xl bg-slate-900/90 border border-slate-800 text-center max-w-xl mx-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg">
              🌐
            </div>
            <h2 className="text-xl font-black text-white mb-2">Select a Nation to Begin Audit</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Choose any sovereign country from the 180+ nations in the top menu to view citizen donations, war mode damage rankings, and transparent audit receipts.
            </p>
            <button
              type="button"
              onClick={() => {
                const countryBtn = document.querySelector('header button[type="button"]') as HTMLButtonElement;
                countryBtn?.click();
              }}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
            >
              Browse 180 Countries
            </button>
          </div>
        ) : (
          <>
            {/* Aggregate KPI Summary Stats */}
            <RankingStats
              summary={summary}
              countryName={selectedCountry.name}
              totalActiveCitizens={totalActiveCitizens}
              onSelectDonor={(uid) => setSelectedDonorId(uid)}
            />

            {/* Visual Top-3 Podium */}
            {summary.leaderboard.length >= 2 && (
              <Podium
                topDonors={summary.leaderboard.slice(0, 3)}
                onSelectDonor={(uid) => setSelectedDonorId(uid)}
                timeframePhrase={timeframePhrase}
              />
            )}

            {/* Detailed Leaderboard Table with All Donors */}
            <LeaderboardTable
              leaderboard={summary.leaderboard}
              totalAmountDonated={summary.totalAmountDonated}
              onSelectDonor={(uid) => setSelectedDonorId(uid)}
              timeframe={
                timeframe === 'daily'
                  ? 'in the last 24 hours'
                  : timeframe === 'weekly'
                  ? 'in the last week'
                  : timeframe === 'monthly'
                  ? 'in the last month'
                  : timeframe === 'custom'
                  ? `between ${customRange.startDate} and ${customRange.endDate}`
                  : 'All-Time Record'
              }
            />
          </>
        )}
      </>
    )}
      </main>

      {/* Citizen Drill-down Audit Modal */}
      {selectedDonorId && (
        <CitizenDetailModal
          donor={selectedDonor}
          onClose={() => setSelectedDonorId(null)}
          countryName={selectedCountry?.name || 'Country'}
          hasApiKey={Boolean(apiKey)}
          timeframe={timeframe}
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

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />

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
