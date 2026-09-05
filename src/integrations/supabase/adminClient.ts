import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const ADMIN_SESSION_STORAGE_KEY = 'vittro-platform-admin-auth';

const memoryFallback = new Map<string, string>();

/**
 * Storage deliberately scoped to sessionStorage so the platform session can
 * coexist with the tenant session without sharing its localStorage key.
 */
const adminSessionStorage: SupportedStorage = {
  getItem(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  setItem(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },
  removeItem(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      memoryFallback.delete(key);
    }
  },
};

/**
 * Never reuse the tenant client here. Besides the independent storage key,
 * disabling URL session detection prevents tenant auth callback parameters
 * from being consumed by the administrative surface.
 */
export const adminSupabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: adminSessionStorage,
      storageKey: ADMIN_SESSION_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
