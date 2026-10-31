'use client';

import dynamic from 'next/dynamic';

const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((mod) => mod.AppShell),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090d16]">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-teal-400 flex items-center justify-center font-extrabold text-xs text-white shadow-md shadow-indigo-500/25 animate-pulse">
          RB
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">Record Book - Smart Financial Ledger</h1>
      <AppShell />
    </>
  );
}
