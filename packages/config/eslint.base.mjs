import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint base for every workspace. Packages spread this array and
 * append their own overrides (e.g. Next.js config in apps/web).
 */
export default tseslint.config(
  {
    ignores: ['dist/**', '.next/**', 'drizzle/**', 'coverage/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);
