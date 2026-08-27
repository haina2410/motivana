import { en } from '../strings/en';
import { vi } from '../strings/vi';

// Mutation caught: a Vietnamese value left in English would ship a half-translated interface with no failing build.
test('every Vietnamese entry differs from English except proper nouns', () => {
  const sameByDesign = new Set([
    'home.title', // product name
    'settings.about.title', // product name
    'language.en', // each language reads in its own name
    'language.vi', // each language reads in its own name
    'settings.version.value', // a bare version placeholder has no words
    // A typeface name is the designer's proper noun in every language.
    'preset.face.CormorantGaramond',
    'preset.face.BeVietnamPro',
    'preset.face.DancingScript',
    'preset.face.Lora',
  ]);
  const untranslated = Object.keys(en).filter(
    (key) =>
      !sameByDesign.has(key) &&
      vi[key as keyof typeof en] === en[key as keyof typeof en],
  );

  expect(untranslated).toEqual([]);
});

// Mutation caught: a missing placeholder would drop the interpolated value from the Vietnamese string.
test('keeps the placeholders of every English template', () => {
  const placeholders = (text: string) =>
    (text.match(/\{(\w+)\}/g) ?? []).sort();
  const mismatched = (Object.keys(en) as (keyof typeof en)[]).filter(
    (key) => placeholders(vi[key]).join() !== placeholders(en[key]).join(),
  );

  expect(mismatched).toEqual([]);
});
