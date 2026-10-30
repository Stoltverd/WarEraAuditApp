import {
  EmployeeTraitId,
  EmployeeTraitTier,
  WareraBotEmployee,
  WareraCompany,
  WareraUserLite,
} from '../types/warera';
import {
  BuildGradeId,
  CitizenBuildEvaluation,
  CitizenSkillBreakdown,
  CommodityTrend,
  PlaystyleMode,
} from '../types/ministry';
import {
  CANONICAL_24_COMMODITIES,
  generateFallbackMarketTrends,
  getCachedOrFallbackMarketTrends,
} from './marketService';

export interface EmployeeTraitDefinition {
  id: EmployeeTraitId;
  name: string;
  tier: EmployeeTraitTier;
  tierLabel: 'MUST HAVE!' | 'GOOD TO HAVE' | 'OK TO HAVE';
  summary: string;
  effectText: string;
  category: 'production' | 'happiness' | 'luck' | 'wage' | 'training' | 'synergy';
  bestFor: string;
  caution?: string;
}

/**
 * Complete 29-Trait Catalog from the Piraterers Tier List for War Era v0.27
 */
export const PIRATERERS_TRAIT_CATALOG: EmployeeTraitDefinition[] = [
  // =========================================================================
  // MUST HAVE! (S-TIER)
  // =========================================================================
  {
    id: 'handy',
    name: 'Handy',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: 'Holding any tool: +40% production. Nothing bare-handed.',
    effectText: '+40% Production with Tool',
    category: 'production',
    bestFor: 'Top production earner equipped with a matching product tool.',
    caution: 'Provides 0% bonus if no tool is equipped.',
  },
  {
    id: 'sociable',
    name: 'Sociable',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: '+25% production per coworker (max +50%). Unhappy alone.',
    effectText: '+25% / Coworker (Max +50%)',
    category: 'synergy',
    bestFor: 'Breakroom Level 3 companies with 3 active employees (+50% boost).',
    caution: 'Loses happiness and gives 0% bonus if working alone in a Level 1 Breakroom.',
  },
  {
    id: 'cosmopolitan',
    name: 'Cosmopolitan',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: '+2 production per foreign nationality on the roster, up to +4.',
    effectText: '+2 Prod / Foreign Coworker (Max +4)',
    category: 'production',
    bestFor: 'Multi-national 3-worker Breakrooms with diverse foreign nationalities.',
  },
  {
    id: 'specialist',
    name: 'Specialist',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: 'In a company producing their good: +3 production and +5 happiness.',
    effectText: '+3 Prod & +5 Happiness',
    category: 'production',
    bestFor: 'Permanent placement in a factory producing their specialized commodity.',
    caution: 'Never move a specialized employee to a different product company.',
  },
  {
    id: 'late_bloomer',
    name: 'Late Bloomer',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: '+2 production per 10 years of age past 40.',
    effectText: '+2 Prod / 10 Yrs Past Age 40',
    category: 'production',
    bestFor: 'Veteran workers aged 50–70+ where age turns into massive flat production.',
  },
  {
    id: 'craftsman',
    name: 'Craftsman',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: 'Manufactured goods and weapons: +3 production. Raw resources: -1.',
    effectText: '+3 Prod (Manufactured) / -1 (Raw)',
    category: 'production',
    bestFor: 'Steel, Munitions, Weapons, Paper, Bread, Concrete, and processed goods.',
    caution: 'Suffers -1 production penalty if placed in raw resource extraction.',
  },
  {
    id: 'laborer',
    name: 'Laborer',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: 'Raw resources: +3 production. Anything manufactured: -1.',
    effectText: '+3 Prod (Raw Resources) / -1 (Manufactured)',
    category: 'production',
    bestFor: 'Iron, Oil/Petroleum, Wood, Grain/Food, Lead, Stone, and raw extraction.',
    caution: 'Suffers -1 production penalty if placed in manufacturing or weapons.',
  },
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    tier: 'must-have',
    tierLabel: 'MUST HAVE!',
    summary: 'Every coworker gets +3 Luck.',
    effectText: 'Team +3 Luck to Coworkers',
    category: 'luck',
    bestFor: '3-worker Breakrooms to dramatically increase hourly toolbox discovery odds.',
  },

  // =========================================================================
  // GOOD TO HAVE (A-TIER)
  // =========================================================================
  {
    id: 'girl_power',
    name: 'Girl Power',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: '+15% production per female coworker (max +30%). Women only.',
    effectText: '+15% / Female Coworker (Max +30%)',
    category: 'synergy',
    bestFor: 'All-female 3-worker Breakroom rosters (+30% multiplicative output).',
  },
  {
    id: 'band_of_brothers',
    name: 'Band of Brothers',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: '+15% production per male coworker (max +30%). Men only.',
    effectText: '+15% / Male Coworker (Max +30%)',
    category: 'synergy',
    bestFor: 'All-male 3-worker Breakroom rosters (+30% multiplicative output).',
  },
  {
    id: 'patriot',
    name: 'Patriot',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Working in a core region of their homeland: +2 production and +10 happiness.',
    effectText: '+2 Prod & +10 Happiness (Homeland)',
    category: 'happiness',
    bestFor: 'Companies located in your own country’s safest core region.',
  },
  {
    id: 'rival',
    name: 'Rival',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Somebody out-produces them: +3 production. Top of the roster: -1.',
    effectText: '+3 Prod if Out-Produced / -1 if Top',
    category: 'production',
    bestFor: 'Secondary slot alongside a hyper-trained star employee.',
    caution: 'Loses 1 production if they become the highest producer in the company.',
  },
  {
    id: 'expat',
    name: 'Expat',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Working abroad: +2 production.',
    effectText: '+2 Prod (Foreign Region)',
    category: 'production',
    bestFor: 'Foreign national employees hired into your domestic company.',
  },
  {
    id: 'prima_donna',
    name: 'Prima Donna',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Paid more than every coworker: +20% production. Otherwise -10 happiness. Nothing while alone.',
    effectText: '+20% Prod if Highest Paid / -10 Happy if Not',
    category: 'production',
    bestFor: 'Your single highest-stat carry employee in a 2–3 worker company.',
    caution: 'Drops happiness by -10 if another coworker earns an equal or higher wage.',
  },
  {
    id: 'modest',
    name: 'Modest',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Asks for 15% less pay than the market rate.',
    effectText: '-15% Hourly Wage Cost',
    category: 'wage',
    bestFor: 'Improving net company profit margins during high PP wage spikes.',
  },
  {
    id: 'diamond_in_the_rough',
    name: 'Diamond in the Rough',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: '+1 to one stat every 10 days in the same company, up to +4.',
    effectText: '+1 Random Stat / 10 Days (Max +4)',
    category: 'training',
    bestFor: 'Young hires (age 19–22) kept permanently in the same company for 40+ days.',
  },
  {
    id: 'recruiter',
    name: 'Recruiter',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'One extra candidate in the daily shortlist of every company you own.',
    effectText: '+1 Daily Candidate Across All Companies',
    category: 'training',
    bestFor: 'Early roster building phase to find 19–21yo prodigies without rerolling.',
  },
  {
    id: 'trainer',
    name: 'Trainer',
    tier: 'good-to-have',
    tierLabel: 'GOOD TO HAVE',
    summary: 'Every coworker can train twice a day instead of once.',
    effectText: '2x Daily Training Speed for Coworkers',
    category: 'training',
    bestFor: 'Rapidly maxing out 8–12+ training potential coworkers during an all-out Energy week.',
  },

  // =========================================================================
  // OK TO HAVE (B-TIER)
  // =========================================================================
  {
    id: 'improviser',
    name: 'Improviser',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Holding no tool: +25% production. Give the tool to somebody else.',
    effectText: '+25% Prod (No Tool)',
    category: 'production',
    bestFor: 'Secondary workers when you only have 1 tool (give the tool to a Handy worker).',
  },
  {
    id: 'quick_study',
    name: 'Quick Study',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Every day worked counts double toward specialization.',
    effectText: '2x Specialization Speed',
    category: 'training',
    bestFor: 'Reaching full product specialization bonus in half the normal time.',
  },
  {
    id: 'nationalist',
    name: 'Nationalist',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Half or more coworkers share their nationality: +2 production and +5 happiness.',
    effectText: '+2 Prod & +5 Happiness (Same Nationality)',
    category: 'synergy',
    bestFor: 'Homogeneous domestic rosters where workers share the same nationality.',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'After 30 days in the same company: +20% production. A transfer resets it.',
    effectText: '+20% Prod After 30 Days Tenure',
    category: 'production',
    bestFor: 'Long-term stationary companies in safe regions (never transfer them).',
  },
  {
    id: 'comic',
    name: 'Comic',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: '-1 production to themselves, but +10 happiness to every coworker.',
    effectText: '-1 Self Prod / +10 Coworker Happiness',
    category: 'happiness',
    bestFor: 'Offsetting happiness penalties (like Bully or low-morale events) in 3-worker rooms.',
  },
  {
    id: 'statist',
    name: 'Statist',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Income tax at 20% or more: +2 responsibility/discipline.',
    effectText: '+2 Responsibility if Income Tax >= 20%',
    category: 'luck',
    bestFor: 'High-tax sovereign nations (20%+ income tax bracket).',
  },
  {
    id: 'bully',
    name: 'Bully',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'With coworkers: +2 production for themselves, -10 happiness for everyone else.',
    effectText: '+2 Self Prod / -10 Coworker Happiness',
    category: 'production',
    bestFor: 'Pairing with a Comic or active Manager (+5 happiness clicks) to prevent walkouts.',
    caution: 'Can push coworkers under 30 happiness if unmanaged!',
  },
  {
    id: 'loyal',
    name: 'Loyal',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Every happiness loss hits them half as hard.',
    effectText: '-50% Happiness Loss Taken',
    category: 'happiness',
    bestFor: 'Surviving negative company events or working alongside a Bully.',
  },
  {
    id: 'loner',
    name: 'Loner',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Sole employee of the company: +100% production. Nothing once a coworker joins.',
    effectText: '+100% Prod Alone / 0% With Coworkers',
    category: 'production',
    bestFor: 'Breakroom Level 1 companies or solo-Carry stalls.',
    caution: 'Bonus completely vanishes the moment a 2nd employee is hired.',
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Twice the chance to find a toolbox, and twice its cap. -25% production.',
    effectText: '2x Toolbox Chance & Cap / -25% Prod',
    category: 'luck',
    bestFor: 'Dedicated tool-farming slots when paired with Lucky Charm coworkers.',
  },
  {
    id: 'foreman',
    name: 'Foreman',
    tier: 'ok-to-have',
    tierLabel: 'OK TO HAVE',
    summary: 'Every coworker gets +3 responsibility/discipline. Nothing for themselves.',
    effectText: '+3 Responsibility to Coworkers',
    category: 'synergy',
    bestFor: 'Stabilizing 3-worker Breakrooms against adverse company events.',
  },
];

