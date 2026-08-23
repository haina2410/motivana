import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const quotesPath = resolve('assets/data/quotes.json');
const presetsPath = resolve('assets/data/presets.json');
const quotesExist = existsSync(quotesPath);
const presetsExist = existsSync(presetsPath);

if (!quotesExist && !presetsExist) {
  process.exit(0);
}

if (quotesExist !== presetsExist) {
  const missingPath = quotesExist
    ? 'assets/data/presets.json'
    : 'assets/data/quotes.json';
  console.error(`Catalog bootstrap is incomplete: missing ${missingPath}.`);
  process.exit(1);
}

console.error(
  'Catalog bootstrap verifier must be replaced with full validation before committing authoritative data.',
);
process.exit(1);
