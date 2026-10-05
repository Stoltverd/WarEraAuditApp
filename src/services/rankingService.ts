/**
 * Aggregation engine for computing true Daily, Weekly, and Monthly donation rankings.
 * Strictly sums individual donation transaction events (e.g. 10 BTC) rather than cumulative lifetime totals.
 */
import {
  fetchGranularDonationTransactions,
  fetchPublicCumulativeDonations,
  batchResolveUsers,
  fetchCountryCitizens,
} from './apiService';
import {
  DonorRankingItem,
  RankingSummary,
  RankingTimeframe,
  CustomDateRange,
  DamageDonationConfig,
  SyncProgress,
  WareraTransaction,
  WareraCumulativeDonation,
  WareraUserLite,
} from '../types/warera';

/**
 * Safely extract string country ID from userProfile.country (which can be a string or object)
 */
export function normalizeCountryId(country: any): string {
  if (!country) return '';
  if (typeof country === 'string') return country.trim();
  if (typeof country === 'object' && country._id) return String(country._id).trim();
  return '';
}

/**
 * Calculate damage points dealt by a user for a given timeframe window
 */
export function getUserDamageForTimeframe(
  userProfile?: WareraUserLite,
  timeframe: RankingTimeframe = 'weekly',
  customRange?: CustomDateRange
): number {
  if (!userProfile) return 0;
  const weekly = userProfile.rankings?.weeklyUserDamages?.value || 0;
  const allTime = userProfile.rankings?.userDamages?.value || userProfile.stats?.damagesCount || 0;

  switch (timeframe) {
    case 'weekly':
      return weekly;
    case 'daily':
      return Math.round(weekly / 7);
    case 'monthly':
      return weekly * 4;
    case 'custom': {
      if (customRange?.startDate && customRange?.endDate) {
        const ms =
          new Date(customRange.endDate).getTime() - new Date(customRange.startDate).getTime();
        const days = Math.max(1, Math.round(ms / (24 * 3600 * 1000)));
        return Math.round((weekly / 7) * days);
      }
      return weekly * 2;
    }
    case 'all':
    default:
      return allTime;
  }
}

/**
 * Filter individual transactions by timeframe window or custom date boundaries
 */
export function filterTransactionsByTimeframe(
  transactions: WareraTransaction[],
  timeframe: RankingTimeframe,
  customRange?: CustomDateRange
): { filtered: WareraTransaction[]; startDate: string; endDate: string } {
  const now = new Date();
  let endDate = now.toISOString();
  let startTime = 0;
  let endTime = now.getTime();

  switch (timeframe) {
    case 'daily':
      // Past 24 hours
      startTime = now.getTime() - 24 * 60 * 60 * 1000;
      break;
    case 'weekly':
      // Past 7 days
      startTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      break;
    case 'monthly':
      // Past 30 days
      startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      break;
    case 'custom':
      if (customRange?.startDate) {
        startTime = new Date(`${customRange.startDate}T00:00:00`).getTime();
      } else {
        startTime = now.getTime() - 14 * 24 * 60 * 60 * 1000;
      }
      if (customRange?.endDate) {
        endTime = new Date(`${customRange.endDate}T23:59:59.999`).getTime();
        endDate = new Date(endTime).toISOString();
      }
      break;
    case 'all':
    default:
      startTime = 0;
      break;
  }

  const startDate = new Date(startTime).toISOString();
  const filtered = transactions.filter((t) => {
    const txTime = new Date(t.createdAt).getTime();
    return txTime >= startTime && txTime <= endTime;
  });

  return { filtered, startDate, endDate };
}

/**
 * Calculate true rankings from individual transaction events (e.g. 10 BTC each)
 * with optional War Mode combat damage conversion.
 */
