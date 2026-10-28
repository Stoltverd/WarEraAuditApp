import React, { useState } from 'react';

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
  | 'general'
  | string;

interface WareraItemIconProps {
  itemCode?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Official WarEra item sprite base URL from https://arcana.warera.wiki/js/utils.js:
 * https://media.warera.io/images/items/${imgName}.png?v=31
 */
const WARERA_ITEM_IMG_BASE = 'https://media.warera.io/images/items';
const WARERA_ITEM_IMG_VER = '31';

/**
 * Canonical mapping from any item ID, API code, display name, or tiered equipment code
 * to the exact sprite filename on https://media.warera.io/images/items/{sprite}.png?v=31
 * extracted from https://arcana.warera.wiki/js/data.js (ITEMS & DC_ITEM_IMG).
 */
const ITEM_SPRITE_MAP: Record<string, { sprite: string; label: string; bg: string; textColor: string }> = {
  // Raw Materials
  grain: { sprite: 'grain', label: 'Grain', bg: '#1f2937', textColor: 'text-emerald-300' },
  wheat: { sprite: 'grain', label: 'Grain', bg: '#1f2937', textColor: 'text-emerald-300' },
  limestone: { sprite: 'limestone', label: 'Limestone', bg: '#1f2937', textColor: 'text-stone-300' },
  lead: { sprite: 'lead', label: 'Lead', bg: '#1f2937', textColor: 'text-purple-300' },
  petroleum: { sprite: 'petroleum', label: 'Petroleum', bg: '#1f2937', textColor: 'text-amber-300' },
  crudeoil: { sprite: 'petroleum', label: 'Petroleum', bg: '#1f2937', textColor: 'text-amber-300' },
  coca: { sprite: 'coca', label: 'Coca', bg: '#1f2937', textColor: 'text-lime-300' },
  cocaleaf: { sprite: 'coca', label: 'Coca', bg: '#1f2937', textColor: 'text-lime-300' },
  iron: { sprite: 'iron', label: 'Iron', bg: '#1f2937', textColor: 'text-slate-200' },
  livestock: { sprite: 'livestock', label: 'Livestock', bg: '#1f2937', textColor: 'text-orange-300' },
  cattle: { sprite: 'livestock', label: 'Livestock', bg: '#1f2937', textColor: 'text-orange-300' },
  fish: { sprite: 'fish', label: 'Fish', bg: '#1f2937', textColor: 'text-sky-300' },
  wood: { sprite: 'wood', label: 'Wood', bg: '#1f2937', textColor: 'text-amber-400' },
  coal: { sprite: 'limestone', label: 'Coal', bg: '#1f2937', textColor: 'text-slate-300' },

  // Manufactured Products
  steel: { sprite: 'steel', label: 'Steel', bg: '#14532d', textColor: 'text-cyan-300' },
  concrete: { sprite: 'concrete', label: 'Concrete', bg: '#14532d', textColor: 'text-stone-200' },
  oil: { sprite: 'oil', label: 'Oil', bg: '#14532d', textColor: 'text-amber-400' },
  bread: { sprite: 'bread', label: 'Bread', bg: '#14532d', textColor: 'text-amber-200' },
  food: { sprite: 'bread', label: 'Food', bg: '#14532d', textColor: 'text-emerald-300' },
  steak: { sprite: 'steak', label: 'Steak', bg: '#1e3a5f', textColor: 'text-rose-300' },
  cookedfish: { sprite: 'cookedFish', label: 'Cooked Fish', bg: '#3b1f5e', textColor: 'text-purple-300' },
  cooked_fish: { sprite: 'cookedFish', label: 'Cooked Fish', bg: '#3b1f5e', textColor: 'text-purple-300' },
  'cooked fish': { sprite: 'cookedFish', label: 'Cooked Fish', bg: '#3b1f5e', textColor: 'text-purple-300' },
  lightammo: { sprite: 'lightAmmo', label: 'Light Ammo', bg: '#14532d', textColor: 'text-emerald-300' },
  light_ammo: { sprite: 'lightAmmo', label: 'Light Ammo', bg: '#14532d', textColor: 'text-emerald-300' },
  'light ammo': { sprite: 'lightAmmo', label: 'Light Ammo', bg: '#14532d', textColor: 'text-emerald-300' },
  ammo: { sprite: 'ammo', label: 'Ammo', bg: '#1e3a5f', textColor: 'text-cyan-300' },
  munitions: { sprite: 'ammo', label: 'Munitions', bg: '#1e3a5f', textColor: 'text-cyan-300' },
  heavyammo: { sprite: 'heavyAmmo', label: 'Heavy Ammo', bg: '#3b1f5e', textColor: 'text-purple-300' },
  heavy_ammo: { sprite: 'heavyAmmo', label: 'Heavy Ammo', bg: '#3b1f5e', textColor: 'text-purple-300' },
  'heavy ammo': { sprite: 'heavyAmmo', label: 'Heavy Ammo', bg: '#3b1f5e', textColor: 'text-purple-300' },
  cocain: { sprite: 'cocain', label: 'Cocaine', bg: '#3b1f5e', textColor: 'text-fuchsia-300' },
  cocaine: { sprite: 'cocain', label: 'Cocaine', bg: '#3b1f5e', textColor: 'text-fuchsia-300' },
  paper: { sprite: 'paper', label: 'Paper', bg: '#14532d', textColor: 'text-slate-100' },

  // Cases & Craft Salvage
  case1: { sprite: 'case1', label: 'Standard Case', bg: '#14532d', textColor: 'text-emerald-300' },
  case: { sprite: 'case1', label: 'Case', bg: '#14532d', textColor: 'text-emerald-300' },
  case2: { sprite: 'case2', label: 'Elite Case', bg: '#7f1d1d', textColor: 'text-rose-300' },
  case_2: { sprite: 'case2', label: 'Elite Case', bg: '#7f1d1d', textColor: 'text-rose-300' },
  woodencase: { sprite: 'woodenCase', label: 'Wooden Case', bg: '#374151', textColor: 'text-amber-300' },
  wooden_case: { sprite: 'woodenCase', label: 'Wooden Case', bg: '#374151', textColor: 'text-amber-300' },
  'wooden case': { sprite: 'woodenCase', label: 'Wooden Case', bg: '#374151', textColor: 'text-amber-300' },
  scraps: { sprite: 'scraps', label: 'Scraps', bg: '#1e3a5f', textColor: 'text-sky-300' },
  scrap: { sprite: 'scraps', label: 'Scraps', bg: '#1e3a5f', textColor: 'text-sky-300' },

  // Weapons & Combat Equipment (DC_ITEM_IMG from arcana.warera.wiki/js/data.js)
  knife: { sprite: 'knife', label: 'Knife', bg: '#1f2937', textColor: 'text-red-300' },
  gun: { sprite: 'gun', label: 'Handgun', bg: '#14532d', textColor: 'text-red-300' },
  pistol: { sprite: 'gun', label: 'Handgun', bg: '#14532d', textColor: 'text-red-300' },
  rifle: { sprite: 'rifle', label: 'Rifle', bg: '#1e3a5f', textColor: 'text-red-400' },
  weapon: { sprite: 'rifle', label: 'Weapon', bg: '#1e3a5f', textColor: 'text-red-400' },
  weapons: { sprite: 'rifle', label: 'Weapons', bg: '#1e3a5f', textColor: 'text-red-400' },
  sniper: { sprite: 'sniper', label: 'Sniper', bg: '#3b1f5e', textColor: 'text-purple-300' },
  tank: { sprite: 'tank', label: 'Tank', bg: '#6b3410', textColor: 'text-amber-300' },
  tanks: { sprite: 'tank', label: 'Tanks', bg: '#6b3410', textColor: 'text-amber-300' },
  artillery: { sprite: 'tank', label: 'Artillery', bg: '#6b3410', textColor: 'text-amber-300' },
  jet: { sprite: 'jet', label: 'Fighter Jet', bg: '#7f1d1d', textColor: 'text-rose-300' },
  helicopter: { sprite: 'jet', label: 'Aircraft', bg: '#7f1d1d', textColor: 'text-rose-300' },
  helmet: { sprite: 'helmet', label: 'Helmet', bg: '#1e3a5f', textColor: 'text-blue-300' },
  chest: { sprite: 'chest', label: 'Body Armor', bg: '#1e3a5f', textColor: 'text-blue-300' },
  armor: { sprite: 'chest', label: 'Armor', bg: '#1e3a5f', textColor: 'text-blue-300' },
  pants: { sprite: 'pants', label: 'Combat Pants', bg: '#1e3a5f', textColor: 'text-blue-300' },
  boots: { sprite: 'boots', label: 'Combat Boots', bg: '#1e3a5f', textColor: 'text-blue-300' },
  gloves: { sprite: 'gloves', label: 'Combat Gloves', bg: '#1e3a5f', textColor: 'text-blue-300' },
};

/**
 * Tier background colors matching Arcana's TIER_BG (tier 1..6) for tiered combat gear
 * like helmet1..6, chest1..6, pants1..6, boots1..6, gloves1..6.
 */
const EQUIPMENT_TIER_BG: Record<string, string> = {
  '1': '#1f2937',
  '2': '#14532d',
  '3': '#1e3a5f',
  '4': '#3b1f5e',
  '5': '#6b3410',
  '6': '#7f1d1d',
};

export function resolveWareraItemMeta(rawCode?: string): {
  spriteUrl: string | null;
  label: string;
  bg: string;
  textColor: string;
} {
  if (!rawCode) {
    return { spriteUrl: null, label: 'Commodity', bg: '#1f2937', textColor: 'text-slate-300' };
  }

  const trimmed = rawCode.trim();
  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[\s_-]+/g, '');

