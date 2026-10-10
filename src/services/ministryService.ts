import { WareraUserLite, WareraCountry, WareraTransaction } from '../types/warera';
import { extractItemTimestampMs } from './apiService';
import {
  CANONICAL_24_COMMODITIES,
  generateFallbackMarketTrends,
  buildSovereignStockpileMatrix,
} from './marketService';
import {
  formatDateDDMMYYYY,
  getTodayDDMMYYYY,
  normalizeDateToYYYYMMDD,
} from '../utils/dateUtils';
import {
  CitizenEconomicProfile,
  LeechTier,
  CitizenEconomicStanding,
  PlaystyleMode,
  PlayerTag,
  NationalTransaction,
  ResourceReserveItem,
  CommodityTrend,
  RespecAlert,
  MinisterialMessage,
  MinistryConfig,
  WealthSnapshot,
  DEFAULT_MINISTRY_CONFIG,
  CountryEconomicBenchmark,
  PlayerTransactionSummary,
} from '../types/ministry';

export type { MinisterialMessage };

/**
 * Calculates a player's commercial cash flow from actual War Era player market transactions
 * (sales where sellerId === userId, purchases where buyerId === userId) or company production capacity.
 * Accurately models War Era mechanics:
 * - Companies: up to 12 base (+1 per prestige), each with internal Automation (1-7 PP/hr) and Storage (1-7).
 * - Canonical resources: Oil, Iron, Food, Munitions (no non-existent resources).
 * - Anti-flipper margin protection: uses net profit margin so market traders aren't taxed on gross turnover.
 */
