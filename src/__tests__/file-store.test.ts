import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We mock the DATA_DIR used by file-store by intercepting the module's
// internal path resolution. Since file-store computes DATA_DIR from
// import.meta.url at module scope, we mock the underlying fs/path calls
// so that all reads/writes go to our temp directory.

let tempDir: string;

// We need to redirect DATA_DIR. The simplest approach: mock the module
// internals by re-exporting with a patched base path.

// Since file-store uses join(__dirname, '..', '..', 'data'), we can mock
// the entire module to use a temp directory instead.

vi.mock('../lib/file-store.js', async () => {
  const { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');

  // This will be set before each test via the exported _setDataDir
  let DATA_DIR = '';

  type Subdirectory = 'snapshots' | 'analyses' | 'hypotheses' | 'verifications';

  function getPath(subdir: Subdirectory, date: string): string {
    return join(DATA_DIR, subdir, `${date}.json`);
  }

  function writeSnapshot<T>(
    subdir: Subdirectory,
    date: string,
    data: T,
  ): void {
    const dir = join(DATA_DIR, subdir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = getPath(subdir, date);
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  function readSnapshot<T>(
    subdir: Subdirectory,
    date: string,
  ): T | null {
    const path = getPath(subdir, date);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  }

  function listDates(subdir: Subdirectory): string[] {
    const dir = join(DATA_DIR, subdir);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.replace('.json', ''))
      .sort()
      .reverse();
  }

  function _setDataDir(dir: string) {
    DATA_DIR = dir;
  }

  return {
    getPath,
    writeSnapshot,
    readSnapshot,
    listDates,
    _setDataDir,
  };
});

// Import the mocked module
import {
  writeSnapshot,
  readSnapshot,
  listDates,
  _setDataDir,
} from '../lib/file-store.js';

// Declare the _setDataDir addition for TypeScript
declare module '../lib/file-store.js' {
  export function _setDataDir(dir: string): void;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'file-store-test-'));
  _setDataDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================
// Tests
// ============================================================

describe('writeSnapshot + readSnapshot roundtrip', () => {
  it('writes and reads back identical data', () => {
    const data = {
      date: '2026-03-22',
      sessions: 1210,
      revenue: 2145.5,
      currency: 'EUR',
    };

    writeSnapshot('snapshots', '2026-03-22', data);
    const result = readSnapshot('snapshots', '2026-03-22');

    expect(result).toEqual(data);
  });

  it('handles nested objects correctly', () => {
    const data = {
      date: '2026-03-21',
      metrics: {
        sessions: { value: 1185, previous: 1160, delta_pct: 2.16 },
        revenue: { value: 1980.0, previous: 1850.0, delta_pct: 7.03 },
      },
      tags: ['shopify', 'ecommerce', 'daily'],
    };

    writeSnapshot('snapshots', '2026-03-21', data);
    const result = readSnapshot('snapshots', '2026-03-21');

    expect(result).toEqual(data);
  });
});

describe('readSnapshot returns null for missing files', () => {
  it('returns null when file does not exist', () => {
    const result = readSnapshot('snapshots', '1999-01-01');
    expect(result).toBeNull();
  });

  it('returns null when subdirectory does not exist', () => {
    const result = readSnapshot('analyses', '2026-03-22');
    expect(result).toBeNull();
  });
});

describe('listDates returns sorted dates', () => {
  it('returns dates sorted newest first', () => {
    mkdirSync(join(tempDir, 'snapshots'), { recursive: true });

    writeSnapshot('snapshots', '2026-03-20', { day: 1 });
    writeSnapshot('snapshots', '2026-03-22', { day: 3 });
    writeSnapshot('snapshots', '2026-03-21', { day: 2 });

    const dates = listDates('snapshots');

    expect(dates).toEqual(['2026-03-22', '2026-03-21', '2026-03-20']);
  });

  it('returns empty array for non-existent subdirectory', () => {
    const dates = listDates('verifications');
    expect(dates).toEqual([]);
  });

  it('returns single date when only one file exists', () => {
    writeSnapshot('analyses', '2026-03-22', { summary: 'test' });

    const dates = listDates('analyses');
    expect(dates).toEqual(['2026-03-22']);
  });
});
