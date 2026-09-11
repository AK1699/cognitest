import { resolve } from 'node:path';

/**
 * Loads a .env file if one exists, checking the package dir first and then the
 * repo root (scripts always run with cwd = apps/api). Uses Node's built-in
 * loader, which never overrides variables already present in the environment,
 * so CI-provided values win. Missing files are fine — every variable has a
 * local-dev default in the env schema.
 */
export function loadEnv(): void {
  for (const candidate of ['.env', '../../.env']) {
    try {
      process.loadEnvFile(resolve(process.cwd(), candidate));
      return;
    } catch {
      // no .env at this location — keep looking
    }
  }
}
