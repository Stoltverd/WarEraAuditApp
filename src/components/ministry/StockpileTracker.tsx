import React, { useState, useEffect, useMemo } from 'react';
import {
  ResourceReserveItem,
  CommodityTrend,
  MarketAdvisory,
  CommodityMovementItem,
  CommoditySector,
} from '../../types/ministry';
import {
  CANONICAL_24_COMMODITIES,
  CanonicalCommodityMeta,
  fetchAllCommoditiesMarket,
} from '../../services/marketService';
import { storage } from '../../services/storage';
import { fetchCountryInventoryDetailed, compareTransactionsNewestFirst } from '../../services/apiService';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import {
  Package,
  TrendingUp,
  Coins,
  Shield,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  RefreshCw,
  Layers,
  Plus,
  ArrowLeftRight,
  Clock,
  Filter,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingDown,
  Info,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Key,
} from 'lucide-react';

interface StockpileTrackerProps {
  countryName: string;
  countryId?: string;
  stateOrgId?: string;
  stockpiles: ResourceReserveItem[];
  commodities?: CommodityTrend[];
  onUpdateStockpile: (updated: ResourceReserveItem[]) => void;
  apiKey?: string;
  onOpenKeyModal?: () => void;
  onOpenDiagnostics?: () => void;
}

const ITEM_BG: Record<string, string> = {
  case2: '#7f1d1d',
  case1: '#14532d',
  woodenCase: '#374151',
  scraps: '#1e3a5f',
  cocain: '#3b1f5e',
  coca: '#1f2937',
  heavyAmmo: '#3b1f5e',
  ammo: '#1e3a5f',
  lightAmmo: '#14532d',
  lead: '#1f2937',
  cookedFish: '#3b1f5e',
  steak: '#1e3a5f',
  bread: '#14532d',
  fish: '#1f2937',
  livestock: '#1f2937',
  grain: '#1f2937',
  concrete: '#14532d',
  limestone: '#1f2937',
  steel: '#14532d',
  iron: '#1f2937',
  paper: '#14532d',
  wood: '#1f2937',
  oil: '#14532d',
  petroleum: '#1f2937',
};

