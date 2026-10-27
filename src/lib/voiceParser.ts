export interface ParsedVoiceExpense {
  type: 'cash_in' | 'cash_out' | 'card_spend';
  amountPaise: number;
  amountRupees: number;
  mode: 'cash' | 'upi' | 'card' | 'bank';
  category: string;
  categoryName: string;
  contactName?: string | null;
  accountName?: string | null;
  note: string;
  rawText: string;
}

export function parseVoiceInput(text: string): ParsedVoiceExpense {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Detect Direction / Type (Cash In / Income vs Cash Out / Expense)
  let type: 'cash_in' | 'cash_out' | 'card_spend' = 'cash_out';

  const incomeKeywords = [
    'received',
    'got',
    'income',
    'earned',
    'sale',
    'sales',
    'revenue',
    'paise aaye',
    'aaye',
    'mila',
    'mile',
    'prapt hue',
    'jama hua',
    'diye usne',
    'credit hua',
  ];

  const cardKeywords = [
    'credit card',
    'card swipe',
    'card se',
    'card pay',
    'by card',
    'on card',
    'swipe kiya',
  ];

  if (incomeKeywords.some((k) => lower.includes(k))) {
    type = 'cash_in';
  } else if (cardKeywords.some((k) => lower.includes(k))) {
    type = 'card_spend';
  }

  // 2. Detect Amount (Digits or Spoken Hindi / English Words)
  let amountRupees = 0;

  // Regex to extract numbers like 500, 1,200, 1500.50
  const numMatch = lower.match(/(?:rs\.?|inr|₹|rupay|rupaye|rupees)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i);
  if (numMatch && parseFloat(numMatch[1].replace(/,/g, '')) > 0) {
    amountRupees = parseFloat(numMatch[1].replace(/,/g, ''));
  } else {
    // Spoken Hindi / English Word Matching
    let multiplier = 1;
    if (lower.includes('hazar') || lower.includes('hazār') || lower.includes('thousand')) {
      multiplier = 1000;
    } else if (lower.includes('lakh') || lower.includes('lacs')) {
      multiplier = 100000;
    } else if (lower.includes('sau') || lower.includes('hundred')) {
      multiplier = 100;
    }

    if (lower.includes('ek') || lower.includes('one')) amountRupees = 1 * multiplier;
    else if (lower.includes('do') || lower.includes('two')) amountRupees = 2 * multiplier;
    else if (lower.includes('teen') || lower.includes('three')) amountRupees = 3 * multiplier;
    else if (lower.includes('char') || lower.includes('four')) amountRupees = 4 * multiplier;
    else if (lower.includes('paanch') || lower.includes('five')) amountRupees = 5 * multiplier;
    else if (lower.includes('dhai')) amountRupees = 2.5 * multiplier;
    else if (lower.includes('dedh')) amountRupees = 1.5 * multiplier;
    else if (lower.includes('das') || lower.includes('ten')) amountRupees = 10 * multiplier;
    else if (multiplier > 1) amountRupees = multiplier;
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
    lower.includes('neft') ||
    lower.includes('rtgs') ||
    lower.includes('imps') ||
    lower.includes('cheque') ||
    lower.includes('netbanking') ||
    lower.includes('account transfer')
  ) {
    mode = 'bank';
  } else if (lower.includes('cash') || lower.includes('nagad') || lower.includes('rokad')) {
    mode = 'cash';
  }

  // 4. Detect Category
  let category = 'general';
  let categoryName = 'General & Others';

  if (
    lower.includes('chai') ||
    lower.includes('nashta') ||
    lower.includes('lunch') ||
    lower.includes('dinner') ||
    lower.includes('food') ||
    lower.includes('khana') ||
    lower.includes('samosa') ||
    lower.includes('coffee') ||
    lower.includes('tea') ||
    lower.includes('swiggy') ||
    lower.includes('zomato') ||
    lower.includes('restaurant') ||
    lower.includes('cafe')
  ) {
    category = 'food';
    categoryName = 'Food, Tea & Snacks';
  } else if (
    lower.includes('petrol') ||
    lower.includes('diesel') ||
    lower.includes('fuel') ||
    lower.includes('cng') ||
    lower.includes('gaadi') ||
    lower.includes('cab') ||
    lower.includes('uber') ||
    lower.includes('ola') ||
    lower.includes('auto') ||
    lower.includes('travel') ||
    lower.includes('fare')
  ) {
    category = 'travel';
    categoryName = 'Travel & Fuel';
  } else if (
    lower.includes('bijli') ||
    lower.includes('light bill') ||
    lower.includes('electricity') ||
    lower.includes('water') ||
    lower.includes('pani') ||
    lower.includes('wifi') ||
    lower.includes('broadband') ||
    lower.includes('recharge') ||
    lower.includes('mobile bill') ||
    lower.includes('gas') ||
    lower.includes('cylinder') ||
    lower.includes('bill')
  ) {
    category = 'bills';
    categoryName = 'Electricity & Utilities';
  } else if (
    lower.includes('maal') ||
    lower.includes('stock') ||
    lower.includes('inventory') ||
    lower.includes('saman') ||
    lower.includes('raw material') ||
    lower.includes('purchase') ||
    lower.includes('kharida')
  ) {
    category = 'inventory';
    categoryName = 'Inventory & Stock';
  } else if (
    lower.includes('salary') ||
    lower.includes('tankhwah') ||
    lower.includes('vetan') ||
    lower.includes('wages') ||
    lower.includes('mazduri') ||
    lower.includes('staff') ||
    lower.includes('worker') ||
    lower.includes('karamchari')
  ) {
    category = 'salary';
    categoryName = 'Staff Salary & Wages';
  } else if (
    lower.includes('rent') ||
    lower.includes('kiraya') ||
    lower.includes('dukan ka kiraya') ||
    lower.includes('shop rent')
  ) {
    category = 'rent';
    categoryName = 'Rent & Maintenance';
  } else if (
    lower.includes('sale') ||
    lower.includes('bikri') ||
    lower.includes('service') ||
    lower.includes('customer payment')
  ) {
    category = 'sales_revenue';
    categoryName = 'Sales & Service Income';
  } else if (
    lower.includes('courier') ||
    lower.includes('parcel') ||
    lower.includes('transport') ||
    lower.includes('shipping') ||
    lower.includes('delivery')
  ) {
    category = 'logistics';
    categoryName = 'Shipping & Courier';
  } else if (
    lower.includes('repair') ||
    lower.includes('maintenance') ||
    lower.includes('hardware') ||
    lower.includes('theek karwaya')
  ) {
    category = 'maintenance';
    categoryName = 'Repairs & Hardware';
  } else if (
    lower.includes('ad') ||
    lower.includes('marketing') ||
    lower.includes('poster') ||
    lower.includes('pamphlet') ||
    lower.includes('flex')
  ) {
    category = 'marketing';
    categoryName = 'Marketing & Printing';
  }

  // 5. Account matching (e.g. HDFC, SBI, ICICI, Drawer, Cash Counter)
  let accountName: string | null = null;
  if (lower.includes('hdfc')) accountName = 'HDFC';
  else if (lower.includes('sbi') || lower.includes('state bank')) accountName = 'SBI';
  else if (lower.includes('icici')) accountName = 'ICICI';
  else if (lower.includes('axis')) accountName = 'Axis';
  else if (lower.includes('kotak')) accountName = 'Kotak';
  else if (lower.includes('pnb')) accountName = 'PNB';
  else if (lower.includes('drawer') || lower.includes('galla') || lower.includes('cash counter')) {
    accountName = 'Cash Drawer';
  }

  // 6. Contact party name extraction (e.g., "Ramesh ko", "Ramesh ne", "from Suresh", "to Rahul")
  let contactName: string | null = null;
  const partyMatch = clean.match(/(?:to|from|for|ko|ne|se)\s+([A-Za-z\u0900-\u097F]+)/i);
  if (partyMatch && partyMatch[1]) {
    const candidate = partyMatch[1].trim();
    // Exclude common noise words
    const noise = ['cash', 'upi', 'card', 'bank', 'rupay', 'rupees', 'petrol', 'chai', 'food'];
    if (!noise.includes(candidate.toLowerCase())) {
      contactName = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  // 7. Clean Note
  let note = clean
    .replace(/(?:rs\.?|inr|₹|rupay|rupaye|rupees)?\s*[0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?/gi, '')
    .replace(/(?:paid|spent|bought|gave|received|got|recorded|diya|mila|bhara|kharida)\s*/gi, '')
    .replace(/(?:by|via|through|using|se|mein|me|ko)\s+(?:cash|upi|card|bank|google pay|phonepe|gpay|paytm)/gi, '')
    .trim();

  if (!note || note.length < 2) {
    note = type === 'cash_in' ? 'Voice Income' : `${categoryName} Expense`;
  } else {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }

  return {
    type,
    amountPaise,
    amountRupees,
    mode,
    category,
    categoryName,
    contactName,
    accountName,
    note,
    rawText: clean,
  };
}
