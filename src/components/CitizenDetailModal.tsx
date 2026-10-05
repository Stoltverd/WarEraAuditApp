import React, { useState } from 'react';
import { DonorRankingItem } from '../types/warera';
import { Coins, Clock, X, Shield, Calendar, Check, Copy, Info, Swords } from 'lucide-react';

interface CitizenDetailModalProps {
  donor: DonorRankingItem | null;
  onClose: () => void;
  countryName: string;
}

export const CitizenDetailModal: React.FC<CitizenDetailModalProps> = ({
  donor,
  onClose,
  countryName,
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/40 overflow-hidden shrink-0 flex items-center justify-center font-black text-amber-300 text-lg shadow-md">
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
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">{donor.username}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                  Rank #{donor.rank}
                </span>
                {hasDamage && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Swords className="w-3 h-3" /> War Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                <span>Citizen ID: {donor.userId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="text-slate-500 hover:text-slate-300 transition"
                  title="Copy User ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explicit Damage Conversion Audit Statement */}
        {hasDamage ? (
          <div className="my-3 p-3.5 bg-gradient-to-r from-red-500/15 via-amber-500/10 to-slate-800/60 border border-red-500/30 rounded-2xl text-xs text-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-red-300 uppercase tracking-wider text-[11px] mb-1">
              <Swords className="w-3.5 h-3.5" /> War Mode Audit Breakdown
            </div>
            <p className="leading-relaxed">
              <strong className="text-white">{donor.username}</strong>: donated{' '}
              <strong className="text-amber-400">{formatBtc(donor.totalAmount)} BTC</strong>. From that,{' '}
              <strong className="text-emerald-300">{formatBtc(donor.directAmount)} BTC</strong> and{' '}
              <strong className="text-red-300">{formatBtc(donor.damageAmount)} BTC</strong> in damage with a conversion rate of{' '}
              <span className="font-mono text-amber-300 font-bold">{donor.appliedRatePer1k} BTC</span> per 1k damage (dealt{' '}
              <span className="font-mono text-white font-bold">{donor.rawDamageDealt.toLocaleString()}</span> combat damage).
            </p>
          </div>
        ) : null}

        {/* Aggregate Stats Cards */}
        <div className={`grid ${hasDamage ? 'grid-cols-3' : 'grid-cols-2'} gap-3 my-3`}>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Total Effective
            </div>
            <div className="text-lg sm:text-xl font-mono font-black text-amber-400">
              {formatBtc(donor.totalAmount)}{' '}
              <span className="text-xs font-bold text-amber-500">BTC</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Recognized for {countryName}</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400" /> Direct Donated
            </div>
            <div className="text-lg sm:text-xl font-mono font-black text-emerald-400">
              {formatBtc(donor.directAmount)}{' '}
              <span className="text-xs font-bold text-emerald-500">BTC</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{donor.transactions.length} receipts</div>
          </div>

          {hasDamage && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                <Swords className="w-3.5 h-3.5 text-red-400" /> Combat Damage
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-red-300">
                {formatBtc(donor.damageAmount)}{' '}
                <span className="text-xs font-bold text-red-400">BTC</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {donor.rawDamageDealt.toLocaleString()} dmg
              </div>
            </div>
          )}
        </div>

        {/* Notice if viewing cumulative-only record */}
        {donor.isCumulativeOnly && (
          <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              This is a lifetime cumulative record from the public registry. To break this down into individual 10 BTC, 50 BTC receipts for specific dates, connect your War Era API Key in the top header.
            </span>
          </div>
        )}

        {/* Transactions Audit Log */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Individual Donation Audit Log
          </div>

          <div className="space-y-2">
            {/* If Damage is active, show the converted Combat Damage row */}
            {hasDamage && (
              <div className="bg-gradient-to-r from-red-950/40 via-slate-800/70 to-slate-800/70 border border-red-500/40 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-red-300 font-mono text-sm flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" />
                    <span>+{formatBtc(donor.damageAmount)} BTC</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 uppercase font-mono font-bold">
                      War Mode Damage
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Dealt {donor.rawDamageDealt.toLocaleString()} combat damage @ {donor.appliedRatePer1k} BTC per 1k dmg
                  </div>
                </div>

                <div className="text-right text-slate-400 font-mono text-[11px]">
                  <span className="text-red-300 font-bold">Active in War</span>
                </div>
              </div>
            )}

            {/* Direct individual transactions */}
            {donor.transactions.length === 0 && (
              <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl text-center text-xs text-slate-400">
                <span>This citizen contributed exclusively through combat support in War Mode. No direct treasury cash donations recorded.</span>
              </div>
            )}

            {donor.transactions.map((tx) => (
              <div
                key={tx._id}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-amber-400 font-mono text-sm flex items-center gap-2">
                    <span>+{formatBtc(Number(tx.money || tx.amount || 0))} BTC</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase font-mono font-bold">
                      {tx.transactionType || 'Direct Donation'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Tx ID: {tx._id}
                  </div>
                </div>

                <div className="text-right text-slate-400 font-mono text-[11px]">
                  <div className="flex items-center gap-1 justify-end font-semibold text-slate-300">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-slate-500">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
