/**
 * Precision Money Logic (Strict Integer Paise: 1 Rupee = 100 Paise)
 * Prevents all IEEE 754 floating-point decimal rounding errors.
 */

export function parseToPaise(value: string | number): number {
  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) return 0;
    return Math.round(value * 100);
  }
  if (!value) return 0;

  const cleaned = String(value).replace(/[₹,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;

  return Math.round(parsed * 100);
}

export function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function formatPaise(paise: number | null | undefined, showSymbol: boolean = true): string {
  if (paise === null || paise === undefined) {
    return showSymbol ? '₹0.00' : '0.00';
  }

  const numPaise = Number(paise);
  if (isNaN(numPaise) || !isFinite(numPaise)) {
    return showSymbol ? '₹0.00' : '0.00';
  }

  const absPaise = Math.round(Math.abs(numPaise));
  const isNegative = numPaise < 0 && absPaise > 0;

  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;
  const paiseStr = remainderPaise.toString().padStart(2, '0');

  const rupeesStr = rupees.toString();
  let formattedRupees = '';

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const last3 = rupeesStr.substring(rupeesStr.length - 3);
    const rest = rupeesStr.substring(0, rupeesStr.length - 3);
    const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${withCommas},${last3}`;
  }

  const result = `${isNegative ? '-' : ''}${formattedRupees}.${paiseStr}`;
  return showSymbol ? `₹${result}` : result;
}
