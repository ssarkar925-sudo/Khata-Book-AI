'use client';

import React, { useState } from 'react';
import {
  Lock,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  X,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { VaultItem } from '@/types';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { encryptData, decryptData } from '@/lib/crypto';

export function VaultScreen() {
  const { vaultItems, masterPassword, isUnlocked, setMasterPassword, addVaultItemOptimistic, deleteVaultItemOptimistic, lockVault } = useVaultStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  const [enteredPin, setEnteredPin] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});

  // Add Item State
  const [itemTitle, setItemTitle] = useState('');
  const [itemType, setItemType] = useState<'password' | 'pin' | 'id_card' | 'secure_note'>('password');
  const [username, setUsername] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPin.trim()) return;
    setMasterPassword(enteredPin.trim());
    setEnteredPin('');
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !secretValue || !masterPassword) return;

    try {
      const encrypted = await encryptData(secretValue, masterPassword);

      const newItem: VaultItem = {
        id: crypto.randomUUID(),
        workspace_id: activeWorkspaceId,
        title: itemTitle.trim(),
        item_type: itemType,
        username: username.trim() || null,
        encrypted_password: encrypted.encrypted,
        iv: encrypted.iv,
        salt: encrypted.salt,
        auth_tag: encrypted.authTag,
        notes: itemNotes.trim() || null,
        decrypted_password: secretValue,
      };

      addVaultItemOptimistic(newItem);
      setShowAddModal(false);
      setItemTitle('');
      setUsername('');
      setSecretValue('');
      setItemNotes('');
    } catch {
      alert('Failed to encrypt secret. Please try again.');
    }
  };

  const revealPassword = async (item: VaultItem) => {
    if (visiblePasswords[item.id]) {
      const next = { ...visiblePasswords };
      delete next[item.id];
      setVisiblePasswords(next);
      return;
    }

    if (item.decrypted_password) {
      setVisiblePasswords((prev) => ({ ...prev, [item.id]: item.decrypted_password! }));
      return;
    }

    if (!masterPassword || !item.encrypted_password || !item.iv || !item.salt) return;

    try {
      const decrypted = await decryptData(item.encrypted_password, item.iv, item.salt, masterPassword);
      setVisiblePasswords((prev) => ({ ...prev, [item.id]: decrypted }));
    } catch {
      alert('Decryption failed. Incorrect master password.');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'password':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'pin':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'id_card':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25">
              <Lock className="w-5 h-5" />
            </div>
            <span>Encrypted Vault (AES-256)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zero-knowledge client-side encryption for banking logins, ATM PINs, and personal IDs.
          </p>
        </div>

        {isUnlocked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-bold text-white text-xs shadow-lg shadow-violet-500/25 transition-all hover-lift touch-press"
            >
              <Plus className="w-4 h-4" />
              <span>Add Secret</span>
            </button>

            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all touch-press"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault</span>
            </button>
          </div>
        )}
      </div>

      {!isUnlocked ? (
        /* Locked State */
        <div
          className={`max-w-md mx-auto rounded-3xl border p-8 text-center space-y-5 shadow-2xl ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}
        >
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Vault is Locked</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
              Enter your Master PIN or Password to decrypt your stored secrets and passwords.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3.5">
            <input
              type="password"
              required
              autoFocus
              placeholder="Enter Master Password / PIN"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-center font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs shadow-lg shadow-violet-500/30 transition-all hover-lift touch-press"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Vault Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaultItems.length === 0 ? (
            <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-600 dark:text-slate-300">Vault is empty.</p>
              <p className="text-[11px]">Click &quot;Add Secret&quot; above to store bank passwords, PINs, and ID records safely.</p>
            </div>
          ) : (
            vaultItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-3xl border p-5 space-y-4 transition-all hover-lift ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getTypeBadge(item.item_type)}`}>
                      {item.item_type}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h3>
                  </div>

                  <button
                    onClick={() => deleteVaultItemOptimistic(item.id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {item.username && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-400">User/ID: </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.username}</span>
                  </div>
                )}

                {/* Secret Value View & Copy */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="truncate pr-2 font-bold text-slate-800 dark:text-slate-200">
                    {visiblePasswords[item.id] ? visiblePasswords[item.id] : '••••••••••••'}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => revealPassword(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
                      title={visiblePasswords[item.id] ? 'Hide' : 'Reveal'}
                    >
                      {visiblePasswords[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => copyToClipboard(item.decrypted_password || visiblePasswords[item.id] || '', item.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
                      title="Copy"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-[11px] text-slate-400">{item.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Add Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Secret to Vault</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Netbanking, PAN Card"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Item Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="password">Password</option>
                  <option value="pin">PIN Code</option>
                  <option value="id_card">Personal ID / Aadhaar / PAN</option>
                  <option value="secure_note">Secure Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username / ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. user@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Secret / Password Value</label>
                <input
                  type="password"
                  required
                  placeholder="Secret content to encrypt"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs shadow-md shadow-violet-500/25"
                >
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
