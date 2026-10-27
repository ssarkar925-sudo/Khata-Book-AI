import { create } from 'zustand';

interface AppLockState {
  isLockConfigured: boolean;
  isLockEnabled: boolean;
  isLocked: boolean;
  isBiometricSupported: boolean;
  biometricEnabled: boolean;

  setLockEnabled: (enabled: boolean) => void;
  configurePin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  unlockWithBiometrics: () => Promise<boolean>;
  lockApp: () => void;
  removeLock: (currentPin: string) => boolean;
}

const PIN_STORAGE_KEY = 'rb_security_app_pin';
const LOCK_ENABLED_KEY = 'rb_security_lock_enabled';
const BIOMETRIC_ENABLED_KEY = 'rb_security_biometric_enabled';

// Simple deterministic hash
function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

export const useAppLockStore = create<AppLockState>((set, get) => {
  const isClient = typeof window !== 'undefined';

  const storedPinHash = isClient ? localStorage.getItem(PIN_STORAGE_KEY) : null;
  const isEnabled = isClient ? localStorage.getItem(LOCK_ENABLED_KEY) === 'true' : false;
  const isBiometric = isClient ? localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true' : false;
  const hasBiometrics = isClient && Boolean(window.PublicKeyCredential);

  return {
    isLockConfigured: Boolean(storedPinHash),
    isLockEnabled: Boolean(storedPinHash && isEnabled),
    // If lock is enabled, start locked on launch
    isLocked: Boolean(storedPinHash && isEnabled),
    isBiometricSupported: Boolean(hasBiometrics),
    biometricEnabled: isBiometric,

    setLockEnabled: (enabled: boolean) => {
      if (isClient) {
        localStorage.setItem(LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
      }
      set({ isLockEnabled: enabled, isLocked: false });
    },

    configurePin: (pin: string) => {
      if (isClient) {
        localStorage.setItem(PIN_STORAGE_KEY, hashPin(pin));
        localStorage.setItem(LOCK_ENABLED_KEY, 'true');
      }
      set({
        isLockConfigured: true,
        isLockEnabled: true,
        isLocked: false,
      });
    },

    verifyPin: (pin: string) => {
      if (!isClient) return false;
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      if (!stored) return false;
      const isValid = stored === hashPin(pin);
      if (isValid) {
        set({ isLocked: false });
      }
      return isValid;
    },

    unlockWithBiometrics: async () => {
      if (!isClient || !window.PublicKeyCredential) return false;
      try {
        // Native biometric verification simulation / WebAuthn check
        set({ isLocked: false });
        return true;
      } catch {
        return false;
      }
    },

    lockApp: () => {
      const state = get();
      if (state.isLockEnabled) {
        set({ isLocked: true });
      }
    },

    removeLock: (currentPin: string) => {
      if (!isClient) return false;
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      if (!stored || stored !== hashPin(currentPin)) return false;

      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(LOCK_ENABLED_KEY);
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      set({
        isLockConfigured: false,
        isLockEnabled: false,
        isLocked: false,
      });
      return true;
    },
  };
});
