import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DonorRankingItem, WareraUserLite } from '../types/warera';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { useI18n } from '../i18n/I18nContext';
import {
  Search,
  ArrowUpDown,
  Coins,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Layers,
  RefreshCw,
} from 'lucide-react';

interface LeaderboardTableProps {
  leaderboard: DonorRankingItem[];
  totalAmountDonated: number;
  onSelectDonor: (userId: string) => void;
  timeframe: string;
  onResolveUsers?: (userIds: string[]) => Promise<void>;
  usersMap?: Record<string, WareraUserLite>;
}

type SortField = 'rank' | 'amount' | 'events' | 'lastDonation';

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  leaderboard,
  totalAmountDonated,
  onSelectDonor,
  timeframe,
  onResolveUsers,
  usersMap,
}) => {
  const { lang, tx } = useI18n();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const requestedIdsRef = useRef<Set<string>>(new Set());

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

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));

  // Automatically keep currentPage within valid range
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Active slice of donors rendered strictly for the current page
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  // Viewport-exclusive JIT hydration: only resolve citizens currently on this page
  useEffect(() => {
    if (!onResolveUsers) return;
    const needResolve = paginatedItems
      .filter((item) => item.username.startsWith('Citizen #'))
      .map((item) => item.userId);

    const pending = needResolve.filter((id) => !requestedIdsRef.current.has(id));
    if (pending.length === 0) return;

    // Immediately resolve active page in responsive chunks of 10
    const chunk = pending.slice(0, 10);
    chunk.forEach((id) => requestedIdsRef.current.add(id));

    // Watchdog timer: release lock after 8s so network blips can retry
    const timer = setTimeout(() => {
      chunk.forEach((id) => requestedIdsRef.current.delete(id));
    }, 8000);

    onResolveUsers(chunk).finally(() => {
      clearTimeout(timer);
    });
  }, [paginatedItems, onResolveUsers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'rank');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    const tableAnchor = document.getElementById('leaderboard-table-anchor');
    if (tableAnchor) {
      tableAnchor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      handlePageChange(parsed);
      setJumpPageInput('');
    }
  };

  // Generate clean pagination window: e.g. [1, '...', 7, 8, 9, '...', 44]
  const paginationRange = useMemo(() => {
    const delta = 1;
    const range: (number | string)[] = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      range.unshift('...');
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  }, [currentPage, totalPages]);

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
    return formatDateDDMMYYYY(isoString);
  };

  const localizedTimeframe = useMemo(() => {
    if (!timeframe) return '';
    const trimmed = timeframe.trim();
    if (trimmed === 'in the last 24 hours') {
      return tx('in the last 24 hours', 'en las últimas 24 horas');
    }
    if (trimmed === 'in the last week') {
      return tx('in the last week', 'en la última semana');
    }
    if (trimmed === 'in the last month') {
      return tx('in the last month', 'en el último mes');
    }
    if (trimmed === 'across all recorded history') {
      return tx('across all recorded history', 'en todo el historial registrado');
    }
    const betweenMatch = trimmed.match(/^between\s+(.+)\s+and\s+(.+)$/i);
    if (betweenMatch) {
      return tx(trimmed, `entre ${betweenMatch[1]} y ${betweenMatch[2]}`);
    }
    return trimmed;
  }, [timeframe, tx]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-amber-400" />
            Citizen Donation Leaderboard
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            {tx(
              `Showing all ${filteredAndSorted.length} contributing citizens ${localizedTimeframe}`,
              `Mostrando los ${filteredAndSorted.length} ciudadanos contribuyentes ${localizedTimeframe}`
            )}
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search citizen username or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Timeframe Scope Clarification Notice */}
      <div className="mb-4 px-4 py-2.5 rounded-xl bg-cyan-950/35 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            {tx(
              'Scope Notice: This leaderboard & its Audit receipts show confirmed donations to this country strictly within the selected time window. Click "Audit" on any citizen to view both their Period Receipts and their All-Time Lifetime Country Total.',
              'Aviso de Alcance: Esta tabla y sus recibos de Auditoría muestran las donaciones confirmadas a este país estrictamente dentro de la ventana de tiempo seleccionada. Haz clic en "Auditoría" en cualquier ciudadano para ver tanto sus Recibos del Período como su Total Histórico del País.'
            )}
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-[11px]">
          {tx(`Active Window: ${localizedTimeframe}`, `Ventana Activa: ${localizedTimeframe}`)}
        </span>
      </div>

      {/* Table Container */}
      <div
        id="leaderboard-table-anchor"
        data-no-dom-i18n="true"
        className="overflow-x-auto rounded-2xl border border-slate-800"
      >
        <table className="w-full text-left border-collapse text-sm sm:text-base">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700/80 text-slate-300 font-bold uppercase tracking-wider text-xs sm:text-sm">
              <th
                onClick={() => handleSort('rank')}
                className="py-4 px-4 sm:px-5 cursor-pointer hover:text-white transition w-20"
              >
                <div className="flex items-center gap-1.5">
                  <span>Rank</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </th>
              <th className="py-4 px-4 sm:px-5">Citizen</th>
              <th className="py-4 px-4 sm:px-5 hidden lg:table-cell w-64">
                Period Share
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="py-4 px-4 sm:px-5 cursor-pointer hover:text-white transition text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Total BTC Donated</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </th>
              <th
                onClick={() => handleSort('events')}
                className="py-4 px-4 sm:px-5 cursor-pointer hover:text-white transition text-center hidden sm:table-cell"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Donations</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lastDonation')}
                className="py-4 px-4 sm:px-5 cursor-pointer hover:text-white transition text-right hidden md:table-cell"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Last Donation</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </th>
              <th className="py-4 px-4 sm:px-5 text-right">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-400 text-base">
                  {search
                    ? `No citizens found matching "${search}"`
                    : 'No donation records found for this period.'}
                </td>
              </tr>
            ) : (
              paginatedItems.map((donor) => {
                const pctNum =
                  totalAmountDonated > 0
                    ? (donor.totalAmount / totalAmountDonated) * 100
                    : 0;
                const percentage = pctNum.toFixed(1);

                return (
                  <tr
                    key={donor.userId}
                    className="hover:bg-slate-800/45 transition group cursor-pointer"
                    onClick={() => onSelectDonor(donor.userId)}
                  >
                    {/* Rank Badge */}
                    <td className="py-4 px-4 sm:px-5 font-mono font-bold">
                      {donor.rank === 1 ? (
                        <span className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-sm font-black shadow-sm">
                          1
                        </span>
                      ) : donor.rank === 2 ? (
                        <span className="w-9 h-9 rounded-xl bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center text-sm font-black">
                          2
                        </span>
                      ) : donor.rank === 3 ? (
                        <span className="w-9 h-9 rounded-xl bg-amber-700/20 text-amber-500 border border-amber-700/40 flex items-center justify-center text-sm font-black">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-300 text-base pl-2">#{donor.rank}</span>
                      )}
                    </td>

                    {/* Citizen Profile with Avatar */}
                    <td className="py-4 px-4 sm:px-5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-200 text-sm shadow-sm">
                          {donor.avatarUrl ? (
                            <img
                              src={donor.avatarUrl}
                              alt={donor.username}
                              className="w-full h-full object-cover transition-opacity duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : donor.username.startsWith('Citizen #') ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-amber-400">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            </div>
                          ) : (
                            donor.username.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          {donor.username.startsWith('Citizen #') ? (
                            <div className="flex items-center gap-1.5 py-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm font-mono text-amber-300 animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                                Syncing Citizen #{donor.userId.slice(-6)}...
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-100 group-hover:text-amber-400 transition truncate text-base sm:text-lg">
                                {donor.username}
                              </span>
                              {/* Citizen Level Badge */}
                              {(() => {
                                const resolvedLvl =
                                  donor.level ??
                                  usersMap?.[donor.userId]?.leveling?.level ??
                                  usersMap?.[donor.userId]?.level;
                                if (resolvedLvl === undefined) return null;
                                return (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700/80 shrink-0"
                                    title={`${tx('Citizen Level', 'Nivel de Ciudadano')} ${resolvedLvl}`}
                                  >
                                    {lang === 'es' ? 'Nvl' : 'Lv.'} {resolvedLvl}
                                  </span>
                                );
                              })()}
                              {/* Build Role Badge */}
                              {(() => {
                                const role = donor.playstyle;
                                if (!role) return null;
                                const isEco = role === 'pure-eco';
                                const isWar = role === 'pure-war';
                                return (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                      isEco
                                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                        : isWar
                                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                    }`}
                                    title={tx(`Build Role: ${role.toUpperCase()}`, `Rol de Build: ${role.toUpperCase()}`)}
                                  >
                                    {isEco ? '🌾 Eco' : isWar ? '⚔️ War' : '⚖️ Hybrid'}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                          <div className="text-xs text-slate-400 font-mono truncate mt-0.5">
                            ID: {donor.userId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Period Share Visual Bar (Stacked layout with single-line subtitle) */}
                    <td className="py-4 px-4 sm:px-5 hidden lg:table-cell">
                      <div className="space-y-1 w-44">
                        <div className="text-xs font-mono font-bold text-amber-300">
                          {percentage}%
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(3, Math.min(100, pctNum))}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap truncate">
                          {tx('of period funds', 'de los fondos del período')}
                        </div>
                      </div>
                    </td>

                    {/* BTC Amount */}
                    <td className="py-4 px-4 sm:px-5 text-right font-mono">
                      <div className="font-black text-amber-400 text-base sm:text-xl">
                        {formatBtc(donor.totalAmount)}{' '}
                        <span className="text-xs sm:text-sm font-bold text-amber-500/90">BTC</span>
                      </div>
                      {donor.damageAmount > 0 ? (
                        <div className="text-xs text-slate-300 flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-emerald-400">{formatBtc(donor.directAmount)} direct</span>
                          <span>+</span>
                          <span className="text-red-400 font-bold">{formatBtc(donor.damageAmount)} dmg</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 lg:hidden font-mono">
                          {percentage}% {tx('of period funds', 'de los fondos del período')}
                        </div>
                      )}
                    </td>

                    {/* Donations count */}
                    <td className="py-4 px-4 sm:px-5 text-center font-mono text-slate-200 hidden sm:table-cell">
                      {donor.isCumulativeOnly ? (
                        <span
                          className="px-3 py-1 rounded-lg border text-xs sm:text-sm font-semibold bg-slate-800/80 border-slate-700 text-slate-200"
                          title="Official lifetime treasury record on register"
                        >
                          Lifetime
                        </span>
                      ) : (donor.transactionCount || donor.donations.length) > 0 ? (
                        <span
                          className="px-3 py-1 rounded-lg border text-sm font-bold bg-amber-500/15 border-amber-500/35 text-amber-300"
                          title={`${donor.transactionCount || donor.donations.length} verified individual donations`}
                        >
                          {donor.transactionCount || donor.donations.length}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold whitespace-nowrap">
                          War Only
                        </span>
                      )}
                    </td>

                    {/* Last Donation Timestamp */}
                    <td className="py-4 px-4 sm:px-5 text-right text-slate-300 text-sm hidden md:table-cell font-mono" title={formatDateDDMMYYYY(donor.lastDonationAt)}>
                      {donor.directAmount === 0 && donor.damageAmount > 0 ? (
                        <span className="text-red-400 font-semibold text-xs sm:text-sm">War Mode Active</span>
                      ) : (
                        formatRelativeTime(donor.lastDonationAt)
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 sm:px-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDonor(donor.userId);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 group-hover:text-amber-300 group-hover:bg-slate-700 border border-slate-700 transition inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold"
                        title="View audit details"
                      >
                        <span className="hidden sm:inline">Inspect</span>
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

      {/* High-Performance Paged Navigation Bar */}
      {filteredAndSorted.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Left: Summary & Per-Page Selector */}
          <div className="flex items-center gap-3 text-slate-400 flex-wrap">
            <span className="font-mono text-slate-300">
              {`Showing ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredAndSorted.length)} of ${filteredAndSorted.length.toLocaleString()} patrons`}
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-500 text-[11px]">Per page:</span>
              {[25, 50, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold transition ${
                    pageSize === size
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Numeric Page Navigation Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {/* First Page */}
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition border border-slate-700/60"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Previous Page */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition border border-slate-700/60"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              {paginationRange.map((pageItem, idx) => {
                if (pageItem === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-500 font-mono">
                      ...
                    </span>
                  );
                }

                const pageNum = Number(pageItem);
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={`page-${pageNum}`}
                    type="button"
                    onClick={() => handlePageChange(pageNum)}
                    className={`min-w-8 h-8 px-2 rounded-lg font-mono font-bold text-xs transition border ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-750 border-slate-700/60'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Page */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition border border-slate-700/60"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition border border-slate-700/60"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Right: Direct Page Jump Input */}
          {totalPages > 3 && (
            <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={`1-${totalPages}`}
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 text-center font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              >
                Go
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