export const TRAIT_MAP: Record<EmployeeTraitId, EmployeeTraitDefinition> = Object.fromEntries(
  PIRATERERS_TRAIT_CATALOG.map((t) => [t.id, t])
) as Record<EmployeeTraitId, EmployeeTraitDefinition>;

/**
 * BuhDeuce Training Event Priority Protocol (from WAR ERA EMPLOYEE GUIDE)
 */
export const BUHDEUCE_HIRING_RULES: string[] = [
  'After upgrading Breakrooms to LVL 3 (20 Steel for Lvl 2, 80 Steel for Lvl 3), start hiring employees.',
  'Always go for the youngest available candidate (age 19 or 21 is not a big difference, but 20 has priority over 28+).',
  'Young candidates reveal 1 stat: prioritize lots of training sessions (8–12+) and good traits; initial Production, Discipline, and Luck matter much less.',
  'Only reroll once if NO candidate is younger than 35 and all have terrible stats. Never reroll twice — just fire them the day after.',
  'Hire 1 employee and train them immediately, then hire the next one and so on.',
];

export const BUHDEUCE_TRAINING_GUIDE = [
  {
    rarity: 'Grey or Green Events',
    color: 'emerald',
    primaryChoice: 'Extra Production (always pick if offered)',
    fallbackChoice: 'Lower the Wage (if Extra Production is not available)',
    priorities: [
      '1st Priority: Extra Production (always pick if offered)',
      '2nd Priority: Lower the Wage (if Extra Production is not available)',
    ],
    rationale: 'Direct base production scales every multiplicative trait (+40% Handy, +50% Sociable) and lower wages protect hourly net margins.',
  },
  {
    rarity: 'Blue Events',
    color: 'cyan',
    primaryChoice: 'Remove a Bad Habit (if the employee has one)',
    fallbackChoice: 'Extra Training Session (if no bad habit to remove)',
    priorities: [
      '1st Priority: Remove a Bad Habit (if the employee has one)',
      '2nd Priority: Extra Training Session (if no bad habit to remove)',
    ],
    rationale: 'Clearing bad habits removes permanent drag; extra training sessions extend the employee’s stat ceiling.',
  },
  {
    rarity: 'Purple & Legendary Events',
    color: 'amber',
    primaryChoice: 'Good Traits (Most powerful multiplier — pick first if trait slots are open)',
    fallbackChoice: 'Extra Training Sessions (once trait slots are full)',
    priorities: [
      '1st Priority: Good Traits (Most powerful multiplier in the game — pick first if trait slots are open)',
      '2nd Priority: Extra Training Sessions (once trait slots are full)',
    ],
    rationale: 'S-Tier traits like Handy (+40%), Sociable (+50%), and Specialist (+3 Prod / +5 Happy) outperform raw stat points.',
  },
];

/**
 * Classify whether a commodity code is a Raw Resource or Manufactured Good/Weapon
 * (Used for Craftsman [+3 Manuf / -1 Raw] and Laborer [+3 Raw / -1 Manuf])
 */
export function isManufacturedCommodity(itemCode?: string): boolean {
  const code = (itemCode || '').toLowerCase().trim();
  const rawList = [
    'iron',
    'oil',
    'petroleum',
    'wood',
    'grain',
    'wheat',
    'food_raw',
    'fish',
    'livestock',
    'cattle',
    'stone',
    'limestone',
    'coal',
    'lead',
    'bauxite',
    'rubber',
    'coca',
  ];
  if (rawList.some((r) => code === r || code.includes(r))) {
    return false;
  }
  return true; // Steel, Munitions, Weapons, Bread, Paper, Concrete, Pill, Tanks, Jets, etc.
}

export interface ResolvedCommodityPriceInfo {
  itemCode: string;
  canonicalId: string;
  commodityName: string;
  unit: string;
  isManufactured: boolean;
  unitPriceBtc: number;
  liveMarketPriceBtc: number;
  lowestAskBtc: number;
  highestBidBtc: number;
  avg7dBtc: number;
  change24hPct: number;
  priceSource: 'manual-override' | 'live-market' | 'baseline';
}

const COMMODITY_CODE_ALIASES: Record<string, string> = {
  munitions: 'ammo',
  lightammo: 'lightAmmo',
  light_ammo: 'lightAmmo',
  heavyammo: 'heavyAmmo',
  heavy_ammo: 'heavyAmmo',
  weapons: 'heavyAmmo',
  food: 'bread',
  rations: 'bread',
  wheat: 'grain',
  cattle: 'livestock',
  pill: 'cocain',
  pills: 'cocain',
  plant: 'coca',
  plants: 'coca',
  stone: 'limestone',
  oil: 'petroleum',
  crude: 'petroleum',
  cookedfish: 'cookedFish',
  cooked_fish: 'cookedFish',
  redbull: 'redbull',
  case1: 'case1',
  scraps: 'scraps',
};

export interface ItemRecipeIngredient {
  itemCode: string;
  name: string;
  quantity: number;
}

export interface ItemProductionRecipe {
  itemCode: string;
  ppPerUnit: number;
  isManufactured: boolean;
  inputs: ItemRecipeIngredient[];
  recipeSummary: string;
}

/**
 * Authoritative War Era Item Production Recipes:
 * Production Points (PP) determine how many units of an item are produced based on `ppPerUnit`,
 * and manufactured items consume raw material inputs per unit produced.
 * All produced outputs and consumed inputs are valued strictly at current live market prices.
 */
