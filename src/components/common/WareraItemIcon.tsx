import React from 'react';

export type WareraItemType =
  | 'oil'
  | 'iron'
  | 'food'
  | 'steel'
  | 'lead'
  | 'munitions'
  | 'ammo'
  | 'aluminum'
  | 'aluminium'
  | 'rifle'
  | 'tank'
  | 'armor'
  | 'artillery'
  | 'helicopter'
  | 'jet'
  | 'raw'
  | 'general';

interface WareraItemIconProps {
  itemCode?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const WareraItemIcon: React.FC<WareraItemIconProps> = ({
  itemCode = 'general',
  className = '',
  size = 'sm',
  showLabel = false,
}) => {
  const normalized = (itemCode || 'general').toLowerCase().trim();

  const sizeClasses = {
    xs: 'w-3.5 h-3.5 text-[10px]',
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 text-base',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 22,
  }[size];

  // Map known War Era item codes to custom SVGs & vibrant color schemes matching Arcana Era
  let bgGradient = 'from-slate-700 to-slate-900 border-slate-600';
  let textColor = 'text-slate-300';
  let label = itemCode;

  if (normalized.includes('oil')) {
    bgGradient = 'from-amber-600/30 to-amber-950/80 border-amber-500/40';
    textColor = 'text-amber-400';
    label = 'Oil';
  } else if (normalized.includes('iron')) {
    bgGradient = 'from-slate-600/40 to-slate-900/90 border-slate-400/40';
    textColor = 'text-slate-200';
    label = 'Iron';
  } else if (normalized.includes('food') || normalized.includes('grain')) {
    bgGradient = 'from-emerald-600/30 to-emerald-950/80 border-emerald-500/40';
    textColor = 'text-emerald-400';
    label = 'Food';
  } else if (normalized.includes('steel')) {
    bgGradient = 'from-cyan-600/30 to-cyan-950/80 border-cyan-500/40';
    textColor = 'text-cyan-300';
    label = 'Steel';
  } else if (normalized.includes('lead')) {
    bgGradient = 'from-purple-600/30 to-purple-950/80 border-purple-500/40';
    textColor = 'text-purple-300';
    label = 'Lead';
  } else if (normalized.includes('munit') || normalized.includes('ammo')) {
    bgGradient = 'from-rose-600/30 to-rose-950/80 border-rose-500/40';
    textColor = 'text-rose-400';
    label = 'Munitions';
  } else if (normalized.includes('alumin')) {
    bgGradient = 'from-sky-600/30 to-sky-950/80 border-sky-400/40';
    textColor = 'text-sky-300';
    label = 'Aluminium';
  } else if (normalized.includes('rifle') || normalized.includes('gun') || normalized.includes('weapon')) {
    bgGradient = 'from-red-600/30 to-red-950/80 border-red-500/40';
    textColor = 'text-red-400';
    label = 'Rifle';
  } else if (normalized.includes('tank')) {
    bgGradient = 'from-lime-600/30 to-lime-950/80 border-lime-500/40';
    textColor = 'text-lime-300';
    label = 'Tank';
  } else if (normalized.includes('armor') || normalized.includes('shield')) {
    bgGradient = 'from-blue-600/30 to-blue-950/80 border-blue-500/40';
    textColor = 'text-blue-300';
    label = 'Armor';
  }

  const renderSvg = () => {
    if (normalized.includes('oil')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4" />
          <path d="m4.93 10.93 2.83 2.83" />
          <path d="M2 18h20" />
          <path d="M20 18v-5a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v5" />
          <circle cx="12" cy="14" r="2" />
        </svg>
      );
    }
    if (normalized.includes('iron') || normalized.includes('steel')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="12" x="3" y="6" rx="2" />
          <line x1="7" x2="17" y1="12" y2="12" />
          <line x1="7" x2="7" y1="6" y2="18" />
          <line x1="17" x2="17" y1="6" y2="18" />
        </svg>
      );
    }
    if (normalized.includes('food')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 22 12 12" />
          <path d="M12 12c1.7-1.7 2-4 1-5s-3.3-.7-5 1c-1.7 1.7-2 4-1 5s3.3.7 5-1Z" />
          <path d="m16 8 3-3c1-1 2.5-1 3.5 0s1 2.5 0 3.5l-3 3" />
          <path d="m14 14 3-3" />
        </svg>
      );
    }
    if (normalized.includes('munit') || normalized.includes('ammo')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6a4 4 0 0 0-4-4Z" />
          <line x1="8" x2="16" y1="18" y2="18" />
          <line x1="8" x2="16" y1="14" y2="14" />
        </svg>
      );
    }
    if (normalized.includes('lead')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <path d="M8 8v8h8" />
          <path d="M16 8v8" />
        </svg>
      );
    }
    if (normalized.includes('rifle') || normalized.includes('weapon')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3l2.5 3h5a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
          <line x1="16.5" x2="22" y1="12" y2="12" />
        </svg>
      );
    }
    if (normalized.includes('tank')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="12" width="20" height="8" rx="4" />
          <path d="M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
          <line x1="16" y1="8" x2="22" y2="8" />
        </svg>
      );
    }
    if (normalized.includes('armor') || normalized.includes('shield')) {
      return (
        <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    }
    // Default commodity / crate
    return (
      <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        className={`rounded-lg bg-gradient-to-br border flex items-center justify-center shrink-0 shadow-sm transition-transform ${sizeClasses} ${bgGradient} ${textColor}`}
        title={`${label} (${itemCode})`}
      >
        {renderSvg()}
      </div>
      {showLabel && (
        <span className={`font-semibold font-mono capitalize ${textColor}`}>
          {label}
        </span>
      )}
    </div>
  );
};