export function calculateGranularRankings(
  transactions: WareraTransaction[],
  usersMap: Record<string, WareraUserLite>,
  timeframe: RankingTimeframe,
  customRange?: CustomDateRange,
  damageConfig?: DamageDonationConfig,
  targetCountryId?: string
): RankingSummary {
  const { filtered, startDate, endDate } = filterTransactionsByTimeframe(
    transactions,
    timeframe,
    customRange
  );

  const donorMap: Record<string, DonorRankingItem> = {};

  filtered.forEach((tx) => {
    const uid = tx.userId || 'unknown';
    const amount = Number(tx.money || tx.amount || 0);

    if (!donorMap[uid]) {
      const userProfile = usersMap[uid];
      donorMap[uid] = {
        rank: 0,
        userId: uid,
        username: userProfile?.username || `Citizen #${uid.slice(-6)}`,
        avatarUrl: userProfile?.avatarUrl,
        totalAmount: 0,
        directAmount: 0,
        damageAmount: 0,
        rawDamageDealt: 0,
        appliedRatePer1k: 0,
        transactionCount: 0,
        lastDonationAt: tx.createdAt,
        firstDonationAt: tx.createdAt,
        transactions: [],
        donations: [],
        isCumulativeOnly: false,
      };
    }

    const donor = donorMap[uid];
    donor.directAmount += amount;
    donor.transactionCount += 1;
    donor.transactions.push(tx);

    const txTime = new Date(tx.createdAt).getTime();
    if (txTime > new Date(donor.lastDonationAt).getTime()) {
      donor.lastDonationAt = tx.createdAt;
    }
    if (txTime < new Date(donor.firstDonationAt).getTime()) {
      donor.firstDonationAt = tx.createdAt;
    }
  });

  let totalDirect = 0;
  let totalDamage = 0;
  const appliedRate = damageConfig?.enabled ? (Number(damageConfig.ratePer1k) || 0) : 0;

  // If War Mode damage donations is active, also include country citizens who dealt combat damage
  // even if they have not made a direct monetary donation, provided they hold active citizenship in the audited country!
  if (damageConfig?.enabled && appliedRate > 0) {
    Object.values(usersMap).forEach((userProfile) => {
      if (!userProfile || !userProfile._id) return;
      const uid = userProfile._id;
      // Skip if already has direct transactions in this country
      if (donorMap[uid]) return;

      // STRICT SOVEREIGN CITIZENSHIP CHECK FOR PURE FIGHTERS:
      // A fighter who has not donated cash to this country MUST currently be a registered citizen of this nation!
      if (targetCountryId && normalizeCountryId(userProfile.country) !== targetCountryId) {
        return;
      }

      const rawDamageDealt = getUserDamageForTimeframe(userProfile, timeframe, customRange);
      if (rawDamageDealt > 0) {
        donorMap[uid] = {
          rank: 0,
          userId: uid,
          username: userProfile.username || `Citizen #${uid.slice(-6)}`,
          avatarUrl: userProfile.avatarUrl,
          totalAmount: 0,
          directAmount: 0,
          damageAmount: 0,
          rawDamageDealt,
          appliedRatePer1k: appliedRate,
          transactionCount: 0,
          lastDonationAt: new Date().toISOString(),
          firstDonationAt: new Date().toISOString(),
          transactions: [],
          donations: [],
          isCumulativeOnly: false,
        };
      }
    });
  }

  const donorsList = Object.values(donorMap).map((d) => {
    const userProfile = usersMap[d.userId];
    totalDirect += d.directAmount;

    let rawDamageDealt = 0;
    let damageAmount = 0;

    // Universal Sovereign Rule: Combat damage is ONLY converted if the donor is CURRENTLY a citizen of this country!
    const isCurrentCitizen = Boolean(
      targetCountryId && normalizeCountryId(userProfile?.country) === targetCountryId
    );

    if (damageConfig?.enabled && appliedRate > 0 && isCurrentCitizen) {
      rawDamageDealt = getUserDamageForTimeframe(userProfile, timeframe, customRange);
      damageAmount = parseFloat(((rawDamageDealt / 1000) * appliedRate).toFixed(3));
      totalDamage += damageAmount;
    }

    const combinedTotal = parseFloat((d.directAmount + damageAmount).toFixed(3));
    const sortedTx = d.transactions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      ...d,
      totalAmount: combinedTotal,
      directAmount: parseFloat(d.directAmount.toFixed(3)),
      damageAmount,
      rawDamageDealt,
      appliedRatePer1k: isCurrentCitizen ? appliedRate : 0,
      transactions: sortedTx,
      donations: sortedTx,
    };
  });

  // Sort descending by totalAmount
  donorsList.sort((a, b) => b.totalAmount - a.totalAmount);

  donorsList.forEach((d, idx) => {
    d.rank = idx + 1;
  });

  const totalDonors = donorsList.length;
  const totalCombined = parseFloat((totalDirect + totalDamage).toFixed(3));
  const averageDonationAmount =
    totalDonors > 0 ? parseFloat((totalCombined / totalDonors).toFixed(3)) : 0;

  return {
    timeframe,
    startDate,
    endDate,
    totalDonors,
    totalAmountDonated: totalCombined,
    totalDirectDonated: parseFloat(totalDirect.toFixed(3)),
    totalDamageDonated: parseFloat(totalDamage.toFixed(3)),
    topDonor: donorsList[0] || undefined,
    averageDonationAmount,
    leaderboard: donorsList,
    isGranular: true,
    damageConfig,
  };
}

