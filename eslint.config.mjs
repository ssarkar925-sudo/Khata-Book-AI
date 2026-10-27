import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'android/**',
      'dist/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
  ...tseslint.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@next/next/no-img-element': 'warn',
    },
  },
];
