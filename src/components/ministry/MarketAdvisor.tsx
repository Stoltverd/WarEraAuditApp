import React, { useState } from 'react';
import { CommodityTrend, MarketAdvisory, CommoditySector } from '../../types/ministry';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  ShieldAlert,
  Search,
  Sparkles,
  CheckCircle,
  BarChart3,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface MarketAdvisorProps {
  countryName: string;
  commodities: CommodityTrend[];
  onRefresh?: () => void;
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

export const MarketAdvisor: React.FC<MarketAdvisorProps> = ({
  countryName,
  commodities,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [filterAdvisory, setFilterAdvisory] = useState<string>('all');
  const [filterSector, setFilterSector] = useState<string>('all');

  const filtered = commodities.filter((item) => {
    if (filterAdvisory !== 'all' && item.advisory !== filterAdvisory) return false;
    if (filterSector !== 'all' && item.sector !== filterSector) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Strategic Stats
  const strongBuyCount = commodities.filter((c) => c.advisory === 'strong-buy').length;
  const buyCount = commodities.filter((c) => c.advisory === 'buy').length;
  const sellCount = commodities.filter((c) => c.advisory === 'sell' || c.advisory === 'strong-sell').length;
  const holdCount = commodities.filter((c) => c.advisory === 'hold').length;

  const topGainer = [...commodities].sort((a, b) => b.change24h - a.change24h)[0];
  const topLoser = [...commodities].sort((a, b) => a.change24h - b.change24h)[0];

  const getAdvisoryBadge = (advisory: MarketAdvisory) => {
    switch (advisory) {
      case 'strong-buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Strong Buy (Floor)
          </span>
        );
      case 'buy':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Buy (Under Avg)
          </span>
        );
      case 'hold':
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Hold
          </span>
        );
      case 'sell':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Sell (Profit)
          </span>
        );
      case 'strong-sell':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Strong Sell (Peak)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Strategic Summary Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <TrendingUp className="w-4 h-4" /> Market Intelligence &amp; Trading Advisor
            </div>
            <h3 className="text-lg font-black text-white">
              Sovereign Commodity Arbitrage for {countryName}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Algorithmic price deviation model based on 7-day volume-weighted averages and live order books directly from War Era production endpoints. Recommends strategic accumulation when prices test 7-day floors and liquidation when prices spike into resistance peaks.
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Quotes</span>
            </button>
          )}
        </div>
      </div>

      {/* Strategic Metrics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold mb-1">
            <span>Accumulation Window</span>
            <span className="text-emerald-300">🟢</span>
          </div>
          <div className="text-2xl font-black text-white">
            {strongBuyCount + buyCount} <span className="text-xs font-normal text-slate-400">commodities</span>
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-1">
            {strongBuyCount} near 7d floor · {buyCount} under avg
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 shadow-md">
          <div className="flex items-center justify-between text-red-400 text-xs font-bold mb-1">
            <span>Liquidation Targets</span>
            <span className="text-red-300">🔴</span>
          </div>
          <div className="text-2xl font-black text-white">
            {sellCount} <span className="text-xs font-normal text-slate-400">commodities</span>
          </div>
          <div className="text-[11px] text-red-300/80 mt-1">
            Test resistance · prime profit windows
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span>Stable Holds</span>
            <span className="text-slate-500">⚪</span>
          </div>
          <div className="text-2xl font-black text-white">
            {holdCount} <span className="text-xs font-normal text-slate-400">commodities</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Consolidating within equilibrium range
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold mb-1">
            <span>Top 24h Mover</span>
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-black text-white truncate">
            {topGainer ? topGainer.name : 'N/A'}
          </div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+{topGainer?.change24h?.toFixed(1)}% today</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-lg">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commodity (e.g. Petroleum, Wood, Ammo, Pill)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Advisory Filter */}
          <select
            value={filterAdvisory}
            onChange={(e) => setFilterAdvisory(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Advisory Signals ({commodities.length})</option>
            <option value="strong-buy">🟢 Strong Buy (Reserve Floor)</option>
            <option value="buy">🟢 Buy Opportunities</option>
            <option value="hold">⚪ Hold Neutral</option>
            <option value="sell">🟠 Sell (Take Profit)</option>
            <option value="strong-sell">🔴 Strong Sell (Peak Liquidation)</option>
          </select>

          {/* Sector Filter */}
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
            <option value="buffs">Buffs &amp; Stimulants</option>
            <option value="cases">Cases &amp; Crates</option>
            <option value="craft">Craft Materials</option>
          </select>
        </div>
      </div>

      {/* Market Trends Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Item</th>
              <th className="py-3.5 px-4">Sector</th>
              <th className="py-3.5 px-4 text-right">Current Price</th>
              <th className="py-3.5 px-4 text-right">24h Dev</th>
              <th className="py-3.5 px-4 text-right">7d Range Position</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4">Trading Strategic Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filtered.map((item) => {
              const isPositive = item.change24h > 0;
              const rangeSpan = Math.max(0.0001, item.max7d - item.min7d);
              const rangePct = Math.min(100, Math.max(0, Math.round(((item.currentPrice - item.min7d) / rangeSpan) * 100)));
              const bg = ITEM_BG[item.id] || '#1f2937';

              return (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  {/* Name & Icon */}
                  <td className="py-3.5 px-4 font-sans font-bold text-white">
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: bg }}
                        className="w-7 h-7 rounded-lg border border-slate-700 flex items-center justify-center shrink-0 shadow-inner overflow-hidden"
                      >
                        <img
                          src={`https://warera.io/${item.id}.png`}
                          alt={item.name}
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <span className="text-white text-xs">{item.name}</span>
                        <div className="text-[10px] text-slate-500 font-mono">{item.unit}</div>
                      </div>
                    </div>
                  </td>

                  {/* Sector */}
                  <td className="py-3.5 px-4 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                        SECTOR_LABELS[item.sector]?.color || 'border-slate-700 text-slate-300'
                      }`}
                    >
                      {SECTOR_LABELS[item.sector]?.label || item.sector}
                    </span>
                  </td>

                  {/* Current Price */}
                  <td className="py-3.5 px-4 text-right font-black text-amber-400 text-sm">
                    {item.currentPrice.toFixed(item.currentPrice >= 1 ? 3 : 4)}{' '}
                    <span className="text-[10px] text-amber-500/80 font-sans">BTC</span>
                  </td>

                  {/* 24h Change & Volume */}
                  <td className="py-3.5 px-4 text-right">
                    <div className={`font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      <span>{isPositive ? '+' : ''}{item.change24h?.toFixed(1)}%</span>
                    </div>
                    {item.volume24h && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Vol: {item.volume24h.toLocaleString()}
                      </div>
                    )}
                  </td>

                  {/* 7d Range Progress Bar */}
                  <td className="py-3.5 px-4 text-right min-w-[170px]">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="text-emerald-400/90">{item.min7d.toFixed(3)}</span>
                      <span className="text-slate-500 font-sans">Avg: {item.avg7d.toFixed(3)}</span>
                      <span className="text-rose-400/90">{item.max7d.toFixed(3)}</span>
                    </div>
                    <div className="relative w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          rangePct < 25
                            ? 'bg-emerald-500'
                            : rangePct > 75
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${rangePct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 text-right mt-0.5">
                      {rangePct}% of 7d range
                    </div>
                  </td>

                  {/* Ministerial Advisory */}
                  <td className="py-3.5 px-4 text-center font-sans">
                    {getAdvisoryBadge(item.advisory)}
                  </td>

                  {/* Rationale */}
                  <td className="py-3.5 px-4 font-sans text-slate-300 text-[11px] leading-relaxed max-w-sm">
                    {item.advisoryReason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
