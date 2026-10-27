import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { Workspace, SyncStatus } from '@/types';

export const DEFAULT_LOCAL_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@recordbook.local',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Record Book Owner' },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEFAULT_LOCAL_WORKSPACE: Workspace = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Primary Record Book',
  currency: 'INR',
  owner_id: '00000000-0000-0000-0000-000000000001',
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
      // Generate unique persistent device workspace UUID for multi-tenant isolation
      const uniqueId = crypto.randomUUID();
      const uniqueWs: Workspace = {
        id: uniqueId,
        name: 'Primary Record Book',
        currency: 'INR',
        owner_id: DEFAULT_LOCAL_USER.id,
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
  authLoading: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  pendingSyncCount: number;
  lastSyncError: string | null;
  theme: 'light' | 'dark';
  language: 'en' | 'bn' | 'hi';
  
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string | null) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'bn' | 'hi') => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('rb_cached_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    // Default to active local owner without requiring login
    return DEFAULT_LOCAL_USER;
  })(),
  authLoading: false,
  workspaces: (() => {
    const ws = getOrCreateLocalWorkspace();
    return [ws];
  })(),
  activeWorkspaceId: (() => {
    const ws = getOrCreateLocalWorkspace();
    return ws.id;
  })(),
  syncStatus: 'synced',
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

  setUser: (user) => {
    const activeUser = user || DEFAULT_LOCAL_USER;
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_cached_user', JSON.stringify({
        id: activeUser.id,
        email: activeUser.email,
        user_metadata: activeUser.user_metadata,
        aud: activeUser.aud,
        created_at: activeUser.created_at,
      }));
    }
    set({ user: activeUser, authLoading: false });
  },

  setAuthLoading: (authLoading) => set({ authLoading }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
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
  resetSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rb_cached_user');
    }
    set({
      user: DEFAULT_LOCAL_USER,
      authLoading: false,
      workspaces: [DEFAULT_LOCAL_WORKSPACE],
      activeWorkspaceId: DEFAULT_LOCAL_WORKSPACE.id,
      syncStatus: 'synced',
    });
  },
}));
