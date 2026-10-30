/**
 * Type definitions for War Era API models, individual transactions, damage donations, and ranking analytics.
 */

export interface WareraCountry {
  _id: string;
  name: string;
  code: string;
  money: number;
  countryWealth?: {
    value: number;
    rank?: number;
    tier?: string;
  };
  rankings?: {
    countryWealth?: {
      value: number;
      rank?: number;
      tier?: string;
    };
    countryActivePopulation?: {
      value: number;
      rank?: number;
      tier?: string;
    };
  };
  orgs?: string[];
  allies?: string[];
  taxes?: {
    income?: number;
    market?: number;
    selfWork?: number;
  };
  unrest?: {
    bar?: number;
    barMax?: number;
    lastContributionAt?: string;
  };
}

export interface WareraUserLite {
  _id: string;
  username: string;
  avatarUrl?: string;
  avatar?: string;
  country?: string;
  countryId?: string;
  level?: number;
  leveling?: {
    level?: number;
    totalXp?: number;
  };
  militaryRank?: number;
  isActive?: boolean;
  createdAt?: string;
  skillsUpdatedAt?: number;
  dates?: {
    lastConnectionAt?: string;
    lastSkillsResetAt?: string;
    lastWorkAt?: string;
    [key: string]: any;
  };
  money?: number;
  company?: string;
  stats?: {
    damagesCount?: number;
    companiesCount?: number;
    wealth?: {
      total?: number;
      money?: number;
      items?: number;
      companies?: number;
      equipments?: number;
      weapons?: number;
    } | number;
    [key: string]: any;
  };
  rankings?: {
    userWealth?: {
      value?: number;
      rank?: number;
    };
    userDamages?: {
      value?: number;
      rank?: number;
    };
    weeklyUserDamages?: {
      value?: number;
      rank?: number;
    };
  };
  skills?: {
    attack?: { level?: number; value?: number; [key: string]: any };
    criticalDamages?: { level?: number; value?: number; [key: string]: any };
    criticalChance?: { level?: number; value?: number; [key: string]: any };
    armor?: { level?: number; value?: number; [key: string]: any };
    precision?: { level?: number; value?: number; [key: string]: any };
    dodge?: { level?: number; value?: number; [key: string]: any };
    health?: { level?: number; value?: number; [key: string]: any };
    stamina?: { level?: number; value?: number; [key: string]: any };
    energy?: { level?: number; value?: number; [key: string]: any };
    companies?: { level?: number; value?: number; [key: string]: any };
    leadership?: { level?: number; value?: number; [key: string]: any };
    entrepreneurship?: { level?: number; value?: number; [key: string]: any }; // Legacy pre-v0.27 fallback
    production?: { level?: number; value?: number; [key: string]: any };
    management?: { level?: number; value?: number; [key: string]: any };
    lootChance?: { level?: number; value?: number; [key: string]: any };
    [key: string]: any;
  };
}

export type WareraTransactionType =
  | 'wage'
  | 'trading'
  | 'market'
  | 'itemMarket'
  | 'donation'
  | 'applicationFee'
  | 'articleTip'
  | 'openCase'
  | 'craftItem'
  | 'dismantleItem'
  | string;

/**
 * Individual donation / financial transaction event from transaction.getPaginatedTransactions
 */
export interface WareraTransaction {
  _id: string;
  transactionType: WareraTransactionType;
  money?: number;           // Amount of BTC involved in transaction
  amount?: number;          // Normalized amount
  userId?: string;          // Audited / primary citizen ID
  sellerId?: string;        // Seller user ID (inflow earner for wage, trading, itemMarket, articleTip)
  buyerId?: string;         // Buyer user ID (outflow spender for trading, itemMarket, wage employer, donation donor, fees)
  sellerCountryId?: string; // Recipient Country ID for country donations / national market transactions
  buyerCountryId?: string;  // Buyer Country ID for national treasury purchases/transfers
  sellerMuId?: string;      // Recipient Military Unit ID for MU donations
  buyerMuId?: string;       // Buyer Military Unit ID
  companyId?: string;       // Employer or company ID (for wage/production)
  senderId?: string;        // Payer / sender ID
  recipientId?: string;     // Beneficiary / recipient ID
  action?: string;          // Action verb if present (work, buy, sell, etc.)
  item?: string;            // Canonical resource / item traded
  itemCode?: string;        // Official WarEra commodity code (e.g. 'iron', 'steel', 'oil', 'bread')
  itemObj?: any;            // Populated equipment/item object from itemMarket
  quantity?: number;        // Quantity of items/commodities in order
  resourceType?: string;
  countryId?: string;       // Recipient/Origin country ID
  isPersonalReceipt?: boolean; // True when fetched from userId personal transaction stream
  createdAt: string;        // Exact timestamp of this transaction
  updatedAt?: string;
}