  // 1. Direct lookup on lower or compact key
  const direct = ITEM_SPRITE_MAP[lower] || ITEM_SPRITE_MAP[compact];
  if (direct) {
    return {
      spriteUrl: `${WARERA_ITEM_IMG_BASE}/${direct.sprite}.png?v=${WARERA_ITEM_IMG_VER}`,
      label: direct.label,
      bg: direct.bg,
      textColor: direct.textColor,
    };
  }

  // 2. Check tiered equipment codes (e.g., helmet1..6, chest1..6, pants1..6, boots1..6, gloves1..6)
  const gearMatch = compact.match(/^(helmet|chest|pants|boots|gloves|knife|gun|rifle|sniper|tank|jet)([1-6])$/);
  if (gearMatch) {
    const baseSlot = gearMatch[1];
    const tierNum = gearMatch[2];
    const baseMeta = ITEM_SPRITE_MAP[baseSlot];
    if (baseMeta) {
      return {
        spriteUrl: `${WARERA_ITEM_IMG_BASE}/${baseMeta.sprite}.png?v=${WARERA_ITEM_IMG_VER}`,
        label: `${baseMeta.label} T${tierNum}`,
        bg: EQUIPMENT_TIER_BG[tierNum] || baseMeta.bg,
        textColor: baseMeta.textColor,
      };
    }
  }

