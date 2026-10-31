import { describe, it, expect, vi } from 'vitest';
import { parseToPaise, paiseToRupees, formatPaise } from '@/lib/money';

describe('Money Library', () => {
  describe('parseToPaise', () => {
    it('parses string rupees to paise', () => {
      expect(parseToPaise('100')).toBe(10000);
      expect(parseToPaise('100.50')).toBe(10050);
      expect(parseToPaise('0.01')).toBe(1);
    });

    it('parses number rupees to paise', () => {
      expect(parseToPaise(100)).toBe(10000);
      expect(parseToPaise(100.5)).toBe(10050);
      expect(parseToPaise(0)).toBe(0);
    });

    it('handles Indian number format with commas', () => {
      expect(parseToPaise('1,000')).toBe(100000);
      expect(parseToPaise('1,00,000')).toBe(10000000);
      expect(parseToPaise('1,23,456.78')).toBe(12345678);
    });

    it('handles currency symbol', () => {
      expect(parseToPaise('₹100')).toBe(10000);
      expect(parseToPaise('₹ 100.50')).toBe(10050);
    });

    it('handles whitespace', () => {
      expect(parseToPaise(' 100 ')).toBe(10000);
      expect(parseToPaise('\t100\n')).toBe(10000);
    });

    it('returns 0 for invalid input', () => {
      expect(parseToPaise('')).toBe(0);
      expect(parseToPaise('abc')).toBe(0);
      expect(parseToPaise(null as any)).toBe(0);
      expect(parseToPaise(undefined as any)).toBe(0);
      expect(parseToPaise(NaN)).toBe(0);
      expect(parseToPaise(Infinity)).toBe(0);
    });

    it('rounds correctly for floating point', () => {
      expect(parseToPaise('100.005')).toBe(10001); // rounds up
      expect(parseToPaise('100.004')).toBe(10000); // rounds down
    });
  });

  describe('paiseToRupees', () => {
    it('converts paise to rupees', () => {
      expect(paiseToRupees(10000)).toBe(100);
      expect(paiseToRupees(10050)).toBe(100.5);
      expect(paiseToRupees(1)).toBe(0.01);
      expect(paiseToRupees(0)).toBe(0);
    });

    it('handles negative values', () => {
      expect(paiseToRupees(-10000)).toBe(-100);
      expect(paiseToRupees(-1)).toBe(-0.01);
    });
  });

  describe('formatPaise', () => {
    it('formats positive amounts with Indian numbering', () => {
      expect(formatPaise(10000)).toBe('₹100.00');
      expect(formatPaise(10050)).toBe('₹100.50');
      expect(formatPaise(100000)).toBe('₹1,000.00');
      expect(formatPaise(10000000)).toBe('₹1,00,000.00');
      expect(formatPaise(12345678)).toBe('₹1,23,456.78');
      expect(formatPaise(1000000000)).toBe('₹1,00,00,000.00');
    });

    it('formats negative amounts', () => {
      expect(formatPaise(-10000)).toBe('₹-100.00');
      expect(formatPaise(-10050)).toBe('₹-100.50');
      expect(formatPaise(-10000000)).toBe('₹-1,00,000.00');
    });

    it('handles zero', () => {
      expect(formatPaise(0)).toBe('₹0.00');
      expect(formatPaise(null as any)).toBe('₹0.00');
      expect(formatPaise(undefined as any)).toBe('₹0.00');
    });

    it('can omit currency symbol', () => {
      expect(formatPaise(10000, false)).toBe('100.00');
      expect(formatPaise(-10000, false)).toBe('-100.00');
    });

    it('handles NaN and Infinity', () => {
      expect(formatPaise(NaN)).toBe('₹0.00');
      expect(formatPaise(Infinity)).toBe('₹0.00');
      expect(formatPaise(-Infinity)).toBe('₹0.00');
    });

    it('handles large numbers correctly', () => {
      // 1 crore = 1,00,00,000
      expect(formatPaise(1000000000)).toBe('₹1,00,00,000.00');
      // 10 crore
      expect(formatPaise(10000000000)).toBe('₹10,00,00,000.00');
    });
  });

  describe('round-trip consistency', () => {
    it('parseToPaise -> paiseToRupees preserves value', () => {
      const testValues = ['0', '0.01', '0.10', '1', '10', '100', '100.50', '1000.75', '100000.99'];
      for (const val of testValues) {
        const paise = parseToPaise(val);
        const rupees = paiseToRupees(paise);
        expect(rupees).toBeCloseTo(parseFloat(val), 2);
      }
    });

    it('formatPaise -> parseToPaise preserves value', () => {
      const testPaise = [0, 1, 50, 100, 10050, 100000, 12345678, -10000, -12345678];
      for (const paise of testPaise) {
        const formatted = formatPaise(paise);
        const parsed = parseToPaise(formatted);
        expect(parsed).toBe(paise);
      }
    });
  });
});