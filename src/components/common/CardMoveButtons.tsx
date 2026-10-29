import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface CardMoveButtonsProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isLight?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function CardMoveButtons({
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isLight = true,
  className = '',
  size = 'sm',
}: CardMoveButtonsProps) {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const btnPadding = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-0.5 rounded-xl border p-0.5 shadow-2xs backdrop-blur-md ${
        isLight
          ? 'bg-white/80 border-slate-200 text-slate-600'
          : 'bg-black/40 border-white/15 text-slate-300'
      } ${className}`}
      title="Arrange Card Order"
    >
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        title="Move Up / Backward"
        className={`${btnPadding} rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          isLight
            ? 'hover:bg-slate-100 text-slate-600 hover:text-indigo-600'
            : 'hover:bg-white/15 text-slate-200 hover:text-white'
        }`}
      >
        <ArrowUp className={iconSize} />
      </button>

      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        title="Move Down / Forward"
        className={`${btnPadding} rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          isLight
            ? 'hover:bg-slate-100 text-slate-600 hover:text-indigo-600'
            : 'hover:bg-white/15 text-slate-200 hover:text-white'
        }`}
      >
        <ArrowDown className={iconSize} />
      </button>
    </div>
  );
}
