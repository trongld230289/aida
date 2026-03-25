// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // ── Global ignores ──────────────────────────────────────────────────────
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'scripts/chatbot/templates/**',
            'scripts/dependency/views/**',
            'scripts/__tests__/**',
            'scripts/__mocks__/**',
            'vitest.config.ts',
            '*.js',
            '*.mjs',
        ],
    },

    // ── Base: recommended type-checked rules ────────────────────────────────
    ...tseslint.configs.recommendedTypeChecked,

    // ── Project-wide settings ───────────────────────────────────────────────
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // ── Custom rule overrides ───────────────────────────────────────────────
    {
        rules: {
            // — Phase 6 strictness targets —

            // Warn on remaining `any` usage (11 intentional — will reduce over time)
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',

            // Catch unhandled promises
            '@typescript-eslint/no-floating-promises': 'error',

            // Allow require() — 9 intentional uses remain (dynamic, optional, circular)
            '@typescript-eslint/no-require-imports': 'off',

            // Allow unused vars with _ prefix (convention for intentionally unused)
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],

            // Relax for existing codebase patterns
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/no-base-to-string': 'warn',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/no-misused-promises': ['error', {
                checksVoidReturn: false,  // Allow async in void callbacks (common in VS Code API)
            }],

            // Disable rules that conflict with our index-signature-heavy codebase
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'warn',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/unbound-method': 'off',

            // Conflicts with noUncheckedIndexedAccess / exactOptionalPropertyTypes
            // — ESLint's type analysis considers some assertions redundant that tsc actually requires
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        },
    },
);