export const ITEM_PRODUCTION_RECIPES: Record<string, ItemProductionRecipe> = {
  // Raw Materials (1 PP -> 1 Unit, 0 Raw Inputs)
  limestone: {
    itemCode: 'limestone',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Limestone (Raw Extraction)',
  },
  grain: {
    itemCode: 'grain',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Grain (Raw Extraction)',
  },
  livestock: {
    itemCode: 'livestock',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Livestock (Raw Extraction)',
  },
  fish: {
    itemCode: 'fish',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Fish (Raw Extraction)',
  },
  iron: {
    itemCode: 'iron',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Iron (Raw Extraction)',
  },
  lead: {
    itemCode: 'lead',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Lead (Raw Extraction)',
  },
  petroleum: {
    itemCode: 'petroleum',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Petroleum (Raw Extraction)',
  },
  coca: {
    itemCode: 'coca',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Plant / Coca (Raw Extraction)',
  },
  wood: {
    itemCode: 'wood',
    ppPerUnit: 1,
    isManufactured: false,
    inputs: [],
    recipeSummary: '1 PP = 1 Wood (Raw Extraction)',
  },

  // Manufactured Industrial & Construction Materials
  steel: {
    itemCode: 'steel',
    ppPerUnit: 10,
    isManufactured: true,
    inputs: [{ itemCode: 'iron', name: 'Iron', quantity: 10 }],
    recipeSummary: '10 PP + 10 Iron = 1 Steel',
  },
  concrete: {
    itemCode: 'concrete',
    ppPerUnit: 10,
    isManufactured: true,
    inputs: [{ itemCode: 'limestone', name: 'Limestone', quantity: 10 }],
    recipeSummary: '10 PP + 10 Limestone = 1 Concrete',
  },
  paper: {
    itemCode: 'paper',
    ppPerUnit: 2,
    isManufactured: true,
    inputs: [{ itemCode: 'wood', name: 'Wood', quantity: 2 }],
    recipeSummary: '2 PP + 2 Wood = 1 Paper',
  },
  oil: {
    itemCode: 'oil',
    ppPerUnit: 4,
    isManufactured: true,
    inputs: [{ itemCode: 'petroleum', name: 'Petroleum', quantity: 2 }],
    recipeSummary: '4 PP + 2 Petroleum = 1 Refined Oil',
  },
  scraps: {
    itemCode: 'scraps',
    ppPerUnit: 1,
    isManufactured: true,
    inputs: [],
    recipeSummary: '1 PP = 1 Scrap',
  },

  // Manufactured Ammunition (All Calibers)
  lightAmmo: {
    itemCode: 'lightAmmo',
    ppPerUnit: 2,
    isManufactured: true,
    inputs: [{ itemCode: 'lead', name: 'Lead', quantity: 1 }],
    recipeSummary: '2 PP + 1 Lead = 1 Light Ammo',
  },
  ammo: {
    itemCode: 'ammo',
    ppPerUnit: 4,
    isManufactured: true,
    inputs: [{ itemCode: 'lead', name: 'Lead', quantity: 2 }],
    recipeSummary: '4 PP + 2 Lead = 1 Medium Ammo',
  },
  heavyAmmo: {
    itemCode: 'heavyAmmo',
    ppPerUnit: 10,
    isManufactured: true,
    inputs: [
      { itemCode: 'lead', name: 'Lead', quantity: 4 },
      { itemCode: 'steel', name: 'Steel', quantity: 1 },
    ],
    recipeSummary: '10 PP + 4 Lead + 1 Steel = 1 Heavy Ammo',
  },

  // Manufactured Food & Combat Consumables
  bread: {
    itemCode: 'bread',
    ppPerUnit: 2,
    isManufactured: true,
    inputs: [{ itemCode: 'grain', name: 'Grain', quantity: 2 }],
    recipeSummary: '2 PP + 2 Grain = 1 Bread',
  },
  steak: {
    itemCode: 'steak',
    ppPerUnit: 4,
    isManufactured: true,
    inputs: [{ itemCode: 'livestock', name: 'Livestock', quantity: 1 }],
    recipeSummary: '4 PP + 1 Livestock = 1 Steak',
  },
  cookedFish: {
    itemCode: 'cookedFish',
    ppPerUnit: 2,
    isManufactured: true,
    inputs: [{ itemCode: 'fish', name: 'Fish', quantity: 1 }],
    recipeSummary: '2 PP + 1 Fish = 1 Cooked Fish',
  },
  cocain: {
    itemCode: 'cocain',
    ppPerUnit: 10,
    isManufactured: true,
    inputs: [{ itemCode: 'coca', name: 'Plant', quantity: 5 }],
    recipeSummary: '10 PP + 5 Plant = 1 Pill',
  },
  redbull: {
    itemCode: 'redbull',
    ppPerUnit: 4,
    isManufactured: true,
    inputs: [],
    recipeSummary: '4 PP = 1 Energy Drink',
  },
  case1: {
    itemCode: 'case1',
    ppPerUnit: 10,
    isManufactured: true,
    inputs: [],
    recipeSummary: '10 PP = 1 Standard Crate',
  },
  case2: {
    itemCode: 'case2',
    ppPerUnit: 25,
    isManufactured: true,
    inputs: [],
    recipeSummary: '25 PP = 1 Elite Crate',
  },
};

export function getItemProductionRecipe(itemCode?: string): ItemProductionRecipe {
  const rawCode = String(itemCode || 'steel').trim();
  const lower = rawCode.toLowerCase();
  const canonicalId = COMMODITY_CODE_ALIASES[lower] || rawCode;
  if (ITEM_PRODUCTION_RECIPES[canonicalId]) {
    return ITEM_PRODUCTION_RECIPES[canonicalId];
  }
  const caseInsensitiveMatch = Object.values(ITEM_PRODUCTION_RECIPES).find(
    (r) => r.itemCode.toLowerCase() === canonicalId.toLowerCase() || r.itemCode.toLowerCase() === lower
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }
  const isManuf = isManufacturedCommodity(canonicalId);
  return {
    itemCode: canonicalId,
    ppPerUnit: isManuf ? 4 : 1,
    isManufactured: isManuf,
    inputs: [],
    recipeSummary: `${isManuf ? 4 : 1} PP = 1 ${canonicalId}`,
  };
}

/**
 * Resolves the real current market price (BTC per unit) for any War Era commodity code,
 * supporting live market orderbook data (`CommodityTrend[]`) and optional manual overrides.
 */
export function resolveCommodityLivePriceBtc(
  itemCode?: string,
  commodities?: CommodityTrend[],
  manualOverridePriceBtc?: number | null
): ResolvedCommodityPriceInfo {
  const rawCode = String(itemCode || 'steel').trim();
  const lower = rawCode.toLowerCase();
  const canonicalId = COMMODITY_CODE_ALIASES[lower] || rawCode;
  const canonicalLower = String(canonicalId || 'steel').toLowerCase();

  const sourceList =
    Array.isArray(commodities) && commodities.length > 0
      ? commodities
      : getCachedOrFallbackMarketTrends();

  const matchedTrend =
    sourceList.find((c) => {
      const cId = String(c?.id || (c as any)?.itemCode || '').toLowerCase();
      const cName = String(c?.name || '').toLowerCase();
      return cId === canonicalLower || cId === lower || cName === lower;
    }) ||
    sourceList.find((c) => {
      const cId = String(c?.id || (c as any)?.itemCode || '').toLowerCase();
      const cName = String(c?.name || '').toLowerCase();
      return (cId && cId.includes(canonicalLower)) || (cName && cName.includes(canonicalLower));
    });

  const canonicalMeta =
    CANONICAL_24_COMMODITIES.find((c) => {
      const codeLower = String(c?.itemCode || (c as any)?.id || '').toLowerCase();
      const nameLower = String(c?.name || '').toLowerCase();
      return codeLower === canonicalLower || codeLower === lower || nameLower === lower;
    }) || CANONICAL_24_COMMODITIES.find((c) => c.itemCode === 'steel') || CANONICAL_24_COMMODITIES[0];

  const fallbackTrends = generateFallbackMarketTrends();
  const fallbackMatch = fallbackTrends.find(
    (f) => String(f?.id || '').toLowerCase() === String(canonicalMeta?.itemCode || 'steel').toLowerCase()
  );

  const hasLiveCommodities = Array.isArray(commodities) && commodities.length > 0 && Boolean(matchedTrend);
  const liveMarketPriceBtc =
    matchedTrend && matchedTrend.currentPrice > 0
      ? matchedTrend.currentPrice
      : fallbackMatch?.currentPrice ?? 0.25;

  const hasValidOverride =
    typeof manualOverridePriceBtc === 'number' &&
    !isNaN(manualOverridePriceBtc) &&
    manualOverridePriceBtc > 0;

  const unitPriceBtc = hasValidOverride ? manualOverridePriceBtc! : liveMarketPriceBtc;
  const priceSource: 'manual-override' | 'live-market' | 'baseline' = hasValidOverride
    ? 'manual-override'
    : hasLiveCommodities
    ? 'live-market'
    : 'baseline';

  const resolvedCode = matchedTrend?.id || canonicalMeta?.itemCode || 'steel';

  return {
    itemCode: rawCode,
    canonicalId: resolvedCode,
    commodityName: matchedTrend?.name || canonicalMeta?.name || rawCode,
    unit: matchedTrend?.unit || canonicalMeta?.unit || 'unit',
    isManufactured: isManufacturedCommodity(resolvedCode),
    unitPriceBtc: Math.round(unitPriceBtc * 1000) / 1000,
    liveMarketPriceBtc: Math.round(liveMarketPriceBtc * 1000) / 1000,
    lowestAskBtc: matchedTrend?.lowestAsk ?? Math.round(liveMarketPriceBtc * 1.02 * 1000) / 1000,
    highestBidBtc: matchedTrend?.highestBid ?? Math.round(liveMarketPriceBtc * 0.98 * 1000) / 1000,
    avg7dBtc: matchedTrend?.avg7d ?? liveMarketPriceBtc,
    change24hPct: matchedTrend?.change24h ?? 0,
    priceSource,
  };
}

/**
 * Extract structured v0.27.3 CitizenSkillBreakdown from WareraUserLite.
 * Hotfix 0.27.3 removed Leadership and fused its training/event effects into Management.
 */
