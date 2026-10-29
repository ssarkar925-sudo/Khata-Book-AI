/**
 * Zero-Knowledge AES-GCM 256-bit Client-Side Encryption
 * Your secret keys never leave the browser unencrypted.
 */

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

// In-memory key derivation cache: (masterPassword + saltBase64) -> Promise<CryptoKey>
// Eliminates redundant PBKDF2 100,000 round derivations during mass decrypt/encrypt
const derivedKeyCache = new Map<string, Promise<CryptoKey>>();

export function clearKeyCache(): void {
  derivedKeyCache.clear();
}

export async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltKey = arrayBufferToBase64(salt.buffer as ArrayBuffer);
  const cacheKey = `${masterPassword}::${saltKey}`;

  const existing = derivedKeyCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const derivationPromise = (async () => {
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
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  derivedKeyCache.set(cacheKey, derivationPromise);
  return derivationPromise;
}

export async function encryptData(
  plaintext: string,
  masterPassword: string
): Promise<{ encrypted: string; iv: string; salt: string; authTag: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const enc = new TextEncoder();

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return {
    encrypted: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    authTag: 'AES-GCM-256',
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
 * Computes a secure PBKDF2-SHA256 (100,000 rounds) hash for PIN/passphrase storage.
 * Eliminates weak 32-bit FNV hashing and resists brute-force attacks.
 */
export async function computeSecurePinHash(
  pin: string,
  providedSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = providedSalt
    ? new Uint8Array(base64ToArrayBuffer(providedSalt))
    : crypto.getRandomValues(new Uint8Array(16));
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
      iterations: 100000,
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
