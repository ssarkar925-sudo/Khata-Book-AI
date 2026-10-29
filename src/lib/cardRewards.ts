import { Card } from '@/types';

export interface CardRewardPerk {
  category: 'shopping' | 'dining' | 'travel' | 'fuel' | 'utility' | 'general';
  multiplier: number; // e.g. 5 for 5% cashback or 5X points
  rateDescription: string;
  perkNote: string;
}

export interface CardAdviceResult {
  card: Card;
  rank: number;
  expectedRewardPercent: number;
  estimatedReturnRupees: number;
  highlight: string;
  daysInterestFree: number;
  recommendationReason: string;
}

// Knowledge base of popular credit card reward structures
export const CARD_BENEFIT_MAP: Record<string, CardRewardPerk[]> = {
  'pinnacle world': [
    { category: 'travel', multiplier: 2.5, rateDescription: '2.5% Reward Rate', perkNote: 'Accelerated travel points & airport lounge privileges' },
    { category: 'shopping', multiplier: 2.0, rateDescription: '2.0% Online Spends', perkNote: '2.5 reward points per ₹100 on e-commerce' },
    { category: 'dining', multiplier: 2.0, rateDescription: '2.0% Dining Rate', perkNote: 'Exclusive dining concierge savings' },
    { category: 'general', multiplier: 1.5, rateDescription: '1.5% Base Spends', perkNote: '1.5 points per ₹100 on all offline merchant swipes' },
  ],
  'regalia gold': [
    { category: 'travel', multiplier: 6.6, rateDescription: '4X Points (up to 6.6%)', perkNote: 'Flight & hotel redemption on SmartBuy' },
    { category: 'dining', multiplier: 4.0, rateDescription: '4X Dining Points', perkNote: 'Accelerated dining rewards & Club Marriott privileges' },
    { category: 'shopping', multiplier: 5.0, rateDescription: '5X Partner Shopping', perkNote: 'Accelerated points on Myntra, Nykaa, Marks & Spencer' },
    { category: 'general', multiplier: 2.6, rateDescription: '4 Points / ₹150 (~2.6%)', perkNote: 'Base reward on retail transactions' },
  ],
  'infinia': [
    { category: 'travel', multiplier: 33.3, rateDescription: '10X on SmartBuy (33.3%)', perkNote: '50 points per ₹150 on flights & hotels' },
    { category: 'shopping', multiplier: 16.6, rateDescription: '5X on SmartBuy Vouchers', perkNote: 'Instant voucher rewards for Amazon & Flipkart' },
    { category: 'dining', multiplier: 6.6, rateDescription: '2X on Dining', perkNote: 'Good Food Trail restaurant savings' },
    { category: 'general', multiplier: 3.3, rateDescription: '5 Points / ₹150 (3.3%)', perkNote: 'Standard retail reward redemption 1:1 on flights' },
  ],
  'millennia': [
    { category: 'shopping', multiplier: 5.0, rateDescription: '5% Direct Cashback', perkNote: 'Amazon, Flipkart, Swiggy, Zomato, Uber' },
    { category: 'dining', multiplier: 5.0, rateDescription: '5% Swiggy / Zomato', perkNote: 'Direct cashback credit to statement' },
    { category: 'general', multiplier: 1.0, rateDescription: '1% Flat Cashback', perkNote: 'All other wallet & retail spends' },
  ],
  'amazon pay': [
    { category: 'shopping', multiplier: 5.0, rateDescription: '5% Unlimited Cashback', perkNote: 'Amazon shopping (Prime member)' },
    { category: 'utility', multiplier: 2.0, rateDescription: '2% on Bill Payments', perkNote: 'Electricity, mobile recharges on Amazon Pay' },
    { category: 'dining', multiplier: 2.0, rateDescription: '2% on Partner Food', perkNote: 'Swiggy, Domino’s via Amazon Pay' },
    { category: 'general', multiplier: 1.0, rateDescription: '1% Flat Cashback', perkNote: 'Direct auto-credit as Amazon Pay balance' },
  ],
  'simplyclick': [
    { category: 'shopping', multiplier: 3.5, rateDescription: '10X Reward Points (~3.5%)', perkNote: 'Amazon, Cleartrip, BookMyShow, Lenskart, Netmeds' },
    { category: 'dining', multiplier: 1.5, rateDescription: '5X All Online Spends', perkNote: 'Any online food or shopping order' },
    { category: 'fuel', multiplier: 1.0, rateDescription: '1% Fuel Surcharge Waiver', perkNote: 'Waived for ₹500 - ₹3,000 fuel transactions' },
    { category: 'general', multiplier: 0.5, rateDescription: '1 Point / ₹100 (0.25-0.5%)', perkNote: 'Base offline swipe rewards' },
  ],
  'coral': [
    { category: 'dining', multiplier: 2.5, rateDescription: 'Culinary Treats 15% + 2X', perkNote: 'Discounts at 2,500+ restaurants across India' },
    { category: 'shopping', multiplier: 2.0, rateDescription: '2 Points / ₹100', perkNote: 'Double reward points on online supermarket spends' },
    { category: 'fuel', multiplier: 1.0, rateDescription: '1% Surcharge Waiver', perkNote: 'At HPCL fuel pumps' },
    { category: 'general', multiplier: 1.0, rateDescription: '1 Point / ₹100', perkNote: 'Redeemable on ICICI Rewards catalogue' },
  ],
  'sapphiro': [
    { category: 'travel', multiplier: 4.0, rateDescription: '4 Points / ₹100 International', perkNote: 'Complimentary DreamFolks DragonPass lounges' },
    { category: 'dining', multiplier: 2.5, rateDescription: 'Culinary Treats Program', perkNote: 'Up to 20% off at partner luxury hotels' },
    { category: 'shopping', multiplier: 2.0, rateDescription: '2 Points / ₹100 Domestic', perkNote: 'BookMyShow Buy 1 Get 1 free (up to ₹500)' },
    { category: 'general', multiplier: 1.5, rateDescription: 'Premium Lifestyle Rewards', perkNote: 'Dedicated customer concierge' },
  ],
  'magnus': [
    { category: 'travel', multiplier: 12.0, rateDescription: '5X on Travel EDGE', perkNote: 'Hotel and airline transfer ratio benefits' },
    { category: 'dining', multiplier: 4.0, rateDescription: 'Dining Delights up to 40%', perkNote: 'EazyDiner Prime discounts' },
    { category: 'general', multiplier: 2.4, rateDescription: '12 Points / ₹200 (2.4%)', perkNote: 'Base spend rate on all non-fuel categories' },
  ],
};

