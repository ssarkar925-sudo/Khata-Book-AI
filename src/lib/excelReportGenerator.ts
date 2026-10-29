'use client';

import { LedgerEntry, Customer, PeopleDue, Card, CashLocation, Workspace } from '@/types';
import { paiseToRupees } from '@/lib/money';
import { getCategoryById } from '@/lib/categories';

export interface ReportExportData {
  workspace?: Workspace;
  dateRange: {
    startDateStr: string;
    endDateStr: string;
    periodLabel: string;
  };
  ledger: LedgerEntry[];
  customers: Customer[];
  dues: PeopleDue[];
  cards: Card[];
  accounts: CashLocation[];
  summary: {
    totalInflowPaise: number;
    totalOutflowPaise: number;
    netCashflowPaise: number;
    receivablesPaise: number;
    payablesPaise: number;
    totalCashBalancePaise: number;
    totalCardDuesPaise: number;
  };
}

/**
 * Generates and downloads a complete 4-tab Financial Excel Workbook (.xlsx)
 */
export async function exportComprehensiveFinancialWorkbook(data: ReportExportData) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const wsName = (data.workspace?.name || 'RecordBook').replace(/[/\\?*[\]:]/g, '_').slice(0, 24);

  // ==========================================
  // SHEET 1: Executive Summary & P&L
  // ==========================================
  const summaryRows: any[][] = [
    ['RECORDBOOK AI — COMPREHENSIVE FINANCIAL AUDIT REPORT'],
    ['Entity / Workspace:', data.workspace?.name || 'Default Workspace'],
    ['Report Period:', data.dateRange.periodLabel],
    ['Date Range:', `${data.dateRange.startDateStr} to ${data.dateRange.endDateStr}`],
    ['Generated At:', new Date().toLocaleString('en-IN')],
    [],
    ['KEY FINANCIAL INDICATORS', 'AMOUNT (INR)'],
    ['Total Income / Cash Inflow (+)', paiseToRupees(data.summary.totalInflowPaise)],
    ['Total Expenses / Outflow (-)', paiseToRupees(data.summary.totalOutflowPaise)],
    ['Net Operational Cashflow', paiseToRupees(data.summary.netCashflowPaise)],
    [],
    ['BALANCE SHEET & OBLIGATIONS', 'AMOUNT (INR)'],
    ['Total Liquid Bank & Cash Balances', paiseToRupees(data.summary.totalCashBalancePaise)],
    ['Pending Customer Receivables (You Will Get)', paiseToRupees(data.summary.receivablesPaise)],
    ['Pending Supplier Payables (You Will Give)', paiseToRupees(data.summary.payablesPaise)],
    ['Outstanding Credit Card Dues', paiseToRupees(data.summary.totalCardDuesPaise)],
    ['Net Business Position (Assets - Liabilities)', paiseToRupees(
      data.summary.totalCashBalancePaise + data.summary.receivablesPaise - data.summary.payablesPaise - data.summary.totalCardDuesPaise
    )],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // ==========================================
  // SHEET 2: Transaction Ledger
  // ==========================================
  const ledgerHeaders = [
    'Date',
    'Type',
    'Category',
    'Amount (INR)',
    'Scope',
    'Payment Mode',
    'Account / Bank',
    'Customer / Vendor',
    'Notes / Remarks',
    'Transaction ID',
  ];

  const custMap = new Map(data.customers.map((c) => [c.id, c.name]));
  const accMap = new Map(data.accounts.map((a) => [a.id, a.name]));

  const ledgerRows = data.ledger.map((tx) => [
    tx.entry_date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
    tx.type.toUpperCase(),
    getCategoryById(tx.category_id).name,
    paiseToRupees(tx.amount),
    (tx.scope || 'business').toUpperCase(),
    tx.mode ? tx.mode.toUpperCase() : 'CASH',
    tx.cash_location_id ? accMap.get(tx.cash_location_id) || 'Unknown Bank' : 'Primary Cash',
    tx.customer_id ? custMap.get(tx.customer_id) || '' : '',
    tx.note || '',
    tx.id,
  ]);

  const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeaders, ...ledgerRows]);
  XLSX.utils.book_append_sheet(wb, wsLedger, 'All Transactions');

  // ==========================================
  // SHEET 3: Udhar & Dues Register
  // ==========================================
  const udharHeaders = [
    'Party Name',
    'Phone',
    'Party Type',
    'Direction',
    'Pending Amount (INR)',
    'Due Date',
    'Status',
    'Scope',
    'Notes',
    'Due ID',
  ];

  const dueRows = data.dues.map((due) => {
    const cust = data.customers.find((c) => c.id === due.customer_id);
    return [
      cust?.name || 'Unknown Contact',
      cust?.phone || '',
      cust?.type ? cust.type.toUpperCase() : 'CUSTOMER',
      due.direction === 'you_will_get' ? 'YOU WILL GET (RECEIVABLE)' : 'YOU WILL GIVE (PAYABLE)',
      paiseToRupees(due.amount),
      due.due_date ? due.due_date.slice(0, 10) : '',
      due.status.toUpperCase(),
      (due.scope || 'business').toUpperCase(),
      due.notes || '',
      due.id,
    ];
  });

  const wsUdhar = XLSX.utils.aoa_to_sheet([udharHeaders, ...dueRows]);
  XLSX.utils.book_append_sheet(wb, wsUdhar, 'Udhar Register');

  // ==========================================
  // SHEET 4: Bank Accounts & Credit Cards
  // ==========================================
  const bankingHeaders = ['Bank / Account Name', 'Type', 'Scope', 'Current Balance (INR)'];
  const bankRows = data.accounts.map((acc) => [
    acc.name,
    (acc.account_type || 'bank').toUpperCase(),
    (acc.scope || 'business').toUpperCase(),
    paiseToRupees(acc.balance),
  ]);

  const cardHeaders = ['Card Name', 'Bank', 'Scope', 'Credit Limit (INR)', 'Due Day'];
  const cardRows = data.cards.map((c) => [
    c.name,
    c.bank || '',
    (c.scope || 'business').toUpperCase(),
    c.credit_limit ? paiseToRupees(c.credit_limit) : 0,
    c.due_day ? `Day ${c.due_day}` : '',
  ]);

  const wsBanking = XLSX.utils.aoa_to_sheet([
    ['BANK ACCOUNTS & CASH LOCATIONS'],
    bankingHeaders,
    ...bankRows,
    [],
    ['CREDIT CARDS'],
    cardHeaders,
    ...cardRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsBanking, 'Banking & Cards');

  // Download File
  const filename = `${wsName}_FullFinancialReport_${data.dateRange.startDateStr}_to_${data.dateRange.endDateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Quick Single-Sheet Excel Exporters
 */
export async function exportLedgerOnlyWorkbook(
  ledger: LedgerEntry[],
  accounts: CashLocation[],
  customers: Customer[],
  periodLabel: string
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const custMap = new Map(customers.map((c) => [c.id, c.name]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));

  const headers = [
    'Date',
    'Type',
    'Category',
    'Amount (INR)',
    'Scope',
    'Payment Mode',
    'Account / Bank',
    'Customer',
    'Notes',
  ];

  const rows = ledger.map((tx) => [
    tx.entry_date || (tx.created_at ? tx.created_at.slice(0, 10) : ''),
    tx.type.toUpperCase(),
    getCategoryById(tx.category_id).name,
    paiseToRupees(tx.amount),
    (tx.scope || 'business').toUpperCase(),
    tx.mode ? tx.mode.toUpperCase() : 'CASH',
    tx.cash_location_id ? accMap.get(tx.cash_location_id) || 'Unknown Bank' : 'Primary Cash',
    tx.customer_id ? custMap.get(tx.customer_id) || '' : '',
    tx.note || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    ['RECORDBOOK AI — GENERAL TRANSACTION LEDGER'],
    ['Period:', periodLabel],
    [],
    headers,
    ...rows,
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
  XLSX.writeFile(wb, `RecordBook_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportUdharOnlyWorkbook(dues: PeopleDue[], customers: Customer[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const headers = [
    'Party Name',
    'Phone',
    'Direction',
    'Pending (INR)',
    'Due Date',
    'Status',
    'Notes',
  ];

  const rows = dues.map((d) => {
    const cust = customers.find((c) => c.id === d.customer_id);
    return [
      cust?.name || 'Unknown',
      cust?.phone || '',
      d.direction === 'you_will_get' ? 'RECEIVABLE' : 'PAYABLE',
      paiseToRupees(d.amount),
      d.due_date ? d.due_date.slice(0, 10) : '',
      d.status.toUpperCase(),
      d.notes || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    ['RECORDBOOK AI — UDHAR (RECEIVABLES & PAYABLES) STATEMENT'],
    ['Generated At:', new Date().toLocaleString('en-IN')],
    [],
    headers,
    ...rows,
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Udhar Statement');
  XLSX.writeFile(wb, `RecordBook_Udhar_Dues_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
