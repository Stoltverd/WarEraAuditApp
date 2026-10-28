import { WareraUserLite, WareraCountry, WareraTransaction } from '../types/warera';
import { extractItemTimestampMs, compareTransactionsNewestFirst } from './apiService';
import {
  CANONICAL_24_COMMODITIES,
  generateFallbackMarketTrends,
  getCachedOrFallbackMarketTrends,
  buildSovereignStockpileMatrix,
} from './marketService';
import {
  evaluateCompanyWorkforce,
  resolveCommodityLivePriceBtc,
  getItemProductionRecipe,
} from './workforceService';
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
  NudgeArchetype,
  CitizenNudgeRecommendation,
} from '../types/ministry';

export type { MinisterialMessage, NudgeArchetype, CitizenNudgeRecommendation };

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
  const commodityByItemPurchasesBtc: Record<string, number> = {};
  const commodityByItemSalesBtc: Record<string, number> = {};
  let constructionPurchasesBtc = 0;
  let constructionSalesBtc = 0;
  let ironSteelPurchasesBtc = 0;
  let ironSteelSalesBtc = 0;
  let concreteLimestonePurchasesBtc = 0;
  let concreteLimestoneSalesBtc = 0;

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
      // 3. Commodity / Resource Trading transactions (Trading tab - All raw & manufactured goods)
      else if (tType === 'trading' || tType === 'trade' || tType === 'market') {
        const itemCode = String(t.item || t.resourceType || '').toLowerCase().trim();
        const isIronOrSteel = itemCode === 'iron' || itemCode === 'steel' || itemCode.includes('iron') || itemCode.includes('steel');
        const isConcreteOrLimestone =
          itemCode === 'concrete' ||
          itemCode === 'limestone' ||
          itemCode === 'stone' ||
          itemCode.includes('concrete') ||
          itemCode.includes('limestone');

        if (isSeller) {
          salesVolumeBtc += amt;
          commoditySalesBtc += amt;
          salesCount++;
          if (itemCode) {
            resourceCounts[itemCode] = (resourceCounts[itemCode] || 0) + 1;
            commodityByItemSalesBtc[itemCode] = Math.round(((commodityByItemSalesBtc[itemCode] || 0) + amt) * 100) / 100;
          }
          if (isIronOrSteel) {
            ironSteelSalesBtc += amt;
            constructionSalesBtc += amt;
          } else if (isConcreteOrLimestone) {
            concreteLimestoneSalesBtc += amt;
            constructionSalesBtc += amt;
          }
        } else if (isBuyer || isActor) {
          purchasesVolumeBtc += amt;
          commodityPurchasesBtc += amt;
          purchasesCount++;
          if (itemCode) {
            commodityByItemPurchasesBtc[itemCode] = Math.round(((commodityByItemPurchasesBtc[itemCode] || 0) + amt) * 100) / 100;
          }
          if (isIronOrSteel) {
            ironSteelPurchasesBtc += amt;
            constructionPurchasesBtc += amt;
          } else if (isConcreteOrLimestone) {
            concreteLimestonePurchasesBtc += amt;
            constructionPurchasesBtc += amt;
          }
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
  const resourceWealthBtc = typeof user?.stats?.wealth === 'object' && user.stats.wealth.items !== undefined
    ? Number(user.stats.wealth.items)
    : Number((user as any)?.resourceWealth ?? (user as any)?.resourcesValue ?? 0);

  const hasValidBenchmark = Boolean(countryBenchmark && countryBenchmark.totalActiveCitizens > 0);
  const upperQuartileWealth = hasValidBenchmark ? countryBenchmark!.wealthP75 : 5000;
  const upperQuartileLiquid = hasValidBenchmark ? Math.max(25, countryBenchmark!.liquidP75) : 500;
  const medianWealth = hasValidBenchmark ? countryBenchmark!.wealthMedian : 1500;
  const medianLiquid = hasValidBenchmark ? Math.max(10, countryBenchmark!.liquidMedian) : 200;
  const upperQuartileResource = hasValidBenchmark ? Math.max(25, countryBenchmark!.resourceP75 || 0) : 500;
  const medianResource = hasValidBenchmark ? Math.max(10, countryBenchmark!.resourceMedian || 0) : 150;
  const medianIncome = hasValidBenchmark ? Math.max(10, countryBenchmark!.incomeMedian || 0) : 250;
  const topCombatDamageThreshold = hasValidBenchmark
    ? Math.max(50000, (countryBenchmark!.fighterDamageMedianTopTier || 500000) * 0.4)
    : 500000;

  let solvencyStatus: 'solvent-liquid' | 'illiquid-locked' | 'subsistence' = 'solvent-liquid';
  if (liquidBtc >= upperQuartileLiquid || resourceWealthBtc >= upperQuartileResource) {
    solvencyStatus = 'solvent-liquid';
  } else if (
    liquidBtc < medianLiquid &&
    resourceWealthBtc < medianResource &&
    Number(user?.rankings?.userDamages?.value || 0) >= topCombatDamageThreshold
  ) {
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
  const isHoardingLiquid = liquidBtc >= Math.max(upperQuartileLiquid, medianLiquid * 2) && liquidBtc > 0;
  const isHoardingResources = resourceWealthBtc >= Math.max(upperQuartileResource, medianResource * 2) && resourceWealthBtc > 0;
  const isUpperBracketStock = netWorth >= upperQuartileWealth || isHoardingLiquid || isHoardingResources;

  if (userLevel > 0 && userLevel < 15) {
    ministerialVerdict = 'exempted-recruit';
    ministerialVerdictReason = 'New recruit (Level < 15); exempt from ministerial contribution pressure.';
  } else if (donationsGivenBtc > 0 && netDisposableIncomeBtc > 0 && donationsGivenBtc >= (netDisposableIncomeBtc * 0.15)) {
    ministerialVerdict = 'patriotic-fulfiller';
    ministerialVerdictReason = `Model Patriot; contributed ${donationsGivenBtc.toLocaleString()} BTC in period (${Math.round((donationsGivenBtc / netDisposableIncomeBtc) * 100)}% of net cashflow).`;
  } else if (isUpperBracketStock && (donationsGivenBtc <= 0 || wealthDonationRatioPct < 0.2)) {
    ministerialVerdict = 'slacker-evader';
    if (isHoardingLiquid) {
      ministerialVerdictReason = `Identified Slacker / Liquid Hoarder: Holds ${liquidBtc.toLocaleString()} BTC idle liquid cash (country median: ${medianLiquid.toLocaleString()} BTC) with token period contributions (${donationsGivenBtc.toLocaleString()} BTC).`;
    } else if (isHoardingResources) {
      ministerialVerdictReason = `Identified Slacker / Resource Stockpiler: Holds ${resourceWealthBtc.toLocaleString()} BTC in commodity stockpiles (country median: ${medianResource.toLocaleString()} BTC) with token period contributions (${donationsGivenBtc.toLocaleString()} BTC).`;
    } else {
      ministerialVerdictReason = `Identified Slacker / Evader: Upper wealth bracket (${netWorth.toLocaleString()} BTC net worth vs country P75 ${upperQuartileWealth.toLocaleString()} BTC) with token period contributions (${donationsGivenBtc.toLocaleString()} BTC, ${wealthDonationRatioPct.toFixed(2)}% of wealth).`;
    }
  } else if (donationsGivenBtc > 0 && netDisposableIncomeBtc > 0 && donationsGivenBtc >= (netDisposableIncomeBtc * 0.07)) {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = `Active contributor: Contributed ${donationsGivenBtc.toLocaleString()} BTC in period.`;
  } else if (donationsGivenBtc > 0) {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = `Active contributor: Contributed ${donationsGivenBtc.toLocaleString()} BTC in period.`;
  } else if (
    netWorth < medianWealth &&
    liquidBtc < medianLiquid &&
    resourceWealthBtc < medianResource &&
    (grossInflowBtc <= 0 || grossInflowBtc < medianIncome)
  ) {
    ministerialVerdict = 'subsistence-worker';
    ministerialVerdictReason = `Subsistence Worker: Below national median wealth (${netWorth.toLocaleString()} BTC vs median ${medianWealth.toLocaleString()} BTC) and liquid cash. Protected from contribution pressure.`;
  } else {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = 'Evaluated against national comparative median baseline.';
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
      constructionPurchasesBtc: Math.round(constructionPurchasesBtc * 100) / 100,
      constructionSalesBtc: Math.round(constructionSalesBtc * 100) / 100,
      ironSteelPurchasesBtc: Math.round(ironSteelPurchasesBtc * 100) / 100,
      ironSteelSalesBtc: Math.round(ironSteelSalesBtc * 100) / 100,
      concreteLimestonePurchasesBtc: Math.round(concreteLimestonePurchasesBtc * 100) / 100,
      concreteLimestoneSalesBtc: Math.round(concreteLimestoneSalesBtc * 100) / 100,
      commodityByItemPurchasesBtc,
      commodityByItemSalesBtc,
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
  const periodDonated = Math.max(
    recalculated.summary.donationsGivenBtc || 0,
    profile.periodDonatedBtc ?? profile.directDonatedBtc ?? 0
  );
  const newGross = Math.max(verifiedGrossInflow, periodDonated);
  const verifiedRatio = newGross > 0 ? Math.round((periodDonated / newGross) * 1000) / 10 : 0;

  const currentWealthBasis =
    config.includeResourceWealth && (profile.resourceWealthBtc || 0) > 0
      ? profile.wealthBtc + (profile.resourceWealthBtc || 0)
      : profile.wealthBtc;

  const tierEval = evaluateLeechTier(
    currentWealthBasis,
    periodDonated,
    { ...config, analysisPeriodDays: windowDays },
    newGross,
    profile.playstyle,
    profile.totalDonatedBtc,
    profile.resourceWealthBtc || 0,
    profile.totalCombatDamage || 0,
    profile.isHistoricalTopDonor || false,
    profile.historicalRank,
    profile.isNationalHeavyHitter || false,
    profile.heavyHitterRank,
    countryBenchmark,
    profile.liquidBtc
  );

  // Harmonized Country-Relative Ministerial Audit Verdict (identical to auditCitizensIncomeGrowth)
  const formatBtc = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const liquidCash = profile.liquidBtc ?? 0;
  const resourceStock = profile.resourceWealthBtc ?? 0;
  const hasBench = Boolean(countryBenchmark && countryBenchmark.totalActiveCitizens > 0);
  const isUpperQuartileWealth = currentWealthBasis >= (hasBench ? countryBenchmark!.wealthP75 : 5000);
  const isUpperQuartileLiquid = liquidCash >= (hasBench ? Math.max(25, countryBenchmark!.liquidP75) : 500);
  const isUpperQuartileResource = resourceStock >= (hasBench ? Math.max(25, countryBenchmark!.resourceP75 || 0) : 500);
  const countryCombatThreshold = hasBench
    ? Math.max(50000, (countryBenchmark!.fighterDamageMedianTopTier || 250000) * 0.4)
    : 250000;
  const wealthDonationRatio = currentWealthBasis > 0 ? (periodDonated / currentWealthBasis) * 100 : 0;

  let ministerialVerdict: import('../types/ministry').MinisterialVerdict =
    recalculated.summary.ministerialVerdict || profile.ministerialVerdict || 'moderate-contributor';
  let ministerialVerdictReason =
    recalculated.summary.ministerialVerdictReason ||
    profile.ministerialVerdictReason ||
    tierEval.reason ||
    'Citizen contributes at an acceptable national rate.';

  if (profile.level < 15) {
    ministerialVerdict = 'exempted-recruit';
    ministerialVerdictReason = 'New recruit (Level < 15); exempt from ministerial contribution pressure.';
  } else if (tierEval.tier === 'critical-leech') {
    ministerialVerdict = 'slacker-evader';
    ministerialVerdictReason =
      tierEval.reason ||
      `Identified Slacker / Evader: Upper wealth/stock bracket of ${profile.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC net worth) with token period donations (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
  } else if (tierEval.tier === 'historical-pillar') {
    ministerialVerdict = 'patriotic-fulfiller';
    ministerialVerdictReason =
      tierEval.reason ||
      `Historical Pillar of ${profile.countryName || 'nation'}: Outstanding lifetime contributions protected by sovereign charter.`;
  } else if (tierEval.tier === 'combat-veteran') {
    ministerialVerdict = 'patriotic-fulfiller';
    ministerialVerdictReason =
      tierEval.reason ||
      `Combat Hero: Frontline warrior defending the nation with heavy combat damage.`;
  } else if (tierEval.tier === 'sovereign-patriot') {
    ministerialVerdict = 'patriotic-fulfiller';
    ministerialVerdictReason = `Model Patriot: Contributed ${periodDonated.toLocaleString()} BTC in period (${tierEval.ratio}% ratio), meeting or exceeding national target.`;
  } else if (
    (isUpperQuartileWealth || isUpperQuartileLiquid || isUpperQuartileResource) &&
    (periodDonated === 0 || wealthDonationRatio < 0.2) &&
    (tierEval.damageValueBtc || 0) === 0
  ) {
    ministerialVerdict = 'slacker-evader';
    ministerialVerdictReason =
      tierEval.reason ||
      `Identified Slacker: Upper wealth/stockpile bracket of ${profile.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC) with token contributions (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
  } else if (
    currentWealthBasis < (hasBench ? countryBenchmark!.wealthMedian : 1500) &&
    liquidCash < (hasBench ? countryBenchmark!.liquidMedian : 200) &&
    resourceStock < (hasBench ? countryBenchmark!.resourceMedian || 150 : 150)
  ) {
    ministerialVerdict = 'subsistence-worker';
    ministerialVerdictReason = `Subsistence Worker: Working citizen with wealth and liquidity below national median (${formatBtc(currentWealthBasis)} BTC). Exempted from taxation.`;
  } else if (
    isUpperQuartileWealth &&
    liquidCash < (hasBench ? countryBenchmark!.liquidMedian : 100) &&
    resourceStock < (hasBench ? countryBenchmark!.resourceP75 || 250 : 250) &&
    (profile.totalCombatDamage || 0) >= countryCombatThreshold
  ) {
    ministerialVerdict = 'illiquid-asset-rich';
    ministerialVerdictReason = `Illiquid Combatant: High asset equity (${formatBtc(currentWealthBasis)} BTC) locked in gear and factories, active on the front lines.`;
  } else {
    ministerialVerdict = 'moderate-contributor';
    ministerialVerdictReason = `Active Citizen: Contributes at standard national rate (${tierEval.ratio}% ratio).`;
  }

  recalculated.summary.ministerialVerdict = ministerialVerdict;
  recalculated.summary.ministerialVerdictReason = ministerialVerdictReason;

  const newStanding = resolveMasterCitizenStanding(
    tierEval.tier,
    ministerialVerdict,
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
    contributionRatio: tierEval.ratio > 0 ? tierEval.ratio : verifiedRatio,
    leechTier: tierEval.tier,
    economicStanding: newStanding,
    damageValueBtc: tierEval.damageValueBtc,
    tierReasonBadge: tierEval.reason || profile.tierReasonBadge,
    ministerialVerdict,
    ministerialVerdictReason,
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
  officialActiveCount?: number,
  auditedIncomesMap?: Map<string, number>,
  periodDonationsMap?: Map<string, number>
): CountryEconomicBenchmark {
  const activeCitizens = citizens.filter((c) => {
    const isActive = Boolean(c.isActive !== undefined ? c.isActive : true);
    const lvl = Number(c.leveling?.level ?? c.level ?? 0);
    return isActive && lvl >= 10;
  });

  const count = (typeof officialActiveCount === 'number' && officialActiveCount > 0)
    ? officialActiveCount
    : activeCitizens.length;

  if (count === 0 || activeCitizens.length === 0) {
    return {
      countryId,
      totalActiveCitizens: 0,
      wealthP25: 100,
      wealthMedian: 300,
      wealthP75: 1000,
      wealthP90: 2500,
      liquidMedian: 50,
      liquidP75: 200,
      resourceMedian: 50,
      resourceP75: 200,
      incomeMedian: 100,
      incomeP75: 300,
      donationMedian: 25,
      donationP75: 100,
      topDonorsThreshold: 100,
      fighterDamageMedianTopTier: 250000,
      heavyHitterCohortSize: 3,
    };
  }

  const computePercentile = (sortedArr: number[], pct: number): number => {
    if (!sortedArr || sortedArr.length === 0) return 0;
    const pos = (sortedArr.length - 1) * pct;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return Math.round((sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base])) * 100) / 100;
    }
    return Math.round(sortedArr[base] * 100) / 100;
  };

  // 1. Extract and sort net worths (100% scale-invariant, zero artificial BTC floors)
  const wealthValues = activeCitizens
    .map((c) => Number(c.rankings?.userWealth?.value || (typeof c.stats?.wealth === 'object' ? c.stats.wealth.total : c.stats?.wealth) || 0))
    .sort((a, b) => a - b);

  const wealthP25 = computePercentile(wealthValues, 0.25);
  const wealthMedian = computePercentile(wealthValues, 0.5);
  const wealthP75 = computePercentile(wealthValues, 0.75);
  const wealthP90 = computePercentile(wealthValues, 0.90);

  // 2. Extract and sort liquid cash values (strictly relative to this country)
  const liquidValues = activeCitizens
    .map((c) => {
      const wealthObj = typeof c.stats?.wealth === 'object' ? c.stats.wealth : null;
      return Number(wealthObj?.money !== undefined ? wealthObj.money : (c.money ?? 0));
    })
    .sort((a, b) => a - b);

  const liquidMedian = computePercentile(liquidValues, 0.5);
  const liquidP75 = computePercentile(liquidValues, 0.75);

  // 3. Extract and sort commodity/resource stockpile wealth (strictly relative to this country)
  const resourceValues = activeCitizens
    .map((c) => {
      const wealthObj = typeof c.stats?.wealth === 'object' ? c.stats.wealth : null;
      return Number(wealthObj?.items !== undefined ? wealthObj.items : ((c as any).resourceWealth ?? (c as any).resourcesValue ?? 0));
    })
    .sort((a, b) => a - b);

  const resourceMedian = computePercentile(resourceValues, 0.5);
  const resourceP75 = computePercentile(resourceValues, 0.75);

  // 4. Extract and sort weekly gross income / cashflow values (from audited profiles or proportional turnover proxy)
  const incomeValues: number[] = [];
  activeCitizens.forEach((c) => {
    const auditedInc = auditedIncomesMap?.get(c._id);
    if (typeof auditedInc === 'number' && auditedInc > 0) {
      incomeValues.push(auditedInc);
    } else {
      const wealthObj = typeof c.stats?.wealth === 'object' ? c.stats.wealth : null;
      const compVal = Number(wealthObj?.companies || 0);
      const liqVal = Number(wealthObj?.money !== undefined ? wealthObj.money : (c.money ?? 0));
      const estimatedWeeklyFlow = Math.max(0, Math.round((compVal * 0.08 + liqVal * 0.15) * 100) / 100);
      if (estimatedWeeklyFlow > 0) incomeValues.push(estimatedWeeklyFlow);
    }
  });
  incomeValues.sort((a, b) => a - b);
  const incomeMedian = incomeValues.length > 0 ? computePercentile(incomeValues, 0.5) : Math.max(20, Math.round(wealthMedian * 0.08));
  const incomeP75 = incomeValues.length > 0 ? computePercentile(incomeValues, 0.75) : Math.max(50, Math.round(wealthP75 * 0.08));

  // 5. Extract and sort period or lifetime donation amounts among active contributors
  const donationValues: number[] = [];
  if (periodDonationsMap && periodDonationsMap.size > 0) {
    periodDonationsMap.forEach((amt) => {
      if (amt > 0) donationValues.push(amt);
    });
  } else {
    cumulativeMap.forEach((d) => {
      if (d.totalAmount > 0) donationValues.push(d.totalAmount);
    });
  }
  donationValues.sort((a, b) => a - b);
  const donationMedian = donationValues.length > 0 ? computePercentile(donationValues, 0.5) : Math.max(10, Math.round(incomeMedian * 0.1));
  const donationP75 = donationValues.length > 0 ? computePercentile(donationValues, 0.75) : Math.max(25, Math.round(incomeP75 * 0.15));

  // 6. Extract fighter damage distribution (scale-invariant, zero hardcoded 5M floor)
  const damageValues: number[] = [];
  activeCitizens.forEach((c) => {
    const dmg = fightersDamageMap?.get(c._id) ?? Number(
      c.rankings?.weeklyUserDamages?.value ||
      c.rankings?.userDamages?.value ||
      (c.rankings as any)?.countryDamages?.value ||
      (c as any).stats?.damage ||
      0
    );
    if (dmg > 0) damageValues.push(dmg);
  });
  damageValues.sort((a, b) => b - a);

  const heavyHitterCohortSize = Math.max(3, Math.min(10, Math.ceil(Math.max(1, damageValues.length) * 0.15)));
  const topTierDamages = damageValues.slice(0, heavyHitterCohortSize);
  const fighterDamageMedianTopTier = topTierDamages.length > 0
    ? topTierDamages[Math.floor(topTierDamages.length / 2)]
    : (damageValues[0] || 100000);

  // 7. Lifetime donors threshold relative to country's donor distribution
  const donorTotals: number[] = Array.from(cumulativeMap.values())
    .map((d) => d.totalAmount)
    .filter((a) => a > 0)
    .sort((a, b) => b - a);
  const topDonorsIndex = Math.min(donorTotals.length - 1, Math.max(0, Math.min(9, Math.ceil(donorTotals.length * 0.15) - 1)));
  const topDonorsThreshold = donorTotals.length > 0 ? donorTotals[topDonorsIndex] : Math.max(25, Math.round(wealthP75 * 0.1));

  return {
    countryId,
    totalActiveCitizens: count,
    wealthP25,
    wealthMedian,
    wealthP75,
    wealthP90,
    liquidMedian,
    liquidP75,
    resourceMedian,
    resourceP75,
    incomeMedian,
    incomeP75,
    donationMedian,
    donationP75,
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
 * Matches v0.27 combat build attribution
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
  return attack + critDmg + critChance + armor + precision + dodge + health + stamina;
}

/**
 * Calculate total Economy Skill Points from War Era v0.27 user profile levels
 * Includes Companies, Leadership (replaced Entrepreneurship in v0.27), Management (+2% employee output/lvl),
 * Energy (used for self-work, hiring, and training), Production, and LootChance (Luck).
 */
export function calculateEcoSkillPoints(user: WareraUserLite): number {
  if (!user.skills) return 0;
  const s = user.skills;
  const companies = Number(s.companies?.level ?? 0);
  const leadership = Number(s.leadership?.level ?? (s as any).leader?.level ?? s.entrepreneurship?.level ?? 0);
  const production = Number(s.production?.level ?? 0);
  const management = Number(s.management?.level ?? 0);
  const energy = Number(s.energy?.level ?? 0);
  const lootChance = Number(s.lootChance?.level ?? 0);
  return companies + leadership + production + management + energy + lootChance;
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
  countryBenchmark?: CountryEconomicBenchmark,
  liquidBtc?: number
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

  // Country-Relative Benchmarks (100% scale-invariant across poor/small nations and whale nations)
  const hasBenchmark = Boolean(countryBenchmark && countryBenchmark.totalActiveCitizens > 0);
  const percentileCutoff = config?.leechWealthPercentileCutoff ?? 75;
  let leechWealthFloor: number;
  if (hasBenchmark) {
    if (percentileCutoff >= 90) leechWealthFloor = countryBenchmark!.wealthP90;
    else if (percentileCutoff >= 75) leechWealthFloor = countryBenchmark!.wealthP75;
    else leechWealthFloor = countryBenchmark!.wealthMedian;
  } else {
    leechWealthFloor = config?.highWealthThreshold ?? 5000;
  }

  const countryMedianWealth = hasBenchmark ? countryBenchmark!.wealthMedian : 1500;
  const countryMedianLiquid = hasBenchmark ? Math.max(10, countryBenchmark!.liquidMedian) : 150;
  const countryP75Liquid = hasBenchmark ? Math.max(25, countryBenchmark!.liquidP75) : 500;
  const countryMedianResource = hasBenchmark ? Math.max(10, countryBenchmark!.resourceMedian || 0) : 150;
  const countryP75Resource = hasBenchmark ? Math.max(25, countryBenchmark!.resourceP75 || 0) : 500;
  const countryMedianIncome = hasBenchmark ? Math.max(15, countryBenchmark!.incomeMedian || 0) : 200;
  const countryMedianDonation = hasBenchmark ? Math.max(10, countryBenchmark!.donationMedian || 0) : 25;

  // Dual-Index Component 1: Stock / Hoarding Index (relative to country median & P75)
  const citizenLiquid = typeof liquidBtc === 'number' ? liquidBtc : 0;
  const isLiquidHoarder = citizenLiquid >= Math.max(countryP75Liquid, countryMedianLiquid * 2) && citizenLiquid > 0;
  const isResourceStockpiler = resourceWealthBtc >= Math.max(countryP75Resource, countryMedianResource * 2) && resourceWealthBtc > 0;
  const isHighWealth = effectiveWealth >= leechWealthFloor || isLiquidHoarder || isResourceStockpiler;
  const isBelowCountryMedianStock =
    effectiveWealth < countryMedianWealth &&
    citizenLiquid < countryMedianLiquid &&
    resourceWealthBtc < countryMedianResource;

  // Dual-Index Component 2: Flow Index (verified gross income relative to playstyle quota & country median income)
  const effectiveIncome = typeof grossIncomeBtc === 'number' && grossIncomeBtc > 0 ? grossIncomeBtc : 0;

  // Combat Damage Conversion with Strict Playstyle & Country-Relative Benchmark Gating:
  let damageValueBtc = 0;
  if (config?.includeDamageInLeechCalculation && combatDamage > 0 && playstyle !== 'pure-eco') {
    const rate = config.damageConversionRateBtcPer1k ?? 0.08;
    const rawCredit = (combatDamage / 1000) * rate;
    const baseQuotaRef = effectiveIncome > 0
      ? effectiveIncome * (moderatePct / 100)
      : Math.max(5, countryMedianIncome * (moderatePct / 100));

    if (playstyle === 'pure-war') {
      if (isNationalHeavyHitter) {
        damageValueBtc = rawCredit;
      } else {
        damageValueBtc = Math.min(rawCredit, Math.max(baseQuotaRef * 0.5, baseQuotaRef * 1.5));
      }
    } else if (playstyle === 'hybrid') {
      damageValueBtc = Math.min(rawCredit, Math.max(baseQuotaRef * 0.25, baseQuotaRef * 0.5));
    }
  }

  const effectiveCredit = donatedBtc + damageValueBtc;
  const ratio = effectiveIncome > 0
    ? parseFloat(((effectiveCredit / effectiveIncome) * 100).toFixed(1))
    : (effectiveWealth > 0 ? parseFloat(((effectiveCredit / effectiveWealth) * 100).toFixed(2)) : 0);

  // 1. Historical Top Donor & Veteran Grace Safeguards (100% proportional to country topDonorsThreshold):
  const graceThreshold = config?.historicalDonorGraceThresholdBtc ?? (hasBenchmark ? Math.max(10, Math.round(countryBenchmark!.topDonorsThreshold * 0.35)) : 500);
  const qualifiesForPillarShield =
    !isHighWealth ||
    lifetimeDonations >= Math.max(graceThreshold, effectiveWealth * 0.03);

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
      reason: `National Combat Hero (${rankText} Heavy Hitter in Country): Frontline combat leader dealing top-tier battlefield damage for the nation.`,
    };
  }

  // 3. Dual-Index Country-Relative Tier Assignment:
  let tier: LeechTier;
  let reason: string | undefined = undefined;
  const wealthDonationRatioPct = effectiveWealth > 0 ? (effectiveCredit / effectiveWealth) * 100 : 0;
  // Meets country-relative patriot benchmark if flow ratio >= patriotPct OR if period donation >= 1.5x country median donation (for low-flow donors)
  const meetsCountryRelativePatriot =
    (effectiveIncome > 0 && ratio >= patriotPct) ||
    (effectiveCredit > 0 && effectiveCredit >= Math.max(countryMedianDonation * 1.5, countryMedianIncome * (patriotPct / 100)));

  if (effectiveIncome > 0) {
    if (isHighWealth && wealthDonationRatioPct < 0.2 && ratio < moderatePct) {
      tier = 'critical-leech';
      if (isLiquidHoarder) {
        reason = `Dual-Index Alert (Idle Liquid Hoarder): Holds ${citizenLiquid.toLocaleString()} BTC liquid cash (${(citizenLiquid / Math.max(1, countryMedianLiquid)).toFixed(1)}x country median) with only ${ratio}% flow contribution.`;
      } else if (isResourceStockpiler) {
        reason = `Dual-Index Alert (Resource Stockpiler): Holds ${resourceWealthBtc.toLocaleString()} BTC in commodities (${(resourceWealthBtc / Math.max(1, countryMedianResource)).toFixed(1)}x country median) with only ${ratio}% flow contribution.`;
      } else {
        reason = `Dual-Index Alert (Upper-Quartile Evader): Top wealth bracket (${effectiveWealth.toLocaleString()} BTC vs country P75 ${leechWealthFloor.toLocaleString()} BTC) donating ${wealthDonationRatioPct.toFixed(2)}% of wealth.`;
      }
    } else if (meetsCountryRelativePatriot) {
      tier = (damageValueBtc > 0 && donatedBtc === 0 && playstyle === 'pure-war') ? 'combat-veteran' : 'sovereign-patriot';
      reason = `Dual-Index Sovereign Patriot: Donated ${donatedBtc.toLocaleString()} BTC (${ratio}% of period cashflow), exceeding national ${playstyle} benchmark (${patriotPct}%).`;
    } else if (ratio >= moderatePct || (isBelowCountryMedianStock && effectiveCredit > 0)) {
      tier = 'moderate';
      reason = `Standard Contributor: Donated ${donatedBtc.toLocaleString()} BTC (${ratio}% of period cashflow) relative to country median income (${countryMedianIncome.toLocaleString()} BTC).`;
    } else if (ratio >= lowPct || isBelowCountryMedianStock) {
      tier = 'low-contributor';
      reason = isBelowCountryMedianStock
        ? `Subsistence / Developing Citizen: Below country median wealth (${countryMedianWealth.toLocaleString()} BTC) and liquid cash; protected from Critical Leech classification.`
        : `Low Weekly Contributor: Donated ${ratio}% of period cashflow (target: ${moderatePct}%–${patriotPct}%).`;
    } else {
      tier = isHighWealth ? 'critical-leech' : 'low-contributor';
      reason = isHighWealth
        ? `Critical Leech: High capacity relative to country peers (${effectiveWealth.toLocaleString()} BTC) with ${ratio}% period contribution.`
        : `Low Weekly Contributor: Below target cashflow quota (${ratio}% vs ${moderatePct}% target), but below country P75 wealth cutoff.`;
    }
  } else {
    // Zero recorded income / pending personal stream: evaluate via Stock Index relative to country medians
    if (meetsCountryRelativePatriot) {
      tier = 'sovereign-patriot';
      reason = `Sovereign Patriot: Donated ${donatedBtc.toLocaleString()} BTC in period, exceeding country median contribution benchmarks.`;
    } else if (isHighWealth) {
      if (wealthDonationRatioPct >= 0.2 || effectiveCredit >= countryMedianDonation) {
        tier = 'moderate';
        reason = `Active Upper-Bracket Contributor: Donated ${donatedBtc.toLocaleString()} BTC in period.`;
      } else {
        tier = 'critical-leech';
        reason = isLiquidHoarder
          ? `Idle Liquid Hoarder: Holds ${citizenLiquid.toLocaleString()} BTC unused liquid cash (${(citizenLiquid / Math.max(1, countryMedianLiquid)).toFixed(1)}x country median) with ${donatedBtc.toLocaleString()} BTC donated.`
          : isResourceStockpiler
          ? `Resource Stockpiler: Holds ${resourceWealthBtc.toLocaleString()} BTC in commodity stockpiles (${(resourceWealthBtc / Math.max(1, countryMedianResource)).toFixed(1)}x country median) with ${donatedBtc.toLocaleString()} BTC donated.`
          : `Upper-Bracket Non-Donor: Net worth (${effectiveWealth.toLocaleString()} BTC) exceeds country P75 (${leechWealthFloor.toLocaleString()} BTC) with token period donations.`;
      }
    } else {
      tier = effectiveCredit > 0 ? 'moderate' : 'low-contributor';
      reason = isBelowCountryMedianStock
        ? `Below Country Median Wealth (${countryMedianWealth.toLocaleString()} BTC): Protected from whale-skewed penalties.`
        : undefined;
    }
  }

  return { ratio, tier, reason, damageValueBtc };
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
    const nationalDonations = userTransactionsMap.get(p.userId) || [];
    let personalTxs: WareraTransaction[] = [];

    // Incorporate stored verified personal receipts if available
    if (getUserPersonalTxs) {
      try {
        const storedTxs = await getUserPersonalTxs(p.userId);
        if (storedTxs && storedTxs.length > 0) {
          personalTxs = storedTxs;
        }
      } catch {}
    }

    const userTxList = [...personalTxs, ...nationalDonations];

    // STRICT IMMUTABILITY: If profile was already verified via the live API stream (including 0-receipt citizens), preserve it intact
    if (p.auditBaselineStatus === 'audited' && p.auditedAt && (p.grossIncomeBtc !== undefined || p.playerCashflow || typeof p.receiptCount === 'number')) {
      auditedProfiles.push({
        ...p,
        grossInflowBtc: p.grossInflowBtc ?? p.grossIncomeBtc ?? 0,
        netCashflowBtc: p.netCashflowBtc ?? p.playerCashflow?.netCashflowBtc ?? 0,
        auditedAt: p.auditedAt,
        receiptCount: p.receiptCount ?? personalTxs.length,
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

    // Qualify as audited if actual personal receipts were stored or if the profile has already been live-audited
    const hasLivePersonalReceipts = personalTxs.length > 0 || (p.auditBaselineStatus === 'audited' && Boolean(p.auditedAt));
    let grossIncome = 0;
    let grossInflow: number | undefined = undefined;
    let netCashflow: number | undefined = undefined;
    let auditStatus: 'audited' | 'pending-audit' = 'pending-audit';
    let auditMethodologyNote = '';
    let auditedAtTimestamp: string | undefined = undefined;

    if (hasLivePersonalReceipts) {
      // 100% TRUTH-BASED: Derived strictly from streamed receipts
      grossInflow = cashflow.summary.grossInflowBtc;
      netCashflow = cashflow.summary.netCashflowBtc;
      grossIncome = Math.max(grossInflow, periodDonated);
      auditStatus = 'audited';
      auditedAtTimestamp = p.auditedAt || new Date().toISOString();
      auditMethodologyNote = `Verified via ${personalTxs.length} live in-game personal receipts (${periodDays}D window).`;
    } else {
      // PURGE ALL ESTIMATES: No guesswork formulas
      grossIncome = 0;
      grossInflow = undefined;
      netCashflow = undefined;
      auditStatus = 'pending-audit';
      auditedAtTimestamp = undefined;
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
      countryBenchmark,
      p.liquidBtc
    );

    // Harmonized Country-Relative Ministerial Audit Verdict
    let ministerialVerdict: import('../types/ministry').MinisterialVerdict = p.ministerialVerdict || 'moderate-contributor';
    let ministerialVerdictReason = p.ministerialVerdictReason || reason || 'Citizen contributes at an acceptable national rate.';

    if (hasLivePersonalReceipts) {
      const formatBtc = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const liquidCash = p.liquidBtc ?? 0;
      const resourceStock = p.resourceWealthBtc ?? 0;
      const hasBench = Boolean(countryBenchmark && countryBenchmark.totalActiveCitizens > 0);
      const isUpperQuartileWealth = currentWealthBasis >= (hasBench ? countryBenchmark!.wealthP75 : 5000);
      const isUpperQuartileLiquid = liquidCash >= (hasBench ? Math.max(25, countryBenchmark!.liquidP75) : 500);
      const isUpperQuartileResource = resourceStock >= (hasBench ? Math.max(25, countryBenchmark!.resourceP75 || 0) : 500);
      const countryCombatThreshold = hasBench
        ? Math.max(50000, (countryBenchmark!.fighterDamageMedianTopTier || 250000) * 0.4)
        : 250000;
      const wealthDonationRatio = currentWealthBasis > 0 ? (periodDonated / currentWealthBasis) * 100 : 0;

      if (p.level < 15) {
        ministerialVerdict = 'exempted-recruit';
        ministerialVerdictReason = 'New recruit (Level < 15); exempt from ministerial contribution pressure.';
      } else if (tier === 'critical-leech') {
        ministerialVerdict = 'slacker-evader';
        ministerialVerdictReason = reason || `Identified Slacker / Evader: Upper wealth/stock bracket of ${p.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC net worth) with token period donations (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
      } else if (tier === 'historical-pillar') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = reason || `Historical Pillar of ${p.countryName || 'nation'}: Outstanding lifetime contributions protected by sovereign charter.`;
      } else if (tier === 'combat-veteran') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = reason || `Combat Hero: Frontline warrior defending the nation with heavy combat damage.`;
      } else if (tier === 'sovereign-patriot') {
        ministerialVerdict = 'patriotic-fulfiller';
        ministerialVerdictReason = `Model Patriot: Contributed ${periodDonated.toLocaleString()} BTC in period (${ratio}% ratio), meeting or exceeding national target.`;
      } else if ((isUpperQuartileWealth || isUpperQuartileLiquid || isUpperQuartileResource) && (periodDonated === 0 || wealthDonationRatio < 0.2) && (damageValueBtc || 0) === 0) {
        ministerialVerdict = 'slacker-evader';
        ministerialVerdictReason = reason || `Identified Slacker: Upper wealth/stockpile bracket of ${p.countryName || 'nation'} (${formatBtc(currentWealthBasis)} BTC) with token contributions (${periodDonated.toLocaleString()} BTC, ${wealthDonationRatio.toFixed(2)}% of wealth).`;
      } else if (
        currentWealthBasis < (hasBench ? countryBenchmark!.wealthMedian : 1500) &&
        liquidCash < (hasBench ? countryBenchmark!.liquidMedian : 200) &&
        resourceStock < (hasBench ? (countryBenchmark!.resourceMedian || 150) : 150)
      ) {
        ministerialVerdict = 'subsistence-worker';
        ministerialVerdictReason = `Subsistence Worker: Working citizen with wealth and liquidity below national median (${formatBtc(currentWealthBasis)} BTC). Exempted from taxation.`;
      } else if (
        isUpperQuartileWealth &&
        liquidCash < (hasBench ? countryBenchmark!.liquidMedian : 100) &&
        resourceStock < (hasBench ? (countryBenchmark!.resourceP75 || 250) : 250) &&
        (p.totalCombatDamage || 0) >= countryCombatThreshold
      ) {
        ministerialVerdict = 'illiquid-asset-rich';
        ministerialVerdictReason = `Illiquid Combatant: High asset equity (${formatBtc(currentWealthBasis)} BTC) locked in gear and factories, active on the front lines.`;
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
      grossIncomeBtc: hasLivePersonalReceipts ? parseFloat(grossIncome.toFixed(2)) : undefined,
      grossInflowBtc: hasLivePersonalReceipts && grossInflow !== undefined ? parseFloat(grossInflow.toFixed(2)) : undefined,
      netCashflowBtc: hasLivePersonalReceipts && netCashflow !== undefined ? parseFloat(netCashflow.toFixed(2)) : undefined,
      periodDonatedBtc: periodDonated,
      contributionRatio: hasLivePersonalReceipts ? ratio : 0,
      leechTier: hasLivePersonalReceipts ? tier : p.leechTier,
      damageValueBtc: damageValueBtc !== undefined ? damageValueBtc : p.damageValueBtc,
      tierReasonBadge: hasLivePersonalReceipts ? (reason || p.tierReasonBadge) : (p.tierReasonBadge || 'Pending personal audit'),
      auditBaselineStatus: auditStatus,
      auditedAt: auditedAtTimestamp,
      receiptCount: hasLivePersonalReceipts ? personalTxs.length : undefined,
      auditMethodologyNote,
      ministerialVerdict,
      ministerialVerdictReason,
      playerCashflow: hasLivePersonalReceipts ? cashflow.summary : undefined,
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
 * Calculates a dynamic, country-relative suggested BTC donation and nudge archetype
 * for a specific citizen. Supports three distinct ministerial nudge profiles:
 * 1. 'weekly-cashflow': Citizen with active cashflow who needs a nudge to step up their weekly BTC tithe.
 * 2. 'liquid-hoarder': Citizen holding huge idle liquid BTC far above the country median/P75 who can donate a lump sum.
 * 3. 'resource-stockpiler': Citizen with low liquid cash but massive commodity stockpiles above country median who can sell 10%–15% of excess stockpile for BTC.
 */
export function calculateCitizenSuggestedDonation(
  profile: CitizenEconomicProfile,
  countryBenchmark?: CountryEconomicBenchmark,
  config: MinistryConfig = DEFAULT_MINISTRY_CONFIG,
  archetypeOverride?: NudgeArchetype,
  commodities?: CommodityTrend[]
): CitizenNudgeRecommendation {
  const liveCommodities =
    Array.isArray(commodities) && commodities.length > 0
      ? commodities
      : getCachedOrFallbackMarketTrends();

  const hasBenchmark = Boolean(countryBenchmark && countryBenchmark.totalActiveCitizens > 0);
  const liquidMedian = hasBenchmark ? Math.max(10, countryBenchmark!.liquidMedian) : 150;
  const liquidP75 = hasBenchmark ? Math.max(25, countryBenchmark!.liquidP75) : 500;
  const resourceMedian = hasBenchmark ? Math.max(10, countryBenchmark!.resourceMedian || 0) : 150;
  const resourceP75 = hasBenchmark ? Math.max(25, countryBenchmark!.resourceP75 || 0) : 500;
  const incomeMedian = hasBenchmark ? Math.max(15, countryBenchmark!.incomeMedian || 0) : 250;
  const donationMedian = hasBenchmark ? Math.max(10, countryBenchmark!.donationMedian || 0) : 30;

  const liquidBtc = Math.max(
    0,
    typeof profile.liquidBtc === 'number' ? profile.liquidBtc : profile.wealthBtc * 0.2
  );
  const resourceWealthBtc = Math.max(0, profile.resourceWealthBtc || 0);
  const equipmentsWealthBtc = Math.max(0, profile.equipmentsWealthBtc || 0);
  const weaponsWealthBtc = Math.max(0, profile.weaponsWealthBtc || 0);
  const companiesWealthBtc = Math.max(0, profile.companiesWealthBtc || 0);
  const periodDonated = Math.max(0, profile.periodDonatedBtc ?? profile.directDonatedBtc ?? 0);

  // ============================================================================
  // 1. 7-DAY RECIPE-BASED COMPANY PRODUCTION VALUATION (AT LIVE MARKET PRICES)
  // ============================================================================
  const mgmtLevel = Number(profile.skillBreakdown?.management ?? 0);
  const companyProjectionItems: import('../types/ministry').CompanyRecipeProjectionItem[] = [];
  let projected7dCompanyGrossOutputBtc = 0;
  let projected7dCompanyRawInputBtc = 0;
  let projected7dCompanyWagesBtc = 0;
  let projected7dCompanyNetProfitBtc = 0;

  const liveCompaniesList = Array.isArray(profile.companiesList) ? profile.companiesList : [];
  if (liveCompaniesList.length > 0) {
    for (const comp of liveCompaniesList) {
      if (comp.isOperatingActive === false) continue;
      const wf = evaluateCompanyWorkforce(
        comp,
        comp.employees,
        mgmtLevel,
        10,
        liveCommodities
      );
      const weeklyUnits = Math.round(wf.dailyUnitsProduced * 7 * 100) / 100;
      const weeklyGrossBtc = Math.round(wf.estimatedDailyRevenueBtc * 7 * 100) / 100;
      const weeklyRawInputsBtc = Math.round(wf.dailyRawInputCostBtc * 7 * 100) / 100;
      const weeklyWagesBtc = Math.round(wf.totalDailyWagesBtc * 7 * 100) / 100;
      // Use value-added net profit (after raw material inputs and bot wages) if positive, or gross margin if self-supplied
      const weeklyNetProfitBtc =
        Math.round(
          Math.max(wf.estimatedDailyNetProfitAfterInputsBtc, wf.estimatedDailyNetProfitBtc * 0.65) *
            7 *
            100
        ) / 100;

      projected7dCompanyGrossOutputBtc += weeklyGrossBtc;
      projected7dCompanyRawInputBtc += weeklyRawInputsBtc;
      projected7dCompanyWagesBtc += weeklyWagesBtc;
      projected7dCompanyNetProfitBtc += Math.max(0, weeklyNetProfitBtc);

      companyProjectionItems.push({
        companyName: comp.name || wf.commodityName,
        itemCode: wf.itemCode,
        commodityName: wf.commodityName,
        recipeSummary: wf.recipeSummary,
        dailyPP: wf.totalDailyPP,
        weeklyUnits,
        livePriceBtc: wf.unitMarketPriceBtc,
        weeklyGrossBtc,
        weeklyRawInputsBtc,
        weeklyWagesBtc,
        weeklyNetProfitBtc: Math.max(0, weeklyNetProfitBtc),
      });
    }
  } else {
    // Estimate active company output from citizen's active company slots, top sold commodity, and live market prices
    const activeSlots = Math.max(
      1,
      Math.min(
        profile.activeCompaniesCount || 2,
        profile.companiesCount || profile.activeCompaniesCount || 2
      )
    );
    const soldByItem = profile.playerCashflow?.commodityByItemSalesBtc || {};
    const topSoldItemCode =
      Object.entries(soldByItem).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      (profile.playerCashflow?.primaryTradedResource === 'iron'
        ? 'iron'
        : profile.playerCashflow?.primaryTradedResource === 'oil'
        ? 'oil'
        : profile.playerCashflow?.primaryTradedResource === 'food'
        ? 'bread'
        : profile.playerCashflow?.primaryTradedResource === 'munitions'
        ? 'ammo'
        : 'iron');

    const resolvedItem = resolveCommodityLivePriceBtc(topSoldItemCode, liveCommodities);
    const recipe = getItemProductionRecipe(resolvedItem.canonicalId);
    const avgEngineLvl = Math.min(
      7,
      Math.max(1, Math.round(companiesWealthBtc / Math.max(1, activeSlots * 1800)) || 2)
    );
    const mgmtMultiplier = 1 + (mgmtLevel * 2) / 100;
    const dailyPPPerComp = Math.round((avgEngineLvl * 2.5 + 3.5) * mgmtMultiplier * 24 * 10) / 10;
    const dailyUnitsPerComp = dailyPPPerComp / Math.max(1, recipe.ppPerUnit);
    const weeklyUnitsTotal = Math.round(dailyUnitsPerComp * activeSlots * 7 * 100) / 100;
    const weeklyGrossBtc = Math.round(weeklyUnitsTotal * resolvedItem.liveMarketPriceBtc * 100) / 100;

    let inputCostPerUnit = 0;
    for (const inp of recipe.inputs) {
      const inpPrice = resolveCommodityLivePriceBtc(inp.itemCode, liveCommodities);
      inputCostPerUnit += inp.quantity * inpPrice.liveMarketPriceBtc;
    }
    const weeklyRawInputsBtc = Math.round(weeklyUnitsTotal * inputCostPerUnit * 100) / 100;
    const weeklyWagesBtc = Math.round(activeSlots * 8 * 7 * 100) / 100;
    const weeklyNetProfitBtc = Math.max(
      0,
      Math.round((weeklyGrossBtc - weeklyRawInputsBtc - weeklyWagesBtc * 0.4) * 100) / 100
    );

    projected7dCompanyGrossOutputBtc = weeklyGrossBtc;
    projected7dCompanyRawInputBtc = weeklyRawInputsBtc;
    projected7dCompanyWagesBtc = weeklyWagesBtc;
    projected7dCompanyNetProfitBtc = weeklyNetProfitBtc;

    companyProjectionItems.push({
      companyName: `${activeSlots} Active Factor${activeSlots === 1 ? 'y' : 'ies'} (Est. ${resolvedItem.commodityName})`,
      itemCode: resolvedItem.canonicalId,
      commodityName: resolvedItem.commodityName,
      recipeSummary: recipe.recipeSummary,
      dailyPP: Math.round(dailyPPPerComp * activeSlots * 10) / 10,
      weeklyUnits: weeklyUnitsTotal,
      livePriceBtc: resolvedItem.liveMarketPriceBtc,
      weeklyGrossBtc,
      weeklyRawInputsBtc,
      weeklyWagesBtc,
      weeklyNetProfitBtc,
    });
  }

  // ============================================================================
  // 2. 7-DAY VERIFIED NET MARKET TRADING MARGIN & LABOR WAGES
  // ============================================================================
  const cashflowPeriodDays = Math.max(1, profile.playerCashflow?.periodDays || config.analysisPeriodDays || 7);
  const scaleTo7d = 7 / cashflowPeriodDays;
  const verified7dWagesEarnedBtc =
    Math.round((profile.playerCashflow?.wagesEarnedBtc || 0) * scaleTo7d * 100) / 100;
  const verified7dNetTradingBtc =
    Math.round(Math.max(0, profile.playerCashflow?.netTradeProfitBtc || 0) * scaleTo7d * 100) / 100;

  const rawReportedGrossIncome = Math.max(
    0,
    profile.grossIncomeBtc ??
      profile.grossInflowBtc ??
      profile.playerCashflow?.grossInflowBtc ??
      0
  );
  const scaledReportedGross7d = Math.round(rawReportedGrossIncome * scaleTo7d * 100) / 100;
  const total7dProjectedEarningPowerBtc =
    Math.round(
      Math.max(
        scaledReportedGross7d,
        projected7dCompanyNetProfitBtc + verified7dNetTradingBtc + verified7dWagesEarnedBtc
      ) * 100
    ) / 100;

  const grossIncomeBtc = Math.max(scaledReportedGross7d, total7dProjectedEarningPowerBtc);

  // ============================================================================
  // 3. ANTI-SPECULATION CONSTRUCTION CAPEX VS. IRON/STEEL PRICE-RIDING CLASSIFIER
  // ============================================================================
  const constructionPurchasesBtc = Math.round((profile.playerCashflow?.constructionPurchasesBtc || 0) * 100) / 100;
  const ironSteelPurchasesBtc = Math.round((profile.playerCashflow?.ironSteelPurchasesBtc || 0) * 100) / 100;
  const ironSteelSalesBtc = Math.round((profile.playerCashflow?.ironSteelSalesBtc || 0) * 100) / 100;
  const concreteLimestonePurchasesBtc = Math.round((profile.playerCashflow?.concreteLimestonePurchasesBtc || 0) * 100) / 100;
  const concreteLimestoneSalesBtc = Math.round((profile.playerCashflow?.concreteLimestoneSalesBtc || 0) * 100) / 100;

  const ownedCompanies = profile.companiesCount || 2;
  const activeSlots = profile.activeCompaniesCount || 2;
  const avgEquityPerCompany = companiesWealthBtc / Math.max(1, ownedCompanies);
  const hasUnfilledOrUnupgradedCompanyNeed =
    ownedCompanies < activeSlots || ownedCompanies < 6 || avgEquityPerCompany < 3000;

  // ============================================================================
  // 3B. 3.5x PROTECTED ECONOMIC GROWTH & MARKET SPECULATION SHIELD
  // Allows citizens to speculate moderately to grow their economy & buy war gear
  // without feeling put behind, while still taxing extreme hoarders (e.g. N3V1T5 at 35x median).
  // ============================================================================
  const nextUpgradeReserveBtc = hasUnfilledOrUnupgradedCompanyNeed
    ? Math.max(350, resourceMedian * 1.5)
    : Math.max(200, resourceMedian * 0.75);
  const protectedGrowthReserveBtc =
    Math.round(
      Math.max(
        resourceMedian * 3.5,
        projected7dCompanyRawInputBtc * 1.5 + nextUpgradeReserveBtc,
        350
      ) * 10
    ) / 10;
  const taxableExcessResourceBtc =
    Math.round(Math.max(0, resourceWealthBtc - protectedGrowthReserveBtc) * 10) / 10;
  const isHealthyGrowthSpeculation =
    resourceWealthBtc > resourceMedian && resourceWealthBtc <= protectedGrowthReserveBtc;

  let capexAuditVerdict: import('../types/ministry').CapexAuditVerdict = 'solvent-no-capex';
  let capexAuditBadge = 'Solvent / Full Contribution Capacity';
  let capexAuditExplanation = '';
  let capexGraceDiscountApplied = false;

  // Distinguish healthy growth speculation (<= 3.5x buffer) vs. extreme speculative hoarding (> 3.5x buffer)
  // vs. genuine company construction/upgrade CapEx:
  const isFlippingIronSteel =
    ironSteelPurchasesBtc > 15 && ironSteelSalesBtc >= ironSteelPurchasesBtc * 0.25;
  const isSpeculativeIronSteelHoard =
    resourceWealthBtc > protectedGrowthReserveBtc &&
    ((ironSteelPurchasesBtc > 25 &&
      concreteLimestonePurchasesBtc === 0 &&
      !hasUnfilledOrUnupgradedCompanyNeed) ||
      isFlippingIronSteel ||
      resourceWealthBtc >= resourceMedian * 4.5);

  const isGenuineConstructionCapEx =
    !isSpeculativeIronSteelHoard &&
    liquidBtc < liquidMedian * 1.25 &&
    hasUnfilledOrUnupgradedCompanyNeed &&
    constructionPurchasesBtc >= 25 &&
    (concreteLimestonePurchasesBtc > 0 || ownedCompanies < activeSlots) &&
    ironSteelSalesBtc === 0 &&
    concreteLimestoneSalesBtc === 0;

  if (isSpeculativeIronSteelHoard) {
    capexAuditVerdict = 'iron-steel-speculation';
    capexAuditBadge = '📈 Extreme Speculative Hoard (>3.5x Growth Buffer)';
    capexAuditExplanation = isFlippingIronSteel
      ? `Citizen bought ${ironSteelPurchasesBtc.toLocaleString()} BTC and sold ${ironSteelSalesBtc.toLocaleString()} BTC of Iron/Steel while holding ${resourceWealthBtc.toLocaleString()} BTC in commodities. We protect their first ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x Growth & Speculation Shield) so they can compound their economy, and only tax the ${taxableExcessResourceBtc.toLocaleString()} BTC excess hoard above the buffer.`
      : `Citizen holds ${resourceWealthBtc.toLocaleString()} BTC in commodities (${(resourceWealthBtc / Math.max(1, resourceMedian)).toFixed(1)}x country median). While we protect a ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x) Growth & Speculation Reserve for economic expansion and war gear, the remaining ${taxableExcessResourceBtc.toLocaleString()} BTC is extreme idle hoarding.`;
  } else if (isGenuineConstructionCapEx) {
    capexAuditVerdict = 'verified-construction-capex';
    capexAuditBadge = '🏗️ Verified Company Construction CapEx (45% Grace Applied)';
    capexAuditExplanation = `Verified CapEx Reinvestment: Citizen holds low liquid cash (${liquidBtc.toLocaleString()} BTC), has open/upgrading company capacity (${ownedCompanies}/${activeSlots} slots, ${companiesWealthBtc.toLocaleString()} BTC company equity), and spent ${constructionPurchasesBtc.toLocaleString()} BTC on construction materials (including ${concreteLimestonePurchasesBtc.toLocaleString()} BTC Concrete/Limestone and ${ironSteelPurchasesBtc.toLocaleString()} BTC Iron/Steel) with 0 BTC resold. Suggested cashflow quota is discounted by 45%.`;
    capexGraceDiscountApplied = true;
  } else if (isHealthyGrowthSpeculation) {
    capexAuditVerdict = 'solvent-no-capex';
    capexAuditBadge = '🌱 Healthy Growth Speculation Shielded (≤3.5x Buffer)';
    capexAuditExplanation = `Citizen holds ${resourceWealthBtc.toLocaleString()} BTC in commodities, which is within their ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x) Protected Growth & Speculation Buffer. Moderate market speculation and inventory building are 100% shielded from stockpile liquidation taxes so the citizen can grow their economy and buy better war equipment.`;
  } else {
    capexAuditVerdict = 'solvent-no-capex';
    capexAuditBadge = '✅ Solvent — "Update Made Me Broke" Disarmed';
    capexAuditExplanation = `7-Day Projected Earning Power is ${total7dProjectedEarningPowerBtc.toLocaleString()} BTC/wk (${projected7dCompanyNetProfitBtc.toLocaleString()} BTC company output at live item prices + ${verified7dNetTradingBtc.toLocaleString()} BTC net trade margin + ${verified7dWagesEarnedBtc.toLocaleString()} BTC wages), backed by ${liquidBtc.toLocaleString()} BTC liquid cash, ${resourceWealthBtc.toLocaleString()} BTC commodities, and ${(equipmentsWealthBtc + weaponsWealthBtc).toLocaleString()} BTC gear/weapons.`;
  }

  const growthShieldSummary =
    taxableExcessResourceBtc > 0
      ? `Protected Growth Reserve shields ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x buffer for economic growth & war gear); only the ${taxableExcessResourceBtc.toLocaleString()} BTC extreme excess is taxed.`
      : `100% of ${resourceWealthBtc.toLocaleString()} BTC stockpile is shielded inside the ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x) Growth & Speculation Reserve.`;

  const liquidRatioToCountryMedian = parseFloat((liquidBtc / Math.max(1, liquidMedian)).toFixed(2));
  const resourceRatioToCountryMedian = parseFloat((resourceWealthBtc / Math.max(1, resourceMedian)).toFixed(2));
  const incomeRatioToCountryMedian = parseFloat((grossIncomeBtc / Math.max(1, incomeMedian)).toFixed(2));

  // Target playstyle quota percentage
  let targetQuotaPct = config.patriotIncomeRatePct || 15;
  let moderateQuotaPct = config.moderateIncomeRatePct || 7;
  if (profile.playstyle === 'pure-war') {
    targetQuotaPct = config.warPatriotRatePct || 6;
    moderateQuotaPct = config.warModerateRatePct || 2.5;
  } else if (profile.playstyle === 'pure-eco') {
    targetQuotaPct = config.ecoPatriotRatePct || 15;
    moderateQuotaPct = config.ecoModerateRatePct || 7;
  } else if (profile.playstyle === 'hybrid') {
    targetQuotaPct = config.hybridPatriotRatePct || 12;
    moderateQuotaPct = config.hybridModerateRatePct || 6;
  }

  // Excess holdings above country median & above 3.5x Growth Buffer
  const excessLiquidBtc = Math.max(0, liquidBtc - liquidMedian);
  const excessResourceBtc = Math.max(0, resourceWealthBtc - resourceMedian);

  const roundCleanBtc = (val: number): number => {
    if (val <= 0) return 5;
    if (val < 25) return Math.max(1, Math.round(val));
    if (val < 100) return Math.round(val / 5) * 5;
    if (val < 1000) return Math.round(val / 10) * 10;
    return Math.round(val / 25) * 25;
  };

  // ============================================================================
  // 4. COMPUTE ALL 3 ARCHETYPES SIDE-BY-SIDE & DETERMINE RECOMMENDED ARCHETYPE
  // ============================================================================
  // A. Resource Stockpiler (12.5% of Taxable Excess Resource Stockpile ABOVE 3.5x Protected Growth Reserve)
  const effectiveExcessRes =
    taxableExcessResourceBtc > 0
      ? taxableExcessResourceBtc
      : excessResourceBtc > 0
      ? Math.max(25, excessResourceBtc * 0.35)
      : Math.max(25, resourceWealthBtc * 0.25);
  const lowLiq10 = roundCleanBtc(effectiveExcessRes * 0.10);
  const midLiq12_5 = Math.max(10, roundCleanBtc(effectiveExcessRes * 0.125));
  const highLiq15 = roundCleanBtc(effectiveExcessRes * 0.15);
  const stretchLiq20 = roundCleanBtc(effectiveExcessRes * 0.20);

  // B. Idle Liquid BTC Hoarder (15% of Excess Idle Liquid Cash above Country Median)
  const effectiveExcessLiq = excessLiquidBtc > 0 ? excessLiquidBtc : Math.max(40, liquidBtc * 0.5);
  const lump10 = roundCleanBtc(effectiveExcessLiq * 0.10);
  const lump15 = Math.max(15, roundCleanBtc(effectiveExcessLiq * 0.15));
  const lump25 = roundCleanBtc(effectiveExcessLiq * 0.25);
  const lump35 = roundCleanBtc(effectiveExcessLiq * 0.35);

  // C. Weekly Cashflow Step-Up (Protects 25% of Net Trading Margin for compounding & war gear)
  const growthAdjusted7dEarningPowerBtc =
    Math.round(
      Math.max(
        projected7dCompanyNetProfitBtc + verified7dNetTradingBtc * 0.75 + verified7dWagesEarnedBtc,
        total7dProjectedEarningPowerBtc * 0.85
      ) * 100
    ) / 100;
  const effectiveFlowBasis =
    growthAdjusted7dEarningPowerBtc > 0
      ? growthAdjusted7dEarningPowerBtc
      : Math.max(incomeMedian, liquidBtc * 0.25, 50);
  const capexMultiplier = capexGraceDiscountApplied ? 0.55 : 1.0; // 45% discount if verified construction CapEx
  const moderateWeeklyTarget = Math.max(5, effectiveFlowBasis * (moderateQuotaPct / 100) * capexMultiplier);
  const patriotWeeklyTarget = Math.max(10, effectiveFlowBasis * (targetQuotaPct / 100) * capexMultiplier);
  const gapToModerate = Math.max(0, moderateWeeklyTarget - periodDonated);
  const gapToPatriot = Math.max(0, patriotWeeklyTarget - periodDonated);

  const stepUpLow = roundCleanBtc(gapToModerate > 0 ? gapToModerate : moderateWeeklyTarget * 0.5);
  const stepUpRec = Math.max(
    5,
    roundCleanBtc(gapToPatriot > 0 ? gapToPatriot : Math.max(donationMedian * capexMultiplier, patriotWeeklyTarget * 0.5))
  );
  const stepUpHigh = roundCleanBtc(Math.max(stepUpRec * 1.5, patriotWeeklyTarget));
  const medianMatch = roundCleanBtc(Math.max(10, donationMedian));

  // Auto-detect citizen's recommended Nudge archetype:
  // Only recommend 'resource-stockpiler' when the citizen exceeds the 3.5x Protected Growth Reserve!
  const hasHighIdleLiquid =
    liquidBtc >= Math.max(liquidP75, liquidMedian * 1.8) &&
    excessLiquidBtc >= Math.max(25, donationMedian);
  const hasExtremeTaxableStockpile =
    taxableExcessResourceBtc >= Math.max(100, donationMedian * 2) &&
    resourceWealthBtc > protectedGrowthReserveBtc;

  let recommendedArchetype: NudgeArchetype = 'weekly-cashflow';
  let recommendedArchetypeLabel = 'Weekly Cashflow Step-Up';
  let recommendedArchetypeReason = '';

  if (
    hasExtremeTaxableStockpile &&
    (liquidBtc < liquidP75 || resourceWealthBtc > liquidBtc * 1.35 || capexAuditVerdict === 'iron-steel-speculation')
  ) {
    recommendedArchetype = 'resource-stockpiler';
    recommendedArchetypeLabel = 'Resource Stockpiler (Tax Only Excess Above 3.5x Growth Buffer)';
    recommendedArchetypeReason = `${profile.username} holds ${resourceWealthBtc.toLocaleString()} BTC in commodities (${resourceRatioToCountryMedian}x country median). Even after shielding ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x Growth & Speculation Reserve so they can expand their economy and buy war gear), they still hold ${taxableExcessResourceBtc.toLocaleString()} BTC in extreme excess stockpile. Selling 12.5% of that excess yields ${midLiq12_5.toLocaleString()} BTC without hurting their growth.`;
  } else if (hasHighIdleLiquid && lump15 >= stepUpRec) {
    recommendedArchetype = 'liquid-hoarder';
    recommendedArchetypeLabel = 'Idle Liquid BTC Hoarder (Lump-Sum)';
    recommendedArchetypeReason = `${profile.username} is sitting on ${liquidBtc.toLocaleString()} BTC in uninvested liquid cash (${liquidRatioToCountryMedian}x country median of ${liquidMedian.toLocaleString()} BTC). A one-time 15% lump-sum from their excess cash (${lump15.toLocaleString()} BTC) mobilizes idle currency immediately while leaving ${Math.max(0, Math.round(liquidBtc - lump15)).toLocaleString()} BTC in their wallet.`;
  } else {
    recommendedArchetype = 'weekly-cashflow';
    recommendedArchetypeLabel = 'Weekly Cashflow Step-Up';
    recommendedArchetypeReason = isHealthyGrowthSpeculation
      ? `${profile.username}'s ${resourceWealthBtc.toLocaleString()} BTC commodity inventory is shielded inside the ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x) Growth & Speculation Buffer so they can grow their economy. We therefore recommend a modest Weekly Cashflow Step-Up (${stepUpRec.toLocaleString()} BTC) based on their 7-day earning power.`
      : `${profile.username}'s strongest capacity comes from active 7-day production & trading cashflow (${total7dProjectedEarningPowerBtc.toLocaleString()} BTC/wk projected, with 25% of trade profit shielded for compounding). Requesting ${stepUpRec.toLocaleString()} BTC aligns them with the ${targetQuotaPct}% ${profile.playstyle} quota${capexGraceDiscountApplied ? ' (including a 45% Construction CapEx grace discount)' : ''}.`;
  }

  const detectedArchetype: NudgeArchetype = archetypeOverride || recommendedArchetype;

  const archetypeComparison: import('../types/ministry').ArchetypeComparisonItem[] = [
    {
      id: 'weekly-cashflow',
      title: 'Weekly Cashflow Step-Up',
      formulaBasis: `${targetQuotaPct}% of ${Math.round(effectiveFlowBasis).toLocaleString()} BTC Growth-Adjusted 7D Output${capexGraceDiscountApplied ? ' (×0.55 CapEx Grace)' : ''} − ${periodDonated.toLocaleString()} BTC Donated`,
      suggestedBtc: stepUpRec,
      isRecommended: recommendedArchetype === 'weekly-cashflow',
      explanation:
        'Taxes recurring 7-day earning power (recipe-valued company item output at live market prices + 75% of net trading margin + wages, leaving 25% trade margin for compounding).',
    },
    {
      id: 'liquid-hoarder',
      title: 'Idle Liquid BTC Hoarder',
      formulaBasis: `15% × (${Math.round(liquidBtc).toLocaleString()} BTC Liquid − ${Math.round(liquidMedian).toLocaleString()} BTC Country Median)`,
      suggestedBtc: lump15,
      isRecommended: recommendedArchetype === 'liquid-hoarder',
      explanation:
        'Targets uninvested cash sitting idle in the citizen’s wallet above the national median. Different from Stockpiler because it only looks at liquid BTC, not warehouse items.',
    },
    {
      id: 'resource-stockpiler',
      title: 'Resource Stockpiler',
      formulaBasis:
        taxableExcessResourceBtc > 0
          ? `12.5% × (${Math.round(resourceWealthBtc).toLocaleString()} BTC Stock − ${Math.round(protectedGrowthReserveBtc).toLocaleString()} BTC 3.5x Growth Shield)`
          : `Shielded (Stock ${Math.round(resourceWealthBtc).toLocaleString()} BTC ≤ ${Math.round(protectedGrowthReserveBtc).toLocaleString()} BTC 3.5x Buffer)`,
      suggestedBtc: midLiq12_5,
      isRecommended: recommendedArchetype === 'resource-stockpiler',
      explanation:
        'Protects a 3.5x Growth & Speculation Buffer so citizens can trade and grow their economy; only taxes extreme hoards above that buffer (like 35x stockpilers).',
    },
  ];

  // ============================================================================
  // 5. ADAPTIVE DIPLOMATIC MODE & CUSTOM MERIT-BASED COMMENDATION / WARNING EVALUATOR
  // Evaluates whether this citizen should receive:
  //   - 'commendation' (Custom Merit-Based Congratulations: Active Historical Pillar, Sovereign Treasury Patriot, Battlefield Hero, or Dual-Crown Vanguard)
  //   - 'over-donation-warning' (Burnout / Economic Self-Harm Warning: CapEx Growth Strain or Combat Ammo Strain)
  //   - 'nudge' (Treasury Contribution Request)
  // ============================================================================
  const sustainableWeeklyCapBtc = Math.max(
    roundCleanBtc(donationMedian * 1.5),
    roundCleanBtc(total7dProjectedEarningPowerBtc * 0.30 + Math.max(0, liquidBtc - liquidMedian) * 0.20)
  );
  const overDonationExcessBtc = Math.max(0, Math.round((periodDonated - sustainableWeeklyCapBtc) * 10) / 10);

  const isHistoricalPillar =
    profile.leechTier === 'historical-pillar' ||
    Boolean(profile.isHistoricalTopDonor) ||
    profile.totalDonatedBtc >= (config.historicalDonorGraceThresholdBtc || 500);
  const countryCombatThreshold = hasBenchmark
    ? Math.max(30000, (countryBenchmark!.fighterDamageMedianTopTier || 200000) * 0.35)
    : 100000;
  const periodCombatDamage = Math.max(0, profile.totalCombatDamage || 0);
  const hasHeavyCombatMerit =
    periodCombatDamage >= countryCombatThreshold ||
    profile.leechTier === 'combat-veteran' ||
    Boolean(profile.isNationalHeavyHitter) ||
    (profile.damageValueBtc || 0) >= moderateWeeklyTarget;
  const hasActivePeriodDonation =
    periodDonated >= Math.max(moderateWeeklyTarget * 0.85, donationMedian * 0.65, 25);
  const meetsPatriotTreasuryQuota =
    periodDonated >= patriotWeeklyTarget * 0.9 ||
    profile.leechTier === 'sovereign-patriot' ||
    profile.contributionRatio >= targetQuotaPct;

  // Detect Over-Donation Burnout Risk (donating more than sustainable earning power & draining liquid/company reserves)
  const isDrainingEcoGrowth =
    periodDonated > Math.max(50, sustainableWeeklyCapBtc) &&
    liquidBtc < liquidMedian * 1.1 &&
    resourceWealthBtc < protectedGrowthReserveBtc * 0.6 &&
    (total7dProjectedEarningPowerBtc === 0 || periodDonated > total7dProjectedEarningPowerBtc * 0.35);
  const isDrainingCombatReadiness =
    profile.playstyle !== 'pure-eco' &&
    periodDonated >= Math.max(40, patriotWeeklyTarget * 1.3) &&
    liquidBtc < liquidMedian * 0.75 &&
    periodCombatDamage > 0;
  const isOverDonatingBurnoutRisk = isDrainingEcoGrowth || isDrainingCombatReadiness;

  // Determine recommended Over-Donation Warning Sub-Archetype
  let recommendedOverDonationArchetype: import('../types/ministry').OverDonationWarningArchetype =
    isDrainingCombatReadiness || profile.playstyle === 'pure-war'
      ? 'combat-ammo-strain'
      : 'capex-growth-strain';
  let recommendedOverDonationLabel =
    recommendedOverDonationArchetype === 'combat-ammo-strain'
      ? 'Frontline Munitions & Gear Strain Warning'
      : 'Company CapEx & Economic Growth Strain Warning';
  let recommendedOverDonationReason =
    recommendedOverDonationArchetype === 'combat-ammo-strain'
      ? `${profile.username} donated ${periodDonated.toLocaleString()} BTC this period while fighting on the frontlines (${periodCombatDamage.toLocaleString()} dmg) and holding only ${liquidBtc.toLocaleString()} BTC liquid cash. Warn them to protect their cash for ammo, pills, and weapon repairs.`
      : `${profile.username} donated ${periodDonated.toLocaleString()} BTC (exceeding their sustainable weekly cap of ${sustainableWeeklyCapBtc.toLocaleString()} BTC from ${total7dProjectedEarningPowerBtc.toLocaleString()} BTC/wk output) with only ${liquidBtc.toLocaleString()} BTC liquid cash left. Advise a temporary donation pause so they can upgrade companies and compound their economy.`;

  const overDonationArchetypeOptions: import('../types/ministry').OverDonationArchetypeOption[] = [
    {
      id: 'capex-growth-strain',
      title: 'Company & Economic Growth Strain',
      subtitle: 'Protect capital for factory upgrades & market growth',
      badge: `Cap: ${sustainableWeeklyCapBtc.toLocaleString()} BTC/wk`,
      isRecommended: recommendedOverDonationArchetype === 'capex-growth-strain',
      explanation:
        'Advises citizens who are donating >35% of their weekly earning power (or draining low cash reserves) to pause tithes and reinvest in their own factories and trading capital so they do not fall behind.',
    },
    {
      id: 'combat-ammo-strain',
      title: 'Frontline Munitions & Gear Strain',
      subtitle: 'Retain BTC for ammunition, armor & combat buffs',
      badge: `Liquid: ${Math.round(liquidBtc).toLocaleString()} BTC`,
      isRecommended: recommendedOverDonationArchetype === 'combat-ammo-strain',
      explanation:
        'Advises active warriors who are over-donating BTC at the expense of their personal war chest to keep their liquid BTC for ammunition, weapon durability, and frontline consumables.',
    },
  ];

  // Determine recommended Custom Merit-Based Commendation Sub-Archetype
  let recommendedCommendationArchetype: import('../types/ministry').CommendationArchetype =
    'sovereign-treasury-patriot';
  let recommendedCommendationLabel = 'Sovereign Treasury Patriot';
  let recommendedCommendationReason = '';

  if (isHistoricalPillar && (periodDonated > 0 || periodCombatDamage > 0 || hasHeavyCombatMerit)) {
    recommendedCommendationArchetype = 'active-historical-pillar';
    recommendedCommendationLabel = 'Active Historical Pillar (Still Giving)';
    const pillarMeritDetail =
      periodDonated > 0 && periodCombatDamage > 0
        ? `contributing both +${periodDonated.toLocaleString()} BTC in fresh donations and ${periodCombatDamage.toLocaleString()} battlefield damage this period`
        : periodDonated > 0
        ? `contributing +${periodDonated.toLocaleString()} BTC in fresh treasury donations this period`
        : `dealing ${periodCombatDamage.toLocaleString()} frontline combat damage this period`;
    recommendedCommendationReason = `${profile.username} is an all-time National Pillar (${profile.totalDonatedBtc.toLocaleString()} BTC lifetime donated${profile.historicalRank ? `, Rank #${profile.historicalRank}` : ''}) who never stops serving—${pillarMeritDetail}.`;
  } else if (hasActivePeriodDonation && hasHeavyCombatMerit) {
    recommendedCommendationArchetype = 'dual-crown-vanguard';
    recommendedCommendationLabel = 'Dual-Crown Vanguard (Treasury + Battlefield)';
    recommendedCommendationReason = `${profile.username} excels on both fronts simultaneously: donating ${periodDonated.toLocaleString()} BTC to the national treasury while dealing ${periodCombatDamage.toLocaleString()} frontline combat damage.`;
  } else if (hasHeavyCombatMerit || (profile.playstyle === 'pure-war' && periodCombatDamage > 0)) {
    recommendedCommendationArchetype = 'battlefield-frontline-hero';
    recommendedCommendationLabel = 'Battlefield Frontline Hero';
    recommendedCommendationReason = `${profile.username} defends ${profile.countryName || 'the nation'} on the battlefield (${periodCombatDamage.toLocaleString()} period damage${profile.heavyHitterRank ? `, Heavy Hitter #${profile.heavyHitterRank}` : ''}), channeling their capital into weapons, ammo, and frontline readiness.`;
  } else if (isHistoricalPillar) {
    recommendedCommendationArchetype = 'active-historical-pillar';
    recommendedCommendationLabel = 'Historical National Pillar';
    recommendedCommendationReason = `${profile.username} is a foundational Historical Pillar (${profile.totalDonatedBtc.toLocaleString()} BTC lifetime donated${profile.historicalRank ? `, Rank #${profile.historicalRank}` : ''}) whose career contributions anchor the republic.`;
  } else {
    recommendedCommendationArchetype = 'sovereign-treasury-patriot';
    recommendedCommendationLabel = 'Sovereign Treasury Patriot';
    recommendedCommendationReason = `${profile.username} donated ${periodDonated.toLocaleString()} BTC this period (${profile.contributionRatio}% contribution ratio), meeting or exceeding the ${targetQuotaPct}% ${profile.playstyle} Patriot benchmark.`;
  }

  const commendationArchetypeOptions: import('../types/ministry').CommendationArchetypeOption[] = [
    {
      id: 'active-historical-pillar',
      title: 'Active Historical Pillar',
      subtitle: 'All-time foundation pillar who keeps giving (BTC or Damage)',
      badge: `${Math.round(profile.totalDonatedBtc).toLocaleString()} BTC Lifetime`,
      isRecommended: recommendedCommendationArchetype === 'active-historical-pillar',
      explanation:
        'Honors top lifetime donors who refuse to rest on their historical laurels and continue serving the country in the current period through fresh BTC tithes, frontline combat damage, or both.',
    },
    {
      id: 'sovereign-treasury-patriot',
      title: 'Sovereign Treasury Patriot',
      subtitle: 'Exemplary period BTC donor funding the state',
      badge: `${Math.round(periodDonated).toLocaleString()} BTC (${profile.contributionRatio}%)`,
      isRecommended: recommendedCommendationArchetype === 'sovereign-treasury-patriot',
      explanation:
        'Commends economic and hybrid citizens who meet or exceed their playstyle’s Patriot treasury quota through consistent direct BTC donations.',
    },
    {
      id: 'battlefield-frontline-hero',
      title: 'Battlefield Frontline Hero',
      subtitle: 'Heavy combat damage dealer & munitions spender',
      badge: `${periodCombatDamage.toLocaleString()} Dmg`,
      isRecommended: recommendedCommendationArchetype === 'battlefield-frontline-hero',
      explanation:
        'Salutes frontline warriors and illiquid combatants who pour their wealth into weapons, ammunition, and combat consumables to defend the nation’s borders.',
    },
    {
      id: 'dual-crown-vanguard',
      title: 'Dual-Crown Vanguard',
      subtitle: 'Elite contributor in both Treasury BTC & Combat Damage',
      badge: `${Math.round(periodDonated).toLocaleString()} BTC + ${periodCombatDamage.toLocaleString()} Dmg`,
      isRecommended: recommendedCommendationArchetype === 'dual-crown-vanguard',
      explanation:
        'Celebrates rare all-around citizens who simultaneously finance the national treasury with BTC donations and deal heavy damage on the battlefield.',
    },
  ];

  // Determine top-level Recommended Diplomatic Mode ('nudge' | 'commendation' | 'over-donation-warning')
  let recommendedDiplomaticMode: import('../types/ministry').DiplomaticActionMode = 'nudge';
  let recommendedDiplomaticModeLabel = `Treasury Nudge — ${recommendedArchetypeLabel}`;
  let recommendedDiplomaticModeReason = recommendedArchetypeReason;

  if (isOverDonatingBurnoutRisk) {
    recommendedDiplomaticMode = 'over-donation-warning';
    recommendedDiplomaticModeLabel = `Over-Donation Burnout Warning — ${recommendedOverDonationLabel}`;
    recommendedDiplomaticModeReason = recommendedOverDonationReason;
  } else if (
    meetsPatriotTreasuryQuota ||
    hasHeavyCombatMerit ||
    (isHistoricalPillar && (periodDonated > 0 || periodCombatDamage > 0 || profile.leechTier !== 'critical-leech'))
  ) {
    recommendedDiplomaticMode = 'commendation';
    recommendedDiplomaticModeLabel = `Patriot Commendation — ${recommendedCommendationLabel}`;
    recommendedDiplomaticModeReason = recommendedCommendationReason;
  }

  let suggestedAmountBtc = stepUpRec;
  let minSuggestedBtc = 5;
  let maxSuggestedBtc = 500;
  let stepBtc = 5;
  let suggestedLiquidationPct = 12.5;
  let archetypeLabel = 'Weekly Cashflow Step-Up';
  let archetypeDescription = 'Nudge citizen to increase their recurring weekly BTC tithe from active 7D recipe production & trading income.';
  let rationaleSummary = '';
  let presetsBtc: Array<{ label: string; amount: number; description: string }> = [];

  if (detectedArchetype === 'resource-stockpiler') {
    archetypeLabel = 'Resource Stockpiler (Excess Above 3.5x Growth Buffer)';
    archetypeDescription = 'Shields 3.5x country median for speculation & economic growth; suggests selling 10%–15% of extreme excess resources above the buffer.';
    suggestedAmountBtc = Math.max(10, midLiq12_5);
    minSuggestedBtc = Math.max(5, Math.floor(effectiveExcessRes * 0.05));
    maxSuggestedBtc = Math.max(suggestedAmountBtc * 2, Math.round(effectiveExcessRes * 0.35), 100);
    stepBtc = suggestedAmountBtc >= 200 ? 10 : 5;
    suggestedLiquidationPct = 12.5;
    rationaleSummary =
      taxableExcessResourceBtc > 0
        ? `Holds ${resourceWealthBtc.toLocaleString()} BTC in commodities (${resourceRatioToCountryMedian}x country median). After shielding ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x Growth & Speculation Reserve), selling 10%–15% of their ${taxableExcessResourceBtc.toLocaleString()} BTC extreme excess stockpile yields ~${lowLiq10.toLocaleString()}–${highLiq15.toLocaleString()} BTC without hurting factory operations or economic growth.`
        : `Holds ${resourceWealthBtc.toLocaleString()} BTC in commodities, which is within the ${protectedGrowthReserveBtc.toLocaleString()} BTC (3.5x) Protected Growth Reserve. If requesting a voluntary stockpile liquidation, ${midLiq12_5.toLocaleString()} BTC is a light 12.5% target.`;
    presetsBtc = [
      { label: '10% Taxable Excess', amount: Math.max(5, lowLiq10), description: 'Conservative 10% liquidation above 3.5x growth buffer' },
      { label: '12.5% Target (Rec.)', amount: Math.max(10, midLiq12_5), description: 'Balanced 12.5% liquidation above 3.5x growth buffer' },
      { label: '15% Taxable Excess', amount: Math.max(15, highLiq15), description: 'Upper 15% excess stockpile sale' },
      { label: '20% Mobilization', amount: Math.max(20, stretchLiq20), description: 'Wartime emergency stockpile liquidation' },
    ];
  } else if (detectedArchetype === 'liquid-hoarder') {
    archetypeLabel = 'Idle Liquid BTC Hoarder (Lump-Sum)';
    archetypeDescription = 'Holds large unused liquid BTC reserves well above the national median; nudge for a one-time treasury lump-sum injection.';
    suggestedAmountBtc = Math.max(15, lump15);
    minSuggestedBtc = Math.max(5, Math.floor(effectiveExcessLiq * 0.05));
    maxSuggestedBtc = Math.max(suggestedAmountBtc * 2, Math.round(liquidBtc * 0.5), 100);
    stepBtc = suggestedAmountBtc >= 200 ? 10 : 5;
    rationaleSummary = `Holds ${liquidBtc.toLocaleString()} BTC in idle liquid cash (${liquidRatioToCountryMedian}x country median of ${liquidMedian.toLocaleString()} BTC). A lump-sum contribution of 15% of excess idle cash (${suggestedAmountBtc.toLocaleString()} BTC) leaves ample working liquidity.`;
    presetsBtc = [
      { label: '10% Idle Excess', amount: Math.max(5, lump10), description: 'Light 10% excess cash contribution' },
      { label: '15% Lump-Sum (Rec.)', amount: Math.max(15, lump15), description: 'Recommended 15% excess liquid cash' },
      { label: '25% Treasury Boost', amount: Math.max(25, lump25), description: 'Strong 25% excess cash mobilization' },
      { label: '35% War Chest', amount: Math.max(35, lump35), description: 'Major sovereign reserve injection' },
    ];
  } else {
    archetypeLabel = 'Weekly Cashflow Step-Up';
    archetypeDescription = 'Active earner evaluated on 7-day recipe-based company production + growth-adjusted net market trading + wages.';
    suggestedAmountBtc = Math.max(5, stepUpRec);
    minSuggestedBtc = Math.max(1, Math.floor(suggestedAmountBtc * 0.2));
    maxSuggestedBtc = Math.max(suggestedAmountBtc * 3, Math.round(effectiveFlowBasis * 0.35), 100);
    stepBtc = suggestedAmountBtc >= 100 ? 5 : 1;
    rationaleSummary = `Growth-Adjusted 7D Earning Power is ${Math.round(effectiveFlowBasis).toLocaleString()} BTC (${projected7dCompanyNetProfitBtc.toLocaleString()} BTC company recipe output + ${Math.round(verified7dNetTradingBtc * 0.75).toLocaleString()} BTC taxable trade margin [25% shielded for growth] + ${verified7dWagesEarnedBtc.toLocaleString()} BTC wages), with ${periodDonated.toLocaleString()} BTC donated. Stepping up by +${suggestedAmountBtc.toLocaleString()} BTC aligns them with the ${targetQuotaPct}% ${profile.playstyle} quota${capexGraceDiscountApplied ? ' (45% CapEx grace applied)' : ''}.`;
    presetsBtc = [
      { label: `Moderate (${moderateQuotaPct}%)`, amount: Math.max(5, stepUpLow), description: `Reach ${moderateQuotaPct}% moderate weekly quota` },
      { label: `Patriot (${targetQuotaPct}% Rec.)`, amount: Math.max(10, stepUpRec), description: `Reach ${targetQuotaPct}% patriot weekly quota` },
      { label: 'Country Median', amount: Math.max(5, medianMatch), description: 'Match national median donor contribution' },
      { label: '1.5x Patriot Boost', amount: Math.max(15, stepUpHigh), description: 'Above-quota leadership contribution' },
    ];
  }

  const taxable7dNetTradingBtc = Math.round(verified7dNetTradingBtc * 0.75 * 10) / 10;
  const tradingReinvestmentAllowanceBtc = Math.round(verified7dNetTradingBtc * 0.25 * 10) / 10;
  const excessStockpileAboveBufferBtc = taxableExcessResourceBtc;
  const donatedShareOfWeeklyIncomePct =
    effectiveFlowBasis > 0 ? Math.round((periodDonated / effectiveFlowBasis) * 1000) / 10 : 0;
  const recommendedDiplomaticBadge =
    recommendedDiplomaticMode === 'over-donation-warning'
      ? `${donatedShareOfWeeklyIncomePct}% of 7D Output`
      : recommendedDiplomaticMode === 'commendation'
      ? commendationArchetypeOptions.find((o) => o.id === recommendedCommendationArchetype)?.badge ||
        `${Math.round(periodDonated).toLocaleString()} BTC`
      : `${suggestedAmountBtc.toLocaleString()} BTC Target`;

  return {
    archetype: detectedArchetype,
    archetypeLabel,
    archetypeDescription,
    recommendedArchetype,
    recommendedArchetypeLabel,
    recommendedArchetypeReason,
    archetypeComparison,
    suggestedAmountBtc,
    minSuggestedBtc,
    maxSuggestedBtc,
    stepBtc,
    presetsBtc,
    liquidBtc,
    liquidRatioToCountryMedian,
    resourceWealthBtc,
    resourceRatioToCountryMedian,
    excessResourceBtc: Math.round(excessResourceBtc * 10) / 10,
    protectedGrowthReserveBtc,
    taxableExcessResourceBtc,
    excessStockpileAboveBufferBtc,
    isHealthyGrowthSpeculation,
    growthShieldSummary,
    suggestedLiquidationPct,
    grossIncomeBtc: Math.round(grossIncomeBtc * 10) / 10,
    incomeRatioToCountryMedian,
    targetQuotaPct,
    rationaleSummary,
    projected7dCompanyGrossOutputBtc: Math.round(projected7dCompanyGrossOutputBtc * 10) / 10,
    projected7dCompanyRawInputBtc: Math.round(projected7dCompanyRawInputBtc * 10) / 10,
    projected7dCompanyWagesBtc: Math.round(projected7dCompanyWagesBtc * 10) / 10,
    projected7dCompanyNetProfitBtc: Math.round(projected7dCompanyNetProfitBtc * 10) / 10,
    companyProjectionItems,
    verified7dNetTradingBtc,
    taxable7dNetTradingBtc,
    tradingReinvestmentAllowanceBtc,
    verified7dWagesEarnedBtc,
    total7dProjectedEarningPowerBtc,
    equipmentsWealthBtc,
    weaponsWealthBtc,
    companiesWealthBtc,
    capexAuditVerdict,
    capexAuditBadge,
    capexAuditExplanation,
    capexGraceDiscountApplied,
    constructionPurchasesBtc,
    ironSteelPurchasesBtc,
    ironSteelSalesBtc,
    concreteLimestonePurchasesBtc,
    recommendedDiplomaticMode,
    recommendedDiplomaticModeLabel,
    recommendedDiplomaticModeReason,
    recommendedDiplomaticReason: recommendedDiplomaticModeReason,
    recommendedDiplomaticBadge,
    recommendedCommendationArchetype,
    recommendedCommendationLabel,
    recommendedCommendationReason,
    commendationArchetypeOptions,
    commendationOptions: commendationArchetypeOptions,
    recommendedOverDonationArchetype,
    recommendedOverDonationLabel,
    recommendedOverDonationReason,
    overDonationArchetypeOptions,
    overDonationOptions: overDonationArchetypeOptions,
    isOverDonatingBurnoutRisk,
    sustainableWeeklyCapBtc,
    overDonationExcessBtc,
    donatedShareOfWeeklyIncomePct,
  };
}

