import { rmSync } from 'node:fs';

/** Removes the throwaway e2e database (its WAL files and the API log). */
export default function globalTeardown() {
  const path = process.env.E2E_DB_PATH;
  if (!path) return;
  for (const suffix of ['', '-wal', '-shm', '.log']) rmSync(`${path}${suffix}`, { force: true });
}
