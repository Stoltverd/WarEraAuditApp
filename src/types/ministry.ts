import { RankingTimeframe, WareraCompany } from './warera';

export type LeechTier =
  | 'critical-leech'
  | 'low-contributor'
  | 'moderate'
  | 'sovereign-patriot'
  | 'historical-pillar'
  | 'combat-veteran';

export type MinisterialVerdict =
  | 'slacker-evader'
  | 'subsistence-worker'
  | 'illiquid-asset-rich'
  | 'patriotic-fulfiller'
  | 'moderate-contributor'
  | 'exempted-recruit';

export type PlaystyleMode = 'pure-eco' | 'pure-war' | 'hybrid';

export type PlayerTag = 'perma-war' | 'perma-eco' | 'weekly-cycler' | 'mixed-style' | 'mercenary' | 'vip' | 'none';

export type CitizenEconomicStanding =
  | 'evader-leech'
  | 'low-contributor'
  | 'subsistence-worker'
  | 'illiquid-fighter'
  | 'sovereign-patriot'
  | 'combat-veteran'
  | 'historical-pillar'
  | 'standard-contributor';

export type SpecialCitizenContext =
  | 'resting-veteran-donor'
  | 'war-vet-in-eco'
  | 'industrial-war-sacrifice';

export interface PlayerTransactionSummary {
  userId: string;
  // 1. Employment Wages (Wage transactions)
  wagesEarnedBtc: number; // Real salary received from working in domestic & foreign companies
  wagesCount: number;
  wagesPaidBtc?: number; // Salaries paid out to employees by company owner
  wagesPaidCount?: number;
  // 2. Commercial Market (Trading & Item Market transactions)
  salesVolumeBtc: number; // Total gross market sales revenue (Trading commodities + Item Market equipment)
  salesCount: number;
  commoditySalesBtc?: number; // Sales of commodities/resources (Trading tab)
  equipmentSalesBtc?: number; // Sales of equipment/gear with stats (Item Market tab)
  purchasesVolumeBtc: number; // Total gross market purchases expense
  purchasesCount: number;
  commodityPurchasesBtc?: number; // Purchases of commodities/resources
  equipmentPurchasesBtc?: number; // Purchases of equipment/gear
  netTradeProfitBtc: number; // Realized net trade profit with anti-flipper protection
  // 3. Journalism & Articles (Article Tip transactions)
  tipsReceivedBtc?: number;
  tipsSentBtc?: number;
  // 4. Fees & Crafting (Application fee, Craft Item, Dismantle, Open Case)
  applicationFeesBtc?: number;
  craftingExpensesBtc?: number;
  dismantleExpensesBtc?: number;
  caseOpeningExpensesBtc?: number;
  // 5. Treasury & Military Unit Donations (Donation transactions)
  donationsGivenBtc: number; // Direct sovereign country treasury donations (sellerCountryId === auditedCountryId)
  donationTransfersCount?: number; // Number of distinct country donation events in period
  muDonationsBtc?: number; // Donations to Military Units (sellerMuId present) — affects Net Cashflow ONLY, never Leaderboard/Standing
  muDonationsCount?: number; // Number of distinct Military Unit donation events in period
  // 6. Aggregate Cashflow Metrics
  grossInflowBtc: number; // Total gross money coming into citizen wallet (Wages + All Sales + Tips Received)
  totalTradingCOGSBtc: number; // Cost of commodities & equipment bought
  operatingOutflowsBtc: number; // Fees, crafting, dismantling, crate openings
  totalOutflowsBtc?: number; // Total real period outflows (Purchases + Wages Paid + Operating Outflows + Tips Sent + Country Donations + MU Donations)
  netDisposableIncomeBtc: number; // Real Net Cashflow (Gross Inflow - Total Outflows)
  // 7. Aggregate Real Cashflow & Metadata
  salariesEarnedBtc: number; // Alias for wagesEarnedBtc for backwards compatibility
  netCashflowBtc?: number; // Total real period inflow minus outflows
  solvencyStatus?: 'solvent-liquid' | 'illiquid-locked' | 'subsistence';
  ministerialVerdict?: MinisterialVerdict;
  ministerialVerdictReason?: string;
  periodDays: number;
  windowReceiptCount?: number;
  dataSource: 'live-ledger' | 'estimated-capacity';
  primaryTradedResource?: 'oil' | 'iron' | 'food' | 'munitions' | 'general';
  // 8. Construction CapEx vs. Iron/Steel Speculation Tracking
  constructionPurchasesBtc?: number;
  constructionSalesBtc?: number;
  ironSteelPurchasesBtc?: number;
  ironSteelSalesBtc?: number;
  concreteLimestonePurchasesBtc?: number;
  concreteLimestoneSalesBtc?: number;
  commodityByItemPurchasesBtc?: Record<string, number>;
  commodityByItemSalesBtc?: Record<string, number>;
}

