import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve(process.cwd(), 'scripts/verify-data.mjs');

function runVerifier(files: string[]) {
  const cwd = mkdtempSync(join(tmpdir(), 'motivana-verify-data-'));

  try {
    for (const file of files) {
      const path = join(cwd, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, '{}');
    }

    return spawnSync(process.execPath, [scriptPath], {
      cwd,
      encoding: 'utf8',
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('accepts the Task 1 state where both catalogs are absent', () => {
  const result = runVerifier([]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('rejects a quotes-only catalog with the missing presets path', () => {
  const result = runVerifier(['assets/data/quotes.json']);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('missing assets/data/presets.json');
});

test('rejects a presets-only catalog with the missing quotes path', () => {
  const result = runVerifier(['assets/data/presets.json']);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('missing assets/data/quotes.json');
});

test('rejects both catalogs until Task 2 replaces bootstrap validation', () => {
  const result = runVerifier([
    'assets/data/quotes.json',
    'assets/data/presets.json',
  ]);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('must be replaced with full validation');
});