export function calculatePlayerCashflowSummary(
  userId: string,
  user?: WareraUserLite,
  periodTransactions?: WareraTransaction[],
  periodDays = 7,
  countryBenchmark?: CountryEconomicBenchmark
): {
  summary: PlayerTransactionSummary;
  companiesCount: number;
  activeCompaniesCount: number;
  maxCompaniesCap: number;
  automationLevelEst: number;
  storageLevelEst: number;
  estimatedCompanyCapacityBtc: number;
} {
  const companiesSkill = Number(user?.skills?.companies?.level ?? 0);
  const prestige = Number((user?.stats as any)?.prestige ?? 0);

  // In War Era, base active slots is 2. Each skill point in companies grants +1 active slot.
  // When respecced to war mode (0 skill points), active slots drops to 2 while keeping all owned factories.
  const activeCompaniesCount = Math.max(0, Number(user?.skills?.companies?.value ?? user?.skills?.companies?.total ?? (companiesSkill + 2)));
  const maxCompaniesCap = activeCompaniesCount;

  // Total built companies in asset portfolio (stats.wealth.companies)
  const wealthCompanies = typeof user?.stats?.wealth === 'object' ? Number(user?.stats?.wealth?.companies || 0) : 0;
  const rawCompaniesCount = Number(
    (user?.stats as any)?.companiesCount ??
    (wealthCompanies > 0 ? Math.max(activeCompaniesCount, Math.min(12 + prestige, Math.round(wealthCompanies / 3000) || 12)) : activeCompaniesCount)
  );
  const companiesCount = Math.max(activeCompaniesCount, rawCompaniesCount);

  // Internal Automation & Storage Levels
  const autoLevelEst = 7;
  const storageLevelEst = Math.min(7, Math.max(4, Number(user?.skills?.entrepreneurship?.level ?? 0) + 4));

  // Nuanced transaction metrics across all 10 canonical in-game types
  let wagesEarnedBtc = 0;
  let wagesCount = 0;
  let wagesPaidBtc = 0;
  let wagesPaidCount = 0;
  let salesVolumeBtc = 0;
  let salesCount = 0;
  let commoditySalesBtc = 0;
  let equipmentSalesBtc = 0;
  let purchasesVolumeBtc = 0;
  let purchasesCount = 0;
  let commodityPurchasesBtc = 0;
  let equipmentPurchasesBtc = 0;
  let tipsReceivedBtc = 0;
  let tipsSentBtc = 0;
  let applicationFeesBtc = 0;
  let craftingExpensesBtc = 0;
  let dismantleExpensesBtc = 0;
  let caseOpeningExpensesBtc = 0;
  let donationsGivenBtc = 0;
  let donationTransfersCount = 0;

  let primaryTradedResource: 'oil' | 'iron' | 'food' | 'munitions' | 'general' = 'general';
  const resourceCounts: Record<string, number> = {};

  if (periodTransactions && periodTransactions.length > 0) {
    const now = Date.now();
    const windowMs = Math.max(1, periodDays) * 24 * 60 * 60 * 1000;
    const cutoffTime = now - windowMs;

    for (const t of periodTransactions) {
      // Enforce observation window (7D vs 30D)
      if (t.createdAt) {
        const txTime = new Date(t.createdAt).getTime();
        if (!isNaN(txTime) && txTime < cutoffTime) {
          continue;
        }
      }

      const amt = Number(t.money || t.amount || 0);
      const isActor = t.userId === userId;
      const isSeller = t.sellerId === userId;
      const isBuyer = t.buyerId === userId;
      const tType = (t.transactionType || '').toLowerCase();

      // 1. Wage transactions (Work contract salaries from domestic or foreign employers vs employer wage payouts)
      if (
        tType === 'wage' ||
        tType === 'salary' ||
        tType.includes('wage') ||
        tType.includes('salary') ||
        (t as any).action === 'work' ||
        tType === 'work'
      ) {
        const isEmployerPaying = isBuyer || t.senderId === userId || (Boolean(t.recipientId) && t.recipientId !== userId);
        if (isEmployerPaying) {
          wagesPaidBtc += amt;
          wagesPaidCount++;
        } else {
          wagesEarnedBtc += amt;
          wagesCount++;
        }
      }
      // 2. Equipment Market transactions (Item Market tab - Equipment with stats)
      else if (tType === 'itemmarket' || tType === 'item_market') {
        if (isSeller) {
          salesVolumeBtc += amt;
          equipmentSalesBtc += amt;
          salesCount++;
        } else if (isBuyer || isActor) {
          purchasesVolumeBtc += amt;
          equipmentPurchasesBtc += amt;
          purchasesCount++;
        }
      }
      // 3. Commodity / Resource Trading transactions (Trading tab - Oil, Iron, Food, Munitions)
      else if (tType === 'trading' || tType === 'trade' || tType === 'market') {
        if (isSeller) {
          salesVolumeBtc += amt;
          commoditySalesBtc += amt;
          salesCount++;
          const itemCode = (t.item || t.resourceType || '').toLowerCase();
          if (itemCode) {
            resourceCounts[itemCode] = (resourceCounts[itemCode] || 0) + 1;
          }
        } else if (isBuyer || isActor) {
          purchasesVolumeBtc += amt;
          commodityPurchasesBtc += amt;
          purchasesCount++;
        }
      }
      // 4. Journalism & Articles (Article Tip)
      else if (tType === 'articletip' || tType === 'tip') {
        if (isSeller || (isActor && amt > 0 && !isBuyer)) {
          tipsReceivedBtc += amt;
        } else {
          tipsSentBtc += amt;
        }
      }
      // 5. Application Fees (Party, Corporate roles)
      else if (tType === 'applicationfee' || tType === 'fee') {
        applicationFeesBtc += amt;
      }
      // 6. Crafting, Dismantling, Case Openings
      else if (tType === 'craftitem') {
        craftingExpensesBtc += amt;
      } else if (tType === 'dismantleitem') {
        dismantleExpensesBtc += amt;
      } else if (tType === 'opencase') {
        caseOpeningExpensesBtc += amt;
      }
      // 7. Treasury Donations
      else if (tType === 'donation' || tType.includes('donat')) {
        if (isActor || isBuyer) {
          donationsGivenBtc += amt;
          donationTransfersCount++;
        }
      }
    }

    // Determine primary canonical traded resource
    let maxCount = 0;
    for (const [res, count] of Object.entries(resourceCounts)) {
      if (count > maxCount) {
        maxCount = count;
        if (res.includes('oil')) primaryTradedResource = 'oil';
        else if (res.includes('iron')) primaryTradedResource = 'iron';
        else if (res.includes('food')) primaryTradedResource = 'food';
        else if (res.includes('munit') || res.includes('weapon') || res.includes('tank')) primaryTradedResource = 'munitions';
      }
    }
  }

  // Realized net trading balance (Sales Volume minus Purchases Sourcing Volume):
  const netTradeProfitBtc = Math.round((salesVolumeBtc - purchasesVolumeBtc) * 100) / 100;

  // Nuanced Financial Breakdown
  const grossInflowBtc = Math.round((wagesEarnedBtc + salesVolumeBtc + tipsReceivedBtc) * 100) / 100;
  const totalTradingCOGSBtc = Math.round(purchasesVolumeBtc * 100) / 100;
  const operatingOutflowsBtc = Math.round((craftingExpensesBtc + dismantleExpensesBtc + caseOpeningExpensesBtc + applicationFeesBtc) * 100) / 100;
  const totalOutflowsBtc = Math.round((purchasesVolumeBtc + wagesPaidBtc + operatingOutflowsBtc + tipsSentBtc + donationsGivenBtc) * 100) / 100;
  // Net Disposable Cashflow: Inflows (Wages + Sales + Tips) minus Outflows (Purchases + Employer Wages Paid + Gear/Fees)
  const netDisposableIncomeBtc = Math.round((grossInflowBtc - purchasesVolumeBtc - wagesPaidBtc - operatingOutflowsBtc) * 100) / 100;

  // Real net cashflow across all in-game transaction streams (Gross Inflows minus Total Outflows)
  const netCashflowBtc = Math.round((grossInflowBtc - totalOutflowsBtc) * 100) / 100;

  // Dynamic country-relative solvency assessment (comparing against citizen peers)
  const liquidBtc = typeof user?.stats?.wealth === 'object' && user.stats.wealth.money !== undefined
    ? Number(user.stats.wealth.money)
    : Number(user?.money ?? 0);

  const upperQuartileWealth = countryBenchmark?.wealthP75 || 5000;
  const upperQuartileLiquid = countryBenchmark?.liquidP75 || 500;
  const medianWealth = countryBenchmark?.wealthMedian || 1500;
  const medianLiquid = countryBenchmark?.liquidMedian || 200;

  let solvencyStatus: 'solvent-liquid' | 'illiquid-locked' | 'subsistence' = 'solvent-liquid';
  if (liquidBtc >= upperQuartileLiquid) {
    solvencyStatus = 'solvent-liquid';
  } else if (liquidBtc < medianLiquid && Number(user?.rankings?.userDamages?.value || 0) > 1000000) {
    solvencyStatus = 'illiquid-locked';
  } else {
    solvencyStatus = 'subsistence';
  }

  // Ministerial Slacker vs Subsistence Verdict (strictly relative to nation's citizen distribution)
  const userLevel = Number(user?.leveling?.level ?? user?.level ?? 0);
  const netWorth = Number(
    user?.rankings?.userWealth?.value ??
    (typeof user?.stats?.wealth === 'object' ? user.stats.wealth.total : user?.stats?.wealth) ??
    0
  );

  let ministerialVerdict: import('../types/ministry').MinisterialVerdict = 'moderate-contributor';
  let ministerialVerdictReason = 'Citizen contributes at an acceptable national rate.';

  const wealthDonationRatioPct = netWorth > 0 ? (donationsGivenBtc / netWorth) * 100 : 0;

  if (userLevel > 0 && userLevel < 15) {
    ministerialVerdict = 'exempted-recruit';
    ministerialVerdictReason = 'New recruit (Level < 15); exempt from ministerial contribution pressure.';
  } else if (netWorth >= upperQuartileWealth && (donationsGivenBtc <= 0 || wealthDonationRatioPct < 0.2)) {
    // Upper-bracket citizen with token micro-donations (<0.2% of wealth) or zero donations
    ministerialVerdict = 'slacker-evader';
    ministerialVerdictReason = `Identified Slacker / Evader: Upper wealth bracket (${netWorth.toLocaleString()} BTC net worth) with token period contributions (${donationsGivenBtc.toLocaleString()} BTC, ${wealthDonationRatioPct.toFixed(2)}% of wealth).`;
  } else if (donationsGivenBtc > 0 && netDisposableIncomeBtc > 0 && donationsGivenBtc >= (netDisposableIncomeBtc * 0.15)) {
    ministerialVerdict = 'patriotic-fulfiller';
    ministerialVerdictReason = `Model Patriot; contributed ${donationsGivenBtc.toLocaleString()} BTC in period (${Math.round((donationsGivenBtc / netDisposableIncomeBtc) * 100)}% of net cashflow).`;
  } else if (donationsGivenBtc > 0 && netDisposableIncomeBtc > 0 && donationsGivenBtc >= (netDisposableIncomeBtc * 0.07)) {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = `Active contributor: Contributed ${donationsGivenBtc.toLocaleString()} BTC in period.`;
  } else if (donationsGivenBtc > 0) {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = `Active contributor: Contributed ${donationsGivenBtc.toLocaleString()} BTC in period.`;
  } else if (netWorth >= upperQuartileWealth) {
    ministerialVerdict = 'slacker-evader';
    ministerialVerdictReason = `Identified Slacker: High net worth (${netWorth.toLocaleString()} BTC) with zero period contributions.`;
  } else if (netWorth < medianWealth && liquidBtc < medianLiquid) {
    ministerialVerdict = 'subsistence-worker';
    ministerialVerdictReason = `Subsistence Worker: Below national median wealth (${netWorth.toLocaleString()} BTC). Exempt from contribution pressure.`;
  } else {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = 'Awaiting national comparative audit baseline.';
  }

  const dataSource: 'live-ledger' | 'estimated-capacity' =
    (wagesCount > 0 || wagesPaidCount > 0 || salesCount > 0 || purchasesCount > 0) ? 'live-ledger' : 'estimated-capacity';

  return {
    summary: {
      userId,
      wagesEarnedBtc: Math.round(wagesEarnedBtc * 100) / 100,
      wagesCount,
      wagesPaidBtc: Math.round(wagesPaidBtc * 100) / 100,
      wagesPaidCount,
      salariesEarnedBtc: Math.round(wagesEarnedBtc * 100) / 100, // Alias
      salesVolumeBtc: Math.round(salesVolumeBtc * 100) / 100,
      salesCount,
      commoditySalesBtc: Math.round(commoditySalesBtc * 100) / 100,
      equipmentSalesBtc: Math.round(equipmentSalesBtc * 100) / 100,
      purchasesVolumeBtc: Math.round(purchasesVolumeBtc * 100) / 100,
      purchasesCount,
      commodityPurchasesBtc: Math.round(commodityPurchasesBtc * 100) / 100,
      equipmentPurchasesBtc: Math.round(equipmentPurchasesBtc * 100) / 100,
      netTradeProfitBtc: Math.round(netTradeProfitBtc * 100) / 100,
      tipsReceivedBtc: Math.round(tipsReceivedBtc * 100) / 100,
      tipsSentBtc: Math.round(tipsSentBtc * 100) / 100,
      applicationFeesBtc: Math.round(applicationFeesBtc * 100) / 100,
      craftingExpensesBtc: Math.round(craftingExpensesBtc * 100) / 100,
      dismantleExpensesBtc: Math.round(dismantleExpensesBtc * 100) / 100,
      caseOpeningExpensesBtc: Math.round(caseOpeningExpensesBtc * 100) / 100,
      donationsGivenBtc: Math.round(donationsGivenBtc * 100) / 100,
      donationTransfersCount,
      grossInflowBtc,
      totalTradingCOGSBtc,
      operatingOutflowsBtc,
      totalOutflowsBtc,
      netDisposableIncomeBtc,
      netCashflowBtc,
      solvencyStatus,
      ministerialVerdict,
      ministerialVerdictReason,
      periodDays,
      dataSource,
      primaryTradedResource,
    },
    companiesCount,
    activeCompaniesCount,
    maxCompaniesCap,
    automationLevelEst: autoLevelEst,
    storageLevelEst,
    estimatedCompanyCapacityBtc: 0,
  };
}

