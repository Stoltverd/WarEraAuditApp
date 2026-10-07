/**
 * Aggregation engine for computing true Daily, Weekly, and Monthly donation rankings.
 * Strictly sums individual donation transaction events (e.g. 10 BTC) rather than cumulative lifetime totals.
 */
import {
  fetchGranularDonationTransactions,
  fetchPublicCumulativeDonations,
  batchResolveUsers,
  fetchCountryCitizens,
  knownCountryIdsSet,
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
 * Safely extract string country ID from userProfile, country string, or country object.
 * Robust against variations in API response shapes (countryId, country._id, or string).
 */
export function normalizeCountryId(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  if (typeof input === 'object') {
    if (input.countryId && typeof input.countryId === 'string') {
      return input.countryId.trim();
    }
    if (input.country) {
      if (typeof input.country === 'string') return input.country.trim();
      if (typeof input.country === 'object' && input.country._id) {
        return String(input.country._id).trim();
      }
    }
    // Only return input._id if input explicitly represents a country entity (has currency, code, or country name)
    if (input._id && (input.currency || input.code || (input.name && !input.username))) {
      return String(input._id).trim();
    }
  }
  return '';
}

/**
 * Calculate damage points dealt by a user for a given timeframe window.
 * Strictly scopes weekly damages to daily (1/7), monthly (30-day equivalent),
 * custom date duration, or all-time stats.
 */
export function getUserDamageForTimeframe(
  userProfile?: WareraUserLite,
  timeframe: RankingTimeframe = 'weekly',
  customRange?: CustomDateRange
): number {
  if (!userProfile) return 0;
  const weekly = Math.max(0, userProfile.rankings?.weeklyUserDamages?.value || 0);
  const allTime = Math.max(
    0,
    userProfile.rankings?.userDamages?.value || userProfile.stats?.damagesCount || 0
  );

  switch (timeframe) {
    case 'weekly':
      return weekly;
    case 'daily':
      return Math.round(weekly / 7);
    case 'monthly':
      // Authoritative 30-day month calculation: (weekly / 7) * 30
      return Math.round((weekly / 7) * 30);
    case 'custom': {
      if (customRange?.startDate && customRange?.endDate) {
        const ms =
          new Date(customRange.endDate).getTime() - new Date(customRange.startDate).getTime();
        const days = Math.max(1, Math.round(ms / (24 * 3600 * 1000)));
        const calculated = Math.round((weekly / 7) * days);
        return allTime > 0 ? Math.min(calculated, allTime) : calculated;
      }
      return Math.round((weekly / 7) * 14);
    }
    case 'all':
    default:
      return Math.max(allTime, weekly);
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
  targetCountryId?: string,
  cumulativeDonations?: WareraCumulativeDonation[]
): RankingSummary {
  // Build lookup of verified cumulative donors and recent updates for target nation
  const verifiedDonorIds = new Set<string>();
  const cumulativeUpdates: Array<{ userId: string; updatedAt: string; amount: number }> = [];
  if (cumulativeDonations) {
    cumulativeDonations.forEach((c) => {
      if (
        c.userId &&
        !knownCountryIdsSet.has(c.userId) &&
        (!c.countryId || !targetCountryId || c.countryId === targetCountryId)
      ) {
        verifiedDonorIds.add(c.userId);
        cumulativeUpdates.push({
          userId: c.userId,
          updatedAt: c.updatedAt || c.createdAt,
          amount: Number(c.amount || 0),
        });
      }
    });
  }

  // Strict country boundary filter and non-donation purge
  const scopedTransactions = transactions.filter((t) => {
    // Sovereign country blacklist guard: a country is NEVER a citizen
    if (t.userId && (knownCountryIdsSet.has(t.userId) || (targetCountryId && t.userId === targetCountryId))) {
      return false;
    }
    // Exclude if explicitly belonging to another nation's treasury
    if (targetCountryId && t.countryId && t.countryId !== targetCountryId) return false;
    // Purge non-donation operations: wages, trades, crafts, commercial market
    if (t.transactionType) {
      const lower = t.transactionType.toLowerCase();
      if (
        lower.includes('wage') ||
        lower.includes('salary') ||
        lower.includes('work') ||
        lower.includes('case') ||
        lower.includes('craft') ||
        lower.includes('dismantle') ||
        lower.includes('market') ||
        lower.includes('trade') ||
        lower.includes('trading')
      ) {
        return false;
      }
    }
    return true;
  });

  const { filtered, startDate, endDate } = filterTransactionsByTimeframe(
    scopedTransactions,
    timeframe,
    customRange
  );

  const donorMap: Record<string, DonorRankingItem> = {};

  filtered.forEach((tx) => {
    const uid = tx.userId;

    // Never fall back to tx._id or heuristic matching! If no valid citizen can be determined, skip
    if (!uid) return;

    // Sovereign country blacklist guard: a country (e.g. Malaysia 683ddd2c24b5a2e114af15d9) can NEVER be a citizen
    if (knownCountryIdsSet.has(uid) || (targetCountryId && uid === targetCountryId)) {
      return;
    }

    const amount = Number(tx.money || tx.amount || 0);

    if (!donorMap[uid]) {
      const userProfile = usersMap[uid];
      const fallbackName = uid.length >= 6 ? `Citizen #${uid.slice(-6)}` : `Citizen #${uid}`;
      donorMap[uid] = {
        rank: 0,
        userId: uid,
        username: userProfile?.username || fallbackName,
        avatarUrl: userProfile?.avatarUrl,
        totalAmount: 0,
        directAmount: 0,
        damageAmount: 0,
        rawDamageDealt: 0,
        appliedRatePer1k: 0,
        transactionCount: 0,
        lastDonationAt: tx.createdAt,
        firstDonationAt: tx.createdAt,
        lastDonationAmount: amount,
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
      donor.lastDonationAmount = amount;
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
      const userCountryId = normalizeCountryId(userProfile);
      if (!targetCountryId || userCountryId !== targetCountryId) {
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
    const resolvedUsername = userProfile?.username || d.username;
    const resolvedAvatarUrl = userProfile?.avatarUrl || d.avatarUrl;
    totalDirect += d.directAmount;

    let rawDamageDealt = 0;
    let damageAmount = 0;

    // Universal Sovereign Rule: Combat damage is ONLY converted if the donor is CURRENTLY a citizen of this country!
    const userCountryId = normalizeCountryId(userProfile);
    const isCurrentCitizen = Boolean(targetCountryId && userCountryId === targetCountryId);

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
      username: resolvedUsername,
      avatarUrl: resolvedAvatarUrl,
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

  // Strict country boundary filter: only process cumulative records belonging strictly to targetCountryId
  const scopedCumulative = cumulative.filter((c) => {
    if (!c.userId || knownCountryIdsSet.has(c.userId) || (targetCountryId && c.userId === targetCountryId)) {
      return false;
    }
    if (targetCountryId && c.countryId !== targetCountryId) {
      return false;
    }
    return true;
  });

  const donorsList: DonorRankingItem[] = scopedCumulative.map((c) => {
    const userProfile = usersMap[c.userId];
    const directAmount = Number(c.amount) || 0;
    totalDirect += directAmount;

    let rawDamageDealt = 0;
    let damageAmount = 0;

    // Universal Sovereign Rule: Combat damage is ONLY converted if the donor is CURRENTLY a citizen of this country!
    const userCountryId = normalizeCountryId(userProfile);
    const isCurrentCitizen = Boolean(targetCountryId && userCountryId === targetCountryId);

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

    // In All-Time view, the cumulative record represents the verified lifetime treasury contribution.
    // Inspect recent transaction buffer to extract the last recorded donation event (timestamp & BTC amount) if available.
    const allCitizenRecentTxs = transactions
      ? transactions
          .filter((t) => t.userId === c.userId && (!targetCountryId || !t.countryId || t.countryId === targetCountryId))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];
    const latestTx = allCitizenRecentTxs[0];
    const lastDonationAmount = latestTx ? Number(latestTx.money || latestTx.amount || 0) : undefined;
    const lastDonationAt = latestTx ? latestTx.createdAt : (c.updatedAt || c.createdAt);

    const countrySpecificTxs = transactions && targetCountryId && timeframe !== 'all'
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
      transactionCount: timeframe === 'all' ? 0 : donationCount,
      lastDonationAt,
      firstDonationAt: c.createdAt,
      lastDonationAmount,
      transactions: timeframe === 'all' ? [singleTx] : resolvedTransactions,
      donations: timeframe === 'all' ? [singleTx] : resolvedTransactions,
      isCumulativeOnly: timeframe === 'all' || countrySpecificTxs.length === 0,
    };
  });

  // If War Mode damage donations is active, also include country citizens who dealt combat damage
  // even if they have not made a cumulative monetary donation, provided they hold active citizenship in the audited country!
  if (damageConfig?.enabled && appliedRate > 0) {
    const existingDonorIds = new Set(scopedCumulative.map((c) => c.userId));
    Object.values(usersMap).forEach((userProfile) => {
      if (!userProfile || !userProfile._id) return;
      const uid = userProfile._id;
      // Skip if already in cumulative monetary donations
      if (existingDonorIds.has(uid)) return;

      // STRICT SOVEREIGN CITIZENSHIP CHECK FOR PURE FIGHTERS:
      // A fighter who has not donated cash to this country MUST currently be a registered citizen of this nation!
      const userCountryId = normalizeCountryId(userProfile);
      if (!targetCountryId || userCountryId !== targetCountryId) {
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