/**
 * Calculates how many days of interest-free credit are remaining for a card right now
 */
export function calculateDaysInterestFree(statementDay: number, dueDay: number): number {
  const now = new Date();
  const currentDay = now.getDate();

  // If before statement day this month: statement generates on statementDay, due on dueDay next month
  let nextStatementDate = new Date(now.getFullYear(), now.getMonth(), statementDay);
  if (currentDay > statementDay) {
    nextStatementDate = new Date(now.getFullYear(), now.getMonth() + 1, statementDay);
  }

  // Due date is in the month following the statement (or later)
  let nextDueDate = new Date(nextStatementDate.getFullYear(), nextStatementDate.getMonth(), dueDay);
  if (dueDay <= statementDay) {
    nextDueDate = new Date(nextStatementDate.getFullYear(), nextStatementDate.getMonth() + 1, dueDay);
  }

  const diffTime = nextDueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(15, Math.min(52, diffDays));
}

/**
 * Ranks all available cards for a given spend category and amount
 */
export function recommendBestCardForSpend(
  cards: Card[],
  category: 'shopping' | 'dining' | 'travel' | 'fuel' | 'utility' | 'general',
  spendAmountRupees: number
): CardAdviceResult[] {
  if (!cards || cards.length === 0) return [];

  const results: CardAdviceResult[] = cards.map((card) => {
    // Look up perks by variant or card name
    const lookupKey = (card.variant || card.name || '').toLowerCase();
    let perks: CardRewardPerk[] | undefined;

    for (const [key, value] of Object.entries(CARD_BENEFIT_MAP)) {
      if (lookupKey.includes(key)) {
        perks = value;
        break;
      }
    }

    // Default fallback perk structure
    if (!perks) {
      perks = [
        { category: 'general', multiplier: 1.0, rateDescription: '1.0% Standard Reward', perkNote: 'Standard bank points program' },
      ];
    }

    // Find best match for this category or fallback to general
    const matchedPerk =
      perks.find((p) => p.category === category) ||
      perks.find((p) => p.category === 'general') ||
      perks[0];

    const expectedRewardPercent = matchedPerk.multiplier;
    const estimatedReturnRupees = Math.round((spendAmountRupees * expectedRewardPercent) / 100);
    const daysInterestFree = calculateDaysInterestFree(card.statement_day || 15, card.due_day || 5);

    let reason = `${matchedPerk.rateDescription}: ${matchedPerk.perkNote}`;
    if (daysInterestFree > 35) {
      reason += ` • Long credit window: ${daysInterestFree} days interest-free remaining!`;
    }

    return {
      card,
      rank: 0,
      expectedRewardPercent,
      estimatedReturnRupees,
      highlight: matchedPerk.rateDescription,
      daysInterestFree,
      recommendationReason: reason,
    };
  });

  // Sort descending by expected reward percent, then by days interest free
  results.sort((a, b) => {
    if (b.expectedRewardPercent !== a.expectedRewardPercent) {
      return b.expectedRewardPercent - a.expectedRewardPercent;
    }
    return b.daysInterestFree - a.daysInterestFree;
  });

  // Assign ranks
  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return results;
}