export function extractCitizenSkillBreakdown(user?: WareraUserLite): CitizenSkillBreakdown {
  const s = user?.skills || {};
  const companies = Number(s.companies?.level ?? 0);
  const leadership = 0; // Removed in Hotfix 0.27.3 (fused into Management)
  const legacyEntrepreneurship = Number(s.entrepreneurship?.level ?? 0);
  const management = Number(s.management?.level ?? 0);
  const energy = Number(s.energy?.level ?? 0);
  const production = Number(s.production?.level ?? 0);
  const lootChance = Number(s.lootChance?.level ?? (s as any).luck?.level ?? 0);

  return {
    companies,
    leadership,
    management,
    energy,
    production,
    lootChance,
    legacyEntrepreneurship,
    attack: Number(s.attack?.level ?? 0),
    criticalDamages: Number(s.criticalDamages?.level ?? 0),
    criticalChance: Number(s.criticalChance?.level ?? 0),
    armor: Number(s.armor?.level ?? 0),
    precision: Number(s.precision?.level ?? 0),
    dodge: Number(s.dodge?.level ?? 0),
    health: Number(s.health?.level ?? 0),
    stamina: Number(s.stamina?.level ?? 0),
  };
}

/**
 * Level-Aware Skill Build Evaluator (War Era Hotfix 0.27.3)
 * Incorporates the post-0.27.3 economy rules and Level 50 + Prestige SP math:
 * - Max player level is Level 50 (200 base SP), after which players Prestige (+1 respec-able SP per prestige that ignores skill caps).
 * - Hotfix 0.27.3 fused Leadership into Management (+2% employee output/lvl up to +22% AND better training card draws / event odds).
 * - Because maxing Companies (55 SP) + Management (55 SP) + Energy (55 SP) costs at most 165 SP, Level 26–50 (and Prestige) Eco players
 *   now have 35+ base SP (plus Prestige SP) to invest into high Production (Lvl 7–8+) alongside a full 36-employee workforce.
 * - Levels 1–25 SHOULD invest in Production + Energy because self-working companies is more profitable at early levels than paying NPC wages.
 */
export function evaluateCitizenSkillBuild(
  level: number,
  playstyle: PlaystyleMode,
  skills: CitizenSkillBreakdown,
  companiesCount = 2
): CitizenBuildEvaluation {
  const effectiveLevel = Math.min(50, Math.max(1, level || 1));
  const isEarlyLevel = effectiveLevel <= 25;
  const managementBoostPct = skills.management * 2; // +2% employee output per Management point + fused training/event quality in v0.27.3
  const energyPoolMax = 100 + skills.energy * 10; // Base 100 + 10 per Energy level

  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (skills.legacyEntrepreneurship > 0 && skills.management === 0) {
    warnings.push(
      `Legacy Entrepreneurship detected (${skills.legacyEntrepreneurship} SP): Hotfix 0.27.3 fused workforce training and +2%/lvl output into Management. Refresh profile or reallocate refunded SP.`
    );
  }

  // =========================================================================
  // CASE 1: EARLY GAME PLAYERS (LEVELS 1 - 25)
  // =========================================================================
  if (isEarlyLevel) {
    if (playstyle === 'pure-war') {
      return {
        grade: 'war-ready',
        badgeLabel: '⚔️ War Ready (Early Lvl)',
        shortLabel: 'War Ready',
        archetypeLabel: 'Early-Level Frontline Fighter',
        score: 90,
        isLevelEarlySelfWork: false,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `Level ${effectiveLevel} War Build: Focused on combat stats with ${skills.companies} Company SP and ${skills.lootChance} Luck SP.`,
        recommendations: [
          'During active war at Lvl 1–25, no extra Eco SP is needed beyond Companies and Luck.',
          'When rotating to Eco, invest in Production + Energy for self-work until Level 26–50.',
        ],
        warnings,
      };
    }

    // Levels 1-25 Eco or Hybrid: Self-work Production + Energy is optimal!
    if (skills.production > 0 || skills.energy > 0) {
      recommendations.push(
        `Level ${effectiveLevel} Caveat Active: Self-working companies with Production (${skills.production}) + Energy (${skills.energy}) is more profitable at Lvl 1–25 than paying hourly NPC employee wages.`
      );
      recommendations.push(
        'Upgrade Breakrooms toward Level 3 using steel reserves as you approach Level 26–50, then transition into Management + Energy (plus Production) for 3-employee rosters.'
      );
      return {
        grade: 'optimal-early-selfwork',
        badgeLabel: '🌱 Optimal Lvl 1–25 Self-Work',
        shortLabel: 'Optimal Lvl 1–25',
        archetypeLabel: 'Early-Game Self-Work Industrialist (Lvl 1–25)',
        score: 94,
        isLevelEarlySelfWork: true,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `Optimal early-level economy build (Lvl ${effectiveLevel}): Investing in Production (${skills.production}) & Energy (${skills.energy}) maximizes self-work output before bot wages become cost-effective.`,
        recommendations,
        warnings,
      };
    } else {
      warnings.push(
        `At Level ${effectiveLevel} (Lvl 1–25 bracket), relying solely on NPC employees without self-work Production/Energy often loses money to hourly wages.`
      );
      recommendations.push(
        'Allocate SP into Production and Energy at Levels 1–25 to self-work your companies profitably until you have the capital and SP for Level 3 Breakrooms.'
      );
      return {
        grade: 'suboptimal-sp',
        badgeLabel: '⚠️ Early Lvl No Self-Work',
        shortLabel: 'Low Self-Work SP',
        archetypeLabel: 'Premature Manager Build (Lvl 1–25)',
        score: 62,
        isLevelEarlySelfWork: false,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `Level ${effectiveLevel} citizen has 0 Production/Energy SP. At Levels 1–25, self-work is more profitable than paying bot wages.`,
        recommendations,
        warnings,
      };
    }
  }

  // =========================================================================
  // CASE 2: HIGH-LEVEL WAR PLAYERS (LEVEL 26–50, PURE WAR)
  // =========================================================================
  if (playstyle === 'pure-war') {
    const wastedEcoSp = skills.production + skills.management;
    if (wastedEcoSp <= 2) {
      recommendations.push(
        'Wartime Spec Rule: No extra SP in Eco is needed during active war apart from Companies and Luck.',
        'Ensure your pre-trained bot employees stay above 30 happiness so they continue producing passively while you fight.'
      );
      return {
        grade: 'war-ready',
        badgeLabel: '⚔️ Optimal War Spec',
        shortLabel: 'War Optimal',
        archetypeLabel: 'Wartime Combat Spec (Lvl 26–50)',
        score: 96,
        isLevelEarlySelfWork: false,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `Optimal Wartime Spec (Lvl ${effectiveLevel}): Combat-focused with ${skills.companies} Companies SP and ${skills.lootChance} Luck SP.`,
        recommendations,
        warnings,
      };
    } else {
      warnings.push(
        `Has ${wastedEcoSp} levels split into Production/Management while in War stance.`
      );
      recommendations.push(
        'While in active War mode, keep Eco SP strictly in Companies and Luck, or commit to an Eco training cycle with Management + Energy.'
      );
      return {
        grade: 'war-eco-builder',
        badgeLabel: '🛡️ War / Eco Transition',
        shortLabel: 'War-in-Eco',
        archetypeLabel: 'Wartime Industrial Hybrid',
        score: 80,
        isLevelEarlySelfWork: false,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `War player retaining ${wastedEcoSp} Eco skill levels across Production/Management.`,
        recommendations,
        warnings,
      };
    }
  }

  // =========================================================================
  // CASE 3: HIGH-LEVEL HYBRID / WAR PLAYERS IN ECO (LEVEL 26–50)
  // =========================================================================
  if (playstyle === 'hybrid') {
    if (skills.management > 0 && skills.energy > 0) {
      recommendations.push(
        'War-in-Eco Rule (Hotfix 0.27.3): Investing SP in Management (+2%/lvl output & training card quality) and Energy builds strong, high-trait bot employees that keep earning during your next war period.',
        'Upgrade all company Breakrooms to Level 3 (3 employees each) before rotating back to War spec.'
      );
      return {
        grade: 'war-eco-builder',
        badgeLabel: '⚡ Optimal War-in-Eco',
        shortLabel: 'War-in-Eco Meta',
        archetypeLabel: 'War Player in Eco Training Cycle',
        score: 92,
        isLevelEarlySelfWork: false,
        isHighLevelViableSelfWork: false,
        managementBoostPct,
        energyPoolMax,
        summary: `Aligned with v0.27.3 War-in-Eco strategy: Management (${skills.management}, +${managementBoostPct}%) + Energy (${skills.energy}) to train permanent bot employees for wartime income.`,
        recommendations,
        warnings,
      };
    }
  }

  // =========================================================================
  // CASE 4: HIGH-LEVEL ECO PLAYERS (LEVEL 26–50 & PRESTIGE)
  // =========================================================================
  const hasStrongManagement =
    skills.management >= 3 ||
    (skills.management >= 2 && (skills.companies >= 3 || skills.energy >= 2));
  const hasHighProductionAndEnergy = skills.production >= 3 && skills.energy >= 2;

  // 4A. Hotfix 0.27.3 Workforce + High Production Hybrid Meta (Companies + Management + Energy + Surplus SP in Production)
  if (hasStrongManagement) {
    if (skills.companies < 6 && companiesCount < 8) {
      recommendations.push('Scale toward 10–12 active companies with Level 3 Breakrooms (3 employees per company = up to 36 total bot workers).');
    }
    recommendations.push(
      `Hotfix 0.27.3 Management (Lvl ${skills.management}): Grants +${managementBoostPct}% bot employee output AND fused training card/event quality.`
    );
    if (skills.production >= 4) {
      recommendations.push(
        `Post-0.27.3 SP Surplus Active: Because Leadership was fused into Management (max 165 SP for Companies+Management+Energy), investing surplus SP & Prestige SP into Production (Lvl ${skills.production}) adds strong self-work output on top of your bot workforce.`
      );
    } else {
      recommendations.push(
        'Post-0.27.3 Level 26–50 Tip: With Leadership fused into Management, maxing Companies + Management + Energy costs at most 165 SP—leaving 35+ base SP at Lvl 50 (plus Prestige SP) to invest in high Production (Lvl 7–8+) for bonus self-work.'
      );
    }

    return {
      grade: 'optimal-meta',
      badgeLabel: skills.production >= 4 ? '🌟 Optimal v0.27.3 Workforce+Prod' : '🌟 Optimal v0.27.3 Eco Meta',
      shortLabel: 'Optimal v0.27.3 Meta',
      archetypeLabel: skills.production >= 4 ? 'v0.27.3 Workforce + High Production Hybrid' : 'v0.27.3 Workforce & Management Meta',
      score: 98,
      isLevelEarlySelfWork: false,
      isHighLevelViableSelfWork: false,
      managementBoostPct,
      energyPoolMax,
      summary: `High-efficiency v0.27.3 Eco Build (Lvl ${effectiveLevel}): Management Lvl ${skills.management} (+${managementBoostPct}% & training), Energy (${energyPoolMax} cap), Companies (${skills.companies}), Production (${skills.production}).`,
      recommendations,
      warnings,
    };
  }

  // 4B. High-Level Pure Self-Work Build (Skips Management <2, Maxes Production + Energy — Viable)
  if (skills.management <= 1 && (hasHighProductionAndEnergy || skills.production >= 4)) {
    warnings.push(
      `Pure Self-Work Build (Management ${skills.management}, Production ${skills.production}, Energy ${skills.energy}): Skipping Management at Level ${effectiveLevel} leaves +2%/lvl bot output and training quality on the table, though self-work remains viable.`
    );
    recommendations.push(
      'Viable Self-Work Assessment: Your high Production + Energy self-work output generates steady personal PP.',
      'Hotfix 0.27.3 Upgrade Path: Since Leadership was fused into Management, you no longer have to choose between a bot workforce and high Production—maxing Companies + Management + Energy costs 165 SP, leaving 35+ SP at Lvl 50 (plus Prestige SP) for Lvl 7–8+ Production.'
    );
    return {
      grade: 'viable-selfwork',
      badgeLabel: '🛠️ Viable (Prod+Energy Self-Work)',
      shortLabel: 'Viable Self-Work',
      archetypeLabel: 'High-Level Self-Work Grinder (Viable / Low Mgmt)',
      score: 78,
      isLevelEarlySelfWork: false,
      isHighLevelViableSelfWork: true,
      managementBoostPct,
      energyPoolMax,
      summary: `Level ${effectiveLevel} citizen has low Management (${skills.management}) and focuses on Production (${skills.production}) + Energy (${skills.energy}). Viable self-work output, though adding Management unlocks full v0.27.3 bot workforce scaling.`,
      recommendations,
      warnings,
    };
  }

  // 4C. Suboptimal / Unbalanced High-Level Build
  warnings.push(
    `Unoptimized v0.27.3 Eco SP distribution at Level ${effectiveLevel} (Management: ${skills.management}, Energy: ${skills.energy}, Production: ${skills.production}, Companies: ${skills.companies}).`
  );
  recommendations.push(
    'Recommended v0.27.3 Eco Build (Lvl 26–50 & Prestige): Invest in Companies + Management (+2% bot output/lvl & fused training quality) + Energy, and allocate surplus SP into Production.',
    'Alternative Viable Path: Pair high Energy with Production for manual self-work.'
  );

  return {
    grade: 'suboptimal-sp',
    badgeLabel: '⚠️ Suboptimal v0.27.3 SP Split',
    shortLabel: 'Needs SP Rework',
    archetypeLabel: 'Unoptimized Skill Allocation',
    score: 55,
    isLevelEarlySelfWork: false,
    isHighLevelViableSelfWork: false,
    managementBoostPct,
    energyPoolMax,
    summary: `Level ${effectiveLevel} build lacks both Management (${skills.management}) for bot workforce output/training and sufficient Energy (${skills.energy}) + Production (${skills.production}) for self-work.`,
    recommendations,
    warnings,
  };
}

