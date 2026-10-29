'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  X,
  Phone,
  Search,
  Calendar,
  AlertCircle,
  Building,
  User,
  Clock,
  ArrowRight,
  Edit3,
  Trash2,
  FileText,
  Globe,
  Building2,
  Users2,
} from 'lucide-react';
import { Customer, PeopleDue, CustomerType, EntityScope } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { syncEngine } from '@/lib/syncEngine';
import { ContactDetailModal } from '@/components/modals/ContactDetailModal';
import { SettleDueModal } from '@/components/modals/SettleDueModal';
import { WhatsAppReminderModal } from '@/components/modals/WhatsAppReminderModal';
import { ViewToggle, ViewMode } from '@/components/common/ViewToggle';

export function DuesScreen() {
  const { customers, dues } = useCustomerStore();
  const { activeWorkspaceId, theme } = useSessionStore();
  const isLight = theme === 'light';

  // Search & Filter
  const [selectedScope, setSelectedScope] = useState<'all' | EntityScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'customer' | 'supplier' | 'overdue'>('all');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rb_view_dues') as ViewMode) || 'list';
    }
    return 'list';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_view_dues', mode);
    }
  };

  // Modals state
  const [selectedCustForDetail, setSelectedCustForDetail] = useState<Customer | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddDueModal, setShowAddDueModal] = useState(false);
  const [dueToSettle, setDueToSettle] = useState<{ due: PeopleDue; customer: Customer } | null>(null);
  const [custToEdit, setCustToEdit] = useState<Customer | null>(null);
  const [reminderModalData, setReminderModalData] = useState<{ due: PeopleDue; customer: Customer } | null>(null);

  // Add Customer State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custType, setCustType] = useState<CustomerType>('customer');

  // Edit Customer State
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustType, setEditCustType] = useState<CustomerType>('customer');

  // Add Due State
  const [dueScope, setDueScope] = useState<EntityScope>('business');
  const [selectedCustId, setSelectedCustId] = useState('');
  const [dueAmountRupees, setDueAmountRupees] = useState('');
  const [dueDirection, setDueDirection] = useState<'you_will_get' | 'you_will_give'>('you_will_get');
  const [dueDays, setDueDays] = useState(7);
  const [customDueDate, setCustomDueDate] = useState('');
  const [dueNotes, setDueNotes] = useState('');

  // Handle Add Customer
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const newCust: Customer = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: custName.trim(),
      phone: custPhone.trim() || null,
      address: custAddress.trim() || null,
      type: custType,
      created_at: new Date().toISOString(),
    };

    syncEngine.pushCustomer(newCust);
    setShowAddCustomerModal(false);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustType('customer');
  };

  // Open Edit Customer Modal
  const handleOpenEditCustomer = (cust: Customer) => {
    setCustToEdit(cust);
    setEditCustName(cust.name);
    setEditCustPhone(cust.phone || '');
    setEditCustAddress(cust.address || '');
    setEditCustType(cust.type || 'customer');
  };

  // Save Edit Customer
  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custToEdit || !editCustName.trim()) return;

    const updates: Partial<Customer> = {
      name: editCustName.trim(),
      phone: editCustPhone.trim() || null,
      address: editCustAddress.trim() || null,
      type: editCustType,
      updated_at: new Date().toISOString(),
    };

    syncEngine.updateCustomer(custToEdit.id, updates);

    if (selectedCustForDetail && selectedCustForDetail.id === custToEdit.id) {
      setSelectedCustForDetail({ ...selectedCustForDetail, ...updates });
    }

    setCustToEdit(null);
  };

  // Delete Customer
  const handleDeleteCustomer = (id: string) => {
    syncEngine.deleteCustomer(id);
    if (selectedCustForDetail && selectedCustForDetail.id === id) {
      setSelectedCustForDetail(null);
    }
  };

  // Handle Create Due Record
  const handleCreateDue = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(dueAmountRupees);
    if (paise <= 0 || !selectedCustId) return;

    let targetDate = new Date();
    if (customDueDate) {
      targetDate = new Date(customDueDate);
    } else {
      targetDate.setDate(targetDate.getDate() + dueDays);
    }

    const newDue: PeopleDue = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      customer_id: selectedCustId,
      direction: dueDirection,
      amount: paise,
      scope: dueScope,
      due_date: targetDate.toISOString(),
      status: 'pending',
      notes: dueNotes.trim() || null,
      created_at: new Date().toISOString(),
    };

    syncEngine.pushDue(newDue);
    setShowAddDueModal(false);
    setDueAmountRupees('');
    setDueNotes('');
    setCustomDueDate('');
    setDueDays(7);
  };

  const pendingDues = dues.filter(
    (d) => d.status === 'pending' && (selectedScope === 'all' || (d.scope || 'business') === selectedScope)
  );
  const nowTime = new Date().getTime();

  // Metrics
  const totalReceivables = pendingDues
    .filter((d) => d.direction === 'you_will_get')
    .reduce((s, d) => s + Number(d.amount), 0);
  const totalPayables = pendingDues
    .filter((d) => d.direction === 'you_will_give')
    .reduce((s, d) => s + Number(d.amount), 0);
  const netPending = totalReceivables - totalPayables;

  // Filtered List
  const filteredDues = pendingDues.filter((due) => {
    const cust = customers.find((c) => c.id === due.customer_id);

    // Tab filter
    if (filterTab === 'customer' && cust?.type !== 'customer') return false;
    if (filterTab === 'supplier' && cust?.type !== 'supplier') return false;
    if (filterTab === 'overdue') {
      const isOverdue = new Date(due.due_date).getTime() < nowTime;
      if (!isOverdue) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cust?.name.toLowerCase().includes(q);
      const matchPhone = cust?.phone?.toLowerCase().includes(q);
      const matchNote = due.notes?.toLowerCase().includes(q);
      return matchName || matchPhone || matchNote;
    }

    return true;
  });

  const overdueCount = pendingDues.filter(
    (d) => new Date(d.due_date).getTime() < nowTime
  ).length;

  const customerDuesCount = pendingDues.filter((d) => {
    const cust = customers.find((c) => c.id === d.customer_id);
    return cust?.type === 'customer';
  }).length;

  const supplierDuesCount = pendingDues.filter((d) => {
    const cust = customers.find((c) => c.id === d.customer_id);
    return cust?.type === 'supplier';
  }).length;

  // Color generator for customer initials avatar
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-teal-400 to-emerald-600',
      'from-purple-500 to-pink-500',
      'from-amber-400 to-orange-500',
      'from-rose-500 to-red-600',
      'from-cyan-400 to-blue-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Due Date Status Helper
  const getDueDeadlineStatus = (dueDateStr: string) => {
    const target = new Date(dueDateStr);
    const diffMs = target.getTime() - nowTime;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Overdue by ${Math.abs(diffDays)}d`,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
        isOverdue: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Due Today',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        isOverdue: false,
      };
    }
    if (diffDays === 1) {
      return {
        label: 'Due Tomorrow',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        isOverdue: false,
      };
    }
    return {
      label: `Due in ${diffDays}d`,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      isOverdue: false,
    };
  };

  const handleSendWhatsAppReminder = (e: React.MouseEvent, due: PeopleDue, cust: Customer) => {
    e.stopPropagation();
    setReminderModalData({ due, customer: cust });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
              <Users className="w-5 h-5" />
            </div>
            <span>Dues & Udhar Book</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track receivables (You Will Get), payables (You Will Give), and dispatch 1-tap WhatsApp reminders.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
          {/* Search Bar: Full width on mobile */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts, parties, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 min-h-[44px]"
            />
          </div>

          {/* Action Buttons: Full mobile width dual buttons */}
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={() => {
                if (customers.length > 0) setSelectedCustId(customers[0].id);
                setShowAddDueModal(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-3.5 sm:py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-white text-xs shadow-md shadow-cyan-500/25 active:scale-[0.98] transition-all min-h-[48px] sm:min-h-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="truncate">+ Record Due (Udhar)</span>
            </button>

            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3.5 sm:py-2.5 px-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all min-h-[48px] sm:min-h-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="truncate">+ Add Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4-Pill Sphere Lens Switcher */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 w-full">
        <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xs">
          <button
            onClick={() => setSelectedScope('all')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'all'
                ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">All</span>
          </button>
          <button
            onClick={() => setSelectedScope('business')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'business'
                ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300 shrink-0" />
            <span className="truncate">Biz</span>
          </button>
          <button
            onClick={() => setSelectedScope('personal')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'personal'
                ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300 shrink-0" />
            <span className="truncate">Personal</span>
          </button>
          <button
            onClick={() => setSelectedScope('family')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'family'
                ? 'bg-white dark:bg-amber-600 text-amber-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300 shrink-0" />
            <span className="truncate">Family</span>
          </button>
        </div>
      </div>

      {/* Dual Summary Banners (Receivables vs Payables) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Receivables Banner */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border border-emerald-500/25 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Total You Will Get (Receivables)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 tabular-nums">
            +{formatPaise(totalReceivables)}
          </div>
          <span className="text-xs text-slate-300 mt-1 inline-block">
            Expected from credit customers & clients
          </span>
        </div>

        {/* Payables Banner */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-rose-950 via-slate-900 to-red-950 text-white border border-rose-500/25 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Total You Will Give (Payables)
            </span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-400 tabular-nums">
            -{formatPaise(totalPayables)}
          </div>
          <span className="text-xs text-slate-300 mt-1 inline-block">
            Pending payments to suppliers & vendors
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          All Records ({pendingDues.length})
        </button>

        <button
          onClick={() => setFilterTab('customer')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            filterTab === 'customer'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Customers ({customerDuesCount})</span>
        </button>

        <button
          onClick={() => setFilterTab('supplier')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            filterTab === 'supplier'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Suppliers ({supplierDuesCount})</span>
        </button>

        <button
          onClick={() => setFilterTab('overdue')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            filterTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>🔴 Overdue ({overdueCount})</span>
        </button>
      </div>

      {/* Dues List */}
      <div
        className={`rounded-3xl border p-5 sm:p-6 transition-all ${
          isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Active Due Records ({filteredDues.length})
            </h3>
            <span className="text-xs font-bold text-slate-400 hidden sm:inline">
              • {customers.length} total contacts
            </span>
          </div>

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {filteredDues.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6 opacity-60" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {searchQuery ? 'No dues matched your search.' : 'No pending dues in this view.'}
            </p>
            <p className="text-[11px] text-slate-400">
              Click &quot;Record Due (Udhar)&quot; above to track customer credit or supplier bills.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {filteredDues.map((due) => {
              const cust = customers.find((c) => c.id === due.customer_id);
              const isGet = due.direction === 'you_will_get';
              const nameInitial = (cust?.name || 'C').charAt(0).toUpperCase();
              const deadline = getDueDeadlineStatus(due.due_date);

              return (
                <div
                  key={due.id}
                  onClick={() => cust && setSelectedCustForDetail(cust)}
                  className={`p-4 rounded-3xl border transition-all hover-lift cursor-pointer flex flex-col justify-between gap-3 ${
                    isLight
                      ? 'bg-slate-50/60 border-slate-200 hover:border-slate-300 shadow-xs'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                            cust?.name || 'Customer'
                          )} flex items-center justify-center text-white font-black text-sm shadow-md shrink-0`}
                        >
                          {nameInitial}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {cust?.name || 'Contact'}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                              {cust?.type === 'supplier' ? 'Supplier' : 'Customer'}
                            </span>
                            {cust?.phone && (
                              <span className="text-[10px] text-slate-400 font-medium truncate">
                                {cust.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                          due.scope === 'personal'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : due.scope === 'family'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {due.scope ? (due.scope === 'business' ? '🏢 Biz' : due.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          {isGet ? 'You Will Receive' : 'You Need To Pay'}
                        </span>
                        <div
                          className={`text-xl font-black tabular-nums ${
                            isGet ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isGet ? '+' : '-'}
                          {formatPaise(due.amount)}
                        </div>
                      </div>
                      <span className={`font-bold px-2 py-0.5 rounded-md border text-[10px] ${deadline.color}`}>
                        {deadline.label}
                      </span>
                    </div>

                    {due.notes && (
                      <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate font-medium">
                          <strong className="text-amber-700 dark:text-amber-300">Remark:</strong> {due.notes}
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-slate-400">Statement</span>
                    <div className="flex items-center gap-1.5">
                      {cust && (
                        <button
                          onClick={(e) => handleSendWhatsAppReminder(e, due, cust)}
                          title="Send WhatsApp Reminder"
                          className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                      {cust && (
                        <button
                          onClick={() => setDueToSettle({ due, customer: cust })}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="divide-y divide-slate-100 dark:divide-white/5 space-y-1">
            {filteredDues.map((due) => {
              const cust = customers.find((c) => c.id === due.customer_id);
              const isGet = due.direction === 'you_will_get';
              const nameInitial = (cust?.name || 'C').charAt(0).toUpperCase();
              const deadline = getDueDeadlineStatus(due.due_date);

              return (
                <div
                  key={due.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-white/5 px-2 rounded-2xl transition-colors"
                >
                  <div
                    onClick={() => cust && setSelectedCustForDetail(cust)}
                    className="flex items-center gap-3 cursor-pointer group"
                    title="Click to view full contact statement"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                        cust?.name || 'Customer'
                      )} flex items-center justify-center text-white font-black text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      {nameInitial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {cust?.name || 'Contact'}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                          {cust?.type === 'supplier' ? 'Supplier' : 'Customer'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        {cust?.phone && (
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            📞 {cust.phone}
                          </span>
                        )}
                        {due.notes && (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-[10px]">
                            <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{due.notes}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span
                          className={`font-bold px-2 py-0.2 rounded-md border text-[10px] ${deadline.color}`}
                        >
                          {deadline.label}
                        </span>
                        <span>•</span>
                        <span
                          className={`font-black px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider ${
                            due.scope === 'personal'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : due.scope === 'family'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {due.scope ? (due.scope === 'business' ? '🏢 Biz' : due.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5">
                    <div className="text-left sm:text-right">
                      <div
                        className={`font-black text-base tabular-nums ${
                          isGet
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isGet ? '+' : '-'}
                        {formatPaise(due.amount)}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          isGet
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isGet ? 'You Will Get' : 'You Will Give'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* WhatsApp Reminder Button */}
                      {cust && (
                        <button
                          onClick={(e) => handleSendWhatsAppReminder(e, due, cust)}
                          title="Send WhatsApp Reminder"
                          className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-md shadow-emerald-500/25 transition-all hover-lift touch-press cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}

                      {/* Settle Due Button */}
                      {cust && (
                        <button
                          onClick={() => setDueToSettle({ due, customer: cust })}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/25 transition-all hover-lift touch-press cursor-pointer"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POPUP: Contact Detail Statement */}
      <ContactDetailModal
        customer={selectedCustForDetail}
        onClose={() => setSelectedCustForDetail(null)}
        onRecordDue={() => {
          if (selectedCustForDetail) setSelectedCustId(selectedCustForDetail.id);
          setShowAddDueModal(true);
        }}
        onSettleDue={(due, cust) => setDueToSettle({ due, customer: cust })}
        onEditContact={(cust) => handleOpenEditCustomer(cust)}
        onDeleteContact={(id) => handleDeleteCustomer(id)}
      />

      {/* MODAL: Settle Due (Full or Partial Settlement) */}
      <SettleDueModal
        isOpen={dueToSettle !== null}
        due={dueToSettle?.due || null}
        customer={dueToSettle?.customer || null}
        onClose={() => setDueToSettle(null)}
      />

      {/* MODAL: New Contact */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <span>Add Contact / Customer</span>
              </h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Contact Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustType('customer')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      custType === 'customer'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    👥 Customer (You Will Get)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustType('supplier')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      custType === 'supplier'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🏭 Supplier (You Will Give)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar, Om Enterprises"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mobile / WhatsApp Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210 (10 digits)"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop #4, Gandhi Market"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/25"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Contact */}
      {custToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                <span>Edit Contact Details</span>
              </h3>
              <button
                onClick={() => setCustToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Contact Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCustType('customer')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      editCustType === 'customer'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    👥 Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCustType('supplier')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      editCustType === 'supplier'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🏭 Supplier
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Full Name / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editCustPhone}
                  onChange={(e) => setEditCustPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Address / City
                </label>
                <input
                  type="text"
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setCustToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs shadow-md shadow-indigo-500/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Due (Udhar) */}
      {showAddDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-500" />
                <span>Record Due / Credit Entry</span>
              </h3>
              <button
                onClick={() => setShowAddDueModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDue} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Sphere Selector: Business / Personal / Family */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Entity Sphere (Financial Lens)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'business', label: '🏢 Business' },
                    { id: 'personal', label: '👤 Personal' },
                    { id: 'family', label: '👨‍👩‍👧‍👦 Family' },
                  ].map((s) => {
                    const isSelected = dueScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setDueScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-cyan-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direction Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Due Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_get')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      dueDirection === 'you_will_get'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🟢 You Will Get (+ Receivables)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDirection('you_will_give')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      dueDirection === 'you_will_give'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    🔴 You Will Give (− Payables)
                  </button>
                </div>
              </div>

              {/* Select Contact */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Contact Person
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddDueModal(false);
                      setShowAddCustomerModal(true);
                    }}
                    className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    + New Contact
                  </button>
                </div>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} {c.phone ? `(${c.phone})` : ''} —{' '}
                      {c.type === 'supplier' ? 'Supplier' : 'Customer'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Due Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={dueAmountRupees}
                    onChange={(e) => setDueAmountRupees(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xl font-black text-slate-900 dark:text-white tabular-nums"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-1.5 pt-1.5">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(dueAmountRupees) || 0;
                        setDueAmountRupees((cur + amt).toString());
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Due In (Deadline)
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: '3 Days', days: 3 },
                    { label: '7 Days', days: 7 },
                    { label: '15 Days', days: 15 },
                    { label: '30 Days', days: 30 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => {
                        setDueDays(p.days);
                        setCustomDueDate('');
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                        dueDays === p.days && !customDueDate
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="date"
                  value={customDueDate}
                  onChange={(e) => setCustomDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Note / Bill Description */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Bill / Item Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #204, Silk sarees purchase, Advance"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2 shrink-0 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddDueModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!dueAmountRupees || parseFloat(dueAmountRupees) <= 0 || !selectedCustId}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/25 disabled:opacity-50"
                >
                  Save Due Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* WhatsApp Reminder & UPI Modal */}
      <WhatsAppReminderModal
        isOpen={!!reminderModalData}
        onClose={() => setReminderModalData(null)}
        due={reminderModalData?.due || null}
        customer={reminderModalData?.customer || null}
      />
    </div>
  );
}
