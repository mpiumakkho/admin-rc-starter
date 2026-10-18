import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { create } from 'zustand';

import appEn from '../../assets/i18n/en.json';
import appTh from '../../assets/i18n/th.json';
import userManagementEn from '../user-management/i18n/en.json';
import userManagementTh from '../user-management/i18n/th.json';

// Each code needs its text in src/assets/i18n/<code>.json and src/app/user-management/i18n/<code>.json
export const LANGUAGES = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'English' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'th';
// Used when a translation isn't found in the current language
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

const STORAGE_KEY = 'language';

// The app's own text, then user management's, which wins where both have a key (as the Angular app loads them)
void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: { ...appEn, ...userManagementEn } },
    th: { translation: { ...appTh, ...userManagementTh } },
  },
  lng: restore(),
  fallbackLng: FALLBACK_LANGUAGE,
  // The keys are the English text, dots, colons and all: none of them is a path
  keySeparator: false,
  nsSeparator: false,
  // React escapes what it shows; {{name}} as ngx-translate writes it
  interpolation: { escapeValue: false },
  initAsync: false,
});

export interface LanguageState {
  languages: typeof LANGUAGES;
  current: LanguageCode;
  init(): void;
  use(code: LanguageCode): void;
}

/** The language the app is shown in: TH or EN, remembered in localStorage and set on <html lang> */
export const useLanguage = create<LanguageState>((set, get) => ({
  languages: LANGUAGES,
  current: restore(),
  init() {
    get().use(get().current);
  },
  use(code) {
    set({ current: code });
    void i18next.changeLanguage(code);
    document.documentElement.lang = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage can be unavailable (private mode); the choice just won't persist
    }
  },
}));

function restore(): LanguageCode {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Fall through to the default language
  }
  return LANGUAGES.find(language => language.code === stored)?.code ?? DEFAULT_LANGUAGE;
}
