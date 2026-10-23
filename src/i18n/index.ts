import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import type { Lang } from '@/lib/format';
import { en, gu, type Key } from '@/i18n/strings';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    gu: { translation: gu },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export function useI18n() {
  const { t, i18n: instance } = useTranslation();
  const lang: Lang = instance.language?.startsWith('gu') ? 'gu' : 'en';
  return {
    lang,
    t: (key: Key, options?: Record<string, string | number>) => String(t(key, options)),
    setLang: (next: Lang) => instance.changeLanguage(next),
  };
}

export type { Key };
