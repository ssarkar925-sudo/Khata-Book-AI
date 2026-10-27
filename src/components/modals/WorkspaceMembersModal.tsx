'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  Trash2,
  Check,
  Crown,
  Eye,
  Edit3,
  Loader2,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { WorkspaceRole, WorkspaceMember } from '@/types';
import { supabase } from '@/lib/supabase';

export function WorkspaceMembersModal() {
  const {
    isMembersModalOpen,
    setMembersModalOpen,
    workspaces,
    activeWorkspaceId,
    user,
    userRole,
    theme,
  } = useSessionStore();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const isOwner = userRole === 'owner' || activeWs?.owner_id === user?.id;
  const isAdmin = isOwner || userRole === 'admin';
  const isLight = theme === 'light';

  const fetchMembers = async () => {
    if (!activeWorkspaceId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.warn('[WorkspaceMembersModal] Fetch members error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMembersModalOpen) {
      fetchMembers();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isMembersModalOpen, activeWorkspaceId]);

  if (!isMembersModalOpen) return null;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!inviteEmail.trim()) {
      setErrorMsg('Please provide a valid user email.');
      return;
    }

    if (!isAdmin) {
      setErrorMsg('Only workspace owners and admins may add members.');
      return;
    }

    setAdding(true);
    try {
      // In Supabase, we create membership tied to workspace_id and email or target user
      const newMemberPayload = {
        workspace_id: activeWorkspaceId,
        user_id: user?.id, // Default to current actor UUID as placeholder until invited user accepts, or use email reference
        member_email: inviteEmail.trim().toLowerCase(),
        role: inviteRole === 'owner' ? 'admin' : inviteRole, // Disallow creating duplicate owners
      };

      const { data, error } = await supabase
        .from('workspace_members')
        .insert(newMemberPayload)
        .select()
        .single();

      if (error) throw error;

      setSuccessMsg(`Added ${inviteEmail} as ${inviteRole}.`);
      setInviteEmail('');
      setInviteRole('member');
      fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add workspace member.');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (memberId: string, currentTargetRole: WorkspaceRole, newRole: WorkspaceRole) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isAdmin) {
      setErrorMsg('Permission denied.');
      return;
    }

    // Admins cannot alter owner or other admins
    if (!isOwner && currentTargetRole === 'admin') {
      setErrorMsg('Admins cannot alter permissions of another Admin.');
      return;
    }

    if (newRole === 'owner') {
      setErrorMsg('Workspace ownership cannot be transferred directly.');
      return;
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('workspace_id', activeWorkspaceId);

      if (error) throw error;

      setSuccessMsg(`Role updated to ${newRole}.`);
      fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update member role.');
    }
  };

  const handleRemoveMember = async (memberId: string, targetRole: WorkspaceRole, targetUserId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Cannot remove owner
    if (targetUserId === activeWs?.owner_id) {
      setErrorMsg('Owner cannot be removed.');
      return;
    }

    // Admin cannot remove other admin
    if (!isOwner && targetRole === 'admin') {
      setErrorMsg('Admins cannot remove other Admins. Only the Owner can.');
      return;
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId)
        .eq('workspace_id', activeWorkspaceId);

      if (error) throw error;

      setSuccessMsg('Member removed.');
      fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member.');
    }
  };

  const handleLeaveWorkspace = async () => {
    if (isOwner) {
      setErrorMsg('Owners cannot leave their own workspace. Delete or transfer it instead.');
      return;
    }

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSuccessMsg('You have left this workspace.');
      setTimeout(() => {
        setMembersModalOpen(false);
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to leave workspace.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden glass-panel ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-inherit bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent">
          <button
            onClick={() => setMembersModalOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Workspace Members</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-medium">{activeWs?.name}</span>
                <span className="text-xs text-slate-400">•</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isOwner
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : isAdmin
                      ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                      : userRole === 'member'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Your Role: {userRole || (isOwner ? 'owner' : 'viewer')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add Member Form (Owners & Admins only) */}
          {isAdmin ? (
            <form onSubmit={handleAddMember} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-inherit space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <UserPlus className="w-4 h-4 text-indigo-500" />
                <span>Invite New Workspace Member</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-hidden transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 focus:border-indigo-500'
                      : 'bg-slate-800 border-white/10 focus:border-indigo-400'
                  }`}
                />

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border outline-hidden transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-slate-800 border-white/10 text-slate-200'
                  }`}
                >
                  <option value="member">Member (CRUD)</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                  {isOwner && <option value="admin">Admin (Manage Members)</option>}
                </select>

                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Invite</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-inherit text-xs text-slate-500 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-400 shrink-0" />
              <span>You have view access to workspace members. Only admins can invite new members.</span>
            </div>
          )}

          {/* Members Roster */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Active Members
            </div>

            {/* Owner Item (Always Top) */}
            <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-2 truncate">
                    <span>{activeWs?.owner_id === user?.id ? user.email || 'You' : 'Workspace Owner'}</span>
                    {activeWs?.owner_id === user?.id && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">(You)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">Account Owner • Full Access</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                  Owner (Primary)
                </span>
              </div>
            </div>

            {/* Other Members */}
            {loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading workspace members...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No additional team members invited yet.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-2xl border border-inherit bg-slate-50/50 dark:bg-white/5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 text-xs font-bold">
                      {member.member_email ? member.member_email[0].toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {member.member_email || member.user_id}
                        {member.user_id === user?.id && <span className="text-indigo-500 ml-1.5">(You)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {member.role === 'admin'
                          ? 'Admin • Can manage members'
                          : member.role === 'member'
                          ? 'Member • Can create & edit records'
                          : 'Viewer • Read-only access'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Role changer dropdown for owner/admin */}
                    {isAdmin && (isOwner || member.role !== 'admin') && member.user_id !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, member.role, e.target.value as WorkspaceRole)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-xl border outline-hidden ${
                          isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10 text-slate-200'
                        }`}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        {isOwner && <option value="admin">Admin</option>}
                      </select>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          member.role === 'admin'
                            ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                            : member.role === 'member'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {member.role}
                      </span>
                    )}

                    {/* Remove member button */}
                    {isAdmin && (isOwner || member.role !== 'admin') && member.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.role, member.user_id)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Leave Workspace Option (Non-owner members only) */}
          {!isOwner && user && (
            <div className="pt-2 border-t border-inherit">
              <button
                onClick={handleLeaveWorkspace}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