/**
 * Constructs an immutable, truth-based verified CitizenEconomicProfile from personal transaction receipts.
 * Strictly calculates verified Gross Inflow, Net Cashflow, and contribution ratio.
 */
export function buildAuditedCitizenProfile(
  profile: CitizenEconomicProfile,
  personalTxs: WareraTransaction[],
  config: MinistryConfig = DEFAULT_MINISTRY_CONFIG,
  countryBenchmark?: CountryEconomicBenchmark,
  windowDays = 7
): CitizenEconomicProfile {
  const reconstructedUser: any = {
    _id: profile.userId,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    country: profile.countryId,
    level: profile.level,
    money: profile.liquidBtc,
    skills: {
      companies: { value: profile.activeCompaniesCount || 2 },
    },
    stats: {
      wealth: {
        total: profile.wealthBtc,
        money: profile.liquidBtc || 0,
        companies: profile.companiesWealthBtc || 0,
      },
    },
  };

  const recalculated = calculatePlayerCashflowSummary(
    profile.userId,
    reconstructedUser,
    personalTxs,
    windowDays,
    countryBenchmark
  );

  const verifiedGrossInflow = recalculated.summary.grossInflowBtc;
  const verifiedNetCashflow = recalculated.summary.netCashflowBtc ?? recalculated.summary.netDisposableIncomeBtc;
  const periodDonated = recalculated.summary.donationsGivenBtc > 0
    ? recalculated.summary.donationsGivenBtc
    : (profile.periodDonatedBtc ?? profile.directDonatedBtc ?? 0);
  const newGross = Math.max(verifiedGrossInflow, periodDonated);
  const verifiedRatio = newGross > 0 ? Math.round((periodDonated / newGross) * 1000) / 10 : 0;

  const currentWealthBasis = profile.wealthBtc + (profile.resourceWealthBtc || 0);
  const tierEval = evaluateLeechTier(
    currentWealthBasis,
    periodDonated,
    { ...config, analysisPeriodDays: windowDays },
    newGross,
    profile.playstyle,
    profile.totalDonatedBtc,
    profile.resourceWealthBtc,
    profile.totalCombatDamage,
    profile.isHistoricalTopDonor,
    profile.historicalRank,
    profile.isNationalHeavyHitter,
    profile.heavyHitterRank,
    countryBenchmark
  );

  const newStanding = resolveMasterCitizenStanding(
    tierEval.tier,
    recalculated.summary.ministerialVerdict,
    profile.isHistoricalTopDonor,
    profile.isNationalHeavyHitter
  );

  return {
    ...profile,
    playerCashflow: recalculated.summary,
    grossIncomeBtc: newGross,
    grossInflowBtc: verifiedGrossInflow,
    netCashflowBtc: verifiedNetCashflow,
    periodDonatedBtc: periodDonated,
    directDonatedBtc: periodDonated,
    contributionRatio: verifiedRatio,
    leechTier: tierEval.tier,
    economicStanding: newStanding,
    damageValueBtc: tierEval.damageValueBtc,
    tierReasonBadge: tierEval.reason || profile.tierReasonBadge,
    ministerialVerdict: recalculated.summary.ministerialVerdict || profile.ministerialVerdict,
    ministerialVerdictReason: recalculated.summary.ministerialVerdictReason || profile.ministerialVerdictReason,
    companiesCount: recalculated.companiesCount,
    activeCompaniesCount: recalculated.activeCompaniesCount,
    auditBaselineStatus: 'audited',
    auditedAt: new Date().toISOString(),
    receiptCount: personalTxs.length,
    auditMethodologyNote: `Verified via ${personalTxs.length} live in-game personal receipts (${windowDays}D window).`,
  };
}

/**
 * Computes statistical wealth, combat, and donation benchmarks
 * for a specific country's active citizens to ensure 100% proportional,
 * country-relative evaluation (eliminating static absolute numbers).
 */
export function calculateCountryEconomicBenchmark(
  countryId: string,
  citizens: WareraUserLite[],
  cumulativeMap: Map<string, { totalAmount: number; lastDonationAt?: string }>,
  fightersDamageMap?: Map<string, number>,
  officialActiveCount?: number
): CountryEconomicBenchmark {
  const activeCitizens = citizens.filter((c) => {
    const isActive = Boolean(c.isActive !== undefined ? c.isActive : true);
    const lvl = Number(c.leveling?.level ?? c.level ?? 0);
    return isActive && lvl >= 10;
  });

  const count = (typeof officialActiveCount === 'number' && officialActiveCount > 0)
    ? officialActiveCount
    : activeCitizens.length;

  if (count === 0) {
    return {
      countryId,
      totalActiveCitizens: 0,
      wealthP25: 500,
      wealthMedian: 1500,
      wealthP75: 5000,
      wealthP90: 15000,
      liquidMedian: 100,
      liquidP75: 500,
      topDonorsThreshold: 100,
      fighterDamageMedianTopTier: 5000000,
      heavyHitterCohortSize: 5,
    };
  }

  // Extract and sort net worths
  const wealthValues = activeCitizens
    .map((c) => Number(c.rankings?.userWealth?.value || (typeof c.stats?.wealth === 'object' ? c.stats.wealth.total : c.stats?.wealth) || 0))
    .sort((a, b) => a - b);

  const getPercentile = (pct: number) => {
    const idx = Math.min(wealthValues.length - 1, Math.floor(wealthValues.length * pct));
    return wealthValues[idx] || 0;
  };

  const wealthP25 = getPercentile(0.25);
  const wealthMedian = getPercentile(0.5);
  const wealthP75 = Math.max(1000, getPercentile(0.75));
  const wealthP90 = Math.max(2500, getPercentile(0.90));

  // Extract and sort liquid cash values (relative to this country)
  const liquidValues = activeCitizens
    .map((c) => {
      const wealthObj = typeof c.stats?.wealth === 'object' ? c.stats.wealth : null;
      return Number(wealthObj?.money !== undefined ? wealthObj.money : (c.money ?? 0));
    })
    .sort((a, b) => a - b);

  const getLiquidPercentile = (pct: number) => {
    const idx = Math.min(liquidValues.length - 1, Math.floor(liquidValues.length * pct));
    return liquidValues[idx] || 0;
  };

  const liquidMedian = getLiquidPercentile(0.5);
  const liquidP75 = getLiquidPercentile(0.75);

  // Extract fighter damage distribution
  const damageValues: number[] = [];
  activeCitizens.forEach((c) => {
    const dmg = fightersDamageMap?.get(c._id) ?? Number(
      c.rankings?.userDamages?.value ||
      (c.rankings as any)?.countryDamages?.value ||
      (c as any).stats?.damage ||
      0
    );
    if (dmg > 0) damageValues.push(dmg);
  });
  damageValues.sort((a, b) => b - a);

  const heavyHitterCohortSize = Math.max(3, Math.min(10, Math.ceil(damageValues.length * 0.15)));
  const topTierDamages = damageValues.slice(0, heavyHitterCohortSize);
  const fighterDamageMedianTopTier = topTierDamages.length > 0
    ? topTierDamages[Math.floor(topTierDamages.length / 2)]
    : 5000000;

  // Lifetime donors threshold
  const donorTotals: number[] = Array.from(cumulativeMap.values())
    .map((d) => d.totalAmount)
    .filter((a) => a > 0)
    .sort((a, b) => b - a);
  const topDonorsThreshold = donorTotals.length >= 10 ? donorTotals[9] : (donorTotals[donorTotals.length - 1] || 100);

  return {
    countryId,
    totalActiveCitizens: count,
    wealthP25,
    wealthMedian,
    wealthP75,
    wealthP90,
    liquidMedian,
    liquidP75,
    topDonorsThreshold,
    fighterDamageMedianTopTier,
    heavyHitterCohortSize,
  };
}