/**
 * Calculate All-Time rankings from public cumulative donations table
 * with optional War Mode combat damage conversion.
 */
export function calculateCumulativeRankings(
  cumulative: WareraCumulativeDonation[],
  usersMap: Record<string, WareraUserLite>,
  damageConfig?: DamageDonationConfig,
  timeframe: RankingTimeframe = 'all',
  customRange?: CustomDateRange,
  targetCountryId?: string,
  transactions?: WareraTransaction[]
): RankingSummary {
  let totalDirect = 0;
  let totalDamage = 0;
  const appliedRate = damageConfig?.enabled ? (Number(damageConfig.ratePer1k) || 0) : 0;

  const donorsList: DonorRankingItem[] = cumulative.map((c) => {
    const userProfile = usersMap[c.userId];
    const directAmount = Number(c.amount) || 0;
    totalDirect += directAmount;

    let rawDamageDealt = 0;
    let damageAmount = 0;

    // Universal Sovereign Rule: Combat damage is ONLY converted if the donor is CURRENTLY a citizen of this country!
    const isCurrentCitizen = Boolean(
      targetCountryId && normalizeCountryId(userProfile?.country) === targetCountryId
    );

    if (damageConfig?.enabled && appliedRate > 0 && isCurrentCitizen) {
      rawDamageDealt = getUserDamageForTimeframe(userProfile, timeframe, customRange);
      damageAmount = parseFloat(((rawDamageDealt / 1000) * appliedRate).toFixed(3));
      totalDamage += damageAmount;
    }

    const combinedTotal = parseFloat((directAmount + damageAmount).toFixed(3));

    const singleTx: WareraTransaction = {
      _id: c._id,
      transactionType: 'Cumulative Lifetime Total',
      money: directAmount,
      amount: directAmount,
      userId: c.userId,
      countryId: c.countryId,
      createdAt: c.updatedAt || c.createdAt,
    };

    // Calculate verified country-specific donations count specifically for this country
    const countrySpecificTxs = transactions && targetCountryId
      ? transactions.filter(
          (t) => t.userId === c.userId && (!t.countryId || t.countryId === targetCountryId)
        )
      : [];
    const donationCount = countrySpecificTxs.length > 0 ? countrySpecificTxs.length : 1;
    const resolvedTransactions = countrySpecificTxs.length > 0 ? countrySpecificTxs : [singleTx];

    return {
      rank: 0,
      userId: c.userId,
      username: userProfile?.username || `Citizen #${c.userId.slice(-6)}`,
      avatarUrl: userProfile?.avatarUrl,
      totalAmount: combinedTotal,
      directAmount: parseFloat(directAmount.toFixed(3)),
      damageAmount,
      rawDamageDealt,
      appliedRatePer1k: isCurrentCitizen ? appliedRate : 0,
      transactionCount: donationCount,
      lastDonationAt: c.updatedAt || c.createdAt,
      firstDonationAt: c.createdAt,
      transactions: resolvedTransactions,
      donations: resolvedTransactions,
      isCumulativeOnly: countrySpecificTxs.length === 0,
    };
  });

  // If War Mode damage donations is active, also include country citizens who dealt combat damage
  // even if they have not made a cumulative monetary donation, provided they hold active citizenship in the audited country!
  if (damageConfig?.enabled && appliedRate > 0) {
    const existingDonorIds = new Set(cumulative.map((c) => c.userId));
    Object.values(usersMap).forEach((userProfile) => {
      if (!userProfile || !userProfile._id) return;
      const uid = userProfile._id;
      // Skip if already in cumulative monetary donations
      if (existingDonorIds.has(uid)) return;

      // STRICT SOVEREIGN CITIZENSHIP CHECK FOR PURE FIGHTERS:
      // A fighter who has not donated cash to this country MUST currently be a registered citizen of this nation!
      if (targetCountryId && normalizeCountryId(userProfile.country) !== targetCountryId) {
        return;
      }

      const rawDamageDealt = getUserDamageForTimeframe(userProfile, timeframe, customRange);
      if (rawDamageDealt > 0) {
        const damageAmount = parseFloat(((rawDamageDealt / 1000) * appliedRate).toFixed(3));
        if (damageAmount > 0) {
          totalDamage += damageAmount;
          donorsList.push({
            rank: 0,
            userId: uid,
            username: userProfile.username || `Citizen #${uid.slice(-6)}`,
            avatarUrl: userProfile.avatarUrl,
            totalAmount: damageAmount,
            directAmount: 0,
            damageAmount,
            rawDamageDealt,
            appliedRatePer1k: appliedRate,
            transactionCount: 0,
            lastDonationAt: new Date().toISOString(),
            firstDonationAt: new Date().toISOString(),
            transactions: [],
            donations: [],
            isCumulativeOnly: true,
          });
        }
      }
    });
  }

  donorsList.sort((a, b) => b.totalAmount - a.totalAmount);
  donorsList.forEach((d, idx) => {
    d.rank = idx + 1;
  });

  const totalDonors = donorsList.length;
  const totalCombined = parseFloat((totalDirect + totalDamage).toFixed(3));
  const averageDonationAmount =
    totalDonors > 0 ? parseFloat((totalCombined / totalDonors).toFixed(3)) : 0;

  return {
    timeframe,
    startDate: '',
    endDate: new Date().toISOString(),
    totalDonors,
    totalAmountDonated: totalCombined,
    totalDirectDonated: parseFloat(totalDirect.toFixed(3)),
    totalDamageDonated: parseFloat(totalDamage.toFixed(3)),
    topDonor: donorsList[0] || undefined,
    averageDonationAmount,
    leaderboard: donorsList,
    isGranular: false,
    damageConfig,
  };
}

