import React from 'react';
import { RankingSummary } from '../types/warera';
import { Coins, Users, Trophy, ArrowUpRight, TrendingUp } from 'lucide-react';

interface RankingStatsProps {
  summary: RankingSummary;
  countryName: string;
  onSelectDonor?: (userId: string) => void;
}

export const RankingStats: React.FC<RankingStatsProps> = ({
  summary,
  countryName,
  onSelectDonor,
}) => {
  const timeframeLabel =
    summary.timeframe === 'daily'
      ? 'Past 24 Hours'
      : summary.timeframe === 'weekly'
      ? 'Past 7 Days'
      : summary.timeframe === 'monthly'
      ? 'Past 30 Days'
      : summary.timeframe === 'custom'
      ? `${new Date(summary.startDate).toLocaleDateString()} – ${new Date(summary.endDate).toLocaleDateString()}`
      : 'All-Time Record';

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total BTC Donated */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Total BTC Donated</span>
          <Coins className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline gap-1.5 truncate">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {formatBtc(summary.totalAmountDonated)}
          </span>
          <span className="text-xs font-bold text-amber-400">BTC</span>
        </div>
        {summary.damageConfig?.enabled && (summary.totalDamageDonated || 0) > 0 ? (
          <div className="mt-1 text-[11px] text-slate-300 flex items-center gap-1 font-mono">
            <span className="text-emerald-400">{formatBtc(summary.totalDirectDonated || 0)} dir</span>
            <span>+</span>
            <span className="text-red-400 font-bold">{formatBtc(summary.totalDamageDonated || 0)} dmg</span>
          </div>
        ) : null}
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>{countryName} Treasury</span>
          <span className="text-amber-400/80 font-mono text-[11px] font-semibold">{timeframeLabel}</span>
        </div>
      </div>

      {/* 2. Contributing Citizens Count */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Contributing Citizens</span>
          <Users className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {summary.totalDonors}
          </span>
          <span className="text-xs font-semibold text-slate-400">patrons</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Ranked in this period</span>
          <span className="text-emerald-400/80 font-mono text-[11px] font-semibold">{timeframeLabel}</span>
        </div>
      </div>

      {/* 3. Average Contribution */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Average Contribution</span>
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex items-baseline gap-1.5 truncate">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {formatBtc(summary.averageDonationAmount)}
          </span>
          <span className="text-xs font-bold text-blue-400">BTC</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Per active donor</span>
          <span className="text-blue-400/80 font-mono text-[11px] font-semibold">{timeframeLabel}</span>
        </div>
      </div>

      {/* 4. Top Benefactor Spotlight */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Top Benefactor
          </span>
          {summary.topDonor && (
            <button
              type="button"
              onClick={() => onSelectDonor?.(summary.topDonor!.userId)}
              className="text-amber-400 hover:text-amber-300 transition"
              title="View citizen details"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {summary.topDonor ? (
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center font-bold text-amber-300 text-sm">
                {summary.topDonor.avatarUrl ? (
                  <img
                    src={summary.topDonor.avatarUrl}
                    alt={summary.topDonor.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  summary.topDonor.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="truncate">
                <div className="text-sm font-extrabold text-white truncate">
                  {summary.topDonor.username}
                </div>
                <div className="text-xs text-amber-400 font-mono font-bold">
                  {formatBtc(summary.topDonor.totalAmount)} BTC
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {summary.totalAmountDonated > 0
                ? ((summary.topDonor.totalAmount / summary.totalAmountDonated) * 100).toFixed(1)
                : '100'}% of all {summary.timeframe} donations
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic py-2">
            No donations recorded in this period
          </div>
        )}
      </div>
    </div>
  );
};
