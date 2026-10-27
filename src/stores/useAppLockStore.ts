import { create } from 'zustand';
import { computeSecurePinHash } from '@/lib/crypto';

interface AppLockState {
  isLockConfigured: boolean;
  isLockEnabled: boolean;
  isLocked: boolean;
  isBiometricSupported: boolean;
  biometricEnabled: boolean;
  lockoutRemainingSeconds: number;

  setLockEnabled: (enabled: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  configurePin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<{ success: boolean; lockedOut?: boolean; remainingSec?: number }>;
  unlockWithBiometrics: () => Promise<boolean>;
  lockApp: () => void;
  removeLock: (currentPin: string) => Promise<boolean>;
  getLockoutStatus: () => { isLockedOut: boolean; remainingSec: number };
}

const PIN_STORAGE_KEY = 'rb_security_app_pin';
const LOCK_ENABLED_KEY = 'rb_security_lock_enabled';
const BIOMETRIC_ENABLED_KEY = 'rb_security_biometric_enabled';
const LOCKOUT_STORAGE_KEY = 'rb_security_lockout';

// Legacy fallback FNV hash for smooth migration of existing installations
function legacyHash(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function getStoredLockout(): { failedCount: number; lockedUntil: number } {
  if (typeof window === 'undefined') return { failedCount: 0, lockedUntil: 0 };
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { failedCount: 0, lockedUntil: 0 };
}

function setStoredLockout(failedCount: number, lockedUntil: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ failedCount, lockedUntil }));
  } catch {}
}

export const useAppLockStore = create<AppLockState>((set, get) => {
  const isClient = typeof window !== 'undefined';

  const storedPinData = isClient ? localStorage.getItem(PIN_STORAGE_KEY) : null;
  const isEnabled = isClient ? localStorage.getItem(LOCK_ENABLED_KEY) === 'true' : false;
  const isBiometric = isClient ? localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true' : false;

  // Genuine platform biometric support check (WebAuthn / PublicKeyCredential)
  const hasBiometrics = isClient && typeof window.PublicKeyCredential !== 'undefined';

  return {
    isLockConfigured: Boolean(storedPinData),
    isLockEnabled: Boolean(storedPinData && isEnabled),
    isLocked: Boolean(storedPinData && isEnabled),
    isBiometricSupported: Boolean(hasBiometrics),
    biometricEnabled: isBiometric,
    lockoutRemainingSeconds: 0,

    getLockoutStatus: () => {
      const { lockedUntil } = getStoredLockout();
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      return { isLockedOut: remaining > 0, remainingSec: remaining };
    },

    setLockEnabled: (enabled: boolean) => {
      if (isClient) {
        localStorage.setItem(LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
      }
      set({ isLockEnabled: enabled, isLocked: false });
    },

    setBiometricEnabled: (enabled: boolean) => {
      if (isClient) {
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
      }
      set({ biometricEnabled: enabled });
    },

    configurePin: async (pin: string) => {
      if (!isClient) return;
      const { hash, salt } = await computeSecurePinHash(pin);
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ hash, salt, algorithm: 'PBKDF2-SHA256' }));
      localStorage.setItem(LOCK_ENABLED_KEY, 'true');
      setStoredLockout(0, 0);

      set({
        isLockConfigured: true,
        isLockEnabled: true,
        isLocked: false,
        lockoutRemainingSeconds: 0,
      });
    },

    verifyPin: async (pin: string) => {
      if (!isClient) return { success: false };

      // 1. Rate limiting & lockout check
      const lockout = getStoredLockout();
      const now = Date.now();
      if (lockout.lockedUntil > now) {
        const remaining = Math.ceil((lockout.lockedUntil - now) / 1000);
        set({ lockoutRemainingSeconds: remaining });
        return { success: false, lockedOut: true, remainingSec: remaining };
      }

      // 2. Retrieve PIN record
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      if (!stored) return { success: false };

      let isMatch = false;
      try {
        if (stored.startsWith('{')) {
          const parsed = JSON.parse(stored);
          const computed = await computeSecurePinHash(pin, parsed.salt);
          isMatch = computed.hash === parsed.hash;
        } else {
          // Legacy migration
          isMatch = stored === legacyHash(pin);
          if (isMatch) {
            // Upgrade legacy hash to PBKDF2 automatically
            const upgraded = await computeSecurePinHash(pin);
            localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ ...upgraded, algorithm: 'PBKDF2-SHA256' }));
          }
        }
      } catch {
        isMatch = false;
      }

      if (isMatch) {
        // Reset failed attempts on success
        setStoredLockout(0, 0);
        set({ isLocked: false, lockoutRemainingSeconds: 0 });
        return { success: true };
      }

      // 3. Failed attempt handling
      const newFailed = lockout.failedCount + 1;
      let newLockedUntil = 0;
      if (newFailed >= 10) {
        newLockedUntil = now + 300 * 1000; // 5 minute lockout
      } else if (newFailed >= 5) {
        newLockedUntil = now + 30 * 1000; // 30 second lockout
      }
      setStoredLockout(newFailed, newLockedUntil);

      const remaining = newLockedUntil > now ? Math.ceil((newLockedUntil - now) / 1000) : 0;
      set({ lockoutRemainingSeconds: remaining });
      return { success: false, lockedOut: remaining > 0, remainingSec: remaining };
    },

    unlockWithBiometrics: async () => {
      if (!isClient || !window.PublicKeyCredential) return false;

      // Rate limiting check applies to biometrics as well
      const lockout = getStoredLockout();
      if (lockout.lockedUntil > Date.now()) return false;

      try {
        // Check if genuine WebAuthn platform authenticator is available
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!isAvailable) {
          console.warn('[Security] Platform biometric authenticator not available on this device');
          return false;
        }

        // Trigger real native WebAuthn biometric prompt
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
          },
        });

        if (credential) {
          setStoredLockout(0, 0);
          set({ isLocked: false, lockoutRemainingSeconds: 0 });
          return true;
        }
        return false;
      } catch (err: any) {
        // Biometric canceled, unsupported, or failed
        console.warn('[Security] Biometric authentication rejected or aborted:', err?.name);
        return false;
      }
    },

    lockApp: () => {
      const state = get();
      if (state.isLockEnabled) {
        set({ isLocked: true });
      }
    },

    removeLock: async (currentPin: string) => {
      if (!isClient) return false;
      const verifyResult = await get().verifyPin(currentPin);
      if (!verifyResult.success) return false;

      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(LOCK_ENABLED_KEY);
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      set({
        isLockConfigured: false,
        isLockEnabled: false,
        isLocked: false,
        lockoutRemainingSeconds: 0,
      });
      return true;
    },
  };
});