  // 3. Partial substring matching for descriptive labels
  if (compact.includes('cookedfish')) {
    const m = ITEM_SPRITE_MAP.cookedfish;
    return { spriteUrl: `${WARERA_ITEM_IMG_BASE}/${m.sprite}.png?v=${WARERA_ITEM_IMG_VER}`, ...m };
  }
  if (compact.includes('heavyammo')) {
    const m = ITEM_SPRITE_MAP.heavyammo;
    return { spriteUrl: `${WARERA_ITEM_IMG_BASE}/${m.sprite}.png?v=${WARERA_ITEM_IMG_VER}`, ...m };
  }
  if (compact.includes('lightammo')) {
    const m = ITEM_SPRITE_MAP.lightammo;
    return { spriteUrl: `${WARERA_ITEM_IMG_BASE}/${m.sprite}.png?v=${WARERA_ITEM_IMG_VER}`, ...m };
  }
  if (compact.includes('woodencase')) {
    const m = ITEM_SPRITE_MAP.woodencase;
    return { spriteUrl: `${WARERA_ITEM_IMG_BASE}/${m.sprite}.png?v=${WARERA_ITEM_IMG_VER}`, ...m };
  }
  for (const [key, meta] of Object.entries(ITEM_SPRITE_MAP)) {
    if (key.length >= 4 && compact.includes(key)) {
      return {
        spriteUrl: `${WARERA_ITEM_IMG_BASE}/${meta.sprite}.png?v=${WARERA_ITEM_IMG_VER}`,
        label: meta.label,
        bg: meta.bg,
        textColor: meta.textColor,
      };
    }
  }

  return {
    spriteUrl: null,
    label: trimmed,
    bg: '#1f2937',
    textColor: 'text-slate-300',
  };
}

export const WareraItemIcon: React.FC<WareraItemIconProps> = ({
  itemCode = 'general',
  className = '',
  size = 'sm',
  showLabel = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const { spriteUrl, label, bg, textColor } = resolveWareraItemMeta(itemCode);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 text-base',
  }[size];

  const imgSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }[size];

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 22,
  }[size];

  const renderFallbackSvg = () => (
    <svg
      width={iconSizes}
      height={iconSizes}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div
        style={{ backgroundColor: bg }}
        className={`rounded-lg border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner overflow-hidden transition-transform ${sizeClasses} ${textColor}`}
        title={`${label} (${itemCode})`}
      >
        {spriteUrl && !imgFailed ? (
          <img
            src={spriteUrl}
            alt={label}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`${imgSizeClasses} object-contain select-none`}
          />
        ) : (
          renderFallbackSvg()
        )}
      </div>
      {showLabel && (
        <span className={`font-semibold font-mono capitalize ${textColor}`}>
          {label}
        </span>
      )}
    </div>
  );
};