export interface EvaluatedEmployeeResult {
  employee: WareraBotEmployee;
  baseProduction: number;
  flatTraitBonus: number;
  pctTraitBonus: number;
  effectiveHappiness: number;
  happinessModifierPct: number;
  managementModifierPct: number;
  hourlyPP: number;
  effectivePP: number; // Alias for hourlyPP
  dailyPP: number;
  dailyUnitsProduced: number;
  dailyRevenueBtc: number;
  dailyRawInputCostBtc: number;
  dailyValueAddedBtc: number;
  dailyWageBtc: number;
  dailyNetProfitBtc: number;
  dailyNetProfitAfterInputsBtc: number;
  isWalkoutRisk: boolean; // Happiness < 30
  shouldRerollOrFire: boolean; // Age >= 35 with low potential and no Late Bloomer
  activeSynergies: string[];
  activeConflicts: string[];
  warnings: string[]; // Alias for activeConflicts
}

export interface CompanyWorkforceEvaluation {
  companyId: string;
  companyName: string;
  itemCode: string;
  commodityName: string;
  commodityUnit: string;
  isManufactured: boolean;
  unitMarketPriceBtc: number;
  liveMarketPriceBtc: number;
  priceSource: 'manual-override' | 'live-market' | 'baseline';
  ppPerUnit: number;
  recipeSummary: string;
  recipeInputs: Array<{
    itemCode: string;
    name: string;
    quantityPerUnit: number;
    liveUnitPriceBtc: number;
    costPerOutputUnitBtc: number;
  }>;
  rawInputCostPerUnitBtc: number;
  netMarginPerUnitBtc: number;
  breakRoomLevel: number; // 1, 2, or 3
  maxEmployeeSlots: number; // 1, 2, or 3
  activeEmployeesCount: number;
  reportedWorkerCount: number;
  hasLiveEmployeeDetails: boolean;
  steelNeededForLvl3: number; // 100 steel total (20 for L2 + 80 for L3)
  isBreakRoomMaxed: boolean;
  hasManager: boolean;
  isSafeHomelandRegion: boolean;
  engineHourlyPP: number;
  workforceHourlyPP: number;
  totalDailyPP: number;
  dailyUnitsProduced: number;
  dailyRawInputCostBtc: number;
  dailyValueAddedBtc: number;
  totalDailyWagesBtc: number;
  estimatedDailyRevenueBtc: number;
  totalDailyNetProfitBtc: number;
  estimatedDailyNetProfitBtc: number;
  estimatedDailyNetProfitAfterInputsBtc: number;
  overallScore: number;
  saddestEmployeeId?: string;
  highestEarnerEmployeeId?: string;
  evaluatedEmployees: EvaluatedEmployeeResult[];
  employeeBreakdown: EvaluatedEmployeeResult[];
  companyAdvisories: string[];
  recommendations: string[];
}

/**
 * Creates a single clean employee slot when the user explicitly chooses to configure/test
 * a bot worker in the Manual Trait Inspector.
 */
export function createEmptyEmployeeSlot(
  companyId: string,
  slotIndex: number,
  itemCode = 'steel',
  ownerCountryName = 'Homeland'
): WareraBotEmployee {
  const isManuf = isManufacturedCommodity(itemCode);
  return {
    id: `${companyId}_emp_${slotIndex + 1}`,
    name: `Bot Slot #${slotIndex + 1}`,
    age: 20,
    sex: 'male',
    nationality: ownerCountryName,
    happiness: 60,
    trainingPotential: 10,
    trainingUsed: 5,
    tenureDays: 14,
    isSpecializedInGood: true,
    hasTool: slotIndex === 0,
    toolTier: slotIndex === 0 ? 'rare' : undefined,
    stats: { production: 3, luck: 3, responsibility: 3 },
    traits: [isManuf ? 'craftsman' : 'laborer'],
    hourlyWageBtc: 0.5,
  };
}

/**
 * Generates sandbox template employees ONLY when explicitly requested in the Simulator
 */
