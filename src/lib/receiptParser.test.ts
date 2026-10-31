import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseReceiptImage, ParsedReceipt } from '@/lib/receiptParser';

// Mock File for testing
const createMockFile = (name: string, content: string = 'test'): File => {
  return new File([content], name, { type: 'image/jpeg' });
};

describe('Receipt Parser', () => {
  // Mock Tesseract.js to avoid loading the actual library in tests
  vi.mock('tesseract.js', () => ({
    recognize: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseReceiptImage - fallback heuristics', () => {
    it('detects petrol station from filename', async () => {
      const file = createMockFile('petrol_receipt.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBe('Indian Oil Corporation');
      expect(result.amountRupees).toBe(1200);
      expect(result.category).toBe('Fuel & Travel');
      expect(result.paymentMode).toBe('upi');
    });

    it('detects grocery from filename', async () => {
      const file = createMockFile('grocery_bill.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBe('Smart Supermarket');
      expect(result.amountRupees).toBe(1850);
      expect(result.category).toBe('Groceries');
      expect(result.paymentMode).toBe('card');
    });

    it('detects restaurant from filename', async () => {
      const file = createMockFile('restaurant_dinner.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBe('Mainland Dining Cafe');
      expect(result.amountRupees).toBe(940);
      expect(result.category).toBe('Dining & Food');
      expect(result.paymentMode).toBe('card');
    });

    it('detects pharmacy from filename', async () => {
      const file = createMockFile('medicine_receipt.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBe('Apollo Pharmacy Store');
      expect(result.amountRupees).toBe(620);
      expect(result.category).toBe('Healthcare');
      expect(result.paymentMode).toBe('upi');
    });

    it('detects bill from filename', async () => {
      const file = createMockFile('electricity_bill.pdf');
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBe('Electricity Utility Board');
      expect(result.amountRupees).toBe(2350);
      expect(result.category).toBe('Bills & Utilities');
      expect(result.paymentMode).toBe('bank');
    });

    it('uses deterministic fallback for unknown files', async () => {
      const file = createMockFile('random_receipt.png', 'x'.repeat(1000));
      const result = await parseReceiptImage(file);
      
      expect(result.merchant).toBeDefined();
      expect(result.amountRupees).toBeGreaterThan(0);
      expect(result.category).toBeDefined();
      expect(result.paymentMode).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns consistent results for same file size', async () => {
      const file1 = createMockFile('test.jpg', 'x'.repeat(500));
      const file2 = createMockFile('test2.jpg', 'x'.repeat(500));
      
      const result1 = await parseReceiptImage(file1);
      const result2 = await parseReceiptImage(file2);
      
      // Same file size should produce same deterministic result
      expect(result1.merchant).toBe(result2.merchant);
      expect(result1.amountRupees).toBe(result2.amountRupees);
      expect(result1.category).toBe(result2.category);
    });
  });

  describe('ParsedReceipt structure', () => {
    it('returns all required fields', async () => {
      const file = createMockFile('test.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result).toHaveProperty('merchant');
      expect(result).toHaveProperty('amountRupees');
      expect(result).toHaveProperty('amountPaise');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('paymentMode');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('items');
      
      expect(typeof result.merchant).toBe('string');
      expect(typeof result.amountRupees).toBe('number');
      expect(typeof result.amountPaise).toBe('number');
      expect(typeof result.date).toBe('string');
      expect(typeof result.category).toBe('string');
      expect(typeof result.paymentMode).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('amountPaise matches amountRupees * 100', async () => {
      const file = createMockFile('test.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.amountPaise).toBe(Math.round(result.amountRupees * 100));
    });

    it('date is valid ISO format', async () => {
      const file = createMockFile('test.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsedDate = new Date(result.date);
      expect(parsedDate.getTime()).not.toBeNaN();
    });

    it('confidence is between 0 and 1', async () => {
      const file = createMockFile('test.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('items array has at least one item', async () => {
      const file = createMockFile('test.jpg');
      const result = await parseReceiptImage(file);
      
      expect(result.items).toBeDefined();
      expect(result.items!.length).toBeGreaterThan(0);
      expect(result.items![0]).toHaveProperty('name');
      expect(result.items![0]).toHaveProperty('price');
    });
  });
});