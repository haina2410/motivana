import { useCallback } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { t, type StringKey } from './t';

export function useTranslate() {
  const appLocale = useAppStore((state) => state.appLocale);
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) =>
      t(appLocale, key, params),
    [appLocale],
  );
}
