/**
 * Official War Era Market Intelligence Engine.
 * Direct integration with War Era upstream production endpoints:
 * - itemTrading.getItemTrading (30-day historical daily volume and price averages)
 * - tradingOrder.getTopOrders (active live order book, bids, asks, and spreads)
 */
import { rateLimitedFetch } from './apiService';
import { CommodityTrend, CommoditySector, MarketAdvisory, ResourceReserveItem } from '../types/ministry';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const WARERA_TRPC_BASE = 'https://api2.warera.io/trpc';

export interface CanonicalCommodityMeta {
  itemCode: string;
  name: string;
  code: string;
  sector: CommoditySector;
  unit: string;
  description: string;
}

export const CANONICAL_24_COMMODITIES: CanonicalCommodityMeta[] = [
  // Cases
  { itemCode: 'case2', name: 'Elite Case', code: 'E-CASE', sector: 'cases', unit: 'cases', description: 'Rare high-yield military equipment case' },
  { itemCode: 'case1', name: 'Case', code: 'CASE', sector: 'cases', unit: 'cases', description: 'Standard combat supply case' },
  { itemCode: 'woodenCase', name: 'Wooden Case', code: 'W-CASE', sector: 'cases', unit: 'cases', description: 'Basic field wooden crate' },
  // Craft
  { itemCode: 'scraps', name: 'Scraps', code: 'SCRAPS', sector: 'craft', unit: 'pcs', description: 'Salvaged industrial metallic scraps' },
  // Buffs
  { itemCode: 'cocain', name: 'Pill', code: 'PILL', sector: 'buffs', unit: 'pills', description: 'High-potency pharmaceutical stimulant' },
  { itemCode: 'coca', name: 'Mysterious Plant', code: 'PLANT', sector: 'buffs', unit: 'leaves', description: 'Raw botanical leaves for chemical processing' },
  // Ammo
  { itemCode: 'heavyAmmo', name: 'Heavy Ammo', code: 'HAMMO', sector: 'ammo', unit: 'rounds', description: 'High-caliber heavy artillery and armor-piercing munitions' },
  { itemCode: 'ammo', name: 'Ammo', code: 'AMMO', sector: 'ammo', unit: 'rounds', description: 'Standard infantry rifle ammunition' },
  { itemCode: 'lightAmmo', name: 'Light Ammo', code: 'LAMMO', sector: 'ammo', unit: 'rounds', description: 'Submachine and sidearm lightweight cartridges' },
  { itemCode: 'lead', name: 'Lead', code: 'LEAD', sector: 'ammo', unit: 'ingots', description: 'Heavy ballistic metal for bullet casting' },
  // Food
  { itemCode: 'cookedFish', name: 'Cooked Fish', code: 'CFISH', sector: 'food', unit: 'fillets', description: 'Nutrient-rich prepared marine ration' },
  { itemCode: 'steak', name: 'Steak', code: 'STEAK', sector: 'food', unit: 'steaks', description: 'High-protein prime beef meal' },
  { itemCode: 'bread', name: 'Bread', code: 'BREAD', sector: 'food', unit: 'loaves', description: 'Staple grain bread loaf for energy regeneration' },
  { itemCode: 'fish', name: 'Fish', code: 'FISH', sector: 'food', unit: 'fish', description: 'Raw coastal fishery catch' },
  { itemCode: 'livestock', name: 'Livestock', code: 'COW', sector: 'food', unit: 'heads', description: 'Domesticated cattle for meat and dairy' },
  { itemCode: 'grain', name: 'Grain', code: 'GRAIN', sector: 'food', unit: 'bushels', description: 'Agricultural staple wheat and grain reserves' },
  // Construction
  { itemCode: 'concrete', name: 'Concrete', code: 'CONC', sector: 'construction', unit: 'blocks', description: 'Reinforced concrete for military bunker building' },
  { itemCode: 'limestone', name: 'Limestone', code: 'LIME', sector: 'construction', unit: 'stones', description: 'Quarried mineral rock for cement synthesis' },
  { itemCode: 'steel', name: 'Steel', code: 'STEEL', sector: 'construction', unit: 'beams', description: 'Refined structural alloy for heavy industry' },
  { itemCode: 'iron', name: 'Iron', code: 'IRON', sector: 'construction', unit: 'bars', description: 'Basic smelting ore and smelted iron bars' },
  // Strategic (Paper, Wood, Oil, Petroleum)
  { itemCode: 'paper', name: 'Paper', code: 'PAPER', sector: 'strategic', unit: 'reams', description: 'Bureaucracy paper for government laws and contracts' },
  { itemCode: 'wood', name: 'Wood', code: 'WOOD', sector: 'strategic', unit: 'logs', description: 'Harvested forestry timber for manufacturing' },
  { itemCode: 'oil', name: 'Oil', code: 'OIL', sector: 'strategic', unit: 'barrels', description: 'Refined fuel oil for industrial machinery' },
  { itemCode: 'petroleum', name: 'Petroleum', code: 'PETRO', sector: 'strategic', unit: 'barrels', description: 'Crude petroleum fossil fuel for sovereign energy' },
];

