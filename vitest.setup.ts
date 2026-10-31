import '@testing-library/jest-dom';
import { vi, beforeEach, beforeAll, afterAll } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Use real Web Crypto API from jsdom (don't mock it)

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});

// Mock window.PublicKeyCredential
Object.defineProperty(window, 'PublicKeyCredential', {
  value: {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
  },
  writable: true,
});

// Mock navigator.credentials
Object.defineProperty(navigator, 'credentials', {
  value: {
    get: vi.fn().mockResolvedValue(null),
  },
  writable: true,
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});

// Suppress console.error in tests unless explicitly testing error handling
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.('act(...)') || args[0]?.includes?.('Warning:')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});