/**
 * Deterministic Ministerial Message Templates (ZERO AI, dynamically interpolated, strictly <= 492 chars without name)
 * Supports 3 Adaptive Diplomatic Modes:
 *   1. 'nudge': Treasury contribution request ('weekly-cashflow', 'liquid-hoarder', 'resource-stockpiler' with 3.5x Growth Shield)
 *   2. 'commendation': Custom Merit-Based Patriot Congratulations ('active-historical-pillar', 'sovereign-treasury-patriot', 'battlefield-frontline-hero', 'dual-crown-vanguard')
 *   3. 'over-donation-warning': Burnout & Self-Harm Protection ('capex-growth-strain', 'combat-ammo-strain')
 */
export function generateMinisterialNudge(
  profile: CitizenEconomicProfile,
  countryName: string,
  ministerTitle = 'MoE',
  periodDays = 7,
  options?: {
    customSuggestedBtc?: number;
    archetypeOverride?: NudgeArchetype;
    diplomaticMode?: import('../types/ministry').DiplomaticActionMode;
    commendationArchetype?: import('../types/ministry').CommendationArchetype;
    overDonationArchetype?: import('../types/ministry').OverDonationWarningArchetype;
    countryBenchmark?: CountryEconomicBenchmark;
    config?: MinistryConfig;
    commodities?: CommodityTrend[];
  }
): MinisterialMessage[] {
  const currentDate = getTodayDDMMYYYY();
  const recommendation = calculateCitizenSuggestedDonation(
    profile,
    options?.countryBenchmark,
    options?.config || DEFAULT_MINISTRY_CONFIG,
    options?.archetypeOverride,
    options?.commodities
  );

  const activeMode: import('../types/ministry').DiplomaticActionMode =
    options?.diplomaticMode || 'nudge';
  const archetype = recommendation.archetype;
  const suggestedDonation =
    typeof options?.customSuggestedBtc === 'number' && options.customSuggestedBtc > 0
      ? Math.round(options.customSuggestedBtc * 10) / 10
      : recommendation.suggestedAmountBtc;

  const suggestedFormatted = suggestedDonation.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const liquidFormatted = recommendation.liquidBtc.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const resourceFormatted = recommendation.resourceWealthBtc.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const growthBufferFormatted = recommendation.protectedGrowthReserveBtc.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const periodDonatedVal = profile.periodDonatedBtc ?? profile.directDonatedBtc ?? 0;
  const donatedFormatted = periodDonatedVal.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const lifetimeDonatedFormatted = (profile.totalDonatedBtc || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const combatDmgFormatted = (profile.totalCombatDamage || 0).toLocaleString();
  const sustainableCapFormatted = recommendation.sustainableWeeklyCapBtc.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const isLeech = profile.leechTier === 'critical-leech';
  const messages: MinisterialMessage[] = [];

  // ============================================================================
  // MODE 2: CUSTOM MERIT-BASED PATRIOT COMMENDATIONS (CONGRATULATIONS)
  // ============================================================================
  if (activeMode === 'commendation') {
    const commArch = options?.commendationArchetype || recommendation.recommendedCommendationArchetype;

    if (commArch === 'active-historical-pillar') {
      const rankTagEn = profile.historicalRank ? ` (All-Time Rank #${profile.historicalRank})` : '';
      const rankTagEs = profile.historicalRank ? ` (Rango Histórico #${profile.historicalRank})` : '';
      const activeMeritEn =
        periodDonatedVal > 0 && (profile.totalCombatDamage || 0) > 0
          ? `plus +${donatedFormatted} BTC donated and ${combatDmgFormatted} combat damage in the last ${periodDays}d`
          : periodDonatedVal > 0
          ? `plus +${donatedFormatted} BTC in fresh donations over the last ${periodDays}d`
          : (profile.totalCombatDamage || 0) > 0
          ? `plus ${combatDmgFormatted} frontline combat damage over the last ${periodDays}d`
          : `standing as an enduring foundation of our national treasury`;
      const activeMeritEs =
        periodDonatedVal > 0 && (profile.totalCombatDamage || 0) > 0
          ? `sumado a +${donatedFormatted} BTC donados y ${combatDmgFormatted} de daño en combate estos ${periodDays}d`
          : periodDonatedVal > 0
          ? `sumado a +${donatedFormatted} BTC donados en los últimos ${periodDays}d`
          : (profile.totalCombatDamage || 0) > 0
          ? `sumado a ${combatDmgFormatted} de daño en el frente estos ${periodDays}d`
          : `manteniéndose como un pilar histórico de nuestra república`;

      const enBody = `🏛️ [HONOR ROLL - ${countryName.toUpperCase()} ${ministerTitle}]
Salute, Historical Pillar ${profile.username}!
Our ${currentDate} audit honors your ${lifetimeDonatedFormatted} BTC lifetime contributions${rankTagEn}, ${activeMeritEn}.
Veterans who never rest on past laurels and keep giving—whether in treasury BTC or battlefield blood—are the true backbone of ${countryName}.
With sovereign gratitude! ${ministerTitle}`;

      const esBody = `🏛️ [CUADRO DE HONOR - ${countryName.toUpperCase()} ${ministerTitle}]
¡Salve, Pilar Histórico ${profile.username}!
La auditoría (${currentDate}) honra sus ${lifetimeDonatedFormatted} BTC donados de por vida${rankTagEs}, ${activeMeritEs}.
Los veteranos que no descansan en sus laureles y siguen aportando en tesorería o combate son el alma de ${countryName}.
¡Gracias por su lealtad! ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'diplomatic-formal',
        title: 'Active Historical Pillar Commendation (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
      messages.push({
        language: 'es',
        tone: 'diplomatic-formal',
        title: 'Condecoración de Pilar Histórico Activo (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
    } else if (commArch === 'battlefield-frontline-hero') {
      const hhEn = profile.heavyHitterRank ? ` (National Heavy Hitter #${profile.heavyHitterRank})` : '';
      const hhEs = profile.heavyHitterRank ? ` (Artillero Nacional #${profile.heavyHitterRank})` : '';

      const enBody = `⚔️ [HIGH COMMAND & ${ministerTitle} - ${countryName.toUpperCase()}]
Salute, Frontline Hero ${profile.username}!
As of ${currentDate}, the Ministry records ${combatDmgFormatted} battlefield damage dealt over ${periodDays}d${hhEn}.
We recognize that your capital is invested in weapons, ammo, and combat readiness to defend ${countryName}'s borders. Your firepower is worth its weight in gold!
Victory to ${countryName}! ${ministerTitle}`;

      const esBody = `⚔️ [ALTO MANDO Y ${ministerTitle} - ${countryName.toUpperCase()}]
¡Saludo militar, Héroe del Frente ${profile.username}!
Al ${currentDate}, el Ministerio registra ${combatDmgFormatted} de daño en combate en ${periodDays}d${hhEs}.
Reconocemos que su capital está invertido en armas, munición y equipo para defender a ${countryName}. ¡Su fuego en batalla vale oro para la nación!
¡Viva ${countryName}! ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'patriotic-military',
        title: 'Battlefield Frontline Hero Commendation (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
      messages.push({
        language: 'es',
        tone: 'patriotic-military',
        title: 'Reconocimiento al Héroe de Batalla (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
    } else if (commArch === 'dual-crown-vanguard') {
      const enBody = `🌟 [DUAL-CROWN VANGUARD - ${countryName.toUpperCase()} ${ministerTitle}]
Distinguished Patriot ${profile.username},
Our ${currentDate} audit celebrates your rare dual achievement over ${periodDays}d: ${donatedFormatted} BTC donated to the treasury AND ${combatDmgFormatted} damage dealt on the battlefield!
By simultaneously funding the state and fighting on the frontlines, you set the gold standard for ${countryName}.
Honor and gratitude! ${ministerTitle}`;

      const esBody = `🌟 [VANGUARDIA DE DOBLE CORONA - ${countryName.toUpperCase()} ${ministerTitle}]
Distinguido Patriota ${profile.username}:
La auditoría (${currentDate}) celebra su doble hazaña en ${periodDays}d: ¡${donatedFormatted} BTC donados a la tesorería Y ${combatDmgFormatted} de daño en el campo de batalla!
Financiar la patria y combatir en primera línea al mismo tiempo es un ejemplo supremo para ${countryName}.
¡Honor y gratitud! ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'patriotic-military',
        title: 'Dual-Crown Vanguard Commendation (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
      messages.push({
        language: 'es',
        tone: 'patriotic-military',
        title: 'Reconocimiento Vanguardia Doble Corona (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
    } else {
      // 'sovereign-treasury-patriot'
      const enBody = `🌟 [SOVEREIGN PATRIOT - ${countryName.toUpperCase()} ${ministerTitle}]
Dear Patriot ${profile.username},
On behalf of ${countryName}, the Ministry of Economy commends your exemplary contribution of ${donatedFormatted} BTC over the past ${periodDays}d (${profile.contributionRatio}% ratio, ${lifetimeDonatedFormatted} BTC lifetime).
Your economic leadership directly bankrolls our national defense and prosperity. Thank you for standing as a Model Patriot!
For the homeland! ${ministerTitle}`;

      const esBody = `🌟 [PATRIOTA SOBERANO - ${countryName.toUpperCase()} ${ministerTitle}]
Estimado Patriota ${profile.username}:
En nombre de ${countryName}, el Ministerio de Economía felicita su ejemplar aporte de ${donatedFormatted} BTC en los últimos ${periodDays}d (${profile.contributionRatio}% de ratio, ${lifetimeDonatedFormatted} BTC histórico).
Su compromiso financia directamente nuestra defensa y prosperidad nacional. ¡Gracias por ser un Ciudadano Modelo!
¡Por la patria! ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'diplomatic-formal',
        title: 'Sovereign Treasury Patriot Commendation (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
      messages.push({
        language: 'es',
        tone: 'diplomatic-formal',
        title: 'Felicitación al Patriota de Tesorería (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'commendation',
        commendationArchetype: commArch,
      });
    }

    return messages;
  }

  // ============================================================================
  // MODE 3: OVER-DONATION BURNOUT & ECONOMIC SELF-HARM WARNING
  // ============================================================================
  if (activeMode === 'over-donation-warning') {
    const warnArch = options?.overDonationArchetype || recommendation.recommendedOverDonationArchetype;

    if (warnArch === 'combat-ammo-strain') {
      const enBody = `🛡️ [MINISTERIAL CARE ADVISORY - ${countryName.toUpperCase()} ${ministerTitle}]
Dear warrior ${profile.username},
We deeply appreciate your ${donatedFormatted} BTC treasury donation and ${combatDmgFormatted} combat damage over ${periodDays}d!
However, your liquid reserve is down to ${liquidFormatted} BTC. Please PAUSE treasury donations and keep your BTC for ammunition, weapon repairs, and combat buffs—${countryName} needs you strong on the frontline!
With gratitude, ${ministerTitle}`;

      const esBody = `🛡️ [AVISO DE PROTECCIÓN AL COMBATIENTE - ${countryName.toUpperCase()} ${ministerTitle}]
Estimado guerrero ${profile.username}:
¡Agradecemos profundamente su donación de ${donatedFormatted} BTC y sus ${combatDmgFormatted} de daño en ${periodDays}d!
Notamos que su liquidez bajó a ${liquidFormatted} BTC. Por favor PAUSE sus donaciones y conserve su BTC para munición, armas y consumibles—¡${countryName} lo necesita fuerte en el frente!
Con gratitud, ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'patriotic-military',
        title: 'Combat Readiness & Ammo Retention Advisory (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'over-donation-warning',
        overDonationArchetype: warnArch,
      });
      messages.push({
        language: 'es',
        tone: 'patriotic-military',
        title: 'Aviso de Retención de Liquidez para Combate (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'over-donation-warning',
        overDonationArchetype: warnArch,
      });
    } else {
      // 'capex-growth-strain'
      const enBody = `💚 [SUSTAINABLE GROWTH ADVISORY - ${countryName.toUpperCase()} ${ministerTitle}]
Dear Patriot ${profile.username},
Thank you for generously donating ${donatedFormatted} BTC over ${periodDays}d!
Our audit shows this exceeds your sustainable weekly cap (~${sustainableCapFormatted} BTC) and leaves you with ${liquidFormatted} BTC cash. Please PAUSE donations and reinvest in your companies and trading growth—a stronger personal economy helps ${countryName} more long-term!
With gratitude, ${ministerTitle}`;

      const esBody = `💚 [AVISO DE CRECIMIENTO SOSTENIBLE - ${countryName.toUpperCase()} ${ministerTitle}]
Estimado Patriota ${profile.username}:
¡Gracias por su generosa donación de ${donatedFormatted} BTC en estos ${periodDays}d!
Nuestra auditoría nota que esto supera su tope sostenible (~${sustainableCapFormatted} BTC/sem) dejándole ${liquidFormatted} BTC líquidos. Por favor PAUSE sus aportes y reinvierta en sus empresas y comercio—¡su crecimiento fortalece a ${countryName} a largo plazo!
Con gratitud, ${ministerTitle}`;

      messages.push({
        language: 'en',
        tone: 'diplomatic-formal',
        title: 'Over-Donation Pause & Company Growth Advisory (English)',
        body: enforceMaxTelegramLength(enBody, profile.username, 492),
        diplomaticMode: 'over-donation-warning',
        overDonationArchetype: warnArch,
      });
      messages.push({
        language: 'es',
        tone: 'diplomatic-formal',
        title: 'Aviso de Pausa por Sobredonación y Crecimiento (Español)',
        body: enforceMaxTelegramLength(esBody, profile.username, 492),
        diplomaticMode: 'over-donation-warning',
        overDonationArchetype: warnArch,
      });
    }

    return messages;
  }

  // ============================================================================
  // MODE 1: TREASURY CONTRIBUTION NUDGE (WITH 3.5x GROWTH SHIELD)
  // ============================================================================
  if (archetype === 'resource-stockpiler') {
    const enTitle = isLeech
      ? 'Urgent Stockpile Mobilization Summons (English)'
      : 'Strategic Stockpile Liquidation Notice (English)';
    const esTitle = isLeech
      ? 'Llamado Urgente de Movilización de Reservas (Español)'
      : 'Aviso Estratégico de Liquidación de Stock (Español)';

    const enBody = isLeech
      ? `⚠️ [TREASURY - ${countryName.toUpperCase()}]
Citizen ${profile.username}:
Audit (${currentDate}) records ${resourceFormatted} BTC in commodities (${recommendation.resourceRatioToCountryMedian}x median) and ${donatedFormatted} BTC donated in ${periodDays}d.
Even after shielding ${growthBufferFormatted} BTC (3.5x reserve) for your economic growth, your excess hoard is massive. Please sell 10%–15% of excess stock and donate ${suggestedFormatted} BTC this week.
Fulfill your duty! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Dear citizen ${profile.username},
As of ${currentDate}, our audit notes ${resourceFormatted} BTC in stockpiles (${recommendation.resourceRatioToCountryMedian}x median) and ${donatedFormatted} BTC donated in ${periodDays}d.
We protect a ${growthBufferFormatted} BTC (3.5x) reserve so you can speculate and grow; selling just 10%–15% of your excess above that buffer lets you donate ${suggestedFormatted} BTC to ${countryName}.
For the homeland! ${ministerTitle}`;

    const esBody = isLeech
      ? `⚠️ [TESORERÍA - ${countryName.toUpperCase()}]
Ciudadano ${profile.username}:
La auditoría (${currentDate}) registra ${resourceFormatted} BTC en recursos (${recommendation.resourceRatioToCountryMedian}x la mediana) y ${donatedFormatted} BTC donados en ${periodDays}d.
Incluso protegiendo ${growthBufferFormatted} BTC (3.5x) para su crecimiento, su excedente es alto. Le solicitamos vender 10%–15% del exceso y aportar ${suggestedFormatted} BTC esta semana.
¡Cumpla su deber! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Estimado ciudadano ${profile.username},
Al ${currentDate}, el Ministerio registra ${resourceFormatted} BTC en recursos (${recommendation.resourceRatioToCountryMedian}x la mediana) y ${donatedFormatted} BTC donados en ${periodDays}d.
Protegemos ${growthBufferFormatted} BTC (3.5x) para su comercio y crecimiento; vendiendo solo 10%–15% del excedente sobre ese margen, le invitamos a donar ${suggestedFormatted} BTC a ${countryName}.
¡Por la patria! ${ministerTitle}`;

    messages.push({
      language: 'en',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: enTitle,
      body: enforceMaxTelegramLength(enBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
    messages.push({
      language: 'es',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: esTitle,
      body: enforceMaxTelegramLength(esBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
  } else if (archetype === 'liquid-hoarder') {
    const enTitle = isLeech
      ? 'Urgent Idle Liquidity Summons (English)'
      : 'Lump-Sum Liquidity Contribution Notice (English)';
    const esTitle = isLeech
      ? 'Llamado Urgente de Liquidez Inactiva (Español)'
      : 'Invitación de Aporte de Liquidez (Español)';

    const enBody = isLeech
      ? `⚠️ [TREASURY - ${countryName.toUpperCase()}]
Citizen ${profile.username}:
Audit (${currentDate}) notes ${liquidFormatted} BTC in idle liquid cash (${recommendation.liquidRatioToCountryMedian}x national median) and ${donatedFormatted} BTC donated in ${periodDays}d.
Uninvested capital weakens our frontlines. An immediate lump-sum contribution of ${suggestedFormatted} BTC from your idle reserves is requested for the national treasury.
Currency is ammunition! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Dear citizen ${profile.username},
The Ministry notes (${currentDate}) ${liquidFormatted} BTC in available liquid cash (${recommendation.liquidRatioToCountryMedian}x country median) and ${donatedFormatted} BTC donated over ${periodDays}d.
Since you hold strong unused liquidity, we invite you to make a one-time lump-sum contribution of ${suggestedFormatted} BTC to ${countryName}'s treasury to fund national defense and growth.
For the homeland! ${ministerTitle}`;

    const esBody = isLeech
      ? `⚠️ [TESORERÍA - ${countryName.toUpperCase()}]
Ciudadano ${profile.username}:
En auditoría (${currentDate}) registra ${liquidFormatted} BTC en efectivo líquido inactivo (${recommendation.liquidRatioToCountryMedian}x la mediana nacional) y ${donatedFormatted} BTC donados en ${periodDays}d.
El capital sin uso debilita nuestras líneas. Se requiere un aporte único urgente de ${suggestedFormatted} BTC de su liquidez disponible a la tesorería nacional.
¡La moneda es munición! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Estimado ciudadano ${profile.username},
El Ministerio nota (${currentDate}) ${liquidFormatted} BTC en liquidez disponible (${recommendation.liquidRatioToCountryMedian}x la mediana del país) y aportes de ${donatedFormatted} BTC en ${periodDays}d.
Contando con amplia reserva líquida sin uso, le invitamos a realizar un aporte único sugerido de ${suggestedFormatted} BTC a la tesorería de ${countryName} para impulsar nuestra defensa.
¡Por la patria! ${ministerTitle}`;

    messages.push({
      language: 'en',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: enTitle,
      body: enforceMaxTelegramLength(enBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
    messages.push({
      language: 'es',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: esTitle,
      body: enforceMaxTelegramLength(esBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
  } else {
    // 'weekly-cashflow' archetype
    const enTitle = isLeech
      ? 'Urgent Weekly Quota Summons (English)'
      : 'Weekly Cashflow Step-Up Notice (English)';
    const esTitle = isLeech
      ? 'Llamado Urgente de Cuota Semanal (Español)'
      : 'Notificación de Aporte Semanal (Español)';

    const enBody = isLeech
      ? `⚠️ [TREASURY - ${countryName.toUpperCase()}]
Citizen ${profile.username}:
Audit (${currentDate}) records ${liquidFormatted} BTC liquid cash and only ${donatedFormatted} BTC donated over the past ${periodDays} days.
To align with ${countryName}'s ${recommendation.targetQuotaPct}% weekly ${profile.playstyle} benchmark, an urgent contribution of ${suggestedFormatted} BTC is requested this week to sustain defense contracts.
Fulfill your patriotic duty! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Dear citizen ${profile.username},
The Ministry of Economy notes (${currentDate}) ${donatedFormatted} BTC contributed over the past ${periodDays} days and ${liquidFormatted} BTC in available liquidity.
A modest weekly step-up goes a long way: we invite you to contribute a suggested ${suggestedFormatted} BTC this week to reach ${countryName}'s ${recommendation.targetQuotaPct}% ${profile.playstyle} goal.
For the homeland! ${ministerTitle}`;

    const esBody = isLeech
      ? `⚠️ [TESORERÍA - ${countryName.toUpperCase()}]
Ciudadano ${profile.username}:
La auditoría (${currentDate}) registra ${liquidFormatted} BTC de liquidez y solo ${donatedFormatted} BTC donados en los últimos ${periodDays} días.
Para cumplir la meta semanal del ${recommendation.targetQuotaPct}% (${profile.playstyle}) de ${countryName}, se solicita un aporte urgente de ${suggestedFormatted} BTC esta semana a la tesorería.
¡Cumpla su deber patriótico! ${ministerTitle}`
      : `🏛️ [${countryName.toUpperCase()} - ${ministerTitle}]
Estimado ciudadano ${profile.username},
El Ministerio de Economía registra (${currentDate}) aportes de ${donatedFormatted} BTC en los últimos ${periodDays} días y ${liquidFormatted} BTC de liquidez.
Un pequeño incremento semanal marca la diferencia: le invitamos a realizar una donación sugerida de ${suggestedFormatted} BTC esta semana para alcanzar la meta nacional (${recommendation.targetQuotaPct}%).
¡Por la patria! ${ministerTitle}`;

    messages.push({
      language: 'en',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: enTitle,
      body: enforceMaxTelegramLength(enBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
    messages.push({
      language: 'es',
      tone: isLeech ? 'firm-economic' : 'diplomatic-formal',
      title: esTitle,
      body: enforceMaxTelegramLength(esBody, profile.username, 492),
      archetype,
      diplomaticMode: 'nudge',
      suggestedAmountBtc: suggestedDonation,
    });
  }

  return messages;
}

/**
 * Format CSV string from National Transactions for Excel (sorted newest-first)
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

  const sortedTxs = [...transactions].sort(compareTransactionsNewestFirst);
  const rows = sortedTxs.map((t) => [
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

  [...params.transactions].sort(compareTransactionsNewestFirst).forEach((t) => {
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
