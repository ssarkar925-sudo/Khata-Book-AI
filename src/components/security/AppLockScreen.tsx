'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAppLockStore } from '@/stores/useAppLockStore';

export function AppLockScreen() {
  const {
    isLocked,
    isLockEnabled,
    verifyPin,
    unlockWithBiometrics,
    isBiometricSupported,
    biometricEnabled,
    getLockoutStatus,
  } = useAppLockStore();

  const [pin, setPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Initialize lockout state on mount
  useEffect(() => {
    if (isLocked && isLockEnabled) {
      const status = getLockoutStatus();
      if (status.isLockedOut) {
        setLockoutTimer(status.remainingSec);
        setErrorMsg(`Too many failed attempts. Locked for ${status.remainingSec}s.`);
      }
    }
  }, [isLocked, isLockEnabled, getLockoutStatus]);

  // Lockout tick-down timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Handle number click
  const handleNumClick = async (num: number) => {
    if (lockoutTimer > 0) return;
    if (pin.length < 4) {
      const nextPin = pin + num.toString();
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        const res = await verifyPin(nextPin);
        if (res.lockedOut) {
          setLockoutTimer(res.remainingSec || 30);
          setErrorMsg(`Too many failed attempts. Locked for ${res.remainingSec || 30}s.`);
          setPin('');
        } else if (!res.success) {
          setErrorShake(true);
          setErrorMsg('Incorrect 4-digit PIN');
          setTimeout(() => {
            setPin('');
            setErrorShake(false);
          }, 600);
        } else {
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutTimer > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleBiometricClick = async () => {
    if (lockoutTimer > 0) return;
    setErrorMsg('');
    const success = await unlockWithBiometrics();
    if (!success) {
      setErrorMsg('Biometric authentication failed or was cancelled. Please enter PIN.');
    }
  };

  // Don't render if not locked
  if (!isLocked || !isLockEnabled) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 bg-slate-950/95 backdrop-blur-xl text-white select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col items-center pt-8 space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-teal-400 p-0.5 shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
          <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
            <Lock className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-black tracking-tight text-white">Record Book Protected</h1>
          <p className="text-xs text-slate-400 mt-1">
            {lockoutTimer > 0
              ? `Temporarily locked for security (${lockoutTimer}s remaining)`
              : 'Enter your 4-digit PIN to access your accounts'}
          </p>
        </div>
      </div>

      {/* PIN Dots Display */}
      <div className="flex flex-col items-center space-y-4 my-auto">
        <div
          className={`flex items-center gap-4 transition-transform duration-200 ${
            errorShake ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  lockoutTimer > 0
                    ? 'bg-rose-500/40 border border-rose-500/50'
                    : isFilled
                    ? 'bg-gradient-to-tr from-indigo-500 to-teal-400 scale-125 shadow-lg shadow-indigo-500/50'
                    : 'bg-white/15 border border-white/20'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold animate-in fade-in max-w-xs text-center px-2">
            {lockoutTimer > 0 ? <ShieldAlert className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Number Pad Grid */}
      <div className="w-full max-w-xs space-y-3 pb-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num)}
              disabled={lockoutTimer > 0}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 border border-white/5 text-xl font-bold text-white transition-all touch-press flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Genuine Biometrics button - only shown if real biometrics are supported and enabled */}
          {isBiometricSupported && biometricEnabled ? (
            <button
              onClick={handleBiometricClick}
              disabled={lockoutTimer > 0}
              className="h-16 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 disabled:opacity-30 border border-indigo-500/20 text-indigo-400 transition-all touch-press flex items-center justify-center"
              title="Unlock with Biometrics"
            >
              <Fingerprint className="w-7 h-7" />
            </button>
          ) : (
            <div className="h-16" />
          )}

          {/* Zero */}
          <button
            onClick={() => handleNumClick(0)}
            disabled={lockoutTimer > 0}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 border border-white/5 text-xl font-bold text-white transition-all touch-press flex items-center justify-center shadow-sm"
          >
            0
          </button>

          {/* Backspace */}
          <button
            onClick={handleBackspace}
            disabled={lockoutTimer > 0}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 border border-white/5 text-slate-400 hover:text-white transition-all touch-press flex items-center justify-center"
            title="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center pt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            PBKDF2-SHA256 • Rate-Limited Storage
          </span>
        </div>
      </div>
    </div>
  );
}
