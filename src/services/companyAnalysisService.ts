/**
 * War Era v0.27 Live Company & Workforce Analysis Engine
 * Implements full telemetry parity with https://arcana.warera.wiki/company:
 * - Queries company.getCompanies, company.getById, work.getStatsByCompany,
 *   manager.getByCompanyId, managerOffer.getByCompanyId, employee.getCompanyRoster,
 *   itemTrading.getPrices, country.getAllCountries, region.getRegionsObject,
 *   gameStat.getPpMoneyValue, managerOffer.getWageStats, and search.searchAnything.
 * - Computes 14-day daily output history (Engine, Employees, Self-work),
 *   Daily Balance ledger, Manager contracts & offers, Live Bot Employee rosters
 *   with production bonus contribution breakdowns, internal raw-to-factory supply
 *   transfers ("Supply own factories"), Best Products Right Now, Lowest-Tax Countries,
 *   and non-destructive "What-If..." simulations.
 */

import { rateLimitedFetch, getCountries } from './apiService';
import { storage } from './storage';
import {
  WareraCompany,
  WareraCompanyManager,
  WareraCompanyManagerOffer,
  WareraCompanyRosterResponse,
  WareraCountry,
  WareraRegionRecord,
  WareraRosterEmployeeRaw,
  WareraUserLite,
  WareraWorkDailyStat,
} from '../types/warera';

const WARERA_TRPC_BASE = 'https://api2.warera.io/trpc';

export const HISTORY_DAYS = 14;
export const AVG_DAYS = 7;
export const V027_START = Date.parse('2026-10-26T16:00:00Z');
export const V027_DAY = '2026-10-26';

// v0.27 patch notes: an employee makes Production ÷ 4 points per hour, before bonuses.
export const PTS_PER_LEVEL_HOUR = 0.25;
// +2% per Management point: the owner's, and the manager's up to +22%; +44% together at most.
export const MGMT_PCT = 2;
export const MANAGER_CAP_PCT = 22;
export const MGMT_CAP_PCT = 44;
export const MAX_MGMT = 11;
// +5% for employees of a company in the owner's own country, outside the Management cap.
export const HOME_PCT = 5;

export interface CanonicalCompanyItem {
  id: string;
  name: string;
  icon: string;
  img: string;
  type: 'raw' | 'product' | 'mfg';
  pp: number;
  raw: string | null;
  rawQty: number;
}

export const CANONICAL_COMPANY_ITEMS: CanonicalCompanyItem[] = [
  {
    id: 'grain',
    name: 'Grain',
    icon: '🌾',
    img: 'https://media.warera.io/images/items/grain.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'limestone',
    name: 'Limestone',
    icon: '🪨',
    img: 'https://media.warera.io/images/items/limestone.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'lead',
    name: 'Lead',
    icon: '🔩',
    img: 'https://media.warera.io/images/items/lead.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'petroleum',
    name: 'Petroleum',
    icon: '🛢️',
    img: 'https://media.warera.io/images/items/petroleum.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'coca',
    name: 'Coca',
    icon: '🌿',
    img: 'https://media.warera.io/images/items/coca.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'iron',
    name: 'Iron',
    icon: '⛏️',
    img: 'https://media.warera.io/images/items/iron.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'livestock',
    name: 'Livestock',
    icon: '🐄',
    img: 'https://media.warera.io/images/items/livestock.png?v=31',
    type: 'raw',
    pp: 20,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'fish',
    name: 'Fish',
    icon: '🐟',
    img: 'https://media.warera.io/images/items/fish.png?v=31',
    type: 'raw',
    pp: 40,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'wood',
    name: 'Wood',
    icon: '🌲',
    img: 'https://media.warera.io/images/items/wood.png?v=31',
    type: 'raw',
    pp: 1,
    raw: null,
    rawQty: 0,
  },
  {
    id: 'steel',
    name: 'Steel',
    icon: '🔧',
    img: 'https://media.warera.io/images/items/steel.png?v=31',
    type: 'product',
    pp: 10,
    raw: 'iron',
    rawQty: 10,
  },
  {
    id: 'concrete',
    name: 'Concrete',
    icon: '🏗️',
    img: 'https://media.warera.io/images/items/concrete.png?v=31',
    type: 'product',
    pp: 10,
    raw: 'limestone',
    rawQty: 10,
  },
  {
    id: 'oil',
    name: 'Oil',
    icon: '⚗️',
    img: 'https://media.warera.io/images/items/oil.png?v=31',
    type: 'product',
    pp: 1,
    raw: 'petroleum',
    rawQty: 1,
  },
  {
    id: 'bread',
    name: 'Bread',
    icon: '🍞',
    img: 'https://media.warera.io/images/items/bread.png?v=31',
    type: 'product',
    pp: 10,
    raw: 'grain',
    rawQty: 10,
  },
  {
    id: 'steak',
    name: 'Steak',
    icon: '🥩',
    img: 'https://media.warera.io/images/items/steak.png?v=31',
    type: 'product',
    pp: 20,
    raw: 'livestock',
    rawQty: 1,
  },
  {
    id: 'cookedFish',
    name: 'Cooked Fish',
    icon: '🍣',
    img: 'https://media.warera.io/images/items/cookedFish.png?v=31',
    type: 'product',
    pp: 40,
    raw: 'fish',
    rawQty: 1,
  },
  {
    id: 'lightAmmo',
    name: 'Light Ammo',
    icon: '🔫',
    img: 'https://media.warera.io/images/items/lightAmmo.png?v=31',
    type: 'product',
    pp: 1,
    raw: 'lead',
    rawQty: 1,
  },
  {
    id: 'ammo',
    name: 'Ammo',
    icon: '💥',
    img: 'https://media.warera.io/images/items/ammo.png?v=31',
    type: 'product',
    pp: 4,
    raw: 'lead',
    rawQty: 4,
  },
  {
    id: 'heavyAmmo',
    name: 'Heavy Ammo',
    icon: '🚀',
    img: 'https://media.warera.io/images/items/heavyAmmo.png?v=31',
    type: 'product',
    pp: 16,
    raw: 'lead',
    rawQty: 16,
  },
  {
    id: 'cocain',
    name: 'Cocaine',
    icon: '💊',
    img: 'https://media.warera.io/images/items/cocain.png?v=31',
    type: 'mfg',
    pp: 200,
    raw: 'coca',
    rawQty: 200,
  },
  {
    id: 'paper',
    name: 'Paper',
    icon: '📄',
    img: 'https://media.warera.io/images/items/paper.png?v=31',
    type: 'product',
    pp: 1,
    raw: 'wood',
    rawQty: 1,
  },
];

