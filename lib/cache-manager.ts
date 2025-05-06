/**
 * Advanced cache manager for optimizing API calls and data persistence
 * Supports multiple cache strategies including TTL, LRU, and background refresh
 */

type CacheItem<T> = {
  data: T;
  timestamp: number;
  expiresAt: number;
};

export type CacheOptions = {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh data
  backgroundRefresh?: boolean; // Refresh data in background before expiration
  refreshThreshold?: number; // Percentage of TTL when background refresh should trigger (0-1)
  storage?: 'memory' | 'localStorage' | 'sessionStorage'; // Where to store the cache
};

const DEFAULT_OPTIONS: CacheOptions = {
  ttl: 5 * 60 * 1000, // 5 minutes
  staleWhileRevalidate: true,
  backgroundRefresh: true,
  refreshThreshold: 0.75, // Refresh when 75% of TTL has passed
  storage: 'memory',
};

class CacheManager {
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private refreshPromises: Map<string, Promise<any>> = new Map();
  private backgroundRefreshTimeouts: Map<string, NodeJS.Timeout> = new Map();
  // Add in-flight request tracking to prevent duplicate requests
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    // Initialize from localStorage/sessionStorage if available
    if (typeof window !== 'undefined') {
      this.initFromStorage();
    }
  }

  private initFromStorage() {
    try {
      // Load localStorage cache
      const localStorageCache = localStorage.getItem('app_cache');
      if (localStorageCache) {
        const parsed = JSON.parse(localStorageCache);
        Object.entries(parsed).forEach(([key, value]) => {
          const cacheItem = value as CacheItem<any>;
          // Only restore non-expired items
          if (cacheItem.expiresAt > Date.now()) {
            this.memoryCache.set(`localStorage:${key}`, cacheItem);
          }
        });
      }

      // Load sessionStorage cache
      const sessionStorageCache = sessionStorage.getItem('app_cache');
      if (sessionStorageCache) {
        const parsed = JSON.parse(sessionStorageCache);
        Object.entries(parsed).forEach(([key, value]) => {
          const cacheItem = value as CacheItem<any>;
          // Only restore non-expired items
          if (cacheItem.expiresAt > Date.now()) {
            this.memoryCache.set(`sessionStorage:${key}`, cacheItem);
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize cache from storage:', error);
    }
  }

  private getStorageKey(key: string, options: CacheOptions): string {
    return `${options.storage}:${key}`;
  }

  private saveToStorage(storageKey: string, cacheItem: CacheItem<any>, options: CacheOptions) {
    if (typeof window === 'undefined' || options.storage === 'memory') {
      return;
    }

    try {
      const storage = options.storage === 'localStorage' ? localStorage : sessionStorage;
      const existingCache = storage.getItem('app_cache');
      const cacheObj = existingCache ? JSON.parse(existingCache) : {};
      
      // Extract the actual key from the storage key (remove the prefix)
      const actualKey = storageKey.split(':')[1];
      cacheObj[actualKey] = cacheItem;
      
      storage.setItem('app_cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  private scheduleBackgroundRefresh<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    options: CacheOptions,
    cacheItem: CacheItem<T>
  ) {
    if (!options.backgroundRefresh) return;
    
    // Clear any existing timeout
    if (this.backgroundRefreshTimeouts.has(key)) {
      clearTimeout(this.backgroundRefreshTimeouts.get(key)!);
    }
    
    const ttl = options.ttl || DEFAULT_OPTIONS.ttl!;
    const refreshThreshold = options.refreshThreshold || DEFAULT_OPTIONS.refreshThreshold!;
    const timeUntilExpiry = cacheItem.expiresAt - Date.now();
    const refreshTime = timeUntilExpiry * (1 - refreshThreshold);
    
    const timeout = setTimeout(() => {
      this.refreshCache(key, fetchFn, options);
    }, refreshTime);
    
    this.backgroundRefreshTimeouts.set(key, timeout);
  }

  private async refreshCache<T>(key: string, fetchFn: () => Promise<T>, options: CacheOptions) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const storageKey = this.getStorageKey(key, mergedOptions);
    
    // Don't refresh if already refreshing
    if (this.refreshPromises.has(storageKey)) return;
    
    try {
      const refreshPromise = fetchFn();
      this.refreshPromises.set(storageKey, refreshPromise);
      
      const data = await refreshPromise;
      const now = Date.now();
      const ttl = mergedOptions.ttl!;
      
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
      };
      
      this.memoryCache.set(storageKey, cacheItem);
      this.saveToStorage(storageKey, cacheItem, mergedOptions);
      
      // Schedule next refresh
      this.scheduleBackgroundRefresh(key, fetchFn, mergedOptions, cacheItem);
    } catch (error) {
      console.error(`Failed to refresh cache for key ${key}:`, error);
    } finally {
      this.refreshPromises.delete(storageKey);
    }
  }

  /**
   * Get data from cache or fetch it if not available
   */
  async get<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const storageKey = this.getStorageKey(key, mergedOptions);
    const now = Date.now();
    
    // First check if the same request is already in flight
    if (this.pendingRequests.has(storageKey)) {
      return this.pendingRequests.get(storageKey);
    }
    
    // Check if we have a valid cache entry
    const cacheItem = this.memoryCache.get(storageKey);
    const isValid = cacheItem && cacheItem.expiresAt > now;
    
    // If valid cache and not refreshing in background, return it
    if (isValid) {
      // Schedule background refresh if needed
      if (mergedOptions.backgroundRefresh) {
        const timeUntilExpiry = cacheItem.expiresAt - now;
        const refreshThreshold = mergedOptions.refreshThreshold!;
        const shouldRefreshInBackground = timeUntilExpiry < (mergedOptions.ttl! * (1 - refreshThreshold));
        
        if (shouldRefreshInBackground && !this.refreshPromises.has(storageKey)) {
          // Don't await, let it refresh in background
          this.refreshCache(key, fetchFn, mergedOptions);
        }
      }
      
      return cacheItem.data;
    }
    
    // If stale data is allowed while revalidating
    if (cacheItem && mergedOptions.staleWhileRevalidate) {
      // Start fetching new data if not already doing so
      if (!this.refreshPromises.has(storageKey)) {
        this.refreshCache(key, fetchFn, mergedOptions);
      }
      
      // Return stale data
      return cacheItem.data;
    }
    
    // If already fetching, wait for that promise
    if (this.refreshPromises.has(storageKey)) {
      return this.refreshPromises.get(storageKey);
    }
    
    // Track the new request
    const fetchPromise = fetchFn().then(data => {
      // Store in cache
      const now = Date.now();
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: now,
        expiresAt: now + mergedOptions.ttl!,
      };
      
      this.memoryCache.set(storageKey, cacheItem);
      this.saveToStorage(storageKey, cacheItem, mergedOptions);
      
      // Schedule next refresh if needed
      if (mergedOptions.backgroundRefresh) {
        this.scheduleBackgroundRefresh(key, fetchFn, mergedOptions, cacheItem);
      }
      
      // Remove from pending requests
      this.pendingRequests.delete(storageKey);
      return data;
    }).catch(error => {
      // Remove from pending requests on error
      this.pendingRequests.delete(storageKey);
      throw error;
    });
    
    // Store the promise for deduplication
    this.pendingRequests.set(storageKey, fetchPromise);
    
    return fetchPromise;
  }

  /**
   * Set data in cache manually
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const storageKey = this.getStorageKey(key, mergedOptions);
    const now = Date.now();
    
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + mergedOptions.ttl!,
    };
    
    this.memoryCache.set(storageKey, cacheItem);
    this.saveToStorage(storageKey, cacheItem, mergedOptions);
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(key: string, options: CacheOptions = {}): void {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const storageKey = this.getStorageKey(key, mergedOptions);
    
    this.memoryCache.delete(storageKey);
    
    // Clear any background refresh
    if (this.backgroundRefreshTimeouts.has(key)) {
      clearTimeout(this.backgroundRefreshTimeouts.get(key)!);
      this.backgroundRefreshTimeouts.delete(key);
    }
    
    // Update storage
    if (typeof window !== 'undefined' && mergedOptions.storage !== 'memory') {
      try {
        const storage = mergedOptions.storage === 'localStorage' ? localStorage : sessionStorage;
        const existingCache = storage.getItem('app_cache');
        
        if (existingCache) {
          const cacheObj = JSON.parse(existingCache);
          const actualKey = storageKey.split(':')[1];
          delete cacheObj[actualKey];
          storage.setItem('app_cache', JSON.stringify(cacheObj));
        }
      } catch (error) {
        console.error('Failed to invalidate cache in storage:', error);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'all'): void {
    if (!storage || storage === 'memory' || storage === 'all') {
      this.memoryCache.clear();
      
      // Clear all background refresh timeouts
      this.backgroundRefreshTimeouts.forEach(timeout => clearTimeout(timeout));
      this.backgroundRefreshTimeouts.clear();
    }
    
    if (typeof window !== 'undefined') {
      if (!storage || storage === 'localStorage' || storage === 'all') {
        localStorage.removeItem('app_cache');
      }
      
      if (!storage || storage === 'sessionStorage' || storage === 'all') {
        sessionStorage.removeItem('app_cache');
      }
    }
  }
}

// Create a singleton instance
export const cacheManager = new CacheManager();

export default cacheManager;
