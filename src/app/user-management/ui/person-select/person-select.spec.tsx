import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';

import { UiPersonSelect, type UiPersonOption } from './person-select';

/** 120 people, Person 000 to Person 119, more than the list shows at once */
const MANY: UiPersonOption[] = Array.from({ length: 120 }, (_, index) => ({
  id: `p${index}`,
  name: `Person ${String(index).padStart(3, '0')}`,
  detail: `person${index}@example.com`,
}));

describe('UiPersonSelect', () => {
  let element: HTMLElement;
  let picked: (string | null)[];

  /** The select with its value kept outside, as a page using it keeps it */
  function Host({ people, start }: { people: readonly UiPersonOption[]; start: string | null }) {
    const [value, setValue] = useState(start);
    return <UiPersonSelect label="Done by" people={people} value={value} onValueChange={next => { picked.push(next); setValue(next); }} />;
  }

  function show(people: readonly UiPersonOption[] = MANY, start: string | null = null) {
    // jsdom lays nothing out, so it cannot scroll an option into view
    Element.prototype.scrollIntoView ??= () => undefined;
    picked = [];
    element = render(<Host people={people} start={start} />).container;
  }

  const trigger = () => element.querySelector<HTMLButtonElement>('.ui-ps-trigger')!;
  const input = () => document.querySelector<HTMLInputElement>('.ui-ps-input')!;
  /** The names in the open list, in order */
  const names = () => [...document.querySelectorAll('.ui-ps-option .ui-ps-name')].map(name => name.textContent!.trim());

  function open() {
    act(() => trigger().click());
  }

  function type(text: string) {
    fireEvent.change(input(), { target: { value: text } });
  }

  function press(key: string) {
    fireEvent.keyDown(input(), { key });
  }

  it('shows anyone, then the first fifty people, and says how many more there are', () => {
    show();
    open();
    expect(names().length).toBe(51);
    expect(names().slice(0, 3)).toEqual(['Anyone', 'Person 000', 'Person 001']);
    expect(document.querySelector('.ui-ps-more')!.textContent).toContain('Showing 50 of 120.');
    expect(document.activeElement).toBe(input());
  });

  it('finds people by name or detail as you type, those whose name starts with it first', () => {
    show([
      { id: 'b', name: 'Bob Stone', detail: 'ann.b@example.com' },
      { id: 'j', name: 'Joann Lee', detail: 'jl@example.com' },
      { id: 'a', name: 'Ann Smith', detail: 'as@example.com' },
    ]);
    open();
    type('ANN');
    expect(names()).toEqual(['Ann Smith', 'Bob Stone', 'Joann Lee']);
    expect(document.querySelector('.ui-ps-more')).toBeNull();

    type('nobody');
    expect(names()).toEqual([]);
    expect(document.querySelector('.ui-ps-empty')!.textContent).toContain('No one found');
  });

  it('moves through the list with the arrow keys and picks with Enter; Escape closes and picks nothing', () => {
    show();
    open();
    press('ArrowDown');
    press('ArrowDown');
    press('Enter');
    expect(picked).toEqual(['p1']);
    expect(document.querySelector('.ui-ps-panel')).toBeNull();
    expect(trigger().textContent).toContain('Person 001');
    expect(document.activeElement).toBe(trigger());

    open();
    press('ArrowUp');
    press('Escape');
    expect(picked).toEqual(['p1']);
    expect(document.querySelector('.ui-ps-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('keeps the one picked in the list before anything is typed, wherever it is, and starts there', () => {
    show(MANY, 'p100');
    open();
    expect(names().length).toBe(51);
    expect(names()[1]).toBe('Person 100');
    expect(document.querySelector('.ui-ps-option[aria-selected="true"] .ui-ps-name')!.textContent).toBe('Person 100');
  });

  it('clears what is picked with the cross', () => {
    show(MANY, 'p3');
    expect(element.querySelector('ui-person-select')!.classList).toContain('ui-ps-picked');
    act(() => element.querySelector<HTMLButtonElement>('.ui-ps-clear')!.click());
    expect(picked).toEqual([null]);
    expect(trigger().textContent).toContain('Anyone');
  });
});
