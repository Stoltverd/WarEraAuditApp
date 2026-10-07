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
    entrepreneurship?: { level?: number; value?: number; [key: string]: any };
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
  money?: number;     // Amount of BTC involved in transaction
  amount?: number;    // Normalized amount
  userId?: string;    // Citizen ID (employee, actor, donor, etc.)
  sellerId?: string;  // Seller user ID (for market/trade sales)
  buyerId?: string;   // Buyer user ID (for market/trade purchases)
  companyId?: string; // Employer or company ID (for wage/production)
  item?: string;      // Canonical resource / item traded (Oil, Iron, Food, Munitions)
  resourceType?: string;
  countryId?: string; // Recipient/Origin country ID
  createdAt: string;  // Exact timestamp of this transaction
  updatedAt?: string;
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

export interface WareraCompany {
  _id: string;
  user: string;
  region?: string;
  name: string;
  itemCode: string;
  isFull?: boolean;
  concreteInvested?: number;
  production: number;
  activeUpgradeLevels?: {
    storage?: number;
    automatedEngine?: number;
    breakRoom?: number;
    [key: string]: number | undefined;
  };
  workerCount?: number;
  estimatedValue?: number;
  createdAt?: string;
  updatedAt?: string;
}
