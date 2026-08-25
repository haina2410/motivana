import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptPath = resolve(process.cwd(), 'scripts/promote-quotes.mjs');

interface Quote {
  id: string;
  category: string;
  sourceLocale: string;
  author?: string;
  text: { en?: string; vi?: string };
}
const categories = [
  'motivation',
  'discipline',
  'focus',
  'confidence',
  'growth',
  'success',
];

/**
 * A small but shaped catalogue: six app-written entries per category, five of
 * them bilingual, IDs already sequential. None carries provenance, so all of it
 * counts as filler.
 */
function catalogue(perCategory = 6) {
  return categories.flatMap((category) =>
    Array.from({ length: perCategory }, (_, index) => ({
      id: `${category}-${String(index + 1).padStart(3, '0')}`,
      category,
      sourceLocale: 'en',
      text: {
        en: `A deliberate ${category} practice number ${index + 1}.`,
        ...(index < 5
          ? { vi: `Một sự luyện tập ${category} số ${index + 1}.` }
          : {}),
      } as {
        en: string;
        vi?: string;
      },
    })),
  );
}

interface CandidateOptions {
  vi?: string;
  en?: string;
  category?: string;
  verdict?: 'approve' | 'reject';
  verification?: string;
  author?: string;
  withReview?: boolean;
}

function candidate({
  vi = 'Có công mài sắt, có ngày nên kim.',
  en = 'Grind the iron long enough and you get a needle.',
  category = 'discipline',
  verdict = 'approve',
  verification = 'grep-primary',
  author,
  withReview = true,
}: CandidateOptions = {}) {
  return {
    text: { ...(vi ? { vi } : {}), ...(en ? { en } : {}) },
    sourceLocale: vi ? 'vi' : 'en',
    category,
    ...(author ? { author } : {}),
    provenance: {
      sourceUrl: 'https://vi.wikisource.org/wiki/example',
      sourceKind: 'primary-text',
      citation: 'example',
      verification,
      rights: 'folk-anonymous',
      englishRendering: 'ours',
      edit: 'none',
    },
    ...(withReview
      ? { review: { verdict, reason: 'checked at the source', category } }
      : {}),
  };
}

function runPromoter(
  candidates: unknown[],
  flags: string[] = [],
  files: Record<string, string> = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), 'motivana-promote-quotes-'));

  try {
    const written = {
      'assets/data/quotes.json': JSON.stringify(catalogue()),
      'docs/quote-candidates/batch.json': JSON.stringify({ candidates }),
      ...files,
    };
    for (const [file, contents] of Object.entries(written)) {
      const path = join(cwd, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }
    const result = spawnSync(
      process.execPath,
      [scriptPath, 'docs/quote-candidates/batch.json', ...flags],
      { cwd, encoding: 'utf8' },
    );
    const promoted = JSON.parse(
      readFileSync(join(cwd, 'assets/data/quotes.json'), 'utf8'),
    );
    const provenancePath = join(cwd, 'docs/quote-candidates/provenance.json');

    return {
      ...result,
      promoted,
      provenance: existsSync(provenancePath)
        ? JSON.parse(readFileSync(provenancePath, 'utf8'))
        : undefined,
    };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Two approved of four candidates, both Vietnamese: inside every contract limit. */
function compliantBatch() {
  return [
    candidate(),
    candidate({
      vi: 'Đi một ngày đàng, học một sàng khôn.',
      en: 'A day of travel brings a basketful of wisdom.',
      category: 'growth',
    }),
    candidate({ verdict: 'reject', category: 'focus' }),
    candidate({
      vi: 'Nước chảy đá mòn, kiên trì thì việc gì cũng xong.',
      en: 'Water wears the stone away.',
      category: 'focus',
      verdict: 'reject',
    }),
  ];
}

test('promotes approved candidates and keeps every ID sequential', () => {
  const result = runPromoter(compliantBatch());

  expect(result.status).toBe(0);
  expect(result.promoted).toHaveLength(38);
  const counts = new Map(categories.map((category) => [category, 0]));
  for (const quote of result.promoted) {
    const next = counts.get(quote.category)! + 1;
    counts.set(quote.category, next);
    expect(quote.id).toBe(`${quote.category}-${String(next).padStart(3, '0')}`);
  }
  expect(counts.get('discipline')).toBe(7);
  expect(counts.get('growth')).toBe(7);
  expect(counts.get('focus')).toBe(6);
});

// Mutation caught: dropping the provenance write would lose the only record of where a quote came from.
test('records provenance for every promoted quote outside the catalogue', () => {
  const result = runPromoter(compliantBatch());

  const records = Object.values(result.provenance ?? {}) as {
    text: string;
    sourceUrl: string;
  }[];
  expect(records).toHaveLength(2);
  expect(
    records.every((record) => record.sourceUrl.startsWith('https://')),
  ).toBe(true);
  // The catalogue itself stays free of provenance fields.
  expect(
    result.promoted.every(
      (quote: Record<string, unknown>) => quote.provenance === undefined,
    ),
  ).toBe(true);
});

// Mutation caught: without the ceiling, a harvest could approve everything it found.
test('refuses a batch that approves more than half of its candidates', () => {
  const batch = compliantBatch();
  batch[2] = candidate({ category: 'focus' });

  const result = runPromoter(batch);

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/over the half ceiling/);
  expect(result.promoted).toHaveLength(36);
});

// Mutation caught: the Vietnamese share is the whole point of the harvest.
test('refuses a batch that is mostly not Vietnamese', () => {
  const result = runPromoter([
    candidate({ vi: '', en: 'An English line that is long enough here.' }),
    candidate({
      vi: '',
      en: 'Another English line that is long enough.',
      category: 'success',
    }),
    candidate({ verdict: 'reject' }),
    candidate({ verdict: 'reject', category: 'growth' }),
  ]);

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/under the 70% share/);
});

