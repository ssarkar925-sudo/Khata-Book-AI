import React from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';

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
      className={`inline-flex items-center gap-0.5 rounded-xl border p-0.5 shadow-2xs backdrop-blur-md select-none ${
        isLight
          ? 'bg-white/90 border-slate-200 text-slate-600'
          : 'bg-black/40 border-white/15 text-slate-300'
      } ${className}`}
      title="Drag card to arrange or use Up/Down arrows"
    >
      {/* Visual Drag Grip Handle */}
      <div
        className={`${btnPadding} rounded-lg cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-violet-500 transition-colors flex items-center justify-center`}
        title="Drag card to arrange"
      >
        <GripVertical className={iconSize} />
      </div>

      {/* Move Up Button */}
      <button
        type="button"
        draggable={false}
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

      {/* Move Down Button */}
      <button
        type="button"
        draggable={false}
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