// A manager counts Management + 1 points, up to 11, for pay and bonus alike
export const managerPoints = (mgmt: number): number => Math.min(MAX_MGMT, Math.max(0, mgmt) + 1);
export const managerPct = (mgmt: number): number => Math.min(MANAGER_CAP_PCT, managerPoints(mgmt) * MGMT_PCT);

export const managerHourly = (m?: WareraCompanyManager | null): number => {
  if (!m) return 0;
  return m.hourlyWage ?? (m.rateManagement ?? 0) * managerPoints(m.managementLevel ?? 0);
};

export function formatSigned(n: number, decimals = 2): string {
  if (n == null || isNaN(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface NormalizedEmployeeRow {
  id: string;
  name: string;
  nationality?: string;
  age?: number;
  sex?: string;
  prod: number;
  prodBreakdown?: string;
  bonus: number;
  bonusDetail: string;
  bonusContributions: Array<{ source: string; percent: number }>;
  ptsH: number;
  wageH: number;
  happy: number | null;
  happyDetail?: string;
  quit: number;
  traits: string;
  traitCodes: string[];
  off?: boolean;
  sim?: 'added' | 'edited' | 'moved';
}

export interface DailyWorkBarPoint {
  date: string;
  engine: number;
  npc: number;
  self: number;
  wage: number;
  total: number;
}

export interface CompanySimulationOverrides {
  item?: string;
  engine?: number;
  emps?: NormalizedEmployeeRow[];
  simManager?: {
    managementLevel: number;
    rateManagement: number;
  } | null;
}

export interface AnalyzedCompanyRecord {
  cap: number;
  base: {
    item: string;
    engineLvl: number;
    enginePts: number;
    emps: NormalizedEmployeeRow[];
    logNpc: { npcPoints: number; wages: number } | null;
  };
  company: WareraCompany;
  item: CanonicalCompanyItem | undefined;
  pp: number;
  unitValue: number;
  rawCost: number;
  region: WareraRegionRecord | undefined;
  country: WareraCountry | undefined;
  home: boolean;
  history: DailyWorkBarPoint[];
  basis: string;
  emps: NormalizedEmployeeRow[];
  toolboxes: number;
  selfToday: number;
  points: number;
  npcPoints: number;
  selfPoints: number;
  wages: number;
  managerCost: number;
  selfValue: number;
  manager: WareraCompanyManager | null;
  offer: WareraCompanyManagerOffer | null;
  managerUser: WareraUserLite | null;
  units: number;
  price: number;
  rawPrice: number;
  rawNeeded: number;
  engineLvl: number;
  sentOut: number;
  receivedIn: number;
  value: number;
  net: number;
  noSupply?: boolean;
  ov?: CompanySimulationOverrides | null;
}

export interface BestProductOpportunity {
  item: CanonicalCompanyItem;
  pointValue: number; // BTC per 1 PP
  valuePer100Pts: number; // BTC per 100 PP
  dailyAtOutput: number; // BTC/day at player's total daily PP output
  sellPrice: number;
  rawCostPerUnit: number;
}

export interface LowTaxCountryOpportunity {
  country: WareraCountry;
  incomeTax: number;
  marketTax: number;
  managerTax: number;
  hasCompanyHere: boolean;
}

export interface PlayerCompanyAnalysisBundle {
  user: WareraUserLite;
  ownerMgmtPoints: number;
  ownerMgmtBonusPct: number;
  companies: AnalyzedCompanyRecord[];
  prices: Record<string, number>;
  ppValue: number;
  wageStats: { topOffer?: number; averageWage?: number; [key: string]: any } | null;
  countryById: Record<string, WareraCountry>;
  regionsById: Record<string, WareraRegionRecord>;
  authStatus: 'authenticated' | 'missing_key' | 'unauthorized';
  fetchedAt: string;
}

// Cached global reference dictionaries
let cachedPrices: Record<string, number> | null = null;
let cachedPricesTs = 0;
let cachedRegions: Record<string, WareraRegionRecord> | null = null;
let cachedPpValue: number | null = null;
let cachedWageStats: any = null;
const bundleCache: Record<string, PlayerCompanyAnalysisBundle> = {};

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calls a War Era tRPC procedure using rateLimitedFetch (which attaches X-API-Key if configured).
 * Supports both POST (JSON body) and GET (?input=...) so every procedure resolves reliably.
 */
async function callTrpcProcedure<T = any>(
  endpoint: string,
  body: Record<string, any> | null = {},
  options?: { allow404?: boolean; on401?: () => void }
): Promise<T | null> {
  try {
    if (body === null) {
      const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/${endpoint}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        options?.on401?.();
        return null;
      }
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      return (json?.result?.data ?? null) as T | null;
    }

    // Try POST first (matches arcana.warera.wiki/company)
    const postRes = await rateLimitedFetch(`${WARERA_TRPC_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (postRes.status === 401) {
      options?.on401?.();
      return null;
    }

    if (postRes.ok) {
      const json = await postRes.json().catch(() => null);
      if (json?.result !== undefined) {
        return (json.result.data ?? null) as T | null;
      }
    }

    // Fallback to GET with ?input= encoded query parameter if POST was method-not-allowed (405/400)
    if (postRes.status === 405 || postRes.status === 400) {
      const encoded = encodeURIComponent(JSON.stringify(body));
      const getRes = await rateLimitedFetch(`${WARERA_TRPC_BASE}/${endpoint}?input=${encoded}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (getRes.status === 401) {
        options?.on401?.();
        return null;
      }
      if (getRes.ok) {
        const json = await getRes.json().catch(() => null);
        return (json?.result?.data ?? null) as T | null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Batch fetches the same tRPC procedure for an array of input payloads.
 * Uses tRPC ?batch=1 first for high speed and falls back to individual calls if needed.
 */
async function batchTrpcByCompany<T = any>(
  endpoint: string,
  payloads: Array<Record<string, any>>,
  on401?: () => void
): Promise<Array<T | null>> {
  if (!payloads.length) return [];

  try {
    const batchPayload: Record<number, Record<string, any>> = {};
    payloads.forEach((p, idx) => {
      batchPayload[idx] = p;
    });
    const endpointList = Array(payloads.length).fill(endpoint).join(',');

    const batchRes = await rateLimitedFetch(`${WARERA_TRPC_BASE}/${endpointList}?batch=1`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchPayload),
    });

    if (batchRes.status === 401) {
      on401?.();
      return new Array(payloads.length).fill(null);
    }

    if (batchRes.ok) {
      const json = await batchRes.json().catch(() => null);
      if (Array.isArray(json)) {
        let saw401InBatch = false;
        const mapped = json.map((item: any) => {
          if (item?.error?.data?.httpStatus === 401 || item?.error?.data?.code === 'UNAUTHORIZED') {
            saw401InBatch = true;
            return null;
          }
          return (item?.result?.data ?? null) as T | null;
        });
        if (saw401InBatch) on401?.();
        return mapped;
      }
    }
  } catch {
    // Fallback to individual parallel calls below
  }

  return Promise.all(
    payloads.map((body) => callTrpcProcedure<T>(endpoint, body, { on401 }))
  );
}

/**
 * Search players by username via search.searchAnything + user.getUserLite
 */
export async function searchWareraPlayers(queryText: string): Promise<WareraUserLite[]> {
  const q = queryText.trim();
  if (!q) return [];

  const found = await callTrpcProcedure<{ userIds?: string[] }>('search.searchAnything', {
    searchText: q,
  });
  const ids = (found?.userIds || []).slice(0, 8);
  if (!ids.length) return [];

  const users = await batchTrpcByCompany<WareraUserLite>(
    'user.getUserLite',
    ids.map((userId) => ({ userId }))
  );
  return users.filter((u): u is WareraUserLite => Boolean(u && u._id));
}

/**
 * Normalize a single bot employee from employee.getCompanyRoster
 */
export function normalizeRosterEmployee(
  e: WareraRosterEmployeeRaw,
  index: number,
  companyId: string
): NormalizedEmployeeRow {
  const prod = e.breakdown?.production?.total ?? e.base?.production ?? 0;
  const prodBreakdown = (e.breakdown?.production?.contributions || [])
    .map((b) => `${b.source} ${formatSigned(b.value ?? b.amount ?? 0, 0)}`)
    .join(' · ');
  const bonus = e.productionBonus?.total || 0;
  const bonusContributions = e.productionBonus?.contributions || [];
  const bonusDetail = bonusContributions
    .map((b) => `${b.source} ${formatSigned(b.percent, 1)}%`)
    .join(' · ');
  const ptsH = e.estimate?.production || 0;
  const wageH = e.estimate?.wage ?? e.wage ?? 0;
  const happy = e.happinessBreakdown?.value ?? null;
  const happyDetail = (e.happinessBreakdown?.contributions || [])
    .map((b) => `${b.source} ${formatSigned(b.value ?? b.amount ?? 0, 0)}`)
    .join(' · ');
  const quit = e.happinessBreakdown?.quitChance || 0;

  const rawTraits = Array.isArray(e.traits) ? e.traits : [];
  const traitCodes = rawTraits
    .filter((t) => (typeof t === 'string' ? true : t?.revealed !== false))
    .map((t) => (typeof t === 'string' ? t : t?.code || t?.name || ''))
    .filter(Boolean);

  return {
    id: String(e._id || e.id || `${companyId}-emp-${index}`),
    name: e.name || `Employee #${index + 1}`,
    nationality: e.nationality || e.country || undefined,
    age: e.age,
    sex: e.sex || e.gender,
    prod,
    prodBreakdown: prodBreakdown || undefined,
    bonus,
    bonusDetail,
    bonusContributions,
    ptsH,
    wageH,
    happy,
    happyDetail: happyDetail || undefined,
    quit,
    traits: traitCodes.join(', '),
    traitCodes,
  };
}

/**
 * Value of 1 production point of an item at live market prices, net of raw materials bought on the market.
 */
export function calculatePointValue(
  itemCode: string,
  prices: Record<string, number>
): number | null {
  const it = CANONICAL_COMPANY_ITEMS.find((x) => x.id === itemCode);
  if (!it || prices[itemCode] == null) return null;
  const raw = it.raw ? (it.rawQty || 0) * (prices[it.raw] || 0) : 0;
  return (prices[itemCode] - raw) / (it.pp || 1);
}

/**
 * Rank the Best Products Right Now based on live market value per 100 production points.
 */
export function getBestProductOpportunities(
  prices: Record<string, number>,
  totalDailyPoints = 0,
  limit = 6
): BestProductOpportunity[] {
  const ranked = CANONICAL_COMPANY_ITEMS.map((item) => {
    const pv = calculatePointValue(item.id, prices);
    if (pv == null) return null;
    const sellPrice = prices[item.id] || 0;
    const rawCostPerUnit = item.raw ? (item.rawQty || 0) * (prices[item.raw] || 0) : 0;
    return {
      item,
      pointValue: pv,
      valuePer100Pts: pv * 100,
      dailyAtOutput: pv * totalDailyPoints,
      sellPrice,
      rawCostPerUnit,
    };
  }).filter((x): x is BestProductOpportunity => x !== null);

  ranked.sort((a, b) => b.pointValue - a.pointValue);
  return ranked.slice(0, limit);
}

/**
 * Rank the Lowest-Tax Countries sorted by income tax, then market tax.
 */
export function getLowestTaxCountries(
  countryById: Record<string, WareraCountry>,
  companies: AnalyzedCompanyRecord[],
  limit = 8
): LowTaxCountryOpportunity[] {
  const here = new Set(companies.map((c) => c.country?._id).filter(Boolean));
  const all = Object.values(countryById).filter((c) => c?.taxes?.income != null);

  all.sort(
    (a, b) =>
      (a.taxes?.income ?? 0) - (b.taxes?.income ?? 0) ||
      (a.taxes?.market ?? 0) - (b.taxes?.market ?? 0)
  );

  return all.slice(0, limit).map((country) => ({
    country,
    incomeTax: Number(country.taxes?.income ?? 0),
    marketTax: Number(country.taxes?.market ?? 0),
    managerTax: Number((country.taxes as any)?.manager ?? country.taxes?.income ?? 0),
    hasCompanyHere: here.has(country._id),
  }));
}

/**
 * Analyse a single company's telemetry (matching company-analysis-2.js `analyse`)
 */
export function analyseCompanyRecord(params: {
  company: WareraCompany;
  stats: WareraWorkDailyStat[] | null;
  manager: WareraCompanyManager | null;
  offer: WareraCompanyManagerOffer | null;
  roster: WareraCompanyRosterResponse | null;
  managerUser: WareraUserLite | null;
  prices: Record<string, number>;
  regions: Record<string, WareraRegionRecord>;
  countryById: Record<string, WareraCountry>;
  ownerCountryId?: string;
}): AnalyzedCompanyRecord {
  const {
    company,
    stats,
    manager,
    offer,
    roster,
    managerUser,
    prices,
    regions,
    countryById,
    ownerCountryId,
  } = params;

  const item = CANONICAL_COMPANY_ITEMS.find((it) => it.id === company.itemCode);
  const pp = item?.pp || 1;
  const rawCost = item?.raw ? (item.rawQty || 0) * (prices[item.raw] || 0) : 0;
  const unitValue = (prices[company.itemCode] || 0) - rawCost;
  const region = company.region ? regions?.[company.region] : undefined;
  const country = region?.country ? countryById[region.country] : undefined;
  const today = utcToday();

  const days: DailyWorkBarPoint[] = (stats || [])
    .map((d) => ({
      date: d.dailyDate,
      engine: d.automatedEngine || 0,
      npc: (d.employeeProd || 0) + (d.workerProd || 0),
      self: d.selfWork || 0,
      wage: d.wage || 0,
      total: d.total || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const history = days.slice(-HISTORY_DAYS);

  // Basis: full days since v0.27 only. Until one exists, everything since the launch scaled to 24 h.
  const complete = days
    .filter((d) => d.date > V027_DAY && d.date < today && d.total > 0)
    .slice(-AVG_DAYS);

  let basis = '';
  let points = 0;
  let npcPoints = 0;
  let selfPoints = 0;
  let wages = 0;

  const hourly = manager && !manager.isInactive ? managerHourly(manager) : 0;
  const managerCost = hourly * 24;

  if (complete.length) {
    const avg = (k: keyof DailyWorkBarPoint) =>
      complete.reduce((s, d) => s + Number(d[k] || 0), 0) / complete.length;
    basis = `average of the last ${complete.length} full day${complete.length > 1 ? 's' : ''} under v0.27`;
    points = avg('total');
    npcPoints = avg('npc');
    selfPoints = avg('self');
    wages = avg('wage');
  } else {
    const since = days.filter((d) => d.date >= V027_DAY);
    const hours = Math.max(1, (Date.now() - V027_START) / 3.6e6);
    const dayHours = Math.max(1, (Date.now() - Date.parse(V027_DAY + 'T00:00:00Z')) / 3.6e6);
    const scaled = (k: keyof DailyWorkBarPoint, h: number) =>
      (since.reduce((s, d) => s + Number(d[k] || 0), 0) / h) * 24;
    const upEngine = company.activeUpgradeLevels?.automatedEngine || 0;
    basis = since.length
      ? `${Math.round(hours)} h since the v0.27 launch, scaled to a day`
      : upEngine > 0
      ? `engine level ${upEngine} (${upEngine * 24} pts/day)`
      : 'no work recorded yet';
    npcPoints = since.length ? scaled('npc', hours) : 0;
    selfPoints = since.length ? scaled('self', dayHours) : 0;
    wages = since.length ? scaled('wage', hours) : 0;
    points = since.length
      ? npcPoints + selfPoints + scaled('engine', dayHours)
      : upEngine * 24;
  }

  // Self-work costs the owner energy they usually spend on hiring and traits, so it is never projected into output or profit.
  points -= selfPoints;
  const selfToday = days.find((d) => d.date === today)?.self || 0;

  const rawEmps = roster?.employees || [];
  const emps = rawEmps.map((e, idx) => normalizeRosterEmployee(e, idx, company._id));
  const toolboxes = (roster?.hourly?.toolboxes || 0) * 24;

  if (roster?.hourly) {
    const rosterPts = (roster.hourly.production || 0) * 24;
    points += rosterPts - npcPoints;
    npcPoints = rosterPts;
    wages = (roster.hourly.wageCost || 0) * 24;
    basis = `the game's estimate for the ${emps.length} current employee${
      emps.length === 1 ? '' : 's'
    }; engine from the ${basis}`;
  }

  const units = points / pp;
  const price = prices[company.itemCode] || 0;
  const rawPrice = item?.raw ? prices[item.raw] || 0 : 0;
  const up = company.activeUpgradeLevels || {};
  const home = Boolean(ownerCountryId && region?.country === ownerCountryId);

  return {
    cap: roster?.hourly?.cap ?? Math.min(up.breakRoom || 1, 3),
    base: {
      item: company.itemCode,
      engineLvl: up.automatedEngine || 0,
      enginePts: Math.max(0, points - npcPoints),
      emps: emps.map((e) => ({ ...e })),
      logNpc: roster?.hourly ? null : { npcPoints, wages },
    },
    company,
    item,
    pp,
    unitValue,
    rawCost,
    region,
    country,
    home,
    history,
    basis,
    emps,
    toolboxes,
    selfToday,
    points,
    npcPoints,
    selfPoints,
    wages,
    managerCost,
    selfValue: (selfToday / pp) * unitValue,
    manager,
    offer,
    managerUser,
    units,
    price,
    rawPrice,
    rawNeeded: item?.raw ? units * (item.rawQty || 0) : 0,
    engineLvl: up.automatedEngine || 0,
    sentOut: 0,
    receivedIn: 0,
    value: 0,
    net: 0,
    noSupply: false,
    ov: null,
  };
}

/**
 * Recompute a single company record with any active simulation overrides (`c.ov`)
 */
export function computeCompanyWithSimulations(
  c: AnalyzedCompanyRecord,
  prices: Record<string, number>
): void {
  const b = c.base;
  const ov = c.ov || {};
  const item = CANONICAL_COMPANY_ITEMS.find((it) => it.id === (ov.item || b.item));
  const pp = item?.pp || 1;
  const price = (item ? prices[item.id] : 0) || 0;
  const rawPrice = item?.raw ? prices[item.raw] || 0 : 0;
  const rawCost = item?.raw ? (item.rawQty || 0) * rawPrice : 0;
  const emps = ov.emps || b.emps;
  const working = emps.filter((e) => !e.off);
  const fromLog = !ov.emps && b.logNpc;

  c.item = item;
  c.pp = pp;
  c.price = price;
  c.rawPrice = rawPrice;
  c.rawCost = rawCost;
  c.emps = emps;
  c.unitValue = price - rawCost;
  c.engineLvl = ov.engine ?? b.engineLvl;
  c.npcPoints = fromLog
    ? b.logNpc!.npcPoints
    : working.reduce((s, e) => s + e.ptsH, 0) * 24;
  c.wages = fromLog
    ? b.logNpc!.wages
    : working.reduce((s, e) => s + e.wageH, 0) * 24;

  c.points = (ov.engine != null ? ov.engine * 24 : b.enginePts) + c.npcPoints;
  c.units = c.points / pp;
  c.rawNeeded = item?.raw ? c.units * (item.rawQty || 0) : 0;
  c.selfValue = (c.selfToday / pp) * c.unitValue;
}

/**
 * Raw goods a player produces feed their own factories first: those units are not sold,
 * and the factory does not buy them. Everything else is valued at market price.
 */
export function applyPortfolioSupplyTransfers(
  list: AnalyzedCompanyRecord[],
  prices: Record<string, number>
): AnalyzedCompanyRecord[] {
  const cloned = list.map((c) => ({
    ...c,
    emps: c.emps.map((e) => ({ ...e })),
    ov: c.ov
      ? {
          ...c.ov,
          emps: c.ov.emps ? c.ov.emps.map((e) => ({ ...e })) : undefined,
        }
      : null,
  }));

  cloned.forEach((c) => computeCompanyWithSimulations(c, prices));

  const pool: Record<string, AnalyzedCompanyRecord[]> = {};
  for (const c of cloned) {
    c.sentOut = 0;
    c.receivedIn = 0;
    const activeItemCode = c.item?.id || c.company.itemCode;
    if (c.item?.type === 'raw' && c.units > 0 && !c.noSupply) {
      (pool[activeItemCode] ??= []).push(c);
    }
  }

  for (const c of cloned) {
    let need = c.rawNeeded;
    const rawCode = c.item?.raw;
    if (!rawCode) continue;
    for (const src of pool[rawCode] || []) {
      if (need <= 0) break;
      const take = Math.min(need, src.units - src.sentOut);
      if (take <= 0) continue;
      src.sentOut += take;
      c.receivedIn += take;
      need -= take;
    }
  }

  for (const c of cloned) {
    const boughtRaw = Math.max(0, c.rawNeeded - c.receivedIn);
    c.value = (c.units - c.sentOut) * c.price - boughtRaw * c.rawPrice;
    c.net = c.value - c.wages - c.managerCost;
  }

  return cloned;
}

/**
 * Diagnostic status tags for a company card
 */
export function getCompanyDiagnosticTags(
  c: AnalyzedCompanyRecord
): Array<{ tone: 'warn' | 'bad' | 'info'; label: string; tip: string }> {
  const t: Array<{ tone: 'warn' | 'bad' | 'info'; label: string; tip: string }> = [];
  if (c.points === 0) {
    t.push({ tone: 'warn', label: 'Idle', tip: 'No output in this period.' });
  } else if (c.net < 0) {
    t.push({
      tone: 'bad',
      label: 'Losing money',
      tip: 'Costs exceed the value of the output.',
    });
  }
  if (c.item?.raw && c.unitValue <= 0) {
    t.push({
      tone: 'bad',
      label: 'Raw costs more',
      tip: `Buying the raw materials costs more than the ${c.item.name} sells for.`,
    });
  }
  if (c.company.isFull) {
    t.push({
      tone: 'warn',
      label: 'Storage full',
      tip: 'Empty the storage so new output has room.',
    });
  }
  if (c.manager?.isInactive) {
    t.push({
      tone: 'warn',
      label: 'Manager inactive',
      tip: 'The manager is not active, so the bonus may not apply.',
    });
  }
  if (!c.manager && c.npcPoints > 0) {
    t.push({
      tone: 'info',
      label: 'No manager',
      tip: 'A manager would add a bonus to every employee.',
    });
  }
  const incTax = Number(c.country?.taxes?.income ?? 0);
  if (incTax >= 20 && c.country) {
    t.push({
      tone: 'warn',
      label: 'High income tax',
      tip: `${c.country.name} taxes income at ${incTax}%: employees lose 1 happiness per 1%, so −${incTax}% output here.`,
    });
  }
  if (c.sentOut > 0) {
    t.push({
      tone: 'info',
      label: 'Feeds own factory',
      tip: `${formatNum(c.sentOut, 1)} units/day go to the player's own factories.`,
    });
  }
  if (c.receivedIn > 0) {
    t.push({
      tone: 'info',
      label: 'Own raw supply',
      tip: `${formatNum(c.receivedIn, 1)} raw units/day come from the player's own companies.`,
    });
  }
  return t;
}

/**
 * Helper to compute simulated employee stats when Production or Bonus % is edited or hired
 */
export function buildSimulatedEmployeeWithStats(
  e: NormalizedEmployeeRow,
  prod: number,
  bonus: number,
  ppValue: number
): NormalizedEmployeeRow {
  const ptsH = prod * PTS_PER_LEVEL_HOUR * (1 + bonus / 100);
  const wageH =
    e.prod > 0
      ? (e.wageH / e.prod) * prod
      : prod * PTS_PER_LEVEL_HOUR * (ppValue || 0.0971);
  return {
    ...e,
    prod,
    bonus,
    ptsH,
    wageH,
    sim: e.sim || 'edited',
  };
}

/**
 * Calculate the default hire bonus for a new employee in a company
 */
export function getCompanyHireBonus(
  c: AnalyzedCompanyRecord,
  ownerMgmtPoints: number
): number {
  const mgrBonus =
    c.manager && !c.manager.isInactive
      ? managerPct(c.manager.managementLevel ?? 0)
      : 0;
  return (
    Math.min(MGMT_CAP_PCT, ownerMgmtPoints * MGMT_PCT + mgrBonus) +
    (c.home ? HOME_PCT : 0)
  );
}

/**
 * Fetch the complete live Company Analysis Bundle for a player (by userId or WareraUserLite)
 */
export async function fetchPlayerCompanyAnalysisBundle(
  userOrId: string | WareraUserLite,
  forceRefresh = false
): Promise<PlayerCompanyAnalysisBundle | null> {
  const targetUserId = typeof userOrId === 'string' ? userOrId : userOrId._id;
  if (!targetUserId) return null;

  if (!forceRefresh && bundleCache[targetUserId]) {
    return bundleCache[targetUserId];
  }

  const hasApiKey = Boolean(storage.getApiKey()?.trim());
  let saw401 = false;
  const mark401 = () => {
    saw401 = true;
  };

  // Resolve user profile if only ID or incomplete user was passed
  let user: WareraUserLite | null =
    typeof userOrId === 'object' && userOrId.skills?.management !== undefined
      ? userOrId
      : null;

  const now = Date.now();
  const shouldRefreshPrices = !cachedPrices || now - cachedPricesTs > 120_000 || forceRefresh;

  const [pricesRes, countriesRes, regionsRes, companiesListRes, ppRes, fetchedUser, wageStatsRes] =
    await Promise.all([
      shouldRefreshPrices
        ? callTrpcProcedure<Record<string, number>>('itemTrading.getPrices', null)
        : Promise.resolve(cachedPrices),
      getCountries().catch(() => [] as WareraCountry[]),
      cachedRegions
        ? Promise.resolve(cachedRegions)
        : callTrpcProcedure<Record<string, WareraRegionRecord>>('region.getRegionsObject', null),
      callTrpcProcedure<{ items?: string[]; nextCursor?: string }>('company.getCompanies', {
        userId: targetUserId,
        perPage: 20,
      }),
      cachedPpValue != null && !forceRefresh
        ? Promise.resolve(cachedPpValue)
        : callTrpcProcedure<number>('gameStat.getPpMoneyValue', null),
      user
        ? Promise.resolve(user)
        : callTrpcProcedure<WareraUserLite>('user.getUserLite', { userId: targetUserId }),
      cachedWageStats && !forceRefresh
        ? Promise.resolve(cachedWageStats)
        : callTrpcProcedure<any>('managerOffer.getWageStats', {}),
    ]);

  if (pricesRes && Object.keys(pricesRes).length > 0) {
    cachedPrices = pricesRes;
    cachedPricesTs = now;
  }
  if (regionsRes && Object.keys(regionsRes).length > 0) {
    cachedRegions = regionsRes;
  }
  if (ppRes != null && +ppRes > 0) {
    cachedPpValue = +ppRes;
  }
  if (wageStatsRes) {
    cachedWageStats = wageStatsRes;
  }

  const effectiveUser: WareraUserLite = fetchedUser ||
    (typeof userOrId === 'object' ? userOrId : { _id: targetUserId, username: `Citizen #${targetUserId.slice(-6)}` });

  const prices = cachedPrices || {};
  const regions = cachedRegions || {};
  const ppValue = cachedPpValue || 0.0971;
  const countryById: Record<string, WareraCountry> = {};
  (countriesRes || []).forEach((c) => {
    if (c && c._id) countryById[c._id] = c;
  });

  const companyIds: string[] = companiesListRes?.items || [];
  const m = effectiveUser.skills?.management;
  const ownerMgmtPoints =
    m?.value ?? (m?.level != null ? managerPoints(m.level) : 1);
  const ownerMgmtBonusPct = ownerMgmtPoints * MGMT_PCT;

  const ownerCountryId =
    typeof effectiveUser.country === 'string'
      ? effectiveUser.country
      : effectiveUser.countryId || (effectiveUser.country as any)?._id;

  if (companyIds.length === 0) {
    const emptyBundle: PlayerCompanyAnalysisBundle = {
      user: effectiveUser,
      ownerMgmtPoints,
      ownerMgmtBonusPct,
      companies: [],
      prices,
      ppValue,
      wageStats: cachedWageStats || null,
      countryById,
      regionsById: regions,
      authStatus: !hasApiKey ? 'missing_key' : saw401 ? 'unauthorized' : 'authenticated',
      fetchedAt: new Date().toISOString(),
    };
    bundleCache[targetUserId] = emptyBundle;
    return emptyBundle;
  }

  const companyPayloads = companyIds.map((companyId) => ({ companyId }));

  // Fetch all 5 company telemetry endpoints in parallel batches
  const [companiesRaw, statsRaw, managersRaw, offersRaw, rostersRaw] = await Promise.all([
    batchTrpcByCompany<WareraCompany>('company.getById', companyPayloads),
    batchTrpcByCompany<WareraWorkDailyStat[]>('work.getStatsByCompany', companyPayloads, mark401),
    batchTrpcByCompany<WareraCompanyManager>('manager.getByCompanyId', companyPayloads),
    batchTrpcByCompany<WareraCompanyManagerOffer>('managerOffer.getByCompanyId', companyPayloads),
    batchTrpcByCompany<WareraCompanyRosterResponse>(
      'employee.getCompanyRoster',
      companyPayloads,
      mark401
    ),
  ]);

  // Resolve active manager usernames via user.getUserLite
  const managerUserIds = Array.from(
    new Set(managersRaw.map((mgr) => mgr?.user).filter((id): id is string => Boolean(id)))
  );
  const managerUsersArr = managerUserIds.length
    ? await batchTrpcByCompany<WareraUserLite>(
        'user.getUserLite',
        managerUserIds.map((userId) => ({ userId }))
      )
    : [];
  const managerUserById: Record<string, WareraUserLite> = {};
  managerUserIds.forEach((id, idx) => {
    if (managerUsersArr[idx]) {
      managerUserById[id] = managerUsersArr[idx]!;
    }
  });

  const rawAnalyzed: AnalyzedCompanyRecord[] = [];
  companyIds.forEach((_, i) => {
    const comp = companiesRaw[i];
    if (!comp || comp.disabledAt) return;
    const stats = statsRaw[i];
    const manager = managersRaw[i];
    const offer = offersRaw[i];
    const roster = rostersRaw[i];
    const managerUser = manager?.user ? managerUserById[manager.user] || null : null;

    rawAnalyzed.push(
      analyseCompanyRecord({
        company: comp,
        stats,
        manager,
        offer,
        roster,
        managerUser,
        prices,
        regions,
        countryById,
        ownerCountryId,
      })
    );
  });

  const finalizedCompanies = applyPortfolioSupplyTransfers(rawAnalyzed, prices);

  const bundle: PlayerCompanyAnalysisBundle = {
    user: effectiveUser,
    ownerMgmtPoints,
    ownerMgmtBonusPct,
    companies: finalizedCompanies,
    prices,
    ppValue,
    wageStats: cachedWageStats || null,
    countryById,
    regionsById: regions,
    authStatus: !hasApiKey ? 'missing_key' : saw401 ? 'unauthorized' : 'authenticated',
    fetchedAt: new Date().toISOString(),
  };

  bundleCache[targetUserId] = bundle;
  return bundle;
}