export const COMMODITY_BY_CODE = new Map<string, CanonicalCommodityMeta>(
  CANONICAL_24_COMMODITIES.map((c) => [c.itemCode, c])
);

// In-memory cache with 4-minute validity
let cachedMarketTrends: CommodityTrend[] | null = null;
let lastMarketFetchTime = 0;
const MARKET_CACHE_TTL_MS = 4 * 60 * 1000;

/**
 * Fetch official market quotes & 7-day statistical trend for a single commodity from War Era upstream
 */
export async function fetchSingleCommodityMarket(itemMeta: CanonicalCommodityMeta): Promise<CommodityTrend> {
  const encoded = encodeURIComponent(JSON.stringify({ itemCode: itemMeta.itemCode }));

  let avg7d = 0;
  let min7d = 0;
  let max7d = 0;
  let stdDev = 0;
  let volume24h = 0;
  let recentPrices: number[] = [];
  let historyPoints: Array<{ date: string; price: number; volume: number }> = [];

  // 1. Fetch official 30-day historical data
  try {
    const res = await rateLimitedFetch(`${WARERA_TRPC_BASE}/itemTrading.getItemTrading?input=${encoded}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      const rawValues: Array<{
        valueAt: string;
        avgValue: number;
        totalValue: number;
        totalQuantity: number;
      }> = json?.result?.data?.values || [];

      if (rawValues.length > 0) {
        // Collect historical points for charting
        historyPoints = rawValues.map((v) => ({
          date: v.valueAt ? formatDateDDMMYYYY(v.valueAt) : 'Day',
          price: Number(v.avgValue || 0),
          volume: Number(v.totalQuantity || 0),
        }));

        // Take past 7 recorded days
        const last7 = rawValues.slice(-7);
        recentPrices = last7.map((v) => Number(v.avgValue || 0)).filter((p) => p > 0);
        if (recentPrices.length > 0) {
          const sum = recentPrices.reduce((a, b) => a + b, 0);
          avg7d = sum / recentPrices.length;
          min7d = Math.min(...recentPrices);
          max7d = Math.max(...recentPrices);

          // Standard deviation
          const variance =
            recentPrices.reduce((acc, p) => acc + Math.pow(p - avg7d, 2), 0) / recentPrices.length;
          stdDev = Math.sqrt(variance);
        }

        // 24h volume from most recent daily point
        const latest = rawValues[rawValues.length - 1];
        if (latest) {
          volume24h = Number(latest.totalQuantity || 0);
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch historical trading data for ${itemMeta.itemCode}:`, err);
  }

  // 2. Fetch live order book (Top bids & asks)
  let lowestAsk = 0;
  let highestBid = 0;
  let topBuys: Array<{ price: number; qty: number }> = [];
  let topSells: Array<{ price: number; qty: number }> = [];

  try {
    const ordersRes = await rateLimitedFetch(`${WARERA_TRPC_BASE}/tradingOrder.getTopOrders?input=${encoded}`, {
      headers: { Accept: 'application/json' },
    });
    if (ordersRes.ok) {
      const ordersJson = await ordersRes.json();
      const rawBuys: Array<{ price: number; quantity: number }> = ordersJson?.result?.data?.buyOrders || [];
      const rawSells: Array<{ price: number; quantity: number }> = ordersJson?.result?.data?.sellOrders || [];

      topBuys = rawBuys.slice(0, 5).map((o) => ({ price: Number(o.price), qty: Number(o.quantity) }));
      topSells = rawSells.slice(0, 5).map((o) => ({ price: Number(o.price), qty: Number(o.quantity) }));

      if (topBuys.length > 0) {
        highestBid = Math.max(...topBuys.map((b) => b.price));
      }
      if (topSells.length > 0) {
        lowestAsk = Math.min(...topSells.map((s) => s.price));
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch live order book for ${itemMeta.itemCode}:`, err);
  }

  // Derive current effective price: prioritize lowest active sell ask (instant buy), then highest bid, then 7d avg
  const currentPrice = lowestAsk > 0 ? lowestAsk : highestBid > 0 ? highestBid : avg7d > 0 ? avg7d : 0.1;
  if (avg7d === 0) avg7d = currentPrice;
  if (min7d === 0) min7d = currentPrice * 0.9;
  if (max7d === 0) max7d = currentPrice * 1.1;

  // Spread calculation
  let spreadPct = 0;
  if (lowestAsk > 0 && highestBid > 0) {
    const mid = (lowestAsk + highestBid) / 2;
    spreadPct = ((lowestAsk - highestBid) / mid) * 100;
  }

  // Z-Score and percentage deviation calculation
  const effectiveStdDev = stdDev > 0 ? stdDev : avg7d * 0.05;
  const zScore = (currentPrice - avg7d) / effectiveStdDev;
  const pctDev = avg7d > 0 ? ((currentPrice - avg7d) / avg7d) * 100 : 0;
  const change24h = pctDev;

  // Statistical trading advisory calculation based on Z-score
  let advisory: MarketAdvisory = 'hold';
  let advisoryReason = '';

  if (zScore > 2.0) {
    advisory = 'strong-sell';
    advisoryReason = `Price spiked +${pctDev.toFixed(1)}% above 7D baseline (Z: +${zScore.toFixed(2)}). Optimal window to liquidate state reserves for maximum BTC profit.`;
  } else if (zScore > 1.0) {
    advisory = 'sell';
    advisoryReason = `Trading +${pctDev.toFixed(1)}% above weekly equilibrium. Favorable price to sell surplus stock.`;
  } else if (zScore < -2.0) {
    advisory = 'strong-buy';
    advisoryReason = `Severe discount: price dropped ${pctDev.toFixed(1)}% below 7D average (Z: ${zScore.toFixed(2)}). High-priority accumulation opportunity for state reserves.`;
  } else if (zScore < -1.0) {
    advisory = 'buy';
    advisoryReason = `Underpriced by ${Math.abs(pctDev).toFixed(1)}% vs weekly average. Good entry point to replenish reserves.`;
  } else {
    advisory = 'hold';
    advisoryReason = `Stable price structure within normal 7D range (${pctDev >= 0 ? '+' : ''}${pctDev.toFixed(1)}% vs avg). Hold current stockpile.`;
  }

  return {
    id: itemMeta.itemCode,
    name: itemMeta.name,
    category: itemMeta.sector,
    sector: itemMeta.sector,
    unit: itemMeta.unit,
    currentPrice,
    change24h,
    avg7d,
    min7d,
    max7d,
    stdDev,
    zScore,
    pctDev,
    spreadPct,
    highestBid,
    lowestAsk,
    volume24h,
    advisory,
    advisoryReason,
    topBuys,
    topSells,
    historyPoints,
  };
}

/**
 * Fetch all 24 canonical commodity quotes concurrently with caching
 */
export async function fetchAllCommoditiesMarket(forceRefresh = false): Promise<CommodityTrend[]> {
  const now = Date.now();
  if (!forceRefresh && cachedMarketTrends && now - lastMarketFetchTime < MARKET_CACHE_TTL_MS) {
    return cachedMarketTrends;
  }

  try {
    // Fetch in parallel chunks of 6 to respect rate limiter
    const results: CommodityTrend[] = [];
    const chunkSize = 6;
    for (let i = 0; i < CANONICAL_24_COMMODITIES.length; i += chunkSize) {
      const chunk = CANONICAL_24_COMMODITIES.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((item) => fetchSingleCommodityMarket(item)));
      results.push(...chunkResults);
    }

    cachedMarketTrends = results;
    lastMarketFetchTime = now;
    return results;
  } catch (err) {
    console.warn('Failed to batch fetch commodity market quotes:', err);
    return cachedMarketTrends || generateFallbackMarketTrends();
  }
}

/**
 * Returns the latest live-fetched market trends if cached in memory, or fallback baseline if not yet loaded
 */
export function getCachedOrFallbackMarketTrends(): CommodityTrend[] {
  return cachedMarketTrends && cachedMarketTrends.length > 0
    ? cachedMarketTrends
    : generateFallbackMarketTrends();
}

/**
 * Generate fallback baseline for the 24 canonical commodities if network is completely unavailable
 */
export function generateFallbackMarketTrends(): CommodityTrend[] {
  return CANONICAL_24_COMMODITIES.map((meta) => {
    let price = 1.0;
    if (meta.itemCode === 'petroleum') price = 0.106;
    else if (meta.itemCode === 'paper') price = 0.212;
    else if (meta.itemCode === 'cocain') price = 42.7;
    else if (meta.itemCode === 'coca') price = 0.08;
    else if (meta.itemCode === 'lead') price = 0.098;
    else if (meta.itemCode === 'ammo') price = 0.82;
    else if (meta.itemCode === 'lightAmmo') price = 0.2;
    else if (meta.itemCode === 'heavyAmmo') price = 3.32;
    else if (meta.itemCode === 'bread') price = 1.99;
    else if (meta.itemCode === 'steak') price = 4.03;
    else if (meta.itemCode === 'cookedFish') price = 8.75;
    else if (meta.itemCode === 'fish') price = 3.85;
    else if (meta.itemCode === 'livestock') price = 1.57;
    else if (meta.itemCode === 'grain') price = 0.08;
    else if (meta.itemCode === 'concrete') price = 1.82;
    else if (meta.itemCode === 'limestone') price = 0.091;
    else if (meta.itemCode === 'steel') price = 1.84;
    else if (meta.itemCode === 'iron') price = 0.094;
    else if (meta.itemCode === 'wood') price = 0.11;
    else if (meta.itemCode === 'oil') price = 0.21;
    else if (meta.itemCode === 'scraps') price = 0.25;
    else if (meta.itemCode === 'case1') price = 3.9;
    else if (meta.itemCode === 'case2') price = 24.95;
    else if (meta.itemCode === 'woodenCase') price = 6.75;

    return {
      id: meta.itemCode,
      name: meta.name,
      category: meta.sector,
      sector: meta.sector,
      unit: meta.unit,
      currentPrice: price,
      change24h: 0,
      avg7d: price,
      min7d: price * 0.9,
      max7d: price * 1.1,
      stdDev: price * 0.05,
      zScore: 0,
      pctDev: 0,
      spreadPct: 1.5,
      highestBid: price * 0.98,
      lowestAsk: price,
      volume24h: 1000,
      advisory: 'hold' as MarketAdvisory,
      advisoryReason: 'Baseline market equilibrium.',
      historyPoints: [
        { date: '7d ago', price: price * 0.98, volume: 800 },
        { date: '6d ago', price: price * 1.01, volume: 950 },
        { date: '5d ago', price: price * 0.99, volume: 1100 },
        { date: '4d ago', price: price * 1.02, volume: 1050 },
        { date: '3d ago', price: price * 1.00, volume: 1200 },
        { date: '2d ago', price: price * 0.99, volume: 900 },
        { date: 'Yesterday', price: price, volume: 1000 },
      ],
    };
  });
}

/**
 * Merge national stock levels with market quotes across all 24 canonical commodities
 */
export function buildSovereignStockpileMatrix(
  stockDict: Record<string, number>,
  marketTrends: CommodityTrend[],
  isVerified = false
): ResourceReserveItem[] {
  const trendMap = new Map(marketTrends.map((t) => [t.id, t]));

  return CANONICAL_24_COMMODITIES.map((meta) => {
    const hasExplicitStock = Object.prototype.hasOwnProperty.call(stockDict, meta.itemCode);
    const stock = Number(stockDict[meta.itemCode] || 0);
    const trend = trendMap.get(meta.itemCode);

    const currentPrice = trend ? trend.currentPrice : 0;
    const avg7d = trend ? trend.avg7d : currentPrice;

    return {
      id: meta.itemCode,
      name: meta.name,
      code: meta.code,
      category: meta.sector as any,
      sector: meta.sector,
      unit: meta.unit,
      currentStock: stock,
      isStockVerified: isVerified || hasExplicitStock,
      stockStatus: isVerified ? 'synced' : (hasExplicitStock ? 'custom' : 'unverified'),
      netBoughtPeriod: 0,
      netSoldPeriod: 0,
      avgCostBtc: avg7d,
      currentMarketPriceBtc: currentPrice,
      avg7dBtc: avg7d,
      min7dBtc: trend?.min7d,
      max7dBtc: trend?.max7d,
      stdDev: trend?.stdDev,
      zScore: trend?.zScore,
      pctDev: trend?.pctDev,
      spreadPct: trend?.spreadPct,
      highestBid: trend?.highestBid,
      lowestAsk: trend?.lowestAsk,
      advisory: trend?.advisory || 'hold',
      advisoryReason: trend?.advisoryReason || 'Normal market conditions.',
      notes: meta.description,
    };
  });
}
