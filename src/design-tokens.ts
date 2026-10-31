/**
 * Design Tokens - Single Source of Truth for Record Book
 * All colors, spacing, typography, shadows, motion defined here.
 * Used by tailwind.config.ts and component library.
 */

export const tokens = {
  // ==========================================
  // COLOR SYSTEM
  // ==========================================
  color: {
    // Brand Colors (Indigo/Violet)
    brand: {
      25: '#fafaff',
      50: '#f0f4ff',
      100: '#e0e9ff',
      200: '#c7d7ff',
      300: '#a5b8ff',
      400: '#7c8fff',
      500: '#5a67f8',
      600: '#4338ca',
      700: '#3b2fc4',
      800: '#3128a3',
      900: '#2b2482',
      950: '#1e1858',
    },

    // Semantic Colors (WCAG AA compliant)
    semantic: {
      success: {
        light: '#10b981',
        DEFAULT: '#059669',
        dark: '#047857',
        bg: '#ecfdf5',
        border: '#a7f3d0',
        text: '#065f46',
      },
      warning: {
        light: '#f59e0b',
        DEFAULT: '#d97706',
        dark: '#b45309',
        bg: '#fffbeb',
        border: '#fde68a',
        text: '#92400e',
      },
      danger: {
        light: '#f43f5e',
        DEFAULT: '#ef4444',
        dark: '#dc2626',
        bg: '#fef2f2',
        border: '#fecaca',
        text: '#991b1b',
      },
      info: {
        light: '#3b82f6',
        DEFAULT: '#2563eb',
        dark: '#1d4ed8',
        bg: '#eff6ff',
        border: '#bfdbfe',
        text: '#1e40af',
      },
    },

    // Surface Colors (Light/Dark)
    surface: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },

    // Sphere Colors (Business/Personal/Family)
    sphere: {
      business: { light: '#4f46e5', DEFAULT: '#4338ca', dark: '#3730a3', bg: '#eef2ff', text: '#1e1b4b' },
      personal: { light: '#10b981', DEFAULT: '#059669', dark: '#047857', bg: '#ecfdf5', text: '#064e3b' },
      family: { light: '#f59e0b', DEFAULT: '#d97706', dark: '#b45309', bg: '#fffbeb', text: '#78350f' },
    },
  },

  // ==========================================
  // SPACING SYSTEM (4px base)
  // ==========================================
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
  },

  // ==========================================
  // BORDER RADIUS
  // ==========================================
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
  },

  // ==========================================
  // SHADOWS
  // ==========================================
  shadow: {
    none: 'none',
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    focus: '0 0 0 3px rgb(79 70 229 / 0.4)',
  },

  // ==========================================
  // TYPOGRAPHY
  // ==========================================
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
    },
  },

  // ==========================================
  // MOTION / ANIMATION
  // ==========================================
  motion: {
    duration: {
      instant: '50ms',
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },

  // ==========================================
  // Z-INDEX
  // ==========================================
  zIndex: {
    hide: -1,
    base: 0,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modalBackdrop: 400,
    modal: 500,
    popover: 600,
    tooltip: 700,
    toast: 800,
  },

  // ==========================================
  // BREAKPOINTS
  // ==========================================
  breakpoint: {
    xs: '320px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// ==========================================
// TYPE EXPORTS
// ==========================================
export type Tokens = typeof tokens;
export type ColorScale = keyof typeof tokens.color.brand;
export type Spacing = keyof typeof tokens.spacing;
export type Radius = keyof typeof tokens.radius;
export type Shadow = keyof typeof tokens.shadow;
export type FontSize = keyof typeof tokens.typography.fontSize;
export type FontWeight = keyof typeof tokens.typography.fontWeight;
export type Duration = keyof typeof tokens.motion.duration;
export type Easing = keyof typeof tokens.motion.easing;
export type ZIndex = keyof typeof tokens.zIndex;