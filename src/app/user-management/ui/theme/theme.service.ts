import { create } from 'zustand';

export type UiTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const LIGHT_CLASS = 'theme-light';
const DARK_CLASS = 'theme-dark';

export interface UiThemeState {
  theme: UiTheme;
  isDark: boolean;
  set(theme: UiTheme): void;
  toggle(): void;
}

/**
 * Light or dark mode for the whole page. Sets `theme-light` or `theme-dark` on <body>, which the
 * --ui-* variables respond to, and remembers the choice in localStorage.
 *
 * To avoid a flash of the wrong theme, set the same class from a small script in index.html
 * before the app starts; this store reads it back on startup.
 *
 *   const { isDark, toggle } = useUiTheme();
 */
export const useUiTheme = create<UiThemeState>((set, get) => {
  const initial: UiTheme = document.body.classList.contains(DARK_CLASS) ? 'dark' : 'light';
  apply(initial);
  return {
    theme: initial,
    isDark: initial === 'dark',
    set(theme) {
      set({ theme, isDark: theme === 'dark' });
      apply(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage can be unavailable (private mode); the theme still applies for this visit
      }
    },
    toggle() {
      get().set(get().isDark ? 'light' : 'dark');
    },
  };
});

function apply(theme: UiTheme): void {
  const { body, documentElement } = document;
  body.classList.toggle(LIGHT_CLASS, theme === 'light');
  body.classList.toggle(DARK_CLASS, theme === 'dark');
  documentElement.style.colorScheme = theme;
}
