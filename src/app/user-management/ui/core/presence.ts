import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Angular's animate.leave for a list: items taken out stay in place, marked `leaving`, until their leave animation
 * ends and `done` is called, as `<div animate.leave="ui-toast-leave">` keeps a toast while it fades. An item whose
 * element has no animation running is gone at once (reduced motion): see leaveRef.
 *
 *   const shown = useLeavingList(toasts, toast => toast.id);
 *   {shown.map(({ item, leaving, done }) =>
 *     <div key={item.id} className={cx('ui-toast', leaving && 'ui-toast-leave')} ref={leaving ? leaveRef(done) : undefined} onAnimationEnd={leaving ? done : undefined}>)}
 */
export function useLeavingList<T, K extends string | number>(items: readonly T[], key: (item: T) => K): { item: T; leaving: boolean; done: () => void }[] {
  const [leaving, setLeaving] = useState<{ item: T; index: number }[]>([]);
  const previous = useRef<readonly T[]>(items);

  useLayoutEffect(() => {
    const kept = new Set(items.map(key));
    const gone = previous.current.map((item, index) => ({ item, index })).filter(({ item }) => !kept.has(key(item)));
    previous.current = items;
    if (gone.length) {
      setLeaving(current => [...current.filter(entry => !kept.has(key(entry.item))), ...gone]);
    }
  }, [items]);

  const done = useCallback((id: K) => setLeaving(current => current.filter(entry => key(entry.item) !== id)), []);

  const shown: { item: T; leaving: boolean; done: () => void }[] = items.map(item => ({ item, leaving: false, done: () => undefined }));
  for (const entry of [...leaving].sort((a, b) => a.index - b.index)) {
    if (!shown.some(present => key(present.item) === key(entry.item))) {
      shown.splice(Math.min(entry.index, shown.length), 0, { item: entry.item, leaving: true, done: () => done(key(entry.item)) });
    }
  }
  return shown;
}

/**
 * Angular's animate.leave for one element: it stays while `show` turns false, marked `leaving`, until its leave
 * animation ends (`done`).
 *
 *   const panel = usePresence(open);
 *   {panel.mounted && <div className={cx('panel', panel.leaving && 'panel-out')} ref={panel.leaving ? leaveRef(panel.done) : undefined} onAnimationEnd={panel.leaving ? panel.done : undefined} />}
 */
export function usePresence(show: boolean): { mounted: boolean; leaving: boolean; done: () => void } {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) {
    setMounted(true);
  }
  const done = useCallback(() => setMounted(false), []);
  return { mounted: show || mounted, leaving: !show && mounted, done };
}

/** A ref for a leaving element: with no animation running on it (reduced motion), it is done at once */
export function leaveRef(done: () => void) {
  return (element: Element | null) => {
    if (element && !element.getAnimations().some(animation => animation.playState === 'running')) {
      // After the leave class has applied, which starts its animation if there is one
      requestAnimationFrame(() => {
        if (!element.getAnimations().some(animation => animation.playState === 'running')) {
          done();
        }
      });
    }
  };
}
