/**
 * High-Performance Automatic Background Ledger Streamer
 * Concurrently streams unverified or stale (>30m) citizen personal transaction receipts
 * in the background using a 4-Worker Priority-First Incremental Delta Streamer across ALL countries,
 * with non-blinking multi-worker slot telemetry, automatic per-citizen exponential backoff retries,
 * and a 30-minute automatic re-audit lifecycle.
 */

import { CitizenEconomicProfile, MinistryConfig, CountryEconomicBenchmark } from '../types/ministry';
import { fetchUserTransactions } from './apiService';
import { buildAuditedCitizenProfile } from './ministryService';
import { storage, AUDIT_PROFILE_SCHEMA_VERSION } from './storage';

export const AUDIT_STALE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LAST_AUDIT_BY_COUNTRY_KEY = 'warera_last_audit_completed_by_country_v1';
const LAST_APP_ACTIVE_AT_KEY = 'warera_last_app_active_at_v1';

export interface ActiveAuditWorkerSlot {
  workerIndex: number;
  userId: string;
  username: string;
  receiptCount: number;
  retryAttempt?: number;
}

export interface AutoAuditStreamState {
  isRunning: boolean;
  isPaused: boolean;
  countryId?: string;
  activeWorkers: ActiveAuditWorkerSlot[];
  currentCitizenName?: string;
  currentCitizenId?: string;
  currentCitizenReceiptCount?: number;
  retryAttempt?: number;
  auditedCount: number;
  totalTargetCount: number;
  failedCount: number;
  failedCitizenIds: string[];
  pct: number;
  statusMessage: string;
  lastCompletedAt?: number;
  nextScheduledAuditAt?: number;
}

type StreamListener = (state: AutoAuditStreamState) => void;

class AutoAuditStreamService {
  private isRunning = false;
  private isPaused = false;
  private activeRunId = 0;
  private abortController: AbortController | null = null;
  private listeners: Set<StreamListener> = new Set();
  private onProfileAuditedCallback: ((profile: CitizenEconomicProfile) => void) | null = null;
  private activeCountryId: string | undefined = undefined;
  private activeWindowDays: number = 7;
  private lastProfilesSnapshot: CitizenEconomicProfile[] = [];
  private lastApiKey: string | undefined = undefined;
  private lastConfig: MinistryConfig | undefined = undefined;
  private lastBenchmark: CountryEconomicBenchmark | undefined = undefined;
  private verifiedProfilesCache: Map<string, CitizenEconomicProfile> = new Map();
  private completedPassTimestamps: Map<string, number> = new Map();
  private deferredCitizenIdsByPass: Map<string, Set<string>> = new Map();

  private state: AutoAuditStreamState = {
    isRunning: false,
    isPaused: false,
    countryId: undefined,
    activeWorkers: [],
    auditedCount: 0,
    totalTargetCount: 0,
    failedCount: 0,
    failedCitizenIds: [],
    pct: 0,
    statusMessage: 'Ready',
  };

  public getState(): AutoAuditStreamState {
    return {
      ...this.state,
      activeWorkers: [...(this.state.activeWorkers || [])],
    };
  }

