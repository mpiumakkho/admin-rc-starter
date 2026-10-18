import { act, render } from '@testing-library/react';
import { useState } from 'react';

import { UiPagination } from './pagination';

describe('UiPagination', () => {
  let page = 0;
  let setPageFromOutside: (page: number) => void = () => undefined;
  let setCountFromOutside: (count: number) => void = () => undefined;

  /** The pagination with its page kept outside, as a page using it keeps it */
  function Host({ start, count }: { start: number; count: number }) {
    const [current, setCurrent] = useState(start);
    const [pageCount, setPageCount] = useState(count);
    page = current;
    setPageFromOutside = setCurrent;
    setCountFromOutside = setPageCount;
    return <UiPagination page={current} onPageChange={setCurrent} pageCount={pageCount} />;
  }

  let element: HTMLElement | undefined;

  function show(start: number, count: number) {
    if (!element) {
      element = render(<Host start={start} count={count} />).container;
    } else {
      act(() => {
        setPageFromOutside(start);
        setCountFromOutside(count);
      });
    }
  }

  /** What the buttons say, in order: the arrows by their labels, the pages by number, the current one in brackets */
  function buttons(): string[] {
    return [...element!.querySelectorAll('button')].map(button => {
      const label = button.getAttribute('aria-label');
      const text = label ?? button.textContent!.trim();
      return button.getAttribute('aria-current') === 'page' ? `[${text}]` : text;
    });
  }

  const button = (label: string) => element!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  function click(label: string) {
    act(() => button(label).click());
  }

  beforeEach(() => {
    element = undefined;
  });

  it('shows every page, with previous and next only, when there are five or fewer', () => {
    show(2, 5);
    expect(buttons()).toEqual(['Previous page', '1', '[2]', '3', '4', '5', 'Next page']);
    show(1, 1);
    expect(buttons()).toEqual(['Previous page', '[1]', 'Next page']);
  });

  it('shows five pages around the current one, with first and last, when there are more', () => {
    show(8, 12);
    expect(buttons()).toEqual(['First page', 'Previous page', '6', '7', '[8]', '9', '10', 'Next page', 'Last page']);
  });

  it('keeps five pages near either end', () => {
    show(1, 12);
    expect(buttons().slice(2, 7)).toEqual(['[1]', '2', '3', '4', '5']);
    show(2, 12);
    expect(buttons().slice(2, 7)).toEqual(['1', '[2]', '3', '4', '5']);
    show(11, 12);
    expect(buttons().slice(2, 7)).toEqual(['8', '9', '10', '[11]', '12']);
    show(12, 12);
    expect(buttons().slice(2, 7)).toEqual(['8', '9', '10', '11', '[12]']);
  });

  it('turns to five pages with first and last from six pages on', () => {
    show(4, 6);
    expect(buttons()).toEqual(['First page', 'Previous page', '2', '3', '[4]', '5', '6', 'Next page', 'Last page']);
  });

  it('goes to the first, previous, next and last pages, and stops at either end', () => {
    show(8, 12);

    click('Last page');
    expect(page).toBe(12);
    expect(button('Next page').disabled).toBe(true);
    expect(button('Last page').disabled).toBe(true);

    click('Previous page');
    expect(page).toBe(11);
    click('First page');
    expect(page).toBe(1);
    expect(button('First page').disabled).toBe(true);
    expect(button('Previous page').disabled).toBe(true);

    click('Next page');
    expect(page).toBe(2);
  });

  it('moves the keyboard focus to the current page when the button pressed turns off', () => {
    show(8, 12);
    button('Last page').focus();
    click('Last page');
    expect(document.activeElement?.textContent?.trim()).toBe('12');

    button('Previous page').focus();
    click('Previous page');
    // Still on: the focus stays where it was
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Previous page');
  });

  it('treats a page outside the range as the nearest end', () => {
    show(40, 12);
    expect(buttons().slice(2, 7)).toEqual(['8', '9', '10', '11', '[12]']);
    show(3, 0);
    expect(buttons()).toEqual(['Previous page', '[1]', 'Next page']);
  });
});
