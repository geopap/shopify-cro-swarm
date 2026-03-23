import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod/v4';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

type Subdirectory = 'snapshots' | 'analyses' | 'hypotheses' | 'verifications';

/** Get the full path for a date-stamped JSON file. */
export function getPath(subdir: Subdirectory, date: string): string {
  return join(DATA_DIR, subdir, `${date}.json`);
}

/** Get the full path for a root-level data file. */
export function getRootPath(filename: string): string {
  return join(DATA_DIR, filename);
}

/** Write a validated JSON object to a date-stamped file. */
export function writeSnapshot<T>(
  subdir: Subdirectory,
  date: string,
  data: T,
  schema?: ZodType<T>,
): void {
  if (schema) {
    schema.parse(data);
  }
  const path = getPath(subdir, date);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Read and optionally validate a date-stamped JSON file. */
export function readSnapshot<T>(
  subdir: Subdirectory,
  date: string,
  schema?: ZodType<T>,
): T | null {
  const path = getPath(subdir, date);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  if (schema) return schema.parse(raw);
  return raw as T;
}

/** Write a root-level data file (e.g., baselines.json, experiment-log.json). */
export function writeRootFile<T>(
  filename: string,
  data: T,
  schema?: ZodType<T>,
): void {
  if (schema) {
    schema.parse(data);
  }
  const path = getRootPath(filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Read a root-level data file. */
export function readRootFile<T>(
  filename: string,
  schema?: ZodType<T>,
): T | null {
  const path = getRootPath(filename);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  if (schema) return schema.parse(raw);
  return raw as T;
}

/** List all date-stamped files in a subdirectory, sorted newest first. */
export function listDates(subdir: Subdirectory): string[] {
  const dir = join(DATA_DIR, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort()
    .reverse();
}

/** Get the N most recent snapshots. */
export function recentSnapshots<T>(
  subdir: Subdirectory,
  count: number,
  schema?: ZodType<T>,
): T[] {
  const dates = listDates(subdir).slice(0, count);
  return dates
    .map((date) => readSnapshot<T>(subdir, date, schema))
    .filter((s): s is T => s !== null);
}