/**
 * Live-resolved counterparty profile for forensic receipt auditing (Player, Company + Owner, Country Treasury, or Military Unit)
 */
export interface LiveCounterpartyProfile {
  id: string;
  kind: 'player' | 'company' | 'country' | 'mu';
  userId?: string;
  username: string;
  avatarUrl?: string;
  countryId?: string;
  countryName?: string;
  countryCode?: string;
  companyId?: string;
  companyName?: string;
  resolvedAt: number;
}

/**
 * Cumulative donation record from donation.getManyPaginated
 */
export interface WareraCumulativeDonation {
  _id: string;
  userId: string;
  countryId: string;
  amount: number;       // Lifetime cumulative sum of all donations by this user
  createdAt: string;   // First donation date
  updatedAt: string;   // Most recent donation date
}

export interface DonationTotals {
  totalAmount: number;
  donorCount: number;
}

export type RankingTimeframe = 'daily' | 'weekly' | 'monthly' | 'all' | 'custom';

export interface CustomDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface DamageDonationConfig {
  enabled: boolean;
  ratePer1k: number; // BTC per 1,000 combat damage
}

export interface DonorRankingItem {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  totalAmount: number;     // Combined total (directAmount + damageAmount)
  directAmount: number;    // Direct BTC donated
  damageAmount: number;    // Converted BTC from combat damage
  rawDamageDealt: number;  // Actual combat damage points in period
  appliedRatePer1k: number;// Conversion rate used (BTC per 1k damage)
  transactionCount: number;
  lastDonationAt: string;
  firstDonationAt: string;
  lastDonationAmount?: number;
  transactions: WareraTransaction[];
  donations: WareraTransaction[];
  isCumulativeOnly?: boolean;
  level?: number;
  playstyle?: 'pure-eco' | 'pure-war' | 'hybrid';
  allTimeDirectAmount?: number; // Lifetime cumulative BTC donated to this country
  allTimeRank?: number;         // Lifetime cumulative rank in this country
  periodStartDate?: string;     // Start ISO date of the active timeframe window
  periodEndDate?: string;       // End ISO date of the active timeframe window
}

export interface RankingSummary {
  timeframe: RankingTimeframe;
  startDate: string;
  endDate: string;
  totalDonors: number;
  totalAmountDonated: number; // Combined in BTC
  totalDirectDonated: number; // Direct BTC
  totalDamageDonated: number; // Damage BTC
  topDonor?: DonorRankingItem;
  averageDonationAmount: number;
  medianDonationAmount: number;
  totalActiveCitizens?: number;
  leaderboard: DonorRankingItem[];
  isGranular: boolean;
  damageConfig?: DamageDonationConfig;
}

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'completed' | 'error';
  countryId: string;
  countryName: string;
  fetchedItems: number;
  message?: string;
  error?: string;
}

export type EmployeeTraitTier = 'must-have' | 'good-to-have' | 'ok-to-have';

export type EmployeeTraitId =
  // MUST HAVE! (S-Tier)
  | 'handy'
  | 'cosmopolitan'
  | 'late_bloomer'
  | 'craftsman'
  | 'laborer'
  | 'sociable'
  | 'specialist'
  | 'lucky_charm'
  // GOOD TO HAVE (A-Tier)
  | 'girl_power'
  | 'band_of_brothers'
  | 'rival'
  | 'prima_donna'
  | 'diamond_in_the_rough'
  | 'patriot'
  | 'expat'
  | 'modest'
  | 'recruiter'
  | 'trainer'
  // OK TO HAVE (B-Tier)
  | 'improviser'
  | 'nationalist'
  | 'comic'
  | 'bully'
  | 'loner'
  | 'quick_study'
  | 'veteran'
  | 'statist'
  | 'loyal'
  | 'scavenger'
  | 'foreman';

export interface WareraWorkDailyStat {
  dailyDate: string;
  automatedEngine?: number;
  employeeProd?: number;
  workerProd?: number;
  selfWork?: number;
  wage?: number;
  total?: number;
}

