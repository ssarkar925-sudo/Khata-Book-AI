import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { Workspace, WorkspaceRole, SyncStatus, MigrationProgress, MigrationResult, MigrationFailure } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  migrationEngine,
  registerLocalWorkspaceId,
  countUnmigratedLocalRecords,
} from '@/lib/migrationEngine';
import { useAccountStore } from '@/stores/useAccountStore';
import { useCardStore } from '@/stores/useCardStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useVaultStore } from '@/stores/useVaultStore';

export const DEFAULT_LOCAL_WORKSPACE: Workspace = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Local Offline Record Book',
  currency: 'INR',
  owner_id: '00000000-0000-0000-0000-000000000000',
  is_local: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function getOrCreateLocalWorkspace(): Workspace {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rb_active_workspace');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          registerLocalWorkspaceId(parsed.id);
          return parsed;
        }
      }
      const uniqueWs: Workspace = {
        id: crypto.randomUUID(),
        name: 'Local Offline Record Book',
        currency: 'INR',
        owner_id: '00000000-0000-0000-0000-000000000000',
        is_local: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem('rb_active_workspace', JSON.stringify(uniqueWs));
      registerLocalWorkspaceId(uniqueWs.id);
      return uniqueWs;
    } catch {}
  }
  return DEFAULT_LOCAL_WORKSPACE;
}

// Module-level listener tracking to prevent duplicate onAuthStateChange registrations
let authSubscription: { unsubscribe: () => void } | null = null;

interface SessionState {
  user: User | null;
  userRole: WorkspaceRole | null;
  authLoading: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  pendingSyncCount: number;
  lastSyncError: string | null;
  theme: 'light' | 'dark';
  language: 'en' | 'bn' | 'hi';
  isAuthModalOpen: boolean;
  isMembersModalOpen: boolean;
  showMigrationPrompt: boolean;
  localItemsCount: number;
  migrationProgress: MigrationProgress | null;
  
  setUser: (user: User | null) => void;
  setUserRole: (role: WorkspaceRole | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string | null) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'bn' | 'hi') => void;
  setAuthModalOpen: (open: boolean) => void;
  setMembersModalOpen: (open: boolean) => void;
  setShowMigrationPrompt: (show: boolean) => void;
  setLocalItemsCount: (count: number) => void;
  setMigrationProgress: (progress: MigrationProgress | null) => void;

  initAuth: () => Promise<void>;
  cleanupAuth: () => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{
    success: boolean;
    requiresEmailConfirmation?: boolean;
    email?: string;
    error?: string;
  }>;
  signOut: () => Promise<void>;
  refreshWorkspacesAndRole: (currentUser?: User | null) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  migrateLocalDataToCloud: (targetWorkspaceId: string) => Promise<MigrationResult>;
  retryFailedMigration: (targetWorkspaceId: string, failedRecords: MigrationFailure[]) => Promise<MigrationResult>;
  resetSession: () => void;
}

