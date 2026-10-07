/**
 * Offline-first browser storage layer for War Era individual transactions and user profiles.
 */
import {
  WareraCountry,
  WareraTransaction,
  WareraCumulativeDonation,
  WareraUserLite,
} from '../types/warera';
import {
  PlayerTag,
  PlaystyleMode,
  NationalTransaction,
  ResourceReserveItem,
  RespecAlert,
  MinistryConfig,
  DEFAULT_MINISTRY_CONFIG,
  WatchedCitizen,
  WealthSnapshot,
} from '../types/ministry';

const DB_NAME = 'warera_donations_granular_db';
const DB_VERSION = 3;

/**
 * Normalizes and sanitizes any stored or drafted MinistryConfig,
 * guaranteeing positive numbers and strict hierarchy Patriot > Moderate > Low >= 0.
 * Completely immune to legacy NaN, negative values, or equal percentages.
 */
export function sanitizePolicyConfig(raw?: Partial<MinistryConfig> | null): MinistryConfig {
  const base: MinistryConfig = { ...DEFAULT_MINISTRY_CONFIG, ...(raw || {}) };

  // Ensure General hierarchy
  let low = Math.max(0, Number(base.lowContributorIncomeRatePct) || DEFAULT_MINISTRY_CONFIG.lowContributorIncomeRatePct);
  let mod = Math.max(low + 0.1, Number(base.moderateIncomeRatePct) || DEFAULT_MINISTRY_CONFIG.moderateIncomeRatePct);
  let pat = Math.max(mod + 0.1, Number(base.patriotIncomeRatePct) || DEFAULT_MINISTRY_CONFIG.patriotIncomeRatePct);
  if (mod <= low) mod = low + 5;
  if (pat <= mod) pat = mod + 5;

  // Ensure War hierarchy
  let warLow = Math.max(0, Number(base.warLowRatePct) || DEFAULT_MINISTRY_CONFIG.warLowRatePct);
  let warMod = Math.max(warLow + 0.1, Number(base.warModerateRatePct) || DEFAULT_MINISTRY_CONFIG.warModerateRatePct);
  let warPat = Math.max(warMod + 0.1, Number(base.warPatriotRatePct) || DEFAULT_MINISTRY_CONFIG.warPatriotRatePct);
  if (warMod <= warLow) warMod = warLow + 1.5;
  if (warPat <= warMod) warPat = warMod + 2.5;

  // Ensure Eco hierarchy
  let ecoLow = Math.max(0, Number(base.ecoLowRatePct) || DEFAULT_MINISTRY_CONFIG.ecoLowRatePct);
  let ecoMod = Math.max(ecoLow + 0.1, Number(base.ecoModerateRatePct) || DEFAULT_MINISTRY_CONFIG.ecoModerateRatePct);
  let ecoPat = Math.max(ecoMod + 0.1, Number(base.ecoPatriotRatePct) || DEFAULT_MINISTRY_CONFIG.ecoPatriotRatePct);
  if (ecoMod <= ecoLow) ecoMod = ecoLow + 5;
  if (ecoPat <= ecoMod) ecoPat = ecoMod + 5;

  // Ensure Hybrid hierarchy
  let hybLow = Math.max(0, Number(base.hybridLowRatePct) || DEFAULT_MINISTRY_CONFIG.hybridLowRatePct);
  let hybMod = Math.max(hybLow + 0.1, Number(base.hybridModerateRatePct) || DEFAULT_MINISTRY_CONFIG.hybridModerateRatePct);
  let hybPat = Math.max(hybMod + 0.1, Number(base.hybridPatriotRatePct) || DEFAULT_MINISTRY_CONFIG.hybridPatriotRatePct);
  if (hybMod <= hybLow) hybMod = hybLow + 3;
  if (hybPat <= hybMod) hybPat = hybMod + 4;

  return {
    ...base,
    analysisPeriodDays: Math.max(1, Math.min(90, Number(base.analysisPeriodDays) || 7)),
    patriotIncomeRatePct: pat,
    moderateIncomeRatePct: mod,
    lowContributorIncomeRatePct: low,
    warPatriotRatePct: warPat,
    warModerateRatePct: warMod,
    warLowRatePct: warLow,
    ecoPatriotRatePct: ecoPat,
    ecoModerateRatePct: ecoMod,
    ecoLowRatePct: ecoLow,
    hybridPatriotRatePct: hybPat,
    hybridModerateRatePct: hybMod,
    hybridLowRatePct: hybLow,
    historicalDonorGraceThresholdBtc: Math.max(0, Number(base.historicalDonorGraceThresholdBtc) || 500),
    topHistoricalDonorProtectionRank: Math.max(1, Number(base.topHistoricalDonorProtectionRank) || 10),
    topHeavyHitterRankCutoff: Math.max(1, Number(base.topHeavyHitterRankCutoff) || 10),
    leechWealthPercentileCutoff: Math.max(50, Math.min(95, Number(base.leechWealthPercentileCutoff) || 75)),
    includeDamageInLeechCalculation: Boolean(base.includeDamageInLeechCalculation),
    damageConversionRateBtcPer1k: Math.max(0.001, Number(base.damageConversionRateBtcPer1k) || 0.08),
    includeResourceWealth: Boolean(base.includeResourceWealth),
  };
}

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Countries store
        if (!db.objectStoreNames.contains('countries')) {
          db.createObjectStore('countries', { keyPath: '_id' });
        }

        // Granular individual transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', { keyPath: '_id' });
          store.createIndex('countryId', 'countryId', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Cumulative donations store
        if (!db.objectStoreNames.contains('cumulative')) {
          const store = db.createObjectStore('cumulative', { keyPath: '_id' });
          store.createIndex('countryId', 'countryId', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }

        // Users store
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: '_id' });
        }

        // Ministry: Player Tags store
        if (!db.objectStoreNames.contains('player_tags')) {
          db.createObjectStore('player_tags', { keyPath: 'userId' });
        }

        // Ministry: National Inter-State Transactions store
        if (!db.objectStoreNames.contains('national_transactions')) {
          const store = db.createObjectStore('national_transactions', { keyPath: 'id' });
          store.createIndex('sourceCountryId', 'sourceCountryId', { unique: false });
        }

        // Ministry: National Stockpiles store
        if (!db.objectStoreNames.contains('national_stockpiles')) {
          db.createObjectStore('national_stockpiles', { keyPath: 'id' });
        }

        // Ministry: Respec Alerts store
        if (!db.objectStoreNames.contains('respec_alerts')) {
          db.createObjectStore('respec_alerts', { keyPath: 'id' });
        }

        // Ministry: Wealth Snapshots store (for income growth audits)
        if (!db.objectStoreNames.contains('citizen_wealth_snapshots')) {
          const store = db.createObjectStore('citizen_wealth_snapshots', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('countryId', 'countryId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Ministry: Citizens on Watch store
        if (!db.objectStoreNames.contains('watched_citizens')) {
          const store = db.createObjectStore('watched_citizens', { keyPath: 'userId' });
          store.createIndex('countryId', 'countryId', { unique: false });
          store.createIndex('addedAt', 'addedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        setTimeout(() => {
          this.purgeIncompleteUsers().catch(() => {});
          this.purgeCorruptedTransactions().catch(() => {});
          this.purgeCorruptedCumulative().catch(() => {});
        }, 500);
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- API Key Management ---
  getApiKey(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('warera_api_key') || '';
  }

  setApiKey(key: string): void {
    if (typeof localStorage === 'undefined') return;
    if (key.trim()) {
      localStorage.setItem('warera_api_key', key.trim());
    } else {
      localStorage.removeItem('warera_api_key');
    }
  }

  // --- Last Viewed Country Management ---
  getLastViewedCountry(): WareraCountry | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem('warera_last_viewed_country');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed._id && parsed.name) {
          return parsed as WareraCountry;
        }
      }
    } catch {}
    return null;
  }

  setLastViewedCountry(country: WareraCountry | null): void {
    if (typeof localStorage === 'undefined') return;
    try {
      if (country && country._id) {
        localStorage.setItem(
          'warera_last_viewed_country',
          JSON.stringify({
            _id: country._id,
            name: country.name,
            code: country.code,
            countryWealth: country.countryWealth,
            rankings: country.rankings,
            money: country.money,
          })
        );
        localStorage.setItem('warera_last_viewed_country_id', country._id);
      } else {
        localStorage.removeItem('warera_last_viewed_country');
        localStorage.removeItem('warera_last_viewed_country_id');
      }
    } catch (err) {
      console.warn('Failed to save last viewed country:', err);
    }
  }

  getLastViewedCountryId(): string {
    if (typeof localStorage === 'undefined') return '';
    try {
      return localStorage.getItem('warera_last_viewed_country_id') || '';
    } catch {
      return '';
    }
  }

  // --- Countries ---
  async saveCountries(countries: WareraCountry[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('countries', 'readwrite');
      const store = tx.objectStore('countries');
      for (const country of countries) {
        store.put(country);
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      localStorage.setItem('warera_countries_cache', JSON.stringify(countries));
    }
  }

  async getCountries(): Promise<WareraCountry[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('countries', 'readonly');
        const store = tx.objectStore('countries');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const cached = localStorage.getItem('warera_countries_cache');
      return cached ? JSON.parse(cached) : [];
    }
  }

  // --- Individual Granular Transactions ---
  async saveTransactions(transactions: WareraTransaction[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const t of transactions) {
        store.put(t);
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Failed to save transactions in IndexedDB:', err);
    }
  }

  async getTransactionsByCountry(countryId: string): Promise<WareraTransaction[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const index = store.index('countryId');
        const request = index.getAll(countryId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }

  // --- Cumulative Donations ---
  async saveCumulativeDonations(donations: WareraCumulativeDonation[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('cumulative', 'readwrite');
      const store = tx.objectStore('cumulative');
      for (const d of donations) {
        store.put(d);
      }
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch (err) {
      console.warn('Failed to save cumulative donations in IndexedDB:', err);
    }
  }

  async getCumulativeDonationsByCountry(countryId: string): Promise<WareraCumulativeDonation[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('cumulative', 'readonly');
        const store = tx.objectStore('cumulative');
        const index = store.index('countryId');
        const request = index.getAll(countryId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }

  // --- Users ---
  async purgeIncompleteUsers(): Promise<number> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.getAll();
      return new Promise((resolve) => {
        request.onsuccess = () => {
          let purged = 0;
          (request.result || []).forEach((u: WareraUserLite) => {
            const hasWealth = u.stats && typeof u.stats.wealth === 'object' && (u.stats.wealth as any).money !== undefined;
            if (!hasWealth) {
              store.delete(u._id);
              purged++;
            }
          });
          resolve(purged);
        };
        request.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  // --- Personal Citizen Receipts (Wages, Item Market, Articles) ---
  async saveUserPersonalTransactions(userId: string, transactions: WareraTransaction[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const t of transactions) {
        store.put({ ...t, userId });
      }
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // In-memory / graceful fallback
    }
  }

  async getUserPersonalTransactions(userId: string): Promise<WareraTransaction[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async purgeCorruptedTransactions(): Promise<number> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const request = store.getAll();
      return new Promise((resolve) => {
        request.onsuccess = () => {
          let purged = 0;
          (request.result || []).forEach((t: WareraTransaction) => {
            const isInvalidUser = !t.userId || t.userId === 'unknown' || t.userId === t._id || t.userId.includes('unknown');
            const isCountryId = t.userId === '683ddd2c24b5a2e114af15d9' || t.userId === '6813b6d546e731854c7ac85f' || t.userId === '6813b6d446e731854c7ac7fe';
            // Only purge corrupted entries with invalid or country ID as citizen
            if (isInvalidUser || isCountryId) {
              store.delete(t._id);
              purged++;
            }
          });
          resolve(purged);
        };
        request.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  async purgeCorruptedCumulative(): Promise<number> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('cumulative', 'readwrite');
      const store = tx.objectStore('cumulative');
      const request = store.getAll();
      return new Promise((resolve) => {
        request.onsuccess = () => {
          let purged = 0;
          (request.result || []).forEach((c: WareraCumulativeDonation) => {
            const isInvalidUser = !c.userId || c.userId === 'unknown' || c.userId === c._id || c.userId.includes('unknown');
            const isCountryId = c.userId === '683ddd2c24b5a2e114af15d9' || c.userId === '6813b6d546e731854c7ac85f' || c.userId === '6813b6d446e731854c7ac7fe';
            const isMissingCountry = !c.countryId;
            if (isInvalidUser || isCountryId || isMissingCountry) {
              store.delete(c._id);
              purged++;
            }
          });
          resolve(purged);
        };
        request.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  async saveUsers(users: WareraUserLite[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      for (const u of users) {
        store.put(u);
      }
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
      });
    } catch {
      // fallback ignore
    }
  }

  async getAllUsers(): Promise<Record<string, WareraUserLite>> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('users', 'readonly');
        const request = tx.objectStore('users').getAll();
        request.onsuccess = () => {
          const map: Record<string, WareraUserLite> = {};
          (request.result || []).forEach((u: WareraUserLite) => {
            map[u._id] = u;
          });
          resolve(map);
        };
        request.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  }

  async getUsersForCountry(
    countryId: string,
    associatedUserIds: string[] = []
  ): Promise<Record<string, WareraUserLite>> {
    try {
      const all = await this.getAllUsers();
      if (!countryId) return all;
      const associatedSet = new Set(associatedUserIds.filter(Boolean));
      const filtered: Record<string, WareraUserLite> = {};

      for (const [id, u] of Object.entries(all)) {
        if (!u) continue;
        const uCountry =
          typeof u.country === 'string'
            ? u.country
            : typeof u.country === 'object' && (u.country as any)?._id
            ? (u.country as any)._id
            : u.countryId;

        if (uCountry === countryId || associatedSet.has(id)) {
          filtered[id] = u;
        }
      }
      return filtered;
    } catch {
      return {};
    }
  }

  // --- Ministry: Player Tags & Notes ---
  async savePlayerTag(userId: string, tag: PlayerTag, notes = ''): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('player_tags', 'readwrite');
      const store = tx.objectStore('player_tags');
      store.put({ userId, tag, notes, updatedAt: new Date().toISOString() });
    } catch {
      const raw = localStorage.getItem('warera_player_tags') || '{}';
      const parsed = JSON.parse(raw);
      parsed[userId] = { tag, notes, updatedAt: new Date().toISOString() };
      localStorage.setItem('warera_player_tags', JSON.stringify(parsed));
    }
  }

  async getPlayerTags(): Promise<Record<string, { tag: PlayerTag; notes?: string }>> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('player_tags', 'readonly');
        const store = tx.objectStore('player_tags');
        const req = store.getAll();
        req.onsuccess = () => {
          const map: Record<string, { tag: PlayerTag; notes?: string }> = {};
          (req.result || []).forEach((item: any) => {
            if (item.userId) map[item.userId] = { tag: item.tag, notes: item.notes };
          });
          resolve(map);
        };
        req.onerror = () => resolve({});
      });
    } catch {
      const raw = localStorage.getItem('warera_player_tags') || '{}';
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
  }

  // --- Ministry: National Inter-State Transactions ---
  async saveNationalTransactions(txs: NationalTransaction[], countryId?: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('national_transactions', 'readwrite');
      const store = tx.objectStore('national_transactions');
      for (const t of txs) {
        store.put(t);
      }
    } catch {
      localStorage.setItem('warera_national_txs', JSON.stringify(txs));
    }
    if (countryId) {
      try {
        localStorage.setItem(`warera_national_txs_${countryId}`, JSON.stringify(txs));
      } catch {}
    }
  }

  async getNationalTransactions(countryId?: string): Promise<NationalTransaction[]> {
    try {
      const db = await this.initDB();
      const all: NationalTransaction[] = await new Promise((resolve) => {
        const tx = db.transaction('national_transactions', 'readonly');
        const store = tx.objectStore('national_transactions');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      if (countryId) {
        return all.filter((t) => t.sourceCountryId === countryId || t.targetCountryId === countryId);
      }
      return all;
    } catch {
      if (countryId) {
        const scoped = localStorage.getItem(`warera_national_txs_${countryId}`);
        if (scoped) return JSON.parse(scoped);
      }
      const raw = localStorage.getItem('warera_national_txs');
      const all: NationalTransaction[] = raw ? JSON.parse(raw) : [];
      if (countryId) {
        return all.filter((t) => t.sourceCountryId === countryId || t.targetCountryId === countryId);
      }
      return all;
    }
  }

  // --- Ministry: National Stockpiles ---
  async saveStockpiles(items: ResourceReserveItem[], countryId?: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('national_stockpiles', 'readwrite');
      const store = tx.objectStore('national_stockpiles');
      for (const item of items) {
        const toSave = countryId ? { ...item, countryId } : item;
        store.put(toSave);
      }
    } catch {
      localStorage.setItem('warera_stockpiles', JSON.stringify(items));
    }
    if (countryId) {
      try {
        localStorage.setItem(`warera_stockpiles_${countryId}`, JSON.stringify(items));
      } catch {}
    }
  }

  async getStockpiles(countryId?: string): Promise<ResourceReserveItem[]> {
    if (countryId) {
      try {
        const scopedRaw = localStorage.getItem(`warera_stockpiles_${countryId}`);
        if (scopedRaw) {
          const parsed = JSON.parse(scopedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }

    try {
      const db = await this.initDB();
      const items: ResourceReserveItem[] = await new Promise((resolve) => {
        const tx = db.transaction('national_stockpiles', 'readonly');
        const store = tx.objectStore('national_stockpiles');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      if (countryId && items.length > 0) {
        const matched = items.filter((item: any) => item.countryId === countryId);
        if (matched.length > 0) return matched;
      }
      return items;
    } catch {
      const raw = localStorage.getItem('warera_stockpiles');
      return raw ? JSON.parse(raw) : [];
    }
  }

  // --- Ministry: Respec Alerts ---
  async saveRespecAlerts(alerts: RespecAlert[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('respec_alerts', 'readwrite');
      const store = tx.objectStore('respec_alerts');
      for (const a of alerts) {
        store.put(a);
      }
    } catch {
      localStorage.setItem('warera_respec_alerts', JSON.stringify(alerts));
    }
  }

  async getRespecAlerts(): Promise<RespecAlert[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('respec_alerts', 'readonly');
        const store = tx.objectStore('respec_alerts');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      const raw = localStorage.getItem('warera_respec_alerts');
      return raw ? JSON.parse(raw) : [];
    }
  }

  // --- Ministry: Citizen Playstyles (Build Tracking for Respecs) ---
  saveCitizenPlaystyles(styles: Record<string, { playstyle: PlaystyleMode; warPoints: number; ecoPoints: number }>): void {
    try {
      localStorage.setItem('warera_citizen_playstyles', JSON.stringify(styles));
    } catch {}
  }

  getCitizenPlaystyles(): Record<string, { playstyle: PlaystyleMode; warPoints: number; ecoPoints: number }> {
    try {
      const raw = localStorage.getItem('warera_citizen_playstyles');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  // --- Ministry: Sovereign Policy Config ---
  saveMinistryConfig(countryId: string, config: MinistryConfig): void {
    try {
      localStorage.setItem(`warera_ministry_config_${countryId}`, JSON.stringify(config));
    } catch {}
  }

  getMinistryConfig(countryId: string): MinistryConfig {
    try {
      const raw = localStorage.getItem(`warera_ministry_config_${countryId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return sanitizePolicyConfig(parsed);
      }
    } catch {}
    return { ...DEFAULT_MINISTRY_CONFIG };
  }

  // --- Ministry: Citizen Wealth Snapshots (Income Audits) ---
  async saveWealthSnapshotsBatch(snapshots: WealthSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    try {
      const db = await this.initDB();
      const tx = db.transaction('citizen_wealth_snapshots', 'readwrite');
      const store = tx.objectStore('citizen_wealth_snapshots');
      snapshots.forEach((s) => store.put(s));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        const existing: WealthSnapshot[] = JSON.parse(localStorage.getItem('warera_wealth_snapshots') || '[]');
        const updated = [...existing, ...snapshots].slice(-3000);
        localStorage.setItem('warera_wealth_snapshots', JSON.stringify(updated));
      } catch {}
    }
  }

  async getClosestWealthSnapshot(userId: string, targetTimestamp: number): Promise<WealthSnapshot | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('citizen_wealth_snapshots', 'readonly');
        const store = tx.objectStore('citizen_wealth_snapshots');
        const index = store.index('userId');
        const req = index.getAll(userId);
        req.onsuccess = () => {
          const list: WealthSnapshot[] = req.result || [];
          if (list.length === 0) return resolve(null);
          // Find snapshot closest to targetTimestamp that is <= targetTimestamp + 1 day
          let best: WealthSnapshot | null = null;
          let minDiff = Infinity;
          for (const s of list) {
            const diff = Math.abs(s.timestamp - targetTimestamp);
            if (diff < minDiff) {
              minDiff = diff;
              best = s;
            }
          }
          resolve(best);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      try {
        const list: WealthSnapshot[] = JSON.parse(localStorage.getItem('warera_wealth_snapshots') || '[]');
        const userList = list.filter((s) => s.userId === userId);
        if (userList.length === 0) return null;
        let best: WealthSnapshot | null = null;
        let minDiff = Infinity;
        for (const s of userList) {
          const diff = Math.abs(s.timestamp - targetTimestamp);
          if (diff < minDiff) {
            minDiff = diff;
            best = s;
          }
        }
        return best;
      } catch {
        return null;
      }
    }
  }

  // --- Ministry: Citizens on Watch ---
  async getWatchedCitizens(countryId?: string): Promise<WatchedCitizen[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('watched_citizens', 'readonly');
        const store = tx.objectStore('watched_citizens');
        const req = store.getAll();
        req.onsuccess = () => {
          const all: WatchedCitizen[] = req.result || [];
          if (!countryId) return resolve(all);
          resolve(all.filter((w) => w.countryId === countryId));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      try {
        const all: WatchedCitizen[] = JSON.parse(localStorage.getItem('warera_watched_citizens') || '[]');
        if (!countryId) return all;
        return all.filter((w) => w.countryId === countryId);
      } catch {
        return [];
      }
    }
  }

  async saveWatchedCitizen(citizen: WatchedCitizen): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('watched_citizens', 'readwrite');
      tx.objectStore('watched_citizens').put(citizen);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        const all: WatchedCitizen[] = JSON.parse(localStorage.getItem('warera_watched_citizens') || '[]');
        const filtered = all.filter((w) => w.userId !== citizen.userId);
        filtered.push(citizen);
        localStorage.setItem('warera_watched_citizens', JSON.stringify(filtered));
      } catch {}
    }
  }

  async removeWatchedCitizen(userId: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('watched_citizens', 'readwrite');
      tx.objectStore('watched_citizens').delete(userId);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        const all: WatchedCitizen[] = JSON.parse(localStorage.getItem('warera_watched_citizens') || '[]');
        const filtered = all.filter((w) => w.userId !== userId);
        localStorage.setItem('warera_watched_citizens', JSON.stringify(filtered));
      } catch {}
    }
  }

  // --- Full Sovereign Backup & Restore (Daily Safeguard against Cache Wipes) ---
  async exportFullBackup(): Promise<string> {
    const backup: Record<string, any> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tags: await this.getPlayerTags(),
      nationalTransactions: await this.getNationalTransactions(),
      stockpiles: await this.getStockpiles(),
      respecAlerts: await this.getRespecAlerts(),
      watchedCitizens: await this.getWatchedCitizens(),
      configs: {},
      wealthSnapshots: [],
    };

    // Grab all country configs from localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('warera_ministry_config_')) {
          const val = localStorage.getItem(key);
          if (val) backup.configs[key] = JSON.parse(val);
        }
      }
    } catch {}

    // Grab all snapshots from IndexedDB or localStorage
    try {
      const db = await this.initDB();
      const snapshots: WealthSnapshot[] = await new Promise((resolve) => {
        const tx = db.transaction('citizen_wealth_snapshots', 'readonly');
        const store = tx.objectStore('citizen_wealth_snapshots');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      backup.wealthSnapshots = snapshots;
    } catch {
      try {
        backup.wealthSnapshots = JSON.parse(localStorage.getItem('warera_wealth_snapshots') || '[]');
      } catch {}
    }

    return JSON.stringify(backup, null, 2);
  }

  async importFullBackup(jsonContent: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const data = JSON.parse(jsonContent);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      let restoredCount = 0;

      // Restore tags
      if (data.tags && typeof data.tags === 'object') {
        for (const [userId, item] of Object.entries(data.tags)) {
          const t = item as any;
          if (t && t.tag) {
            await this.savePlayerTag(userId, t.tag, t.notes || '');
            restoredCount++;
          }
        }
      }

      // Restore national transactions
      if (Array.isArray(data.nationalTransactions)) {
        await this.saveNationalTransactions(data.nationalTransactions);
        restoredCount += data.nationalTransactions.length;
      }

      // Restore stockpiles
      if (Array.isArray(data.stockpiles)) {
        await this.saveStockpiles(data.stockpiles);
        restoredCount += data.stockpiles.length;
      }

      // Restore watched citizens
      if (Array.isArray(data.watchedCitizens)) {
        for (const w of data.watchedCitizens) {
          await this.saveWatchedCitizen(w);
          restoredCount++;
        }
      }

      // Restore configs
      if (data.configs && typeof data.configs === 'object') {
        for (const [key, cfg] of Object.entries(data.configs)) {
          try {
            localStorage.setItem(key, JSON.stringify(cfg));
          } catch {}
        }
      }

      // Restore wealth snapshots
      if (Array.isArray(data.wealthSnapshots) && data.wealthSnapshots.length > 0) {
        try {
          const db = await this.initDB();
          const tx = db.transaction('citizen_wealth_snapshots', 'readwrite');
          const store = tx.objectStore('citizen_wealth_snapshots');
          for (const s of data.wealthSnapshots) {
            store.put(s);
          }
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        } catch {
          localStorage.setItem('warera_wealth_snapshots', JSON.stringify(data.wealthSnapshots));
        }
        restoredCount += data.wealthSnapshots.length;
      }

      return {
        success: true,
        message: `Successfully restored sovereign backup created on ${data.exportedAt || 'unknown date'}.`,
        count: restoredCount,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Backup restore failed: ${err?.message || 'Invalid backup file'}`,
        count: 0,
      };
    }
  }
}

export const storage = new OfflineStorageService();
