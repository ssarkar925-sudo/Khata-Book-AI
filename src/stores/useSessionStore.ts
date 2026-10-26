import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { Workspace, SyncStatus } from '@/types';

interface SessionState {
  user: User | null;
  authLoading: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  syncStatus: SyncStatus;
  theme: 'light' | 'dark';
  language: 'en' | 'bn' | 'hi';
  
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'bn' | 'hi') => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('khata_cached_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  })(),
  authLoading: (() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('khata_cached_user');
        const hasSession = Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (!cached && !hasSession) return false;
        if (cached) return false;
      } catch {}
    }
    return false;
  })(),
  workspaces: [],
  activeWorkspaceId: '',
  syncStatus: 'synced',
  theme: (() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('khata_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  })(),
  language: 'en',

  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('khata_cached_user', JSON.stringify({
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
          aud: user.aud,
          created_at: user.created_at,
        }));
      } else {
        localStorage.removeItem('khata_cached_user');
      }
    }
    set({ user, authLoading: false });
  },

  setAuthLoading: (authLoading) => set({ authLoading }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('khata_theme', theme);
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
      localStorage.removeItem('khata_cached_user');
    }
    set({
      user: null,
      authLoading: false,
      workspaces: [],
      activeWorkspaceId: '',
      syncStatus: 'synced',
    });
  },
}));
