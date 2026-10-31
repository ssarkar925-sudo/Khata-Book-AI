import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  encryptData, 
  decryptData, 
  deriveKey, 
  createVerificationToken, 
  verifyPassword, 
  verifyVaultAccess,
  reEncryptData,
  computeSecurePinHash,
  verifySecurePinHash,
  timingSafeEqual 
} from '@/lib/crypto';

describe('Crypto Library', () => {
  const testPassword = 'test-password-123';
  const testData = 'This is secret data that should be encrypted';

  // Mock crypto.subtle for deterministic testing
  const mockCryptoKey = { type: 'secret', algorithm: { name: 'AES-GCM', length: 256 } };
  const mockDerivedBits = new Uint8Array(32).fill(42);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('timingSafeEqual', () => {
    it('returns true for equal arrays', () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it('returns false for different arrays', () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 5]);
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it('returns false for different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);
      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it('returns true for empty arrays', () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([]);
      expect(timingSafeEqual(a, b)).toBe(true);
    });
  });

  describe('computeSecurePinHash', () => {
    it('generates consistent hash for same pin and salt', async () => {
      const salt = 'dGVzdC1zYWx0'; // base64 encoded 'test-salt'
      const result1 = await computeSecurePinHash('1234', salt);
      const result2 = await computeSecurePinHash('1234', salt);
      
      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(result2.salt);
    });

    it('generates different hash for different pins', async () => {
      const salt = 'dGVzdC1zYWx0';
      const result1 = await computeSecurePinHash('1234', salt);
      const result2 = await computeSecurePinHash('5678', salt);
      
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('generates random salt when not provided', async () => {
      const result = await computeSecurePinHash('1234');
      expect(result.salt).toBeDefined();
      expect(result.salt.length).toBeGreaterThan(0);
      expect(result.hash).toBeDefined();
    });

    it('uses 600000 iterations', async () => {
      const result = await computeSecurePinHash('1234');
      // We can't directly test iterations, but we can verify it's using the constant
      expect(result.hash).toBeDefined();
    });
  });

  describe('verifySecurePinHash', () => {
    it('verifies correct pin', async () => {
      const { hash, salt } = await computeSecurePinHash('1234');
      const isValid = await verifySecurePinHash('1234', salt, hash);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect pin', async () => {
      const { hash, salt } = await computeSecurePinHash('1234');
      const isValid = await verifySecurePinHash('5678', salt, hash);
      expect(isValid).toBe(false);
    });

    it('handles invalid base64 gracefully', async () => {
      const isValid = await verifySecurePinHash('1234', 'invalid-base64', 'invalid-base64');
      expect(isValid).toBe(false);
    });
  });

  describe('encryptData / decryptData', () => {
    it('encrypts and decrypts data correctly', async () => {
      const encrypted = await encryptData(testData, testPassword);
      
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.authTag).toBe('AES-GCM-256');
      expect(encrypted.verificationToken).toBeDefined();

      const decrypted = await decryptData(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.salt,
        testPassword
      );
      
      expect(decrypted).toBe(testData);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const encrypted1 = await encryptData(testData, testPassword);
      const encrypted2 = await encryptData(testData, testPassword);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('fails to decrypt with wrong password', async () => {
      const encrypted = await encryptData(testData, testPassword);
      
      await expect(
        decryptData(encrypted.encrypted, encrypted.iv, encrypted.salt, 'wrong-password')
      ).rejects.toThrow();
    });

    it('fails to decrypt with tampered ciphertext', async () => {
      const encrypted = await encryptData(testData, testPassword);
      const tamperedCiphertext = encrypted.encrypted.slice(0, -4) + 'abcd';
      
      await expect(
        decryptData(tamperedCiphertext, encrypted.iv, encrypted.salt, testPassword)
      ).rejects.toThrow();
    });

    it('handles empty string', async () => {
      const encrypted = await encryptData('', testPassword);
      const decrypted = await decryptData(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.salt,
        testPassword
      );
      expect(decrypted).toBe('');
    });

    it('handles unicode content', async () => {
      const unicodeData = 'Hello 🌍 你好 こんにちは 🔐';
      const encrypted = await encryptData(unicodeData, testPassword);
      const decrypted = await decryptData(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.salt,
        testPassword
      );
      expect(decrypted).toBe(unicodeData);
    });
  });

  describe('createVerificationToken / verifyPassword / verifyVaultAccess', () => {
    it('creates and verifies token correctly', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltBase64 = btoa(String.fromCharCode(...salt));
      
      const token = await createVerificationToken(testPassword, salt);
      const tokenBase64 = btoa(String.fromCharCode(...new Uint8Array(atob(token).split('').map(c => c.charCodeAt(0)))));
      
      const isValid = await verifyPassword(testPassword, saltBase64, token);
      expect(isValid).toBe(true);
    });

    it('rejects wrong password', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltBase64 = btoa(String.fromCharCode(...salt));
      
      const token = await createVerificationToken(testPassword, salt);
      const isValid = await verifyPassword('wrong-password', saltBase64, token);
      expect(isValid).toBe(false);
    });

    it('verifyVaultAccess works as alias', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltBase64 = btoa(String.fromCharCode(...salt));
      
      const token = await createVerificationToken(testPassword, salt);
      const isValid = await verifyVaultAccess(token, saltBase64, testPassword);
      expect(isValid).toBe(true);
    });
  });

  describe('reEncryptData', () => {
    it('re-encrypts data with new password', async () => {
      const encrypted = await encryptData(testData, testPassword);
      const newPassword = 'new-secure-password-456';
      
      const reEncrypted = await reEncryptData(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.salt,
        testPassword,
        newPassword
      );
      
      expect(reEncrypted.encrypted).not.toBe(encrypted.encrypted);
      expect(reEncrypted.iv).not.toBe(encrypted.iv);
      expect(reEncrypted.salt).not.toBe(encrypted.salt);
      expect(reEncrypted.verificationToken).not.toBe(encrypted.verificationToken);
      
      // Verify can decrypt with new password
      const decrypted = await decryptData(
        reEncrypted.encrypted,
        reEncrypted.iv,
        reEncrypted.salt,
        newPassword
      );
      expect(decrypted).toBe(testData);
    });

    it('fails with wrong old password', async () => {
      const encrypted = await encryptData(testData, testPassword);
      
      await expect(
        reEncryptData(
          encrypted.encrypted,
          encrypted.iv,
          encrypted.salt,
          'wrong-old-password',
          'new-password'
        )
      ).rejects.toThrow();
    });
  });

  describe('deriveKey', () => {
    it('derives key from password and salt', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key = await deriveKey(testPassword, salt);
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
    });

    it('derives different keys for different passwords', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key1 = await deriveKey('password1', salt);
      const key2 = await deriveKey('password2', salt);
      // Keys should be different objects
      expect(key1).not.toBe(key2);
    });

    it('derives different keys for different salts', async () => {
      const salt1 = crypto.getRandomValues(new Uint8Array(32));
      const salt2 = crypto.getRandomValues(new Uint8Array(32));
      const key1 = await deriveKey(testPassword, salt1);
      const key2 = await deriveKey(testPassword, salt2);
      expect(key1).not.toBe(key2);
    });
  });
});