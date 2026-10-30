'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Calendar,
  X,
  Wifi,
  ArrowUpRight,
  CheckCircle2,
  TrendingDown,
  ShoppingBag,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Eye,
  Wallet,
  ChevronRight,
  Info,
  Sparkles,
  RefreshCw,
  ArrowRightLeft,
  Trash2,
  Sparkle,
  Edit3,
  Share2,
  Check,
  FileText,
  Globe,
  User,
  Users2,
  Building2,
} from 'lucide-react';
import { Card, LedgerEntry, EntityScope } from '@/types';
import { formatPaise, parseToPaise, paiseToRupees } from '@/lib/money';
import { useCardStore } from '@/stores/useCardStore';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { ViewToggle, ViewMode } from '@/components/common/ViewToggle';
import { SortDropdown, SortOption } from '@/components/common/SortDropdown';
import { CardMoveButtons } from '@/components/common/CardMoveButtons';
import { useCardOrder } from '@/lib/useCardOrder';
import { useAccountStore } from '@/stores/useAccountStore';
import { syncEngine } from '@/lib/syncEngine';
import { CardDetailModal } from '@/components/modals/CardDetailModal';
import { CardAdvisorModal } from '@/components/modals/CardAdvisorModal';
import { CardStatementImportModal } from '@/components/modals/CardStatementImportModal';
import {
  calculateCardBilling,
  calculateAllCardsBillingReport,
  CardBillingSummary,
} from '@/lib/cardBilling';

const CARD_NETWORKS = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'rupay', label: 'RuPay' },
  { id: 'amex', label: 'Amex' },
  { id: 'diners', label: 'Diners' },
];

const POPULAR_VARIANTS = [
  'Pinnacle World',
  'Regalia Gold',
  'Infinia',
  'Millennia',
  'Coral',
  'Sapphiro',
  'SimplyCLICK',
  'SimplySAVE',
  'Amazon Pay',
  'Flipkart',
  'Magnus',
  'OneCard',
  'Platinum',
  'Signature',
];