export type BuildGradeId =
  | 'optimal-meta'
  | 'optimal-early-selfwork'
  | 'viable-selfwork'
  | 'war-ready'
  | 'war-eco-builder'
  | 'suboptimal-sp';

export interface CitizenSkillBreakdown {
  companies: number;
  leadership: number;
  management: number; // +2% employee production per point in v0.27
  energy: number; // Base 100 + 10 per level; used for self-work, hiring, and training
  production: number;
  lootChance: number; // Luck
  legacyEntrepreneurship: number; // Refunded in v0.27
  attack: number;
  criticalDamages: number;
  criticalChance: number;
  armor: number;
  precision: number;
  dodge: number;
  health: number;
  stamina: number;
}

export interface CitizenBuildEvaluation {
  grade: BuildGradeId;
  badgeLabel: string;
  shortLabel: string;
  archetypeLabel: string;
  score: number; // 0-100 build alignment score
  isLevelEarlySelfWork: boolean; // True when Lvl 1-25 using self-work production
  isHighLevelViableSelfWork: boolean; // True when Lvl 26+ maxing Production + Energy without Leadership
  managementBoostPct: number; // management level * 2%
  energyPoolMax: number; // 100 + energy level * 10
  summary: string;
  recommendations: string[];
  warnings: string[];
}

export interface CitizenEconomicProfile {
  userId: string;
  username: string;
  avatarUrl?: string;
  countryId: string;
  countryName: string;
  level: number;
  wealthBtc: number; // Total net worth (patrimonio total)
  liquidBtc?: number; // Available cash BTC (liquidez disponible)
  resourceWealthBtc?: number; // Raw material / resource stockpile wealth (items)
  companiesWealthBtc?: number; // Companies valuation (empresas)
  equipmentsWealthBtc?: number; // Equipment valuation
  weaponsWealthBtc?: number; // Weapons valuation
  pastWealthBtc?: number; // Wealth at start of analysis period
  grossIncomeBtc?: number; // Verified Gross Inflow (wages + market sales + tips)
  grossInflowBtc?: number; // Verified Gross Inflow (Wages + All Sales + Tips Received)
  netCashflowBtc?: number; // Verified Net Cashflow (Gross Inflow - Purchases - Payroll - Operating Outflows)
  periodDonatedBtc?: number; // Donations within analysis period
  totalDonatedBtc: number;
  directDonatedBtc: number;
  damageDonatedBtc: number;
  damageValueBtc?: number; // Converted combat damage in BTC equivalent
  totalCombatDamage?: number; // 7-day period combat damage dealt
  lifetimeCombatDamage?: number; // Career all-time combat damage dealt
  isHistoricalTopDonor?: boolean;
  historicalRank?: number;
  isNationalHeavyHitter?: boolean; // In Top Heavy Hitters for this country
  heavyHitterRank?: number;
  isDormantPillar?: boolean; // True when citizen qualifies as a Historical Pillar but has 0 / below-low-quota contribution in active window
  dormantWarningBadge?: string;
  specialContextTag?: SpecialCitizenContext;
  specialContextBadge?: string;
  specialContextReason?: string;
  tierReasonBadge?: string;
  donationCount: number;
  lastDonationAt?: string;
  contributionRatio: number; // Percentage of gross income donated (e.g. 15%)
  leechTier: LeechTier;
  economicStanding?: CitizenEconomicStanding;
  warSkillPoints: number;
  ecoSkillPoints: number;
  skillBreakdown?: CitizenSkillBreakdown;
  buildEvaluation?: CitizenBuildEvaluation;
  playstyle: PlaystyleMode;
  manualTag: PlayerTag;
  notes?: string;
  lastRespecAlert?: string;
  isActive: boolean;
  daysInBuild?: number;
  buildDurationSource?: 'api-reset' | 'respec-detected' | 'weekly-combat-bound' | 'unverified';
  daysSinceLastDonation?: number;
  isInactiveDonor?: boolean;
  isOnWatch?: boolean;
  watchReason?: string;
  auditBaselineStatus?: 'audited' | 'pending-audit' | 'baseline-today';
  auditSchemaVersion?: number; // Schema version guard (v2+ enforces strict personal_receipts isolation & MU vs Country split)
  auditedAt?: string; // ISO timestamp of when live personal receipts were verified
  receiptCount?: number; // Total verified in-game receipts in citizen ledger
  muDonationsBtc?: number; // Military Unit donations in active window (cashflow outflow only)
  auditDeltaAlert?: {
    previousGrossInflowBtc: number;
    differenceBtc: number;
    newReceiptsCount: number;
    previousAuditedAt?: string;
  };
  auditMethodologyNote?: string;
  ministerialVerdict?: MinisterialVerdict;
  ministerialVerdictReason?: string;
  playerCashflow?: PlayerTransactionSummary;
  companiesCount?: number; // Total owned companies in player assets
  activeCompaniesCount?: number; // Currently operational active company slots
  maxCompaniesCap?: number; // Company slots permitted by current build / skills
  automationLevelEst?: number; // 1-7 PP/hr
  storageLevelEst?: number; // 1-7
  breakRoomLevelEst?: number; // 1-3 employee slots per company
  estimatedCompanyCapacityBtc?: number;
  companiesList?: WareraCompany[];
  worksCount?: number; // Total career work shifts from in-game stats
  employerCompanyId?: string;
}

