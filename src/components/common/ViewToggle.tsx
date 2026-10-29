import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  gridTitle?: string;
  listTitle?: string;
}

export function ViewToggle({
  viewMode,
  onChange,
  className = '',
  gridTitle = 'Grid View',
  listTitle = 'List View',
}: ViewToggleProps) {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0 ${className}`}
      role="group"
      aria-label="View switcher"
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        title={gridTitle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          viewMode === 'grid'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-[11px]">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        title={listTitle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          viewMode === 'list'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-[11px]">List</span>
      </button>
    </div>
  );
}
