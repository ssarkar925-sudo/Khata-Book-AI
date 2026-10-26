import { create } from 'zustand';
import { VaultItem } from '@/types';

interface VaultState {
  vaultItems: VaultItem[];
  masterPassword: string | null;
  isUnlocked: boolean;
  isLoading: boolean;

  setVaultItems: (items: VaultItem[]) => void;
  setMasterPassword: (password: string | null) => void;
  setIsUnlocked: (unlocked: boolean) => void;
  addVaultItemOptimistic: (item: VaultItem) => void;
  deleteVaultItemOptimistic: (id: string) => void;
  lockVault: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  vaultItems: [],
  masterPassword: null,
  isUnlocked: false,
  isLoading: false,

  setVaultItems: (vaultItems) => set({ vaultItems }),
  setMasterPassword: (masterPassword) => set({ masterPassword, isUnlocked: Boolean(masterPassword) }),
  setIsUnlocked: (isUnlocked) => set({ isUnlocked }),

  addVaultItemOptimistic: (item) =>
    set((state) => ({
      vaultItems: [item, ...state.vaultItems],
    })),

  deleteVaultItemOptimistic: (id) =>
    set((state) => ({
      vaultItems: state.vaultItems.filter((v) => v.id !== id),
    })),

  lockVault: () => set({ masterPassword: null, isUnlocked: false }),
}));