/**
 * Execute sync for a country
 */
export async function syncCountryData(
  countryId: string,
  countryName: string,
  apiKey: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<{
  transactions: WareraTransaction[];
  cumulative: WareraCumulativeDonation[];
  users: Record<string, WareraUserLite>;
  isGranular: boolean;
}> {
  const hasKey = Boolean(apiKey && apiKey.trim());
  let txs: WareraTransaction[] = [];

  // 1. Always fetch public cumulative ledger (authoritative All-Time archive)
  onProgress?.({
    status: 'syncing',
    countryId,
    countryName,
    fetchedItems: 0,
    message: `Fetching All-Time historical donation ledger for ${countryName}...`,
  });

  const cumulative = await fetchPublicCumulativeDonations(countryId, (count) => {
    onProgress?.({
      status: 'syncing',
      countryId,
      countryName,
      fetchedItems: count,
      message: `Loaded ${count} All-Time cumulative donors...`,
    });
  });

  // 2. If API Key is present, also fetch granular individual transactions for Daily/Weekly/Monthly
  if (hasKey) {
    onProgress?.({
      status: 'syncing',
      countryId,
      countryName,
      fetchedItems: cumulative.length,
      message: `Connecting to granular transaction stream for ${countryName}...`,
    });

    try {
      txs = await fetchGranularDonationTransactions(countryId, apiKey, (count) => {
        onProgress?.({
          status: 'syncing',
          countryId,
          countryName,
          fetchedItems: cumulative.length + count,
          message: `Streaming individual receipts (${count} recorded)...`,
        });
      });
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED_KEY') {
        throw new Error('Invalid War Era API token. Please check your token in settings.');
      }
      console.warn('Failed to stream granular transactions, falling back to all-time ledger:', err);
    }
  }

  // 3. Ingest national citizens and collect unique user IDs across all datasets
  onProgress?.({
    status: 'syncing',
    countryId,
    countryName,
    fetchedItems: cumulative.length + txs.length,
    message: `Ingesting national citizen registry for ${countryName}...`,
  });

  const nationalCitizenIds = await fetchCountryCitizens(countryId);

  const allUserIds = Array.from(
    new Set([
      ...cumulative.map((c) => c.userId),
      ...txs.map((t) => t.userId),
      ...nationalCitizenIds,
    ].filter(Boolean))
  ) as string[];

  onProgress?.({
    status: 'syncing',
    countryId,
    countryName,
    fetchedItems: cumulative.length + txs.length,
    message: `Resolving citizen profiles & combat stats (${allUserIds.length} citizens)...`,
  });

  const users = await batchResolveUsers(allUserIds, (done, total) => {
    onProgress?.({
      status: 'syncing',
      countryId,
      countryName,
      fetchedItems: cumulative.length + txs.length,
      message: `Loaded ${done} of ${total} citizen profiles & combat stats...`,
    });
  });

  onProgress?.({
    status: 'completed',
    countryId,
    countryName,
    fetchedItems: cumulative.length + txs.length,
    message: `Sync complete: ${allUserIds.length} citizens and ${txs.length} recent receipts loaded!`,
  });

  return {
    transactions: txs,
    cumulative,
    users,
    isGranular: hasKey && txs.length > 0,
  };
}
