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
  leveling?: {
    level?: number;
    totalXp?: number;
  };
  militaryRank?: number;
  isActive?: boolean;
  stats?: {
    damagesCount?: number;
  };
  rankings?: {
    userDamages?: {
      value?: number;
      rank?: number;
    };
    weeklyUserDamages?: {
      value?: number;
      rank?: number;
    };
  };
}

/**
 * Individual donation transaction event from transaction.getPaginatedTransactions
 */
export interface WareraTransaction {
  _id: string;
  transactionType: 'donation' | string;
  money?: number;     // Amount of BTC donated in this single transaction
  amount?: number;    // Normalized amount
  userId?: string;    // Citizen donor ID
  countryId?: string; // Recipient country ID
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
