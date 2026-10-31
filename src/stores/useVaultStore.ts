import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VaultItem } from '@/types';
import { 
  computeSecurePinHash, 
  verifySecurePinHash, 
  reEncryptData,
  verifyVaultAccess 
} from '@/lib/crypto';

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

// Partialize function to strip sensitive fields from persisted state
const partialize = (state: VaultState) => ({
  ...state,
  vaultItems: state.vaultItems.map((item) => {
    const { secrets, decrypted_password, ...rest } = item;
    return rest;
  }),
  // Do NOT persist masterPassword, isUnlocked - these should always be null/false on load
  masterPassword: null,
  isUnlocked: false,
});

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      vaultItems: [],
      masterPassword: null,
      isUnlocked: false,
      hasConfiguredPassword: false,
      isLoading: false,

      getLockoutStatus: () => {
        const { lockedUntil } = getStoredVaultLockout();
        const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
        return { isLockedOut: remaining > 0, remainingSec: remaining };
      },

      setVaultItems: (newItems) =>
        set((state) => {
          // Merge with existing local items so in-memory decrypted fields, category, color aren't wiped
          const existingMap = new Map(state.vaultItems.map((item) => [item.id, item]));
          const merged = newItems.map((incoming) => {
            const local = existingMap.get(incoming.id);
            if (!local) return incoming;
            return {
              ...incoming,
              category: incoming.category || local.category,
              color: incoming.color || local.color,
            };
          });

          // Preserve local items that haven't synced to cloud yet
          const incomingIds = new Set(newItems.map((i) => i.id));
          state.vaultItems.forEach((local) => {
            if (!incomingIds.has(local.id)) {
              merged.push(local);
            }
          });

          return { vaultItems: merged };
        }),

      setMasterPassword: (masterPassword) => set({ masterPassword, isUnlocked: Boolean(masterPassword) }),
      setIsUnlocked: (isUnlocked) => set({ isUnlocked }),

      addVaultItemOptimistic: (item) =>
        set((state) => {
          const exists = state.vaultItems.some((v) => v.id === item.id);
          const updated = exists
            ? state.vaultItems.map((v) => (v.id === item.id ? { ...v, ...item } : v))
            : [item, ...state.vaultItems];
          return { vaultItems: updated };
        }),

      updateVaultItemOptimistic: (id, updates) =>
        set((state) => {
          const updated = state.vaultItems.map((v) =>
            v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
          );
          return { vaultItems: updated };
        }),

      deleteVaultItemOptimistic: (id) =>
        set((state) => {
          const updated = state.vaultItems.filter((v) => v.id !== id);
          return { vaultItems: updated };
        }),

      lockVault: () => set({ masterPassword: null, isUnlocked: false }),

      setupMasterPassword: async (pin: string) => {
        if (typeof window !== 'undefined') {
          const { hash, salt } = await computeSecurePinHash(pin);
          localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256', iterations: 600000 }));
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
          // If no stored verifier but vault items exist, treat as error/recovery state, not enrollment
          if (!stored) {
            const hasItems = get().vaultItems.length > 0;
            if (hasItems) {
              return { success: false, lockedOut: false, remainingSec: 0 };
            }
            // No items and no verifier - allow enrollment
            const { hash, salt } = await computeSecurePinHash(pin);
            localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256', iterations: 600000 }));
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
              // Verify using secure constant-time comparison
              isMatch = await verifySecurePinHash(pin, parsed.salt, parsed.hash);
            } else {
              // Legacy format - reject for security
              isMatch = false;
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
              isOldMatch = await verifySecurePinHash(oldPin, parsed.salt, parsed.hash);
            }
            if (!isOldMatch) return false;
          }

          // Re-encrypt all vault items with new password
          const { masterPassword } = get();
          if (masterPassword && masterPassword === oldPin) {
            const updatedItems: VaultItem[] = [];
            for (const item of get().vaultItems) {
              if (item.encrypted_password && item.iv && item.salt) {
                try {
                  const reEncrypted = await reEncryptData(
                    item.encrypted_password,
                    item.iv,
                    item.salt,
                    oldPin,
                    newPin
                  );
                  updatedItems.push({
                    ...item,
                    encrypted_password: reEncrypted.encrypted,
                    iv: reEncrypted.iv,
                    salt: reEncrypted.salt,
                    verificationToken: reEncrypted.verificationToken,
                    updated_at: new Date().toISOString(),
                  });
                } catch {
                  // If re-encryption fails, keep original (will fail to decrypt with new PIN)
                  updatedItems.push(item);
                }
              } else {
                updatedItems.push(item);
              }
            }
            set({ vaultItems: updatedItems });
          }

          const { hash, salt } = await computeSecurePinHash(newPin);
          localStorage.setItem(VAULT_AUTH_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256', iterations: 600000 }));
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
    }),
    {
      name: VAULT_ITEMS_KEY,
      partialize,
      // Skip hydration on server
      skipHydration: typeof window === 'undefined',
    }
  )
);