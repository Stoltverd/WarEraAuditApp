/**
 * Service for communicating with War Era tRPC endpoints.
 * Supports both authenticated granular transaction event streaming and public cumulative fallbacks.
 */
import { storage } from './storage';
import {
  WareraCountry,
  WareraTransaction,
  WareraCumulativeDonation,
  WareraUserLite,
} from '../types/warera';

// War Era upstream tRPC endpoint supporting native browser CORS (access-control-allow-origin: *)
const WARERA_TRPC_BASE = 'https://api2.warera.io/trpc';

/**
 * Fetch all sovereign countries from War Era, sorted alphabetically
 */
export async function getCountries(): Promise<WareraCountry[]> {
  try {
    const res = await fetch(`${WARERA_TRPC_BASE}/country.getAllCountries`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`Country API responded with status ${res.status}`);
    }

    const json = await res.json();
    const rawCountries: WareraCountry[] = json?.result?.data || [];

    // Sort alphabetically by name
    rawCountries.sort((a, b) => a.name.localeCompare(b.name));

    if (rawCountries.length > 0) {
      await storage.saveCountries(rawCountries);
    }
    return rawCountries;
  } catch (err) {
    console.warn('Network fetch for countries failed, falling back to cache:', err);
    const cached = await storage.getCountries();
    if (cached.length > 0) {
      cached.sort((a, b) => a.name.localeCompare(b.name));
      return cached;
    }
    throw err;
  }
}

/**
 * Fetch individual granular donation transactions using the authenticated transaction endpoint.
 * This is the ONLY endpoint that contains actual individual donation amounts (e.g. 10 BTC)
 * and enables true Daily, Weekly, and Monthly rankings.
 */
