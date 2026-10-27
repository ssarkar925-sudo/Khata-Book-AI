'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAppLockStore } from '@/stores/useAppLockStore';

export function AppLockScreen() {
  const { isLocked, isLockEnabled, verifyPin, unlockWithBiometrics, isBiometricSupported } =
    useAppLockStore();
  const [pin, setPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle number click
  const handleNumClick = (num: number) => {
    if (pin.length < 4) {
      const nextPin = pin + num.toString();
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        // Attempt unlock
        const success = verifyPin(nextPin);
        if (!success) {
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
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleBiometricClick = async () => {
    const success = await unlockWithBiometrics();
    if (!success) {
      setErrorMsg('Biometric authentication failed. Use PIN.');
    }
  };

  // Auto trigger biometrics on screen appear if supported
  useEffect(() => {
    if (isLocked && isLockEnabled && isBiometricSupported) {
      unlockWithBiometrics().catch(() => {});
    }
  }, [isLocked, isLockEnabled, isBiometricSupported]);

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
          <p className="text-xs text-slate-400 mt-1">Enter your 4-digit PIN to access your accounts</p>
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
                  isFilled
                    ? 'bg-gradient-to-tr from-indigo-500 to-teal-400 scale-125 shadow-lg shadow-indigo-500/50'
                    : 'bg-white/15 border border-white/20'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
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
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-xl font-bold text-white transition-all touch-press flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Biometrics button */}
          <button
            onClick={handleBiometricClick}
            className="h-16 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-indigo-500/30 border border-indigo-500/20 text-indigo-400 transition-all touch-press flex items-center justify-center"
            title="Unlock with Fingerprint"
          >
            <Fingerprint className="w-7 h-7" />
          </button>

          {/* Zero */}
          <button
            onClick={() => handleNumClick(0)}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-xl font-bold text-white transition-all touch-press flex items-center justify-center shadow-sm"
          >
            0
          </button>

          {/* Backspace */}
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-slate-400 hover:text-white transition-all touch-press flex items-center justify-center"
            title="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center pt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Encrypted Client Storage
          </span>
        </div>
      </div>
    </div>
  );
}