export interface CountryEconomicBenchmark {
  countryId: string;
  totalActiveCitizens: number;
  wealthP25: number;
  wealthMedian: number;
  wealthP75: number;
  wealthP90: number;
  liquidMedian: number;
  liquidP75: number;
  resourceMedian?: number;
  resourceP75?: number;
  incomeMedian?: number;
  incomeP75?: number;
  donationMedian?: number;
  donationP75?: number;
  lifetimeDonationMedian?: number;
  lifetimeDonationP75?: number;
  careerDamageMedian?: number;
  careerDamageP75?: number;
  companiesWealthMedian?: number;
  companiesWealthP75?: number;
  topDonorsThreshold: number;
  fighterDamageMedianTopTier: number;
  heavyHitterCohortSize: number;
}

export type NudgeArchetype = 'weekly-cashflow' | 'liquid-hoarder' | 'resource-stockpiler';

export interface CompanyRecipeProjectionItem {
  companyName: string;
  itemCode: string;
  commodityName: string;
  recipeSummary: string;
  dailyPP: number;
  weeklyUnits: number;
  livePriceBtc: number;
  weeklyGrossBtc: number;
  weeklyRawInputsBtc: number;
  weeklyWagesBtc: number;
  weeklyNetProfitBtc: number;
}

export interface ArchetypeComparisonItem {
  id: NudgeArchetype;
  title: string;
  formulaBasis: string;
  suggestedBtc: number;
  isRecommended: boolean;
  explanation: string;
}

export type CapexAuditVerdict =
  | 'verified-construction-capex'
  | 'healthy-growth-speculation'
  | 'iron-steel-speculation'
  | 'solvent-no-capex';

export type DiplomaticActionMode =
  | 'nudge'
  | 'commendation'
  | 'over-donation-warning';

export type CommendationArchetype =
  | 'active-historical-pillar'
  | 'dormant-pillar-reactivation'
  | 'industrial-war-sacrifice'
  | 'sovereign-treasury-patriot'
  | 'battlefield-frontline-hero'
  | 'dual-crown-vanguard';

export type OverDonationWarningArchetype =
  | 'capex-growth-strain'
  | 'combat-ammo-strain';

export interface CommendationArchetypeOption {
  id: CommendationArchetype;
  title: string;
  subtitle: string;
  badge: string;
  isRecommended: boolean;
  explanation: string;
}

export interface OverDonationArchetypeOption {
  id: OverDonationWarningArchetype;
  title: string;
  subtitle: string;
  badge: string;
  isRecommended: boolean;
  explanation: string;
}

