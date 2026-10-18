import { cleanup } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// No translations, as in the Angular app's tests: the text is the translation keys themselves
void i18next.use(initReactI18next).init({ lng: 'en', resources: {}, keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false }, initAsync: false });

// Each test starts on an empty page, with nothing remembered from the one before
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
