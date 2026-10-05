import React, { useState, useMemo } from 'react';
import { DonorRankingItem } from '../types/warera';
import {
  Search,
  ArrowUpDown,
  Coins,
  Clock,
  ChevronRight,
  TrendingUp,
  Layers,
} from 'lucide-react';

interface LeaderboardTableProps {
  leaderboard: DonorRankingItem[];
  totalAmountDonated: number;
  onSelectDonor: (userId: string) => void;
  timeframe: string;
}

type SortField = 'rank' | 'amount' | 'events' | 'lastDonation';

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  leaderboard,
  totalAmountDonated,
  onSelectDonor,
  timeframe,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [displayCount, setDisplayCount] = useState(50);

  const filteredAndSorted = useMemo(() => {
    let result = leaderboard.filter(
      (item) =>
        item.username.toLowerCase().includes(search.toLowerCase()) ||
        item.userId.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'rank':
          diff = a.rank - b.rank;
          break;
        case 'amount':
          diff = b.totalAmount - a.totalAmount;
          break;
        case 'events':
          diff = b.donations.length - a.donations.length;
          break;
        case 'lastDonation':
          diff = new Date(b.lastDonationAt).getTime() - new Date(a.lastDonationAt).getTime();
          break;
      }
      return sortAsc ? diff : -diff;
    });

    return result;
  }, [leaderboard, search, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'rank');
    }
  };

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  };

  const formatRelativeTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${Math.max(1, minutes)}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            Citizen Donation Leaderboard
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Showing all {filteredAndSorted.length} contributing citizens for {timeframe}
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search citizen username or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-800/70 border-b border-slate-700/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th
                onClick={() => handleSort('rank')}
                className="py-3.5 px-3 sm:px-4 cursor-pointer hover:text-white transition w-16"
              >
                <div className="flex items-center gap-1">
                  <span>Rank</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-3 sm:px-4">Citizen</th>
              <th
                onClick={() => handleSort('amount')}
                className="py-3.5 px-3 sm:px-4 cursor-pointer hover:text-white transition text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Total BTC Donated</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('events')}
                className="py-3.5 px-3 sm:px-4 cursor-pointer hover:text-white transition text-center hidden sm:table-cell"
              >
                <div className="flex items-center justify-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Donations</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lastDonation')}
                className="py-3.5 px-3 sm:px-4 cursor-pointer hover:text-white transition text-right hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last Active</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3.5 px-3 sm:px-4 text-right">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                  {search
                    ? `No citizens found matching "${search}"`
                    : 'No donation records found for this period.'}
                </td>
              </tr>
            ) : (
              filteredAndSorted.slice(0, displayCount).map((donor) => {
                const percentage =
                  totalAmountDonated > 0
                    ? ((donor.totalAmount / totalAmountDonated) * 100).toFixed(1)
                    : '0';

                return (
                  <tr
                    key={donor.userId}
                    className="hover:bg-slate-800/40 transition group cursor-pointer"
                    onClick={() => onSelectDonor(donor.userId)}
                  >
                    {/* Rank Badge */}
                    <td className="py-3.5 px-3 sm:px-4 font-mono font-bold">
                      {donor.rank === 1 ? (
                        <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xs font-black shadow-sm">
                          1
                        </span>
                      ) : donor.rank === 2 ? (
                        <span className="w-7 h-7 rounded-lg bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center text-xs font-black">
                          2
                        </span>
                      ) : donor.rank === 3 ? (
                        <span className="w-7 h-7 rounded-lg bg-amber-700/20 text-amber-500 border border-amber-700/40 flex items-center justify-center text-xs font-black">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-400 pl-2">#{donor.rank}</span>
                      )}
                    </td>

                    {/* Citizen Profile with Avatar */}
                    <td className="py-3.5 px-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-300 text-xs shadow-sm">
                          {donor.avatarUrl ? (
                            <img
                              src={donor.avatarUrl}
                              alt={donor.username}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            donor.username.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="truncate max-w-[150px] sm:max-w-xs">
                          <div className="font-extrabold text-slate-200 group-hover:text-amber-400 transition truncate text-sm">
                            {donor.username}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            ID: {donor.userId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* BTC Amount */}
                    <td className="py-3.5 px-3 sm:px-4 text-right font-mono">
                      <div className="font-black text-amber-400 text-sm sm:text-base">
                        {formatBtc(donor.totalAmount)}{' '}
                        <span className="text-xs font-bold text-amber-500/90">BTC</span>
                      </div>
                      {donor.damageAmount > 0 ? (
                        <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-emerald-400">{formatBtc(donor.directAmount)} direct</span>
                          <span>+</span>
                          <span className="text-red-400 font-bold">{formatBtc(donor.damageAmount)} dmg</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500">
                          {percentage}% of period funds
                        </div>
                      )}
                    </td>

                    {/* Donations count */}
                    <td className="py-3.5 px-3 sm:px-4 text-center font-mono text-slate-300 hidden sm:table-cell">
                      {donor.donations.length > 0 ? (
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-semibold">
                          {donor.donations.length}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold whitespace-nowrap">
                          War Only
                        </span>
                      )}
                    </td>

                    {/* Last Active Timestamp */}
                    <td className="py-3.5 px-3 sm:px-4 text-right text-slate-400 text-xs hidden md:table-cell font-mono">
                      {formatRelativeTime(donor.lastDonationAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3 sm:px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDonor(donor.userId);
                        }}
                        className="p-1.5 rounded-xl bg-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:bg-slate-700 transition"
                        title="View audit details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination / Show more */}
      {filteredAndSorted.length > displayCount && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setDisplayCount((prev) => prev + 50)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition shadow-sm"
          >
            Load Next 50 Donors ({filteredAndSorted.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
