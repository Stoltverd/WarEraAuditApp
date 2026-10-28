import { WareraCountry, WareraUserLite } from '../types/warera';
import {
  StateWarReadinessReport,
  WarReadinessCitizenSummary,
  WarReadinessRole,
} from '../types/ministry';
import {
  fetchCountryCitizens,
  batchResolveUsers,
  fetchUserCompanies,
} from './apiService';

const WAR_READINESS_CACHE_KEY = 'warera_war_readiness_reports_v1';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

interface CachedReportEntry {
  report: StateWarReadinessReport;
  timestamp: number;
}

const memoryReportCache = new Map<string, CachedReportEntry>();

function loadPersistedCache(): void {
  if (memoryReportCache.size > 0) return;
  try {
    const raw = localStorage.getItem(WAR_READINESS_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedReportEntry>;
    const now = Date.now();
    Object.entries(parsed).forEach(([cid, entry]) => {
      if (entry && entry.report && now - entry.timestamp < CACHE_TTL_MS) {
        memoryReportCache.set(cid, entry);
      }
    });
  } catch {
    // Ignore storage read errors
  }
}

function saveReportToCache(report: StateWarReadinessReport): void {
  try {
    loadPersistedCache();
    memoryReportCache.set(report.countryId, {
      report,
      timestamp: Date.now(),
    });
    const serialized: Record<string, CachedReportEntry> = {};
    memoryReportCache.forEach((val, key) => {
      serialized[key] = val;
    });
    localStorage.setItem(WAR_READINESS_CACHE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore quota errors
  }
}

export function getCachedWarReadinessReport(
  countryId: string,
  role: WarReadinessRole
): StateWarReadinessReport | null {
  loadPersistedCache();
  const entry = memoryReportCache.get(countryId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryReportCache.delete(countryId);
    return null;
  }
  return {
    ...entry.report,
    role,
  };
}

function extractUserLevel(user: WareraUserLite): number {
  return Number(user.leveling?.level ?? user.level ?? 0);
}

function isCitizenActive(user: WareraUserLite): boolean {
  const activeFlag = Boolean(user.isActive !== undefined ? user.isActive : true);
  const level = extractUserLevel(user);
  return activeFlag && level >= 10;
}

function extractCompaniesSkillCap(user: WareraUserLite): number {
  const skillObj = user.skills?.companies;
  const skillVal = Number(skillObj?.value ?? skillObj?.level ?? 0);
  const statsCount = Number(user.stats?.companiesCount ?? 0);
  return Math.max(skillVal, statsCount);
}

/**
 * Evaluates a state's Economic War-Readiness across 4 core metrics:
 * 1. Active Population: Every active citizen (isActive !== false && level >= 10)
 * 2. War-Ready Citizens (Step B): Active citizens with Level >= 25
 * 3. Average War Participants (Step C): Active Population / 2
 * 4. Tier-5 Industrial Citizens (Step D): Active citizens owning >= 12 companies all at Automation Level >= 5
 */
export async function evaluateStateWarReadiness(
  country: WareraCountry,
  role: WarReadinessRole,
  options?: {
    forceRefresh?: boolean;
    knownUsersMap?: Record<string, WareraUserLite>;
    onProgress?: (report: StateWarReadinessReport) => void;
    shouldAbort?: () => boolean;
  }
): Promise<StateWarReadinessReport> {
  const countryId = country._id;
  const officialPop = Number(country.rankings?.countryActivePopulation?.value ?? 0);

  if (!options?.forceRefresh) {
    const cached = getCachedWarReadinessReport(countryId, role);
    if (cached && cached.scanStatus === 'completed') {
      options?.onProgress?.(cached);
      return cached;
    }
  }

  const initialReport: StateWarReadinessReport = {
    countryId,
    countryName: country.name,
    countryCode: country.code || 'UN',
    role,
    officialActivePopulation: officialPop,
    activePopulation: 0,
    warReadyCitizensCount: 0,
    averageWarParticipants: 0,
    tier5IndustrialCitizensCount: 0,
    warReadyRoster: [],
    tier5IndustrialRoster: [],
    scanStatus: 'fetching-census',
    scannedCandidates: 0,
    totalCandidates: 0,
  };

  options?.onProgress?.(initialReport);

  try {
    // Stage 1: Fetch all citizen IDs for this country
    const citizenIds = await fetchCountryCitizens(countryId);
    if (options?.shouldAbort?.()) return initialReport;

    // Resolve full user objects so level, isActive, and skills.companies are populated
    const resolvedUsersMap = await batchResolveUsers(
      citizenIds,
      undefined,
      undefined,
      countryId
    );
    if (options?.shouldAbort?.()) return initialReport;

    const mergedUsers: WareraUserLite[] = [];
    const seenIds = new Set<string>();

    for (const uid of citizenIds) {
      if (seenIds.has(uid)) continue;
      seenIds.add(uid);
      const u = resolvedUsersMap[uid] || options?.knownUsersMap?.[uid];
      if (u) {
        mergedUsers.push(u);
      }
    }

    // Filter for Active Citizens (isActive !== false && level >= 10)
    const activeCitizens = mergedUsers.filter(isCitizenActive);
    const activePopulation = activeCitizens.length > 0 ? activeCitizens.length : officialPop;

    // Step B: War-Ready Citizens = Active citizens who are Level 25+
    const warReadyCitizens = activeCitizens.filter((u) => extractUserLevel(u) >= 25);
    const warReadyCitizensCount = warReadyCitizens.length;

    // Step C: Average War Participants = Active Population / 2
    const averageWarParticipants = Number((activePopulation / 2).toFixed(1));

    // Build initial roster for War-Ready citizens
    const rosterByUserId = new Map<string, WarReadinessCitizenSummary>();
    activeCitizens.forEach((u) => {
      const lvl = extractUserLevel(u);
      const compCap = extractCompaniesSkillCap(u);
      rosterByUserId.set(u._id, {
        userId: u._id,
        username: u.username || `Citizen #${u._id.slice(-6)}`,
        avatarUrl: u.avatarUrl,
        level: lvl,
        companiesSkillCap: compCap,
        totalCompanies: Number(u.stats?.companiesCount ?? 0),
        auto5CompaniesCount: 0,
        isWarReady: lvl >= 25,
        isTier5Industrial: false,
      });
    });

    // Identify candidates to inspect for 12 companies @ Automation Level 5+
    // A citizen needs 12 companies to qualify as a Tier-5 Industrial Citizen.
    // We check all active citizens whose company skill cap >= 12, stats.companiesCount >= 12,
    // or if skills weren't hydrated on the user object, any active citizen with level >= 20.
    const industrialCandidates = activeCitizens.filter((u) => {
      const cap = extractCompaniesSkillCap(u);
      const hasSkillsObject = Boolean(u.skills && Object.keys(u.skills).length > 0);
      if (cap >= 12) return true;
      if (!hasSkillsObject && extractUserLevel(u) >= 20) return true;
      return false;
    });

    // If no candidate matched the fast pre-filter (e.g., partial skill payload), fallback to all active citizens
    const candidatesToScan =
      industrialCandidates.length > 0 ? industrialCandidates : activeCitizens;

    const stage1Report: StateWarReadinessReport = {
      ...initialReport,
      activePopulation,
      warReadyCitizensCount,
      averageWarParticipants,
      warReadyRoster: Array.from(rosterByUserId.values())
        .filter((r) => r.isWarReady)
        .sort((a, b) => b.level - a.level),
      scanStatus: candidatesToScan.length > 0 ? 'scanning-companies' : 'completed',
      scannedCandidates: 0,
      totalCandidates: candidatesToScan.length,
    };

    options?.onProgress?.(stage1Report);

    // Stage 2 (Step D): Check each candidate's live companies for 12+ companies at Automated Engine >= 5
    const BATCH_SIZE = 4;
    let scanned = 0;
    const tier5IndustrialRoster: WarReadinessCitizenSummary[] = [];

    for (let i = 0; i < candidatesToScan.length; i += BATCH_SIZE) {
      if (options?.shouldAbort?.()) return stage1Report;

      const batch = candidatesToScan.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (candidate) => {
          try {
            const companies = await fetchUserCompanies(candidate._id);
            const totalCompanies = companies.length;
            const auto5Count = companies.filter(
              (c) => Number(c.activeUpgradeLevels?.automatedEngine ?? 1) >= 5
            ).length;
            const isTier5 = totalCompanies >= 12 && auto5Count >= 12;

            const existing = rosterByUserId.get(candidate._id);
            if (existing) {
              existing.totalCompanies = totalCompanies;
              existing.auto5CompaniesCount = auto5Count;
              existing.isTier5Industrial = isTier5;
              if (isTier5) {
                tier5IndustrialRoster.push({ ...existing });
              }
            }
          } catch {
            // Keep candidate non-qualified if company fetch fails
          } finally {
            scanned += 1;
          }
        })
      );

      const updatedWarReadyRoster = Array.from(rosterByUserId.values())
        .filter((r) => r.isWarReady)
        .sort((a, b) => {
          if (a.isTier5Industrial !== b.isTier5Industrial) {
            return a.isTier5Industrial ? -1 : 1;
          }
          return b.level - a.level;
        });

      const sortedTier5Roster = [...tier5IndustrialRoster].sort(
        (a, b) => b.auto5CompaniesCount - a.auto5CompaniesCount || b.level - a.level
      );

      const progressReport: StateWarReadinessReport = {
        ...stage1Report,
        tier5IndustrialCitizensCount: sortedTier5Roster.length,
        warReadyRoster: updatedWarReadyRoster,
        tier5IndustrialRoster: sortedTier5Roster,
        scanStatus:
          scanned >= candidatesToScan.length ? 'completed' : 'scanning-companies',
        scannedCandidates: scanned,
        totalCandidates: candidatesToScan.length,
        lastEvaluatedAt: new Date().toISOString(),
      };

      options?.onProgress?.(progressReport);
    }

    const finalWarReadyRoster = Array.from(rosterByUserId.values())
      .filter((r) => r.isWarReady)
      .sort((a, b) => {
        if (a.isTier5Industrial !== b.isTier5Industrial) {
          return a.isTier5Industrial ? -1 : 1;
        }
        return b.level - a.level;
      });

    const finalTier5Roster = [...tier5IndustrialRoster].sort(
      (a, b) => b.auto5CompaniesCount - a.auto5CompaniesCount || b.level - a.level
    );

    const completedReport: StateWarReadinessReport = {
      ...stage1Report,
      tier5IndustrialCitizensCount: finalTier5Roster.length,
      warReadyRoster: finalWarReadyRoster,
      tier5IndustrialRoster: finalTier5Roster,
      scanStatus: 'completed',
      scannedCandidates: candidatesToScan.length,
      totalCandidates: candidatesToScan.length,
      lastEvaluatedAt: new Date().toISOString(),
    };

    saveReportToCache(completedReport);
    options?.onProgress?.(completedReport);
    return completedReport;
  } catch (err: any) {
    const errorReport: StateWarReadinessReport = {
      ...initialReport,
      scanStatus: 'error',
      error: err?.message || 'Failed to evaluate state war-readiness',
    };
    options?.onProgress?.(errorReport);
    return errorReport;
  }
}
