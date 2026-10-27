import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { Workspace, WorkspaceRole, SyncStatus } from '@/types';
import { supabase } from '@/lib/supabase';

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
        if (parsed && parsed.id) return parsed;
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
      return uniqueWs;
    } catch {}
  }
  return DEFAULT_LOCAL_WORKSPACE;
}

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

  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshWorkspacesAndRole: (currentUser?: User | null) => Promise<void>;
  migrateLocalDataToCloud: (targetWorkspaceId: string) => Promise<{ count: number; error?: string }>;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null, // Unauthenticated by default; authentic Supabase session populated by initAuth
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
  syncStatus: 'offline', // Strictly 'offline' in unauthenticated local-only mode
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
      return (localStorage.getItem('rb_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  })(),
  language: 'en',
  isAuthModalOpen: false,
  isMembersModalOpen: false,
  showMigrationPrompt: false,
  localItemsCount: 0,

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
    // Prevent unauthenticated state from ever masquerading as synced
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

  initAuth: async () => {
    set({ authLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        set({ user: session.user });
        await get().refreshWorkspacesAndRole(session.user);
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

    // Subscribe to auth state updates
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          set({ user: session.user, authLoading: false });
          await get().refreshWorkspacesAndRole(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        get().resetSession();
      }
    });
  },

  signIn: async (email, password) => {
    set({ authLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ authLoading: false });
        return { success: false, error: error.message };
      }
      if (data.user) {
        get().setUser(data.user);
        await get().refreshWorkspacesAndRole(data.user);
        return { success: true };
      }
      return { success: false, error: 'Sign in failed' };
    } catch (err: any) {
      set({ authLoading: false });
      return { success: false, error: err.message || 'Network error' };
    }
  },

  signUp: async (email, password, fullName) => {
    set({ authLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        set({ authLoading: false });
        return { success: false, error: error.message };
      }
      if (data.user) {
        get().setUser(data.user);
        await get().refreshWorkspacesAndRole(data.user);
        return { success: true };
      }
      return { success: false, error: 'Sign up failed' };
    } catch (err: any) {
      set({ authLoading: false });
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

      // 2. If no workspace exists for this newly authenticated user, create exactly one owned workspace
      if (!wsList || wsList.length === 0) {
        // Try safe RPC helper first
        const { data: rpcWs, error: rpcErr } = await supabase.rpc('get_or_create_default_workspace');
        if (!rpcErr && rpcWs) {
          wsList = [rpcWs];
        } else {
          // Direct insert with authenticated user ID
          const { data: newWs, error: insErr } = await supabase
            .from('workspaces')
            .insert({
              name: 'Personal Record Book',
              currency: 'INR',
              owner_id: user.id, // Strictly auth.uid()
            })
            .select()
            .single();

          if (!insErr && newWs) {
            wsList = [newWs];
          }
        }
      }

      const availableWorkspaces: Workspace[] = wsList && wsList.length > 0
        ? wsList.map((w: any) => ({
            id: w.id,
            name: w.name,
            currency: w.currency || 'INR',
            owner_id: w.owner_id,
            created_at: w.created_at,
            updated_at: w.updated_at,
          }))
        : [];

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

        // Check if device has offline records that could be migrated
        const storedLocal = localStorage.getItem('rb_active_workspace');
        const defaultLocalId = '00000000-0000-0000-0000-000000000010';
        let unmigratedCount = 0;
        try {
          const ledgerRaw = localStorage.getItem('rb_ledger_entries');
          if (ledgerRaw) {
            const entries = JSON.parse(ledgerRaw);
            unmigratedCount += entries.filter((e: any) => e.workspace_id === defaultLocalId || !e.workspace_id).length;
          }
        } catch {}

        if (unmigratedCount > 0) {
          set({ showMigrationPrompt: true, localItemsCount: unmigratedCount });
        }
      }
    } catch (err) {
      console.warn('[SessionStore] refreshWorkspacesAndRole exception:', err);
    }
  },

  migrateLocalDataToCloud: async (targetWorkspaceId: string) => {
    let migratedCount = 0;
    try {
      const stores = [
        'rb_cash_locations',
        'rb_customers',
        'rb_people_dues',
        'rb_cards',
        'rb_ledger_entries',
        'rb_notes',
        'rb_sheets',
      ];

      for (const storeKey of stores) {
        const raw = localStorage.getItem(storeKey);
        if (!raw) continue;
        try {
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            const updated = items.map((item: any) => {
              if (!item.workspace_id || item.workspace_id === '00000000-0000-0000-0000-000000000010') {
                migratedCount++;
                return { ...item, workspace_id: targetWorkspaceId };
              }
              return item;
            });
            localStorage.setItem(storeKey, JSON.stringify(updated));
          }
        } catch {}
      }

      set({ showMigrationPrompt: false, localItemsCount: 0 });
      return { count: migratedCount };
    } catch (err: any) {
      return { count: migratedCount, error: err?.message || 'Migration failed' };
    }
  },

  resetSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rb_cached_user');
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
    });
  },
}));
