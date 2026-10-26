import { create } from 'zustand';
import { VaultItem } from '@/types';

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
  deleteVaultItemOptimistic: (id: string) => void;
  lockVault: () => void;

  setupMasterPassword: (pin: string) => void;
  verifyAndUnlock: (pin: string) => boolean;
  changeMasterPassword: (oldPin: string, newPin: string) => boolean;
  resetVault: () => void;
}

const VAULT_AUTH_KEY = 'rb_vault_auth_token';
const VAULT_ITEMS_KEY = 'rb_vault_saved_items';

// Simple deterministic hash for verification
function hashToken(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
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

  deleteVaultItemOptimistic: (id) =>
    set((state) => {
      const updated = state.vaultItems.filter((v) => v.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(updated));
      }
      return { vaultItems: updated };
    }),

  lockVault: () => set({ masterPassword: null, isUnlocked: false }),

  setupMasterPassword: (pin: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VAULT_AUTH_KEY, hashToken(pin));
    }
    set({
      masterPassword: pin,
      isUnlocked: true,
      hasConfiguredPassword: true,
    });
  },

  verifyAndUnlock: (pin: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VAULT_AUTH_KEY);
      if (!stored || stored === hashToken(pin)) {
        if (!stored) {
          localStorage.setItem(VAULT_AUTH_KEY, hashToken(pin));
        }
        set({
          masterPassword: pin,
          isUnlocked: true,
          hasConfiguredPassword: true,
        });
        return true;
      }
    }
    return false;
  },

  changeMasterPassword: (oldPin: string, newPin: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(VAULT_AUTH_KEY);
      if (stored && stored !== hashToken(oldPin)) {
        return false;
      }
      localStorage.setItem(VAULT_AUTH_KEY, hashToken(newPin));
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
    }
    set({
      vaultItems: [],
      masterPassword: null,
      isUnlocked: false,
      hasConfiguredPassword: false,
    });
  },
}));
