import React, { useState } from 'react';
import { ResourceReserveItem, CommodityTrend, MarketAdvisory } from '../../types/ministry';
import {
  Package,
  Plus,
  Minus,
  TrendingUp,
  Coins,
  Shield,
  Search,
  X,
  Edit2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface StockpileTrackerProps {
  countryName: string;
  stockpiles: ResourceReserveItem[];
  commodities?: CommodityTrend[];
  onUpdateStockpile: (updated: ResourceReserveItem[]) => void;
}

export const StockpileTracker: React.FC<StockpileTrackerProps> = ({
  countryName,
  stockpiles,
  commodities = [],
  onUpdateStockpile,
}) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const [adjustItem, setAdjustItem] = useState<ResourceReserveItem | null>(null);
  const [adjustAction, setAdjustAction] = useState<'buy' | 'sell'>('buy');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustPrice, setAdjustPrice] = useState('');

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  };

  const filtered = stockpiles.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
    }
    return true;
  });

  // Total valuation in BTC
  const totalValuation = stockpiles.reduce(
    (acc, item) => acc + item.currentStock * item.currentMarketPriceBtc,
    0
  );

  const getAdvisoryBadge = (advisory: MarketAdvisory | undefined) => {
    if (!advisory) return null;
    switch (advisory) {
      case 'strong-buy':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
            🟢 Strong Buy
          </span>
        );
      case 'buy':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Buy (Floor)
          </span>
        );
      case 'hold':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Hold
          </span>
        );
      case 'sell':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Sell (Profit)
          </span>
        );
      case 'strong-sell':
        return (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
            🔴 Strong Sell
          </span>
        );
    }
  };

  const periodLabels = {
    '7d': 'Weekly Cycle (Last 7 Days)',
    '30d': 'Monthly Accounting (Last 30 Days)',
    '90d': 'Quarterly Mandate (Last 90 Days)',
    'all': 'All-Time Cumulative',
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const qty = Math.max(0, parseFloat(adjustQty) || 0);
    const price = Math.max(0, parseFloat(adjustPrice) || adjustItem.currentMarketPriceBtc);
    if (!qty) return;

    const updated = stockpiles.map((item) => {
      if (item.id === adjustItem.id) {
        if (adjustAction === 'buy') {
          const newStock = item.currentStock + qty;
          const totalOldVal = item.currentStock * item.avgCostBtc;
          const totalNewVal = qty * price;
          const newAvgCost = newStock > 0 ? (totalOldVal + totalNewVal) / newStock : price;
          return {
            ...item,
            currentStock: newStock,
            netBoughtPeriod: item.netBoughtPeriod + qty,
            avgCostBtc: parseFloat(newAvgCost.toFixed(4)),
          };
        } else {
          // Sell
          const newStock = Math.max(0, item.currentStock - qty);
          return {
            ...item,
            currentStock: newStock,
            netSoldPeriod: item.netSoldPeriod + qty,
          };
        }
      }
      return item;
    });

    onUpdateStockpile(updated);
    setAdjustItem(null);
    setAdjustQty('');
    setAdjustPrice('');
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards: Total Valuation, Stock Count, Munitions Reserve */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" /> Strategic Reserves Valuation
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {formatBtc(totalValuation)} <span className="text-xs text-amber-500 font-bold">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Market liquidation value of {countryName} stockpile</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-400" /> Monitored Resource Lines
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            {stockpiles.length} Commodities
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Food, Munitions, Raw Materials, Medical & Narcotics</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> National Defense Readiness
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {(stockpiles.find((s) => s.id === 'ammo')?.currentStock || 0).toLocaleString()} <span className="text-xs text-slate-400 font-sans">ammo</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Ready boxes for active frontline combatants</div>
        </div>
      </div>

      {/* Control Bar: Filters, Accounting Period & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shadow-lg">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commodity (e.g. Ammo, Pills, Bread)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2">Cycle:</span>
            {(['7d', '30d', '90d', 'all'] as const).map((pKey) => (
              <button
                key={pKey}
                type="button"
                onClick={() => setPeriod(pKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  period === pKey
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {pKey === '7d' ? '7D Cycle' : pKey === '30d' ? '30D Month' : pKey === '90d' ? '90D Quarter' : 'All-Time'}
              </button>
            ))}
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Resource Sectors</option>
            <option value="munitions">Munitions & Arms</option>
            <option value="food">Food & Rations</option>
            <option value="raw-materials">Raw Materials</option>
            <option value="narcotics">Narcotics & Cash Crops</option>
            <option value="medical">Medical Supplies</option>
          </select>
        </div>
      </div>

      {/* Stockpile Inventory Table with Embedded Market Advisory */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full min-w-[850px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Commodity</th>
              <th className="py-3.5 px-4">Sector</th>
              <th className="py-3.5 px-4 text-right">National Stockpile</th>
              <th className="py-3.5 px-4 text-right">
                Bought ({period === '7d' ? '7D' : period === '30d' ? '30D' : period === '90d' ? '90D' : 'All'})
              </th>
              <th className="py-3.5 px-4 text-right">
                Sold ({period === '7d' ? '7D' : period === '30d' ? '30D' : period === '90d' ? '90D' : 'All'})
              </th>
              <th className="py-3.5 px-4 text-right">Avg Unit Cost</th>
              <th className="py-3.5 px-4 text-right">Market Valuation</th>
              <th className="py-3.5 px-4 text-center">Market Advisory</th>
              <th className="py-3.5 px-4 text-right">Log Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filtered.map((item) => {
              const itemVal = item.currentStock * item.currentMarketPriceBtc;
              const matchingCommodity = commodities.find(
                (c) =>
                  c.id.toLowerCase() === item.id.toLowerCase() ||
                  item.name.toLowerCase().includes(c.name.toLowerCase()) ||
                  c.name.toLowerCase().includes(item.name.toLowerCase())
              );
              const advisory = matchingCommodity?.advisory;
              const isExpanded = expandedItemId === item.id;

              return (
                <React.Fragment key={item.id}>
                  <tr
                    className="hover:bg-slate-800/40 transition cursor-pointer group"
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  >
                    {/* Name & Code */}
                    <td className="py-3.5 px-4 font-sans font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <Package className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {matchingCommodity && (
                              <span className="text-[10px] text-cyan-400 opacity-60 group-hover:opacity-100 transition">
                                {isExpanded ? '▲' : '▼ info'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.code} · {item.unit}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 font-sans capitalize text-slate-400">
                      {item.category.replace('-', ' ')}
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-4 text-right font-black text-white text-sm">
                      {item.currentStock.toLocaleString()}{' '}
                      <span className="text-[10px] text-slate-500 font-sans">{item.unit}</span>
                    </td>

                    {/* Bought Period */}
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">
                      +{item.netBoughtPeriod.toLocaleString()}
                    </td>

                    {/* Sold Period */}
                    <td className="py-3.5 px-4 text-right text-red-400 font-semibold">
                      -{item.netSoldPeriod.toLocaleString()}
                    </td>

                    {/* Avg Cost */}
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      {item.avgCostBtc.toFixed(3)} BTC
                    </td>

                    {/* Valuation */}
                    <td className="py-3.5 px-4 text-right font-black text-amber-400">
                      {formatBtc(itemVal)} BTC
                    </td>

                    {/* Advisory Badge */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      {matchingCommodity ? (
                        getAdvisoryBadge(advisory)
                      ) : (
                        <span className="text-slate-600 text-[10px]">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td
                      className="py-3.5 px-4 text-right font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustItem(item);
                            setAdjustAction('buy');
                            setAdjustPrice(item.currentMarketPriceBtc.toString());
                          }}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95"
                          title="Log acquisition / buy into national stockpile"
                        >
                          <Plus className="w-3 h-3" /> Buy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustItem(item);
                            setAdjustAction('sell');
                            setAdjustPrice(item.currentMarketPriceBtc.toString());
                          }}
                          className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95"
                          title="Log sale / liquidation of national stockpile"
                        >
                          <Minus className="w-3 h-3" /> Sell
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Embedded Market Intelligence Drawer */}
                  {isExpanded && matchingCommodity && (
                    <tr className="bg-slate-950/80 border-y border-amber-500/20 font-sans">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                          <div className="md:col-span-1 border-r border-slate-800 pr-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>War Era Market Live</span>
                            </div>
                            <div className="text-lg font-black font-mono text-white">
                              {matchingCommodity.currentPrice.toFixed(3)} <span className="text-xs text-amber-400">BTC</span>
                            </div>
                            <div className={`text-xs font-bold font-mono mt-0.5 flex items-center gap-1 ${
                              matchingCommodity.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {matchingCommodity.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              <span>{matchingCommodity.change24h >= 0 ? '+' : ''}{matchingCommodity.change24h}% (24h)</span>
                            </div>
                          </div>

                          <div className="md:col-span-1 border-r border-slate-800 pr-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              7-Day Cycle Bands
                            </div>
                            <div className="text-xs text-slate-300 font-mono space-y-0.5">
                              <div>Floor: <span className="text-emerald-400 font-bold">{matchingCommodity.min7d.toFixed(3)} BTC</span></div>
                              <div>Peak: <span className="text-red-400 font-bold">{matchingCommodity.max7d.toFixed(3)} BTC</span></div>
                              <div>Avg: <span className="text-slate-400 font-bold">{matchingCommodity.avg7d.toFixed(3)} BTC</span></div>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center justify-between">
                              <span>Ministerial Strategic Mandate</span>
                              <span>{getAdvisoryBadge(matchingCommodity.advisory)}</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                              {matchingCommodity.advisoryReason}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Adjust Buy/Sell Batch */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                {adjustAction === 'buy' ? (
                  <Plus className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Minus className="w-5 h-5 text-red-400" />
                )}
                <span>
                  {adjustAction === 'buy' ? 'Acquire into Reserve' : 'Liquidate from Reserve'}: {adjustItem.name}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4 text-xs font-sans">
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl font-mono flex items-center justify-between">
                <span className="text-slate-400">Current Stockpile:</span>
                <strong className="text-white">
                  {adjustItem.currentStock.toLocaleString()} {adjustItem.unit}
                </strong>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Quantity ({adjustItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder={`e.g. 5000 ${adjustItem.unit}`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Unit Price (BTC per {adjustItem.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={adjustPrice}
                  onChange={(e) => setAdjustPrice(e.target.value)}
                  placeholder="e.g. 0.125"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl font-mono flex items-center justify-between">
                <span className="text-slate-400">Total Transaction Value:</span>
                <strong className={adjustAction === 'buy' ? 'text-emerald-400' : 'text-amber-400'}>
                  {formatBtc((parseFloat(adjustQty) || 0) * (parseFloat(adjustPrice) || 0))} BTC
                </strong>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-black rounded-xl transition shadow-md ${
                    adjustAction === 'buy'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-red-500 hover:bg-red-400 text-white'
                  }`}
                >
                  {adjustAction === 'buy' ? 'Confirm Acquisition' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
