/**
 * Offline-first browser storage layer for War Era individual transactions and user profiles.
 */
import {
  WareraCountry,
  WareraTransaction,
  WareraCumulativeDonation,
  WareraUserLite,
} from '../types/warera';

const DB_NAME = 'warera_donations_granular_db';
const DB_VERSION = 1;

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
      };

      request.onsuccess = () => resolve(request.result);
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
}

export const storage = new OfflineStorageService();