const SECTOR_LABELS: Record<CommoditySector, { label: string; color: string }> = {
  cases: { label: 'Cases & Crates', color: 'border-rose-500/30 text-rose-300 bg-rose-500/10' },
  craft: { label: 'Craft Materials', color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' },
  buffs: { label: 'Buffs & Stimulants', color: 'border-purple-500/30 text-purple-300 bg-purple-500/10' },
  ammo: { label: 'Munitions & Ammo', color: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10' },
  food: { label: 'Food & Rations', color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
  construction: { label: 'Construction', color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
  strategic: { label: 'Strategic Reserves', color: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10' },
};

export const StockpileTracker: React.FC<StockpileTrackerProps> = ({
  countryName,
  countryId,
  stateOrgId,
  stockpiles,
  commodities = [],
  onUpdateStockpile,
  apiKey,
  onOpenKeyModal,
  onOpenDiagnostics,
}) => {
  // Main sub-view state: 'inventory' (Current Holdings & Market Advisor) | 'movements' (Historical Flow Ledger)
  const [activeSubView, setActiveSubView] = useState<'inventory' | 'movements'>('inventory');

  // Inventory filter states
  const [search, setSearch] = useState('');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterAdvisory, setFilterAdvisory] = useState<string>('all');
  const [stockHoldingFilter, setStockHoldingFilter] = useState<'all' | 'held' | 'unheld' | 'unverified'>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [isSyncingWarehouse, setIsSyncingWarehouse] = useState(false);
  const [syncResultBanner, setSyncResultBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);
  const [localCommodities, setLocalCommodities] = useState<CommodityTrend[]>(commodities);

  // Timeframe for price charts in expanded drawer
  const [chartTimeframe, setChartTimeframe] = useState<'2d' | '7d' | '14d' | '30d'>('7d');

  // Movements ledger state
  const [movements, setMovements] = useState<CommodityMovementItem[]>([]);
  const [movementPeriod, setMovementPeriod] = useState<'24h' | '7d' | '30d' | '90d' | 'all'>('7d');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [isAddMovementModalOpen, setIsAddMovementModalOpen] = useState(false);

  // Manual Adjust Modal state
  const [adjustItem, setAdjustItem] = useState<ResourceReserveItem | null>(null);
  const [adjustAction, setAdjustAction] = useState<'buy' | 'sell' | 'donation' | 'transfer-in' | 'transfer-out'>('buy');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustPrice, setAdjustPrice] = useState('');
  const [adjustCounterpart, setAdjustCounterpart] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Load movements on mount or country change
  useEffect(() => {
    let isMounted = true;
    storage.getCommodityMovements(countryId).then((items) => {
      if (isMounted) setMovements(items);
    });
    return () => {
      isMounted = false;
    };
  }, [countryId]);

  // Keep localCommodities in sync if props update
  useEffect(() => {
    if (commodities && commodities.length > 0) {
      setLocalCommodities(commodities);
    }
  }, [commodities]);

  const handleRefreshMarketData = async () => {
    setIsRefreshingMarket(true);
    try {
      const fresh = await fetchAllCommoditiesMarket(true);
      setLocalCommodities(fresh);
    } catch (e) {
      console.warn('Market refresh failed:', e);
    } finally {
      setIsRefreshingMarket(false);
    }
  };

  const handleSyncWarehouse = async () => {
    if (!countryId) return;
    setIsSyncingWarehouse(true);
    try {
      const res = await fetchCountryInventoryDetailed(countryId, apiKey, stateOrgId);
      if (res.status === 'synced' && Object.keys(res.inventory).length > 0) {
        const newStockMap = new Map<string, number>(stockpiles.map((s) => [s.id, s.currentStock]));
        for (const [k, v] of Object.entries(res.inventory)) {
          newStockMap.set(k, v);
        }
        const updated = unifiedItems.map((item) => ({
          ...item,
          currentStock: newStockMap.has(item.id) ? (newStockMap.get(item.id) || 0) : item.currentStock,
          isStockVerified: true,
          stockStatus: 'synced' as const,
        }));
        onUpdateStockpile(updated);
        await storage.saveStockpiles(updated, countryId);
        setSyncResultBanner({
          type: 'success',
          message: `Official Warehouse synced! ${Object.keys(res.inventory).length} commodity quantities verified from War Era state org (${stateOrgId || 'primary'}).`,
        });
      } else if (res.status === 'no_api_key') {
        setSyncResultBanner({
          type: 'warning',
          message: 'War Era API Key Missing. An authenticated token is required to query live state warehouses from https://api2.warera.io. No fallbacks will be used.',
        });
      } else if (res.status === 'unauthorized') {
        setSyncResultBanner({
          type: 'warning',
          message: 'HTTP 401 Unauthorized: War Era API rejected your token. Please verify permissions or re-enter your key.',
        });
      } else {
        setSyncResultBanner({
          type: 'info',
          message: res.message || 'State warehouse connected (0 items recorded). You can adjust balances or log transactions below.',
        });
      }
    } catch (err: any) {
      setSyncResultBanner({
        type: 'warning',
        message: `Could not contact War Era warehouse endpoint: ${err?.message || 'Network failure'}`,
      });
    } finally {
      setIsSyncingWarehouse(false);
    }
  };

  const formatBtc = (val: number, decimals = 2) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatQty = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toLocaleString();
  };

  // Map of latest trends
  const trendMap = useMemo(() => {
    return new Map(localCommodities.map((t) => [t.id, t]));
  }, [localCommodities]);

  // Map of stockpiles by id
  const stockMap = useMemo(() => {
    return new Map(stockpiles.map((s) => [s.id, s]));
  }, [stockpiles]);

  // Build canonical items list of all 24 items in exact sequence
  const unifiedItems: ResourceReserveItem[] = useMemo(() => {
    return CANONICAL_24_COMMODITIES.map((meta) => {
      const existing = stockMap.get(meta.itemCode);
      const trend = trendMap.get(meta.itemCode);

      const currentPrice = trend ? trend.currentPrice : (existing?.currentMarketPriceBtc || 0.1);
      const avg7d = trend ? trend.avg7d : (existing?.avg7dBtc || currentPrice);

      return {
        id: meta.itemCode,
        name: meta.name,
        code: meta.code,
        category: meta.sector as any,
        sector: meta.sector,
        unit: meta.unit,
        currentStock: existing ? existing.currentStock : 0,
        isStockVerified: existing?.isStockVerified,
        stockStatus: existing?.stockStatus,
        netBoughtPeriod: existing ? existing.netBoughtPeriod : 0,
        netSoldPeriod: existing ? existing.netSoldPeriod : 0,
        avgCostBtc: existing?.avgCostBtc || avg7d,
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
        advisoryReason: trend?.advisoryReason || 'Normal market equilibrium.',
        notes: meta.description,
      };
    });
  }, [stockMap, trendMap]);

  // Holding counts for UI filter badges
  const heldCount = useMemo(() => unifiedItems.filter((i) => i.currentStock > 0).length, [unifiedItems]);
  const verifiedZeroCount = useMemo(() => unifiedItems.filter((i) => i.currentStock === 0 && i.isStockVerified).length, [unifiedItems]);
  const unverifiedCount = useMemo(() => unifiedItems.filter((i) => !i.isStockVerified && i.currentStock === 0).length, [unifiedItems]);

  // Total valuation in BTC across all held inventory
  const totalValuation = useMemo(() => {
    return unifiedItems.reduce(
      (acc, item) => acc + item.currentStock * item.currentMarketPriceBtc,
      0
    );
  }, [unifiedItems]);

  // Filtered items for Inventory View
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (filterSector !== 'all' && item.sector !== filterSector) return false;
      if (filterAdvisory !== 'all' && item.advisory !== filterAdvisory) return false;
      if (stockHoldingFilter === 'held' && item.currentStock <= 0) return false;
      if (stockHoldingFilter === 'unheld' && (item.currentStock > 0 || !item.isStockVerified)) return false;
      if (stockHoldingFilter === 'unverified' && (item.isStockVerified || item.currentStock > 0)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedItems, filterSector, filterAdvisory, stockHoldingFilter, search]);

  // Filtered movements for Ledger View
  const filteredMovements = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (movementPeriod === '24h') cutoff = now - 24 * 60 * 60 * 1000;
    else if (movementPeriod === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
    else if (movementPeriod === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;
    else if (movementPeriod === '90d') cutoff = now - 90 * 24 * 60 * 60 * 1000;

    return movements.filter((m) => {
      if (cutoff > 0) {
        const time = new Date(m.date || m.createdAt).getTime();
        if (!isNaN(time) && time < cutoff) return false;
      }
      if (movementTypeFilter !== 'all' && m.type !== movementTypeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.itemName.toLowerCase().includes(q) ||
          m.itemCode.toLowerCase().includes(q) ||
          (m.counterpartName && m.counterpartName.toLowerCase().includes(q)) ||
          (m.referenceNote && m.referenceNote.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort(compareTransactionsNewestFirst);
  }, [movements, movementPeriod, movementTypeFilter, search]);

  // Movement KPI summary
  const movementStats = useMemo(() => {
    let inflowBtc = 0;
    let outflowBtc = 0;
    let totalInflowQty = 0;
    let totalOutflowQty = 0;

    filteredMovements.forEach((m) => {
      const val = m.totalBtc || m.quantity * m.unitPriceBtc;
      if (m.type === 'buy' || m.type === 'donation' || m.type === 'transfer-in') {
        inflowBtc += val;
        totalInflowQty += m.quantity;
      } else {
        outflowBtc += val;
        totalOutflowQty += m.quantity;
      }
    });

    return {
      inflowBtc,
      outflowBtc,
      netBtc: inflowBtc - outflowBtc,
      totalInflowQty,
      totalOutflowQty,
      count: filteredMovements.length,
    };
  }, [filteredMovements]);

  // Render Status Badge
  const renderStatusBadge = (advisory: MarketAdvisory | undefined) => {
    switch (advisory) {
      case 'strong-buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Strong Buy
          </span>
        );
      case 'buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Buy (Floor)
          </span>
        );
      case 'hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Hold
          </span>
        );
      case 'sell':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Sell (Profit)
          </span>
        );
      case 'strong-sell':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> Strong Sell
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
            Hold
          </span>
        );
    }
  };

  // Handle manual movement submission & stockpile balance sync
  const handleSaveMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;

    const qty = Math.max(0, parseFloat(adjustQty) || 0);
    const unitPrice = Math.max(0, parseFloat(adjustPrice) || adjustItem.currentMarketPriceBtc);
    if (!qty) return;

    const totalBtc = qty * unitPrice;
    const nowIso = new Date().toISOString();

    const newMovement: CommodityMovementItem = {
      id: `mov-${Date.now()}`,
      itemCode: adjustItem.id,
      itemName: adjustItem.name,
      sector: adjustItem.sector,
      type: adjustAction,
      quantity: qty,
      unit: adjustItem.unit,
      unitPriceBtc: unitPrice,
      totalBtc,
      date: nowIso,
      createdAt: nowIso,
      counterpartName: adjustCounterpart.trim() || undefined,
      referenceNote: adjustNote.trim() || undefined,
    };

    const updatedMovements = [newMovement, ...movements];
    setMovements(updatedMovements);
    storage.saveCommodityMovements(updatedMovements, countryId);

    // Also update stockpile current balance
    const isInflow = adjustAction === 'buy' || adjustAction === 'donation' || adjustAction === 'transfer-in';
    const updatedStockpiles = unifiedItems.map((item) => {
      if (item.id === adjustItem.id) {
        const newStock = isInflow
          ? item.currentStock + qty
          : Math.max(0, item.currentStock - qty);

        const newBought = isInflow ? item.netBoughtPeriod + qty : item.netBoughtPeriod;
        const newSold = !isInflow ? item.netSoldPeriod + qty : item.netSoldPeriod;

        let newAvgCost = item.avgCostBtc;
        if (isInflow && newStock > 0) {
          const oldVal = item.currentStock * item.avgCostBtc;
          const addedVal = qty * unitPrice;
          newAvgCost = (oldVal + addedVal) / newStock;
        }

        return {
          ...item,
          currentStock: newStock,
          netBoughtPeriod: newBought,
          netSoldPeriod: newSold,
          avgCostBtc: parseFloat(newAvgCost.toFixed(4)),
        };
      }
      return item;
    });

    onUpdateStockpile(updatedStockpiles);
    storage.saveStockpiles(updatedStockpiles, countryId);

    // Reset and close
    setAdjustItem(null);
    setAdjustQty('');
    setAdjustPrice('');
    setAdjustCounterpart('');
    setAdjustNote('');
    setIsAddMovementModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Package className="w-4 h-4 text-amber-400" /> Strategic Reserves &amp; Inventory Management
          </div>
          <h2 className="text-xl font-black text-white">
            {countryName} National Stockpile &amp; Trade Suite
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Real-time tracking of all 24 canonical in-game commodities, official order-book depth, statistical trading advisories, and state reserve movement ledgers.
          </p>
        </div>

        {/* View Switcher: Sub-View 1 vs Sub-View 2 */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 self-start sm:self-auto shrink-0 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveSubView('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubView === 'inventory'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>National Inventory &amp; Advisor</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded font-mono">24</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('movements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubView === 'movements'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>State Movements Ledger</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded font-mono">
              {movements.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" /> Stockpile Market Valuation
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {formatBtc(totalValuation)} <span className="text-xs text-amber-500 font-bold">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Current market liquidation value of {countryName} held reserves
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-400" /> Monitored Resource Matrix
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            {unifiedItems.filter((i) => i.currentStock > 0).length} / 24 <span className="text-xs text-slate-400 font-sans">held</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            All 24 canonical items displayed in exact game order
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Strategic Opportunities
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {unifiedItems.filter((i) => i.advisory === 'strong-buy' || i.advisory === 'buy').length} <span className="text-xs text-emerald-400 font-bold">Buys</span> ·{' '}
            {unifiedItems.filter((i) => i.advisory === 'strong-sell' || i.advisory === 'sell').length} <span className="text-xs text-rose-400 font-bold">Sells</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Statistical deviations from 7-day volume-weighted baselines
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" /> Strategic &amp; Energy Line
          </div>
          <div className="text-2xl font-black font-mono text-indigo-300">
            {(unifiedItems.find((s) => s.id === 'petroleum')?.currentStock || 0).toLocaleString()} <span className="text-xs text-slate-400 font-sans">oil/petro</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">
            Paper, Wood, Oil &amp; Petroleum sovereign reserves
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: NATIONAL INVENTORY & MARKET ADVISOR */}
      {/* ========================================================================= */}
      {activeSubView === 'inventory' && (
        <div className="space-y-4">
          {/* Controls: Search, Sector Filter, Status Filter, Held Filter, Refresh */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-lg">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by commodity (e.g. Petroleum, Pill, Lead, Case)..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sector selector */}
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All 7 Sectors</option>
                <option value="strategic">Strategic (Paper, Wood, Oil, Petroleum)</option>
                <option value="construction">Construction (Concrete, Steel, Iron...)</option>
                <option value="ammo">Munitions &amp; Ammo</option>
                <option value="food">Food &amp; Rations</option>
                <option value="buffs">Buffs &amp; Stimulants (Pill, Plant)</option>
                <option value="cases">Cases &amp; Crates</option>
                <option value="craft">Craft (Scraps)</option>
              </select>

              {/* Advisory filter */}
              <select
                value={filterAdvisory}
                onChange={(e) => setFilterAdvisory(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Market Signals</option>
                <option value="strong-buy">🟢 Strong Buy (Floor Discount)</option>
                <option value="buy">Buy (Below Average)</option>
                <option value="hold">Hold (Equilibrium)</option>
                <option value="sell">Sell (Above Average)</option>
                <option value="strong-sell">🔴 Strong Sell (Peak Spike)</option>
              </select>

              {/* Holding filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStockHoldingFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    stockHoldingFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All 24
                </button>
                <button
                  type="button"
                  onClick={() => setStockHoldingFilter('held')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    stockHoldingFilter === 'held'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>In Stock</span>
                  <span className={`text-[10px] px-1 rounded ${stockHoldingFilter === 'held' ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300'}`}>
                    {heldCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStockHoldingFilter('unheld')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    stockHoldingFilter === 'unheld'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Verified 0</span>
                  <span className={`text-[10px] px-1 rounded ${stockHoldingFilter === 'unheld' ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300'}`}>
                    {verifiedZeroCount}
                  </span>
                </button>
                {unverifiedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStockHoldingFilter('unverified')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      stockHoldingFilter === 'unverified'
                        ? 'bg-rose-500 text-white font-black shadow-sm'
                        : 'text-amber-400/90 hover:text-amber-300'
                    }`}
                  >
                    <span>Unverified</span>
                    <span className={`text-[10px] px-1 rounded ${stockHoldingFilter === 'unverified' ? 'bg-slate-950 text-rose-300 font-black' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                      {unverifiedCount}
                    </span>
                  </button>
                )}
              </div>

              {/* Refresh live prices */}
              <button
                type="button"
                onClick={handleRefreshMarketData}
                disabled={isRefreshingMarket}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                title="Fetch live order books & 30-day volume from official War Era endpoints"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMarket ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">Live Quote Sync</span>
              </button>

              {/* Sync official warehouse */}
              <button
                type="button"
                onClick={handleSyncWarehouse}
                disabled={isSyncingWarehouse}
                className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-sm"
                title="Synchronize official state warehouse from War Era"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWarehouse ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Sync Warehouse</span>
              </button>
            </div>
          </div>

          {/* Missing API Token Warning Banner */}
          {(!apiKey || !apiKey.trim()) && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    <span>State Warehouse Unverified — War Era API Token Required</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-500/20 border border-rose-500/40 text-rose-300">
                      No API Token
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300/80 mt-0.5">
                    No silent fallbacks or dummy zeroes are assumed. Official quantities (petroleum, paper, munitions) require an authenticated War Era token.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenKeyModal}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95"
                  >
                    Connect API Token
                  </button>
                )}
                {onOpenDiagnostics && (
                  <button
                    type="button"
                    onClick={onOpenDiagnostics}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                  >
                    Inspect API
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sync Result & Diagnostic Feedback Banner */}
          {syncResultBanner && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition shadow-md ${
              syncResultBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : syncResultBanner.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span className="font-medium leading-relaxed">{syncResultBanner.message}</span>
              </div>
              <button
                onClick={() => setSyncResultBanner(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-slate-800 shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Canonical 24 Commodities Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full min-w-[950px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Sector</th>
                  <th className="py-3.5 px-4 text-right">National Stockpile</th>
                  <th className="py-3.5 px-4 text-right">Market Price</th>
                  <th className="py-3.5 px-4 text-right">24h Dev</th>
                  <th className="py-3.5 px-4 text-right">7D Baseline</th>
                  <th className="py-3.5 px-4 text-right">7D Min / Max</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-xs font-sans">
                      No commodities match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isExpanded = expandedItemId === item.id;
                    const trend = trendMap.get(item.id);
                    const bg = ITEM_BG[item.id] || '#1f2937';
                    const hasZeroStock = item.currentStock <= 0;
                    const isBuyOpp = item.advisory === 'strong-buy' || item.advisory === 'buy';

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          className={`hover:bg-slate-800/50 transition cursor-pointer ${
                            isExpanded ? 'bg-slate-800/40 border-l-4 border-l-amber-500' : ''
                          }`}
                        >
                          {/* Item Icon & Name */}
                          <td className="py-3 px-4 font-sans font-bold text-white">
                            <div className="flex items-center gap-3">
                              <div
                                style={{ backgroundColor: bg }}
                                className="w-9 h-9 rounded-xl border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner overflow-hidden"
                              >
                                <img
                                  src={`https://warera.io/${item.id}.png`}
                                  alt={item.name}
                                  className="w-6 h-6 object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span className="text-[10px] font-black text-slate-200 hidden">
                                  {item.code.slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <div className="text-white text-xs font-bold flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {hasZeroStock && isBuyOpp && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono">
                                      Opportunity
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.code} · {item.unit}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Sector Badge */}
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                                SECTOR_LABELS[item.sector]?.color || 'border-slate-700 text-slate-300'
                              }`}
                            >
                              {SECTOR_LABELS[item.sector]?.label || item.sector}
                            </span>
                          </td>

                          {/* National Stockpile */}
                          <td className="py-3 px-4 text-right font-bold">
                            {item.isStockVerified ? (
                              item.currentStock > 0 ? (
                                <div>
                                  <span className="text-slate-100 text-sm">
                                    {formatQty(item.currentStock)}
                                  </span>
                                  <div className="text-[10px] text-emerald-400 font-mono">
                                    ✓ Verified · ≈ {formatBtc(item.currentStock * item.currentMarketPriceBtc, 1)} BTC
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-[11px] font-sans">
                                  0 · Verified Empty
                                </span>
                              )
                            ) : item.currentStock > 0 ? (
                              <div>
                                <span className="text-slate-100 text-sm">
                                  {formatQty(item.currentStock)}
                                </span>
                                <div className="text-[10px] text-amber-400 font-mono">
                                  Manual / Local Entry
                                </div>
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-amber-300 text-[10px] font-mono inline-block">
                                  {apiKey ? 'Unsynced' : 'Auth Required'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Current Market Price */}
                          <td className="py-3 px-4 text-right font-bold text-amber-300">
                            {formatBtc(item.currentMarketPriceBtc, item.currentMarketPriceBtc >= 1 ? 3 : 4)} <span className="text-[10px] text-slate-400 font-sans">BTC</span>
                          </td>

                          {/* 24h Deviation */}
                          <td className="py-3 px-4 text-right">
                            {item.pctDev !== undefined ? (
                              <span
                                className={`inline-flex items-center gap-0.5 font-bold ${
                                  item.pctDev > 0
                                    ? 'text-rose-400'
                                    : item.pctDev < 0
                                    ? 'text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {item.pctDev > 0 ? (
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                ) : item.pctDev < 0 ? (
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                ) : null}
                                {item.pctDev >= 0 ? '+' : ''}
                                {item.pctDev.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          {/* 7D Baseline Avg */}
                          <td className="py-3 px-4 text-right text-slate-300">
                            {item.avg7dBtc !== undefined ? formatBtc(item.avg7dBtc, item.avg7dBtc >= 1 ? 3 : 4) : '—'}
                          </td>

                          {/* 7D Min / Max */}
                          <td className="py-3 px-4 text-right text-[11px] text-slate-400">
                            {item.min7dBtc !== undefined && item.max7dBtc !== undefined ? (
                              <span>
                                {formatBtc(item.min7dBtc, 3)} / {formatBtc(item.max7dBtc, 3)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* Advisory Status Badge */}
                          <td className="py-3 px-4 text-center font-sans">
                            {renderStatusBadge(item.advisory)}
                          </td>

                          {/* Detail Expand Action */}
                          <td className="py-3 px-4 text-center font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedItemId(isExpanded ? null : item.id);
                              }}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                              title="Toggle order book & price chart"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-amber-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Order Book Depth Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-950/90 border-b border-slate-800">
                            <td colSpan={9} className="p-5 font-sans">
                              <div className="space-y-4">
                                {/* Advisory Rationale Header Banner */}
                                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      {renderStatusBadge(item.advisory)}
                                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        Trading Intelligence &amp; Sovereign Action
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                                      {item.advisoryReason}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdjustItem(item);
                                        setAdjustAction(item.advisory === 'strong-sell' || item.advisory === 'sell' ? 'sell' : 'buy');
                                        setAdjustPrice(item.currentMarketPriceBtc.toString());
                                      }}
                                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-md active:scale-95"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Log State Reserve Movement</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Order Book Grid: Top Bids vs Top Asks */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Buy Orders / Bids */}
                                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                                      <span className="flex items-center gap-1.5">
                                        <TrendingDown className="w-3.5 h-3.5" /> Buy Orders (Highest Bids)
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">Depth</span>
                                    </div>

                                    {trend?.topBuys && trend.topBuys.length > 0 ? (
                                      <div className="space-y-2 font-mono text-xs">
                                        {(() => {
                                          const maxQty = Math.max(...trend.topBuys.map((b) => b.qty)) || 1;
                                          return trend.topBuys.map((o, idx) => {
                                            const pct = Math.min(100, Math.round((o.qty / maxQty) * 100));
                                            return (
                                              <div key={idx} className="flex items-center justify-between gap-3">
                                                <span className="text-emerald-400 font-bold w-20">
                                                  {formatBtc(o.price, o.price >= 1 ? 3 : 4)}
                                                </span>
                                                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                                                  <div
                                                    style={{ width: `${pct}%` }}
                                                    className="h-full bg-emerald-500/50 rounded-full"
                                                  />
                                                </div>
                                                <span className="text-slate-400 w-20 text-right">
                                                  {o.qty.toLocaleString()}
                                                </span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="py-6 text-center text-slate-500 text-xs italic">
                                        No active buy bids recorded in current order book.
                                      </div>
                                    )}
                                  </div>

                                  {/* Sell Orders / Asks */}
                                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs font-bold text-rose-400 uppercase tracking-wider">
                                      <span className="flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> Sell Orders (Lowest Asks)
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">Depth</span>
                                    </div>

                                    {trend?.topSells && trend.topSells.length > 0 ? (
                                      <div className="space-y-2 font-mono text-xs">
                                        {(() => {
                                          const maxQty = Math.max(...trend.topSells.map((s) => s.qty)) || 1;
                                          return trend.topSells.map((o, idx) => {
                                            const pct = Math.min(100, Math.round((o.qty / maxQty) * 100));
                                            return (
                                              <div key={idx} className="flex items-center justify-between gap-3">
                                                <span className="text-rose-400 font-bold w-20">
                                                  {formatBtc(o.price, o.price >= 1 ? 3 : 4)}
                                                </span>
                                                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                                                  <div
                                                    style={{ width: `${pct}%` }}
                                                    className="h-full bg-rose-500/50 rounded-full"
                                                  />
                                                </div>
                                                <span className="text-slate-400 w-20 text-right">
                                                  {o.qty.toLocaleString()}
                                                </span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="py-6 text-center text-slate-500 text-xs italic">
                                        No active sell asks recorded in current order book.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Stat Boxes Strip: Best Bid, Mid Price, Lowest Ask, Spread, Volatility */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Best Bid
                                    </div>
                                    <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                                      {item.highestBid ? formatBtc(item.highestBid, item.highestBid >= 1 ? 3 : 4) : '—'}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Mid Price
                                    </div>
                                    <div className="text-sm font-bold font-mono text-white mt-0.5">
                                      {item.highestBid && item.lowestAsk
                                        ? formatBtc((item.highestBid + item.lowestAsk) / 2, item.currentMarketPriceBtc >= 1 ? 3 : 4)
                                        : formatBtc(item.currentMarketPriceBtc, item.currentMarketPriceBtc >= 1 ? 3 : 4)}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Lowest Ask
                                    </div>
                                    <div className="text-sm font-bold font-mono text-rose-400 mt-0.5">
                                      {item.lowestAsk ? formatBtc(item.lowestAsk, item.lowestAsk >= 1 ? 3 : 4) : '—'}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Spread
                                    </div>
                                    <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                                      {item.spreadPct ? `${item.spreadPct.toFixed(2)}%` : '—'}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Z-Score
                                    </div>
                                    <div
                                      className={`text-sm font-bold font-mono mt-0.5 ${
                                        item.zScore && Math.abs(item.zScore) > 2
                                          ? 'text-rose-400'
                                          : item.zScore && Math.abs(item.zScore) > 1
                                          ? 'text-amber-400'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {item.zScore ? (item.zScore >= 0 ? `+${item.zScore.toFixed(2)}` : item.zScore.toFixed(2)) : '0.00'}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                      Std Deviation
                                    </div>
                                    <div className="text-sm font-bold font-mono text-slate-300 mt-0.5">
                                      {item.stdDev ? formatBtc(item.stdDev, 4) : '—'}
                                    </div>
                                  </div>
                                </div>

                                {/* Historical Price Trend Chart (SVG) */}
                                {trend?.historyPoints && trend.historyPoints.length > 0 && (
                                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Price Trajectory
                                      </span>
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        {trend.historyPoints.length} daily observation points
                                      </div>
                                    </div>

                                    {/* SVG Sparkline */}
                                    {(() => {
                                      const pts = trend.historyPoints;
                                      const prices = pts.map((p) => p.price);
                                      const minP = Math.min(...prices) * 0.98;
                                      const maxP = Math.max(...prices) * 1.02;
                                      const rangeP = maxP - minP || 1;
                                      const width = 800;
                                      const height = 120;

                                      const coords = pts.map((p, i) => {
                                        const x = (i / (pts.length - 1 || 1)) * width;
                                        const y = height - ((p.price - minP) / rangeP) * height;
                                        return `${x},${y}`;
                                      });

                                      const pathD = `M ${coords.join(' L ')}`;
                                      const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

                                      return (
                                        <div className="w-full overflow-hidden">
                                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
                                            <defs>
                                              <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                                              </linearGradient>
                                            </defs>
                                            <path d={areaD} fill={`url(#grad-${item.id})`} />
                                            <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                                            {pts.map((p, i) => {
                                              const x = (i / (pts.length - 1 || 1)) * width;
                                              const y = height - ((p.price - minP) / rangeP) * height;
                                              return (
                                                <circle
                                                  key={i}
                                                  cx={x}
                                                  cy={y}
                                                  r="3.5"
                                                  fill="#1e293b"
                                                  stroke="#f59e0b"
                                                  strokeWidth="2"
                                                />
                                              );
                                            })}
                                          </svg>
                                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800">
                                            <span>{formatDateDDMMYYYY(pts[0]?.date, 'Earliest')}</span>
                                            <span>7D Avg: {formatBtc(item.avg7dBtc || 0, 3)} BTC</span>
                                            <span>{formatDateDDMMYYYY(pts[pts.length - 1]?.date, 'Latest')}</span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: STATE INVENTORY MOVEMENT & TRANSFER HISTORY */}
      {/* ========================================================================= */}
      {activeSubView === 'movements' && (
        <div className="space-y-6">
          {/* Movement Flow KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> Inflow Receipts
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                +{formatBtc(movementStats.inflowBtc)} <span className="text-xs text-emerald-500 font-bold">BTC</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Purchases, Citizen Donations &amp; Incoming Transfers
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Outflow Disbursals
              </div>
              <div className="text-2xl font-black font-mono text-rose-400">
                -{formatBtc(movementStats.outflowBtc)} <span className="text-xs text-rose-500 font-bold">BTC</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Market Sales, Consignments &amp; Outgoing Transfers
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> Net Inventory Flow
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  movementStats.netBtc >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {movementStats.netBtc >= 0 ? '+' : ''}
                {formatBtc(movementStats.netBtc)} <span className="text-xs font-bold font-sans">BTC</span>
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Net capital shift in state commodity value
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Movements Logged
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {movementStats.count} Records
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Total audited reserve flows in window
              </div>
            </div>
          </div>

          {/* Controls: Timeframe, Search, Movement Type Filter & Add Movement */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-lg">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search movements by item, citizen, or treaty..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Time Window Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2">Window:</span>
                {(['24h', '7d', '30d', '90d', 'all'] as const).map((periodKey) => (
                  <button
                    key={periodKey}
                    type="button"
                    onClick={() => setMovementPeriod(periodKey)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      movementPeriod === periodKey
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {periodKey.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Movement Type Filter */}
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Movement Types</option>
                <option value="buy">🟢 Market Purchases</option>
                <option value="sell">🔴 Market Sales</option>
                <option value="donation">🎁 Citizen Donations</option>
                <option value="transfer-in">📥 Inter-State Transfers In</option>
                <option value="transfer-out">📤 Inter-State Transfers Out</option>
              </select>

              {/* Add Custom Movement Button */}
              <button
                type="button"
                onClick={() => {
                  setAdjustItem(unifiedItems[0]);
                  setIsAddMovementModalOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Record Movement</span>
              </button>
            </div>
          </div>

          {/* Movements History Ledger Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Flow Type</th>
                  <th className="py-3.5 px-4 text-right">Quantity</th>
                  <th className="py-3.5 px-4 text-right">Unit Price</th>
                  <th className="py-3.5 px-4 text-right">Total BTC Value</th>
                  <th className="py-3.5 px-4">Counterpart / Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs font-sans">
                      No inventory movements recorded in the selected observation window.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const bg = ITEM_BG[mov.itemCode] || '#1f2937';
                    const isInflow = mov.type === 'buy' || mov.type === 'donation' || mov.type === 'transfer-in';

                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/40 transition">
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {formatDateDDMMYYYY(mov.date || mov.createdAt)}
                        </td>

                        {/* Commodity */}
                        <td className="py-3.5 px-4 font-sans font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <div
                              style={{ backgroundColor: bg }}
                              className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center shrink-0 shadow-inner overflow-hidden"
                            >
                              <img
                                src={`https://warera.io/${mov.itemCode}.png`}
                                alt={mov.itemName}
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-white text-xs font-bold">{mov.itemName}</div>
                              <div className="text-[10px] text-slate-500 font-mono capitalize">
                                {mov.sector}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Movement Type Badge */}
                        <td className="py-3.5 px-4 font-sans">
                          {mov.type === 'buy' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              🟢 Market Purchase
                            </span>
                          )}
                          {mov.type === 'sell' && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              🔴 Market Sale
                            </span>
                          )}
                          {mov.type === 'donation' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              🎁 Citizen Donation
                            </span>
                          )}
                          {mov.type === 'transfer-in' && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                              📥 Inter-State In
                            </span>
                          )}
                          {mov.type === 'transfer-out' && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                              📤 Inter-State Out
                            </span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4 text-right font-bold text-white">
                          <span className={isInflow ? 'text-emerald-400' : 'text-rose-400'}>
                            {isInflow ? '+' : '-'}
                            {mov.quantity.toLocaleString()}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400 font-sans">{mov.unit}</span>
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-4 text-right text-slate-300">
                          {formatBtc(mov.unitPriceBtc, 3)} BTC
                        </td>

                        {/* Total BTC Value */}
                        <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                          {formatBtc(mov.totalBtc || mov.quantity * mov.unitPriceBtc, 2)} BTC
                        </td>

                        {/* Counterpart / Dossier */}
                        <td className="py-3.5 px-4 font-sans text-xs">
                          {mov.counterpartName && (
                            <div className="font-bold text-slate-200">{mov.counterpartName}</div>
                          )}
                          {mov.referenceNote && (
                            <div className="text-[11px] text-slate-400 max-w-xs truncate">
                              {mov.referenceNote}
                            </div>
                          )}
                          {!mov.counterpartName && !mov.referenceNote && (
                            <span className="text-slate-500 italic">National Ledger Entry</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record State Movement / Manual Stockpile Adjustment */}
      {(adjustItem || isAddMovementModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Record State Inventory Movement</h3>
                  <p className="text-xs text-slate-400">Log procurement, donation, or treaty dispatch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdjustItem(null);
                  setIsAddMovementModalOpen(false);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMovementSubmit} className="mt-5 space-y-4 text-xs font-sans">
              {/* Select Commodity */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Commodity</label>
                <select
                  value={adjustItem?.id || unifiedItems[0]?.id}
                  onChange={(e) => {
                    const found = unifiedItems.find((u) => u.id === e.target.value);
                    if (found) {
                      setAdjustItem(found);
                      setAdjustPrice(found.currentMarketPriceBtc.toString());
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-sans focus:outline-none focus:border-amber-400"
                >
                  {unifiedItems.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.sector.toUpperCase()}) · Market: {formatBtc(u.currentMarketPriceBtc, 3)} BTC
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustAction('buy')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustAction === 'buy'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🟢 Market Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('sell')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustAction === 'sell'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🔴 Market Sell
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('donation')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustAction === 'donation'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🎁 Citizen Donation
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('transfer-out')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustAction === 'transfer-out'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🌐 Inter-State Transfer
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Quantity ({adjustItem?.unit || 'units'})</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    required
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Unit Price (BTC)</label>
                  <input
                    type="number"
                    step="any"
                    value={adjustPrice}
                    onChange={(e) => setAdjustPrice(e.target.value)}
                    placeholder="e.g. 0.82"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Counterpart */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Counterpart (Citizen or Nation)</label>
                <input
                  type="text"
                  value={adjustCounterpart}
                  onChange={(e) => setAdjustCounterpart(e.target.value)}
                  placeholder="e.g. Citizen N3V1T5 or Malaysia Defense Treaty"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Reference Note */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Reference Note</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Border bunker concrete consignment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustItem(null);
                    setIsAddMovementModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md active:scale-95"
                >
                  Save to National Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
