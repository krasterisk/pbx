import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },
  {
    files: [
      'src/features/callcenter/**/*.{ts,tsx}',
      'src/features/cc-dashboard/**/*.{ts,tsx}',
      'src/pages/CallCenter*/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name=/^(button|select|input|textarea|label)$/]',
          message: 'Use @/shared/ui components (Button, Select, Input, Textarea, Label, Checkbox) instead of native HTML controls in Call Center features/pages (ARCHITECTURE.md).',
        },
        {
          selector: 'CallExpression[callee.object.name="window"][callee.property.name="confirm"]',
          message: 'Use Dialog from @/shared/ui instead of window.confirm (ARCHITECTURE.md).',
        },
      ],
    },
  },
);