export async function fetchGranularDonationTransactions(
  countryId: string,
  apiKey: string,
  onProgress?: (loaded: number) => void
): Promise<WareraTransaction[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API_KEY_REQUIRED');
  }

  const allTransactions: WareraTransaction[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;
  let page = 0;
  const maxPages = 40; // up to 2,000 transactions
  const monthlyCutoff = Date.now() - 35 * 24 * 60 * 60 * 1000; // past 35 days ceiling

  while (hasMore && page < maxPages) {
    page++;
    const queryInput: Record<string, any> = {
      countryId,
      transactionType: 'donation',
      limit: 50,
    };
    if (cursor) {
      queryInput.cursor = cursor;
    }

    const encoded = encodeURIComponent(JSON.stringify(queryInput));
    const res = await fetch(`${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${encoded}`, {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey.trim(),
      },
    });

    if (res.status === 401) {
      throw new Error('UNAUTHORIZED_KEY');
    }

    if (!res.ok) {
      const errText = await res.text();
      let msg = `API Error ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {}
      throw new Error(msg);
    }

    const json = await res.json();
    const result = json?.result?.data;
    const rawItems: any[] = Array.isArray(result) ? result : result?.items || [];

    if (rawItems.length === 0) {
      break;
    }

    const items: WareraTransaction[] = rawItems.map((item) => ({
      _id: item._id,
      transactionType: item.transactionType || 'donation',
      money: Number(item.money || item.amount || 0),
      amount: Number(item.money || item.amount || 0),
      userId: item.userId || item.sellerId || item.buyerId,
      countryId: item.countryId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    allTransactions.push(...items);
    onProgress?.(allTransactions.length);

    // Stop paging if oldest transaction in page is older than monthly cutoff
    const oldest = items[items.length - 1];
    if (oldest && new Date(oldest.createdAt).getTime() < monthlyCutoff) {
      hasMore = false;
      break;
    }

    cursor = result?.nextCursor;
    hasMore = Boolean(cursor && items.length >= 50);

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // Save to IndexedDB
  await storage.saveTransactions(allTransactions);
  return allTransactions;
}

/**
 * Fetch public cumulative donations from donation.getManyPaginated.
 * Used for All-Time patron totals when no API key is provided.
 */
export async function fetchPublicCumulativeDonations(
  countryId: string,
  onProgress?: (loaded: number) => void
): Promise<WareraCumulativeDonation[]> {
  const allDonations: WareraCumulativeDonation[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;
  let page = 0;
  const maxPages = 40;

  while (hasMore && page < maxPages) {
    page++;
    const queryInput: Record<string, any> = {
      countryId,
      limit: 50,
    };
    if (cursor) {
      queryInput.cursor = cursor;
    }

    const encoded = encodeURIComponent(JSON.stringify(queryInput));
    const res = await fetch(`${WARERA_TRPC_BASE}/donation.getManyPaginated?input=${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      break;
    }

    const json = await res.json();
    const result = json?.result?.data;
    const items: WareraCumulativeDonation[] = result?.items || [];

    if (items.length === 0) {
      break;
    }

    allDonations.push(...items);
    onProgress?.(allDonations.length);

    cursor = result?.nextCursor;
    hasMore = Boolean(cursor && items.length >= 50);

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  await storage.saveCumulativeDonations(allDonations);
  return allDonations;
}

// In-memory profile cache to avoid redundant API hits
const memoryUserCache: Record<string, WareraUserLite> = {};

/**
 * Fetch User Lite public profile
 */
export async function fetchUserLite(userId: string): Promise<WareraUserLite | null> {
  if (memoryUserCache[userId]) {
    return memoryUserCache[userId];
  }

  try {
    const encoded = encodeURIComponent(JSON.stringify({ userId }));
    const res = await fetch(`${WARERA_TRPC_BASE}/user.getUserLite?input=${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;

    const json = await res.json();
    const data = json?.result?.data;
    if (data && data._id) {
      const user: WareraUserLite = {
        _id: data._id,
        username: data.username || `Citizen #${data._id.slice(-6)}`,
        avatarUrl: data.avatarUrl || data.avatar,
        country: data.country,
        leveling: data.leveling,
        militaryRank: data.militaryRank,
        rankings: data.rankings,
        stats: data.stats,
      };
      memoryUserCache[userId] = user;
      return user;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Batch resolve user profiles with controlled concurrency
 */
export async function batchResolveUsers(
  userIds: string[],
  onBatchProgress?: (completed: number, total: number) => void
): Promise<Record<string, WareraUserLite>> {
  const existingMap = await storage.getAllUsers();
  Object.assign(memoryUserCache, existingMap);

  // Require fetch if not cached or missing combat damage stats
  const missingIds = userIds.filter((id) => {
    const cached = memoryUserCache[id];
    return !cached || !cached.rankings || !cached.rankings.userDamages;
  });
  const newUsers: WareraUserLite[] = [];

  const chunkSize = 5;
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((uid) => fetchUserLite(uid)));
    results.forEach((u) => {
      if (u) newUsers.push(u);
    });
    onBatchProgress?.(Math.min(i + chunkSize, missingIds.length), missingIds.length);
    await new Promise((r) => setTimeout(r, 70));
  }

  if (newUsers.length > 0) {
    await storage.saveUsers(newUsers);
  }

  return memoryUserCache;
}

/**
 * Ensure combat damage stats are hydrated for a specific list of user IDs
 */
export async function ensureDonorsDamageStats(
  userIds: string[],
  forceRefresh = false
): Promise<Record<string, WareraUserLite>> {
  const existingMap = await storage.getAllUsers();
  Object.assign(memoryUserCache, existingMap);

  const missing = userIds.filter((id) => {
    if (forceRefresh) return true;
    const cached = memoryUserCache[id];
    return !cached || !cached.rankings || !cached.rankings.userDamages;
  });

  if (missing.length === 0) {
    return { ...memoryUserCache };
  }

  const updated: WareraUserLite[] = [];
  const chunkSize = 5;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (uid) => {
        try {
          const encoded = encodeURIComponent(JSON.stringify({ userId: uid }));
          const res = await fetch(`${WARERA_TRPC_BASE}/user.getUserLite?input=${encoded}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
          const json = await res.json();
          const data = json?.result?.data;
          if (data && data._id) {
            const user: WareraUserLite = {
              _id: data._id,
              username: data.username || `Citizen #${data._id.slice(-6)}`,
              avatarUrl: data.avatarUrl || data.avatar,
              country: data.country,
              leveling: data.leveling,
              militaryRank: data.militaryRank,
              rankings: data.rankings,
              stats: data.stats,
            };
            memoryUserCache[uid] = user;
            return user;
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    results.forEach((u) => {
      if (u) updated.push(u);
    });
    if (i + chunkSize < missing.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  if (updated.length > 0) {
    await storage.saveUsers(updated);
  }

  return { ...memoryUserCache };
}

/**
 * Fetch registered citizens of a country via user.getUsersByCountry
 */
export async function fetchCountryCitizens(
  countryId: string,
  limit = 100
): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(JSON.stringify({ countryId, limit }));
    const res = await fetch(`${WARERA_TRPC_BASE}/user.getUsersByCountry?input=${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return [];
    const json = await res.json();
    const items: Array<{ _id: string }> = json?.result?.data?.items || [];
    return items.map((item) => item._id).filter(Boolean);
  } catch (err) {
    console.warn('Failed to fetch country citizens:', err);
    return [];
  }
}
