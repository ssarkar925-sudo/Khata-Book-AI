'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileJson,
  Copy,
  Check,
  RefreshCw,
  Fingerprint,
  RotateCcw,
} from 'lucide-react';
import { useAccountStore } from '@/stores/useAccountStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useCardStore } from '@/stores/useCardStore';
import { useNoteStore } from '@/stores/useNoteStore';
import { useSheetStore } from '@/stores/useSheetStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAppLockStore } from '@/stores/useAppLockStore';
import { syncEngine } from '@/lib/syncEngine';
import { encryptData, decryptData } from '@/lib/crypto';
import { cloudSnapshotEngine, CloudSnapshot } from '@/lib/cloudSnapshotEngine';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'snapshots' | 'backup' | 'restore' | 'security';
}

export function BackupRestoreModal({
  isOpen,
  onClose,
  defaultTab = 'snapshots',
}: BackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'backup' | 'restore' | 'security'>(defaultTab);

  // Stores
  const { accounts, setAccounts } = useAccountStore();
  const { entries: ledger, setEntries } = useLedgerStore();
  const { customers, dues, setCustomers, setDues } = useCustomerStore();
  const { cards, setCards } = useCardStore();
  const { notes, setNotes } = useNoteStore();
  const { sheets, setSheets } = useSheetStore();
  const { vaultItems, setVaultItems } = useVaultStore();
  const { workspaces, activeWorkspaceId } = useSessionStore();

  // App Lock Store
  const {
    isLockEnabled,
    isLockConfigured,
    setLockEnabled,
    configurePin,
    removeLock,
    lockApp,
    isBiometricSupported,
  } = useAppLockStore();

  // Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<any | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Encrypted Backup & Restore State
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isEncryptedFile, setIsEncryptedFile] = useState(false);
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [rawEncryptedPayload, setRawEncryptedPayload] = useState<{
    encrypted_backup: boolean;
    iv: string;
    salt: string;
    payload: string;
    exported_at?: string;
  } | null>(null);

  // Cloud Snapshot State
  const [snapshotsList, setSnapshotsList] = useState<CloudSnapshot[]>(() => cloudSnapshotEngine.listSnapshots());
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState('');
  const [isAutoBackupOn, setIsAutoBackupOn] = useState(() => cloudSnapshotEngine.isAutoBackupEnabled());
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const handleTakeSnapshot = async () => {
    setIsTakingSnapshot(true);
    setSnapshotMessage('');
    try {
      const s = await cloudSnapshotEngine.takeSnapshot();
      setSnapshotsList(cloudSnapshotEngine.listSnapshots());
      setSnapshotMessage(`Snapshot taken successfully! (${s.total_records} records backed up)`);
    } catch (err: any) {
      setSnapshotMessage(`Failed to take snapshot: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    const success = await cloudSnapshotEngine.restoreSnapshot(id);
    if (success) {
      setRestoreSuccess('Cloud Snapshot restored successfully into your active session!');
      setConfirmRestoreId(null);
    } else {
      setRestoreError('Failed to restore selected snapshot.');
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    await cloudSnapshotEngine.deleteSnapshot(id);
    setSnapshotsList(cloudSnapshotEngine.listSnapshots());
  };

  const handleToggleAutoBackup = () => {
    const next = !isAutoBackupOn;
    setIsAutoBackupOn(next);
    cloudSnapshotEngine.setAutoBackupEnabled(next);
  };

  // App Lock Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [removePinInput, setRemovePinInput] = useState('');
  const [lockMsg, setLockMsg] = useState('');
  const [lockError, setLockError] = useState('');

  if (!isOpen) return null;

  // 1-Click Backup Export
  const generateBackupPayload = () => {
    return {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      workspace_id: activeWorkspaceId,
      data: {
        accounts,
        ledger,
        customers,
        dues,
        cards,
        notes,
        sheets,
        vaultItems,
        workspaces,
      },
      counts: {
        accounts: accounts.length,
        ledger: ledger.length,
        customers: customers.length,
        dues: dues.length,
        cards: cards.length,
        notes: notes.length,
        sheets: sheets.length,
        vaultItems: vaultItems.length,
      },
    };
  };

  const handleDownloadBackup = async () => {
    try {
      setIsExporting(true);
      const payload = generateBackupPayload();
      const jsonStr = JSON.stringify(payload, null, 2);
      const nowStr = new Date().toISOString().slice(0, 10);

      let finalContent: string;
      let filename: string;

      if (encryptBackup && backupPassword.trim().length >= 4) {
        const enc = await encryptData(jsonStr, backupPassword.trim());
        const envelope = {
          encrypted_backup: true,
          algorithm: 'AES-GCM-256-PBKDF2',
          exported_at: new Date().toISOString(),
          iv: enc.iv,
          salt: enc.salt,
          payload: enc.encrypted,
        };
        finalContent = JSON.stringify(envelope, null, 2);
        filename = `RecordBook_SecureBackup_${nowStr}.enc.json`;
      } else {
        finalContent = jsonStr;
        filename = `RecordBook_FullBackup_${nowStr}.json`;
      }

      const blob = new Blob([finalContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Failed to generate backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyBackupJSON = () => {
    const payload = generateBackupPayload();
    navigator.clipboard.writeText(JSON.stringify(payload));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 1-Click Restore File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError('');
    setRestoreSuccess('');
    setIsEncryptedFile(false);
    setRawEncryptedPayload(null);
    setRestoreFile(null);
    setRestorePasswordInput('');

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.encrypted_backup === true) {
          setIsEncryptedFile(true);
          setRawEncryptedPayload(parsed);
          return;
        }

        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Invalid Record Book backup format');
        }
        setRestoreFile(parsed);
      } catch (err: any) {
        setRestoreError('Failed to parse backup JSON. Please select a valid Record Book file.');
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDecryptBackup = async () => {
    if (!rawEncryptedPayload || !restorePasswordInput) return;
    setRestoreError('');
    try {
      const decryptedStr = await decryptData(
        rawEncryptedPayload.payload,
        rawEncryptedPayload.iv,
        rawEncryptedPayload.salt,
        restorePasswordInput
      );
      const parsed = JSON.parse(decryptedStr);
      if (!parsed.data || typeof parsed.data !== 'object') {
        throw new Error('Invalid decrypted payload');
      }
      setRestoreFile(parsed);
      setIsEncryptedFile(false);
      setRestoreSuccess('Backup file successfully unlocked & verified!');
    } catch {
      setRestoreError('Incorrect password! Unable to decrypt this backup file.');
    }
  };

  // Confirm Restore Action
  const handleExecuteRestore = (mode: 'replace' | 'merge') => {
    if (!restoreFile?.data) return;

    try {
      const data = restoreFile.data;

      if (mode === 'replace') {
        if (Array.isArray(data.accounts)) setAccounts(data.accounts);
        if (Array.isArray(data.ledger)) setEntries(data.ledger);
        if (Array.isArray(data.customers)) setCustomers(data.customers);
        if (Array.isArray(data.dues)) setDues(data.dues);
        if (Array.isArray(data.cards)) setCards(data.cards);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (Array.isArray(data.sheets)) setSheets(data.sheets);
        if (Array.isArray(data.vaultItems)) setVaultItems(data.vaultItems);
      } else {
        // Merge
        if (Array.isArray(data.accounts)) {
          const ids = new Set(accounts.map((a) => a.id));
          setAccounts([...accounts, ...data.accounts.filter((a: any) => !ids.has(a.id))]);
        }
        if (Array.isArray(data.ledger)) {
          const ids = new Set(ledger.map((l) => l.id));
          setEntries([...ledger, ...data.ledger.filter((l: any) => !ids.has(l.id))]);
        }
        if (Array.isArray(data.customers)) {
          const ids = new Set(customers.map((c) => c.id));
          setCustomers([...customers, ...data.customers.filter((c: any) => !ids.has(c.id))]);
        }
        if (Array.isArray(data.dues)) {
          const ids = new Set(dues.map((d) => d.id));
          setDues([...dues, ...data.dues.filter((d: any) => !ids.has(d.id))]);
        }
        if (Array.isArray(data.cards)) {
          const ids = new Set(cards.map((c) => c.id));
          setCards([...cards, ...data.cards.filter((c: any) => !ids.has(c.id))]);
        }
        if (Array.isArray(data.notes)) {
          const ids = new Set(notes.map((n) => n.id));
          setNotes([...notes, ...data.notes.filter((n: any) => !ids.has(n.id))]);
        }
        if (Array.isArray(data.sheets)) {
          const ids = new Set(sheets.map((s) => s.id));
          setSheets([...sheets, ...data.sheets.filter((s: any) => !ids.has(s.id))]);
        }
        if (Array.isArray(data.vaultItems)) {
          const ids = new Set(vaultItems.map((v) => v.id));
          setVaultItems([...vaultItems, ...data.vaultItems.filter((v: any) => !ids.has(v.id))]);
        }
      }

      setRestoreSuccess('Backup data restored successfully into all modules!');
      setTimeout(() => {
        setRestoreFile(null);
        setRestoreSuccess('');
      }, 2500);
    } catch {
      setRestoreError('An error occurred during restore.');
    }
  };

  // App Lock Setup Handlers
  const handleConfigurePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLockError('');
    setLockMsg('');

    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      setLockError('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setLockError('PINs do not match');
      return;
    }

    await configurePin(newPin);
    setLockMsg('App Lock PIN configured & activated!');
    setNewPin('');
    setConfirmPin('');
  };

  const handleDisableLock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLockError('');
    setLockMsg('');

    const ok = await removeLock(removePinInput);
    if (!ok) {
      setLockError('Incorrect current PIN');
    } else {
      setLockMsg('App Lock has been disabled.');
      setRemovePinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Backup, Restore & Security</h3>
              <p className="text-[11px] text-white/80">
                1-Click JSON export, database restore & App Lock
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 dark:border-white/10 px-6 pt-3 gap-2 bg-slate-50 dark:bg-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-bold transition-all shrink-0 ${
              activeTab === 'snapshots'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cloud Snapshots</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-bold transition-all shrink-0 ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Full Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-bold transition-all shrink-0 ${
              activeTab === 'restore'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore Data</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-bold transition-all shrink-0 ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>App Lock</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 0: CLOUD SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              {/* Snapshot Control Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span>Multi-Device Automated Cloud Backups</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Automatic daily snapshots protect all your data across phones and laptops.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoBackup}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      isAutoBackupOn
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/20 text-slate-500'
                    }`}
                  >
                    {isAutoBackupOn ? '✓ Auto-Daily: ON' : '✕ Auto-Daily: OFF'}
                  </button>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isTakingSnapshot}
                    onClick={handleTakeSnapshot}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTakingSnapshot ? 'animate-spin' : ''}`} />
                    <span>{isTakingSnapshot ? 'Taking Snapshot...' : 'Take Cloud Snapshot Now'}</span>
                  </button>
                </div>

                {snapshotMessage && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                    {snapshotMessage}
                  </p>
                )}
                {restoreSuccess && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                    {restoreSuccess}
                  </p>
                )}
                {restoreError && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg">
                    {restoreError}
                  </p>
                )}
              </div>

              {/* Snapshots Timeline List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Available Versioned Snapshots ({snapshotsList.length})</span>
                  <span>Timeline</span>
                </div>

                {snapshotsList.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-400 space-y-1">
                    <Database className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-bold">No snapshots recorded yet.</p>
                    <p className="text-[11px]">Click &quot;Take Cloud Snapshot Now&quot; above to capture your first state.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {snapshotsList.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {snap.device_name}
                            </span>
                            {snap.is_auto && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                Auto
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {snap.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(snap.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                          <span>Total records: <strong>{snap.total_records}</strong> (Ledger: {snap.data.ledger?.length || 0}, Dues: {snap.data.dues?.length || 0}, Sheets: {snap.data.sheets?.length || 0})</span>

                          <div className="flex items-center gap-2">
                            {confirmRestoreId === snap.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreSnapshot(snap.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px]"
                                >
                                  Confirm Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRestoreId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRestoreId(snap.id)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] transition-colors"
                                >
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSnapshot(snap.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                  title="Delete snapshot"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                <span className="font-bold block mb-1">📦 Complete Database Snapshot</span>
                Exports all your bank balances, ledger entries, customer dues, cards, notes, custom sheets, and encrypted vault records into a single portable `.json` file.
              </div>

              {/* Inventory Checklist of what is being backed up */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Accounts</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{accounts.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Transactions</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{ledger.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Khata Dues</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{dues.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Credit Cards</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{cards.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Notes</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{notes.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Record Sheets</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{sheets.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vault Items</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{vaultItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Format</span>
                  <span className="text-xs font-mono font-bold text-indigo-500">JSON 2.0</span>
                </div>
              </div>

              {/* Optional AES-256 Password Protection */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={encryptBackup}
                    onChange={(e) => setEncryptBackup(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>🔒 Protect Backup with Password (AES-GCM 256-bit)</span>
                </label>

                {encryptBackup && (
                  <div className="pt-1 space-y-1">
                    <input
                      type="password"
                      placeholder="Create a Backup Password (min 4 characters)"
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      This password will be required when restoring this backup file on any device.
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleDownloadBackup}
                  disabled={isExporting || (encryptBackup && backupPassword.trim().length < 4)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover-lift touch-press disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isExporting
                      ? 'Encrypting & Packaging...'
                      : encryptBackup
                      ? 'Download Encrypted Backup (.enc.json)'
                      : 'Download Full Backup (.json)'}
                  </span>
                </button>

                <button
                  onClick={handleCopyBackupJSON}
                  className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Copied JSON!' : 'Copy to Clipboard'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 1-CLICK RESTORE */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-1">⚠️ Restore Database from File</span>
                Upload a valid `RecordBook_FullBackup_*.json` file to restore your entire financial data seamlessly.
              </div>

              {restoreError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {restoreError}
                </div>
              )}

              {restoreSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{restoreSuccess}</span>
                </div>
              )}

              {isEncryptedFile ? (
                <div className="p-4 rounded-3xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-900/30">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">Password Protected Backup</h4>
                        <p className="text-[10px] text-slate-400">
                          {rawEncryptedPayload?.exported_at
                            ? `Exported: ${new Date(rawEncryptedPayload.exported_at).toLocaleString('en-IN')}`
                            : 'AES-GCM-256 Encrypted'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsEncryptedFile(false);
                        setRawEncryptedPayload(null);
                        setRestorePasswordInput('');
                        setRestoreError('');
                      }}
                      className="text-xs text-rose-500 hover:underline font-bold"
                    >
                      Change File
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Enter Backup Decryption Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter password..."
                      value={restorePasswordInput}
                      onChange={(e) => setRestorePasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && restorePasswordInput) {
                          handleDecryptBackup();
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleDecryptBackup}
                    disabled={!restorePasswordInput}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Unlock &amp; Verify Backup</span>
                  </button>
                </div>
              ) : !restoreFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-blue-500 dark:hover:border-blue-500 rounded-3xl flex flex-col items-center justify-center text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all space-y-2"
                >
                  <FileJson className="w-10 h-10 text-blue-500" />
                  <span className="font-bold">Select RecordBook Backup File (.json)</span>
                  <span className="text-[11px] text-slate-400">Click to browse your device</span>
                </button>
              ) : (
                <div className="p-4 rounded-3xl border border-slate-200 dark:border-white/10 space-y-3 bg-slate-50 dark:bg-white/5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Backup File Verified</h4>
                      <p className="text-[10px] text-slate-400">
                        Exported: {restoreFile.exported_at ? new Date(restoreFile.exported_at).toLocaleString('en-IN') : 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => setRestoreFile(null)}
                      className="text-xs text-rose-500 hover:underline font-bold"
                    >
                      Change File
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800">
                      <span className="text-slate-400 block text-[9px] uppercase">Ledger</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {restoreFile.data?.ledger?.length || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800">
                      <span className="text-slate-400 block text-[9px] uppercase">Contacts</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {restoreFile.data?.customers?.length || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800">
                      <span className="text-slate-400 block text-[9px] uppercase">Sheets</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {restoreFile.data?.sheets?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleExecuteRestore('merge')}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    >
                      Merge with Existing
                    </button>
                    <button
                      onClick={() => handleExecuteRestore('replace')}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all"
                    >
                      Clean Replace
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: APP LOCK ON LAUNCH */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/30">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      App Lock on Launch
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Require 4-digit PIN or fingerprint when opening Record Book
                    </p>
                  </div>
                </div>

                {isLockConfigured && (
                  <button
                    onClick={lockApp}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/25"
                  >
                    Lock Now
                  </button>
                )}
              </div>

              {lockMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{lockMsg}</span>
                </div>
              )}

              {lockError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {lockError}
                </div>
              )}

              {!isLockConfigured ? (
                /* Configure Form */
                <form onSubmit={handleConfigurePin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Choose 4-Digit Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      placeholder="e.g. 1234"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-center font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      placeholder="Re-type 4 digits"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-center font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25 transition-all hover-lift"
                  >
                    Activate App Lock
                  </button>
                </form>
              ) : (
                /* Already Configured - Option to disable or change */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Status: Active & Protected
                      </span>
                      <span className="text-[11px] text-slate-400">
                        App will ask for PIN / Fingerprint every time it opens
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                      ENABLED
                    </span>
                  </div>

                  <form onSubmit={handleDisableLock} className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Disable App Lock
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={4}
                        required
                        placeholder="Enter current PIN"
                        value={removePinInput}
                        onChange={(e) => setRemovePinInput(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                      >
                        Turn Off Lock
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