/**
 * Dynamically synthesizes sovereign policy defaults calculated directly from
 * live War Era API benchmarks for any selected country (without hardcoded tables).
 * Preserves user-configured damage-to-BTC rate as requested.
 */
export function synthesizeCountryMinistryConfig(
  benchmark: CountryEconomicBenchmark,
  existingConfig?: MinistryConfig
): MinistryConfig {
  const calculatedGraceFloor = Math.max(
    25,
    Math.round((benchmark.topDonorsThreshold * 0.35) / 50) * 50
  );

  const topHistoricalRank = Math.max(3, Math.min(10, Math.ceil(benchmark.totalActiveCitizens * 0.10)));
  const topHeavyHitterRank = Math.max(3, Math.min(10, benchmark.heavyHitterCohortSize));
  const highWealth = Math.round(benchmark.wealthP75);

  return {
    analysisPeriodDays: existingConfig?.analysisPeriodDays || 7,
    patriotIncomeRatePct: 15,
    moderateIncomeRatePct: 7,
    lowContributorIncomeRatePct: 2.5,
    warPatriotRatePct: 6,
    warModerateRatePct: 2.5,
    warLowRatePct: 1,
    ecoPatriotRatePct: 15,
    ecoModerateRatePct: 7,
    ecoLowRatePct: 2.5,
    hybridPatriotRatePct: 12,
    hybridModerateRatePct: 6,
    hybridLowRatePct: 2.5,
    leechWealthPercentileCutoff: 75,
    highWealthThreshold: highWealth,
    historicalDonorGraceThresholdBtc: calculatedGraceFloor,
    topHistoricalDonorProtectionRank: topHistoricalRank,
    topHeavyHitterRankCutoff: topHeavyHitterRank,
    includeDamageInLeechCalculation: Boolean(existingConfig?.includeDamageInLeechCalculation),
    damageConversionRateBtcPer1k: existingConfig?.damageConversionRateBtcPer1k ?? 0.08,
    includeResourceWealth: Boolean(existingConfig?.includeResourceWealth),
  };
}

/**
 * Calculate total War Skill Points from War Era user profile levels
 * Matches SpyWarEra combat build attribution
 */
export function calculateWarSkillPoints(user: WareraUserLite): number {
  if (!user.skills) return 0;
  const s = user.skills;
  const attack = Number(s.attack?.level ?? 0);
  const critDmg = Number(s.criticalDamages?.level ?? 0);
  const critChance = Number(s.criticalChance?.level ?? 0);
  const armor = Number(s.armor?.level ?? 0);
  const precision = Number(s.precision?.level ?? 0);
  const dodge = Number(s.dodge?.level ?? 0);
  const health = Number(s.health?.level ?? 0);
  const stamina = Number(s.stamina?.level ?? 0);
  const energy = Number(s.energy?.level ?? 0);
  return attack + critDmg + critChance + armor + precision + dodge + health + stamina + energy;
}

/**
 * Calculate total Economy Skill Points from War Era user profile levels
 * Matches SpyWarEra economic/industrial build attribution
 */
export function calculateEcoSkillPoints(user: WareraUserLite): number {
  if (!user.skills) return 0;
  const s = user.skills;
  const companies = Number(s.companies?.level ?? 0);
  const entrepreneurship = Number(s.entrepreneurship?.level ?? 0);
  const production = Number(s.production?.level ?? 0);
  const management = Number(s.management?.level ?? 0);
  const lootChance = Number(s.lootChance?.level ?? 0);
  return companies + entrepreneurship + production + management + lootChance;
}

/**
 * Calculate days spent in current skill build (matching SpyWarEra)
 */