export interface CitizenNudgeRecommendation {
  archetype: NudgeArchetype;
  archetypeLabel: string;
  archetypeDescription: string;
  recommendedArchetype: NudgeArchetype;
  recommendedArchetypeLabel: string;
  recommendedArchetypeReason: string;
  archetypeComparison: ArchetypeComparisonItem[];
  suggestedAmountBtc: number;
  minSuggestedBtc: number;
  maxSuggestedBtc: number;
  stepBtc: number;
  presetsBtc: Array<{ label: string; amount: number; description: string }>;
  liquidBtc: number;
  liquidRatioToCountryMedian: number;
  resourceWealthBtc: number;
  resourceRatioToCountryMedian: number;
  excessResourceBtc: number;
  protectedGrowthReserveBtc: number;
  taxableExcessResourceBtc: number;
  excessStockpileAboveBufferBtc: number;
  isHealthyGrowthSpeculation: boolean;
  growthShieldSummary: string;
  suggestedLiquidationPct: number; // e.g. 12.5% (10%-15% band)
  grossIncomeBtc: number;
  incomeRatioToCountryMedian: number;
  targetQuotaPct: number;
  rationaleSummary: string;
  // Sophisticated 7D Recipe Projection & Anti-Speculation CapEx Audit
  projected7dCompanyGrossOutputBtc: number;
  projected7dCompanyRawInputBtc: number;
  projected7dCompanyWagesBtc: number;
  projected7dCompanyNetProfitBtc: number;
  companyProjectionItems: CompanyRecipeProjectionItem[];
  verified7dNetTradingBtc: number;
  taxable7dNetTradingBtc: number;
  tradingReinvestmentAllowanceBtc: number;
  verified7dWagesEarnedBtc: number;
  total7dProjectedEarningPowerBtc: number;
  equipmentsWealthBtc: number;
  weaponsWealthBtc: number;
  companiesWealthBtc: number;
  capexAuditVerdict: CapexAuditVerdict;
  capexAuditBadge: string;
  capexAuditExplanation: string;
  capexGraceDiscountApplied: boolean;
  constructionPurchasesBtc: number;
  ironSteelPurchasesBtc: number;
  ironSteelSalesBtc: number;
  concreteLimestonePurchasesBtc: number;
  // Adaptive Diplomatic Modes (Nudge vs. Merit-Based Commendation vs. Over-Donation Warning)
  recommendedDiplomaticMode: DiplomaticActionMode;
  recommendedDiplomaticModeLabel: string;
  recommendedDiplomaticModeReason: string;
  recommendedDiplomaticReason: string;
  recommendedDiplomaticBadge: string;
  // Dual-Status / Secondary Diplomatic Recommendation (for Dormant Pillars & Stockpiling Combat Heroes)
  isDormantPillar?: boolean;
  isStockpilingCombatHero?: boolean;
  dormantWarningBadge?: string;
  dormantWarningTooltip?: string;
  specialContextTag?: SpecialCitizenContext;
  specialContextBadge?: string;
  specialContextReason?: string;
  secondaryDiplomaticMode?: DiplomaticActionMode;
  secondaryDiplomaticModeLabel?: string;
  secondaryDiplomaticModeReason?: string;
  secondaryDiplomaticBadge?: string;
  recommendedCommendationArchetype: CommendationArchetype;
  recommendedCommendationLabel: string;
  recommendedCommendationReason: string;
  commendationArchetypeOptions: CommendationArchetypeOption[];
  commendationOptions: CommendationArchetypeOption[];
  recommendedOverDonationArchetype: OverDonationWarningArchetype;
  recommendedOverDonationLabel: string;
  recommendedOverDonationReason: string;
  overDonationArchetypeOptions: OverDonationArchetypeOption[];
  overDonationOptions: OverDonationArchetypeOption[];
  isOverDonatingBurnoutRisk: boolean;
  sustainableWeeklyCapBtc: number;
  overDonationExcessBtc: number;
  donatedShareOfWeeklyIncomePct: number;
}

