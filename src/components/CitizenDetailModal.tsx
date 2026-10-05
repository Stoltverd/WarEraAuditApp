import React, { useState } from 'react';
import { DonorRankingItem, RankingTimeframe } from '../types/warera';
import { Coins, Clock, X, Shield, Calendar, Check, Copy, Info, Swords, ShieldCheck } from 'lucide-react';

interface CitizenDetailModalProps {
  donor: DonorRankingItem | null;
  onClose: () => void;
  countryName: string;
  hasApiKey?: boolean;
  timeframe?: RankingTimeframe;
}

export const CitizenDetailModal: React.FC<CitizenDetailModalProps> = ({
  donor,
  onClose,
  countryName,
  hasApiKey,
  timeframe,
}) => {
  const [copied, setCopied] = useState(false);

  if (!donor) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(donor.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  };

  const hasDamage = (donor.damageAmount || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl lg:max-w-5xl w-full p-5 sm:p-8 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 sm:pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 overflow-hidden shrink-0 flex items-center justify-center font-black text-amber-300 text-xl sm:text-2xl shadow-xl ring-2 ring-amber-400/20">
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

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {donor.username}
                </h3>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-mono font-black shadow-sm">
                  Rank #{donor.rank}
                </span>
                {hasDamage && (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                    <Swords className="w-3.5 h-3.5" /> War Mode Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mt-1.5 font-mono">
                <span>Citizen ID: {donor.userId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="text-slate-500 hover:text-slate-300 transition p-1 rounded hover:bg-slate-800"
                  title="Copy User ID"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Explicit Damage Conversion Audit Statement */}
        {hasDamage ? (
          <div className="my-3.5 sm:my-4 p-4 sm:p-5 bg-gradient-to-r from-red-500/15 via-amber-500/10 to-slate-800/70 border border-red-500/30 rounded-2xl text-xs sm:text-sm text-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 font-black text-red-300 uppercase tracking-wider text-xs sm:text-sm">
                <Swords className="w-4 h-4" /> War Mode Strategic Breakdown
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                Military Equipment Equivalence
              </span>
            </div>
            {donor.directAmount === 0 ? (
              <p className="leading-relaxed">
                <strong className="text-white font-bold">{donor.username}</strong> is recognized with{' '}
                <strong className="text-amber-400 font-extrabold">{formatBtc(donor.totalAmount)} BTC</strong> equivalent military contribution from combat output. As an active combatant, dealing{' '}
                <span className="font-mono text-white font-black">{donor.rawDamageDealt.toLocaleString()}</span> combat damage translates to{' '}
                <strong className="text-red-300 font-extrabold">{formatBtc(donor.damageAmount)} BTC</strong> in weapons, armor, and munitions expenditure at{' '}
                <span className="font-mono text-amber-300 font-bold">{donor.appliedRatePer1k} BTC</span> per 1k damage in defense of {countryName}.
              </p>
            ) : (
              <p className="leading-relaxed">
                <strong className="text-white font-bold">{donor.username}</strong>: donated{' '}
                <strong className="text-amber-400 font-extrabold">{formatBtc(donor.totalAmount)} BTC</strong>. From that,{' '}
                <strong className="text-emerald-300 font-extrabold">{formatBtc(donor.directAmount)} BTC</strong> direct cash and{' '}
                <strong className="text-red-300 font-extrabold">{formatBtc(donor.damageAmount)} BTC</strong> in munitions damage value with a conversion rate of{' '}
                <span className="font-mono text-amber-300 font-bold">{donor.appliedRatePer1k} BTC</span> per 1k damage (dealt{' '}
                <span className="font-mono text-white font-black">{donor.rawDamageDealt.toLocaleString()}</span> combat damage).
              </p>
            )}
          </div>
        ) : null}

        {/* Aggregate Stats Cards */}
        <div className={`grid ${hasDamage ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-3.5 my-3.5`}>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Coins className="w-4 h-4 text-amber-400" /> Total Effective
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black text-amber-400">
              {formatBtc(donor.totalAmount)}{' '}
              <span className="text-sm sm:text-base font-bold text-amber-500">BTC</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">Recognized for {countryName}</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Coins className="w-4 h-4 text-emerald-400" /> Direct Donated
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black text-emerald-400">
              {formatBtc(donor.directAmount)}{' '}
              <span className="text-sm sm:text-base font-bold text-emerald-500">BTC</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">{donor.transactionCount || donor.transactions.length} verified donations</div>
          </div>

          {hasDamage && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-5">
              <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Swords className="w-4 h-4 text-red-400" /> Combat Damage
              </div>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black text-red-300">
                {formatBtc(donor.damageAmount)}{' '}
                <span className="text-sm sm:text-base font-bold text-red-400">BTC</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                {donor.rawDamageDealt.toLocaleString()} combat damage
              </div>
            </div>
          )}
        </div>

        {/* Notice if viewing cumulative-only record */}
        {donor.isCumulativeOnly && (
          <div
            className={`mb-3.5 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm flex items-start gap-3 border ${
              hasApiKey
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {hasApiKey ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">
              {hasApiKey ? (
                <>
                  <strong className="text-white block font-black text-sm mb-1">
                    Official Lifetime Treasury Record (API Key Active)
                  </strong>
                  All-Time mode audits the official lifetime cumulative registry from War Era. To view day-by-day itemized receipts and individual 10 BTC / 50 BTC transactions, switch the top timeframe to{' '}
                  <strong className="text-emerald-300 font-bold">Daily (24h)</strong>,{' '}
                  <strong className="text-emerald-300 font-bold">Weekly (7d)</strong>, or{' '}
                  <strong className="text-emerald-300 font-bold">Custom Range</strong>.
                </>
              ) : (
                <>
                  <strong className="text-white block font-black text-sm mb-1">
                    Official Lifetime Treasury Record
                  </strong>
                  This is a lifetime cumulative record from the public registry. To stream live itemized transaction receipts for Daily (24h) and Weekly (7d) periods, connect your War Era API Key in the top header.
                </>
              )}
            </div>
          </div>
        )}

        {/* Transactions Audit Log */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              {donor.isCumulativeOnly
                ? 'Official Treasury Registry Ledger'
                : `Itemized Donation Receipts (${donor.transactions.length})`}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {donor.isCumulativeOnly ? 'Lifetime Record' : 'Verified Transactions'}
            </span>
          </div>

          <div className="space-y-2.5">
            {/* If Damage is active, show the converted Combat Damage row */}
            {hasDamage && (
              <div className="bg-gradient-to-r from-red-950/40 via-slate-800/70 to-slate-800/70 border border-red-500/40 rounded-2xl p-4 flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <div className="font-bold text-red-300 font-mono text-sm sm:text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" />
                    <span>+{formatBtc(donor.damageAmount)} BTC</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 uppercase font-mono font-bold">
                      War Mode Damage
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Dealt {donor.rawDamageDealt.toLocaleString()} combat damage @ {donor.appliedRatePer1k} BTC per 1k dmg
                  </div>
                </div>

                <div className="text-right text-slate-400 font-mono text-xs sm:text-sm">
                  <span className="text-red-300 font-bold">Active in War</span>
                </div>
              </div>
            )}

            {/* Direct individual transactions */}
            {donor.transactions.length === 0 && (
              <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-2xl text-center text-xs sm:text-sm text-slate-400">
                <span>This citizen contributed exclusively through combat support in War Mode. No direct treasury cash donations recorded.</span>
              </div>
            )}

            {donor.transactions.map((tx) => (
              <div
                key={tx._id}
                className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between text-xs sm:text-sm"
              >
                <div>
                  <div className="font-bold text-amber-400 font-mono text-sm sm:text-base flex items-center gap-2.5">
                    <span>+{formatBtc(Number(tx.money || tx.amount || 0))} BTC</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase font-mono font-bold">
                      {tx.transactionType || 'Direct Donation'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Tx ID: {tx._id}
                  </div>
                </div>

                <div className="text-right text-slate-400 font-mono text-xs">
                  <div className="flex items-center gap-1.5 justify-end font-semibold text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3.5 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-black rounded-xl border border-slate-700 transition shadow-md active:scale-95"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
