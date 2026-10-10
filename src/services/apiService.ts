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
// Enforces max concurrency of 8 and responsive 25ms spacing with 429 auto-backoff
// =========================================================================
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 8; // High-throughput concurrency ceiling
const MIN_REQUEST_INTERVAL_MS = 25; // Responsive spacing between queries
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

export interface ApiDiagnosticLog {
  id: string;
  timestamp: string;
  url: string;
  endpoint: string;
  method: string;
  hasApiKey: boolean;
  apiKeyPreview: string;
  status: number;
  statusText: string;
  durationMs: number;
  headersSent: Record<string, string>;
  error?: string;
}

export const apiDiagnosticsLogStore: ApiDiagnosticLog[] = [];
export const MAX_DIAGNOSTIC_LOGS = 60;

export function addDiagnosticLog(entry: ApiDiagnosticLog): void {
  apiDiagnosticsLogStore.unshift(entry);
  if (apiDiagnosticsLogStore.length > MAX_DIAGNOSTIC_LOGS) {
    apiDiagnosticsLogStore.pop();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('warera:diagnostic-logged', { detail: entry }));
  }
}

export function getDiagnosticLogs(): ApiDiagnosticLog[] {
  return [...apiDiagnosticsLogStore];
}

export function clearDiagnosticLogs(): void {
  apiDiagnosticsLogStore.length = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('warera:diagnostic-logged', { detail: null }));
  }
}

export async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<Response> {
  const startTs = Date.now();
  const currentKey = storage.getApiKey()?.trim();
  const rawHeaders = (options?.headers as Record<string, string>) || {};
  const mergedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...rawHeaders,
  };

  // Attach single canonical X-API-Key header to avoid duplicate header concatenation
  if (currentKey) {
    mergedHeaders['X-API-Key'] = currentKey;
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: mergedHeaders,
  };

  const endpointName = url.replace('https://api2.warera.io/trpc/', '').split('?')[0] || url;
  const keyPreview = currentKey ? `${currentKey.slice(0, 4)}...${currentKey.slice(-4)}` : 'None';

  return new Promise<Response>((resolve, reject) => {
    const execute = async () => {
      try {
        const res = await fetch(url, mergedOptions);
        const durationMs = Date.now() - startTs;

        addDiagnosticLog({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          url,
          endpoint: endpointName,
          method: options?.method || 'GET',
          hasApiKey: Boolean(currentKey),
          apiKeyPreview: keyPreview,
          status: res.status,
          statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
          durationMs,
          headersSent: {
            Accept: mergedHeaders.Accept || 'application/json',
            'X-API-Key': currentKey ? `${currentKey.slice(0, 4)}...` : 'None',
            Authorization: currentKey ? `Bearer ${currentKey.slice(0, 4)}...` : 'None',
          },
        });

        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('warera:unauthorized-key', { detail: { url, endpoint: endpointName } })
            );
          }
        }

        if (res.status === 429 && retries > 0) {
          // Upstream API rate limit hit: pause queue and back off exponentially
          const retryHeader = res.headers.get('Retry-After');
          const backoffDelay = retryHeader
            ? Math.max(1500, parseInt(retryHeader, 10) * 1000)
            : (4 - retries) * 1800;

          console.warn(`[War Era Rate-Limiter] HTTP 429 detected on ${endpointName}. Pacing queue for ${backoffDelay}ms (attempt ${4 - retries}/3)...`);
          await new Promise((r) => setTimeout(r, backoffDelay));

          activeRequests = Math.max(0, activeRequests - 1);
          pumpQueue();

          // Re-queue with one fewer retry
          resolve(rateLimitedFetch(url, mergedOptions, retries - 1));
          return;
        }

        activeRequests = Math.max(0, activeRequests - 1);
        pumpQueue();
        resolve(res);
      } catch (err: any) {
        const durationMs = Date.now() - startTs;
        addDiagnosticLog({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          url,
          endpoint: endpointName,
          method: options?.method || 'GET',
          hasApiKey: Boolean(currentKey),
          apiKeyPreview: keyPreview,
          status: 0,
          statusText: 'Network / CORS Failure',
          durationMs,
          headersSent: {
            Accept: mergedHeaders.Accept || 'application/json',
            'X-API-Key': currentKey ? `${currentKey.slice(0, 4)}...` : 'None',
          },
          error: err?.message || String(err),
        });

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

export function normalizeTransactionTimestamp(val: any, fallbackIso?: string): string {
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
    // Parse MongoDB ObjectId timestamp (first 8 hex chars = seconds)
    if (trimmed.length >= 8 && /^[0-9a-fA-F]{8}/.test(trimmed)) {
      const tsSec = parseInt(trimmed.slice(0, 8), 16);
      if (!isNaN(tsSec) && tsSec > 1500000000 && tsSec < 2500000000) {
        return new Date(tsSec * 1000).toISOString();
      }
    }
  }
  if (val instanceof Date) return val.toISOString();
  return fallbackIso || '';
}

