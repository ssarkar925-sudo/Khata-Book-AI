'use client';

import React, { useState, useMemo } from 'react';
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
  RotateCcw,
  ShieldAlert,
  Edit2,
  Palette,
  Sparkles,
  Search,
  ExternalLink,
  RefreshCw,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { VaultItem, VaultSecretField } from '@/types';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { encryptData, decryptData } from '@/lib/crypto';

const VAULT_COLORS = [
  { id: '#3B82F6', name: 'Blue', label: 'Banking & Finance', bg: 'bg-blue-500', text: 'text-blue-500' },
  { id: '#10B981', name: 'Emerald', label: 'Tax & Govt Portals', bg: 'bg-emerald-500', text: 'text-emerald-500' },
  { id: '#8B5CF6', name: 'Purple', label: 'Logins & Passwords', bg: 'bg-purple-500', text: 'text-purple-500' },
  { id: '#F59E0B', name: 'Amber', label: 'PINs & Security Codes', bg: 'bg-amber-500', text: 'text-amber-500' },
  { id: '#F43F5E', name: 'Rose', label: 'High Security & Keys', bg: 'bg-rose-500', text: 'text-rose-500' },
  { id: '#6366F1', name: 'Indigo', label: 'Business & Merchant', bg: 'bg-indigo-500', text: 'text-indigo-500' },
  { id: '#06B6D4', name: 'Cyan', label: 'Identity & Cards', bg: 'bg-cyan-500', text: 'text-cyan-500' },
  { id: '#64748B', name: 'Slate', label: 'General & Notes', bg: 'bg-slate-500', text: 'text-slate-500' },
];

// Helper to serialize and encrypt multiple secrets
async function encryptSecretsPayload(
  secrets: VaultSecretField[],
  masterPassword: string
): Promise<{ encrypted: string; iv: string; salt: string; authTag: string }> {
  const payloadStr = JSON.stringify(secrets);
  return encryptData(payloadStr, masterPassword);
}

// Helper to decrypt and parse multiple secrets
async function decryptSecretsPayload(
  encrypted: string,
  iv: string,
  salt: string,
  masterPassword: string
): Promise<VaultSecretField[]> {
  try {
    const raw = await decryptData(encrypted, iv, salt, masterPassword);
    // Check if it is a JSON array of VaultSecretField
    if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    // Legacy single password string
    return [{ id: 'sec_1', label: 'Primary Password', value: raw }];
  } catch {
    throw new Error('Decryption failed');
  }
}

