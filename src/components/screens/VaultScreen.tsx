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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-500" />
            <span>Encrypted Vault (AES-256)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Client-side encrypted storage for banking passwords and confidential PINs.
          </p>
        </div>

        {isUnlocked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Secret</span>
            </button>

            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors"
            >
              <Lock className="w-3 h-3" />
              <span>Lock</span>
            </button>
          </div>
        )}
      </div>

      {!isUnlocked ? (
        /* Locked State */
        <div
          className={`max-w-sm mx-auto rounded-xl border p-6 text-center space-y-4 ${
            isLight ? 'bg-white border-zinc-200 shadow-2xs' : 'bg-[#121215] border-zinc-800/80 shadow-2xs'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Vault is Locked</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Enter your Master PIN or Password to decrypt your stored secrets.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              required
              placeholder="Master PIN / Password"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-center font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Vault Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {vaultItems.length === 0 ? (
            <div className="col-span-full text-center py-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-xs text-zinc-400 space-y-1">
              <p>Vault is empty.</p>
              <p className="text-[11px] text-zinc-500">Click &quot;Add Secret&quot; above to store secure passwords or IDs.</p>
            </div>
          ) : (
            vaultItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  isLight ? 'bg-white border-zinc-200 hover:border-zinc-400' : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {item.item_type}
                    </span>
                    <h3 className="font-medium text-xs text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                  </div>

                  <button
                    onClick={() => deleteVaultItemOptimistic(item.id)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {item.username && (
                  <div className="text-xs text-zinc-500">
                    <span className="text-zinc-400">User: </span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">{item.username}</span>
                  </div>
                )}

                {/* Secret Value View & Copy */}
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
                  <span className="truncate pr-2 text-zinc-800 dark:text-zinc-200">
                    {visiblePasswords[item.id] ? visiblePasswords[item.id] : '••••••••••••'}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => revealPassword(item)}
                      className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                      title={visiblePasswords[item.id] ? 'Hide' : 'Reveal'}
                    >
                      {visiblePasswords[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => copyToClipboard(item.decrypted_password || visiblePasswords[item.id] || '', item.id)}
                      className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                      title="Copy"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-[11px] text-zinc-400">{item.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Add Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Add Secret to Vault</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SBI Netbanking, PAN Card"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Type</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="password">Password</option>
                  <option value="pin">PIN Code</option>
                  <option value="id_card">Personal ID / Aadhaar / PAN</option>
                  <option value="secure_note">Secure Note</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Username / ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. user@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Secret / Password Value</label>
                <input
                  type="password"
                  required
                  placeholder="Secret content to encrypt"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-medium transition-colors"
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
