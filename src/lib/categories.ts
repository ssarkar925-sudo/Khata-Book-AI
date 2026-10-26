export interface ExpenseCategoryDef {
  id: string;
  name: string;
  iconName: string;
  color: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
  type: 'expense' | 'income' | 'both';
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  {
    id: 'inventory',
    name: 'Inventory & Stock',
    iconName: 'Package',
    color: '#3b82f6', // blue
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    borderLight: 'border-blue-200 dark:border-blue-500/20',
    textLight: 'text-blue-700 dark:text-blue-300',
    type: 'expense',
  },
  {
    id: 'rent',
    name: 'Rent & Maintenance',
    iconName: 'Building2',
    color: '#8b5cf6', // purple
    bgLight: 'bg-purple-50 dark:bg-purple-950/30',
    borderLight: 'border-purple-200 dark:border-purple-500/20',
    textLight: 'text-purple-700 dark:text-purple-300',
    type: 'expense',
  },
  {
    id: 'bills',
    name: 'Electricity & Utilities',
    iconName: 'Zap',
    color: '#f59e0b', // amber
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    borderLight: 'border-amber-200 dark:border-amber-500/20',
    textLight: 'text-amber-700 dark:text-amber-300',
    type: 'expense',
  },
  {
    id: 'salary',
    name: 'Staff Salary & Wages',
    iconName: 'Users',
    color: '#10b981', // emerald
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200 dark:border-emerald-500/20',
    textLight: 'text-emerald-700 dark:text-emerald-300',
    type: 'expense',
  },
  {
    id: 'food',
    name: 'Food, Tea & Snacks',
    iconName: 'Coffee',
    color: '#f43f5e', // rose
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
    borderLight: 'border-rose-200 dark:border-rose-500/20',
    textLight: 'text-rose-700 dark:text-rose-300',
    type: 'expense',
  },
  {
    id: 'travel',
    name: 'Travel & Fuel',
    iconName: 'Car',
    color: '#ea580c', // orange
    bgLight: 'bg-orange-50 dark:bg-orange-950/30',
    borderLight: 'border-orange-200 dark:border-orange-500/20',
    textLight: 'text-orange-700 dark:text-orange-300',
    type: 'expense',
  },
  {
    id: 'marketing',
    name: 'Marketing & Printing',
    iconName: 'Megaphone',
    color: '#ec4899', // pink
    bgLight: 'bg-pink-50 dark:bg-pink-950/30',
    borderLight: 'border-pink-200 dark:border-pink-500/20',
    textLight: 'text-pink-700 dark:text-pink-300',
    type: 'expense',
  },
  {
    id: 'maintenance',
    name: 'Repairs & Hardware',
    iconName: 'Wrench',
    color: '#14b8a6', // teal
    bgLight: 'bg-teal-50 dark:bg-teal-950/30',
    borderLight: 'border-teal-200 dark:border-teal-500/20',
    textLight: 'text-teal-700 dark:text-teal-300',
    type: 'expense',
  },
  {
    id: 'logistics',
    name: 'Shipping & Courier',
    iconName: 'Truck',
    color: '#06b6d4', // cyan
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderLight: 'border-cyan-200 dark:border-cyan-500/20',
    textLight: 'text-cyan-700 dark:text-cyan-300',
    type: 'expense',
  },
  {
    id: 'sales_revenue',
    name: 'Sales & Service Income',
    iconName: 'TrendingUp',
    color: '#10b981', // emerald
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200 dark:border-emerald-500/20',
    textLight: 'text-emerald-700 dark:text-emerald-300',
    type: 'income',
  },
  {
    id: 'consulting',
    name: 'Consulting & Freelance',
    iconName: 'Briefcase',
    color: '#6366f1', // indigo
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderLight: 'border-indigo-200 dark:border-indigo-500/20',
    textLight: 'text-indigo-700 dark:text-indigo-300',
    type: 'income',
  },
  {
    id: 'general',
    name: 'General & Others',
    iconName: 'Tag',
    color: '#64748b', // slate
    bgLight: 'bg-slate-50 dark:bg-slate-800/40',
    borderLight: 'border-slate-200 dark:border-white/10',
    textLight: 'text-slate-700 dark:text-slate-300',
    type: 'both',
  },
];

export function getCategoryById(id?: string | null): ExpenseCategoryDef {
  if (!id) return EXPENSE_CATEGORIES.find((c) => c.id === 'general')!;
  return (
    EXPENSE_CATEGORIES.find((c) => c.id === id) ||
    EXPENSE_CATEGORIES.find((c) => c.id === 'general')!
  );
}