// Password Generator helper
function generateRandomSecret(type: 'password' | 'pin'): string {
  if (type === 'pin') {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  }
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()_+';
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function VaultScreen() {
  const {
    vaultItems,
    setVaultItems,
    masterPassword,
    isUnlocked,
    hasConfiguredPassword,
    setupMasterPassword,
    verifyAndUnlock,
    changeMasterPassword,
    resetVault,
    addVaultItemOptimistic,
    updateVaultItemOptimistic,
    deleteVaultItemOptimistic,
    lockVault,
  } = useVaultStore();

  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  // Unlock / Setup PIN Inputs
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [authError, setAuthError] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Change PIN Modal
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  // Reset Vault Modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Decrypted Cache in-memory: map of itemId -> VaultSecretField[]
  const [decryptedSecretsMap, setDecryptedSecretsMap] = useState<Record<string, VaultSecretField[]>>({});
  // Mask/Reveal individual secret field: key is `${itemId}_${secretId}`
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [revealAll, setRevealAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemType, setItemType] = useState<'password' | 'pin' | 'id_card' | 'secure_note'>('password');
  const [itemCategory, setItemCategory] = useState('Banking & Finance');
  const [itemColor, setItemColor] = useState('#3B82F6');
  const [itemUsername, setItemUsername] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  // Multiple password fields for Add Modal
  const [secretFields, setSecretFields] = useState<VaultSecretField[]>([
    { id: 'sec_1', label: 'Login Password', value: '' },
  ]);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'password' | 'pin' | 'id_card' | 'secure_note'>('password');
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSecretFields, setEditSecretFields] = useState<VaultSecretField[]>([]);

  // Password Generator Modal / Widget
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGenModal, setShowGenModal] = useState(false);
  const [genTargetIndex, setGenTargetIndex] = useState<{ isEdit: boolean; index: number } | null>(null);

  // Authentication Handlers
  const handleInitialSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!enteredPin.trim() || enteredPin.length < 4) {
      setAuthError('PIN / Password must be at least 4 characters long.');
      return;
    }
    if (enteredPin !== confirmPin) {
      setAuthError('Passwords do not match. Please re-enter.');
      return;
    }

    setupMasterPassword(enteredPin.trim());
    setEnteredPin('');
    setConfirmPin('');
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!enteredPin.trim()) return;

    const ok = verifyAndUnlock(enteredPin.trim());
    if (!ok) {
      setAuthError('Incorrect Master Password / PIN. Please try again.');
    } else {
      setEnteredPin('');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (newPinInput !== confirmNewPinInput) {
      setChangePinError('New PINs do not match.');
      return;
    }
    if (newPinInput.length < 4) {
      setChangePinError('New PIN must be at least 4 characters.');
      return;
    }

    try {
      // Re-encrypt all existing vault items with the new PIN so data is preserved
      const updatedVaultItems: VaultItem[] = [];
      for (const item of vaultItems) {
        if (item.encrypted_password && item.iv && item.salt) {
          try {
            const decrypted = await decryptSecretsPayload(
              item.encrypted_password,
              item.iv,
              item.salt,
              currentPinInput
            );
            const reEncrypted = await encryptSecretsPayload(decrypted, newPinInput);
            updatedVaultItems.push({
              ...item,
              encrypted_password: reEncrypted.encrypted,
              iv: reEncrypted.iv,
              salt: reEncrypted.salt,
              updated_at: new Date().toISOString(),
            });
          } catch {
            setChangePinError('Current Master PIN is incorrect.');
            return;
          }
        } else {
          updatedVaultItems.push(item);
        }
      }

      const ok = changeMasterPassword(currentPinInput, newPinInput);
      if (!ok) {
        setChangePinError('Current Master PIN is incorrect.');
        return;
      }

      if (updatedVaultItems.length > 0) {
        setVaultItems(updatedVaultItems);
      }

      setChangePinSuccess('Master PIN & vault items re-encrypted successfully!');
      setTimeout(() => {
        setShowChangePinModal(false);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmNewPinInput('');
        setChangePinSuccess('');
      }, 1000);
    } catch (err: any) {
      setChangePinError(err?.message || 'Failed to update Master PIN.');
    }
  };

  const handleConfirmReset = () => {
    resetVault();
    setShowResetModal(false);
    setEnteredPin('');
    setConfirmPin('');
    setAuthError('');
    alert('Vault has been reset. You can now configure a fresh Master PIN.');
  };

  // Decrypt Item Helper
  const ensureDecrypted = async (item: VaultItem): Promise<VaultSecretField[]> => {
    if (decryptedSecretsMap[item.id]) {
      return decryptedSecretsMap[item.id];
    }
    if (!masterPassword || !item.encrypted_password || !item.iv || !item.salt) {
      if (item.decrypted_password) {
        return [{ id: 'sec_1', label: 'Primary Password', value: item.decrypted_password }];
      }
      return [];
    }

    try {
      const parsed = await decryptSecretsPayload(
        item.encrypted_password,
        item.iv,
        item.salt,
        masterPassword
      );
      setDecryptedSecretsMap((prev) => ({ ...prev, [item.id]: parsed }));
      return parsed;
    } catch {
      return [{ id: 'sec_1', label: 'Password', value: 'Decryption Error' }];
    }
  };

  // Toggle reveal for a specific secret field
  const toggleRevealField = async (item: VaultItem, secretId: string) => {
    await ensureDecrypted(item);
    const key = `${item.id}_${secretId}`;
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Copy to clipboard with visual feedback
  const handleCopySecret = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  // Add Item Submit
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !masterPassword) return;

    // Filter out completely empty secret fields unless there's at least one
    const validSecrets = secretFields.filter((s) => s.label.trim() && s.value.trim());
    if (validSecrets.length === 0 && secretFields.length > 0) {
      validSecrets.push({
        id: crypto.randomUUID(),
        label: secretFields[0].label || 'Password',
        value: secretFields[0].value || '',
      });
    }

    try {
      const encrypted = await encryptSecretsPayload(validSecrets, masterPassword);

      const newItem: VaultItem = {
        id: crypto.randomUUID(),
        workspace_id: activeWorkspaceId,
        title: itemTitle.trim(),
        item_type: itemType,
        category: itemCategory,
        color: itemColor,
        username: itemUsername.trim() || null,
        url: itemUrl.trim() || null,
        encrypted_password: encrypted.encrypted,
        iv: encrypted.iv,
        salt: encrypted.salt,
        auth_tag: encrypted.authTag,
        notes: itemNotes.trim() || null,
        secrets: validSecrets,
      };

      addVaultItemOptimistic(newItem);
      setDecryptedSecretsMap((prev) => ({ ...prev, [newItem.id]: validSecrets }));
      setShowAddModal(false);

      // Reset
      setItemTitle('');
      setItemUsername('');
      setItemUrl('');
      setItemNotes('');
      setSecretFields([{ id: 'sec_1', label: 'Login Password', value: '' }]);
    } catch {
      alert('Failed to encrypt secret. Please try again.');
    }
  };

  // Open Edit Modal
  const openEditModal = async (item: VaultItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditType(item.item_type);
    setEditCategory(item.category || 'Banking & Finance');
    setEditColor(item.color || '#3B82F6');
    setEditUsername(item.username || '');
    setEditUrl(item.url || '');
    setEditNotes(item.notes || '');

    const secrets = await ensureDecrypted(item);
    setEditSecretFields(secrets.length > 0 ? secrets : [{ id: 'sec_1', label: 'Password', value: '' }]);
  };

  // Save Edit Item Submit
  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || !masterPassword) return;

    const validSecrets = editSecretFields.filter((s) => s.label.trim() && s.value.trim());
    if (validSecrets.length === 0 && editSecretFields.length > 0) {
      validSecrets.push({
        id: crypto.randomUUID(),
        label: editSecretFields[0].label || 'Password',
        value: editSecretFields[0].value || '',
      });
    }

    try {
      const encrypted = await encryptSecretsPayload(validSecrets, masterPassword);

      const updates: Partial<VaultItem> = {
        title: editTitle.trim(),
        item_type: editType,
        category: editCategory,
        color: editColor,
        username: editUsername.trim() || null,
        url: editUrl.trim() || null,
        notes: editNotes.trim() || null,
        encrypted_password: encrypted.encrypted,
        iv: encrypted.iv,
        salt: encrypted.salt,
        auth_tag: encrypted.authTag,
        secrets: validSecrets,
      };

      updateVaultItemOptimistic(editingItem.id, updates);
      setDecryptedSecretsMap((prev) => ({ ...prev, [editingItem.id]: validSecrets }));
      setEditingItem(null);
    } catch {
      alert('Failed to update and encrypt item.');
    }
  };

  // Add another password field helper
  const addSecretFieldToAddForm = (presetLabel?: string) => {
    setSecretFields((prev) => [
      ...prev,
      {
        id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: presetLabel || 'Transaction Password',
        value: '',
      },
    ]);
  };

  const addSecretFieldToEditForm = (presetLabel?: string) => {
    setEditSecretFields((prev) => [
      ...prev,
      {
        id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: presetLabel || 'Transaction Password',
        value: '',
      },
    ]);
  };

  // Generator trigger
  const handleGenerateAndApply = (isEdit: boolean, index: number, type: 'password' | 'pin') => {
    const val = generateRandomSecret(type);
    if (isEdit) {
      setEditSecretFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, value: val } : f))
      );
    } else {
      setSecretFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, value: val } : f))
      );
    }
  };

  // Filtered Vault Items
  const filteredVaultItems = useMemo(() => {
    return vaultItems.filter((item) => {
      // Category filter
      if (activeCategoryFilter !== 'all') {
        const itemCat = item.category || 'Banking & Finance';
        if (itemCat !== activeCategoryFilter && item.color !== activeCategoryFilter) {
          return false;
        }
      }
      // Search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.username && item.username.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [vaultItems, activeCategoryFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25">
              <Lock className="w-5 h-5" />
            </div>
            <span>Encrypted Digital Vault (AES-GCM 256)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zero-knowledge client-side encryption. Store NetBanking logins, multiple transaction passwords & PINs.
          </p>
        </div>

        {isUnlocked && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRevealAll(!revealAll)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all touch-press"
              title="Toggle reveal all passwords"
            >
              {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{revealAll ? 'Mask All' : 'Reveal All'}</span>
            </button>

            <button
              onClick={() => setShowChangePinModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all touch-press"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change PIN</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-bold text-white text-xs shadow-lg shadow-violet-500/25 transition-all hover-lift touch-press"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vault Item</span>
            </button>

            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all touch-press"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Now</span>
            </button>
          </div>
        )}
      </div>

      {!isUnlocked ? (
        /* Locked / Master PIN Screen */
        <div
          className={`max-w-md mx-auto rounded-3xl border p-8 text-center space-y-5 shadow-2xl ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}
        >
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
            <KeyRound className="w-7 h-7" />
          </div>

          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              {hasConfiguredPassword ? 'Unlock Secure Digital Vault' : 'Set Up Master PIN / Password'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto">
              {hasConfiguredPassword
                ? 'Enter your Master PIN or Password to decrypt your stored passwords & keys.'
                : 'Create a Master PIN (4+ digits) to protect all your sensitive banking and business credentials.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {authError}
            </div>
          )}

          {!hasConfiguredPassword ? (
            /* First Time Setup Form */
            <form onSubmit={handleInitialSetup} className="space-y-3.5">
              <input
                type="password"
                required
                autoFocus
                placeholder="Choose a Master PIN (e.g. 1234)"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-center font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="password"
                required
                placeholder="Confirm Master PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-center font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs shadow-lg shadow-violet-500/30 transition-all hover-lift touch-press"
              >
                Set Master PIN & Open Vault
              </button>
            </form>
          ) : (
            /* Unlock Form */
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs text-slate-400 hover:text-rose-500 underline font-medium"
                >
                  Forgot PIN? Reset Vault Password
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Unlocked Vault Interface */
        <div className="space-y-5">
          {/* Category & Color Filter Bar */}
          <div
            className={`p-3 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
              isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10'
            }`}
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  activeCategoryFilter === 'all'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                All ({vaultItems.length})
              </button>

              {VAULT_COLORS.map((cat) => {
                const isActive = activeCategoryFilter === cat.label;
                const isBright = cat.id === '#F59E0B' || cat.id === '#06B6D4';
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryFilter(cat.label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? isBright
                          ? 'text-slate-950 font-black shadow-sm'
                          : 'text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                    style={{
                      backgroundColor: isActive ? cat.id : undefined,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isActive ? (isBright ? '#0f172a' : '#FFFFFF') : cat.id,
                      }}
                    />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search secrets, IDs, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Vault Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVaultItems.length === 0 ? (
              <div className="col-span-full text-center py-12 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-600 dark:text-slate-300">No vault items found.</p>
                <p className="text-[11px]">Click &quot;Add Vault Item&quot; to store bank logins, PINs, and secure credentials.</p>
              </div>
            ) : (
              filteredVaultItems.map((item) => {
                const itemColor = item.color || '#3B82F6';
                const cachedSecrets = decryptedSecretsMap[item.id] || (item.secrets && item.secrets.length > 0 ? item.secrets : null);

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-5 space-y-4 transition-all hover-lift relative overflow-hidden ${
                      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10'
                    }`}
                  >
                    {/* Top Accent Strip */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: itemColor }}
                    />

                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: itemColor }}
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {item.category || 'General'}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{item.title}</span>
                          {item.url && (
                            <a
                              href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </h3>
                      </div>

                      {/* Card Action Controls: Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                          title="Edit Vault Item & Multiple Passwords"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${item.title}" from vault?`)) {
                              deleteVaultItemOptimistic(item.id);
                            }
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete from Vault"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Username / Login ID */}
                    {item.username && (
                      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <span className="text-slate-400 text-[11px]">User / ID:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            {item.username}
                          </span>
                          <button
                            onClick={() => handleCopySecret(item.username!, `user_${item.id}`)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            title="Copy Username"
                          >
                            {copiedKey === `user_${item.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Multiple Secrets / Passwords Display */}
                    <div className="space-y-2">
                      {cachedSecrets && cachedSecrets.length > 0 ? (
                        cachedSecrets.map((secret) => {
                          const fieldKey = `${item.id}_${secret.id}`;
                          const isRevealed = revealAll || revealedFields[fieldKey];

                          return (
                            <div
                              key={secret.id}
                              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <span>{secret.label || 'Password'}</span>
                                <span className="font-normal font-mono lowercase">AES-256</span>
                              </div>

                              <div className="flex items-center justify-between font-mono text-xs">
                                <span className="truncate pr-2 font-bold text-slate-800 dark:text-slate-100">
                                  {isRevealed ? secret.value : '••••••••••••'}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => toggleRevealField(item, secret.id)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
                                    title={isRevealed ? 'Hide' : 'Reveal'}
                                  >
                                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    onClick={() => handleCopySecret(secret.value, fieldKey)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
                                    title="Copy Password"
                                  >
                                    {copiedKey === fieldKey ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        /* Not yet decrypted in memory - Click to decrypt */
                        <div
                          onClick={() => ensureDecrypted(item)}
                          className="cursor-pointer p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/15 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          <span>•••••••••••• (Encrypted)</span>
                          <span className="text-[10px] font-sans font-bold text-violet-500">Tap to Decrypt</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {item.notes && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 border-t border-slate-100 dark:border-white/5 pt-2">
                        {item.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Vault Item with Multiple Passwords */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Secure Vault Item</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              {/* Title & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Account / Portal Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC NetBanking, GST Portal"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Website URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. netbanking.hdfcbank.com"
                    value={itemUrl}
                    onChange={(e) => setItemUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Username / Customer ID */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  User ID / Customer Number / Email
                </label>
                <input
                  type="text"
                  placeholder="e.g. 58914023 or admin@mybusiness.com"
                  value={itemUsername}
                  onChange={(e) => setItemUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Multiple Passwords Section */}
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Passwords & Credentials ({secretFields.length})
                  </label>
                  <span className="text-[11px] text-slate-400">Multiple passwords per account</span>
                </div>

                {secretFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Label (e.g. Login Password, Txn Password, MPIN)"
                        value={field.label}
                        onChange={(e) =>
                          setSecretFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f))
                          )
                        }
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none"
                      />

                      <div className="flex items-center gap-1">
                        {/* Generate Strong Password */}
                        <button
                          type="button"
                          onClick={() => handleGenerateAndApply(false, idx, 'password')}
                          className="px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold hover:bg-violet-500/20 transition-colors flex items-center gap-1"
                          title="Generate strong 16-char password"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Generate</span>
                        </button>

                        {/* Generate 6-Digit PIN */}
                        <button
                          type="button"
                          onClick={() => handleGenerateAndApply(false, idx, 'pin')}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                          title="Generate 6-digit PIN"
                        >
                          PIN
                        </button>

                        {secretFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSecretFields((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Enter secret password or PIN..."
                      value={field.value}
                      onChange={(e) =>
                        setSecretFields((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f))
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                ))}

                {/* Preset Chips to add another secret */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Quick add:</span>
                  {(
                    ['+ Txn Password', '+ ATM PIN', '+ UPI MPIN', '+ Security Key'] as const
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => addSecretFieldToAddForm(chip.replace('+ ', ''))}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSecretFieldToAddForm('Custom Secret')}
                    className="px-2.5 py-1 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/5 transition-colors"
                  >
                    + Custom Field
                  </button>
                </div>
              </div>

              {/* Color Select Tab & Category */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Color Tag & Category
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {VAULT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setItemColor(c.id);
                        setItemCategory(c.label);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        itemColor === c.id ? 'scale-110 ring-2 ring-offset-2 ring-violet-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.id }}
                      title={c.label}
                    >
                      {itemColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-bold text-slate-500 block">
                  Category: {itemCategory}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Security Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Account opened June 2024, Linked mobile 9876543210"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs shadow-md shadow-violet-500/25"
                >
                  Encrypt & Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Vault Item with Multiple Passwords */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Vault Item</h3>
                  <p className="text-[11px] text-slate-400">Update credentials, passwords & color tag</p>
                </div>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="space-y-4">
              {/* Title & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  User ID / Customer Number
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Multiple Passwords Section */}
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Passwords & Credentials ({editSecretFields.length})
                  </label>
                  <span className="text-[11px] text-slate-400">Edit or add more passwords</span>
                </div>

                {editSecretFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) =>
                          setEditSecretFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f))
                          )
                        }
                        className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none"
                      />

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleGenerateAndApply(true, idx, 'password')}
                          className="px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold hover:bg-violet-500/20 transition-colors flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Generate</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateAndApply(true, idx, 'pin')}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                        >
                          PIN
                        </button>

                        {editSecretFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditSecretFields((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      value={field.value}
                      onChange={(e) =>
                        setEditSecretFields((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f))
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                ))}

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Quick add:</span>
                  {(
                    ['+ Txn Password', '+ ATM PIN', '+ UPI MPIN', '+ Security Key'] as const
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => addSecretFieldToEditForm(chip.replace('+ ', ''))}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSecretFieldToEditForm('Custom Secret')}
                    className="px-2.5 py-1 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/5 transition-colors"
                  >
                    + Custom Field
                  </button>
                </div>
              </div>

              {/* Color Select Tab & Category */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Color Tag & Category
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {VAULT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setEditColor(c.id);
                        setEditCategory(c.label);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        editColor === c.id ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.id }}
                      title={c.label}
                    >
                      {editColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-bold text-slate-500 block">
                  Category: {editCategory}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Master PIN */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Change Master PIN / Password</h3>
              <button onClick={() => setShowChangePinModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePinError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {changePinError}
              </div>
            )}

            {changePinSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                {changePinSuccess}
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Current Master PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter current PIN"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  New Master PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new PIN"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Confirm New Master PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-type new PIN"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs shadow-md shadow-violet-500/25"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Vault (Safety Alert) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Reset Vault Security?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Because Record Book uses zero-knowledge encryption, resetting your Master PIN will wipe existing encrypted vault items for security.
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/25"
              >
                Yes, Reset Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
