/**
 * Zero-Knowledge AES-GCM 256-bit Client-Side Encryption
 * Uses PBKDF2 with 600,000 iterations (OWASP 2026 recommendation) + constant-time verification
 * Your secret keys never leave the browser unencrypted.
 */

// PBKDF2 iterations - OWASP 2026 recommends 600,000 for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 32; // 256-bit salt
const IV_LENGTH = 12; // 96-bit IV for GCM

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

/**
 * Constant-time comparison to prevent timing attacks
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Derive encryption key from master password using PBKDF2
 */
export async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive verification key (separate from encryption key) for password verification
 * Uses different salt prefix to ensure key separation
 */
async function deriveVerificationKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Use a different derivation context for verification
  const verificationSalt = new Uint8Array(salt.length + 1);
  verificationSalt[0] = 0x01; // Domain separation byte
  verificationSalt.set(salt, 1);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: verificationSalt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify']
  );
}

/**
 * Create a password verification token (HMAC of a fixed message)
 * This replaces the insecure FNV-1a hash
 */
export async function createVerificationToken(masterPassword: string, salt: Uint8Array): Promise<string> {
  const key = await deriveVerificationKey(masterPassword, salt);
  const enc = new TextEncoder();
  const message = enc.encode('recordbook-vault-verify-v1');
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return arrayBufferToBase64(signature);
}

/**
 * Verify a password against a stored verification token using constant-time comparison
 */
export async function verifyPassword(
  masterPassword: string,
  saltBase64: string,
  storedTokenBase64: string
): Promise<boolean> {
  try {
    const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
    const storedToken = new Uint8Array(base64ToArrayBuffer(storedTokenBase64));
    const computedToken = await createVerificationToken(masterPassword, salt);
    const computedTokenBytes = new Uint8Array(base64ToArrayBuffer(computedToken));
    return timingSafeEqual(storedToken, computedTokenBytes);
  } catch {
    return false;
  }
}

export async function encryptData(
  plaintext: string,
  masterPassword: string
): Promise<{ encrypted: string; iv: string; salt: string; authTag: string; verificationToken: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterPassword, salt);
  const enc = new TextEncoder();

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  // Create verification token for future password verification without decrypting
  const verificationToken = await createVerificationToken(masterPassword, salt);

  return {
    encrypted: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    authTag: 'AES-GCM-256',
    verificationToken,
  };
}

export async function decryptData(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  masterPassword: string
): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const key = await deriveKey(masterPassword, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Re-encrypt data with a new master password (used when changing PIN)
 */
export async function reEncryptData(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  oldPassword: string,
  newPassword: string
): Promise<{ encrypted: string; iv: string; salt: string; authTag: string; verificationToken: string }> {
  // Decrypt with old password
  const plaintext = await decryptData(ciphertextBase64, ivBase64, saltBase64, oldPassword);
  // Encrypt with new password (generates new salt, iv, verificationToken)
  return encryptData(plaintext, newPassword);
}

/**
 * Verify vault can be unlocked with given password (without full decryption)
 * Faster than full decrypt for unlock check
 */
export async function verifyVaultAccess(
  verificationTokenBase64: string,
  saltBase64: string,
  masterPassword: string
): Promise<boolean> {
  return verifyPassword(masterPassword, saltBase64, verificationTokenBase64);
}

/**
 * Computes a secure PBKDF2-SHA256 (600,000 rounds) hash for PIN/passphrase storage.
 * Used for App Lock PIN verification.
 */
export async function computeSecurePinHash(
  pin: string,
  providedSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = providedSalt
    ? new Uint8Array(base64ToArrayBuffer(providedSalt))
    : crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return {
    hash: arrayBufferToBase64(derivedBits),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Verify a PIN against stored hash using constant-time comparison
 */
export async function verifySecurePinHash(
  pin: string,
  saltBase64: string,
  storedHashBase64: string
): Promise<boolean> {
  try {
    const { hash } = await computeSecurePinHash(pin, saltBase64);
    const storedHash = new Uint8Array(base64ToArrayBuffer(storedHashBase64));
    const computedHash = new Uint8Array(base64ToArrayBuffer(hash));
    return timingSafeEqual(storedHash, computedHash);
  } catch {
    return false;
  }
}