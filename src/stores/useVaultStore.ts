import { create } from 'zustand';
import { VaultItem } from '@/types';
import { computeSecurePinHash } from '@/lib/crypto';

interface VaultState {
  vaultItems: VaultItem[];
  masterPassword: string | null;
  isUnlocked: boolean;
  hasConfiguredPassword: boolean;
  isLoading: boolean;

  setVaultItems: (items: VaultItem[]) => void;
  setMasterPassword: (password: string | null) => void;
  setIsUnlocked: (unlocked: boolean) => void;
  addVaultItemOptimistic: (item: VaultItem) => void;
  updateVaultItemOptimistic: (id: string, updates: Partial<VaultItem>) => void;
  deleteVaultItemOptimistic: (id: string) => void;
  lockVault: () => void;

  setupMasterPassword: (pin: string) => Promise<void>;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; lockedOut?: boolean; remainingSec?: number }>;
  changeMasterPassword: (oldPin: string, newPin: string) => Promise<boolean>;
  resetVault: () => void;
  getLockoutStatus: () => { isLockedOut: boolean; remainingSec: number };
}

const VAULT_AUTH_KEY = 'rb_vault_auth_token';
const VAULT_ITEMS_KEY = 'rb_vault_saved_items';
const VAULT_LOCKOUT_KEY = 'rb_vault_lockout';

function legacyHash(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function getStoredVaultLockout(): { failedCount: number; lockedUntil: number } {
  if (typeof window === 'undefined') return { failedCount: 0, lockedUntil: 0 };
  try {
    const raw = localStorage.getItem(VAULT_LOCKOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { failedCount: 0, lockedUntil: 0 };
}

function setStoredVaultLockout(failedCount: number, lockedUntil: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VAULT_LOCKOUT_KEY, JSON.stringify({ failedCount, lockedUntil }));
  } catch {}
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultItems: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(VAULT_ITEMS_KEY);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  })(),
  masterPassword: null,
  isUnlocked: false,
  hasConfiguredPassword: (() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem(VAULT_AUTH_KEY));
    }
    return false;
  })(),
  isLoading: false,

  getLockoutStatus: () => {
    const { lockedUntil } = getStoredVaultLockout();
    const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    return { isLockedOut: remaining > 0, remainingSec: remaining };
  },

  setVaultItems: (vaultItems) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(vaultItems));
    }
    set({ vaultItems });
  },

  setMasterPassword: (masterPassword) => set({ masterPassword, isUnlocked: Boolean(masterPassword) }),
  setIsUnlocked: (isUnlocked) => set({ isUnlocked }),

  addVaultItemOptimistic: (item) =>
    set((state) => {
      const updated = [item, ...state.vaultItems];
      if (typeof window !== 'undefined') {
        localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(updated));
      }
      return { vaultItems: updated };
    }),

  updateVaultItemOptimistic: (id, updates) =>
    set((state) => {
      const updated = state.vaultItems.map((v) =>
        v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(updated));
      }
      return { vaultItems: updated };
    }),

  deleteVaultItemOptimistic: (id) =>
    set((state) => {
      const updated = state.vaultItems.filter((v) => v.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(updated));
      }
      return { vaultItems: updated };
    }),

  lockVault: () => set({ masterPassword: null, isUnlocked: false }),

  setupMasterPassword: async (pin: string) => {
    if (typeof window !== 'undefined') {
      const { hash, salt } = await computeSecurePinHash(pin);
      localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256' }));
      setStoredVaultLockout(0, 0);
    }
    set({
      masterPassword: pin,
      isUnlocked: true,
      hasConfiguredPassword: true,
    });
  },

  verifyAndUnlock: async (pin: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VAULT_AUTH_KEY);
      if (!stored) {
        const { hash, salt } = await computeSecurePinHash(pin);
        localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256' }));
        setStoredVaultLockout(0, 0);
        set({
          masterPassword: pin,
          isUnlocked: true,
          hasConfiguredPassword: true,
        });
        return { success: true };
      }

      // Check lockout status
      const lockout = getStoredVaultLockout();
      const now = Date.now();
      if (lockout.lockedUntil > now) {
        const remaining = Math.ceil((lockout.lockedUntil - now) / 1000);
        return { success: false, lockedOut: true, remainingSec: remaining };
      }

      let isMatch = false;
      try {
        if (stored.startsWith('{')) {
          const parsed = JSON.parse(stored);
          const computed = await computeSecurePinHash(pin, parsed.salt);
          isMatch = computed.hash === parsed.hash;
        } else {
          isMatch = stored === legacyHash(pin);
          if (isMatch) {
            const upgraded = await computeSecurePinHash(pin);
            localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ ...upgraded, algorithm: 'PBKDF2-SHA256' }));
          }
        }
      } catch {
        isMatch = false;
      }

      if (isMatch) {
        setStoredVaultLockout(0, 0);
        set({
          masterPassword: pin,
          isUnlocked: true,
          hasConfiguredPassword: true,
        });
        return { success: true };
      }

      // Record failed attempt
      const newFailed = lockout.failedCount + 1;
      let newLockedUntil = 0;
      if (newFailed >= 10) {
        newLockedUntil = now + 300 * 1000; // 5 min lockout
      } else if (newFailed >= 5) {
        newLockedUntil = now + 30 * 1000; // 30 sec lockout
      }
      setStoredVaultLockout(newFailed, newLockedUntil);

      const remaining = newLockedUntil > now ? Math.ceil((newLockedUntil - now) / 1000) : 0;
      return { success: false, lockedOut: remaining > 0, remainingSec: remaining };
    }
    return { success: false };
  },

  changeMasterPassword: async (oldPin: string, newPin: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VAULT_AUTH_KEY);
      if (stored) {
        let isOldMatch = false;
        if (stored.startsWith('{')) {
          const parsed = JSON.parse(stored);
          const computed = await computeSecurePinHash(oldPin, parsed.salt);
          isOldMatch = computed.hash === parsed.hash;
        } else {
          isOldMatch = stored === legacyHash(oldPin);
        }
        if (!isOldMatch) return false;
      }

      const { hash, salt } = await computeSecurePinHash(newPin);
      localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256' }));
      setStoredVaultLockout(0, 0);
      set({
        masterPassword: newPin,
        isUnlocked: true,
        hasConfiguredPassword: true,
      });
      return true;
    }
    return false;
  },

  resetVault: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(VAULT_AUTH_KEY);
      localStorage.removeItem(VAULT_ITEMS_KEY);
      localStorage.removeItem(VAULT_LOCKOUT_KEY);
    }
    set({
      vaultItems: [],
      masterPassword: null,
      isUnlocked: false,
      hasConfiguredPassword: false,
    });
  },
}));
