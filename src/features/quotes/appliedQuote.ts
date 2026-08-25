import { quoteInLocale } from './quoteRepository';
import type { Locale } from '../i18n/locale';
import { getRotationStatus } from '../../services/wallpaperNative';

export interface AppliedQuoteSources {
  contentLocale: Locale;
  /** The quote the reader applied by hand, from the stored state. */
  lastAppliedQuoteId?: string;
}

/**
 * The quote that is on the wallpaper right now. The rotation worker applies
 * wallpapers while the application is closed, so its own record comes first;
 * the stored one covers a manual apply and a device with no worker.
 *
 * A quote outside the reader's quote language is skipped, because the deck can
 * only show what that language has.
 */
export async function resolveAppliedQuoteId(
  sources: AppliedQuoteSources,
): Promise<string | undefined> {
  const usable = (quoteId: string | undefined) =>
    quoteId !== undefined && quoteInLocale(quoteId, sources.contentLocale)
      ? quoteId
      : undefined;
  let applied: string | undefined;
  try {
    applied = usable((await getRotationStatus()).lastQuoteId);
  } catch {
    applied = undefined;
  }
  return applied ?? usable(sources.lastAppliedQuoteId);
}
