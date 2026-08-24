import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
const presetFonts = [
  { fontFamily: 'Inter', fontWeight: 'Regular' },
  { fontFamily: 'Inter', fontWeight: 'SemiBold' },
  { fontFamily: 'Lora', fontWeight: 'Regular' },
  { fontFamily: 'Lora', fontWeight: 'SemiBold' },
  { fontFamily: 'Oswald', fontWeight: 'Medium' },
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
      category,
      sourceLocale: 'en',
      text: {
        en:
          index === 0 && categories.indexOf(category) < 4
            ? 'A deliberate practice makes tomorrow more capable when you return to it with enough patience to notice what changed and adjust with care.'
            : `A deliberate ${category} practice makes tomorrow more capable.`,
      },
      author: 'Motivana',
    })),
  );
}

function runVerifier(files: Record<string, string | Buffer>) {
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

function serializedCatalogFiles(): Record<string, string | Buffer> {
  return {
    'assets/data/quotes.json': JSON.stringify(validQuotes()),
    'assets/data/presets.json': JSON.stringify(
      Array.from({ length: 8 }, (_, index) => ({
        ...validPreset,
        id: presetIds[index],
        ...presetFonts[index % presetFonts.length],
        background: {
          kind: 'solid',
          color: `#1118${String(index).padStart(2, '0')}`,
        },
      })),
    ),
    'assets/fonts/Inter-Regular.ttf': readFileSync(
      resolve(process.cwd(), 'assets/fonts/Inter-Regular.ttf'),
    ),
    'assets/fonts/Inter-SemiBold.ttf': readFileSync(
      resolve(process.cwd(), 'assets/fonts/Inter-SemiBold.ttf'),
    ),
    'assets/fonts/Lora-Regular.ttf': readFileSync(
      resolve(process.cwd(), 'assets/fonts/Lora-Regular.ttf'),
    ),
    'assets/fonts/Lora-SemiBold.ttf': readFileSync(
      resolve(process.cwd(), 'assets/fonts/Lora-SemiBold.ttf'),
    ),
    'assets/fonts/Oswald-Medium.ttf': readFileSync(
      resolve(process.cwd(), 'assets/fonts/Oswald-Medium.ttf'),
    ),
  };
}

function getTableOffset(font: Buffer, expectedTag: string): number {
  const tableCount = font.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const entryOffset = 12 + index * 16;
    if (font.toString('latin1', entryOffset, entryOffset + 4) === expectedTag) {
      return font.readUInt32BE(entryOffset + 8);
    }
  }
  throw new Error(`Expected ${expectedTag} table`);
}

test('accepts valid catalog JSON and every referenced font asset', () => {
  const result = runVerifier(serializedCatalogFiles());

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

test('rejects non-font bytes with the exact referenced font path', () => {
  const files = serializedCatalogFiles();
  files['assets/fonts/Inter-Regular.ttf'] = 'test font';

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/Inter-Regular.ttf: invalid TrueType SFNT signature',
  );
});

test('rejects a truncated SFNT table directory with the exact font path', () => {
  const files = serializedCatalogFiles();
  files['assets/fonts/Inter-Regular.ttf'] = readFileSync(
    resolve(process.cwd(), 'assets/fonts/Inter-Regular.ttf'),
  ).subarray(0, 20);

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/Inter-Regular.ttf: malformed SFNT table directory',
  );
});

test('rejects an SFNT table whose data range lies outside the font file', () => {
  const files = serializedCatalogFiles();
  const corruptedFont = Buffer.from(
    readFileSync(resolve(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
  );
  corruptedFont.writeUInt32BE(corruptedFont.length, 20);
  files['assets/fonts/Inter-Regular.ttf'] = corruptedFont;

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/Inter-Regular.ttf: SFNT table data lies outside file bounds',
  );
});

test('rejects a corrupted head table inside an otherwise in-bounds SFNT', () => {
  const files = serializedCatalogFiles();
  const corruptedFont = Buffer.from(
    readFileSync(resolve(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
  );
  corruptedFont.writeUInt32BE(0, getTableOffset(corruptedFont, 'head') + 12);
  files['assets/fonts/Inter-Regular.ttf'] = corruptedFont;

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/Inter-Regular.ttf: invalid TrueType head table',
  );
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
  const files: Record<string, string | Buffer> = serializedCatalogFiles();
  delete files['assets/fonts/Inter-Regular.ttf'];

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('assets/fonts/Inter-Regular.ttf');
});
