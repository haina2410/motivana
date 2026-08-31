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
  'sunrise-drive',
  'violet-growth',
  'paper-confidence',
  'mono-clarity',
];
const presetFonts = [
  { fontFamily: 'CormorantGaramond', fontWeight: 'Light' },
  { fontFamily: 'CormorantGaramond', fontWeight: 'Regular' },
  { fontFamily: 'BeVietnamPro', fontWeight: 'Light' },
  { fontFamily: 'DancingScript', fontWeight: 'Medium' },
  { fontFamily: 'Lora', fontWeight: 'Regular' },
  { fontFamily: 'Lora', fontWeight: 'SemiBold' },
];

const validPreset = {
  id: 'test-preset',
  name: 'Test preset',
  fontFamily: 'CormorantGaramond',
  fontWeight: 'Light',
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
        ...(index < 5
          ? { vi: `Một sự luyện tập ${category} kiên trì mỗi ngày.` }
          : {}),
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

const backgroundIds = ['sky-01', 'mountain-01'];

function plainPresets() {
  return Array.from({ length: presetIds.length }, (_, index) => ({
    ...validPreset,
    id: presetIds[index],
    ...presetFonts[index % presetFonts.length],
    background: {
      kind: 'solid',
      color: `#1118${String(index).padStart(2, '0')}`,
    },
  }));
}

function serializedCatalogFiles(): Record<string, string | Buffer> {
  return {
    'assets/data/quotes.json': JSON.stringify(validQuotes()),
    // One file, both kinds of entry: the four plain presets first, then the
    // photographs, exactly as the shipped catalogue is laid out.
    'assets/data/backgrounds.json': JSON.stringify([
      ...plainPresets(),
      ...backgroundIds.map((id) => ({
        ...validPreset,
        id,
        category: id.split('-')[0],
        background: {
          kind: 'image',
          asset: `backgrounds/${id}.webp`,
          scrimColor: '#000000',
          scrimOpacity: 0.45,
          effectiveLuminance: 0.25,
        },
      })),
    ]),
    // The verifier only checks that the pair of files exists, so a stand-in
    // byte keeps the fixture from carrying two real photographs.
    ...Object.fromEntries(
      backgroundIds.flatMap((id) => [
        [`assets/images/backgrounds/${id}.webp`, Buffer.from([0])],
        [`assets/images/backgrounds/thumbs/${id}.webp`, Buffer.from([0])],
      ]),
    ),
    ...Object.fromEntries(
      [
        'CormorantGaramond-Light',
        'CormorantGaramond-Regular',
        'BeVietnamPro-Light',
        'DancingScript-Medium',
        'Lora-Regular',
        'Lora-SemiBold',
      ].map((font) => [
        `assets/fonts/${font}.ttf`,
        readFileSync(resolve(process.cwd(), `assets/fonts/${font}.ttf`)),
      ]),
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
  files['assets/fonts/CormorantGaramond-Light.ttf'] = 'test font';

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/CormorantGaramond-Light.ttf: invalid TrueType SFNT signature',
  );
});

test('rejects a truncated SFNT table directory with the exact font path', () => {
  const files = serializedCatalogFiles();
  files['assets/fonts/CormorantGaramond-Light.ttf'] = readFileSync(
    resolve(process.cwd(), 'assets/fonts/CormorantGaramond-Light.ttf'),
  ).subarray(0, 20);

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/CormorantGaramond-Light.ttf: malformed SFNT table directory',
  );
});

test('rejects an SFNT table whose data range lies outside the font file', () => {
  const files = serializedCatalogFiles();
  const corruptedFont = Buffer.from(
    readFileSync(
      resolve(process.cwd(), 'assets/fonts/CormorantGaramond-Light.ttf'),
    ),
  );
  corruptedFont.writeUInt32BE(corruptedFont.length, 20);
  files['assets/fonts/CormorantGaramond-Light.ttf'] = corruptedFont;

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/CormorantGaramond-Light.ttf: SFNT table data lies outside file bounds',
  );
});

test('rejects a corrupted head table inside an otherwise in-bounds SFNT', () => {
  const files = serializedCatalogFiles();
  const corruptedFont = Buffer.from(
    readFileSync(
      resolve(process.cwd(), 'assets/fonts/CormorantGaramond-Light.ttf'),
    ),
  );
  corruptedFont.writeUInt32BE(0, getTableOffset(corruptedFont, 'head') + 12);
  files['assets/fonts/CormorantGaramond-Light.ttf'] = corruptedFont;

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/fonts/CormorantGaramond-Light.ttf: invalid TrueType head table',
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
  files['assets/data/backgrounds.json'] = JSON.stringify(
    plainPresets().map((preset) => ({
      ...preset,
      preferredFontSizeRatio: 0.02,
      minimumFontSizeRatio: 0.04,
    })),
  );

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'assets/data/backgrounds.json: templates[0].minimumFontSizeRatio',
  );
});

/**
 * presetRepository.ts splits the picker's "Plain" filter on the category alone,
 * so a photograph that lost its category would join the four presets and be
 * offered as a colour swatch that renders a photograph.
 */
test('rejects a photograph that carries no category', () => {
  const files = serializedCatalogFiles();
  const templates = JSON.parse(String(files['assets/data/backgrounds.json']));
  delete templates[presetIds.length].category;
  files['assets/data/backgrounds.json'] = JSON.stringify(templates);

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    `assets/data/backgrounds.json: templates[${presetIds.length}].category`,
  );
});

test('rejects a plain preset that carries a category', () => {
  const files = serializedCatalogFiles();
  const templates = JSON.parse(String(files['assets/data/backgrounds.json']));
  templates[0].category = 'sky';
  files['assets/data/backgrounds.json'] = JSON.stringify(templates);

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('must carry no category');
});

test('rejects a missing font asset with its exact path', () => {
  const files: Record<string, string | Buffer> = serializedCatalogFiles();
  delete files['assets/fonts/CormorantGaramond-Light.ttf'];

  const result = runVerifier(files);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('assets/fonts/CormorantGaramond-Light.ttf');
});
