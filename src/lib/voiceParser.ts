export interface ParsedVoiceExpense {
  type: 'cash_in' | 'cash_out' | 'card_spend';
  amountPaise: number;
  amountRupees: number;
  mode: 'cash' | 'upi' | 'card' | 'bank';
  note: string;
  category: string;
  rawText: string;
}

export function parseVoiceInput(text: string): ParsedVoiceExpense {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Detect Direction / Type
  let type: 'cash_in' | 'cash_out' | 'card_spend' = 'cash_out';
  if (
    lower.includes('received') ||
    lower.includes('got') ||
    lower.includes('income') ||
    lower.includes('earned') ||
    lower.includes('paise aaye') ||
    lower.includes('pelo') ||
    lower.includes('salary')
  ) {
    type = 'cash_in';
  } else if (
    lower.includes('card swipe') ||
    lower.includes('credit card') ||
    lower.includes('by card') ||
    lower.includes('on card')
  ) {
    type = 'card_spend';
  }

  // 2. Detect Amount (Numbers in digits or words)
  let amountRupees = 0;
  const numMatch = lower.match(/(?:rs\.?|inr|₹)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i);
  if (numMatch) {
    const rawNum = numMatch[1].replace(/,/g, '');
    amountRupees = parseFloat(rawNum);
  } else {
    // Word conversion fallback (simple common Indian English spoken numbers)
    if (lower.includes('hundred')) {
      const match = lower.match(/([0-9]+)\s*hundred/);
      if (match) amountRupees = parseInt(match[1], 10) * 100;
      else amountRupees = 100;
    } else if (lower.includes('thousand')) {
      const match = lower.match(/([0-9]+)\s*thousand/);
      if (match) amountRupees = parseInt(match[1], 10) * 1000;
      else amountRupees = 1000;
    }
  }

  const amountPaise = Math.round(amountRupees * 100);

  // 3. Detect Payment Mode
  let mode: 'cash' | 'upi' | 'card' | 'bank' = 'cash';
  if (
    lower.includes('upi') ||
    lower.includes('gpay') ||
    lower.includes('google pay') ||
    lower.includes('phonepe') ||
    lower.includes('paytm') ||
    lower.includes('scan') ||
    lower.includes('qr')
  ) {
    mode = 'upi';
  } else if (lower.includes('card') || type === 'card_spend') {
    mode = 'card';
  } else if (
    lower.includes('bank') ||
    lower.includes('transfer') ||
    lower.includes('neft') ||
    lower.includes('imps') ||
    lower.includes('cheque')
  ) {
    mode = 'bank';
  }

  // 4. Detect Category
  let category = 'General';
  if (
    lower.includes('grocery') ||
    lower.includes('supermarket') ||
    lower.includes('milk') ||
    lower.includes('vegetables') ||
    lower.includes('ration')
  ) {
    category = 'Groceries';
  } else if (
    lower.includes('dinner') ||
    lower.includes('lunch') ||
    lower.includes('food') ||
    lower.includes('restaurant') ||
    lower.includes('swiggy') ||
    lower.includes('zomato') ||
    lower.includes('cafe') ||
    lower.includes('chai')
  ) {
    category = 'Dining & Food';
  } else if (
    lower.includes('petrol') ||
    lower.includes('diesel') ||
    lower.includes('fuel') ||
    lower.includes('cng') ||
    lower.includes('uber') ||
    lower.includes('ola') ||
    lower.includes('auto')
  ) {
    category = 'Fuel & Travel';
  } else if (
    lower.includes('electricity') ||
    lower.includes('water bill') ||
    lower.includes('wifi') ||
    lower.includes('broadband') ||
    lower.includes('recharge') ||
    lower.includes('gas')
  ) {
    category = 'Bills & Utilities';
  } else if (
    lower.includes('medicine') ||
    lower.includes('doctor') ||
    lower.includes('hospital') ||
    lower.includes('pharmacy')
  ) {
    category = 'Healthcare';
  } else if (
    lower.includes('shirt') ||
    lower.includes('clothes') ||
    lower.includes('shoes') ||
    lower.includes('shopping') ||
    lower.includes('amazon') ||
    lower.includes('flipkart')
  ) {
    category = 'Shopping';
  }

  // 5. Clean Note
  let note = clean;
  // Remove filler words for clean note
  note = note
    .replace(/^(paid|spent|bought|gave|received|got|recorded)\s+/i, '')
    .replace(/(by|via|through|using)\s+(cash|upi|card|bank|google pay|phonepe|gpay|paytm)/gi, '')
    .trim();

  if (!note) {
    note = type === 'cash_in' ? 'Voice Income' : `${category} Expense`;
  }

  return {
    type,
    amountPaise,
    amountRupees,
    mode,
    category,
    note: note.charAt(0).toUpperCase() + note.slice(1),
    rawText: clean,
  };
}
