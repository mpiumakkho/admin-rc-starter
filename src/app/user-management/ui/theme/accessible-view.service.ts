import { create } from 'zustand';

const STORAGE_KEY = 'accessible-view';
const CLASS = 'ui-aaa';

export interface UiAccessibleViewState {
  on: boolean;
  set(on: boolean): void;
  toggle(): void;
}

/**
 * The accessible view: every page as it meets WCAG 2.2 AAA where the usual, more compact look does not. Targets
 * are at least 44 by 44 pixels, text stands out 7:1, lines are spaced 1.5, nothing moves, and nothing changes or
 * goes away by itself (WCAG lets a site meet AAA through such a "conforming alternate version", as long as every page
 * links to it). Sets `ui-aaa` on <body>, which ui.scss and the components respond to, and remembers the choice.
 *
 * index.html sets the same class before the app starts, so the page does not first show the usual look.
 */
export const useUiAccessibleView = create<UiAccessibleViewState>((set, get) => ({
  on: document.body.classList.contains(CLASS),
  set(on) {
    set({ on });
    document.body.classList.toggle(CLASS, on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the view still applies for this visit
    }
  },
  toggle() {
    get().set(!get().on);
  },
}));
