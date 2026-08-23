import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const quoteCategories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
];
const fontPaths = {
  'Inter-Regular': 'assets/fonts/Inter-Regular.ttf',
  'Inter-SemiBold': 'assets/fonts/Inter-SemiBold.ttf',
  'Lora-Regular': 'assets/fonts/Lora-Regular.ttf',
  'Lora-SemiBold': 'assets/fonts/Lora-SemiBold.ttf',
  'Oswald-Medium': 'assets/fonts/Oswald-Medium.ttf',
};
const expectedPresetIds = [
  'midnight-focus',
  'sunrise-drive',
  'forest-discipline',
  'violet-growth',
  'paper-confidence',
  'ocean-success',
  'ember-action',
  'mono-clarity',
];

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    fail(path, 'missing file');
  }
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch {
    fail(path, 'invalid JSON');
  }
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function relativeLuminance(color) {
  const linear = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(Number.parseInt(color.slice(1, 3), 16)) +
    0.7152 * linear(Number.parseInt(color.slice(3, 5), 16)) +
    0.0722 * linear(Number.parseInt(color.slice(5, 7), 16))
  );
}

function meetsAaContrast(first, second) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05) >= 4.5;
}

function validateQuotes(quotes) {
  if (!Array.isArray(quotes)) {
    fail('assets/data/quotes.json', 'quotes must be an array');
  }
  if (quotes.length !== 120) {
    fail('assets/data/quotes.json', 'quotes must contain exactly 120 entries');
  }

  const ids = new Set();
  const categoryCounts = new Map(
    quoteCategories.map((category) => [category, 0]),
  );
  let stressCaseCount = 0;
  for (const [index, quote] of quotes.entries()) {
    const path = `assets/data/quotes.json: quotes[${index}]`;
    if (!isRecord(quote)) {
      fail(path, 'must be an object');
    }
    if (typeof quote.id !== 'string' || !/^[-a-z]+-\d{3}$/.test(quote.id)) {
      fail(`${path}.id`, 'must use a stable category-001 ID');
    }
    if (ids.has(quote.id)) {
      fail(`${path}.id`, 'must be unique');
    }
    ids.add(quote.id);
    if (typeof quote.text !== 'string' || quote.text.trim().length < 12) {
      fail(
        `${path}.text`,
        'must contain at least 12 non-whitespace characters',
      );
    }
    if (quote.text.length >= 200 && quote.text.length <= 280) {
      stressCaseCount += 1;
    }
    if (quote.author !== 'Motivana') {
      fail(`${path}.author`, 'must be Motivana for original catalog copy');
    }
    if (!quoteCategories.includes(quote.category)) {
      fail(`${path}.category`, 'is not supported');
    }
    const expectedId = `${quote.category}-${String(categoryCounts.get(quote.category) + 1).padStart(3, '0')}`;
    if (quote.id !== expectedId) {
      fail(`${path}.id`, `must be ${expectedId}`);
    }
    categoryCounts.set(quote.category, categoryCounts.get(quote.category) + 1);
  }
  for (const category of quoteCategories) {
    if (categoryCounts.get(category) !== 20) {
      fail(
        'assets/data/quotes.json',
        `${category} must contain exactly 20 entries`,
      );
    }
  }
  if (stressCaseCount < 4) {
    fail(
      'assets/data/quotes.json',
      'must contain at least four 200-280 character stress cases',
    );
  }
}

function validatePreset(preset, index) {
  const path = `assets/data/presets.json: presets[${index}]`;
  if (!isRecord(preset)) {
    fail(path, 'must be an object');
  }
  for (const field of ['id', 'name', 'fontFamily', 'fontWeight', 'textAlign']) {
    if (typeof preset[field] !== 'string' || preset[field].trim() === '') {
      fail(`${path}.${field}`, 'must be a non-empty string');
    }
  }
  const fontPath = fontPaths[`${preset.fontFamily}-${preset.fontWeight}`];
  if (!fontPath) {
    fail(`${path}.fontFamily/fontWeight`, 'must name a bundled font');
  }
  if (!['left', 'center', 'right'].includes(preset.textAlign)) {
    fail(`${path}.textAlign`, 'must be left, center, or right');
  }
  if (
    typeof preset.quotePositionY !== 'number' ||
    !Number.isFinite(preset.quotePositionY) ||
    preset.quotePositionY <= 0 ||
    preset.quotePositionY >= 1
  ) {
    fail(`${path}.quotePositionY`, 'must be between 0 and 1');
  }
  if (
    typeof preset.preferredFontSizeRatio !== 'number' ||
    !Number.isFinite(preset.preferredFontSizeRatio) ||
    preset.preferredFontSizeRatio <= 0 ||
    preset.preferredFontSizeRatio > 0.2
  ) {
    fail(
      `${path}.preferredFontSizeRatio`,
      'must be greater than 0 and at most 0.2',
    );
  }
  if (
    typeof preset.minimumFontSizeRatio !== 'number' ||
    !Number.isFinite(preset.minimumFontSizeRatio) ||
    preset.minimumFontSizeRatio <= 0 ||
    preset.minimumFontSizeRatio > preset.preferredFontSizeRatio
  ) {
    fail(
      `${path}.minimumFontSizeRatio`,
      'must be positive and no greater than preferredFontSizeRatio',
    );
  }
  if (
    typeof preset.lineHeight !== 'number' ||
    !Number.isFinite(preset.lineHeight) ||
    preset.lineHeight < 1 ||
    preset.lineHeight > 2
  ) {
    fail(`${path}.lineHeight`, 'must be between 1 and 2');
  }
  for (const field of ['textColor', 'authorColor']) {
    if (!isHexColor(preset[field])) {
      fail(`${path}.${field}`, 'must be a #RRGGBB color');
    }
  }
  if (preset.overlay !== undefined && !isHexColor(preset.overlay)) {
    fail(`${path}.overlay`, 'must be a #RRGGBB color');
  }
  if (!isRecord(preset.background)) {
    fail(`${path}.background`, 'must be an object');
  }
  let backgroundColors;
  if (preset.background.kind === 'solid') {
    if (!isHexColor(preset.background.color)) {
      fail(`${path}.background.color`, 'must be a #RRGGBB color');
    }
    backgroundColors = [preset.background.color];
  } else if (preset.background.kind === 'linear-gradient') {
    if (!isHexColor(preset.background.startColor)) {
      fail(`${path}.background.startColor`, 'must be a #RRGGBB color');
    }
    if (!isHexColor(preset.background.endColor)) {
      fail(`${path}.background.endColor`, 'must be a #RRGGBB color');
    }
    if (
      typeof preset.background.angleDegrees !== 'number' ||
      !Number.isFinite(preset.background.angleDegrees) ||
      preset.background.angleDegrees < 0 ||
      preset.background.angleDegrees > 360
    ) {
      fail(`${path}.background.angleDegrees`, 'must be between 0 and 360');
    }
    backgroundColors = [
      preset.background.startColor,
      preset.background.endColor,
    ];
  } else {
    fail(`${path}.background.kind`, 'must be solid or linear-gradient');
  }
  if (
    !backgroundColors.every((color) => meetsAaContrast(preset.textColor, color))
  ) {
    fail(`${path}.textColor`, 'must meet WCAG AA contrast');
  }
  return fontPath;
}