  public subscribe(listener: StreamListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(updates: Partial<AutoAuditStreamState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((fn) => fn(this.getState()));
  }

  /**
   * Checks whether an individual citizen's audit is missing or older than 30 minutes.
   */
  public isCitizenAuditStale(
    profile: CitizenEconomicProfile,
    ttlMs: number = AUDIT_STALE_TTL_MS
  ): boolean {
    if (
      profile.auditBaselineStatus !== 'audited' ||
      profile.auditSchemaVersion !== AUDIT_PROFILE_SCHEMA_VERSION ||
      !profile.auditedAt
    ) {
      return true;
    }
    const auditedMs = new Date(profile.auditedAt).getTime();
    if (isNaN(auditedMs)) return true;
    return Date.now() - auditedMs >= ttlMs;
  }

  public getLastCountryAuditTime(countryId?: string): number {
    if (!countryId || typeof localStorage === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(LAST_AUDIT_BY_COUNTRY_KEY);
      if (!raw) return 0;
      const map = JSON.parse(raw);
      return Number(map?.[countryId] || 0);
    } catch {
      return 0;
    }
  }

  public setLastCountryAuditTime(countryId?: string, ts: number = Date.now()): void {
    if (!countryId || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LAST_AUDIT_BY_COUNTRY_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[countryId] = ts;
      localStorage.setItem(LAST_AUDIT_BY_COUNTRY_KEY, JSON.stringify(map));
    } catch {}
  }

  /**
   * Records user activity and returns true if >= 30 minutes had elapsed since the app was last used.
   */
  public checkAndRecordAppActivity(now: number = Date.now()): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const prevRaw = localStorage.getItem(LAST_APP_ACTIVE_AT_KEY);
      const prevTs = prevRaw ? Number(prevRaw) : 0;
      localStorage.setItem(LAST_APP_ACTIVE_AT_KEY, String(now));
      if (prevTs > 0 && now - prevTs >= AUDIT_STALE_TTL_MS) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public pause() {
    if (this.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.notify({ isPaused: true, statusMessage: 'Background audit paused' });
    }
  }

  public resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.notify({ isPaused: false, statusMessage: 'Resuming background audit...' });
    }
  }

  public stop() {
    this.activeRunId++;
    this.isRunning = false;
    this.isPaused = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.notify({
      isRunning: false,
      isPaused: false,
      activeWorkers: [],
      currentCitizenName: undefined,
      currentCitizenId: undefined,
      currentCitizenReceiptCount: undefined,
      retryAttempt: undefined,
      statusMessage: 'Background stream stopped',
    });
  }

  /**
   * Immediately aborts any running or paused background audit for the previous country,
   * invalidates in-flight worker promises via activeRunId, and resets counters so the
   * newly selected country starts cleanly.
   */
  public resetForCountrySwitch() {
    this.activeRunId++;
    this.isRunning = false;
    this.isPaused = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.activeCountryId = undefined;
    this.lastProfilesSnapshot = [];
    this.onProfileAuditedCallback = null;
    this.notify({
      isRunning: false,
      isPaused: false,
      countryId: undefined,
      activeWorkers: [],
      currentCitizenName: undefined,
      currentCitizenId: undefined,
      currentCitizenReceiptCount: undefined,
      retryAttempt: undefined,
      auditedCount: 0,
      totalTargetCount: 0,
      failedCount: 0,
      failedCitizenIds: [],
      pct: 0,
      statusMessage: 'Ready',
    });
  }

  /**
   * Retries only the citizens that failed during the previous stream pass.
   */
  public async retryFailed(): Promise<void> {
    if (
      this.isRunning ||
      !this.lastApiKey ||
      !this.lastConfig ||
      !this.onProfileAuditedCallback ||
      this.lastProfilesSnapshot.length === 0
    ) {
      return;
    }
    const failedSet = new Set(this.state.failedCitizenIds);
    const passKey = `${this.activeCountryId || 'default'}_${this.activeWindowDays}`;
    this.deferredCitizenIdsByPass.delete(passKey);
    const profilesToRetry = this.lastProfilesSnapshot.map((p) =>
      failedSet.has(p.userId) ? { ...p, auditBaselineStatus: 'pending-audit' as const, auditedAt: undefined } : p
    );
    for (const id of failedSet) {
      this.verifiedProfilesCache.delete(id);
    }
    await this.startStream(
      profilesToRetry,
      this.lastApiKey,
      this.lastConfig,
      this.lastBenchmark,
      this.onProfileAuditedCallback,
      false,
      true
    );
  }

  /**
   * Automatically iterates through unverified or stale (>30m) citizens in the background
   * using a 4-Thread Priority-First Incremental Delta Streamer across ALL countries.
   */
  public async startStream(
    profiles: CitizenEconomicProfile[],
    apiKey: string | undefined,
    config: MinistryConfig,
    countryBenchmark: CountryEconomicBenchmark | undefined,
    onProfileAudited: (profile: CitizenEconomicProfile) => void,
    forceReaudit = false,
    isExplicitRetry = false
  ): Promise<void> {
    if (!apiKey || !apiKey.trim() || profiles.length === 0) {
      return;
    }

    const incomingCountryId = profiles[0]?.countryId;
    const incomingWindowDays = config.analysisPeriodDays || 7;
    const passKey = `${incomingCountryId || 'default'}_${incomingWindowDays}`;

    if (this.isRunning) {
      if (
        forceReaudit ||
        (incomingCountryId && incomingCountryId !== this.activeCountryId) ||
        incomingWindowDays !== this.activeWindowDays
      ) {
        this.stop();
      } else {
        return;
      }
    }

    const runId = ++this.activeRunId;
    this.onProfileAuditedCallback = onProfileAudited;
    this.lastApiKey = apiKey;
    this.lastConfig = config;
    this.lastBenchmark = countryBenchmark;
    this.activeCountryId = incomingCountryId;
    this.activeWindowDays = incomingWindowDays;

    // Hydrate incoming profiles with verified profiles from in-memory cache and localStorage
    // so unapplied buffered updates or stale parent props never cause a false re-audit of the country.
    const persistedMap = incomingCountryId ? storage.getAuditedProfiles(incomingCountryId) : {};
    const hydratedProfiles = profiles.map((p) => {
      if (
        p.auditBaselineStatus === 'audited' &&
        p.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION &&
        p.auditedAt
      ) {
        this.verifiedProfilesCache.set(p.userId, p);
        return p;
      }
      const cached = this.verifiedProfilesCache.get(p.userId) || persistedMap[p.userId];
      if (
        cached &&
        cached.auditBaselineStatus === 'audited' &&
        cached.auditSchemaVersion === AUDIT_PROFILE_SCHEMA_VERSION &&
        cached.auditedAt
      ) {
        this.verifiedProfilesCache.set(p.userId, cached);
        return {
          ...p,
          ...cached,
          wealthBtc: p.wealthBtc,
          liquidBtc: p.liquidBtc,
          resourceWealthBtc: p.resourceWealthBtc,
          companiesWealthBtc: p.companiesWealthBtc,
          equipmentsWealthBtc: p.equipmentsWealthBtc,
          weaponsWealthBtc: p.weaponsWealthBtc,
          level: p.level,
          manualTag: p.manualTag,
          notes: p.notes,
        };
      }
      return p;
    });

    this.lastProfilesSnapshot = hydratedProfiles;

    const lastPassCompletedAt =
      this.completedPassTimestamps.get(passKey) ||
      this.getLastCountryAuditTime(incomingCountryId);
    const isPassRecentlyCompleted =
      lastPassCompletedAt > 0 && Date.now() - lastPassCompletedAt < AUDIT_STALE_TTL_MS;
    const deferredSet =
      !forceReaudit && !isExplicitRetry && isPassRecentlyCompleted
        ? this.deferredCitizenIdsByPass.get(passKey) || new Set<string>()
        : new Set<string>();

    // Priority-First Queue for ALL countries:
    // Priority score ranks potential leeches, high-liquid holders, resource stockpilers, and high-wealth pillars first.
    const computePriorityScore = (p: CitizenEconomicProfile): number => {
      const wealthScore = p.wealthBtc || 0;
      const liquidBonus = (p.liquidBtc || 0) * 2.5;
      const resourceBonus = (p.resourceWealthBtc || 0) * 2.0;
      const companyBonus = (p.companiesCount || 0) * 500;
      const lowDonorMultiplier = (p.periodDonatedBtc || 0) === 0 ? 1.35 : 1.0;
      return (wealthScore + liquidBonus + resourceBonus + companyBonus) * lowDonorMultiplier;
    };

    const unverified = (
      forceReaudit
        ? [...hydratedProfiles]
        : hydratedProfiles.filter(
            (p) => !deferredSet.has(p.userId) && this.isCitizenAuditStale(p, AUDIT_STALE_TTL_MS)
          )
    ).sort((a, b) => computePriorityScore(b) - computePriorityScore(a));

    const totalCount = hydratedProfiles.length;
    const initialAuditedCount = totalCount - unverified.length - deferredSet.size;
    const initialPct = totalCount > 0 ? Math.round((initialAuditedCount / totalCount) * 100) : 100;

    if (unverified.length === 0) {
      const lastCompleted = lastPassCompletedAt || Date.now();
      const failedIdsList = Array.from(deferredSet);
      this.notify({
        isRunning: false,
        isPaused: false,
        countryId: incomingCountryId,
        activeWorkers: [],
        auditedCount: Math.max(0, totalCount - failedIdsList.length),
        totalTargetCount: totalCount,
        failedCount: failedIdsList.length,
        failedCitizenIds: failedIdsList,
        pct:
          totalCount > 0
            ? Math.min(100, Math.round(((totalCount - failedIdsList.length) / totalCount) * 100))
            : 100,
        lastCompletedAt: lastCompleted,
        nextScheduledAuditAt: lastCompleted + AUDIT_STALE_TTL_MS,
        statusMessage:
          failedIdsList.length > 0
            ? `Audit pass finished (${totalCount - failedIdsList.length} verified, ${failedIdsList.length} need retry)`
            : 'All citizens verified with live receipts',
      });
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    const localAbortController = new AbortController();
    this.abortController = localAbortController;

    const isStaleRun = () =>
      !this.isRunning ||
      this.activeRunId !== runId ||
      localAbortController.signal.aborted ||
      (incomingCountryId !== undefined && this.activeCountryId !== incomingCountryId);

    const workerSlots = new Map<number, ActiveAuditWorkerSlot>();
    const syncWorkerSlotsToState = (extraUpdates: Partial<AutoAuditStreamState> = {}) => {
      if (isStaleRun()) return;
      const slotsList = Array.from(workerSlots.values()).sort(
        (a, b) => a.workerIndex - b.workerIndex
      );
      const primarySlot = slotsList[0];
      this.notify({
        countryId: incomingCountryId,
        activeWorkers: slotsList,
        currentCitizenName: primarySlot?.username,
        currentCitizenId: primarySlot?.userId,
        currentCitizenReceiptCount: primarySlot?.receiptCount,
        retryAttempt: primarySlot?.retryAttempt,
        ...extraUpdates,
      });
    };

    this.notify({
      isRunning: true,
      isPaused: false,
      countryId: incomingCountryId,
      activeWorkers: [],
      auditedCount: initialAuditedCount,
      totalTargetCount: totalCount,
      failedCount: 0,
      failedCitizenIds: [],
      pct: initialPct,
      currentCitizenReceiptCount: undefined,
      retryAttempt: undefined,
      statusMessage: `Auditing ${unverified.length} citizens...`,
    });

    const windowDays = incomingWindowDays;
    let completedCount = initialAuditedCount;
    const failedIds: string[] = [];
    let queueIndex = 0;
    // Universal 4-thread concurrency across all countries, paced safely by rateLimitedFetch token bucket
    const CONCURRENCY = Math.min(4, Math.max(1, unverified.length));

    // Pre-load verified country donation transactions so every citizen's personal stream is cross-verified
    // and unioned by _id with the national donation ledger (preventing 0 BTC donation overwrites)
    const countryDonationsByUser = new Map<string, import('../types/warera').WareraTransaction[]>();
    if (incomingCountryId) {
      try {
        const countryTxs = await storage.getTransactionsByCountry(incomingCountryId);
        for (const tx of countryTxs) {
          const donorId = tx.userId || tx.buyerId;
          if (!donorId) continue;
          const list = countryDonationsByUser.get(donorId) || [];
          list.push({
            ...tx,
            userId: donorId,
            buyerId: tx.buyerId || donorId,
            sellerCountryId: tx.sellerCountryId || tx.countryId || incomingCountryId,
            isPersonalReceipt: true,
          });
          countryDonationsByUser.set(donorId, list);
        }
      } catch {}
    }

    const worker = async (workerIndex: number) => {
      while (queueIndex < unverified.length && !isStaleRun()) {
        while (this.isPaused && !isStaleRun()) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        if (isStaleRun()) break;

        const currentIndex = queueIndex++;
        if (currentIndex >= unverified.length) break;
        const citizen = unverified[currentIndex];

        workerSlots.set(workerIndex, {
          workerIndex,
          userId: citizen.userId,
          username: citizen.username,
          receiptCount: 0,
          retryAttempt: undefined,
        });
        syncWorkerSlotsToState({
          statusMessage: `Auditing ${citizen.username}...`,
        });

        const MAX_CITIZEN_ATTEMPTS = 3;
        let attempt = 0;
        let citizenSucceeded = false;

        // ⚠️ CRITICAL ARCHITECTURAL INVARIANT:
        // Load previously cached personal receipts from the dedicated 'personal_receipts' store
        // to merge after streaming the full time window, NEVER to short-circuit Page 1!
        const storedTxs = await storage.getUserPersonalTransactions(citizen.userId);
        const citizenCountryDonations = countryDonationsByUser.get(citizen.userId) || [];
        if (isStaleRun()) break;

        const knownTxIds = new Set<string>();
        for (const st of storedTxs) {
          if (st._id && st.isPersonalReceipt) knownTxIds.add(st._id);
        }

        // If IndexedDB already holds cached personal receipts for this citizen (e.g., 2,993 receipts for N3V1T5)
        // while their displayed profile has 0 receipts, immediately hydrate and emit their cached audit profile
        // before streaming fresh delta pages so they never appear empty even while paging!
        if (storedTxs.length > 0 && (citizen.receiptCount || 0) === 0) {
          const initialMergedMap = new Map<string, import('../types/warera').WareraTransaction>();
          for (const t of citizenCountryDonations) if (t._id) initialMergedMap.set(t._id, t);
          for (const t of storedTxs) if (t._id) initialMergedMap.set(t._id, t);
          const preHydrated = buildAuditedCitizenProfile(
            citizen,
            Array.from(initialMergedMap.values()),
            config,
            countryBenchmark,
            windowDays
          );
          this.verifiedProfilesCache.set(preHydrated.userId, preHydrated);
          storage.saveAuditedProfile(preHydrated);
          if (this.onProfileAuditedCallback) {
            this.onProfileAuditedCallback(preHydrated);
          } else {
            onProfileAudited(preHydrated);
          }
        }

        while (attempt < MAX_CITIZEN_ATTEMPTS && !citizenSucceeded && !isStaleRun()) {
          attempt++;
          try {
            if (attempt > 1) {
              const retryDelayMs = attempt * 2000;
              workerSlots.set(workerIndex, {
                workerIndex,
                userId: citizen.userId,
                username: citizen.username,
                receiptCount: workerSlots.get(workerIndex)?.receiptCount || 0,
                retryAttempt: attempt,
              });
              syncWorkerSlotsToState({
                statusMessage: `Retrying ${citizen.username} (attempt ${attempt}/${MAX_CITIZEN_ATTEMPTS})...`,
              });
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            }

            if (isStaleRun()) break;

            const txs = await fetchUserTransactions(
              citizen.userId,
              apiKey,
              (loadedCount) => {
                if (isStaleRun()) return;
                workerSlots.set(workerIndex, {
                  workerIndex,
                  userId: citizen.userId,
                  username: citizen.username,
                  receiptCount: Math.max(loadedCount, knownTxIds.size),
                  retryAttempt: attempt > 1 ? attempt : undefined,
                });
                syncWorkerSlotsToState();
              },
              localAbortController.signal,
              windowDays,
              knownTxIds
            );

            if (isStaleRun()) break;

            const mergedMap = new Map<string, import('../types/warera').WareraTransaction>();
            for (const t of citizenCountryDonations) if (t._id) mergedMap.set(t._id, t);
            for (const t of storedTxs) if (t._id) mergedMap.set(t._id, t);
            for (const t of txs) if (t._id) mergedMap.set(t._id, t);
            const allUserTxs = Array.from(mergedMap.values());

            if (allUserTxs.length > 0) {
              await storage.saveUserPersonalTransactions(citizen.userId, allUserTxs);
            }

            if (isStaleRun()) break;

            const auditedProfile = buildAuditedCitizenProfile(
              citizen,
              allUserTxs,
              config,
              countryBenchmark,
              windowDays
            );

            // Atomic persistence: save verified profile immediately in memory and localStorage
            this.verifiedProfilesCache.set(auditedProfile.userId, auditedProfile);
            storage.saveAuditedProfile(auditedProfile);

            if (isStaleRun()) break;

            if (this.onProfileAuditedCallback) {
              this.onProfileAuditedCallback(auditedProfile);
            } else {
              onProfileAudited(auditedProfile);
            }

            citizenSucceeded = true;
            completedCount++;
            workerSlots.delete(workerIndex);
            const pct = Math.min(
              100,
              Math.round(((completedCount + failedIds.length) / totalCount) * 100)
            );

            syncWorkerSlotsToState({
              auditedCount: completedCount,
              pct,
              statusMessage: `Verified ${citizen.username} (${allUserTxs.length} receipts)`,
            });
          } catch (err: any) {
            if (err?.name === 'AbortError' || isStaleRun()) {
              break;
            }
            const isRateLimit = String(err?.message || '').includes('429');
            if (isRateLimit) {
              workerSlots.set(workerIndex, {
                workerIndex,
                userId: citizen.userId,
                username: citizen.username,
                receiptCount: workerSlots.get(workerIndex)?.receiptCount || 0,
                retryAttempt: attempt,
              });
              syncWorkerSlotsToState({
                statusMessage: `API rate limit reached on ${citizen.username}. Cooling down...`,
              });
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          }
        }

        workerSlots.delete(workerIndex);

        // If all retry attempts failed, do NOT fabricate an 'audited' status.
        if (!citizenSucceeded && !isStaleRun()) {
          failedIds.push(citizen.userId);
          const pct = Math.min(
            100,
            Math.round(((completedCount + failedIds.length) / totalCount) * 100)
          );
          syncWorkerSlotsToState({
            failedCount: failedIds.length,
            failedCitizenIds: [...failedIds],
            pct,
            statusMessage: `Deferred ${citizen.username} after ${MAX_CITIZEN_ATTEMPTS} retries`,
          });
        }
      }
      workerSlots.delete(workerIndex);
      if (!isStaleRun()) {
        syncWorkerSlotsToState();
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, (_, idx) => worker(idx + 1));
    await Promise.all(workers);

    if (isStaleRun()) {
      return;
    }

    const completedAt = Date.now();
    this.completedPassTimestamps.set(passKey, completedAt);
    this.deferredCitizenIdsByPass.set(passKey, new Set(failedIds));
    if (completedCount > 0 || failedIds.length === 0) {
      this.setLastCountryAuditTime(incomingCountryId, completedAt);
    }

    this.isRunning = false;
    this.isPaused = false;
    this.abortController = null;
    workerSlots.clear();
    this.notify({
      isRunning: false,
      isPaused: false,
      countryId: incomingCountryId,
      activeWorkers: [],
      currentCitizenName: undefined,
      currentCitizenId: undefined,
      currentCitizenReceiptCount: undefined,
      retryAttempt: undefined,
      auditedCount: completedCount,
      failedCount: failedIds.length,
      failedCitizenIds: [...failedIds],
      pct: totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 100,
      lastCompletedAt: completedAt,
      nextScheduledAuditAt: completedAt + AUDIT_STALE_TTL_MS,
      statusMessage:
        failedIds.length > 0
          ? `Audit pass finished (${completedCount} verified, ${failedIds.length} need retry)`
          : 'Background audit complete: all citizen receipts verified',
    });
  }
}

export const auditStreamService = new AutoAuditStreamService();