export interface WareraCompanyManager {
  _id: string;
  user: string;
  company: string;
  employer?: string;
  rateManagement?: number;
  maxHourlyWage?: number;
  accrued?: number;
  unpaidHours?: number;
  totalEarned?: number;
  hiredAt?: string;
  lockedUntil?: string;
  canEndAt?: string;
  managementLevel?: number;
  isInactive?: boolean;
  hourlyWage?: number;
  productionBonusPercent?: number;
  hasPendingRateReduction?: boolean;
}

export interface WareraCompanyManagerOffer {
  _id?: string;
  company?: string;
  rateManagement?: number;
  maxHourlyWage?: number;
}

export interface WareraRosterEmployeeRaw {
  _id?: string;
  id?: string;
  name?: string;
  nationality?: string;
  country?: string;
  age?: number;
  sex?: string;
  gender?: string;
  base?: {
    production?: number;
    luck?: number;
    responsibility?: number;
  };
  breakdown?: {
    production?: {
      base?: number;
      total?: number;
      contributions?: Array<{ source: string; value?: number; amount?: number }>;
    };
    luck?: {
      base?: number;
      total?: number;
    };
    responsibility?: {
      base?: number;
      total?: number;
    };
  };
  productionBonus?: {
    total?: number;
    contributions?: Array<{ source: string; percent: number }>;
  };
  happinessBreakdown?: {
    value?: number;
    quitChance?: number;
    contributions?: Array<{ source: string; value?: number; amount?: number }>;
  };
  estimate?: {
    production?: number;
    wage?: number;
  };
  wage?: number;
  traits?: Array<{ code?: string; name?: string; revealed?: boolean } | string>;
}

export interface WareraCompanyRosterResponse {
  employees?: WareraRosterEmployeeRaw[];
  hourly?: {
    production?: number;
    wageCost?: number;
    toolboxes?: number;
    cap?: number;
  };
}

export interface WareraRegionRecord {
  _id: string;
  name: string;
  country: string;
  [key: string]: any;
}

export interface WareraBotEmployee {
  id: string;
  name: string;
  age: number; // Youngest (19-21) prioritized over 28+; >35 reroll candidate unless Late Bloomer
  sex: 'male' | 'female';
  nationality: string; // 'homeland' or foreign country code/name
  isForeigner?: boolean;
  happiness: number; // Starts at 50; <30 risks walking out; +/-1% output per point from 50
  trainingPotential: number; // Total training sessions (typically 3-12+, 8-12+ is strong)
  trainingUsed: number;
  tenureDays: number; // Days in the same company (for Veteran 30d & Diamond in the Rough 10d)
  isSpecializedInGood: boolean; // True if working in a company producing their specialized good
  hasTool: boolean;
  toolTier?: 'none' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  badHabitCount?: number; // Removable via Blue training event
  stats: {
    production: number; // Base 1-4+ PP/hr
    luck: number; // Base 1-4+ (0.1% toolbox chance/hr per point)
    responsibility: number; // Base 1-4+ (discipline / handling bad news)
  };
  traits: EmployeeTraitId[];
  hourlyWageBtc: number;
  // Live v0.27 API fields from employee.getCompanyRoster
  productionBonusPct?: number;
  productionBonusDetail?: string;
  hourlyOutputPts?: number;
  quitChance?: number;
  revealedTraitCodes?: string[];
}

export interface WareraCompany {
  _id: string;
  user: string;
  region?: string;
  regionName?: string;
  hostCountryId?: string;
  hostCountryName?: string;
  name: string;
  itemCode: string;
  isFull?: boolean;
  disabledAt?: string | null;
  concreteInvested?: number;
  production: number;
  activeUpgradeLevels?: {
    storage?: number;
    automatedEngine?: number;
    breakRoom?: number; // Level 1 = 1 employee, Level 2 = 2 (20 steel), Level 3 = 3 (80 steel)
    [key: string]: number | undefined;
  };
  workerCount?: number;
  employees?: WareraBotEmployee[];
  managerId?: string;
  managerName?: string;
  hasManager?: boolean;
  managerContract?: WareraCompanyManager | null;
  managerOffer?: WareraCompanyManagerOffer | null;
  workStatsHistory?: WareraWorkDailyStat[];
  rosterHourly?: {
    production?: number;
    wageCost?: number;
    toolboxes?: number;
    cap?: number;
  } | null;
  isHomelandSafeRegion?: boolean;
  isOperatingActive?: boolean;
  estimatedValue?: number;
  createdAt?: string;
  updatedAt?: string;
}