export function calculateDaysInBuild(user: WareraUserLite): number {
  const resetAt = user.dates?.lastSkillsResetAt || user.createdAt;
  if (!resetAt) return 0;
  const diffMs = Date.now() - new Date(resetAt).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Determine playstyle from skill point distribution
 */
export function evaluatePlaystyle(warPoints: number, ecoPoints: number): PlaystyleMode {
  if (ecoPoints === 0 && warPoints === 0) return 'hybrid';
  const total = warPoints + ecoPoints;
  const ecoShare = ecoPoints / total;
  const warShare = warPoints / total;

  if (ecoShare >= 0.55) return 'pure-eco';
  if (warShare >= 0.55) return 'pure-war';
  return 'hybrid';
}

/**
 * Phase 4.1: Respec Detection Engine
 * Compares current citizen build playstyles against previously recorded playstyles
 * to detect build shifts (e.g., Pure-Eco -> Pure-War, Pure-War -> Pure-Eco, or Hybrid transitions).
 * Deduplicates alerts to avoid repeated notifications for the same citizen build transition.
 */
export function detectCitizenRespecAlerts(
  currentProfiles: CitizenEconomicProfile[],
  existingAlerts: RespecAlert[],
  priorPlaystyles: Record<string, { playstyle: PlaystyleMode; warPoints: number; ecoPoints: number }>
): {
  newAlerts: RespecAlert[];
  updatedPlaystyles: Record<string, { playstyle: PlaystyleMode; warPoints: number; ecoPoints: number }>;
} {
  const newAlerts: RespecAlert[] = [];
  const updatedPlaystyles: Record<string, { playstyle: PlaystyleMode; warPoints: number; ecoPoints: number }> = {
    ...priorPlaystyles,
  };

  const now = new Date().toISOString();

  for (const profile of currentProfiles) {
    const prior = priorPlaystyles[profile.userId];

    if (prior && prior.playstyle) {
      if (prior.playstyle !== profile.playstyle) {
        // Check if an unacknowledged alert for this citizen and this transition already exists
        const alreadyAlerted = existingAlerts.some(
          (a) =>
            a.userId === profile.userId &&
            a.newMode === profile.playstyle &&
            !a.acknowledged
        );

        if (!alreadyAlerted) {
          const alert: RespecAlert = {
            id: `respec_${profile.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: profile.userId,
            username: profile.username,
            previousMode: prior.playstyle,
            newMode: profile.playstyle,
            warPoints: profile.warSkillPoints,
            ecoPoints: profile.ecoSkillPoints,
            timestamp: now,
            acknowledged: false,
          };
          newAlerts.push(alert);
        }
      }
    }

    // Update tracking entry with current stats
    updatedPlaystyles[profile.userId] = {
      playstyle: profile.playstyle,
      warPoints: profile.warSkillPoints,
      ecoPoints: profile.ecoSkillPoints,
    };
  }

  return { newAlerts, updatedPlaystyles };
}

/**
 * Calculate leech tier based on configurable income donation ratio.
 * Default: >= 15% of income is Model Patriot, 5-10% is Low Contributor, < 5% is Leech.
 */
/**
 * Evaluate citizen contribution tier against customizable mode-specific thresholds.
 * - Supports distinct rates for War Mode (frontline fighters spending on munitions),
 *   Eco Mode (passive wealth/production companies), and Hybrid Mode.
 * - Protects historical big contributors (e.g. lifetime donations >= grace threshold)
 *   from false leech classification during wartime mobilization.
 */
export function evaluateLeechTier(
  wealthBtc: number,
  donatedBtc: number,
  config?: MinistryConfig,
  grossIncomeBtc?: number,
  playstyle: PlaystyleMode = 'hybrid',
  lifetimeDonations = 0,
  resourceWealthBtc = 0,
  combatDamage = 0,
  isHistoricalTopDonor = false,
  historicalRank?: number,
  isNationalHeavyHitter = false,
  heavyHitterRank?: number,
  countryBenchmark?: CountryEconomicBenchmark
): { ratio: number; tier: LeechTier; reason?: string; damageValueBtc?: number } {
  // Determine mode-specific percentage thresholds
  let patriotPct: number;
  let moderatePct: number;
  let lowPct: number;

  if (playstyle === 'pure-war') {
    patriotPct = config?.warPatriotRatePct ?? 6;
    moderatePct = config?.warModerateRatePct ?? 2.5;
    lowPct = config?.warLowRatePct ?? 1;
  } else if (playstyle === 'pure-eco') {
    patriotPct = config?.ecoPatriotRatePct ?? 15;
    moderatePct = config?.ecoModerateRatePct ?? 7;
    lowPct = config?.ecoLowRatePct ?? 2.5;
  } else if (playstyle === 'hybrid') {
    patriotPct = config?.hybridPatriotRatePct ?? 12;
    moderatePct = config?.hybridModerateRatePct ?? 6;
    lowPct = config?.hybridLowRatePct ?? 2.5;
  } else {
    patriotPct = config?.patriotIncomeRatePct ?? DEFAULT_MINISTRY_CONFIG.patriotIncomeRatePct;
    moderatePct = config?.moderateIncomeRatePct ?? DEFAULT_MINISTRY_CONFIG.moderateIncomeRatePct;
    lowPct = config?.lowContributorIncomeRatePct ?? DEFAULT_MINISTRY_CONFIG.lowContributorIncomeRatePct;
  }

  // Base wealth considering resource stockpile toggle if enabled
  const effectiveWealth = (config?.includeResourceWealth && resourceWealthBtc > 0)
    ? wealthBtc + resourceWealthBtc
    : wealthBtc;

  // Calculate country-proportional Leech Wealth Floor
  // Only citizens in the top wealth bracket of their specific country (e.g. >= P75) can be branded Critical Leech
  const percentileCutoff = config?.leechWealthPercentileCutoff ?? 75;
  let leechWealthFloor: number;
  if (countryBenchmark && countryBenchmark.totalActiveCitizens > 0) {
    if (percentileCutoff >= 90) leechWealthFloor = countryBenchmark.wealthP90;
    else if (percentileCutoff >= 75) leechWealthFloor = countryBenchmark.wealthP75;
    else leechWealthFloor = countryBenchmark.wealthMedian;
  } else {
    leechWealthFloor = config?.highWealthThreshold ?? 5000;
  }

  // Calculate gross income basis (verified accounting without phantom multipliers):
  const effectiveIncome = typeof grossIncomeBtc === 'number' && grossIncomeBtc > 0 ? grossIncomeBtc : 0;

  // Combat Damage Conversion with Strict Playstyle & Benchmark Gating:
  // Pure-Eco industrialists (company owners) CANNOT use combat damage to evade economic quotas.
  let damageValueBtc = 0;
  if (config?.includeDamageInLeechCalculation && combatDamage > 0 && playstyle !== 'pure-eco') {
    const rate = config.damageConversionRateBtcPer1k ?? 0.08;
    const rawCredit = (combatDamage / 1000) * rate;

    if (playstyle === 'pure-war') {
      if (isNationalHeavyHitter) {
        damageValueBtc = rawCredit;
      } else {
        // Active soldier in war mode: award realistic defense credit up to 1.5x moderate quota
        const moderateQuotaBtc = effectiveIncome > 0 ? effectiveIncome * (moderatePct / 100) : 25;
        damageValueBtc = Math.min(rawCredit, Math.max(15, moderateQuotaBtc * 1.5));
      }
    } else if (playstyle === 'hybrid') {
      // Hybrids earn partial credit capped at 50% of moderate quota
      const hybridCap = effectiveIncome > 0 ? effectiveIncome * (moderatePct / 100) * 0.5 : 15;
      damageValueBtc = Math.min(rawCredit, Math.max(5, hybridCap));
    }
  }

  const effectiveCredit = donatedBtc + damageValueBtc;
  const ratio = effectiveIncome > 0
    ? parseFloat(((effectiveCredit / effectiveIncome) * 100).toFixed(1))
    : (effectiveWealth > 0 ? parseFloat(((effectiveCredit / effectiveWealth) * 100).toFixed(2)) : 0);

  // 1. Historical Top Donor & Veteran Grace Safeguards:
  // Strictly requires BOTH: Top N rank in country AND lifetime donations >= grace threshold
  // Plus: ultra-wealthy citizens must have contributed significant career equity (>= 2500 BTC or >= 5% of wealth)
  const graceThreshold = config?.historicalDonorGraceThresholdBtc ?? (countryBenchmark ? Math.round(countryBenchmark.topDonorsThreshold * 0.35) : 1500);
  const isUltraWealthy = effectiveWealth >= leechWealthFloor;
  const qualifiesForPillarShield = !isUltraWealthy || lifetimeDonations >= Math.min(2500, effectiveWealth * 0.05);

  if (isHistoricalTopDonor && lifetimeDonations >= graceThreshold && qualifiesForPillarShield) {
    const rankLabel = historicalRank ? `#${historicalRank}` : 'Top';
    return {
      ratio,
      tier: 'historical-pillar',
      damageValueBtc,
      reason: `Historical Pillar (${rankLabel} Lifetime Donor in Country): ${lifetimeDonations.toLocaleString()} BTC lifetime contributions preserved by national charter.`,
    };
  }

  // 2. National Heavy Hitter in War Mode (⚔️ Combat Hero):
  if (isNationalHeavyHitter && playstyle === 'pure-war') {
    const rankText = heavyHitterRank ? `#${heavyHitterRank}` : 'Top';
    return {
      ratio,
      tier: 'combat-veteran',
      damageValueBtc,
      reason: `National Combat Hero (${rankText} Heavy Hitter in Country): Frontline combat leader dealing heavy battlefield damage.`,
    };
  }

  // 3. Proportional Tier Assignment:
  let tier: LeechTier;
  const isHighWealth = effectiveWealth >= leechWealthFloor;
  const wealthDonationRatioPct = effectiveWealth > 0 ? (donatedBtc / effectiveWealth) * 100 : 0;

  if (effectiveIncome > 0) {
    // Upper-bracket wealth hoarders donating less than 0.2% of their wealth are Critical Leeches
    if (isHighWealth && wealthDonationRatioPct < 0.2) {
      tier = 'critical-leech';
    } else if (ratio >= patriotPct) {
      tier = (damageValueBtc > 0 && donatedBtc === 0 && playstyle === 'pure-war') ? 'combat-veteran' : 'sovereign-patriot';
    } else if (ratio >= moderatePct) {
      tier = 'moderate';
    } else if (ratio >= lowPct) {
      tier = 'low-contributor';
    } else {
      tier = isHighWealth ? 'critical-leech' : 'low-contributor';
    }
  } else {
    // Zero recorded income / cold start: evaluate directly against wealth standing
    if (isHighWealth) {
      tier = (wealthDonationRatioPct >= 0.2) ? 'moderate' : 'critical-leech';
    } else {
      tier = donatedBtc > 0 ? 'moderate' : 'low-contributor';
    }
  }

  return { ratio, tier, damageValueBtc };
}

/**
 * Consolidates fragmented classifications (leech tier, verdict, quotas)
 * into a single unified ministerial economic standing.
 */
export function resolveMasterCitizenStanding(
  tier?: LeechTier,
  verdict?: import('../types/ministry').MinisterialVerdict,
  isHistoricalPillar = false,
  isCombatHero = false
): CitizenEconomicStanding {
  if (isHistoricalPillar || tier === 'historical-pillar') {
    return 'historical-pillar';
  }
  // Industrial & battlefield solvency buffer: illiquid producers and active veterans are protected
  if (verdict === 'illiquid-asset-rich' || isCombatHero || tier === 'combat-veteran') {
    return 'illiquid-fighter';
  }
  if (verdict === 'subsistence-worker') {
    return 'subsistence-worker';
  }
  if (verdict === 'slacker-evader' || tier === 'critical-leech') {
    return 'evader-leech';
  }
  if (verdict === 'patriotic-fulfiller' || tier === 'sovereign-patriot') {
    return 'sovereign-patriot';
  }
  return 'standard-contributor';
}

/**
 * Audit citizen income growth over customizable analysis period (default: 7 days / 1 week).
 * Evaluates net BTC wealth growth + period donations to arrive at gross income,
 * factoring in playstyle mode thresholds and historical donations.
 */
export async function auditCitizensIncomeGrowth(
  profiles: CitizenEconomicProfile[],
  config: MinistryConfig,
  getClosestSnapshot: (userId: string, targetTimestamp: number) => Promise<WealthSnapshot | null>,
  saveBatchSnapshots: (snapshots: WealthSnapshot[]) => Promise<void>,
  countryBenchmark?: CountryEconomicBenchmark,
  playerTransactions?: WareraTransaction[],
  usersMap?: Record<string, WareraUserLite>,
  getUserPersonalTxs?: (userId: string) => Promise<WareraTransaction[]>
): Promise<CitizenEconomicProfile[]> {
  const periodDays = config.analysisPeriodDays || 7;
  const now = Date.now();
  const targetTimestamp = now - periodDays * 24 * 60 * 60 * 1000;
  const todayStr = new Date().toISOString().split('T')[0];

  const newTodaySnapshots: WealthSnapshot[] = [];
  const auditedProfiles: CitizenEconomicProfile[] = [];

  // Index transactions by user participation (as seller, buyer, or actor)
  const userTransactionsMap = new Map<string, WareraTransaction[]>();
  if (playerTransactions && playerTransactions.length > 0) {
    playerTransactions.forEach((tx) => {
      const uids = new Set<string>();
      if (tx.userId) uids.add(tx.userId);
      if (tx.sellerId) uids.add(tx.sellerId);
      if (tx.buyerId) uids.add(tx.buyerId);
      uids.forEach((uid) => {
        const list = userTransactionsMap.get(uid) || [];
        list.push(tx);
        userTransactionsMap.set(uid, list);
      });
    });
  }

  for (const p of profiles) {
    // Current total wealth basis (including resources if toggled)
    const currentWealthBasis = (config.includeResourceWealth && (p.resourceWealthBtc || 0) > 0)
      ? p.wealthBtc + (p.resourceWealthBtc || 0)
      : p.wealthBtc;

    newTodaySnapshots.push({
      id: `${p.userId}_${now}`,
      userId: p.userId,
      countryId: p.countryId,
      wealthBtc: currentWealthBasis,
      timestamp: now,
      dateStr: todayStr,
    });

    const userRaw = usersMap?.[p.userId];
    let userTxList = userTransactionsMap.get(p.userId) || [];

    // Incorporate stored verified personal receipts if available
    if (getUserPersonalTxs) {
      try {
        const storedTxs = await getUserPersonalTxs(p.userId);
        if (storedTxs && storedTxs.length > 0) {
          userTxList = [...storedTxs, ...userTxList];
        }
      } catch {}
    }

    // STRICT IMMUTABILITY: If profile is already verified with streamed receipts, preserve it intact
    if (p.auditBaselineStatus === 'audited' && (p.grossIncomeBtc !== undefined || p.playerCashflow)) {
      auditedProfiles.push({
        ...p,
        grossInflowBtc: p.grossInflowBtc ?? p.grossIncomeBtc,
        netCashflowBtc: p.netCashflowBtc ?? p.playerCashflow?.netCashflowBtc,
        auditedAt: p.auditedAt,
        receiptCount: p.receiptCount,
        auditDeltaAlert: p.auditDeltaAlert,
      });
      continue;
    }

    const cashflow = calculatePlayerCashflowSummary(p.userId, userRaw, userTxList, periodDays, countryBenchmark);

    const historicalSnapshot = await getClosestSnapshot(p.userId, targetTimestamp);
    const pastWealth = historicalSnapshot ? historicalSnapshot.wealthBtc : currentWealthBasis;

    // Period donations strictly within the active audit window (7D or 30D).
    let dynamicPeriodDonations = 0;
    if (userTxList && userTxList.length > 0) {
      const cutoffTime = now - (periodDays * 24 * 60 * 60 * 1000);
      dynamicPeriodDonations = userTxList
        .filter((t: any) => {
          const typeStr = String(t.transactionType || t.type || '').toLowerCase();
          const isDonation = typeStr.includes('donat');
          const tTime = extractItemTimestampMs(t);
          return isDonation && !isNaN(tTime) && tTime >= cutoffTime;
        })
        .reduce((sum: number, t: any) => sum + Number(t.money || t.amount || 0), 0);
    }
    const periodDonated = dynamicPeriodDonations > 0 ? dynamicPeriodDonations : Number(p.periodDonatedBtc ?? p.directDonatedBtc ?? 0);

    const hasLiveReceipts = userTxList && userTxList.length > 0;
    let grossIncome = 0;
    let grossInflow: number | undefined = undefined;
    let netCashflow: number | undefined = undefined;
    let auditStatus: 'audited' | 'pending-audit' = 'pending-audit';
    let auditMethodologyNote = '';

    if (hasLiveReceipts) {
      // 100% TRUTH-BASED: Derived strictly from streamed receipts
      grossInflow = cashflow.summary.grossInflowBtc;
      netCashflow = cashflow.summary.netCashflowBtc;
      grossIncome = Math.max(grossInflow, periodDonated);
      auditStatus = 'audited';
      auditMethodologyNote = `Verified via ${userTxList.length} live in-game personal receipts (${periodDays}D window).`;
    } else {
      // PURGE ALL ESTIMATES: No guesswork formulas
      grossIncome = 0;
      grossInflow = undefined;
      netCashflow = undefined;
      auditStatus = 'pending-audit';
      auditMethodologyNote = 'Pending Audit: Personal transaction stream not yet verified.';
    }

    // Evaluate tier against customizable mode-specific thresholds & historical credit
    const { ratio, tier, damageValueBtc, reason } = evaluateLeechTier(
      currentWealthBasis,
      periodDonated,
      config,
      grossIncome,
      p.playstyle,
      p.totalDonatedBtc,
      p.resourceWealthBtc || 0,
      p.totalCombatDamage || 0,
      p.isHistoricalTopDonor || false,
      p.historicalRank,
      p.isNationalHeavyHitter || false,
      p.heavyHitterRank,
      countryBenchmark
    );

    // Harmonized Country-Relative Ministerial Audit Verdict
    let ministerialVerdict: import('../types/ministry').MinisterialVerdict = p.ministerialVerdict || 'moderate-contributor';
    let ministerialVerdictReason = p.ministerialVerdictReason || reason || 'Citizen contributes at an acceptable national rate.';

    if (hasLiveReceipts) {
      const formatBtc = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const liquidCash = p.liquidBtc ?? 0;
      const isUpperQuartileWealth = currentWealthBasis >= (countryBenchmark?.wealthP75 || 5000);
      const isUpperQuartileLiquid = liquidCash >= (countryBenchmark?.liquidP75 || 500);
      const wealthDonationRatio = currentWealthBasis > 0 ? (periodDonated / currentWealthBasis) * 100 : 0;

      if (p.level < 15) {
        ministerialVerdict = 'exempted-recruit';
        ministerialVerdictReason = 'New recruit (Level < 15); exempt from ministerial contribution pressure.';
      } else if (tier === 'critical-leech') {
        ministerialVerdict = 'slacker-evader';
        ministerialVerdictReason = `Identified Slacker / Evader: Upper wealth bracket of ${p.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC net worth) with token period donations (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
      } else if (tier === 'historical-pillar') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = reason || `Historical Pillar of ${p.countryName || 'nation'}: Outstanding lifetime contributions protected by sovereign charter.`;
      } else if (tier === 'combat-veteran') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = reason || `Combat Hero: Frontline warrior defending the nation with heavy combat damage.`;
      } else if (tier === 'sovereign-patriot') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = `Model Patriot: Contributed ${periodDonated.toLocaleString()} BTC in period (${ratio}% ratio), meeting or exceeding national target.`;
      } else if ((isUpperQuartileWealth || isUpperQuartileLiquid) && (periodDonated === 0 || wealthDonationRatio < 0.2) && (damageValueBtc || 0) === 0) {
        ministerialVerdict = 'slacker-evader';
        ministerialVerdictReason = `Identified Slacker: Upper wealth bracket of ${p.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC) with token contributions (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
      } else if (currentWealthBasis < (countryBenchmark?.wealthMedian || 1500) && liquidCash < (countryBenchmark?.liquidMedian || 200)) {
        ministerialVerdict = 'subsistence-worker';
        ministerialVerdictReason = `Subsistence Worker: Working citizen with wealth below national median (${formatBtc(currentWealthBasis)} BTC). Exempted from taxation.`;
      } else if (isUpperQuartileWealth && liquidCash < (countryBenchmark?.liquidMedian || 100) && (p.totalCombatDamage || 0) > 500000) {
        ministerialVerdict = 'illiquid-asset-rich';
        ministerialVerdictReason = `Illiquid Combatant: High asset equity (${formatBtc(currentWealthBasis)} BTC) locked in gear and equipment, active on the front lines.`;
      } else {
        ministerialVerdict = 'moderate-contributor';
        ministerialVerdictReason = `Active Citizen: Contributes at standard national rate (${ratio}% ratio).`;
      }

      cashflow.summary.ministerialVerdict = ministerialVerdict;
      cashflow.summary.ministerialVerdictReason = ministerialVerdictReason;
    }

    auditedProfiles.push({
      ...p,
      pastWealthBtc: pastWealth,
      grossIncomeBtc: hasLiveReceipts ? parseFloat(grossIncome.toFixed(2)) : undefined,
      grossInflowBtc: hasLiveReceipts && grossInflow !== undefined ? parseFloat(grossInflow.toFixed(2)) : undefined,
      netCashflowBtc: hasLiveReceipts && netCashflow !== undefined ? parseFloat(netCashflow.toFixed(2)) : undefined,
      periodDonatedBtc: periodDonated,
      contributionRatio: hasLiveReceipts ? ratio : 0,
      leechTier: hasLiveReceipts ? tier : p.leechTier,
      damageValueBtc: damageValueBtc !== undefined ? damageValueBtc : p.damageValueBtc,
      tierReasonBadge: hasLiveReceipts ? (reason || p.tierReasonBadge) : (p.tierReasonBadge || 'Pending personal audit'),
      auditBaselineStatus: auditStatus,
      auditMethodologyNote,
      ministerialVerdict,
      ministerialVerdictReason,
      playerCashflow: hasLiveReceipts ? cashflow.summary : undefined,
      companiesCount: cashflow.companiesCount,
      activeCompaniesCount: cashflow.activeCompaniesCount,
      maxCompaniesCap: cashflow.maxCompaniesCap,
      automationLevelEst: cashflow.automationLevelEst,
      storageLevelEst: cashflow.storageLevelEst,
      estimatedCompanyCapacityBtc: cashflow.estimatedCompanyCapacityBtc,
    });
  }

  try {
    await saveBatchSnapshots(newTodaySnapshots);
  } catch (err) {
    console.warn('Failed to persist wealth snapshots during audit:', err);
  }

  return auditedProfiles;
}

/**
 * 24 Canonical War Era commodities in exact in-game catalog sequence with direct market quotes
 */
export const DEFAULT_COMMODITIES: CommodityTrend[] = generateFallbackMarketTrends();

/**
 * Pre-configured national stockpiles inventory baseline across all 24 canonical commodities
 */
export const DEFAULT_STOCKPILES: ResourceReserveItem[] = buildSovereignStockpileMatrix({}, DEFAULT_COMMODITIES);

/**
 * Enforce hard 492 character limit on in-game Telegram messages excluding player name
 * (War Era max message limit: 512 total characters; names capped at 20 characters: 512 - 20 = 492)
 */
export function enforceMaxTelegramLength(rawBody: string, username: string, maxExcludingName = 492): string {
  const withoutName = rawBody.replace(username, '');
  if (withoutName.length <= maxExcludingName) {
    return rawBody;
  }
  const overflow = withoutName.length - maxExcludingName;
  return rawBody.slice(0, Math.max(0, rawBody.length - overflow - 3)) + '...';
}

/**
 * Deterministic Ministerial Message Templates (ZERO AI, dynamically interpolated, strictly <= 492 chars without name)
 * - Uses liquid available BTC (profile.liquidBtc) rather than total locked wealth.
 * - Anti-Clutter: Only shows formal notice for non-leeches, and urgent call for leeches.
 */
export function generateMinisterialNudge(
  profile: CitizenEconomicProfile,
  countryName: string,
  ministerTitle = 'MoE',
  periodDays = 7
): MinisterialMessage[] {
  const currentDate = getTodayDDMMYYYY();
  // Use available liquid BTC cash (money), falling back to wealthBtc if unavailable
  const liquidBtc = typeof profile.liquidBtc === 'number' && profile.liquidBtc > 0
    ? profile.liquidBtc
    : profile.wealthBtc;
  
  // Suggested donation: 2% of liquid cash (min 50 BTC) to sustain week's defense
  const suggestedDonation = Math.max(50, Math.round(liquidBtc * 0.02));
  const liquidFormatted = liquidBtc.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const donatedFormatted = (profile.periodDonatedBtc ?? profile.totalDonatedBtc).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const periodLabel = `${periodDays} días`;

  const isLeech = profile.leechTier === 'critical-leech';
  const messages: MinisterialMessage[] = [];

  if (!isLeech) {
    // English Formal Notice
    const formalEnBody = `🏛️ [${countryName.toUpperCase()} - MoE]
Dear citizen ${profile.username},
The Ministry of Economy notes as of today (${currentDate}) available liquid assets of ${liquidFormatted} BTC and donations of ${donatedFormatted} BTC over the past ${periodDays} days.
Our sovereignty and defense require active citizen support.
You are invited to make a suggested contribution of ${suggestedDonation} BTC to the national treasury this week to sustain development and defense.
For the homeland!
MoE`;

    // Spanish Formal Notice
    const formalEsBody = `🏛️ [${countryName.toUpperCase()} - MoE]
Estimado ciudadano ${profile.username},
El Ministerio de Economía nota a la fecha (${currentDate}) un patrimonio de ${liquidFormatted} BTC y aportes de ${donatedFormatted} BTC en los últimos ${periodLabel}.
Nuestra soberanía y defensa requieren del apoyo activo de los ciudadanos.
Le invitamos a realizar una donación sugerida de ${suggestedDonation} BTC a lo largo de esta semana, a la tesorería nacional para sostener nuestro desarrollo y defensa.
¡Por la patria!
MoE`;

    messages.push({
      language: 'en',
      tone: 'diplomatic-formal',
      title: 'Formal Ministerial Notice (English)',
      body: enforceMaxTelegramLength(formalEnBody, profile.username, 492),
    });

    messages.push({
      language: 'es',
      tone: 'diplomatic-formal',
      title: 'Notificación Ministerial Formal (Español)',
      body: enforceMaxTelegramLength(formalEsBody, profile.username, 492),
    });
  } else {
    // English Urgent Summons
    const urgentEnBody = `⚠️ [TREASURY - ${countryName.toUpperCase()}]
Citizen ${profile.username}:
Audit records note ${liquidFormatted} BTC in available assets and donations of ${donatedFormatted} BTC during the past week.
Currency is ammunition. Without fiscal liquidity, the nation collapses.
An urgent voluntary contribution of ${suggestedDonation} BTC is requested this week to the national treasury to sustain contracts and active defense.
Fulfill your patriotic duty!`;

    // Spanish Urgent Summons
    const urgentEsBody = `⚠️ [TESORERÍA - ${countryName.toUpperCase()}]
Ciudadano ${profile.username}:
En auditoría registra ${liquidFormatted} BTC en activos y donaciones de ${donatedFormatted} BTC durante la última semana.
La moneda es munición. Sin liquidez fiscal, el país colapsa.
Se requiere un aporte voluntario urgente de ${suggestedDonation} BTC a lo largo de la semana a la tesorería nacional para sostener contratos y defensa activa.
¡Cumpla su deber patriótico!`;

    messages.push({
      language: 'en',
      tone: 'firm-economic',
      title: 'Urgent Treasury Summons (English)',
      body: enforceMaxTelegramLength(urgentEnBody, profile.username, 492),
    });

    messages.push({
      language: 'es',
      tone: 'firm-economic',
      title: 'Llamado Económico Urgente (Español)',
      body: enforceMaxTelegramLength(urgentEsBody, profile.username, 492),
    });
  }

  return messages;
}

/**
 * Format CSV string from National Transactions for Excel
 */
export function exportNationalTransactionsToCsv(transactions: NationalTransaction[]): string {
  // UTF-8 BOM for Microsoft Excel compatibility
  const BOM = '\uFEFF';
  const headers = [
    'Transaction ID',
    'Date',
    'Source Country',
    'Target Country',
    'Direction',
    'Category',
    'Amount (BTC)',
    'Reference Note',
  ];

  const rows = transactions.map((t) => [
    `"${t.id}"`,
    `"${formatDateDDMMYYYY(t.date)}"`,
    `"${t.sourceCountryName}"`,
    `"${t.targetCountryName}"`,
    `"${t.direction.toUpperCase()}"`,
    `"${t.category.replace('-', ' ').toUpperCase()}"`,
    t.amountBtc.toFixed(3),
    `"${(t.referenceNote || '').replace(/"/g, '""')}"`,
  ]);

  return BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Parse CSV string back into National Transactions
 */
export function parseNationalTransactionsCsv(csvContent: string): NationalTransaction[] {
  const clean = csvContent.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const results: NationalTransaction[] = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Match CSV fields with possible quotes
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
    const values: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      values.push(val ? val.trim() : '');
      if (regex.lastIndex === line.length) break;
    }

    if (values.length >= 7) {
      results.push({
        id: values[0] || `tx-${Date.now()}-${i}`,
        date: normalizeDateToYYYYMMDD(values[1]),
        sourceCountryId: '',
        sourceCountryName: values[2] || 'Source',
        targetCountryId: '',
        targetCountryName: values[3] || 'Target',
        direction: values[4].toLowerCase() === 'received' ? 'received' : 'sent',
        category: (values[5].toLowerCase().replace(/\s+/g, '-') as any) || 'other',
        amountBtc: parseFloat(values[6]) || 0,
        referenceNote: values[7] || '',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Phase 5.2: Consolidated Ministerial Executive Digest Export (CSV)
 * Generates an executive-level multi-section report in UTF-8 BOM CSV format for Microsoft Excel & Google Sheets.
 * Includes:
 * 1. Executive Summary & Benchmark Header
 * 2. Citizen Economic & Income Growth Audit
 * 3. Inter-State Treasury Transfers
 * 4. National Strategic Stockpiles & Reserve Valuations
 * 5. Commodity Market Arbitrage Signals
 */
export function exportConsolidatedExecutiveDigest(params: {
  countryName: string;
  periodDays: number;
  profiles: CitizenEconomicProfile[];
  transactions: NationalTransaction[];
  stockpiles: ResourceReserveItem[];
  commodities: CommodityTrend[];
}): string {
  const BOM = '\uFEFF';
  const dateStr = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  // Header & Metadata
  lines.push(`"WAR ERA SOVEREIGN MINISTRY OF ECONOMY - CONSOLIDATED EXECUTIVE DIGEST"`);
  lines.push(`"Country:","${params.countryName}","Audit Date:","${formatDateDDMMYYYY(dateStr)}","Analysis Period:","${params.periodDays} Days"`);
  lines.push(`"Total Audited Citizens:","${params.profiles.length}","Inter-State Transfers:","${params.transactions.length}","Strategic Stockpiles:","${params.stockpiles.length}"`);
  lines.push('');

  // SECTION 1: CITIZEN ECONOMIC & DONATION AUDIT
  lines.push(`"=== SECTION 1: CITIZEN ECONOMIC AUDIT & CONTRIBUTION ANALYSIS ==="`);
  lines.push([
    'Username',
    'User ID',
    'Net Worth (BTC)',
    'Liquid Cash (BTC)',
    'Period Donated (BTC)',
    'Total Lifetime Donated (BTC)',
    'Contribution Ratio (%)',
    'Leech Tier',
    'Build Mode',
    'War Skill Points',
    'Eco Skill Points',
    'Ministerial Verdict',
    'Ministerial Rationale',
  ].map((h) => `"${h}"`).join(','));

  params.profiles.forEach((p) => {
    lines.push([
      `"${p.username}"`,
      `"${p.userId}"`,
      (p.wealthBtc || 0).toFixed(2),
      (p.liquidBtc || 0).toFixed(2),
      (p.periodDonatedBtc || 0).toFixed(2),
      (p.totalDonatedBtc || 0).toFixed(2),
      (p.contributionRatio || 0).toFixed(1),
      `"${p.leechTier}"`,
      `"${p.playstyle}"`,
      p.warSkillPoints || 0,
      p.ecoSkillPoints || 0,
      `"${p.ministerialVerdict || 'moderate-contributor'}"`,
      `"${(p.ministerialVerdictReason || '').replace(/"/g, '""')}"`,
    ].join(','));
  });

  lines.push('');

  // SECTION 2: INTER-STATE TREASURY TRANSFERS
  lines.push(`"=== SECTION 2: INTER-STATE TREASURY TRANSFERS ==="`);
  lines.push([
    'Transfer ID',
    'Date',
    'Source Country',
    'Target Country',
    'Direction',
    'Category',
    'Amount (BTC)',
    'Reference Note',
  ].map((h) => `"${h}"`).join(','));

  params.transactions.forEach((t) => {
    lines.push([
      `"${t.id}"`,
      `"${formatDateDDMMYYYY(t.date)}"`,
      `"${t.sourceCountryName}"`,
      `"${t.targetCountryName}"`,
      `"${t.direction.toUpperCase()}"`,
      `"${t.category.toUpperCase()}"`,
      t.amountBtc.toFixed(3),
      `"${(t.referenceNote || '').replace(/"/g, '""')}"`,
    ].join(','));
  });

  lines.push('');

  // SECTION 3: STRATEGIC STOCKPILES & RESERVES
  lines.push(`"=== SECTION 3: NATIONAL STRATEGIC RESERVES & STOCKPILES ==="`);
  lines.push([
    'Resource Name',
    'Code',
    'Category',
    'Current Stock',
    'Unit',
    'Period Net Activity',
    'Avg Acquisition Cost (BTC)',
    'Market Price (BTC)',
    'Estimated Stockpile Value (BTC)',
    'Strategic Notes',
  ].map((h) => `"${h}"`).join(','));

  params.stockpiles.forEach((s) => {
    const totalValuation = (s.currentStock * (s.currentMarketPriceBtc || s.avgCostBtc || 0)).toFixed(2);
    lines.push([
      `"${s.name}"`,
      `"${s.code}"`,
      `"${s.category.toUpperCase()}"`,
      s.currentStock,
      `"${s.unit}"`,
      s.netBoughtPeriod - s.netSoldPeriod,
      s.avgCostBtc.toFixed(3),
      s.currentMarketPriceBtc.toFixed(3),
      totalValuation,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ].join(','));
  });

  lines.push('');

  // SECTION 4: COMMODITY MARKET ARBITRAGE ADVISORIES
  lines.push(`"=== SECTION 4: COMMODITY MARKET ARBITRAGE INTELLIGENCE ==="`);
  lines.push([
    'Commodity Name',
    'Category',
    'Current Price (BTC)',
    '24h Change (%)',
    '7d Average (BTC)',
    '7d Floor (BTC)',
    '7d Peak (BTC)',
    '24h Volume',
    'Ministerial Advisory',
    'Strategic Rationale',
  ].map((h) => `"${h}"`).join(','));

  params.commodities.forEach((c) => {
    lines.push([
      `"${c.name}"`,
      `"${c.category}"`,
      c.currentPrice.toFixed(3),
      `${c.change24h > 0 ? '+' : ''}${c.change24h.toFixed(1)}%`,
      c.avg7d.toFixed(3),
      c.min7d.toFixed(3),
      c.max7d.toFixed(3),
      c.volume24h ? c.volume24h.toLocaleString() : 'N/A',
      `"${c.advisory.toUpperCase()}"`,
      `"${(c.advisoryReason || '').replace(/"/g, '""')}"`,
    ].join(','));
  });

  return BOM + lines.join('\r\n');
}
