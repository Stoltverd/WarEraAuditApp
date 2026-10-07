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
  WareraCompany,
} from '../types/warera';
import { NationalTransaction } from '../types/ministry';

// War Era upstream tRPC endpoint supporting native browser CORS (access-control-allow-origin: *)
const WARERA_TRPC_BASE = 'https://api2.warera.io/trpc';

// Blacklist set of sovereign country IDs so nations (e.g. Malaysia, Colombia) are NEVER parsed as citizens
export const knownCountryIdsSet = new Set<string>([
  '6813b6d546e731854c7ac85f', // Colombia
  '683ddd2c24b5a2e114af15d9', // Malaysia
  '6813b6d446e731854c7ac7fe', // Ireland
]);

export function registerKnownCountryIds(countries: WareraCountry[]): void {
  countries.forEach((c) => {
    if (c._id) knownCountryIdsSet.add(c._id.trim());
  });
}

// =========================================================================
// Centralized Rate-Limiting Queue Dispatcher for War Era API
// Enforces max concurrency of 3 and responsive 90ms spacing with 429 auto-backoff
// =========================================================================
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3; // Tuned safe concurrency ceiling
const MIN_REQUEST_INTERVAL_MS = 90; // Responsive spacing between queries
let lastRequestTimestamp = 0;
const requestQueue: Array<() => void> = [];

function pumpQueue(): void {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const task = requestQueue.shift();
    if (!task) break;

    activeRequests++;
    const now = Date.now();
    const elapsed = now - lastRequestTimestamp;
    const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);

    setTimeout(() => {
      lastRequestTimestamp = Date.now();
      task();
    }, delay);
  }
}

export async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const execute = async () => {
      try {
        const res = await fetch(url, options);

        if (res.status === 429 && retries > 0) {
          // Upstream API rate limit hit: pause queue and back off exponentially
          const retryHeader = res.headers.get('Retry-After');
          const backoffDelay = retryHeader
            ? Math.max(1500, parseInt(retryHeader, 10) * 1000)
            : (4 - retries) * 1800; // 1.8s, 3.6s, 5.4s

          console.warn(`[War Era Rate-Limiter] HTTP 429 detected. Pacing queue for ${backoffDelay}ms (attempt ${4 - retries}/3)...`);
          await new Promise((r) => setTimeout(r, backoffDelay));

          activeRequests = Math.max(0, activeRequests - 1);
          pumpQueue();

          // Re-queue with one fewer retry
          resolve(rateLimitedFetch(url, options, retries - 1));
          return;
        }

        activeRequests = Math.max(0, activeRequests - 1);
        pumpQueue();
        resolve(res);
      } catch (err) {
        activeRequests = Math.max(0, activeRequests - 1);
        pumpQueue();
        reject(err);
      }
    };

    requestQueue.push(execute);
    pumpQueue();
  });
}

/**
 * Fetch all sovereign countries from War Era, sorted alphabetically
 */
