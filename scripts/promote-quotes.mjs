#!/usr/bin/env node
// Moves reviewed quote candidates into assets/data/quotes.json.
//
// The staging file is the only place a harvest may write. This script is the
// only thing that may write the catalogue, so the contract in
// .claude/skills/sourcing-quotes/SKILL.md is enforced here rather than trusted:
// a batch that approves more than half of its candidates is refused.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const categories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
];
const maximumApprovedShare = 0.5;
const provenancePath = 'docs/quote-candidates/provenance.json';

const [, , stagingArgument, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');
// Quotes the product owner hands over are already chosen, so the cull ceiling
// does not apply to them. Every other rule still does.
const ownerSupplied = flags.includes('--owner-supplied');
const retireFlag = flags.find((flag) => flag.startsWith('--retire-filler='));
const retainFiller = retireFlag
  ? Number.parseInt(retireFlag.split('=')[1] ?? '', 10)
  : undefined;
if (stagingArgument === undefined) {
  fail(
    'usage: node scripts/promote-quotes.mjs <staging-file.json> [--dry-run] [--retire-filler=<per category>] [--owner-supplied]',
  );
}
if (retireFlag && !(Number.isInteger(retainFiller) && retainFiller >= 0)) {
  fail('--retire-filler needs a whole number of entries to keep per category');
}
// The same floor as scripts/verify-data.mjs, so a retire that would break the
// gate fails here with a message about filler instead of there about counts.
const minimumQuotesPerCategory = 6;

function fail(message) {
  console.error(`promote-quotes: ${message}`);
  process.exit(1);
}

function readJson(path) {
  if (!existsSync(resolve(path))) fail(`${path} does not exist`);
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
}

const staging = readJson(stagingArgument);
const candidates = Array.isArray(staging) ? staging : staging.candidates;
if (!Array.isArray(candidates) || candidates.length === 0) {
  fail('the staging file has no candidates array');
}

const verdicts = candidates.filter((candidate) => candidate.review?.verdict);
if (verdicts.length !== candidates.length) {
  fail(
    `${candidates.length - verdicts.length} candidates carry no review verdict: run the review step first`,
  );
}
const approved = candidates.filter(
  (candidate) => candidate.review.verdict === 'approve',
);
if (approved.length === 0) fail('no candidate was approved');

// The contract, checked instead of documented.
if (
  !ownerSupplied &&
  approved.length > candidates.length * maximumApprovedShare
) {
  fail(
    `approved ${approved.length} of ${candidates.length} candidates, over the half ceiling: cull further or harvest more candidates`,
  );
}

for (const [index, candidate] of approved.entries()) {
  const where = `approved[${index}]`;
  const category = candidate.review.category ?? candidate.category;
  if (!categories.includes(category)) {
    fail(`${where} has no supported category`);
  }
  if (!['en', 'vi'].includes(candidate.sourceLocale)) {
    fail(`${where}.sourceLocale must be en or vi`);
  }
  if (candidate.text?.[candidate.sourceLocale] === undefined) {
    fail(`${where} has no text for its source locale`);
  }
  for (const [locale, text] of Object.entries(candidate.text ?? {})) {
    if (!['en', 'vi'].includes(locale)) {
      fail(`${where}.text.${locale} is not a supported locale`);
    }
    if (
      typeof text !== 'string' ||
      text.trim().length < 12 ||
      text.length > 160
    ) {
      fail(`${where}.text.${locale} must hold 12 to 160 characters`);
    }
    if (text.normalize('NFC') !== text) {
      fail(`${where}.text.${locale} is not NFC normalised`);
    }
  }
  if (
    candidate.author !== undefined &&
    (typeof candidate.author !== 'string' || candidate.author.trim() === '')
  ) {
    fail(`${where}.author must be a non-empty string when present`);
  }
  const provenance = candidate.provenance;
  if (!provenance?.verification) {
    fail(`${where} has no provenance.verification`);
  }
  // An owner-supplied quote has no URL to cite, so it names the person who
  // handed it over instead. Nothing may reach the catalogue with neither.
  if (provenance.sourceKind === 'owner-supplied') {
    if (!provenance.providedBy) {
      fail(`${where} is owner-supplied but names no provenance.providedBy`);
    }
  } else if (!provenance.sourceUrl) {
    fail(`${where} has no provenance.sourceUrl`);
  }
  if (provenance.verification === 'weak') {
    fail(`${where} is verified only weakly: reject it instead of promoting it`);
  }
  candidate.review.category = category;
}

function provenanceKey(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const catalogue = readJson('assets/data/quotes.json');
const existing = new Set(
  catalogue.flatMap((quote) => Object.values(quote.text)),
);
for (const candidate of approved) {
  for (const text of Object.values(candidate.text)) {
    if (existing.has(text)) fail(`the catalogue already ships: ${text}`);
  }
}

// Append each approved quote to the end of its category block, then renumber
// every ID: verify-data.mjs reads the IDs in array order and expects
// category-001..N with no gap.
const provenanceRecords = existsSync(resolve(provenancePath))
  ? readJson(provenancePath)
  : {};
for (const candidate of approved) {
  const source = candidate.text[candidate.sourceLocale];
  // Keyed by the source text, because a later harvest renumbers every ID.
  provenanceRecords[provenanceKey(source)] = {
    text: source,
    author: candidate.author ?? null,
    category: candidate.review.category,
    ...candidate.provenance,
    reviewedReason: candidate.review.reason ?? null,
    promotedFrom: stagingArgument,
  };
}

// Filler is app-written copy: an entry with no provenance record. A sourced
// quote can never be retired, whatever the flag asks for.
function isFiller(quote) {
  return (
    provenanceRecords[provenanceKey(quote.text[quote.sourceLocale])] ===
    undefined
  );
}

const retired = [];
function keptInCategory(category) {
  const inCategory = catalogue.filter((quote) => quote.category === category);
  if (retainFiller === undefined) return inCategory;
  const filler = inCategory.filter(isFiller);
  if (filler.length <= retainFiller) return inCategory;
  // Vietnamese filler is kept first, so a retire does not leave a category
  // English-only.
  const keep = new Set(
    [...filler]
      .sort(
        (first, second) =>
          Number(second.text.vi !== undefined) -
          Number(first.text.vi !== undefined),
      )
      .slice(0, retainFiller),
  );
  const dropped = filler.filter((quote) => !keep.has(quote));
  retired.push(...dropped);
  return inCategory.filter((quote) => !dropped.includes(quote));
}

const merged = [];
for (const category of categories) {
  merged.push(
    ...keptInCategory(category),
    ...approved
      .filter((candidate) => candidate.review.category === category)
      .map((candidate) => ({
        id: 'pending',
        category,
        sourceLocale: candidate.sourceLocale,
        ...(candidate.author ? { author: candidate.author } : {}),
        text: candidate.text,
      })),
  );
}
const counts = new Map(categories.map((category) => [category, 0]));
const renumbered = merged.map((quote) => {
  const next = counts.get(quote.category) + 1;
  counts.set(quote.category, next);
  const { id: _ignored, category, sourceLocale, author, text } = quote;
  return {
    id: `${category}-${String(next).padStart(3, '0')}`,
    category,
    sourceLocale,
    ...(author ? { author } : {}),
    text,
  };
});

// Only a retire can push a category under its floor, so only a retire is
// checked here. Then the message names filler instead of a count.
for (const category of retainFiller === undefined ? [] : categories) {
  const inCategory = renumbered.filter((quote) => quote.category === category);
  if (inCategory.length < minimumQuotesPerCategory) {
    fail(
      `${category} would hold ${inCategory.length} quotes, under the floor of ${minimumQuotesPerCategory}: retire less filler or harvest more`,
    );
  }
}

const report = [
  `candidates ${candidates.length}`,
  `approved ${approved.length}`,
  // Reported, not gated: nothing enforces a Vietnamese share any more.
  `vietnamese ${approved.filter((candidate) => typeof candidate.text?.vi === 'string').length}/${approved.length}`,
  `retired filler ${retired.length}`,
  `catalogue ${catalogue.length} -> ${renumbered.length}`,
];
for (const category of categories) {
  report.push(`  ${category}: ${counts.get(category)}`);
}
console.log(report.join('\n'));

if (dryRun) {
  console.log('dry run: nothing written');
  process.exit(0);
}
writeFileSync(
  resolve('assets/data/quotes.json'),
  `${JSON.stringify(renumbered, null, 2)}\n`,
);
mkdirSync(dirname(resolve(provenancePath)), { recursive: true });
writeFileSync(
  resolve(provenancePath),
  `${JSON.stringify(provenanceRecords, null, 2)}\n`,
);
console.log(
  `written. next: pnpm verify:data && pnpm test\nprovenance: ${provenancePath}`,
);
