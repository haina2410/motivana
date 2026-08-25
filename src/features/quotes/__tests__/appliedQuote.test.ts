import { resolveAppliedQuoteId } from '../appliedQuote';
import { getAllQuotes } from '../quoteRepository';

jest.mock('../../../services/wallpaperNative', () => ({
  getRotationStatus: jest.fn(),
}));

const nativeService = jest.requireMock('../../../services/wallpaperNative') as {
  getRotationStatus: jest.Mock;
};

const [first, second] = getAllQuotes('vi');

beforeEach(() => {
  nativeService.getRotationStatus.mockReset();
});

// Mutation caught: reading the stored quote first would show the wallpaper the
// reader applied by hand, not the one the worker replaced it with.
test('prefers the quote the rotation worker applied', async () => {
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'succeeded',
    lastQuoteId: second!.id,
  });

  await expect(
    resolveAppliedQuoteId({
      contentLocale: 'vi',
      lastAppliedQuoteId: first!.id,
    }),
  ).resolves.toBe(second!.id);
});

// Mutation caught: letting the native rejection through would stop the launch
// on a device where the worker never ran.
test('falls back to the stored quote when the worker has none', async () => {
  nativeService.getRotationStatus.mockRejectedValue(new Error('no worker'));

  await expect(
    resolveAppliedQuoteId({
      contentLocale: 'vi',
      lastAppliedQuoteId: first!.id,
    }),
  ).resolves.toBe(first!.id);
});

test('reports nothing when no wallpaper was applied yet', async () => {
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: false,
    state: 'disabled',
  });

  await expect(
    resolveAppliedQuoteId({ contentLocale: 'vi' }),
  ).resolves.toBeUndefined();
});

// Mutation caught: keeping a quote outside the reader's quote language would
// show them the other language on every launch.
test('skips an applied quote that the quote language does not have', async () => {
  const englishOnly = getAllQuotes('en').find(
    (quote) => quote.text.vi === undefined,
  )!;
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'succeeded',
    lastQuoteId: englishOnly.id,
  });

  await expect(
    resolveAppliedQuoteId({ contentLocale: 'vi' }),
  ).resolves.toBeUndefined();
});