export async function getCountries(): Promise<WareraCountry[]> {
  try {
    const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/country.getAllCountries`, {
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
      registerKnownCountryIds(rawCountries);
      await storage.saveCountries(rawCountries);
    }
    return rawCountries;
  } catch (err) {
    console.warn('Network fetch for countries failed, falling back to cache:', err);
    const cached = await storage.getCountries();
    if (cached.length > 0) {
      registerKnownCountryIds(cached);
      cached.sort((a, b) => a.name.localeCompare(b.name));
      return cached;
    }
    throw err;
  }
}

export function normalizeTransactionTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') {
    // If Unix timestamp in seconds (less than 10^11), convert to milliseconds
    const ms = val < 100000000000 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      const ms = num < 100000000000 ? num * 1000 : num;
      return new Date(ms).toISOString();
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return new Date().toISOString();
}

export function normalizeTransactionType(rawType?: string): string {
  if (!rawType) return 'other';
  const lower = rawType.toLowerCase().trim();
  if (lower.includes('donation') || lower.includes('donat')) return 'donation';
  if (lower.includes('wage') || lower.includes('salary') || lower.includes('work') || lower.includes('paycheck')) return 'wage';
  if (lower.includes('item market') || lower.includes('item_market') || lower.includes('itemmarket')) return 'itemMarket';
  if (lower.includes('trading') || lower.includes('trade')) return 'trading';
  if (lower.includes('market')) return 'market';
  if (lower.includes('tip') || lower.includes('article') || lower.includes('newspaper')) return 'articleTip';
  if (lower.includes('application') || lower.includes('fee')) return 'applicationFee';
  if (lower.includes('case') || lower.includes('open')) return 'openCase';
  if (lower.includes('craft')) return 'craftItem';
  if (lower.includes('dismantle')) return 'dismantleItem';
  // State-to-state bilateral transfers
  if (
    lower.includes('bilateral') ||
    lower.includes('foreign_aid') ||
    lower.includes('state_transfer') ||
    lower.includes('national_transfer')
  ) {
    return 'stateTransfer';
  }
  // Citizen-to-treasury transfer in War Era is a donation
  if (lower.includes('transfer')) return 'donation';
  return rawType;
}

/**
 * Safely extract citizen ID and any embedded profile data from transaction payloads.
 * In War Era, all donations are strictly citizen-attributed. Transaction documents
 * provide the citizen identity across multiple schema paths depending on whether
 * entities are raw IDs or populated objects.
 *
 * CRITICAL ID DISAMBIGUATION:
 * When querying transaction.getPaginatedTransactions by countryId, item.userId or
 * item.countryId is often set to the country's treasury ID. This function inspects
 * all candidate citizen identity fields and skips any that match the country ID,
 * transaction ID, or known country IDs set.
 */
export function extractCitizenFromTransaction(
  item: any,
  targetCountryId?: string
): {
  citizenId: string;
  embeddedProfile?: Partial<WareraUserLite>;
} {
  if (!item) return { citizenId: '' };

  const extractId = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      if (val._id) return extractId(val._id);
      if (val.id) return extractId(val.id);
      if (val.userId) return extractId(val.userId);
      if (val.citizenId) return extractId(val.citizenId);
    }
    return '';
  };

  const txId = extractId(item._id);
  const targetCId = targetCountryId ? extractId(targetCountryId) : '';
  const itemCId = extractId(item.countryId);

  // Candidate ID fields in priority order (citizen sender/actor candidates)
  const candidateIds: string[] = [
    extractId(item.senderId),
    extractId(item.sender),
    extractId(item.donorId),
    extractId(item.donor),
    extractId(item.citizenId),
    extractId(item.citizen),
    extractId(item.fromId),
    extractId(item.from),
    extractId(item.sourceUserId),
    extractId(item.sourceUser),
    extractId(item.fromUser),
    extractId(item.payerId),
    extractId(item.payer),
    extractId(item.authorId),
    extractId(item.author),
    extractId(item.donatorId),
    extractId(item.donator),
    extractId(item.patronId),
    extractId(item.patron),
    extractId(item.actorId),
    extractId(item.actor),
    extractId(item.playerId),
    extractId(item.player),
    extractId(item.sellerId),
    extractId(item.seller),
    extractId(item.buyerId),
    extractId(item.buyer),
    extractId(item.byId),
    extractId(item.by),
    extractId(item.ownerId),
    extractId(item.owner),
    extractId(item.userId),
    extractId(item.user),
    extractId(item.data?.senderId),
    extractId(item.data?.userId),
    extractId(item.payload?.senderId),
    extractId(item.payload?.userId),
  ];

  let resolvedCitizenId = '';
  for (const candidate of candidateIds) {
    if (!candidate) continue;
    // Discard if candidate is transaction ID
    if (candidate === txId) continue;
    // Discard if candidate matches the target country ID or item country ID
    if (targetCId && candidate === targetCId) continue;
    if (itemCId && candidate === itemCId) continue;
    // Discard if candidate is a known sovereign country ID
    if (knownCountryIdsSet.has(candidate)) continue;

    // Found a valid non-country citizen ID
    resolvedCitizenId = candidate;
    break;
  }

  // Strict harvesting of embedded profile attached directly to user/sender sub-objects
  let embeddedProfile: Partial<WareraUserLite> | undefined = undefined;
  const userObj =
    (typeof item.sender === 'object' && item.sender) ||
    (typeof item.donor === 'object' && item.donor) ||
    (typeof item.citizen === 'object' && item.citizen) ||
    (typeof item.user === 'object' && item.user) ||
    (typeof item.player === 'object' && item.player) ||
    (typeof item.from === 'object' && item.from) ||
    null;

  const username =
    userObj?.username ||
    item.username ||
    item.senderUsername ||
    item.donorUsername ||
    item.citizenUsername ||
    item.playerName;

  const avatarUrl =
    userObj?.avatarUrl ||
    userObj?.avatar ||
    item.avatarUrl ||
    item.avatar ||
    item.senderAvatarUrl ||
    item.donorAvatarUrl;

  const rawUserCountry = userObj?.country || item.userCountry;
  const userCountryId =
    typeof rawUserCountry === 'string'
      ? rawUserCountry.trim()
      : typeof rawUserCountry === 'object' && rawUserCountry?._id
      ? String(rawUserCountry._id).trim()
      : undefined;

  if (resolvedCitizenId && (username || avatarUrl)) {
    embeddedProfile = {
      _id: resolvedCitizenId,
      username: username || `Citizen #${resolvedCitizenId.slice(-6)}`,
      avatarUrl: avatarUrl || undefined,
      country: userCountryId,
      isActive: true,
    };
  }

  return {
    citizenId: resolvedCitizenId,
    embeddedProfile,
  };
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
      limit: 50,
    };
    if (cursor) {
      queryInput.cursor = cursor;
    }

    const encoded = encodeURIComponent(JSON.stringify(queryInput));
    const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${encoded}`, {
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

    const items: WareraTransaction[] = rawItems
      .filter((item) => {
        const rawType = (item.transactionType || item.type || item.action || '').toLowerCase();
        // Discard non-donation operations: wages, cases, crafts, dismantles
        if (rawType.includes('wage') || rawType.includes('salary') || rawType.includes('work')) return false;
        if (rawType.includes('case') || rawType.includes('craft') || rawType.includes('dismantle')) return false;
        // Commercial item trades with explicit items and seller/buyer are market trades, NOT treasury donations
        if ((item.sellerId || item.buyerId) && (item.item || item.resourceType || item.commodity)) return false;

        // Extract citizen identity
        const { citizenId } = extractCitizenFromTransaction(item, countryId);

        // Sovereign country blacklist: a country can NEVER be a citizen donor
        if (citizenId && (knownCountryIdsSet.has(citizenId) || citizenId === countryId)) {
          return false;
        }

        // Recipient country check: if this transaction explicitly targets a foreign country, exclude
        const targetCId =
          (typeof item.targetCountry === 'string' ? item.targetCountry : item.targetCountry?._id) ||
          item.targetCountryId ||
          item.recipientCountryId ||
          item.destinationCountryId ||
          item.toCountryId ||
          item.countryId;

        if (targetCId && targetCId !== countryId) {
          return false;
        }

        // State-to-state bilateral transfers guard:
        // Exclude if the source is explicitly another sovereign country or known bilateral treaty operation
        const sourceCId =
          (typeof item.sourceCountry === 'string' ? item.sourceCountry : item.sourceCountry?._id) ||
          item.sourceCountryId ||
          item.fromCountryId;

        if (sourceCId && knownCountryIdsSet.has(sourceCId) && sourceCId !== countryId) {
          return false;
        }

        if (
          rawType.includes('bilateral') ||
          rawType.includes('foreign_aid') ||
          rawType.includes('state_transfer') ||
          rawType.includes('national_transfer')
        ) {
          return false;
        }

        return true;
      })
      .map((item) => {
        const tType = normalizeTransactionType(item.transactionType || item.type || item.action);
        const { citizenId, embeddedProfile } = extractCitizenFromTransaction(item, countryId);

        // Pre-harvest embedded profile immediately so citizen name and avatar are available without latency
        if (citizenId && embeddedProfile) {
          if (!memoryUserCache[citizenId] || !memoryUserCache[citizenId].username) {
            memoryUserCache[citizenId] = {
              ...(memoryUserCache[citizenId] || {}),
              _id: citizenId,
              username: embeddedProfile.username || `Citizen #${citizenId.slice(-6)}`,
              avatarUrl: embeddedProfile.avatarUrl,
              country: embeddedProfile.country,
              isActive: true,
            };
          }
        }

        const itemCountryId = item.countryId || item.targetCountryId || item.recipientCountryId || item.toCountryId;

        const createdAtNorm = normalizeTransactionTimestamp(item.createdAt || item.timestamp || item.date);
        const updatedAtNorm = item.updatedAt ? normalizeTransactionTimestamp(item.updatedAt) : createdAtNorm;

        return {
          _id: item._id,
          transactionType: tType,
          money: Number(item.money || item.amount || 0),
          amount: Number(item.money || item.amount || 0),
          userId: citizenId,
          sellerId: item.sellerId || (tType === 'market' || tType === 'itemMarket' ? citizenId : undefined),
          buyerId: item.buyerId,
          companyId: item.companyId || item.employerId || item.employer?._id,
          item: item.item || item.commodity || item.resource || item.resourceType,
          resourceType: item.resourceType || item.item,
          countryId: itemCountryId || countryId,
          createdAt: createdAtNorm,
          updatedAt: updatedAtNorm,
        };
      });

    allTransactions.push(...items);
    onProgress?.(allTransactions.length);

    // Stop paging if oldest transaction in raw page is older than monthly cutoff
    const oldestRaw = rawItems[rawItems.length - 1];
    const oldestTime = new Date(normalizeTransactionTimestamp(oldestRaw?.createdAt || oldestRaw?.timestamp || oldestRaw?.date)).getTime();
    if (oldestRaw && oldestTime < monthlyCutoff) {
      hasMore = false;
      break;
    }

    cursor = result?.nextCursor;
    hasMore = Boolean(cursor && rawItems.length > 0);

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // Save to IndexedDB
  await storage.saveTransactions(allTransactions);
  return allTransactions;
}

