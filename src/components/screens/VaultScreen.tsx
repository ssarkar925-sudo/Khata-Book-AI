'use client';

import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  X,
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
    } catch (err) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-500" />
            <span>Zero-Knowledge Encrypted Vault</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store banking passwords, PINs, and personal IDs (Aadhaar, PAN) encrypted with AES-256.
          </p>
        </div>

        {isUnlocked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 font-semibold text-white text-xs shadow-md shadow-purple-500/20 transition-all touch-press"
            >
              <Plus className="w-4 h-4" />
              <span>Add Password / ID</span>
            </button>

            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all touch-press"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault</span>
            </button>
          </div>
        )}
      </div>

      {!isUnlocked ? (
        /* Locked Screen */
        <div
          className={`max-w-md mx-auto rounded-3xl border p-8 text-center space-y-4 shadow-xl ${
            isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Vault is Locked</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your Master PIN/Password to decrypt your stored passwords and personal records.
          </p>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              required
              placeholder="Enter Master Password / PIN"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all touch-press"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Vault Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaultItems.length === 0 ? (
            <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400">
              Vault is empty. Click <span className="font-bold text-purple-500">+ Add Password / ID</span> above to store your bank passwords, portal logins, and personal IDs safely.
            </div>
          ) : (
            vaultItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-3xl border p-5 space-y-3 transition-all hover-lift ${
                  isLight ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-900/80 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      {item.item_type}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h3>
                  </div>

                  <button
                    onClick={() => deleteVaultItemOptimistic(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {item.username && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="opacity-75">ID/User: </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{item.username}</span>
                  </div>
                )}

                {/* Secret Value View & Copy */}
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="truncate pr-2">
                    {visiblePasswords[item.id] ? visiblePasswords[item.id] : '••••••••••••'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => revealPassword(item)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {visiblePasswords[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        const val = visiblePasswords[item.id] || item.decrypted_password || '';
                        if (val) copyToClipboard(val, item.id);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Add Vault Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Encrypted Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC NetBanking, PAN & Aadhaar"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Item Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="password">Password / Portal Login</option>
                  <option value="pin">Bank ATM PIN</option>
                  <option value="id_card">Personal ID / PAN / Aadhaar</option>
                  <option value="secure_note">Secret Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Username / ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. user_admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Secret / Password / Number</label>
                <input
                  type="password"
                  required
                  placeholder="Enter secret to encrypt"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              >
                Encrypt & Save in Vault
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
