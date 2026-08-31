import { en } from '../strings/en';
import { t } from '../t';

// Mutation caught: dropping the interpolation would show a literal placeholder on the rotation screen.
test('fills placeholders from the parameters', () => {
  expect(t('en', 'preset.thumbnail.label', { name: 'Paper' })).toBe(
    'Use Paper preset',
  );
});

// Mutation caught: returning the key instead of the text would show identifiers in the interface.
test('returns the English text for a known key', () => {
  expect(t('en', 'home.title')).toBe('Motivana');
  expect(t('en', 'common.back.label')).toBe('Back to Home');
});

// Mutation caught: an empty catalog entry would leave a blank control in the interface.
test('every English entry is non-empty', () => {
  const blank = Object.entries(en)
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);

  expect(blank).toEqual([]);
});
