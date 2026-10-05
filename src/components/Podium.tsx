import React from 'react';
import { DonorRankingItem } from '../types/warera';
import { Crown, Medal, Award, ExternalLink, Trophy } from 'lucide-react';

interface PodiumProps {
  topDonors: DonorRankingItem[];
  onSelectDonor: (userId: string) => void;
}

export const Podium: React.FC<PodiumProps> = ({ topDonors, onSelectDonor }) => {
  if (!topDonors || topDonors.length === 0) return null;

  const first = topDonors[0];
  const second = topDonors[1];
  const third = topDonors[2];

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  };

  const renderCitizenCard = (
    donor: DonorRankingItem | undefined,
    place: 'first' | 'second' | 'third'
  ) => {
    if (!donor) {
      return (
        <div className="w-full flex-1 flex flex-col items-center justify-end opacity-30">
          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-700 mb-2 flex items-center justify-center text-slate-600 text-xs font-mono">
            Empty
          </div>
          <div className="w-full h-16 bg-slate-800/40 rounded-t-2xl border border-slate-700/40" />
        </div>
      );
    }

    const configs = {
      first: {
        border: 'border-amber-400/80 ring-4 ring-amber-400/20 shadow-amber-500/30',
        badgeBg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950',
        pedestalBg: 'bg-gradient-to-t from-slate-900 via-amber-950/40 to-amber-900/40 border-amber-500/50',
        pedestalHeight: 'h-28 sm:h-36',
        icon: <Crown className="w-6 h-6 text-amber-400 animate-pulse" />,
        avatarSize: 'w-20 h-20 sm:w-24 sm:h-24',
        nameColor: 'text-amber-300',
        rankNumber: '1',
      },
      second: {
        border: 'border-slate-300/70 ring-2 ring-slate-300/20 shadow-slate-300/10',
        badgeBg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950',
        pedestalBg: 'bg-gradient-to-t from-slate-900 via-slate-800/60 to-slate-700/40 border-slate-600/50',
        pedestalHeight: 'h-20 sm:h-28',
        icon: <Medal className="w-5 h-5 text-slate-300" />,
        avatarSize: 'w-16 h-16 sm:w-20 sm:h-20',
        nameColor: 'text-slate-200',
        rankNumber: '2',
      },
      third: {
        border: 'border-amber-700/70 ring-2 ring-amber-700/20 shadow-amber-700/10',
        badgeBg: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white',
        pedestalBg: 'bg-gradient-to-t from-slate-900 via-stone-800/60 to-stone-700/40 border-amber-800/50',
        pedestalHeight: 'h-14 sm:h-20',
        icon: <Award className="w-5 h-5 text-amber-600" />,
        avatarSize: 'w-14 h-14 sm:w-16 sm:h-16',
        nameColor: 'text-amber-500',
        rankNumber: '3',
      },
    };

    const cfg = configs[place];

    return (
      <div className="w-full flex-1 flex flex-col items-center justify-end relative group">
        {/* Crown or Medal icon above avatar */}
        <div className="mb-2">{cfg.icon}</div>

        {/* Avatar with Ring */}
        <button
          type="button"
          onClick={() => onSelectDonor(donor.userId)}
          className={`relative ${cfg.avatarSize} rounded-2xl overflow-hidden border-2 ${cfg.border} bg-slate-800 shadow-xl transition transform group-hover:scale-105 cursor-pointer mb-3`}
        >
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
            <div className="w-full h-full flex items-center justify-center font-black text-slate-300 text-xl bg-slate-800">
              {donor.username.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Rank Badge overlay */}
          <div
            className={`absolute bottom-0 right-0 px-2 py-0.5 rounded-tl-lg font-black text-xs font-mono shadow-md ${cfg.badgeBg}`}
          >
            #{cfg.rankNumber}
          </div>
        </button>

        {/* Donor Name & Total */}
        <div className="text-center px-1 mb-2">
          <button
            type="button"
            onClick={() => onSelectDonor(donor.userId)}
            className={`font-black text-sm sm:text-base ${cfg.nameColor} hover:underline inline-flex items-center gap-1 max-w-[150px] truncate`}
          >
            <span className="truncate">{donor.username}</span>
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
          </button>
          <div className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5">
            {formatBtc(donor.totalAmount)}{' '}
            <span className="text-amber-400 text-[10px]">BTC</span>
          </div>
          {donor.damageAmount > 0 && (
            <div className="text-[10px] text-red-300 font-mono font-semibold">
              +{formatBtc(donor.damageAmount)} dmg
            </div>
          )}
        </div>

        {/* Pedestal Box */}
        <div
          className={`w-full ${cfg.pedestalHeight} ${cfg.pedestalBg} rounded-t-2xl border-t border-x flex flex-col items-center justify-center shadow-2xl relative overflow-hidden`}
        >
          <span className="text-3xl sm:text-4xl font-black font-mono text-white/10 select-none">
            #{cfg.rankNumber}
          </span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {place.toUpperCase()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Top Contributing Citizens
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            National podium for highest BTC contributions
          </p>
        </div>
      </div>

      {/* Podium Grid (2nd, 1st, 3rd) */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-2xl mx-auto pt-4">
        {/* Silver (Rank 2) */}
        {renderCitizenCard(second, 'second')}
        {/* Gold (Rank 1) */}
        {renderCitizenCard(first, 'first')}
        {/* Bronze (Rank 3) */}
        {renderCitizenCard(third, 'third')}
      </div>
    </div>
  );
};
