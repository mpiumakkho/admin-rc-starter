import { create } from 'zustand';

interface SidebarState {
  open: boolean;
  toggle(): void;
  close(): void;
}

/**
 * Whether the menu is open on screens too narrow to keep it in view (below 992px), where it slides in from
 * the left. The navbar's menu button opens it; picking a page, the backdrop or Escape closes it.
 */
export const useSidebarState = create<SidebarState>(set => ({
  open: false,
  toggle: () => set(state => ({ open: !state.open })),
  close: () => set({ open: false }),
}));