export interface MinistryConfig {
  analysisPeriodDays: number; // default: 7 (1 week)
  // Standard / Default thresholds (used for general or unclassified)
  patriotIncomeRatePct: number; // default: 15 (>= 15% is Model Patriot)
  moderateIncomeRatePct: number; // default: 7 (7% - 15% is Moderate Donor)
  lowContributorIncomeRatePct: number; // default: 2.5 (2.5% - 7% is Low Contributor; < 2.5% and high wealth is Leech)
  // War Mode specific thresholds (for frontline soldiers who spend on combat & ammo)
  warPatriotRatePct: number; // default: 6 (>= 6% is Model Patriot for War Mode)
  warModerateRatePct: number; // default: 2.5
  warLowRatePct: number; // default: 1
  // Eco Mode specific thresholds (for passive company & production owners)
  ecoPatriotRatePct: number; // default: 15
  ecoModerateRatePct: number; // default: 7
  ecoLowRatePct: number; // default: 2.5
  // Hybrid Mode specific thresholds
  hybridPatriotRatePct: number; // default: 10
  hybridModerateRatePct: number; // default: 5
  hybridLowRatePct: number; // default: 2
  // Proportional Wealth Cutoff for Critical Leech (only citizens in top 25% wealth of their country can be Critical Leech)
  leechWealthPercentileCutoff: number; // default: 75 (75th percentile of country wealth)
  // Historical Big Contributor Grace Threshold (prevents veterans like Kenshy from false leech classification)
  historicalDonorGraceThresholdBtc: number; // default: 500 BTC lifetime donations
  topHistoricalDonorProtectionRank: number; // default: 10 (protects top 10 historical donors of country)
  topHeavyHitterRankCutoff: number; // default: 10 (top 10 damage dealers in the country are recognized as Heavy Hitters)
  // Damage-to-BTC conversion options (optional combat credit for fighters who donate 0 but deal huge damage)
  includeDamageInLeechCalculation: boolean; // default: false
  damageConversionRateBtcPer1k: number; // default: 0.08 BTC per 1,000 damage (presets: 0.05, 0.08, 0.09, 0.1, 0.12)
  // Resource Wealth inclusion toggle (count commodities/materials in donation capacity, exclude gear)
  includeResourceWealth: boolean; // default: false
  // Legacy fallbacks
  highWealthThreshold?: number;
  fairShareTaxRatePct?: number;
  criticalLeechRatioCutoff?: number;
}

export const DEFAULT_MINISTRY_CONFIG: MinistryConfig = {
  analysisPeriodDays: 7,
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
  historicalDonorGraceThresholdBtc: 500,
  topHistoricalDonorProtectionRank: 10,
  topHeavyHitterRankCutoff: 10,
  includeDamageInLeechCalculation: false,
  damageConversionRateBtcPer1k: 0.08,
  includeResourceWealth: false,
  highWealthThreshold: 25000,
  fairShareTaxRatePct: 5,
  criticalLeechRatioCutoff: 0.20,
};

export interface WatchedCitizen {
  userId: string;
  username: string;
  countryId: string;
  addedAt: string;
  reasonNote: string;
  wealthBtc: number;
  totalDonatedBtc: number;
  contributionRatio: number;
  playstyle: PlaystyleMode;
  avatarUrl?: string;
}

export interface WealthSnapshot {
  id: string; // `${userId}_${timestamp}`
  userId: string;
  countryId: string;
  wealthBtc: number;
  weeklyDamage?: number;
  lifetimeDamage?: number;
  timestamp: number;
  dateStr: string;
}

export type TransactionDirection = 'sent' | 'received';

export type NationalTransactionCategory =
  | 'ayuda'
  | 'broma'
  | 'alianza'
  | 'pacto'
  | 'alliance-pact'
  | 'mercenary-contract'
  | 'foreign-aid'
  | 'reparations'
  | 'trade-subsidy'
  | 'defense-treaty'
  | 'other';

export interface NationalTransaction {
  id: string;
  sourceCountryId: string;
  sourceCountryName: string;
  targetCountryId: string;
  targetCountryName: string;
  direction: TransactionDirection;
  category: NationalTransactionCategory;
  amountBtc: number;
  date: string;
  referenceNote: string;
  createdByMinister?: string;
  createdAt: string;
}

export type CommoditySector =
  | 'cases'
  | 'craft'
  | 'buffs'
  | 'ammo'
  | 'food'
  | 'construction'
  | 'strategic';

