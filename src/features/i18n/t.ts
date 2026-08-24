import type { Locale } from './locale';
import { en } from './strings/en';
import { vi } from './strings/vi';

export type StringKey = keyof typeof en;

const catalogs: Record<Locale, Record<StringKey, string>> = { en, vi };

export function t(
  locale: Locale,
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const template = catalogs[locale][key];
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