export function createDefaultCompanyEmployees(
  companyOrId: WareraCompany | string,
  ownerCountryName = 'Homeland',
  explicitCount?: number
): WareraBotEmployee[] {
  if (typeof companyOrId === 'object' && companyOrId !== null && Array.isArray(companyOrId.employees) && companyOrId.employees.length > 0) {
    return companyOrId.employees;
  }

  const companyId = typeof companyOrId === 'string' ? companyOrId : (companyOrId?._id || 'comp');
  const itemCode = typeof companyOrId === 'object' && companyOrId ? companyOrId.itemCode : ownerCountryName;
  const breakRoomLvl =
    typeof companyOrId === 'object' && companyOrId
      ? Math.min(3, Math.max(1, Number(companyOrId.activeUpgradeLevels?.breakRoom ?? 3)))
      : Math.min(3, Math.max(1, explicitCount ?? 3));
  const count = explicitCount !== undefined ? Math.min(3, Math.max(0, explicitCount)) : breakRoomLvl;

  return Array.from({ length: count }, (_, idx) =>
    createEmptyEmployeeSlot(companyId, idx, itemCode, typeof companyOrId === 'object' ? ownerCountryName : 'Homeland')
  );
}

/**
 * Evaluates a company's Breakroom capacity, Bot Employee roster, Piraterers trait synergies,
 * happiness walkout risks (<30), and Manager optimizations.
 * STRICT LIVE DATA INTEGRITY: Never fabricates employees if none are present on `company.employees` or `customRoster`.
 */
