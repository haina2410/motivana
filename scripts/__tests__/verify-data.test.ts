import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve(process.cwd(), 'scripts/verify-data.mjs');
const categories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
];
const presetIds = [
  'midnight-focus',
  'sunrise-drive',
  'forest-discipline',
  'violet-growth',
  'paper-confidence',
  'ocean-success',
  'ember-action',
  'mono-clarity',
];

const validPreset = {
  id: 'test-preset',
  name: 'Test preset',
  fontFamily: 'Inter',
  fontWeight: 'Regular',
  textAlign: 'center',
  quotePositionY: 0.45,
  textColor: '#FFFFFF',
  authorColor: '#FFFFFF',
  preferredFontSizeRatio: 0.064,
  minimumFontSizeRatio: 0.036,
  lineHeight: 1.2,
  background: { kind: 'solid', color: '#111827' },
};

function validQuotes() {
  return categories.flatMap((category) =>
    Array.from({ length: 20 }, (_, index) => ({
      id: `${category}-${String(index + 1).padStart(3, '0')}`,
      text:
        index === 0 && categories.indexOf(category) < 4
          ? 'A deliberate practice makes tomorrow more capable when you return to it with enough patience to notice what changed, what resisted, and what small adjustment can make the next effort clearer, calmer, and more useful than the last.'
          : `A deliberate ${category} practice makes tomorrow more capable.`,
      author: 'Motivana',
      category,
    })),
  );
}

function runVerifier(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'motivana-verify-data-'));

  try {
    for (const [file, contents] of Object.entries(files)) {
      const path = join(cwd, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    return spawnSync(process.execPath, [scriptPath], { cwd, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function serializedCatalogFiles() {
  return {
    'assets/data/quotes.json': JSON.stringify(validQuotes()),
    'assets/data/presets.json': JSON.stringify(
      Array.from({ length: 8 }, (_, index) => ({
        ...validPreset,
        id: presetIds[index],
        background: {
          kind: 'solid',
          color: `#1118${String(index).padStart(2, '0')}`,
        },
      })),
    ),
    'assets/fonts/Inter-Regular.ttf': 'test font',
  };
}

test('accepts valid catalog JSON and every referenced font asset', () => {
  const result = runVerifier(serializedCatalogFiles());

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('rejects malformed JSON with its catalog path', () => {
  const files = serializedCatalogFiles();
  files['assets/data/quotes.json'] = '{ definitely not JSON';

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('assets/data/quotes.json: invalid JSON');
});

test('rejects invalid preset ratios with a precise data path', () => {
  const files = serializedCatalogFiles();
  const invalidPresets = Array.from({ length: 8 }, (_, index) => ({
    ...validPreset,
    id: presetIds[index],
    preferredFontSizeRatio: 0.02,
    minimumFontSizeRatio: 0.04,
  }));
  files['assets/data/presets.json'] = JSON.stringify(invalidPresets);

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/data/presets.json: presets[0].minimumFontSizeRatio',
  );
});

test('rejects a missing font asset with its exact path', () => {
  const files: Record<string, string> = serializedCatalogFiles();
  delete files['assets/fonts/Inter-Regular.ttf'];

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('assets/fonts/Inter-Regular.ttf');
});