export function extractItemTimestampMs(item: any): number {
  if (!item) return NaN;
  const raw = item.createdAt ?? item.timestamp ?? item.date ?? item.updatedAt ?? item.time;
  if (raw !== undefined && raw !== null) {
    if (typeof raw === 'number') {
      return raw < 100000000000 ? raw * 1000 : raw;
    }
    if (typeof raw === 'string') {
      const num = Number(raw.trim());
      if (!isNaN(num) && num > 0) {
        return num < 100000000000 ? num * 1000 : num;
      }
      const t = new Date(raw.trim()).getTime();
      if (!isNaN(t)) return t;
    }
    if (raw instanceof Date) return raw.getTime();
  }
  // Extract timestamp from MongoDB ObjectId (_id)
  const idStr = typeof item._id === 'string' ? item._id : (typeof item.id === 'string' ? item.id : '');
  if (idStr.length >= 8 && /^[0-9a-fA-F]{8}/.test(idStr)) {
    const tsSec = parseInt(idStr.slice(0, 8), 16);
    if (!isNaN(tsSec) && tsSec > 1500000000 && tsSec < 2500000000) {
      return tsSec * 1000;
    }
  }
  return NaN;
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

export function extractItemString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    return String(val.name || val.code || val.type || val.title || val.itemCode || val.resourceType || val._id || '').trim();
  }
  return String(val).trim();
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

        const rawTimeMs = extractItemTimestampMs(item);
        const createdAtNorm = !isNaN(rawTimeMs)
          ? new Date(rawTimeMs).toISOString()
          : normalizeTransactionTimestamp(item.createdAt || item.timestamp || item.date || item.updatedAt, new Date().toISOString());
        const updatedAtNorm = item.updatedAt ? normalizeTransactionTimestamp(item.updatedAt, createdAtNorm) : createdAtNorm;

        return {
          _id: item._id,
          transactionType: tType,
          money: Number(item.money || item.amount || 0),
          amount: Number(item.money || item.amount || 0),
          userId: citizenId,
          sellerId: item.sellerId || (tType === 'market' || tType === 'itemMarket' ? citizenId : undefined),
          buyerId: item.buyerId,
          companyId: item.companyId || item.employerId || item.employer?._id,
          item: extractItemString(item.item || item.commodity || item.resource || item.resourceType),
          resourceType: extractItemString(item.resourceType || item.item),
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
  onProgress?: (loaded: number, page: number) => void,
  signal?: AbortSignal,
  daysLimit = 35
): Promise<WareraTransaction[]> {
  if (!apiKey || !apiKey.trim() || !userId) {
    return [];
  }

  const allTransactions: WareraTransaction[] = [];
  const seenIds = new Set<string>();
  let cursor: string | undefined = undefined;
  let hasMore = true;
  let page = 0;
  const maxPages = 30; // up to 1,500 transactions (stops early once date window is reached)
  const effectiveCutoff = Date.now() - (daysLimit + 1) * 24 * 60 * 60 * 1000;

  while (hasMore && page < maxPages) {
    if (signal?.aborted) {
      break;
    }
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

      const items: WareraTransaction[] = rawItems
        .filter((item) => {
          const rawTypeStr = (item.transactionType || item.type || item.action || '').toLowerCase();
          const moneyVal = Number(item.money || item.amount || 0);
          // Filter out zero-BTC non-monetary operations (e.g. dismantling items or crafting without BTC fee)
          // so they do not choke the financial audit or swamp the transaction ledger
          if (moneyVal === 0 && (rawTypeStr.includes('dismantle') || rawTypeStr.includes('craft') || rawTypeStr.includes('upgrade'))) {
            return false;
          }
          return true;
        })
        .map((item) => {
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
          // In wages: worker receives salary; company employer pays salary
          if (rawRecipientId === userId || item.workerId === userId || (rawRecipientId && rawRecipientId === effectiveUserId)) {
            resolvedSellerId = userId; // worker (earner)
            resolvedBuyerId = rawSenderId || rawCompanyId || undefined;
          } else if (rawSenderId === userId || rawBuyerId === userId || item.employerId === userId) {
            resolvedBuyerId = userId; // employer (paying wages out)
            resolvedSellerId = rawRecipientId || undefined;
          } else if (rawCompanyId && (rawRecipientId === userId || effectiveUserId === userId)) {
            resolvedSellerId = userId;
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

        const rawTimeMs = extractItemTimestampMs(item);
        const createdAtNorm = !isNaN(rawTimeMs)
          ? new Date(rawTimeMs).toISOString()
          : normalizeTransactionTimestamp(item.createdAt || item.timestamp || item.date || item.updatedAt, new Date().toISOString());
        const updatedAtNorm = item.updatedAt ? normalizeTransactionTimestamp(item.updatedAt, createdAtNorm) : createdAtNorm;

        return {
          _id: item._id,
          transactionType: tType,
          money: Number(item.money || item.amount || 0),
          amount: Number(item.money || item.amount || 0),
          userId: effectiveUserId,
          sellerId: resolvedSellerId,
          buyerId: resolvedBuyerId,
          companyId: resolvedCompanyId,
          senderId: rawSenderId,
          recipientId: rawRecipientId,
          action: item.action || rawTypeStr,
          item: extractItemString(item.item || item.commodity || item.resource || item.resourceType),
          resourceType: extractItemString(item.resourceType || item.item),
          countryId: item.countryId,
          createdAt: createdAtNorm,
          updatedAt: updatedAtNorm,
        };
      });

      for (const it of items) {
        if (!seenIds.has(it._id)) {
          seenIds.add(it._id);
          allTransactions.push(it);
        }
      }
      onProgress?.(allTransactions.length, page);

      const oldestRaw = rawItems[rawItems.length - 1];
      const oldestTime = extractItemTimestampMs(oldestRaw);
      // Stop paging only when the tail of the page is definitively past the analysis window
      if (!isNaN(oldestTime) && oldestTime < effectiveCutoff) {
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
  const cached = memoryUserCache[userId];
  if (!forceRefresh && cached && cached.skills && cached.level !== undefined && !cached.username?.startsWith('Citizen #')) {
    return cached;
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
      // 1-time retry with backoff if initial attempts failed
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 200));
        res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/user.getUserLite?input=${encoded}`, {
          headers: { 'Accept': 'application/json' },
        });
      }
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
        countryId: typeof data.country === 'string' ? data.country : (data.country?._id || data.country),
        leveling: data.leveling,
        level: Number(data.leveling?.level ?? data.level ?? 0),
        militaryRank: data.militaryRank,
        isActive: Boolean(data.isActive !== undefined ? data.isActive : true),
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
  onChunkResolved?: (chunkUsers: WareraUserLite[]) => void,
  countryId?: string
): Promise<Record<string, WareraUserLite>> {
  const existingMap = await storage.getAllUsers();
  Object.assign(memoryUserCache, existingMap);

  // Filter missing: query users who have no record or have a temporary placeholder/unresolved level
  const missingIds = userIds.filter((id) => {
    const cached = memoryUserCache[id];
    return (
      !cached ||
      !cached.username ||
      cached.username.startsWith('Citizen #') ||
      cached.level === undefined
    );
  });

  const newUsers: WareraUserLite[] = [];
  const chunkSize = 16; // High-throughput concurrency chunk
  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((uid) => fetchUserLite(uid, false)));
    const chunkUsers: WareraUserLite[] = [];
    results.forEach((u, idx) => {
      const uid = chunk[idx];
      if (u) {
        if (!u.country && countryId) {
          u.country = countryId;
          u.countryId = countryId;
        }
        newUsers.push(u);
        chunkUsers.push(u);
      } else {
        // Fallback placeholder if upstream timed out
        const existing = memoryUserCache[uid];
        const placeholder: WareraUserLite = {
          _id: uid,
          username: existing?.username || `Citizen #${uid.slice(-6)}`,
          country: existing?.country || countryId,
          countryId: existing?.countryId || countryId,
          isActive: existing?.isActive !== undefined ? existing.isActive : true,
          level: existing?.level !== undefined ? existing.level : 10,
        };
        memoryUserCache[uid] = placeholder;
        chunkUsers.push(placeholder);
      }
    });

    if (chunkUsers.length > 0) {
      // Progressively persist chunk users to IndexedDB so partial progress is never lost
      storage.saveUsers(chunkUsers).catch((err) => console.warn('Failed to progressively save users:', err));
      if (onChunkResolved) {
        onChunkResolved(chunkUsers);
      }
    }

    onBatchProgress?.(Math.min(i + chunkSize, missingIds.length), missingIds.length);
    if (i + chunkSize < missingIds.length) {
      await new Promise((r) => setTimeout(r, 30));
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
  maxPages = 25
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
        const existing = memoryUserCache[uid];

        // Only register placeholder if user does not already have an established profile with valid level
        if (!existing || existing.level === undefined || existing.username?.startsWith('Citizen #')) {
          const user: WareraUserLite = {
            _id: uid,
            username: item.username || existing?.username || `Citizen #${uid.slice(-6)}`,
            avatarUrl: item.avatarUrl || item.avatar || existing?.avatarUrl,
            country: item.country || countryId,
            countryId: typeof item.country === 'string' ? item.country : (item.country?._id || countryId),
            leveling: item.leveling || existing?.leveling,
            level: Number(item.leveling?.level ?? item.level ?? existing?.level ?? 0),
            militaryRank: item.militaryRank ?? existing?.militaryRank,
            isActive: item.isActive !== undefined ? Boolean(item.isActive) : (existing?.isActive ?? true),
            createdAt: item.createdAt || existing?.createdAt,
            dates: item.dates || existing?.dates,
            skills: item.skills || existing?.skills,
            rankings: item.rankings || existing?.rankings,
            stats: item.stats || existing?.stats,
            money: wealthObj?.money !== undefined ? wealthObj.money : (item.money ?? existing?.money),
          };

          memoryUserCache[uid] = user;
          harvestedUsers.push(user);
        }
      });

      cursor = rawData?.nextCursor;
      if (!cursor || rawItems.length < 100) break;
      await new Promise((r) => setTimeout(r, 80));
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
  if (!apiKey || !apiKey.trim()) {
    return storage.getNationalTransactions(countryId);
  }

  try {
    const rawItems: any[] = [];
    let cursor: string | undefined = undefined;
    let page = 0;
    const maxPages = 20; // Deep pagination up to 1,000 country money transfers

    while (page < maxPages) {
      page++;
      const queryInput: Record<string, any> = {
        countryId,
        transactionType: 'countryMoneyTransfer',
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

      if (!res.ok) break;
      const json = await res.json();
      const pageItems: any[] = Array.isArray(json?.result?.data)
        ? json.result.data
        : json?.result?.data?.items || [];

      if (!pageItems || pageItems.length === 0) break;
      rawItems.push(...pageItems);

      cursor = json?.result?.data?.nextCursor;
      if (!cursor) break;
      await new Promise((r) => setTimeout(r, 40));
    }

    // Ensure comprehensive country dictionary is available for resolution
    let allCountries = countries;
    if (!allCountries || allCountries.length <= 2) {
      try {
        allCountries = await getCountries();
      } catch {
        allCountries = await storage.getCountries();
      }
    }

    const countryNameMap: Record<string, string> = {};
    allCountries.forEach((c) => {
      if (c._id && c.name) countryNameMap[c._id] = c.name;
    });
    if (countryId && countryName) {
      countryNameMap[countryId] = countryName;
    }

    const transfers: NationalTransaction[] = [];
    rawItems.forEach((item, index) => {
      const rawAmount = Number(item.money || item.amount || item.value || 0);
      if (rawAmount === 0) return;
      const amount = Math.abs(rawAmount);

      // In War Era upstream data model for countryMoneyTransfer:
      // item.sellerCountryId is the Origin / Sender Country
      // item.buyerCountryId is the Destination / Receiver Country
      const sellerCId =
        item.sellerCountryId ||
        (typeof item.sourceCountry === 'object' ? item.sourceCountry?._id : item.sourceCountry) ||
        item.sourceCountryId ||
        item.fromCountryId ||
        item.senderCountryId ||
        item.senderId;

      const buyerCId =
        item.buyerCountryId ||
        (typeof item.targetCountry === 'object' ? item.targetCountry?._id : item.targetCountry) ||
        item.targetCountryId ||
        item.recipientCountryId ||
        item.destinationCountryId ||
        item.toCountryId ||
        item.receiverId;

      // Determine flow direction accurately:
      // If sellerCountryId === countryId => selected country SENT the funds (OUTGOING)
      // If buyerCountryId === countryId => selected country RECEIVED the funds (INCOMING)
      let direction: 'sent' | 'received' = 'sent';
      const itemDirection = (item.direction || '').toLowerCase();

      if (sellerCId && String(sellerCId).trim() === countryId) {
        direction = 'sent';
      } else if (buyerCId && String(buyerCId).trim() === countryId) {
        direction = 'received';
      } else if (itemDirection === 'in' || itemDirection === 'incoming' || itemDirection === 'received') {
        direction = 'received';
      } else if (itemDirection === 'out' || itemDirection === 'outgoing' || itemDirection === 'sent') {
        direction = 'sent';
      } else if (rawAmount < 0) {
        direction = 'sent';
      } else {
        direction = 'sent';
      }

      const counterpartId = direction === 'sent' ? buyerCId : sellerCId;
      const originId = direction === 'sent' ? countryId : (sellerCId || counterpartId || 'foreign');
      const destinationId = direction === 'sent' ? (buyerCId || counterpartId || 'foreign') : countryId;

      // Scan notes for ally references as a secondary fallback
      const itemNoteText = (item.note || item.referenceNote || item.comment || item.description || '').toLowerCase();
      let detectedNameFromNote = '';
      if (itemNoteText) {
        const foundAlly = allCountries.find((c) => c.name && c._id !== countryId && itemNoteText.includes(c.name.toLowerCase()));
        if (foundAlly) detectedNameFromNote = foundAlly.name;
      }

      const counterpartName =
        (counterpartId && countryNameMap[counterpartId]) ||
        allCountries.find((c) => c._id === counterpartId)?.name ||
        detectedNameFromNote ||
        (counterpartId && counterpartId !== 'foreign' ? `Nation (${String(counterpartId).slice(-6)})` : 'Foreign Nation');

      const sourceName = direction === 'sent' ? countryName : counterpartName;
      const targetName = direction === 'sent' ? counterpartName : countryName;

      transfers.push({
        id: item._id || `api-tx-${Date.now()}-${index}`,
        date: (item.createdAt || new Date().toISOString()).split('T')[0],
        sourceCountryId: originId,
        sourceCountryName: sourceName,
        targetCountryId: destinationId,
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
    });

    if (transfers.length > 0) {
      await storage.saveNationalTransactions(transfers, countryId);
    }
    return transfers;
  } catch (err) {
    console.warn('Failed to fetch country transfers from API:', err);
    return storage.getNationalTransactions(countryId);
  }
}

export interface CountryInventorySyncResult {
  inventory: Record<string, number>;
  isAuthorized: boolean;
  status: 'synced' | 'unauthorized' | 'error' | 'empty' | 'no_api_key';
  message: string;
  orgId?: string;
  syncedAt?: string;
  httpStatus?: number;
}

/**
 * Live API connection test utility that directly verifies connectivity and token validity against api2.warera.io
 */
export async function testWarEraApiConnection(keyToTest?: string): Promise<{
  success: boolean;
  publicOk: boolean;
  authOk: boolean;
  publicStatus: number;
  authStatus: number;
  message: string;
  authEndpoint: string;
  testedKeyPreview: string;
  durationMs?: number;
  itemsCount?: number;
  authResponseBody?: any;
}> {
  const token = (keyToTest ?? storage.getApiKey() ?? '').trim();
  const testedKeyPreview = token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'None';

  // 1. Test public endpoint
  let publicOk = false;
  let publicStatus = 0;
  try {
    const pubRes = await fetch(`${WARERA_TRPC_BASE}/country.getAllCountries`);
    publicStatus = pubRes.status;
    publicOk = pubRes.ok;
  } catch {
    publicStatus = 0;
  }

  if (!token) {
    return {
      success: false,
      publicOk,
      authOk: false,
      publicStatus,
      authStatus: 0,
      message: 'No API Key configured. War Era API requires a valid token.',
      authEndpoint: 'transaction.getPaginatedTransactions',
      testedKeyPreview: 'None',
    };
  }

  // 2. Test authenticated endpoint with War Era API token via X-API-Key
  const authHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Key': token,
  };

  const startTime = Date.now();
  const inputParam = encodeURIComponent(JSON.stringify({ page: 1 }));
  const probeUrl = `${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${inputParam}`;

  try {
    const authRes = await fetch(probeUrl, {
      headers: authHeaders,
    });
    const durationMs = Date.now() - startTime;
    const authStatus = authRes.status;
    const authResponseBody = await authRes.json().catch(() => null);

    const isSuccess = authRes.ok || authStatus === 200;
    const itemsCount = authResponseBody?.result?.data?.items?.length ?? 0;

    let message = '';
    if (isSuccess) {
      message = `Successfully authenticated with War Era API! Live transaction stream verified (${itemsCount} live records received in ${durationMs}ms).`;
    } else if (authStatus === 401) {
      message = `War Era API returned HTTP 401 Unauthorized. Key was rejected ("${authResponseBody?.error?.message || 'API token required'}").`;
    } else if (authStatus === 429) {
      message = 'War Era API rate limit reached (HTTP 429). Please wait a few seconds and try again.';
    } else {
      message = `War Era API returned HTTP ${authStatus}: ${authResponseBody?.error?.message || authRes.statusText}`;
    }

    addDiagnosticLog({
      id: `diag-test-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      url: probeUrl,
      endpoint: 'transaction.getPaginatedTransactions',
      method: 'GET',
      hasApiKey: true,
      apiKeyPreview: testedKeyPreview,
      status: authStatus,
      statusText: authRes.statusText || (isSuccess ? 'OK' : 'Error'),
      durationMs,
      headersSent: { 'X-API-Key': testedKeyPreview },
      error: isSuccess ? undefined : message,
    });

    return {
      success: isSuccess,
      publicOk,
      authOk: isSuccess,
      publicStatus,
      authStatus,
      durationMs,
      itemsCount,
      message,
      authEndpoint: 'transaction.getPaginatedTransactions',
      testedKeyPreview,
      authResponseBody,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      publicOk,
      authOk: false,
      publicStatus,
      authStatus: 0,
      durationMs,
      message: `Failed to contact api2.warera.io: ${err?.message || 'Network error'}`,
      authEndpoint: 'transaction.getPaginatedTransactions',
      testedKeyPreview,
    };
  }
}

/**
 * Detailed sovereign inventory fetcher with support for national state organizations,
 * multiple TRPC schema variations, and clear authorization diagnostics.
 */
export async function fetchCountryInventoryDetailed(
  countryId: string,
  providedApiKey?: string,
  stateOrgId?: string
): Promise<CountryInventorySyncResult> {
  if (!countryId) {
    return { inventory: {}, isAuthorized: false, status: 'empty', message: 'No country selected' };
  }

  const effectiveKey = (providedApiKey || storage.getApiKey() || '').trim();
  const orgCandidate = stateOrgId?.trim();

  if (!effectiveKey) {
    return {
      inventory: {},
      isAuthorized: false,
      status: 'no_api_key',
      orgId: orgCandidate,
      message: 'War Era API Key Missing: An authenticated API token is required to query live national warehouses from https://api2.warera.io.',
    };
  }

  const authHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Key': effectiveKey,
  };

  // Attempt prioritized list of endpoints and payloads
  const attempts: Array<{ path: string; input: Record<string, any> }> = [];
  if (orgCandidate) {
    attempts.push({ path: 'inventory.getInventory', input: { orgId: orgCandidate } });
    attempts.push({ path: 'inventory.getById', input: { id: orgCandidate } });
    attempts.push({ path: 'inventory.getById', input: { orgId: orgCandidate } });
  }
  attempts.push({ path: 'inventory.getById', input: { countryId } });
  attempts.push({ path: 'inventory.getById', input: { id: countryId } });
  attempts.push({ path: 'inventory.getInventory', input: { countryId } });

  let sawUnauthorized = false;

  for (const attempt of attempts) {
    try {
      const encoded = encodeURIComponent(JSON.stringify(attempt.input));
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/${attempt.path}?input=${encoded}`, {
        headers: authHeaders,
      });

      if (res.status === 401 || res.status === 403) {
        sawUnauthorized = true;
        continue;
      }

      if (!res.ok) continue;

      const json = await res.json();
      const rawData = json?.result?.data;
      if (!rawData) continue;

      // Extract dictionary of commodity items from various schema layouts
      let itemsDict: Record<string, number> = {};
      if (rawData.items && typeof rawData.items === 'object') {
        if (rawData.items.basics && typeof rawData.items.basics === 'object') {
          itemsDict = rawData.items.basics;
        } else {
          itemsDict = rawData.items;
        }
      } else if (rawData.basics && typeof rawData.basics === 'object') {
        itemsDict = rawData.basics;
      } else if (typeof rawData === 'object') {
        // Look for items array or direct properties
        if (Array.isArray(rawData)) {
          rawData.forEach((entry: any) => {
            if (entry?.itemCode && typeof entry?.quantity === 'number') {
              itemsDict[entry.itemCode] = entry.quantity;
            }
          });
        }
      }

      if (itemsDict && Object.keys(itemsDict).length > 0) {
        const cleaned: Record<string, number> = {};
        for (const [key, val] of Object.entries(itemsDict)) {
          if (typeof val === 'number') cleaned[key] = val;
        }
        return {
          inventory: cleaned,
          isAuthorized: true,
          status: 'synced',
          orgId: orgCandidate,
          syncedAt: new Date().toISOString(),
          message: 'Successfully synchronized from War Era state warehouse',
        };
      }
    } catch {
      // Continue to next attempt
    }
  }

  if (sawUnauthorized) {
    return {
      inventory: {},
      isAuthorized: false,
      status: 'unauthorized',
      httpStatus: 401,
      orgId: orgCandidate,
      message: 'HTTP 401 Unauthorized: War Era API rejected the provided key for national warehouse access.',
    };
  }

  return {
    inventory: {},
    isAuthorized: true,
    status: 'empty',
    orgId: orgCandidate,
    message: 'War Era warehouse endpoint reached, but 0 commodities are currently recorded for this nation.',
  };
}

/**
 * Fetch official state inventory of commodities (petroleum, paper, bread, etc.)
 */
export async function fetchCountryInventory(
  countryId: string,
  apiKey?: string,
  orgId?: string
): Promise<Record<string, number>> {
  if (!countryId) return {};
  const res = await fetchCountryInventoryDetailed(countryId, apiKey, orgId);
  return res.inventory;
}

/**
 * Fetch state commodity purchase and sale movement transactions via itemMarket & trading
 */
export async function fetchCountryCommodityTransactions(
  countryId: string,
  apiKey: string
): Promise<Array<{
  id: string;
  itemCode: string;
  type: 'buy' | 'sell';
  quantity: number;
  unitPriceBtc: number;
  totalBtc: number;
  createdAt: string;
  counterpartName?: string;
}>> {
  if (!apiKey || !apiKey.trim() || !countryId) return [];
  const results: Array<{
    id: string;
    itemCode: string;
    type: 'buy' | 'sell';
    quantity: number;
    unitPriceBtc: number;
    totalBtc: number;
    createdAt: string;
    counterpartName?: string;
  }> = [];

  const types = ['itemMarket', 'trading'];
  for (const tType of types) {
    try {
      const queryInput = {
        countryId,
        transactionType: tType,
        limit: 50,
      };
      const encoded = encodeURIComponent(JSON.stringify(queryInput));
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/transaction.getPaginatedTransactions?input=${encoded}`, {
        headers: {
          Accept: 'application/json',
          'X-API-Key': apiKey.trim(),
        },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const pageItems: any[] = Array.isArray(json?.result?.data)
        ? json.result.data
        : json?.result?.data?.items || [];

      pageItems.forEach((tx) => {
        const itemCode = tx.itemCode || tx.item || '';
        if (!itemCode) return;
        const qty = Number(tx.quantity || 1);
        const totalMoney = Math.abs(Number(tx.money || tx.price || 0));
        const unitPrice = qty > 0 ? totalMoney / qty : totalMoney;

        const isSell =
          tx.sellerCountryId === countryId ||
          (tx.direction === 'out' || tx.direction === 'outgoing');

        results.push({
          id: tx._id || `tx-${Date.now()}-${Math.random()}`,
          itemCode,
          type: isSell ? 'sell' : 'buy',
          quantity: qty,
          unitPriceBtc: unitPrice,
          totalBtc: totalMoney,
          createdAt: tx.createdAt || new Date().toISOString(),
          counterpartName: tx.buyerCountryId || tx.sellerCountryId || undefined,
        });
      });
    } catch (err) {
      console.warn(`Failed to fetch commodity transactions for ${tType}:`, err);
    }
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