export function evaluateCompanyWorkforce(
  company: WareraCompany,
  customRosterOrMgmt?: WareraBotEmployee[] | number,
  playerManagementLevelOrTax = 0,
  countryIncomeTaxPct = 15,
  unitMarketPriceOrCountry?: number | string | CommodityTrend[],
  commoditiesOptional?: CommodityTrend[],
  manualOverridePriceBtc?: number | null
): CompanyWorkforceEvaluation {
  const passedCommodities = Array.isArray(unitMarketPriceOrCountry)
    ? unitMarketPriceOrCountry
    : commoditiesOptional;
  const explicitNumericPrice =
    typeof unitMarketPriceOrCountry === 'number' && !isNaN(unitMarketPriceOrCountry) && unitMarketPriceOrCountry > 0
      ? unitMarketPriceOrCountry
      : manualOverridePriceBtc;

  const resolvedPrice = resolveCommodityLivePriceBtc(
    company?.itemCode,
    passedCommodities,
    explicitNumericPrice
  );
  const unitMarketPriceBtc = resolvedPrice.unitPriceBtc;
  const itemRecipe = getItemProductionRecipe(resolvedPrice.canonicalId || company?.itemCode);
  const ppPerUnit = Math.max(1, itemRecipe.ppPerUnit);
  const isManuf = itemRecipe.isManufactured;

  // Value all required raw material inputs at their live market prices
  const recipeInputs = itemRecipe.inputs.map((inp) => {
    const inpResolved = resolveCommodityLivePriceBtc(inp.itemCode, passedCommodities);
    const costPerOutputUnitBtc = Math.round(inp.quantity * inpResolved.liveMarketPriceBtc * 1000) / 1000;
    return {
      itemCode: inp.itemCode,
      name: inp.name,
      quantityPerUnit: inp.quantity,
      liveUnitPriceBtc: inpResolved.liveMarketPriceBtc,
      costPerOutputUnitBtc,
    };
  });
  const rawInputCostPerUnitBtc =
    Math.round(recipeInputs.reduce((sum, r) => sum + r.costPerOutputUnitBtc, 0) * 1000) / 1000;
  const netMarginPerUnitBtc = Math.round((unitMarketPriceBtc - rawInputCostPerUnitBtc) * 1000) / 1000;
  const rawBreakRoom = Number(
    company?.activeUpgradeLevels?.breakRoom ??
      (company?.workerCount ? Math.min(3, Math.max(1, company.workerCount)) : 1)
  );
  const breakRoomLevel = Math.min(3, Math.max(1, isNaN(rawBreakRoom) ? 1 : rawBreakRoom));
  const maxEmployeeSlots = breakRoomLevel; // Lvl 1 = 1, Lvl 2 = 2, Lvl 3 = 3
  const steelNeededForLvl3 = breakRoomLevel === 1 ? 100 : breakRoomLevel === 2 ? 80 : 0;
  const isBreakRoomMaxed = breakRoomLevel >= 3;

  // Defensive parameter normalization so passing a number as the 2nd arg never crashes
  let customRoster: WareraBotEmployee[] | undefined;
  let playerManagementLevel = 0;
  if (Array.isArray(customRosterOrMgmt)) {
    customRoster = customRosterOrMgmt;
    playerManagementLevel = typeof playerManagementLevelOrTax === 'number' ? playerManagementLevelOrTax : 0;
  } else if (typeof customRosterOrMgmt === 'number') {
    customRoster = undefined;
    playerManagementLevel = customRosterOrMgmt;
  } else {
    customRoster = undefined;
    playerManagementLevel = typeof playerManagementLevelOrTax === 'number' ? playerManagementLevelOrTax : 0;
  }

  const rawSourceRoster = Array.isArray(customRoster)
    ? customRoster
    : Array.isArray(company?.employees)
    ? company.employees
    : [];

  // Normalize every employee item defensively
  const activeEmployees: WareraBotEmployee[] = rawSourceRoster
    .filter((e): e is WareraBotEmployee => Boolean(e && typeof e === 'object'))
    .slice(0, maxEmployeeSlots)
    .map((e, idx) => ({
      id: e.id || `${company?._id || 'comp'}_emp_${idx + 1}`,
      name: e.name || `Employee #${idx + 1}`,
      age: Number(e.age ?? 20),
      sex: e.sex === 'female' || (e as any).gender === 'female' ? 'female' : 'male',
      nationality: String(e.nationality || 'Homeland'),
      happiness: Number(e.happiness ?? 50),
      trainingPotential: Number(e.trainingPotential ?? (e as any).trainingSessionsMax ?? 10),
      trainingUsed: Number(e.trainingUsed ?? (e as any).trainingSessionsUsed ?? 4),
      tenureDays: Number(e.tenureDays ?? (e as any).daysInCompany ?? 10),
      isSpecializedInGood: Boolean(
        e.isSpecializedInGood !== undefined
          ? e.isSpecializedInGood
          : (e as any).isSpecializedInCompanyItem !== undefined
          ? (e as any).isSpecializedInCompanyItem
          : true
      ),
      hasTool: Boolean(e.hasTool),
      toolTier: e.toolTier,
      stats: {
        production: Number(e.stats?.production ?? (e as any).baseProduction ?? 3),
        luck: Number(e.stats?.luck ?? 2),
        responsibility: Number(e.stats?.responsibility ?? 3),
      },
      traits: Array.isArray(e.traits) ? e.traits : [],
      hourlyWageBtc: Number(e.hourlyWageBtc ?? (e as any).wageBtc ?? 0.5),
    }));

  const coworkerCount = Math.max(0, activeEmployees.length - 1);

  const autoLevel = Math.min(7, Math.max(1, Number(company?.activeUpgradeLevels?.automatedEngine ?? 1)));
  const engineHourlyPP = autoLevel * 2.5;
  const managementModifierPct = playerManagementLevel * 2; // +2% per Management point

  // Roster-wide tallies for coworker synergy traits
  const bullyCount = activeEmployees.filter((e) => e.traits.includes('bully')).length;
  const comicCount = activeEmployees.filter((e) => e.traits.includes('comic')).length;
  const maxWageOnRoster = activeEmployees.reduce((max, e) => Math.max(max, e.hourlyWageBtc), 0);
  const maxBaseProdOnRoster = activeEmployees.reduce((max, e) => Math.max(max, e.stats.production), 0);

  const evaluatedEmployees: EvaluatedEmployeeResult[] = activeEmployees.map((emp) => {
    const synergies: string[] = [];
    const conflicts: string[] = [];

    let flatBonus = 0;
    let pctBonus = 0;

    // Calculate net coworker happiness shifts (Comic +10, Bully -10, Loyal halves loss)
    const otherComics = comicCount - (emp.traits.includes('comic') ? 1 : 0);
    const otherBullies = bullyCount - (emp.traits.includes('bully') ? 1 : 0);
    let happinessDelta = otherComics * 10;
    const rawHappinessLoss = otherBullies * 10;
    const effectiveLoss = emp.traits.includes('loyal') ? rawHappinessLoss * 0.5 : rawHappinessLoss;
    happinessDelta -= effectiveLoss;

    if (emp.traits.includes('specialist') && emp.isSpecializedInGood) {
      flatBonus += 3;
      happinessDelta += 5;
      synergies.push('Specialist (+3 Prod, +5 Happy in matching product)');
    } else if (emp.traits.includes('specialist') && !emp.isSpecializedInGood) {
      conflicts.push('Specialist moved to non-specialized good (lost +3 Prod & +5 Happy)');
    }

    if (emp.traits.includes('patriot')) {
      if (company.isHomelandSafeRegion !== false) {
        flatBonus += 2;
        happinessDelta += 10;
        synergies.push('Patriot (+2 Prod, +10 Happy in homeland region)');
      } else {
        conflicts.push('Patriot working outside core homeland region');
      }
    }

    if (emp.traits.includes('expat') && emp.nationality.toLowerCase() === 'foreign') {
      flatBonus += 2;
      synergies.push('Expat (+2 Prod working abroad)');
    }

    // Craftsman vs Laborer
    if (emp.traits.includes('craftsman')) {
      if (isManuf) {
        flatBonus += 3;
        synergies.push('Craftsman (+3 Prod on manufactured good)');
      } else {
        flatBonus -= 1;
        conflicts.push('Craftsman in Raw Resource factory (-1 Prod penalty!)');
      }
    }

    if (emp.traits.includes('laborer')) {
      if (!isManuf) {
        flatBonus += 3;
        synergies.push('Laborer (+3 Prod on raw resource)');
      } else {
        flatBonus -= 1;
        conflicts.push('Laborer in Manufactured factory (-1 Prod penalty!)');
      }
    }

    // Late Bloomer (+2 per 10 years past 40)
    if (emp.traits.includes('late_bloomer')) {
      const decadesPast40 = Math.max(0, Math.floor((emp.age - 40) / 10));
      if (decadesPast40 > 0) {
        const boost = decadesPast40 * 2;
        flatBonus += boost;
        synergies.push(`Late Bloomer (+${boost} Prod at age ${emp.age})`);
      } else {
        conflicts.push(`Late Bloomer is under age 50 (age ${emp.age}; +0 Prod until 50+)`);
      }
    }

    // Cosmopolitan (+2 per foreign nationality on roster, up to +4)
    if (emp.traits.includes('cosmopolitan')) {
      const foreignCoworkers = activeEmployees.filter(
        (other) => other.id !== emp.id && other.nationality.toLowerCase() !== emp.nationality.toLowerCase()
      ).length;
      const boost = Math.min(4, foreignCoworkers * 2);
      if (boost > 0) {
        flatBonus += boost;
        synergies.push(`Cosmopolitan (+${boost} Prod from foreign coworkers)`);
      }
    }

    // Diamond in the Rough (+1 stat every 10 days, up to +4)
    if (emp.traits.includes('diamond_in_the_rough')) {
      const boost = Math.min(4, Math.floor((emp.tenureDays || 0) / 10));
      if (boost > 0) {
        flatBonus += boost;
        synergies.push(`Diamond in the Rough (+${boost} stat from ${emp.tenureDays}d tenure)`);
      }
    }

    // Rival (+3 if out-produced, -1 if top of roster)
    if (emp.traits.includes('rival') && coworkerCount > 0) {
      if (emp.stats.production < maxBaseProdOnRoster) {
        flatBonus += 3;
        synergies.push('Rival (+3 Prod chasing higher-producing coworker)');
      } else {
        flatBonus -= 1;
        conflicts.push('Rival is top producer on roster (-1 Prod penalty)');
      }
    }

    // Comic (-1 self prod, +10 coworker happiness)
    if (emp.traits.includes('comic')) {
      flatBonus -= 1;
      synergies.push('Comic (-1 self Prod, +10 Happiness to all coworkers)');
    }

    // Bully (+2 self prod with coworkers, -10 coworker happiness)
    if (emp.traits.includes('bully') && coworkerCount > 0) {
      flatBonus += 2;
      synergies.push('Bully (+2 self Prod, -10 Happiness to coworkers)');
    }

    // Nationalist (+2 prod & +5 happy if >=50% coworkers share nationality)
    if (emp.traits.includes('nationalist') && coworkerCount > 0) {
      const sameNat = activeEmployees.filter(
        (other) => other.id !== emp.id && other.nationality.toLowerCase() === emp.nationality.toLowerCase()
      ).length;
      if (sameNat / coworkerCount >= 0.5) {
        flatBonus += 2;
        happinessDelta += 5;
        synergies.push('Nationalist (+2 Prod, +5 Happy with compatriots)');
      }
    }

    // Multiplicative % Traits
    // Handy (+40% with tool)
    if (emp.traits.includes('handy')) {
      if (emp.hasTool) {
        pctBonus += 40;
        synergies.push('Handy (+40% Prod holding tool)');
      } else {
        conflicts.push('Handy employee has NO tool equipped (+40% bonus wasted!)');
      }
    }

    // Improviser (+25% without tool)
    if (emp.traits.includes('improviser')) {
      if (!emp.hasTool) {
        pctBonus += 25;
        synergies.push('Improviser (+25% Prod bare-handed)');
      } else {
        conflicts.push('Improviser is holding a tool (+25% bare-handed bonus lost — give tool to a Handy worker)');
      }
    }

    // Sociable (+25% per coworker, max +50%; unhappy alone)
    if (emp.traits.includes('sociable')) {
      if (coworkerCount > 0) {
        const boost = Math.min(50, coworkerCount * 25);
        pctBonus += boost;
        synergies.push(`Sociable (+${boost}% Prod with ${coworkerCount} coworker${coworkerCount > 1 ? 's' : ''})`);
      } else {
        happinessDelta -= 15;
        conflicts.push('Sociable worker is alone in company (unhappy & +0% bonus)');
      }
    }

    // Girl Power (+15% per female coworker, max +30%, women only)
    if (emp.traits.includes('girl_power')) {
      if (emp.sex === 'female') {
        const femaleCoworkers = activeEmployees.filter((o) => o.id !== emp.id && o.sex === 'female').length;
        const boost = Math.min(30, femaleCoworkers * 15);
        if (boost > 0) {
          pctBonus += boost;
          synergies.push(`Girl Power (+${boost}% Prod with ${femaleCoworkers} female coworker${femaleCoworkers > 1 ? 's' : ''})`);
        }
      } else {
        conflicts.push('Girl Power only activates on female employees');
      }
    }

    // Band of Brothers (+15% per male coworker, max +30%, men only)
    if (emp.traits.includes('band_of_brothers')) {
      if (emp.sex === 'male') {
        const maleCoworkers = activeEmployees.filter((o) => o.id !== emp.id && o.sex === 'male').length;
        const boost = Math.min(30, maleCoworkers * 15);
        if (boost > 0) {
          pctBonus += boost;
          synergies.push(`Band of Brothers (+${boost}% Prod with ${maleCoworkers} male coworker${maleCoworkers > 1 ? 's' : ''})`);
        }
      } else {
        conflicts.push('Band of Brothers only activates on male employees');
      }
    }

    // Prima Donna (+20% if highest paid, -10 happy otherwise)
    if (emp.traits.includes('prima_donna') && coworkerCount > 0) {
      const strictlyHighestPaid = activeEmployees.every((o) => o.id === emp.id || emp.hourlyWageBtc > o.hourlyWageBtc);
      if (strictlyHighestPaid && emp.hourlyWageBtc >= maxWageOnRoster) {
        pctBonus += 20;
        synergies.push('Prima Donna (+20% Prod as highest-paid employee)');
      } else {
        happinessDelta -= 10;
        conflicts.push('Prima Donna is not out-earning all coworkers (-10 Happiness)');
      }
    }

    // Loner (+100% alone, 0% with coworkers)
    if (emp.traits.includes('loner')) {
      if (coworkerCount === 0) {
        pctBonus += 100;
        synergies.push('Loner (+100% Prod working solo)');
      } else {
        conflicts.push('Loner has coworkers (+100% solo bonus disabled!)');
      }
    }

    // Veteran (+20% after 30 days tenure)
    if (emp.traits.includes('veteran')) {
      if ((emp.tenureDays || 0) >= 30) {
        pctBonus += 20;
        synergies.push(`Veteran (+20% Prod from ${emp.tenureDays}d tenure)`);
      } else {
        synergies.push(`Veteran (${emp.tenureDays || 0}/30 days toward +20% Prod)`);
      }
    }

    // Scavenger (-25% prod, 2x toolbox chance)
    if (emp.traits.includes('scavenger')) {
      pctBonus -= 25;
      synergies.push('Scavenger (2x toolbox discovery & cap, -25% Prod)');
    }

    // Statist (+2 responsibility if income tax >= 20%)
    if (emp.traits.includes('statist') && countryIncomeTaxPct >= 20) {
      synergies.push('Statist (+2 Responsibility in 20%+ tax nation)');
    }

    const effectiveHappiness = Math.max(0, Math.min(100, emp.happiness + happinessDelta));
    const happinessModifierPct = effectiveHappiness - 50; // +/-1% per point away from 50
    const isWalkoutRisk = effectiveHappiness < 30;
    if (isWalkoutRisk) {
      conflicts.push(`CRITICAL: Happiness is ${effectiveHappiness} (<30) — employee risks leaving the company!`);
    }

    const shouldRerollOrFire =
      emp.age >= 35 &&
      emp.trainingPotential < 7 &&
      !emp.traits.includes('late_bloomer') &&
      emp.traits.length === 0;
    if (shouldRerollOrFire) {
      conflicts.push(`Age ${emp.age} with low training potential (${emp.trainingPotential}) and no Late Bloomer — BuhDeuce Guide recommends firing/replacing.`);
    }

    const effectiveBase = Math.max(0.5, emp.stats.production + flatBonus + emp.trainingUsed * 0.6);
    const totalMultiplier = Math.max(
      0.2,
      (1 + pctBonus / 100) * (1 + happinessModifierPct / 100) * (1 + managementModifierPct / 100)
    );
    const hourlyPP = Math.round(effectiveBase * totalMultiplier * 100) / 100;
    const dailyPP = Math.round(hourlyPP * 24 * 10) / 10;

    // Effective hourly wage (Modest gives -15% wage discount)
    const effectiveHourlyWage = emp.traits.includes('modest')
      ? Math.round(emp.hourlyWageBtc * 0.85 * 100) / 100
      : emp.hourlyWageBtc;
    const dailyWageBtc = Math.round(effectiveHourlyWage * 24 * 100) / 100;
    const dailyUnitsProduced = Math.round((dailyPP / ppPerUnit) * 100) / 100;
    const dailyRevenueBtc = Math.round(dailyUnitsProduced * unitMarketPriceBtc * 100) / 100;
    const empDailyRawInputCostBtc = Math.round(dailyUnitsProduced * rawInputCostPerUnitBtc * 100) / 100;
    const empDailyValueAddedBtc = Math.round((dailyRevenueBtc - empDailyRawInputCostBtc) * 100) / 100;
    const dailyNetProfitBtc = Math.round((dailyRevenueBtc - dailyWageBtc) * 100) / 100;
    const dailyNetProfitAfterInputsBtc = Math.round((empDailyValueAddedBtc - dailyWageBtc) * 100) / 100;

    return {
      employee: emp,
      baseProduction: emp.stats.production,
      flatTraitBonus: flatBonus,
      pctTraitBonus: pctBonus,
      effectiveHappiness,
      happinessModifierPct,
      managementModifierPct,
      hourlyPP,
      effectivePP: hourlyPP,
      dailyPP,
      dailyUnitsProduced,
      dailyRevenueBtc,
      dailyRawInputCostBtc: empDailyRawInputCostBtc,
      dailyValueAddedBtc: empDailyValueAddedBtc,
      dailyWageBtc,
      dailyNetProfitBtc,
      dailyNetProfitAfterInputsBtc,
      isWalkoutRisk,
      shouldRerollOrFire,
      activeSynergies: synergies,
      activeConflicts: conflicts,
      warnings: conflicts,
    };
  });

  // Identify Manager targets: Saddest employee (+5 happiness) & Highest net earner (+production)
  let saddestEmployeeId: string | undefined;
  let minHappy = 999;
  let highestEarnerEmployeeId: string | undefined;
  let maxNet = -999999;

  evaluatedEmployees.forEach((ev) => {
    if (ev.effectiveHappiness < minHappy) {
      minHappy = ev.effectiveHappiness;
      saddestEmployeeId = ev.employee.id;
    }
    if (ev.dailyNetProfitBtc > maxNet) {
      maxNet = ev.dailyNetProfitBtc;
      highestEarnerEmployeeId = ev.employee.id;
    }
  });

  const reportedWorkerCount = Number(company?.workerCount ?? activeEmployees.length ?? 0);
  const hasLiveEmployeeDetails = Array.isArray(company?.employees) && company.employees.length > 0;
  // If API only reported live production + workerCount without exposing private employee objects,
  // use the live reported company.production for accurate real output unless custom employees are configured:
  const liveReportedHourlyPP = Math.max(0, Number(company?.production || 0));
  const companyBonusPct = Math.max(0, Number((company as any)?.productionBonus ?? (company as any)?.bonus ?? 0));
  const rawWorkforceHourlyPP =
    activeEmployees.length > 0
      ? Math.round(evaluatedEmployees.reduce((s, e) => s + e.hourlyPP, 0) * 100) / 100
      : liveReportedHourlyPP;
  const workforceHourlyPP =
    companyBonusPct > 0
      ? Math.round(rawWorkforceHourlyPP * (1 + companyBonusPct / 100) * 100) / 100
      : rawWorkforceHourlyPP;

  const effectiveEngineHourlyPP =
    companyBonusPct > 0
      ? Math.round(engineHourlyPP * (1 + companyBonusPct / 100) * 100) / 100
      : engineHourlyPP;

  const totalDailyPP = Math.round((effectiveEngineHourlyPP + workforceHourlyPP) * 24 * 10) / 10;
  const dailyUnitsProduced = Math.round((totalDailyPP / ppPerUnit) * 100) / 100;
  const totalDailyWagesBtc =
    activeEmployees.length > 0
      ? Math.round(evaluatedEmployees.reduce((s, e) => s + e.dailyWageBtc, 0) * 100) / 100
      : Math.round(reportedWorkerCount * 0.5 * 24 * 100) / 100;
  const totalDailyRevenue = Math.round(dailyUnitsProduced * unitMarketPriceBtc * 100) / 100;
  const dailyRawInputCostBtc = Math.round(dailyUnitsProduced * rawInputCostPerUnitBtc * 100) / 100;
  const dailyValueAddedBtc = Math.round((totalDailyRevenue - dailyRawInputCostBtc) * 100) / 100;
  const totalDailyNetProfitBtc = Math.round((totalDailyRevenue - totalDailyWagesBtc) * 100) / 100;
  const estimatedDailyNetProfitAfterInputsBtc = Math.round((dailyValueAddedBtc - totalDailyWagesBtc) * 100) / 100;

  // Compute overall BuhDeuce readiness score (0-100)
  let overallScore = 50;
  if (isBreakRoomMaxed) overallScore += 20;
  else if (breakRoomLevel === 2) overallScore += 10;
  if (company?.hasManager || company?.managerId) overallScore += 10;
  if (activeEmployees.length > 0) {
    const avgSynergies =
      evaluatedEmployees.reduce((s, e) => s + e.activeSynergies.length - e.activeConflicts.length, 0) /
      activeEmployees.length;
    overallScore += Math.round(Math.max(-15, Math.min(20, avgSynergies * 8)));
  } else if (reportedWorkerCount > 0) {
    overallScore += Math.min(15, reportedWorkerCount * 5);
  }
  overallScore = Math.max(10, Math.min(100, overallScore));

  const advisories: string[] = [];
  if (!isBreakRoomMaxed) {
    advisories.push(
      `Insta-upgrade Breakroom from Level ${breakRoomLevel} to Level 3 (${steelNeededForLvl3} Steel needed) to unlock all 3 bot employee slots.`
    );
  }
  if (activeEmployees.length === 0 && reportedWorkerCount === 0) {
    advisories.push(
      'No active bot employees detected from live API. Sync company data or click "+ Configure Bot Slot" to evaluate traits.'
    );
  } else if (activeEmployees.length > 0 && activeEmployees.length < maxEmployeeSlots) {
    advisories.push(
      `Breakroom has ${maxEmployeeSlots - activeEmployees.length} open slot(s): Hire 1 young employee (age 19–21, 8–12+ trainings) and train immediately before hiring the next.`
    );
  }
  if (!company?.hasManager && (activeEmployees.length >= 2 || reportedWorkerCount >= 2)) {
    advisories.push(
      'Hire a trusted Player Manager to click your saddest employee (+5 Happiness) and boost production on your highest net earner.'
    );
  }
  if (evaluatedEmployees.some((e) => e.isWalkoutRisk)) {
    advisories.push(
      'URGENT: One or more employees are below 30 Happiness and will leave the company if not boosted by a Manager or Comic!'
    );
  }

  return {
    companyId: company?._id || 'unknown',
    companyName: company?.name || 'Company',
    itemCode: company?.itemCode || 'commodity',
    commodityName: resolvedPrice.commodityName,
    commodityUnit: resolvedPrice.unit,
    isManufactured: isManuf,
    unitMarketPriceBtc,
    liveMarketPriceBtc: resolvedPrice.liveMarketPriceBtc,
    priceSource: resolvedPrice.priceSource,
    ppPerUnit,
    recipeSummary: itemRecipe.recipeSummary,
    recipeInputs,
    rawInputCostPerUnitBtc,
    netMarginPerUnitBtc,
    breakRoomLevel,
    maxEmployeeSlots,
    activeEmployeesCount: activeEmployees.length,
    reportedWorkerCount,
    hasLiveEmployeeDetails,
    steelNeededForLvl3,
    isBreakRoomMaxed,
    hasManager: Boolean(company?.hasManager || company?.managerId),
    isSafeHomelandRegion: company?.isHomelandSafeRegion !== false,
    engineHourlyPP: effectiveEngineHourlyPP,
    workforceHourlyPP,
    totalDailyPP,
    dailyUnitsProduced,
    dailyRawInputCostBtc,
    dailyValueAddedBtc,
    totalDailyWagesBtc,
    estimatedDailyRevenueBtc: totalDailyRevenue,
    totalDailyNetProfitBtc,
    estimatedDailyNetProfitBtc: totalDailyNetProfitBtc,
    estimatedDailyNetProfitAfterInputsBtc,
    overallScore,
    saddestEmployeeId,
    highestEarnerEmployeeId,
    evaluatedEmployees,
    employeeBreakdown: evaluatedEmployees,
    companyAdvisories: advisories,
    recommendations: advisories,
  };
}
