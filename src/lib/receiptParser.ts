export interface ParsedReceipt {
  merchant: string;
  amountRupees: number;
  amountPaise: number;
  date: string;
  category: string;
  paymentMode: 'cash' | 'card' | 'upi' | 'bank';
  items?: Array<{ name: string; price: number }>;
  taxAmount?: number;
  confidence: number;
}

// Simulated Smart OCR parser with intelligent fallback heuristics
export async function parseReceiptImage(file: File): Promise<ParsedReceipt> {
  const fileName = file.name.toLowerCase();

  // Give a realistic processing delay for OCR scanning animation
  await new Promise((resolve) => setTimeout(resolve, 1400));

  // Default values
  let merchant = 'Retail Merchant';
  let amountRupees = 450;
  let category = 'Shopping';
  let paymentMode: 'cash' | 'card' | 'upi' | 'bank' = 'card';
  const today = new Date().toISOString().split('T')[0];

  // Smart heuristic based on file naming or random variance
  if (fileName.includes('petrol') || fileName.includes('fuel') || fileName.includes('oil')) {
    merchant = 'Indian Oil Corporation';
    amountRupees = 1200;
    category = 'Fuel & Travel';
    paymentMode = 'upi';
  } else if (fileName.includes('grocery') || fileName.includes('mart') || fileName.includes('spencer')) {
    merchant = 'Smart Supermarket';
    amountRupees = 1850;
    category = 'Groceries';
    paymentMode = 'card';
  } else if (fileName.includes('restaurant') || fileName.includes('cafe') || fileName.includes('dinner')) {
    merchant = 'Mainland Dining Cafe';
    amountRupees = 940;
    category = 'Dining & Food';
    paymentMode = 'card';
  } else if (fileName.includes('med') || fileName.includes('pharmacy') || fileName.includes('apollo')) {
    merchant = 'Apollo Pharmacy Store';
    amountRupees = 620;
    category = 'Healthcare';
    paymentMode = 'upi';
  } else if (fileName.includes('bill') || fileName.includes('electric') || fileName.includes('wifi')) {
    merchant = 'Electricity Utility Board';
    amountRupees = 2350;
    category = 'Bills & Utilities';
    paymentMode = 'bank';
  } else {
    // Semi-deterministic realistic estimate based on file size
    const seed = file.size % 1000;
    const sampleMerchants = [
      { name: 'Reliance Retail Ltd', cat: 'Groceries', mode: 'card' as const, amt: 1450 },
      { name: 'Shell Fuel Station', cat: 'Fuel & Travel', mode: 'upi' as const, amt: 800 },
      { name: 'Starbucks Coffee', cat: 'Dining & Food', mode: 'card' as const, amt: 520 },
      { name: 'Apollo Pharmacy', cat: 'Healthcare', mode: 'cash' as const, amt: 340 },
      { name: 'Decathlon Sports', cat: 'Shopping', mode: 'card' as const, amt: 2290 },
      { name: 'Local Kirana Store', cat: 'Groceries', mode: 'cash' as const, amt: 480 },
    ];
    const picked = sampleMerchants[seed % sampleMerchants.length];
    merchant = picked.name;
    category = picked.cat;
    paymentMode = picked.mode;
    amountRupees = picked.amt;
  }

  return {
    merchant,
    amountRupees,
    amountPaise: Math.round(amountRupees * 100),
    date: today,
    category,
    paymentMode,
    confidence: 0.94,
    items: [
      { name: `${category} Items`, price: amountRupees },
    ],
  };
}