function validatePresets(presets) {
  if (!Array.isArray(presets)) {
    fail('assets/data/presets.json', 'presets must be an array');
  }
  if (presets.length !== 8) {
    fail('assets/data/presets.json', 'presets must contain exactly 8 entries');
  }
  const ids = new Set();
  const backgrounds = new Set();
  const referencedFonts = new Set();
  for (const [index, preset] of presets.entries()) {
    const fontPath = validatePreset(preset, index);
    if (ids.has(preset.id)) {
      fail(`assets/data/presets.json: presets[${index}].id`, 'must be unique');
    }
    ids.add(preset.id);
    const background = JSON.stringify(preset.background);
    if (backgrounds.has(background)) {
      fail(
        `assets/data/presets.json: presets[${index}].background`,
        'must be visually distinct',
      );
    }
    backgrounds.add(background);
    referencedFonts.add(fontPath);
  }
  if (expectedPresetIds.some((id) => !ids.has(id))) {
    fail('assets/data/presets.json', 'must contain all stable preset IDs');
  }
  return referencedFonts;
}

function validateTrueTypeFont(path, font) {
  if (font.length < 4 || font.readUInt32BE(0) !== 0x00010000) {
    fail(path, 'invalid TrueType SFNT signature');
  }
  if (font.length < 12) {
    fail(path, 'malformed SFNT header');
  }

  const tableCount = font.readUInt16BE(4);
  const directoryEnd = 12 + tableCount * 16;
  const largestPowerOfTwo = 2 ** Math.floor(Math.log2(tableCount));
  const searchRange = font.readUInt16BE(6);
  const entrySelector = font.readUInt16BE(8);
  const rangeShift = font.readUInt16BE(10);
  if (
    tableCount === 0 ||
    tableCount > 256 ||
    directoryEnd > font.length ||
    searchRange !== largestPowerOfTwo * 16 ||
    entrySelector !== Math.log2(largestPowerOfTwo) ||
    rangeShift !== tableCount * 16 - searchRange
  ) {
    fail(path, 'malformed SFNT table directory');
  }

  const tableRecords = new Map();
  for (let index = 0; index < tableCount; index += 1) {
    const entryOffset = 12 + index * 16;
    const tag = font.toString('latin1', entryOffset, entryOffset + 4);
    const tableOffset = font.readUInt32BE(entryOffset + 8);
    const tableLength = font.readUInt32BE(entryOffset + 12);
    if (!/^[ -~]{4}$/.test(tag) || tableRecords.has(tag)) {
      fail(path, 'malformed SFNT table directory');
    }
    if (
      tableLength === 0 ||
      tableOffset < directoryEnd ||
      tableOffset > font.length ||
      tableLength > font.length - tableOffset
    ) {
      fail(path, 'SFNT table data lies outside file bounds');
    }
    tableRecords.set(tag, { offset: tableOffset, length: tableLength });
  }

  for (const table of [
    'OS/2',
    'cmap',
    'glyf',
    'head',
    'hhea',
    'hmtx',
    'loca',
    'maxp',
    'name',
    'post',
  ]) {
    if (!tableRecords.has(table)) {
      fail(path, `missing essential TrueType table ${table}`);
    }
  }

  const head = tableRecords.get('head');
  if (head.length < 16 || font.readUInt32BE(head.offset + 12) !== 0x5f0f3cf5) {
    fail(path, 'invalid TrueType head table');
  }
}

try {
  const quotes = parseJson('assets/data/quotes.json');
  const presets = parseJson('assets/data/presets.json');
  validateQuotes(quotes);
  const referencedFonts = validatePresets(presets);
  for (const fontPath of referencedFonts) {
    const absolutePath = resolve(fontPath);
    if (!existsSync(absolutePath)) {
      fail(fontPath, 'missing referenced font asset');
    }
    validateTrueTypeFont(fontPath, readFileSync(absolutePath));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