function purgeLegacyDemoData() {
  if (typeof window === 'undefined') return;
  try {
    const LEGACY_ID = '00000000-0000-0000-0000-000000000010';
    const keys = [
      'rb_accounts',
      'rb_cards',
      'rb_customers',
      'rb_dues',
      'rb_ledger_entries',
      'rb_notes',
      'rb_saved_sheets',
    ];
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(
              (item: any) =>
                item &&
                item.workspace_id !== LEGACY_ID &&
                item.workspace_id !== 'default' &&
                item.id !== 'sheet-pan-register' &&
                item.id !== 'sheet-utility-bills' &&
                item.id !== 'note-101' &&
                item.id !== 'note-102' &&
                item.id !== 'cust-101' &&
                item.id !== 'cust-102' &&
                item.id !== 'cust-103' &&
                item.id !== 'due-101' &&
                item.id !== 'due-102' &&
                item.id !== 'due-103' &&
                item.id !== 'tx-101' &&
                item.id !== 'tx-102' &&
                item.id !== 'tx-103' &&
                item.id !== 'tx-104' &&
                item.id !== 'tx-105'
            );
            if (clean.length === 0) {
              localStorage.removeItem(key);
            } else if (clean.length !== parsed.length) {
              localStorage.setItem(key, JSON.stringify(clean));
            }
          }
        } catch {}
      }
    });
  } catch {}
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null, // Strictly null when unauthenticated
  userRole: null,
  authLoading: true,
  workspaces: (() => {
    const ws = getOrCreateLocalWorkspace();
    return [ws];
  })(),
  activeWorkspaceId: (() => {
    const ws = getOrCreateLocalWorkspace();
    return ws.id;
  })(),
  syncStatus: 'offline', // Strictly offline in local-only mode
  lastSyncTime: (() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rb_last_sync_time') || null;
    }
    return null;
  })(),
  pendingSyncCount: 0,
  lastSyncError: null,
  theme: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rb_theme') as 'light' | 'dark' | null;
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }
    return 'light';
  })(),
  language: 'en',
  isAuthModalOpen: false,
  isMembersModalOpen: false,
  showMigrationPrompt: false,
  localItemsCount: 0,
  migrationProgress: null,

  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('rb_cached_user', JSON.stringify({
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
          aud: user.aud,
          created_at: user.created_at,
        }));
      } else {
        localStorage.removeItem('rb_cached_user');
      }
    }
    set({ user, authLoading: false });
    if (!user) {
      set({ userRole: null, syncStatus: 'offline' });
    }
  },

  setUserRole: (userRole) => set({ userRole }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => {
    set({ activeWorkspaceId });
    if (typeof window !== 'undefined') {
      const activeWs = get().workspaces.find((w) => w.id === activeWorkspaceId);
      if (activeWs) {
        localStorage.setItem('rb_active_workspace', JSON.stringify(activeWs));
      }
    }
    const currentUser = get().user;
    if (currentUser) {
      get().refreshWorkspacesAndRole(currentUser);
    }
  },
  setSyncStatus: (syncStatus) => {
    // True local-only guarantee: unauthenticated mode can NEVER report synced
    const user = get().user;
    if (!user && syncStatus === 'synced') {
      set({ syncStatus: 'offline' });
      return;
    }
    set({ syncStatus });
  },
  setLastSyncTime: (time) => {
    if (typeof window !== 'undefined' && time) {
      localStorage.setItem('rb_last_sync_time', time);
    }
    set({ lastSyncTime: time });
  },
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setLastSyncError: (error) => set({ lastSyncError: error }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
    set({ theme });
  },
  setLanguage: (language) => set({ language }),
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
  setMembersModalOpen: (isMembersModalOpen) => set({ isMembersModalOpen }),
  setShowMigrationPrompt: (showMigrationPrompt) => set({ showMigrationPrompt }),
  setLocalItemsCount: (localItemsCount) => set({ localItemsCount }),
  setMigrationProgress: (migrationProgress) => set({ migrationProgress }),

  initAuth: async () => {
    purgeLegacyDemoData();
    set({ authLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        await get().refreshWorkspacesAndRole(session.user);
        set({ user: session.user });
      } else {
        const localWs = getOrCreateLocalWorkspace();
        set({
          user: null,
          userRole: null,
          syncStatus: 'offline',
          workspaces: [localWs],
          activeWorkspaceId: localWs.id,
        });
      }
    } catch (err) {
      console.warn('[SessionStore] Session initialization notice:', err);
      const localWs = getOrCreateLocalWorkspace();
      set({
        user: null,
        userRole: null,
        syncStatus: 'offline',
        workspaces: [localWs],
        activeWorkspaceId: localWs.id,
      });
    } finally {
      set({ authLoading: false });
    }

    // Deduplicate auth listeners: unsubscribe previous listener if active
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          set({ user: session.user, authLoading: false });
          await get().refreshWorkspacesAndRole(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        get().resetSession();
      }
    });

    authSubscription = subscription;
  },

  cleanupAuth: () => {
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }
  },

  signIn: async (email, password) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const trimmedPass = password.trim();

      // Clear any stale local auth session from WebView before signing in
      try {
        await supabase.auth.signOut();
      } catch {}

      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: trimmedPass,
      });

      // If trimmed password fails and raw password had whitespace, fallback to raw password
      if (error && password !== trimmedPass) {
        const retry = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        return { success: false, error: error.message };
      }
      if (data?.user && data?.session) {
        get().setUser(data.user);
        await get().refreshWorkspacesAndRole(data.user);
        return { success: true };
      }
      return { success: false, error: 'Sign in failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  signUp: async (email, password, fullName) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }

      // Supabase Email Confirmation Mode: User created but session is null until email is confirmed
      if (data.user && !data.session) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          email: data.user.email,
        };
      }

      // Auto-confirmed or existing session
      if (data.session?.user) {
        get().setUser(data.session.user);
        await get().refreshWorkspacesAndRole(data.session.user);
        return { success: true, requiresEmailConfirmation: false };
      }

      return { success: false, error: 'Sign up failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[SessionStore] Sign out error:', err);
    } finally {
      get().resetSession();
    }
  },

  refreshWorkspacesAndRole: async (currentUser?: User | null) => {
    const user = currentUser ?? get().user;
    if (!user) {
      const localWs = getOrCreateLocalWorkspace();
      set({
        workspaces: [localWs],
        activeWorkspaceId: localWs.id,
        userRole: null,
        syncStatus: 'offline',
      });
      return;
    }

    try {
      // 1. Fetch workspaces the user can read (via RLS check_user_workspace_read)
      const { data: initialWsList, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });
      let wsList = initialWsList;

      if (wsErr) {
        console.warn('[SessionStore] Error fetching workspaces:', wsErr.message);
      }

      // 2. Concurrency-safe provisioning via database RPC
      if (!wsList || wsList.length === 0) {
        const { data: rpcWs, error: rpcErr } = await supabase.rpc('get_or_create_default_workspace');
        if (!rpcErr && rpcWs) {
          wsList = [rpcWs];
        } else {
          // Direct fallback insert with authenticated user ID
          const { data: newWs, error: insErr } = await supabase
            .from('workspaces')
            .insert({
              name: 'Personal Record Book',
              currency: 'INR',
              owner_id: user.id,
              is_default: true,
            })
            .select()
            .single();

          if (!insErr && newWs) {
            wsList = [newWs];
          }
        }
      }

      // Auto-cleanup: Purge empty orphan workspaces created previously by syncEngine
      if (wsList && wsList.length > 1 && user) {
        const primaryWs = wsList.find((w: any) => w.name === 'Personal Record Book' || w.is_default) || wsList[0];
        const duplicates = wsList.filter(
          (w: any) => w.id !== primaryWs.id && w.name === 'Primary Record Book' && w.owner_id === user.id
        );

        for (const dup of duplicates) {
          try {
            const [accCheck, ledgerCheck, cardCheck] = await Promise.all([
              supabase.from('cash_locations').select('id', { count: 'exact', head: true }).eq('workspace_id', dup.id),
              supabase.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('workspace_id', dup.id),
              supabase.from('cards').select('id', { count: 'exact', head: true }).eq('workspace_id', dup.id),
            ]);

            const hasData = (accCheck.count || 0) > 0 || (ledgerCheck.count || 0) > 0 || (cardCheck.count || 0) > 0;
            if (!hasData) {
              console.log('[SessionStore] Purging empty orphan workspace:', dup.id);
              await supabase.from('workspaces').delete().eq('id', dup.id);
              wsList = wsList.filter((w: any) => w.id !== dup.id);
            }
          } catch (cleanErr) {
            console.warn('[SessionStore] Cleanup orphan workspace error:', cleanErr);
          }
        }
      }

      const availableWorkspaces: Workspace[] = wsList && wsList.length > 0
        ? wsList.map((w: any) => ({
            id: w.id,
            name: w.name,
            currency: w.currency || 'INR',
            owner_id: w.owner_id,
            is_default: w.is_default,
            created_at: w.created_at,
            updated_at: w.updated_at,
          }))
        : [];

      // Guarantee at least one valid workspace for the user
      if (availableWorkspaces.length === 0) {
        availableWorkspaces.push({
          id: user.id,
          name: 'Personal Record Book',
          currency: 'INR',
          owner_id: user.id,
          is_default: true,
          created_at: new Date().toISOString(),
        });
      }

      if (availableWorkspaces.length > 0) {
        const currentActive = availableWorkspaces.find((w) => w.id === get().activeWorkspaceId);
        const selectedWs = currentActive || availableWorkspaces[0];
        
        // Determine role for active workspace
        let role: WorkspaceRole = 'member';
        if (selectedWs.owner_id === user.id) {
          role = 'owner';
        } else {
          const { data: memberRecord } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', selectedWs.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (memberRecord?.role) {
            role = memberRecord.role as WorkspaceRole;
          }
        }

        set({
          workspaces: availableWorkspaces,
          activeWorkspaceId: selectedWs.id,
          userRole: role,
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('rb_active_workspace', JSON.stringify(selectedWs));
        }

        // Check if device has offline records that could be migrated (using dynamic tracker, not fixed UUID)
        const unmigratedCount = countUnmigratedLocalRecords(selectedWs.id);
        if (unmigratedCount > 0) {
          set({ showMigrationPrompt: true, localItemsCount: unmigratedCount });
        }
      }
    } catch (err) {
      console.warn('[SessionStore] refreshWorkspacesAndRole exception:', err);
    }
  },

  deleteWorkspace: async (workspaceId: string): Promise<boolean> => {
    const user = get().user;
    if (!user) return false;
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId).eq('owner_id', user.id);
      if (!error) {
        const remaining = get().workspaces.filter((w) => w.id !== workspaceId);
        const nextActive = get().activeWorkspaceId === workspaceId ? (remaining[0]?.id || '') : get().activeWorkspaceId;
        set({
          workspaces: remaining,
          activeWorkspaceId: nextActive,
        });
        if (typeof window !== 'undefined' && nextActive) {
          const nextWs = remaining.find((w) => w.id === nextActive);
          if (nextWs) {
            localStorage.setItem('rb_active_workspace', JSON.stringify(nextWs));
          }
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  migrateLocalDataToCloud: async (targetWorkspaceId: string) => {
    const result = await migrationEngine.executeMigration(targetWorkspaceId, (progress) => {
      get().setMigrationProgress(progress);
    });

    if (result.success) {
      set({ showMigrationPrompt: false, localItemsCount: 0 });
    } else {
      // Re-calculate remaining unmigrated items in case of partial failure
      const remaining = countUnmigratedLocalRecords(targetWorkspaceId);
      set({ localItemsCount: remaining });
    }

    return result;
  },

  retryFailedMigration: async (targetWorkspaceId: string, failedRecords: MigrationFailure[]) => {
    const result = await migrationEngine.retryFailedRecords(targetWorkspaceId, failedRecords, (progress) => {
      get().setMigrationProgress(progress);
    });

    if (result.success) {
      set({ showMigrationPrompt: false, localItemsCount: 0 });
    } else {
      const remaining = countUnmigratedLocalRecords(targetWorkspaceId);
      set({ localItemsCount: remaining });
    }

    return result;
  },

  resetSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rb_cached_user');
      localStorage.removeItem('rb_last_sync_time');
      localStorage.removeItem('rb_sync_queue');
      localStorage.removeItem('rb_accounts');
      localStorage.removeItem('rb_cards');
      localStorage.removeItem('rb_customers');
      localStorage.removeItem('rb_dues');
      localStorage.removeItem('rb_ledger_entries');
      localStorage.removeItem('rb_notes');
      localStorage.removeItem('rb_saved_sheets');
      localStorage.removeItem('rb_vault_saved_items');
      localStorage.removeItem('rb_vault_auth_token');
      localStorage.removeItem('rb_vault_lockout');

      try {
        useAccountStore.getState().clearAccounts();
        useCardStore.getState().clearCardData();
        useCustomerStore.getState().clearCustomerData();
        useLedgerStore.getState().clearLedger();
        useNoteStore.getState().clearNotes();
        useVaultStore.getState().resetVault();
        import('@/stores/useSheetStore').then((m) => m.useSheetStore.getState().setSheets([]));
      } catch {}
    }
    const localWs = getOrCreateLocalWorkspace();
    set({
      user: null,
      userRole: null,
      authLoading: false,
      workspaces: [localWs],
      activeWorkspaceId: localWs.id,
      syncStatus: 'offline',
      pendingSyncCount: 0,
      showMigrationPrompt: false,
      migrationProgress: null,
    });
  },
}));