export function CardsScreen() {
  const rawCards = useCardStore((s) => s.cards);
  // Strictly deduplicate cards by ID to prevent any double entry
  const cards = Array.from(new Map(rawCards.map((c) => [c.id, c])).values());

  const { entries: ledger } = useLedgerStore();
  const { accounts, updateAccountBalance } = useAccountStore();
  const { activeWorkspaceId, theme, user } = useSessionStore();
  const isLight = theme === 'light';

  // Active view: 'cards' or 'report'
  const [selectedScope, setSelectedScope] = useState<'all' | EntityScope>('all');
  const [activeTab, setActiveTab] = useState<'cards' | 'report'>('cards');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rb_view_cards') as ViewMode) || 'grid';
    }
    return 'grid';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_view_cards', mode);
    }
  };

  const CARD_SORT_OPTIONS: SortOption[] = [
    { value: 'custom', label: 'Custom Order (Arrange)', shortLabel: 'Arrange' },
    { value: 'bill_date_asc', label: 'Bill / Due Date (Soonest)', shortLabel: 'Due Date' },
    { value: 'bill_date_desc', label: 'Bill / Due Date (Farthest)', shortLabel: 'Due (Far)' },
    { value: 'name_asc', label: 'Card Name (A to Z)', shortLabel: 'A-Z' },
    { value: 'name_desc', label: 'Card Name (Z to A)', shortLabel: 'Z-A' },
    { value: 'due_desc', label: 'Billed Due (Highest)', shortLabel: 'High Due' },
    { value: 'due_asc', label: 'Billed Due (Lowest)', shortLabel: 'Low Due' },
    { value: 'limit_desc', label: 'Credit Limit (Highest)', shortLabel: 'High Limit' },
  ];

  const [cardSort, setCardSortState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rb_sort_cards') || 'bill_date_asc';
    }
    return 'bill_date_asc';
  });

  const setCardSort = (sort: string) => {
    setCardSortState(sort);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb_sort_cards', sort);
    }
  };

  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);

  // Modals for AI Advisor & Bulk Statement Import
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [showImportStatementModal, setShowImportStatementModal] = useState(false);

  // Card to delete state
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);

  // Card filter: 'all' | 'due' | 'safe'
  const [cardFilter, setCardFilter] = useState<'all' | 'due' | 'safe'>('all');

  // Edit Card State
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [editCardScope, setEditCardScope] = useState<EntityScope>('business');
  const [editCardName, setEditCardName] = useState('');
  const [editCardBank, setEditCardBank] = useState('');
  const [editCardVariant, setEditCardVariant] = useState('');
  const [editCardNetwork, setEditCardNetwork] = useState('visa');
  const [editLast4, setEditLast4] = useState('');
  const [editLimitRupees, setEditLimitRupees] = useState('');
  const [editStatementDay, setEditStatementDay] = useState('15');
  const [editDueDay, setEditDueDay] = useState('5');
  const [editBilledRupees, setEditBilledRupees] = useState('');
  const [editUnbilledRupees, setEditUnbilledRupees] = useState('');
  const [originalBilledRupees, setOriginalBilledRupees] = useState('');
  const [originalUnbilledRupees, setOriginalUnbilledRupees] = useState('');
  const [editCardNotes, setEditCardNotes] = useState('');
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);

  // Scoped Cards
  const scopedCards = cards.filter(
    (c) => selectedScope === 'all' || (c.scope || 'business') === selectedScope
  );

  // Billing Report calculation across all deduplicated scoped cards
  const billingReport = calculateAllCardsBillingReport(scopedCards, ledger);

  const { moveItem, applyCustomOrder, isCustomOrder, getCardDragProps } = useCardOrder<Card>(
    'cards',
    scopedCards,
    cardSort,
    setCardSort
  );

  // Sorted and filtered card summaries for Grid and List views
  const sortedCardSummaries = React.useMemo(() => {
    const filtered = billingReport.cardSummaries.filter((summary) => {
      if (cardFilter === 'due') return summary.billedDue > 0;
      if (cardFilter === 'safe') return summary.billedDue <= 0;
      return true;
    });

    if (cardSort === 'custom') {
      const cardList = filtered.map((s) => s.card);
      const orderedCards = applyCustomOrder(cardList);
      const summaryByCardId = new Map(filtered.map((s) => [s.card.id, s]));
      return orderedCards
        .map((c) => summaryByCardId.get(c.id))
        .filter((s): s is CardBillingSummary => Boolean(s));
    }

    return [...filtered].sort((a, b) => {
      if (cardSort === 'name_asc') {
        return a.card.name.localeCompare(b.card.name);
      }
      if (cardSort === 'name_desc') {
        return b.card.name.localeCompare(a.card.name);
      }
      if (cardSort === 'bill_date_asc') {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      if (cardSort === 'bill_date_desc') {
        return b.dueDate.getTime() - a.dueDate.getTime();
      }
      if (cardSort === 'due_desc') {
        return b.billedDue - a.billedDue;
      }
      if (cardSort === 'due_asc') {
        return a.billedDue - b.billedDue;
      }
      if (cardSort === 'limit_desc') {
        return b.card.credit_limit - a.card.credit_limit;
      }
      return 0;
    });
  }, [billingReport.cardSummaries, cardFilter, cardSort, applyCustomOrder]);

  // New Card State
  const [showAddModal, setShowAddModal] = useState(false);
  const [cardScope, setCardScope] = useState<EntityScope>('business');
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardVariant, setCardVariant] = useState('');
  const [cardNetwork, setCardNetwork] = useState('visa');
  const [last4, setLast4] = useState('');
  const [limitRupees, setLimitRupees] = useState('');
  const [statementDay, setStatementDay] = useState('15');
  const [dueDay, setDueDay] = useState('5');
  const [initialBilledRupees, setInitialBilledRupees] = useState('');
  const [initialUnbilledRupees, setInitialUnbilledRupees] = useState('');
  const [cardNotes, setCardNotes] = useState('');

  // Spend State - Auto Cycle is DEFAULT as requested
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendCardId, setSpendCardId] = useState('');
  const [spendAmountRupees, setSpendAmountRupees] = useState('');
  const [spendCategory, setSpendCategory] = useState('Shopping');
  const [spendMerchant, setSpendMerchant] = useState('');
  const [spendDate, setSpendDate] = useState(new Date().toISOString().slice(0, 10));
  const [spendBillingOption, setSpendBillingOption] = useState<'auto' | 'billed' | 'unbilled'>('auto');

  // Bill Payment State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [payCardId, setPayCardId] = useState('');
  const [payOption, setPayOption] = useState<'billed' | 'total' | 'custom'>('billed');
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payNote, setPayNote] = useState('');

  // Luxury Card Gradients (High-end metallic obsidian, ruby, sapphire, emerald)
  const cardThemes = [
    {
      bg: 'from-slate-900 via-indigo-950 to-blue-950 border-indigo-500/30 shadow-indigo-950/50',
      accent: 'text-indigo-400',
      chip: 'from-amber-200 via-amber-400 to-amber-600',
    },
    {
      bg: 'from-zinc-900 via-purple-950 to-slate-950 border-purple-500/30 shadow-purple-950/50',
      accent: 'text-purple-400',
      chip: 'from-amber-200 via-amber-400 to-amber-600',
    },
    {
      bg: 'from-stone-900 via-rose-950 to-red-950 border-rose-500/30 shadow-rose-950/50',
      accent: 'text-rose-400',
      chip: 'from-amber-200 via-amber-400 to-amber-600',
    },
    {
      bg: 'from-slate-900 via-emerald-950 to-teal-950 border-emerald-500/30 shadow-emerald-950/50',
      accent: 'text-emerald-400',
      chip: 'from-amber-200 via-amber-400 to-amber-600',
    },
    {
      bg: 'from-neutral-900 via-amber-950 to-slate-950 border-amber-500/30 shadow-amber-950/50',
      accent: 'text-amber-400',
      chip: 'from-amber-200 via-amber-400 to-amber-600',
    },
  ];

  // Helper when opening Pay Bill modal for a specific card
  const openPayModalForCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const summary = calculateCardBilling(card, ledger);
    setPayCardId(cardId);

    // If there is billed due, default to billed amount; otherwise total outstanding
    if (summary.billedDue > 0) {
      setPayOption('billed');
      setPayAmountRupees(paiseToRupees(summary.billedDue).toString());
    } else if (summary.netUnbilled > 0) {
      setPayOption('total');
      setPayAmountRupees(paiseToRupees(summary.netUnbilled).toString());
    } else {
      setPayOption('custom');
      setPayAmountRupees('');
    }

    if (accounts.length > 0 && !payAccountId) {
      setPayAccountId(accounts[0].id);
    }
    setShowPayBillModal(true);
  };

  const handleOpenEditCard = (card: Card) => {
    setCardToEdit(card);
    setEditCardName(card.name);
    setEditCardScope(card.scope || 'business');
    setEditCardBank(card.bank);
    setEditCardVariant(card.variant || '');
    setEditCardNetwork(card.network || 'visa');
    setEditLast4(card.last4);
    setEditLimitRupees(paiseToRupees(card.credit_limit).toString());
    setEditStatementDay((card.statement_day || 15).toString());
    setEditDueDay((card.due_day || 5).toString());
    setEditCardNotes(card.notes || '');

    // Calculate live billed due and unbilled spends
    const summary = calculateCardBilling(card, ledger);
    const billedVal = summary.billedDue > 0 ? (summary.billedDue / 100).toString() : '0';
    const unbilledVal = summary.netUnbilled > 0 ? (summary.netUnbilled / 100).toString() : '0';
    setEditBilledRupees(billedVal);
    setEditUnbilledRupees(unbilledVal);
    setOriginalBilledRupees(billedVal);
    setOriginalUnbilledRupees(unbilledVal);
  };

  const handleSaveEditCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardToEdit || !editCardName.trim() || editLast4.length !== 4) return;

    syncEngine.updateCard(cardToEdit.id, {
      name: editCardName.trim(),
      bank: editCardBank.trim() || 'Bank',
      variant: editCardVariant.trim() || undefined,
      network: editCardNetwork || 'visa',
      last4: editLast4.trim(),
      scope: editCardScope,
      credit_limit: parseToPaise(editLimitRupees),
      statement_day: parseInt(editStatementDay, 10) || 15,
      due_day: parseInt(editDueDay, 10) || 5,
      notes: editCardNotes.trim() || null,
    });

    // Reconcile Billed Statement Due if changed
    const newBilledPaise = parseToPaise(editBilledRupees || '0');
    const origBilledPaise = parseToPaise(originalBilledRupees || '0');
    if (newBilledPaise !== origBilledPaise) {
      const diff = newBilledPaise - origBilledPaise;
      if (diff > 0) {
        syncEngine.pushLedgerEntry({
          id: crypto.randomUUID(),
          workspace_id: activeWorkspaceId,
          type: 'card_spend',
          amount: diff,
          card_id: cardToEdit.id,
          mode: 'card',
          is_billed: true,
          note: 'Statement Billed Due Adjustment (+)',
          entry_date: new Date().toISOString(),
          created_by: user?.id || 'owner',
        });
      } else {
        syncEngine.pushLedgerEntry({
          id: crypto.randomUUID(),
          workspace_id: activeWorkspaceId,
          type: 'bill_payment',
          amount: Math.abs(diff),
          card_id: cardToEdit.id,
          scope: editCardScope,
          mode: 'card',
          note: 'Statement Billed Due Adjustment (-)',
          entry_date: new Date().toISOString(),
          created_by: user?.id || 'owner',
        });
      }
    }

    // Reconcile Unbilled Spends if changed
    const newUnbilledPaise = parseToPaise(editUnbilledRupees || '0');
    const origUnbilledPaise = parseToPaise(originalUnbilledRupees || '0');
    if (newUnbilledPaise !== origUnbilledPaise) {
      const diff = newUnbilledPaise - origUnbilledPaise;
      if (diff > 0) {
        syncEngine.pushLedgerEntry({
          id: crypto.randomUUID(),
          workspace_id: activeWorkspaceId,
          type: 'card_spend',
          amount: diff,
          card_id: cardToEdit.id,
          mode: 'card',
          is_billed: false,
          note: 'Unbilled Spends Adjustment (+)',
          entry_date: new Date().toISOString(),
          created_by: user?.id || 'owner',
        });
      } else {
        syncEngine.pushLedgerEntry({
          id: crypto.randomUUID(),
          workspace_id: activeWorkspaceId,
          type: 'bill_payment',
          amount: Math.abs(diff),
          card_id: cardToEdit.id,
          scope: editCardScope,
          mode: 'card',
          note: 'Unbilled Spends Adjustment (-)',
          entry_date: new Date().toISOString(),
          created_by: user?.id || 'owner',
        });
      }
    }

    if (selectedCardForDetail && selectedCardForDetail.id === cardToEdit.id) {
      setSelectedCardForDetail((prev) =>
        prev
          ? {
              ...prev,
              name: editCardName.trim(),
              bank: editCardBank.trim() || 'Bank',
              variant: editCardVariant.trim() || undefined,
              network: editCardNetwork || 'visa',
              last4: editLast4.trim(),
              scope: editCardScope,
              credit_limit: parseToPaise(editLimitRupees),
              statement_day: parseInt(editStatementDay, 10) || 15,
              due_day: parseInt(editDueDay, 10) || 5,
              notes: editCardNotes.trim() || null,
            }
          : null
      );
    }

    setCardToEdit(null);
  };

  const handleShareCardReminder = (card: Card, summary: CardBillingSummary) => {
    const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const text = `💳 *Credit Card Bill Reminder*\n*Card:* ${card.name} (${card.bank} •••• ${card.last4})\n*🔴 Billed Due:* ${formatPaise(summary.billedDue)}\n*⏰ Due Date:* ${formattedDueDate} (${summary.reminderMessage})\n*🟣 Unbilled Spends:* ${formatPaise(summary.netUnbilled)}\n*🟢 Available Limit:* ${formatPaise(summary.availableCredit)} / ${formatPaise(card.credit_limit)}${card.notes ? `\n*📝 Remark:* ${card.notes}` : ''}\n\n_Tracked in Record Book_`;
    if (navigator.share) {
      navigator.share({ title: `${card.name} Payment Reminder`, text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    setCopiedReminderId(card.id);
    setTimeout(() => setCopiedReminderId(null), 2000);
  };

  const handleShareAllDuesWhatsApp = () => {
    const dueCards = billingReport.cardSummaries.filter((s) => s.billedDue > 0);
    if (dueCards.length === 0) return;

    let text = `💳 *Credit Card Bill Due Digest*\n*Total Billed Due:* ${formatPaise(billingReport.totalBilledDue)}\n*Cards Requiring Payment (${dueCards.length}):*\n`;
    dueCards.forEach((s, idx) => {
      const dueDate = s.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      text += `\n${idx + 1}. *${s.card.name}* (${s.card.bank} •••• ${s.card.last4})\n   🔴 Billed Due: ${formatPaise(s.billedDue)}\n   ⏰ Due Date: ${dueDate} (${s.reminderMessage})\n`;
    });
    text += `\n_Tracked via Record Book Financial Hub_`;

    if (navigator.share) {
      navigator.share({ title: 'Credit Card Bill Due Digest', text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || last4.length !== 4) return;

    const newCard: Card = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      name: cardName.trim(),
      bank: cardBank.trim() || 'Bank',
      variant: cardVariant.trim() || undefined,
      network: cardNetwork || 'visa',
      last4: last4.trim(),
      scope: cardScope,
      credit_limit: parseToPaise(limitRupees),
      statement_day: parseInt(statementDay, 10) || 15,
      due_day: parseInt(dueDay, 10) || 5,
      is_active: true,
      notes: cardNotes.trim() || undefined,
    };

    syncEngine.pushCard(newCard);

    // 1. Initial Billed Statement Due
    if (initialBilledRupees && parseToPaise(initialBilledRupees) > 0) {
      const billedEntry: LedgerEntry = {
        id: crypto.randomUUID(),
        workspace_id: activeWorkspaceId,
        type: 'card_spend',
        amount: parseToPaise(initialBilledRupees),
        card_id: newCard.id,
        mode: 'card',
        is_billed: true,
        note: 'Statement Bill Opening Due',
        entry_date: new Date().toISOString(),
        created_by: user?.id || 'owner',
      };
      syncEngine.pushLedgerEntry(billedEntry);
    }

    // 2. Initial Unbilled Spends
    if (initialUnbilledRupees && parseToPaise(initialUnbilledRupees) > 0) {
      const unbilledEntry: LedgerEntry = {
        id: crypto.randomUUID(),
        workspace_id: activeWorkspaceId,
        type: 'card_spend',
        amount: parseToPaise(initialUnbilledRupees),
        card_id: newCard.id,
        mode: 'card',
        is_billed: false,
        note: 'Unbilled Spends Opening Balance',
        entry_date: new Date().toISOString(),
        created_by: user?.id || 'owner',
      };
      syncEngine.pushLedgerEntry(unbilledEntry);
    }

    setShowAddModal(false);
    setCardName('');
    setCardBank('');
    setCardVariant('');
    setCardNetwork('visa');
    setLast4('');
    setLimitRupees('');
    setStatementDay('15');
    setDueDay('5');
    setInitialBilledRupees('');
    setInitialUnbilledRupees('');
    setCardNotes('');
  };

  const handleRecordSpend = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(spendAmountRupees);
    if (paise <= 0 || !spendCardId) return;

    const selectedCard = cards.find((c) => c.id === spendCardId);

    // Determine billing classification
    const isBilledOverride =
      spendBillingOption === 'billed' ? true : spendBillingOption === 'unbilled' ? false : undefined;

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'card_spend',
      amount: paise,
      card_id: spendCardId,
      mode: 'card',
      is_billed: isBilledOverride,
      note: `${spendCategory} - ${spendMerchant.trim() || selectedCard?.name || 'Card Swipe'}`,
      entry_date: new Date(spendDate + 'T12:00:00Z').toISOString(),
      created_by: user?.id || 'owner',
    };

    syncEngine.pushLedgerEntry(entry);
    setShowSpendModal(false);
    setSpendAmountRupees('');
    setSpendMerchant('');
    setSpendBillingOption('auto'); // Reset to Auto Cycle by default
  };

  const handlePayBill = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseToPaise(payAmountRupees);
    if (paise <= 0 || !payCardId) return;

    const selectedCard = cards.find((c) => c.id === payCardId);
    const summary = selectedCard ? calculateCardBilling(selectedCard, ledger) : null;

    let paymentLabel = 'Bill Payment';
    if (summary && paise > summary.billedDue) {
      paymentLabel = summary.billedDue > 0 ? 'Bill & Advance Payment' : 'Card Payment / Advance';
    }

    const selectedAccount = accounts.find((a) => a.id === payAccountId);

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      workspace_id: activeWorkspaceId,
      type: 'bill_payment',
      amount: paise,
      card_id: payCardId,
      cash_location_id: selectedAccount?.id,
      scope: selectedCard?.scope || 'business',
      mode: selectedAccount ? 'bank' : 'cash',
      note: `${paymentLabel} - ${selectedCard?.name || 'Card'} (${payNote.trim() || selectedAccount?.name || 'Direct Bank Settlement'})`,
      entry_date: new Date().toISOString(),
      created_by: user?.id || 'owner',
    };

    syncEngine.pushLedgerEntry(entry);
    setShowPayBillModal(false);
    setPayAmountRupees('');
    setPayNote('');
  };

  const confirmDeleteCard = () => {
    if (!cardToDelete) return;
    syncEngine.deleteCard(cardToDelete.id);
    if (selectedCardForDetail && selectedCardForDetail.id === cardToDelete.id) {
      setSelectedCardForDetail(null);
    }
    setCardToDelete(null);
  };

  return (
    <div className="space-y-6 pt-2 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Credit Cards & Billed System
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track Billed Statement dues, unbilled current spends, advance payments & due reminders.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Primary Action Button: Full width on mobile */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 sm:py-2.5 px-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 font-bold text-white text-xs shadow-md shadow-purple-500/25 active:scale-[0.98] transition-all min-h-[48px] sm:min-h-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add Credit Card</span>
          </button>

          {/* Quick Tools Row: 50/50 Dual Split on Mobile */}
          {cards.length > 0 && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSpendCardId(cards[0].id);
                  setSpendBillingOption('auto');
                  setShowSpendModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl bg-rose-500 hover:bg-rose-600 font-bold text-white text-xs shadow-sm shadow-rose-500/25 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                <span className="truncate">Swipe (Spend)</span>
              </button>

              <button
                onClick={() => openPayModalForCard(cards[0].id)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-bold text-white text-xs shadow-sm shadow-emerald-500/25 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="truncate">Pay Bill</span>
              </button>

              {/* AI Best Card Swipe Advisor */}
              <button
                onClick={() => setShowAdvisorModal(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
                title="AI Card Rewards & Best Swipe Advisor"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="truncate">Advisor</span>
              </button>

              {/* Import Statement */}
              <button
                onClick={() => setShowImportStatementModal(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-3 sm:py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-white/10 active:scale-[0.98] transition-all min-h-[44px] sm:min-h-0 cursor-pointer"
                title="Bulk Import Statement CSV/Text"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="truncate">Import</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4-Pill Sphere Lens Switcher */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 w-full">
        <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xs">
          <button
            onClick={() => setSelectedScope('all')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedScope === 'all'
                ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
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

        {activeTab === 'cards' && (
          <div className="flex items-center gap-2">
            <SortDropdown
              value={cardSort}
              onChange={setCardSort}
              options={CARD_SORT_OPTIONS}
            />
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        )}
      </div>

      {/* Urgent Dues & WhatsApp Alert Broadcast Banner */}
      {billingReport.totalBilledDue > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/15 via-purple-500/10 to-amber-500/15 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Statement Bills Due: {formatPaise(billingReport.totalBilledDue)}</span>
                {billingReport.urgentCardsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white animate-pulse">
                    {billingReport.urgentCardsCount} Urgent
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {billingReport.cardSummaries
                  .filter((s) => s.billedDue > 0)
                  .map((s) => `${s.card.name} (${formatPaise(s.billedDue)})`)
                  .join(' • ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShareAllDuesWhatsApp}
              className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
              title="Share due bills digest via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp Digest</span>
            </button>

            <button
              onClick={() => {
                const firstDue = billingReport.cardSummaries.find((s) => s.billedDue > 0);
                if (firstDue) openPayModalForCard(firstDue.card.id);
              }}
              className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pay Now</span>
            </button>
          </div>
        </div>
      )}

      {/* 3 Core Metric KPI Cards: Billed Due vs Unbilled Spends vs Advance / Available */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Billed Statement Due */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            billingReport.totalBilledDue > 0
              ? 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/30'
              : isLight
              ? 'bg-white border-slate-200'
              : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Billed Statement Due
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
              Pay by Due Date
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalBilledDue)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-rose-500/10">
            <span>
              {billingReport.urgentCardsCount > 0
                ? `🚨 ${billingReport.urgentCardsCount} card(s) require payment`
                : billingReport.totalBilledDue > 0
                ? 'Statement generated'
                : '✅ All statement bills paid'}
            </span>
            {billingReport.totalBilledDue > 0 && (
              <button
                onClick={() => {
                  const firstDueCard = billingReport.cardSummaries.find((s) => s.billedDue > 0);
                  if (firstDueCard) openPayModalForCard(firstDueCard.card.id);
                }}
                className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
              >
                Pay Now &gt;
              </button>
            )}
          </div>
        </div>

        {/* KPI 2: Unbilled Spends */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Unbilled Spends
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300">
              Future Cycle
            </span>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalUnbilledSpends)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
            Spends made after bill date. Will generate on next statement cycle.
          </p>
        </div>

        {/* KPI 3: Advance Payments & Available Limit */}
        <div
          className={`p-5 rounded-3xl border transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Available Credit Limit
            </span>
            {billingReport.totalAdvancePayments > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                +{formatPaise(billingReport.totalAdvancePayments)} Advance
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {formatPaise(billingReport.totalAvailableCredit)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <span>Total Limit: {formatPaise(billingReport.totalCreditLimit)}</span>
            <span className="text-slate-400 font-mono">
              {billingReport.totalCreditLimit > 0
                ? `${Math.round(
                    (billingReport.totalOutstanding / billingReport.totalCreditLimit) * 100
                  )}% used`
                : '0% used'}
            </span>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs: Cards Grid vs Systematic Report */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'cards'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>My Cards ({cards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'report'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Billed & Unbilled Report</span>
            {billingReport.urgentCardsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline-block">
          {activeTab === 'cards'
            ? 'Interactive credit card view with live billing cycles'
            : 'Unified Billed vs Unbilled statement breakdown across all cards'}
        </span>
      </div>

      {/* TAB 1: LUXURY HIGH-END CREDIT CARDS GRID */}
      {activeTab === 'cards' && (
        <div className="space-y-4">
          {/* Quick Filter Pills */}
          {cards.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setCardFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  cardFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                All Cards ({billingReport.cardSummaries.length})
              </button>
              <button
                onClick={() => setCardFilter('due')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  cardFilter === 'due'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Bills Due ({billingReport.cardSummaries.filter((s) => s.billedDue > 0).length})
              </button>
              <button
                onClick={() => setCardFilter('safe')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  cardFilter === 'safe'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                No Bill Due ({billingReport.cardSummaries.filter((s) => s.billedDue <= 0).length})
              </button>
            </div>
          )}

          {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.length === 0 ? (
            <div className="col-span-full text-center py-16 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-xs text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto shadow-inner">
                <CreditCard className="w-7 h-7" />
              </div>
              <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                No credit cards added yet.
              </p>
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Click &quot;Add Card&quot; to manage billing cycles, statement cutoff dates, and bill payments.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/25"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Card</span>
              </button>
            </div>
          ) : (
            sortedCardSummaries.map((summary, idx) => {
              const card = summary.card;
              const theme = cardThemes[idx % cardThemes.length];
              const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              });

              // Status badges & colors
              let badgeColor = 'bg-slate-800/80 text-slate-300 border border-slate-700/50';
              let badgeText = `Bill: ${summary.statementDay}th • Due: ${formattedDueDate}`;

              if (summary.status === 'overdue') {
                badgeColor = 'bg-rose-600 text-white shadow-md shadow-rose-600/50 animate-pulse border border-rose-400/50';
                badgeText = `⚠️ Overdue ${Math.abs(summary.daysUntilDue)}d (${formattedDueDate})`;
              } else if (summary.status === 'urgent') {
                badgeColor = 'bg-amber-400 text-slate-900 font-black shadow-md border border-amber-300';
                badgeText = `🚨 Due in ${summary.daysUntilDue}d (${formattedDueDate})`;
              } else if (summary.status === 'due') {
                badgeColor = 'bg-rose-500/20 text-rose-200 border border-rose-400/30';
                badgeText = `📅 Due ${formattedDueDate} (${summary.daysUntilDue}d)`;
              } else if (summary.status === 'unbilled_only') {
                badgeColor = 'bg-purple-500/25 text-purple-200 border border-purple-400/30';
                badgeText = `🗓️ Next Bill: ${summary.nextStatementDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}`;
              } else if (summary.status === 'advance_credit') {
                badgeColor = 'bg-emerald-500 text-white font-black shadow-md';
                badgeText = `🟢 Advance: ${formatPaise(summary.advanceCredit)}`;
              } else {
                badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
                badgeText = `✅ Cleared`;
              }

              const utilization = Math.min(
                100,
                Math.round((summary.totalOutstanding / card.credit_limit) * 100)
              ) || 0;

              const drag = getCardDragProps(card.id);
              return (
                <div
                  key={card.id}
                  draggable={drag.draggable}
                  onDragStart={drag.onDragStart}
                  onDragOver={drag.onDragOver}
                  onDragLeave={drag.onDragLeave}
                  onDrop={drag.onDrop}
                  onDragEnd={drag.onDragEnd}
                  className={`group rounded-3xl p-6 bg-gradient-to-br ${theme.bg} border text-white shadow-2xl relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between min-h-[300px] ${drag.dragClasses}`}
                >
                  {/* Subtle Top Metallic Reflection Arc */}
                  <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none rounded-t-3xl" />

                  {/* Card Top: Bank Issuer, Variant Badge, Name, EMV Chip & Network */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold tracking-widest uppercase text-white/70 block">
                            {card.bank}
                          </span>
                          {card.variant && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white border border-white/25 shadow-xs">
                              {card.variant}
                            </span>
                          )}
                        </div>
                        <h3 className="font-black text-lg text-white tracking-tight mt-0.5">
                          {card.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {card.network && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 text-white/90 border border-white/20">
                            {card.network}
                          </span>
                        )}
                        <Wifi className="w-5 h-5 text-white/70 rotate-90" />
                        {/* Realistic Gold EMV Chip */}
                        <div
                          className={`w-10 h-7.5 rounded-lg bg-gradient-to-tr ${theme.chip} border border-amber-200/60 shadow-md relative overflow-hidden flex items-center justify-center`}
                        >
                          <div className="w-6 h-4 border border-amber-800/40 rounded-xs flex items-center justify-center">
                            <div className="w-3 h-2 border border-amber-800/30 rounded-2xs" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Embossed Card Number & Reminder Badge */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="font-mono text-sm tracking-widest font-semibold text-white/90 drop-shadow-sm flex items-center gap-2">
                        <span>•••• {card.last4}</span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                            card.scope === 'personal'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : card.scope === 'family'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {card.scope ? (card.scope === 'business' ? '🏢 Biz' : card.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Floating Glass Duo Pills (🔴 Billed Due vs 🟣 Unbilled Spends) */}
                  <div className="relative z-10 my-3 p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 space-y-2.5 shadow-inner">
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Billed Due Pill */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/25 to-rose-600/10 border border-rose-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-rose-300 font-extrabold uppercase tracking-wider block">
                            🔴 Billed Due
                          </span>
                        </div>
                        <span className="font-black text-base text-white tabular-nums block mt-0.5">
                          {formatPaise(summary.billedDue)}
                        </span>
                        <span className="text-[9px] text-rose-200/80 block font-medium">
                          {summary.billedDue > 0 ? `Due by ${formattedDueDate}` : 'No bill due'}
                        </span>
                      </div>

                      {/* Unbilled Spends Pill */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/25 to-indigo-600/10 border border-purple-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider block">
                            🟣 Unbilled
                          </span>
                        </div>
                        <span className="font-black text-base text-white tabular-nums block mt-0.5">
                          {formatPaise(summary.netUnbilled)}
                        </span>
                        <span className="text-[9px] text-purple-200/80 block font-medium">
                          Bills next cycle
                        </span>
                      </div>
                    </div>

                    {/* Utilization Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-white/70 font-semibold mb-1">
                        <span className="truncate">Limit: {formatPaise(card.credit_limit)}</span>
                        <span className="shrink-0 text-right">
                          Avail: <strong className="text-emerald-300">{formatPaise(summary.availableCredit)}</strong> ({utilization}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${utilization}%` }}
                          className={`h-full transition-all duration-500 ${
                            utilization > 50
                              ? 'bg-rose-400'
                              : utilization > 30
                              ? 'bg-amber-300'
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Remark Pill */}
                  {card.notes && (
                    <div className="relative z-10 mb-2 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-xs border border-white/15 text-xs text-amber-200/90 flex items-center gap-1.5 shadow-inner">
                      <FileText className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="font-semibold text-[11px] truncate">
                        <span className="text-amber-300 font-bold">Remark:</span> {card.notes}
                      </span>
                    </div>
                  )}

                  {/* Bottom Action Footer with Swipe, Pay, Detail, and Delete Button */}
                  <div className="relative z-10 pt-1 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSpendCardId(card.id);
                        setSpendBillingOption('auto'); // Auto by default
                        setShowSpendModal(true);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all touch-press"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Swipe</span>
                    </button>

                    <button
                      onClick={() => openPayModalForCard(card.id)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all touch-press ${
                        summary.billedDue > 0
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : summary.netUnbilled > 0
                          ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/30'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {summary.billedDue > 0
                          ? 'Pay Bill'
                          : summary.netUnbilled > 0
                          ? 'Pay Due'
                          : 'Advance Pay'}
                      </span>
                    </button>

                    {/* View Details Button */}
                    <button
                      onClick={() => setSelectedCardForDetail(card)}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all touch-press"
                      title="View Statement & History"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Share WhatsApp Reminder */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareCardReminder(card, summary);
                      }}
                      className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200 hover:text-white transition-all touch-press"
                      title="Share Bill Reminder via WhatsApp"
                    >
                      {copiedReminderId === card.id ? (
                        <Check className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </button>

                    <CardMoveButtons
                      onMoveUp={() => moveItem(card.id, 'up', sortedCardSummaries.map((s) => s.card))}
                      onMoveDown={() => moveItem(card.id, 'down', sortedCardSummaries.map((s) => s.card))}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < sortedCardSummaries.length - 1}
                      isLight={false}
                    />

                    {/* Edit Card Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditCard(card);
                      }}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-amber-500/30 text-white/70 hover:text-amber-200 transition-all touch-press"
                      title="Edit Card Details (Limit, Dates)"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Card Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardToDelete(card);
                      }}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white/70 hover:text-white transition-all touch-press"
                      title="Delete this Credit Card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* List View for Credit Cards */
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-xs divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
          {cards.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">No credit cards added yet.</div>
          ) : (
            sortedCardSummaries.map((summary, listIdx) => {
                const card = summary.card;
                const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardForDetail(card)}
                    className="p-4 sm:px-5 sm:py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    {/* Left: Card Name, Last4, Network, Badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                            {card.name}
                          </h3>
                          <span className="font-mono text-xs text-slate-400">•••• {card.last4}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                              card.scope === 'personal'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : card.scope === 'family'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {card.scope ? (card.scope === 'business' ? '🏢 Biz' : card.scope === 'personal' ? '👤 Pers' : '👨‍👩‍👧‍👦 Fam') : '🏢 Biz'}
                          </span>
                          {card.variant && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold border border-purple-500/20 shrink-0">
                              {card.variant}
                            </span>
                          )}
                          {card.network && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 uppercase font-mono font-bold shrink-0">
                              {card.network}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>Statement: {summary.statementDay}th</span>
                          <span>•</span>
                          <span>Due: {formattedDueDate}</span>
                          <span>•</span>
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                              summary.status === 'overdue'
                                ? 'bg-rose-500 text-white'
                                : summary.status === 'urgent'
                                ? 'bg-amber-400 text-slate-900 font-black'
                                : summary.status === 'due'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                            }`}
                          >
                            {summary.status === 'overdue'
                              ? `Overdue (${Math.abs(summary.daysUntilDue)}d)`
                              : summary.status === 'urgent'
                              ? `Due in ${summary.daysUntilDue}d`
                              : summary.status === 'due'
                              ? `Due in ${summary.daysUntilDue}d`
                              : 'No Bill Due'}
                          </span>
                        </div>
                        {card.notes && (
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 max-w-fit font-medium">
                            <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate"><strong className="text-amber-800 dark:text-amber-200">Remark:</strong> {card.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Limits breakdown */}
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Limit</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          {formatPaise(card.credit_limit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Available</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatPaise(summary.availableCredit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Unbilled</span>
                        <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                          {formatPaise(summary.netUnbilled)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Billed Due + Actions */}
                    <div
                      className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-left lg:text-right">
                        <div
                          className={`text-base font-black tabular-nums ${
                            summary.billedDue > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatPaise(summary.billedDue)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Billed Statement Due</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <CardMoveButtons
                          onMoveUp={() => moveItem(card.id, 'up', sortedCardSummaries.map((s) => s.card))}
                          onMoveDown={() => moveItem(card.id, 'down', sortedCardSummaries.map((s) => s.card))}
                          canMoveUp={listIdx > 0}
                          canMoveDown={listIdx < sortedCardSummaries.length - 1}
                          isLight={isLight}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSpendCardId(card.id);
                            setSpendBillingOption('auto');
                            setShowSpendModal(true);
                          }}
                          title="Record Spend"
                          className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPayModalForCard(card.id)}
                          title="Pay Bill"
                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-xs hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer"
                        >
                          Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCardForDetail(card)}
                          title="View Statement"
                          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareCardReminder(card, summary)}
                          title="Share WhatsApp Reminder"
                          className="p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCard(card)}
                          title="Edit Card"
                          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardToDelete(card)}
                          title="Delete Card"
                          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
      </div>
      )}

      {/* TAB 2: Systematic Billed & Unbilled Report Table */}
      {activeTab === 'report' && (
        <div
          className={`rounded-3xl border overflow-hidden transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
          }`}
        >
          <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                <span>All Cards Billed & Unbilled Statement Report</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clear separation of current statement dues vs upcoming billing cycle spends.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Billed = Pay Immediately
              </span>
              <span className="flex items-center gap-1 text-purple-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Unbilled = Next Cycle
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-white/5">
                <tr>
                  <th className="py-3 px-4">Card & Issuer</th>
                  <th className="py-3 px-4">Statement Date</th>
                  <th className="py-3 px-4">Payment Due Date</th>
                  <th className="py-3 px-4 text-right">🔴 Billed Due (Must Pay)</th>
                  <th className="py-3 px-4 text-right">🟣 Unbilled Spends</th>
                  <th className="py-3 px-4 text-right">🟢 Advance Credit</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {billingReport.cardSummaries.map((summary) => {
                  const card = summary.card;
                  const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <tr
                      key={card.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>{card.name}</span>
                          {card.variant && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              {card.variant}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span>{card.bank} •••• {card.last4}</span>
                          {card.network && (
                            <span className="uppercase text-[9px] text-slate-500 font-semibold">• {card.network}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                        {summary.statementDay}th of month
                        <div className="text-[10px] text-slate-400">
                          Last: {summary.lastStatementDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {formattedDueDate}
                        </div>
                        <div
                          className={`text-[10px] font-bold ${
                            summary.isOverdue
                              ? 'text-rose-500'
                              : summary.daysUntilDue <= 3
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {summary.isOverdue
                            ? `⚠️ Overdue by ${Math.abs(summary.daysUntilDue)} days`
                            : summary.daysUntilDue === 0
                            ? '🚨 Due today'
                            : `${summary.daysUntilDue} days left`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                          {formatPaise(summary.billedDue)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total Billed: {formatPaise(summary.billedSpends)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-sm text-purple-600 dark:text-purple-400 tabular-nums">
                          {formatPaise(summary.netUnbilled)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {summary.unbilledSpendsList.length} swipe(s)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatPaise(summary.advanceCredit)}
                        </div>
                        {summary.advancePayments > 0 && (
                          <div className="text-[10px] text-slate-400">
                            Paid: {formatPaise(summary.advancePayments)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            summary.status === 'overdue'
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              : summary.status === 'urgent'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : summary.status === 'due'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : summary.status === 'advance_credit'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {summary.status === 'overdue' && '⚠️ Overdue'}
                          {summary.status === 'urgent' && '🚨 Urgent Due'}
                          {summary.status === 'due' && '📅 Due Soon'}
                          {summary.status === 'unbilled_only' && '🗓️ Unbilled Only'}
                          {summary.status === 'advance_credit' && '🟢 In Advance'}
                          {summary.status === 'cleared' && '✅ All Cleared'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openPayModalForCard(card.id)}
                          className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs shadow-xs transition-all hover-lift"
                        >
                          {summary.billedDue > 0
                            ? 'Pay Due'
                            : summary.netUnbilled > 0
                            ? 'Pay'
                            : 'Advance'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <span>
              💡 <strong>Systematic Reminder Logic:</strong> Transactions marked as Billed must be settled by the Due Date. Transactions after the bill date roll into Unbilled. You can also explicitly choose Billed or Unbilled on each swipe.
            </span>
          </div>
        </div>
      )}

      {/* DELETE CARD CONFIRMATION MODAL */}
      {cardToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Delete {cardToDelete.name}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete this credit card ({cardToDelete.bank} •••• {cardToDelete.last4})? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCardToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCard}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/25"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Popup Modal */}
      <CardDetailModal
        card={selectedCardForDetail ? (cards.find((c) => c.id === selectedCardForDetail.id) || selectedCardForDetail) : null}
        onClose={() => setSelectedCardForDetail(null)}
        onRecordSpend={() => {
          if (selectedCardForDetail) setSpendCardId(selectedCardForDetail.id);
          setSpendBillingOption('auto'); // Auto by default
          setShowSpendModal(true);
        }}
        onPayBill={() => {
          if (selectedCardForDetail) openPayModalForCard(selectedCardForDetail.id);
        }}
        onDeleteCard={(cardId) => {
          syncEngine.deleteCard(cardId);
          setSelectedCardForDetail(null);
        }}
        onEditCard={(c) => handleOpenEditCard(c)}
      />

      {/* Modal: Add Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span>Add Credit Card</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4 overflow-y-auto pr-1 flex-1">
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
                    const isSelected = cardScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCardScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bank Issuer
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IndusInd, HDFC, SBI"
                    value={cardBank}
                    onChange={(e) => {
                      const newBank = e.target.value;
                      setCardBank(newBank);
                      if (!cardName || cardName === `${cardBank} ${cardVariant}`.trim() || cardName === cardBank) {
                        setCardName(`${newBank ? newBank.toUpperCase() : ''} ${cardVariant ? cardVariant.toUpperCase() : ''}`.trim());
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Card Variant
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pinnacle World, Regalia"
                    value={cardVariant}
                    onChange={(e) => {
                      const newVar = e.target.value;
                      setCardVariant(newVar);
                      if (!cardName || cardName === `${cardBank} ${cardVariant}`.trim() || cardName === cardBank) {
                        setCardName(`${cardBank ? cardBank.toUpperCase() : ''} ${newVar ? newVar.toUpperCase() : ''}`.trim());
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Quick Variant Suggestion Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Popular Card Variants
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {POPULAR_VARIANTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setCardVariant(v);
                        if (!cardName || cardName === `${cardBank} ${cardVariant}`.trim() || cardName === cardBank) {
                          setCardName(`${cardBank ? cardBank.toUpperCase() : ''} ${v.toUpperCase()}`.trim());
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        cardVariant.toLowerCase() === v.toLowerCase()
                          ? 'bg-purple-600 text-white border-transparent'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Network Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Card Network
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CARD_NETWORKS.map((net) => {
                    const isSelected = cardNetwork === net.id;
                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setCardNetwork(net.id)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-extrabold border transition-all text-center ${
                          isSelected
                            ? 'bg-purple-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {net.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Card Nickname
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INDUSIND PINNACLE WORLD"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    placeholder="1234"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Statement Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                    title="Day of month when statement is generated"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Due Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                    title="Payment due date (typically statement day + 20 days)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Total Credit Limit (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={limitRupees}
                  onChange={(e) => setLimitRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Opening Balances (Billed & Unbilled at Registration) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    Opening Balances (At Registration)
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <label className="block text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                      🔴 Billed Statement Due (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={initialBilledRupees}
                      onChange={(e) => setInitialBilledRupees(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      Generated last bill due
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                      🟣 Unbilled Spends (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={initialUnbilledRupees}
                      onChange={(e) => setInitialUnbilledRupees(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      Spends since cutoff
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remark / Card Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary fuel card, ₹10k monthly milestone, Lounge access, Auto-pay on 20th"
                  value={cardNotes}
                  onChange={(e) => setCardNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold text-xs shadow-md shadow-purple-500/25"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CARD */}
      {cardToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-500" />
                <span>Edit Credit Card</span>
              </h3>
              <button
                onClick={() => setCardToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCard} className="space-y-4 overflow-y-auto pr-1 flex-1">
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
                    const isSelected = editCardScope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditCardScope(s.id as EntityScope)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Card Nickname
                </label>
                <input
                  type="text"
                  required
                  value={editCardName}
                  onChange={(e) => setEditCardName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Bank Issuer
                  </label>
                  <input
                    type="text"
                    required
                    value={editCardBank}
                    onChange={(e) => {
                      const newBank = e.target.value;
                      setEditCardBank(newBank);
                      if (!editCardName || editCardName === `${editCardBank} ${editCardVariant}`.trim()) {
                        setEditCardName(`${newBank ? newBank.toUpperCase() : ''} ${editCardVariant ? editCardVariant.toUpperCase() : ''}`.trim());
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Card Variant
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pinnacle World, Regalia"
                    value={editCardVariant}
                    onChange={(e) => {
                      const newVar = e.target.value;
                      setEditCardVariant(newVar);
                      if (!editCardName || editCardName === `${editCardBank} ${editCardVariant}`.trim()) {
                        setEditCardName(`${editCardBank ? editCardBank.toUpperCase() : ''} ${newVar ? newVar.toUpperCase() : ''}`.trim());
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Quick Variant Suggestion Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Popular Card Variants
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {POPULAR_VARIANTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setEditCardVariant(v);
                        if (!editCardName || editCardName === `${editCardBank} ${editCardVariant}`.trim()) {
                          setEditCardName(`${editCardBank ? editCardBank.toUpperCase() : ''} ${v.toUpperCase()}`.trim());
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        editCardVariant.toLowerCase() === v.toLowerCase()
                          ? 'bg-purple-600 text-white border-transparent'
                          : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Network Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Card Network
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CARD_NETWORKS.map((net) => {
                    const isSelected = editCardNetwork === net.id;
                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => setEditCardNetwork(net.id)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-extrabold border transition-all text-center ${
                          isSelected
                            ? 'bg-purple-600 text-white border-transparent shadow-xs'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {net.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={editLast4}
                    onChange={(e) => setEditLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-mono font-bold tracking-wider focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Statement Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={editStatementDay}
                    onChange={(e) => setEditStatementDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Due Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Total Credit Limit (₹)
                </label>
                <input
                  type="number"
                  required
                  value={editLimitRupees}
                  onChange={(e) => setEditLimitRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Current Balances Adjuster (Billed & Unbilled) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                    Live Billed Due & Unbilled Spends
                  </span>
                  <span className="text-[10px] text-purple-500 font-bold">Auto-Reconciled</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <label className="block text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                      🔴 Billed Statement Due (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editBilledRupees}
                      onChange={(e) => setEditBilledRupees(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      Updates billed ledger
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <label className="block text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                      🟣 Unbilled Spends (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editUnbilledRupees}
                      onChange={(e) => setEditUnbilledRupees(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-bold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      Updates unbilled ledger
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remark / Card Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary fuel card, ₹10k monthly milestone, Lounge access, Auto-pay on 20th"
                  value={editCardNotes}
                  onChange={(e) => setEditCardNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCardToEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all touch-press"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Card Spend (Swipe) with Auto Cycle by Default */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                <span>Record Card Spend (Swipe)</span>
              </h3>
              <button
                onClick={() => setShowSpendModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSpend} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Card
                </label>
                <select
                  value={spendCardId}
                  onChange={(e) => setSpendCardId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              {/* Billing Cycle Classification Choice - AUTO CYCLE IS FIRST & DEFAULT */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Billing Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSpendBillingOption('auto')}
                    className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      spendBillingOption === 'auto'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>⚡ Auto Cycle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpendBillingOption('billed')}
                    className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      spendBillingOption === 'billed'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30 ring-2 ring-rose-500/30'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>🔴 Billed Due</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpendBillingOption('unbilled')}
                    className={`p-2.5 rounded-xl text-center border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      spendBillingOption === 'unbilled'
                        ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/30 ring-2 ring-purple-500/30'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>🟣 Unbilled</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {spendBillingOption === 'auto'
                    ? 'Default: Auto-determines based on spend date and card statement day.'
                    : spendBillingOption === 'billed'
                    ? 'Directly adds to current statement bill (to pay by due date).'
                    : 'Classified as Unbilled spend (rolls to next cycle).'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={spendAmountRupees}
                    onChange={(e) => setSpendAmountRupees(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Spend Date
                  </label>
                  <input
                    type="date"
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Spend Category
                </label>
                <select
                  value={spendCategory}
                  onChange={(e) => setSpendCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  <option value="Shopping">🛍️ Shopping & Retail</option>
                  <option value="Dining">🍽️ Food & Dining</option>
                  <option value="Groceries">🛒 Groceries & Supermarket</option>
                  <option value="Fuel">⛽ Fuel & Travel</option>
                  <option value="Utilities">💡 Utilities & Bills</option>
                  <option value="Electronics">💻 Electronics & Gadgets</option>
                  <option value="Other">📦 Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Merchant / Store Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amazon, Zomato, Reliance Smart, Petrol Pump"
                  value={spendMerchant}
                  onChange={(e) => setSpendMerchant(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-xs shadow-md shadow-rose-500/25"
                >
                  Save Spend
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pay Card Bill */}
      {showPayBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Pay Credit Card Bill</span>
              </h3>
              <button
                onClick={() => setShowPayBillModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayBill} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Card to Pay
                </label>
                <select
                  value={payCardId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setPayCardId(cId);
                    const selCard = cards.find((c) => c.id === cId);
                    if (selCard) {
                      const sum = calculateCardBilling(selCard, ledger);
                      if (sum.billedDue > 0) {
                        setPayOption('billed');
                        setPayAmountRupees(paiseToRupees(sum.billedDue).toString());
                      } else if (sum.netUnbilled > 0) {
                        setPayOption('total');
                        setPayAmountRupees(paiseToRupees(sum.netUnbilled).toString());
                      } else {
                        setPayOption('custom');
                        setPayAmountRupees('');
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.name} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Statement Summary for the Selected Card */}
              {(() => {
                const selectedCard = cards.find((c) => c.id === payCardId);
                if (!selectedCard) return null;
                const summary = calculateCardBilling(selectedCard, ledger);
                const formattedDueDate = summary.dueDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Statement Cutoff</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {summary.statementDay}th of month
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Payment Due Date</span>
                      <span className="font-bold text-rose-500">
                        {formattedDueDate} ({summary.daysUntilDue}d left)
                      </span>
                    </div>

                    {/* Quick Payment Selection Options */}
                    <div className="pt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('billed');
                          setPayAmountRupees(paiseToRupees(summary.billedDue).toString());
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'billed'
                            ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">1. Billed Due</span>
                        <span className="font-black text-xs tabular-nums block mt-0.5">
                          {formatPaise(summary.billedDue)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('total');
                          setPayAmountRupees(
                            paiseToRupees(
                              summary.billedDue > 0
                                ? summary.totalOutstanding
                                : summary.netUnbilled
                            ).toString()
                          );
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'total'
                            ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">
                          {summary.billedDue > 0 ? '2. Total Owed' : '2. Unbilled'}
                        </span>
                        <span className="font-black text-xs tabular-nums block mt-0.5">
                          {formatPaise(
                            summary.billedDue > 0
                              ? summary.totalOutstanding
                              : summary.netUnbilled
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayOption('custom');
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          payOption === 'custom'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold block">3. Advance</span>
                        <span className="font-bold text-[11px] block mt-0.5">Custom</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-900 dark:text-white font-black"
                />
              </div>

              {/* Pay From Account */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Deduct From Account
                </label>
                {(() => {
                  const currentCard = cards.find((c) => c.id === payCardId);
                  const cardScope = currentCard?.scope || 'business';
                  const scopeAccounts = accounts.filter((a) => (a.scope || 'business') === cardScope);
                  const otherAccounts = accounts.filter((a) => (a.scope || 'business') !== cardScope);

                  return (
                    <select
                      value={payAccountId}
                      onChange={(e) => setPayAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">Do not deduct from bank balance</option>
                      {scopeAccounts.length > 0 && (
                        <optgroup label={`${cardScope.toUpperCase()} ACCOUNTS (${scopeAccounts.length})`}>
                          {scopeAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id} className="dark:bg-slate-900 font-semibold">
                              {acc.name} (Balance: {formatPaise(acc.balance)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherAccounts.length > 0 && (
                        <optgroup label="OTHER SPHERES">
                          {otherAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id} className="dark:bg-slate-900 text-slate-400">
                              {acc.name} ({(acc.scope || 'business').toUpperCase()}) (Balance: {formatPaise(acc.balance)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Statement settled via Netbanking / UPI"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPayBillModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/25"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Smart Card Swipe Advisor */}
      <CardAdvisorModal
        isOpen={showAdvisorModal}
        onClose={() => setShowAdvisorModal(false)}
        cards={cards}
        onSelectCardToSpend={(cardId) => {
          setSpendCardId(cardId);
          setSpendBillingOption('auto');
          setShowSpendModal(true);
        }}
      />

      {/* Modal: Card Statement CSV / Text Importer */}
      <CardStatementImportModal
        isOpen={showImportStatementModal}
        onClose={() => setShowImportStatementModal(false)}
        cards={cards}
        initialCardId={cards[0]?.id}
      />
    </div>
  );
}