export interface ResourceReserveItem {
  id: string; // itemCode e.g. 'petroleum', 'paper', 'cocain'
  name: string; // Display name e.g. 'Petroleum', 'Paper', 'Pill'
  code: string; // Short code e.g. 'PE', 'PP', 'PILL'
  category: 'munitions' | 'food' | 'raw-materials' | 'narcotics' | 'medical' | 'cases' | 'craft' | 'buffs' | 'ammo' | 'construction' | 'strategic';
  sector: CommoditySector;
  unit: string;
  currentStock: number;
  netBoughtPeriod: number;
  netSoldPeriod: number;
  avgCostBtc: number;
  currentMarketPriceBtc: number;
  avg7dBtc?: number;
  min7dBtc?: number;
  max7dBtc?: number;
  stdDev?: number;
  zScore?: number;
  pctDev?: number;
  spreadPct?: number;
  highestBid?: number;
  lowestAsk?: number;
  advisory?: MarketAdvisory;
  advisoryReason?: string;
  notes?: string;
  isStockVerified?: boolean;
  stockStatus?: 'synced' | 'unverified' | 'custom';
}

export type MarketAdvisory = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

export interface CommodityTrend {
  id: string;
  name: string;
  category: string;
  sector: CommoditySector;
  unit: string;
  currentPrice: number;
  change24h: number;
  avg7d: number;
  min7d: number;
  max7d: number;
  stdDev?: number;
  zScore?: number;
  pctDev?: number;
  spreadPct?: number;
  highestBid?: number;
  lowestAsk?: number;
  volume24h?: number;
  volumeChange24h?: number;
  advisory: MarketAdvisory;
  advisoryReason: string;
  topBuys?: Array<{ price: number; qty: number }>;
  topSells?: Array<{ price: number; qty: number }>;
  historyPoints?: Array<{ date: string; price: number; volume: number }>;
}

export interface CommodityMovementItem {
  id: string;
  itemCode: string;
  itemName: string;
  sector: CommoditySector;
  type: 'buy' | 'sell' | 'donation' | 'transfer-in' | 'transfer-out';
  quantity: number;
  unit: string;
  unitPriceBtc: number;
  totalBtc: number;
  date: string;
  createdAt: string;
  counterpartName?: string;
  counterpartCountryId?: string;
  counterpartUserId?: string;
  referenceNote?: string;
}

export interface CitizenPlaystyleRecord {
  playstyle: PlaystyleMode;
  previousPlaystyle?: PlaystyleMode;
  warPoints: number;
  ecoPoints: number;
  skillSignature?: Record<string, number>;
  buildStartedAt?: string;
  lastSkillsResetAt?: string;
  updatedAt?: string;
}

export interface RespecAlert {
  id: string;
  userId: string;
  username: string;
  previousMode: PlaystyleMode;
  newMode: PlaystyleMode;
  warPoints: number;
  ecoPoints: number;
  timestamp: string;
  acknowledged: boolean;
  triggerReason?: string;
}

export interface MinisterialMessage {
  language: 'es' | 'en';
  tone: 'diplomatic-formal' | 'patriotic-military' | 'firm-economic';
  title: string;
  body: string;
  archetype?: NudgeArchetype;
  diplomaticMode?: DiplomaticActionMode;
  commendationArchetype?: CommendationArchetype;
  overDonationArchetype?: OverDonationWarningArchetype;
  suggestedAmountBtc?: number;
}

export type WarReadinessRole =
  | 'allied-main'
  | 'allied-supporter'
  | 'opponent-main'
  | 'opponent-supporter';

export interface WarReadinessCitizenSummary {
  userId: string;
  username: string;
  avatarUrl?: string;
  level: number;
  companiesSkillCap: number;
  totalCompanies: number;
  auto5CompaniesCount: number;
  isWarReady: boolean;
  isTier5Industrial: boolean;
}

export interface StateWarReadinessReport {
  countryId: string;
  countryName: string;
  countryCode: string;
  role: WarReadinessRole;
  officialActivePopulation: number;
  activePopulation: number;
  warReadyCitizensCount: number;
  averageWarParticipants: number;
  tier5IndustrialCitizensCount: number;
  warReadyRoster: WarReadinessCitizenSummary[];
  tier5IndustrialRoster: WarReadinessCitizenSummary[];
  scanStatus: 'idle' | 'fetching-census' | 'scanning-companies' | 'completed' | 'error';
  scannedCandidates: number;
  totalCandidates: number;
  lastEvaluatedAt?: string;
  error?: string;
}