test('refuses a weakly verified quote and an unreviewed batch', () => {
  expect(
    runPromoter([
      candidate({ verification: 'weak' }),
      candidate({ verdict: 'reject', category: 'growth' }),
    ]).stderr,
  ).toMatch(/verified only weakly/);
  expect(runPromoter([candidate({ withReview: false })]).stderr).toMatch(
    /carry no review verdict/,
  );
});

// Mutation caught: a duplicate would show the same wallpaper twice under two IDs.
test('refuses a quote the catalogue already ships', () => {
  const shipped = catalogue();
  shipped[0]!.text = {
    ...shipped[0]!.text,
    vi: 'Có công mài sắt, có ngày nên kim.',
  };

  const result = runPromoter(
    [candidate(), candidate({ verdict: 'reject', category: 'growth' })],
    [],
    { 'assets/data/quotes.json': JSON.stringify(shipped) },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/already ships/);
});

test('writes nothing on a dry run', () => {
  const result = runPromoter(compliantBatch(), ['--dry-run']);

  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/dry run: nothing written/);
  expect(result.promoted).toHaveLength(36);
  expect(result.provenance).toBeUndefined();
});

// Mutation caught: without a retire step the app-written filler stays forever.
test('retires filler down to the requested count and keeps the bilingual ones', () => {
  const result = runPromoter(compliantBatch(), ['--retire-filler=6'], {
    'assets/data/quotes.json': JSON.stringify(catalogue(20)),
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/retired filler 84/);
  // Six categories keep six filler entries each, plus the two promoted quotes.
  expect(result.promoted).toHaveLength(38);
  const filler = result.promoted.filter((quote: Quote) =>
    quote.text.en?.startsWith('A deliberate'),
  );
  expect(filler).toHaveLength(36);
  // Five bilingual entries survive per category: they hold the Vietnamese floor up.
  for (const category of categories) {
    const kept = filler.filter((quote: Quote) => quote.category === category);
    expect(
      kept.filter((quote: Quote) => quote.text.vi !== undefined),
    ).toHaveLength(5);
  }
});

// Mutation caught: a retire that breaks a floor would ship a catalogue the gate rejects.
test('refuses a retire that would take a category under its floor', () => {
  const result = runPromoter(compliantBatch(), ['--retire-filler=3'], {
    'assets/data/quotes.json': JSON.stringify(catalogue(20)),
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/under the floor of 6/);
  expect(result.promoted).toHaveLength(120);
});

// Mutation caught: retiring a sourced quote would throw away verified provenance.
test('never retires a quote that carries provenance', () => {
  const sourcedText = 'A sourced line that is long enough here.';
  const sourced = [
    {
      id: 'motivation-001',
      category: 'motivation',
      sourceLocale: 'en',
      text: { en: sourcedText },
    },
  ];
  const key = createHash('sha256')
    .update(sourcedText)
    .digest('hex')
    .slice(0, 16);

  const result = runPromoter(compliantBatch(), ['--retire-filler=0'], {
    'assets/data/quotes.json': JSON.stringify([...sourced, ...catalogue()]),
    'docs/quote-candidates/provenance.json': JSON.stringify({
      [key]: { text: sourcedText },
    }),
  });

  // Retiring every filler entry breaks the floor, so nothing is written and the
  // sourced quote is still there.
  expect(result.stderr).toMatch(/under the floor/);
  expect(result.promoted).toHaveLength(37);
});

// Mutation caught: an owner-supplied line has no URL, so requiring one would block the whole path.
test('accepts an owner-supplied quote that names who handed it over', () => {
  const supplied = {
    ...candidate(),
    provenance: {
      sourceKind: 'owner-supplied',
      providedBy: 'product owner',
      verification: 'owner-supplied',
      rights: 'unknown-author',
      englishRendering: 'ours',
      edit: 'none',
    },
  };

  const result = runPromoter([supplied], ['--owner-supplied']);

  expect(result.status).toBe(0);
  // Five of five approved: the cull ceiling does not apply to chosen lines.
  expect(result.promoted).toHaveLength(37);
  expect(
    result.promoted.some(
      (quote: Quote) => quote.author === undefined && quote.text.vi,
    ),
  ).toBe(true);
});

// Mutation caught: without providedBy an owner-supplied quote would carry no provenance at all.
test('refuses an owner-supplied quote that names nobody', () => {
  const anonymous = {
    ...candidate(),
    provenance: {
      sourceKind: 'owner-supplied',
      verification: 'owner-supplied',
    },
  };

  expect(runPromoter([anonymous], ['--owner-supplied']).stderr).toMatch(
    /names no provenance.providedBy/,
  );
});

// Mutation caught: the ceiling must still bind a normal harvest.
test('keeps the cull ceiling for a harvest that does not claim owner-supplied', () => {
  const batch = compliantBatch();
  batch[2] = candidate({ category: 'focus' });

  expect(runPromoter(batch).stderr).toMatch(/over the half ceiling/);
});