/**
 * Fetch authenticated personal transactions for a specific user (Wages, Item Market, Trading, Tips, Donations).
 * Essential for verifying real in-game work salaries and commercial profits for audited citizens.
 */
export async function fetchUserTransactions(
  userId: string,
  apiKey: string,
  onProgress?: (loaded: number) => void
): Promise<WareraTransaction[]> {
  if (!apiKey || !apiKey.trim() || !userId) {
    return [];
  }

  const allTransactions: WareraTransaction[] = [];
  let cursor: string | undefined = undefined;
  let hasMore = true;
  let page = 0;
  const maxPages = 20; // up to 1,000 transactions
  const monthlyCutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;

  while (hasMore && page < maxPages) {
    page++;
    const queryInput: Record<string, any> = {
      userId,
      limit: 50,
    };
    if (cursor) {
      queryInput.cursor = cursor;
    }

    const encoded = encodeURIComponent(JSON.stringify(queryInput));
    try {
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${encoded}`, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey.trim(),
        },
      });

      if (!res.ok) {
        break;
      }

      const json = await res.json();
      const result = json?.result?.data;
      const rawItems: any[] = Array.isArray(result) ? result : result?.items || [];

      if (rawItems.length === 0) {
        break;
      }

      const extractIdStr = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object') return val._id || val.id || val.userId || '';
        return '';
      };

      const items: WareraTransaction[] = rawItems.map((item) => {
        const rawTypeStr = (item.transactionType || item.type || item.action || '').toLowerCase();
        const tType = normalizeTransactionType(rawTypeStr);
        const { citizenId, embeddedProfile } = extractCitizenFromTransaction(item);
        const effectiveUserId = citizenId || userId;

        const rawSellerId = extractIdStr(item.sellerId || item.seller);
        const rawBuyerId = extractIdStr(item.buyerId || item.buyer);
        const rawCompanyId = extractIdStr(item.companyId || item.employerId || item.employer || item.employer?._id);
        const rawAuthorId = extractIdStr(item.authorId || item.author || item.creatorId || item.creator);
        const rawSenderId = extractIdStr(item.senderId || item.sender || item.fromId || item.from);
        const rawRecipientId = extractIdStr(item.recipientId || item.recipient || item.toId || item.to || item.workerId || item.employeeId);

        // Strict role resolution across all 10 transaction types:
        let resolvedSellerId: string | undefined = rawSellerId;
        let resolvedBuyerId: string | undefined = rawBuyerId;
        let resolvedCompanyId: string | undefined = rawCompanyId;

        if (tType === 'market' || tType === 'itemMarket' || tType === 'trading') {
          // If citizen is explicitly buyer, do NOT make them seller
          if (rawBuyerId === userId || rawBuyerId === effectiveUserId) {
            resolvedBuyerId = userId;
          } else if (rawSellerId === userId || rawSellerId === effectiveUserId) {
            resolvedSellerId = userId;
          } else if (item.action === 'buy' || rawTypeStr.includes('buy') || rawTypeStr.includes('purchase')) {
            resolvedBuyerId = userId;
          } else if (item.action === 'sell' || rawTypeStr.includes('sell')) {
            resolvedSellerId = userId;
          }
        } else if (tType === 'articleTip') {
          // In article tips: author receives tips (beneficiary), reader is tipper (outflow)
          if (rawAuthorId === userId || rawRecipientId === userId) {
            resolvedSellerId = userId;
          } else if (rawSenderId === userId || rawBuyerId === userId) {
            resolvedBuyerId = userId;
          }
        } else if (tType === 'wage') {
          // In wages: worker receives salary
          if (rawCompanyId && (rawRecipientId === userId || effectiveUserId === userId)) {
            resolvedBuyerId = undefined;
          }
        }

        if (effectiveUserId && embeddedProfile) {
          if (!memoryUserCache[effectiveUserId] || !memoryUserCache[effectiveUserId].username) {
            memoryUserCache[effectiveUserId] = {
              ...(memoryUserCache[effectiveUserId] || {}),
              _id: effectiveUserId,
              username: embeddedProfile.username || `Citizen #${effectiveUserId.slice(-6)}`,
              avatarUrl: embeddedProfile.avatarUrl,
              country: embeddedProfile.country,
              isActive: true,
            };
          }
        }

        const createdAtNorm = normalizeTransactionTimestamp(item.createdAt || item.timestamp || item.date);
        const updatedAtNorm = item.updatedAt ? normalizeTransactionTimestamp(item.updatedAt) : createdAtNorm;

        return {
          _id: item._id,
          transactionType: tType,
          money: Number(item.money || item.amount || 0),
          amount: Number(item.money || item.amount || 0),
          userId: effectiveUserId,
          sellerId: resolvedSellerId,
          buyerId: resolvedBuyerId,
          companyId: resolvedCompanyId,
          item: item.item || item.commodity || item.resource || item.resourceType,
          resourceType: item.resourceType || item.item,
          countryId: item.countryId,
          createdAt: createdAtNorm,
          updatedAt: updatedAtNorm,
        };
      });

      allTransactions.push(...items);
      onProgress?.(allTransactions.length);

      const oldestRaw = rawItems[rawItems.length - 1];
      const oldestTime = new Date(normalizeTransactionTimestamp(oldestRaw?.createdAt || oldestRaw?.timestamp || oldestRaw?.date)).getTime();
      if (oldestRaw && oldestTime < monthlyCutoff) {
        hasMore = false;
        break;
      }

      cursor = result?.nextCursor;
      hasMore = Boolean(cursor && rawItems.length > 0);

      if (hasMore) {
        await new Promise((r) => setTimeout(r, 60));
      }
    } catch {
      break;
    }
  }

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
    const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/donation.getManyPaginated?input=${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      break;
    }

    const json = await res.json();
    const result = json?.result?.data;
    const rawItems: any[] = result?.items || [];

    if (rawItems.length === 0) {
      break;
    }

    // Proactively harvest embedded user profiles from cumulative items so patrons resolve with 0 latency
    const harvestedUsers: WareraUserLite[] = [];
    rawItems.forEach((it) => {
      const uObj = typeof it.user === 'object' ? it.user : (typeof it.donor === 'object' ? it.donor : null);
      const uid = it.userId || (uObj ? uObj._id : null) || it.donorId;
      if (uid && (uObj || it.username)) {
        const uName = uObj?.username || it.username || it.donorUsername;
        const uAvatar = uObj?.avatarUrl || uObj?.avatar || it.avatarUrl || it.avatar;
        const uUser: WareraUserLite = {
          _id: uid,
          username: uName || `Citizen #${uid.slice(-6)}`,
          avatarUrl: uAvatar,
          country: countryId,
          isActive: uObj?.isActive !== undefined ? Boolean(uObj.isActive) : true,
          leveling: uObj?.leveling,
          level: Number(uObj?.leveling?.level ?? uObj?.level ?? 0),
          militaryRank: uObj?.militaryRank,
          rankings: uObj?.rankings,
          stats: uObj?.stats,
        };
        memoryUserCache[uid] = { ...(memoryUserCache[uid] || {}), ...uUser };
        harvestedUsers.push(uUser);
      }
    });

    if (harvestedUsers.length > 0) {
      await storage.saveUsers(harvestedUsers);
    }

    const items: WareraCumulativeDonation[] = rawItems.map((it) => ({
      ...it,
      countryId: it.countryId || countryId,
    }));

    allDonations.push(...items);
    onProgress?.(allDonations.length);

    cursor = result?.nextCursor;
    hasMore = Boolean(cursor && items.length >= 50);

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 60));
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
export async function fetchUserLite(userId: string, forceRefresh = false): Promise<WareraUserLite | null> {
  if (!forceRefresh && memoryUserCache[userId] && memoryUserCache[userId].skills) {
    return memoryUserCache[userId];
  }

  try {
    const encoded = encodeURIComponent(JSON.stringify({ userId }));
    // Use user.getUserById to extract complete stats.wealth breakdown (money, items, companies, equipment, weapons, total)
    let res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/user.getUserById?input=${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      // Fallback to getUserLite if getUserById is unavailable
      res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/user.getUserLite?input=${encoded}`, {
        headers: { 'Accept': 'application/json' },
      });
    }
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;

    const json = await res.json();
    const data = json?.result?.data;
    if (data && data._id) {
      const wealthObj = typeof data.stats?.wealth === 'object' ? data.stats.wealth : null;
      const user: WareraUserLite = {
        _id: data._id,
        username: data.username || `Citizen #${data._id.slice(-6)}`,
        avatarUrl: data.avatarUrl || data.avatar,
        country: data.country,
        leveling: data.leveling,
        militaryRank: data.militaryRank,
        isActive: Boolean(data.isActive),
        createdAt: data.createdAt,
        dates: data.dates,
        skills: data.skills,
        rankings: data.rankings,
        money: wealthObj?.money !== undefined ? wealthObj.money : data.money,
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
 * Batch resolve user profiles with controlled concurrency and polite pacing
 */
export async function batchResolveUsers(
  userIds: string[],
  onBatchProgress?: (completed: number, total: number) => void,
  onChunkResolved?: (chunkUsers: WareraUserLite[]) => void
): Promise<Record<string, WareraUserLite>> {
  const existingMap = await storage.getAllUsers();
  Object.assign(memoryUserCache, existingMap);

  // Filter missing: query users who have no record or have a temporary placeholder
  const missingIds = userIds.filter((id) => {
    const cached = memoryUserCache[id];
    return !cached || !cached.username || cached.username.startsWith('Citizen #');
  });

  const newUsers: WareraUserLite[] = [];
  const chunkSize = 2; // Strict concurrency ceiling of 2
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((uid) => fetchUserLite(uid, false)));
    const chunkUsers: WareraUserLite[] = [];
    results.forEach((u, idx) => {
      const uid = chunk[idx];
      if (u) {
        newUsers.push(u);
        chunkUsers.push(u);
      } else {
        const placeholder: WareraUserLite = {
          _id: uid,
          username: `Citizen #${uid.slice(-6)}`,
          isActive: false,
        };
        memoryUserCache[uid] = placeholder;
        chunkUsers.push(placeholder);
      }
    });

    if (chunkUsers.length > 0 && onChunkResolved) {
      onChunkResolved(chunkUsers);
    }

    onBatchProgress?.(Math.min(i + chunkSize, missingIds.length), missingIds.length);
    if (i + chunkSize < missingIds.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  if (newUsers.length > 0) {
    await storage.saveUsers(newUsers);
  }

  return memoryUserCache;
}

/**
 * Ensure combat damage stats & skills are hydrated for a specific list of user IDs
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
    const hasWealth = cached && cached.stats && typeof cached.stats.wealth === 'object' && cached.stats.wealth.money !== undefined;
    return !cached || !cached.rankings || !cached.rankings.userDamages || !cached.skills || !hasWealth;
  });

  if (missing.length === 0) {
    return { ...memoryUserCache };
  }

  const updated: WareraUserLite[] = [];
  const chunkSize = 2; // Paced concurrency of 2
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((uid) => fetchUserLite(uid, forceRefresh))
    );

    results.forEach((u) => {
      if (u) updated.push(u);
    });
    if (i + chunkSize < missing.length) {
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  if (updated.length > 0) {
    await storage.saveUsers(updated);
  }

  return { ...memoryUserCache };
}

// In-memory company cache
const memoryCompanyCache: Record<string, WareraCompany[]> = {};

/**
 * Fetch all registered enterprises/companies owned by a citizen via company.getCompanies & company.getById
 */
export async function fetchUserCompanies(userId: string, forceRefresh = false): Promise<WareraCompany[]> {
  if (!userId) return [];
  if (!forceRefresh && memoryCompanyCache[userId] && memoryCompanyCache[userId].length > 0) {
    return memoryCompanyCache[userId];
  }

  try {
    const allCompanyIds: string[] = [];
    let cursor: string | undefined = undefined;
    let page = 0;
    const maxSafetyPages = 20; // safety ceiling up to 400 companies

    while (page < maxSafetyPages) {
      page++;
      const queryInput: Record<string, any> = {
        userId,
        limit: 20,
      };
      if (cursor) {
        queryInput.cursor = cursor;
      }

      const encoded = encodeURIComponent(JSON.stringify(queryInput));
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/company.getCompanies?input=${encoded}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) break;
      const json = await res.json();
      const items: string[] = json?.result?.data?.items || [];
      if (!items || items.length === 0) break;

      allCompanyIds.push(...items);
      cursor = json?.result?.data?.nextCursor;
      if (!cursor) break;
    }

    if (allCompanyIds.length === 0) {
      memoryCompanyCache[userId] = [];
      return [];
    }

    // Resolve individual company cards via company.getById
    const companies: WareraCompany[] = [];
    await Promise.all(
      allCompanyIds.map(async (cid) => {
        try {
          const enc = encodeURIComponent(JSON.stringify({ companyId: cid }));
          const cRes = await rateLimitedFetch(`${WARERA_TRPC_BASE}/company.getById?input=${enc}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (!cRes.ok) return;
          const cJson = await cRes.json();
          const d = cJson?.result?.data;
          if (d && d._id) {
            companies.push({
              _id: d._id,
              user: d.user || userId,
              region: d.region,
              name: d.name || 'Unnamed Factory',
              itemCode: d.itemCode || 'commodity',
              isFull: Boolean(d.isFull),
              concreteInvested: d.concreteInvested,
              production: Number(d.production || 0),
              activeUpgradeLevels: d.activeUpgradeLevels || {},
              workerCount: Number(d.workerCount || 0),
              estimatedValue: Number(d.estimatedValue || 0),
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            });
          }
        } catch {
          // ignore individual failed company fetch
        }
      })
    );

    // Sort companies by estimated value descending
    companies.sort((a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0));
    memoryCompanyCache[userId] = companies;
    return companies;
  } catch (err) {
    console.warn('Failed to fetch user companies:', err);
    return memoryCompanyCache[userId] || [];
  }
}

/**
 * Fetch registered citizens of a country via user.getUsersByCountry with bulk pagination.
 * Directly harvests complete citizen profiles (username, avatar, leveling, active status)
 * so hundreds of citizens are ingested with 0 individual queries and zero rate limits.
 */
export async function fetchCountryCitizens(
  countryId: string,
  maxPages = 5
): Promise<string[]> {
  const allCitizenIds: string[] = [];
  const harvestedUsers: WareraUserLite[] = [];
  let cursor: string | undefined = undefined;
  let page = 0;

  try {
    while (page < maxPages) {
      page++;
      const queryInput: Record<string, any> = { countryId, limit: 100 };
      if (cursor) queryInput.cursor = cursor;

      const encoded = encodeURIComponent(JSON.stringify(queryInput));
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/user.getUsersByCountry?input=${encoded}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) break;

      const json = await res.json();
      const rawData = json?.result?.data;
      const rawItems: any[] = rawData?.items || [];
      if (rawItems.length === 0) break;

      rawItems.forEach((item) => {
        if (!item || !item._id) return;
        const uid = String(item._id).trim();
        allCitizenIds.push(uid);

        const wealthObj = typeof item.stats?.wealth === 'object' ? item.stats.wealth : null;
        const user: WareraUserLite = {
          _id: uid,
          username: item.username || `Citizen #${uid.slice(-6)}`,
          avatarUrl: item.avatarUrl || item.avatar,
          country: item.country || countryId,
          countryId: typeof item.country === 'string' ? item.country : (item.country?._id || countryId),
          leveling: item.leveling,
          level: Number(item.leveling?.level ?? item.level ?? 0),
          militaryRank: item.militaryRank,
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          createdAt: item.createdAt,
          dates: item.dates,
          skills: item.skills,
          rankings: item.rankings,
          stats: item.stats,
          money: wealthObj?.money !== undefined ? wealthObj.money : item.money,
        };

        memoryUserCache[uid] = { ...(memoryUserCache[uid] || {}), ...user };
        harvestedUsers.push(user);
      });

      cursor = rawData?.nextCursor;
      if (!cursor || rawItems.length < 100) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    if (harvestedUsers.length > 0) {
      await storage.saveUsers(harvestedUsers);
    }
    return Array.from(new Set(allCitizenIds));
  } catch (err) {
    console.warn('Failed to fetch country citizens:', err);
    return Array.from(new Set(allCitizenIds));
  }
}

/**
 * Fetch country inter-state transfers via authenticated transaction.getPaginatedTransactions
 */
export async function fetchNationalTransfers(
  countryId: string,
  apiKey: string,
  countryName = 'Country',
  countries: WareraCountry[] = []
): Promise<NationalTransaction[]> {
  if (!apiKey || !apiKey.trim()) return [];

  try {
    const queryInput: Record<string, any> = {
      countryId,
      limit: 50,
    };
    const encoded = encodeURIComponent(JSON.stringify(queryInput));
    const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${encoded}`, {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey.trim(),
      },
    });

    if (!res.ok) return [];
    const json = await res.json();
    const rawItems: any[] = Array.isArray(json?.result?.data)
      ? json.result.data
      : json?.result?.data?.items || [];

    // Ensure comprehensive country dictionary is available for resolution
    let allCountries = countries;
    if (!allCountries || allCountries.length <= 2) {
      try {
        allCountries = await getCountries();
      } catch {
        allCountries = await storage.getCountries();
      }
    }

    const countryNameMap: Record<string, string> = {
      '6813b6d546e731854c7ac85f': 'Colombia',
      '683ddd2c24b5a2e114af15d9': 'Malaysia',
    };
    allCountries.forEach((c) => {
      if (c._id && c.name) countryNameMap[c._id] = c.name;
    });
    countryNameMap[countryId] = countryName;

    const transfers: NationalTransaction[] = [];
    rawItems.forEach((item, index) => {
      const rawAmount = Number(item.money || item.amount || item.value || 0);
      if (rawAmount === 0) return;
      const amount = Math.abs(rawAmount);

      const txType = (item.transactionType || item.type || item.action || '').toLowerCase();
      
      // Handle object or string references
      const targetObj = typeof item.targetCountry === 'object' ? item.targetCountry : null;
      const partnerObj = typeof item.partner === 'object' ? item.partner : null;
      const recipientObj = typeof item.recipient === 'object' ? item.recipient : null;
      const destinationObj = typeof item.destination === 'object' ? item.destination : null;

      const targetCId =
        targetObj?._id ||
        (typeof item.targetCountry === 'string' ? item.targetCountry : null) ||
        item.targetCountryId ||
        item.recipientCountryId ||
        item.destinationCountryId ||
        item.toCountryId ||
        item.toCountry ||
        item.receiverId;

      const sourceCId =
        (typeof item.sourceCountry === 'object' ? item.sourceCountry?._id : null) ||
        (typeof item.sourceCountry === 'string' ? item.sourceCountry : null) ||
        item.sourceCountryId ||
        item.fromCountryId ||
        item.senderCountryId ||
        item.senderId;

      const otherCId = (item.countryId && item.countryId !== countryId) ? item.countryId : null;
      const partnerCId =
        partnerObj?._id ||
        item.partnerId ||
        item.partnerCountryId ||
        item.counterpartId ||
        (recipientObj?._id || (typeof item.recipientId === 'string' ? item.recipientId : null));

      const foreignCountryId = 
        (targetCId && targetCId !== countryId ? targetCId : null) ||
        (sourceCId && sourceCId !== countryId ? sourceCId : null) ||
        otherCId ||
        partnerCId ||
        (item.sellerId && countryNameMap[item.sellerId] && item.sellerId !== countryId ? item.sellerId : null) ||
        (item.buyerId && countryNameMap[item.buyerId] && item.buyerId !== countryId ? item.buyerId : null);

      // Distinguish state-level transfers from personal donations
      const isStateTransfer =
        txType.includes('transfer') ||
        txType.includes('country') ||
        txType.includes('state') ||
        txType.includes('national') ||
        Boolean(foreignCountryId) ||
        Boolean(item.targetCountryName || item.sourceCountryName || item.partnerName || item.destinationName);

      if (isStateTransfer) {
        // Resolve counterpart nation name
        const partnerId = foreignCountryId || 'foreign';
        
        // Scan notes or descriptions for mentions of foreign nations (e.g. Malaysia / Malasya)
        const itemNoteText = (item.note || item.referenceNote || item.comment || item.description || '').toLowerCase();
        let detectedNameFromNote = '';
        if (itemNoteText.includes('malasya') || itemNoteText.includes('malaysia')) {
          detectedNameFromNote = 'Malaysia';
        } else {
          const foundAlly = allCountries.find((c) => c.name && c._id !== countryId && itemNoteText.includes(c.name.toLowerCase()));
          if (foundAlly) detectedNameFromNote = foundAlly.name;
        }

        const partnerName =
          (partnerId && countryNameMap[partnerId]) ||
          targetObj?.name ||
          partnerObj?.name ||
          recipientObj?.name ||
          destinationObj?.name ||
          item.targetCountryName ||
          item.recipientCountryName ||
          item.destinationName ||
          item.sourceCountryName ||
          item.partnerName ||
          item.counterpartName ||
          detectedNameFromNote ||
          (partnerId !== 'foreign' && countryNameMap[partnerId] ? countryNameMap[partnerId] : (partnerId !== 'foreign' ? `Nation (${partnerId.slice(-6)})` : 'Foreign Ally'));

        // Determine direction accurately:
        // When Colombia initiates a transfer to Malaysia (targetCId !== countryId), it is SENT
        let direction: 'sent' | 'received' = 'sent';
        const itemDirection = (item.direction || '').toLowerCase();

        if (targetCId && targetCId !== countryId) {
          direction = 'sent';
        } else if (sourceCId && sourceCId !== countryId) {
          direction = 'received';
        } else if (itemDirection === 'out' || itemDirection === 'outgoing' || itemDirection === 'sent') {
          direction = 'sent';
        } else if (itemDirection === 'in' || itemDirection === 'incoming' || itemDirection === 'received') {
          direction = 'received';
        } else if (rawAmount < 0) {
          direction = 'sent';
        } else if (item.senderCountryId && item.senderCountryId !== countryId) {
          direction = 'received';
        } else if (item.receiverId && item.receiverId === countryId) {
          direction = 'received';
        } else {
          direction = 'sent';
        }

        const sourceName = direction === 'sent' ? countryName : partnerName;
        const targetName = direction === 'sent' ? partnerName : countryName;

        transfers.push({
          id: item._id || `api-tx-${Date.now()}-${index}`,
          date: (item.createdAt || new Date().toISOString()).split('T')[0],
          sourceCountryId: direction === 'sent' ? countryId : partnerId,
          sourceCountryName: sourceName,
          targetCountryId: direction === 'sent' ? partnerId : countryId,
          targetCountryName: targetName,
          direction,
          category: (item.category as any) || 'ayuda',
          amountBtc: amount,
          referenceNote:
            item.note ||
            item.referenceNote ||
            item.comment ||
            item.description ||
            `State bilateral transfer: ${sourceName} ➔ ${targetName}`,
          createdAt: item.createdAt || new Date().toISOString(),
        });
      }
    });

    return transfers;
  } catch (err) {
    console.warn('Failed to fetch country transfers from API:', err);
    return [];
  }
}
