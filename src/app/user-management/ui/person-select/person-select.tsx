import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { lucideCheck, lucideChevronDown, lucideSearch, lucideUsers, lucideX } from '../../../icons';
import { UiAvatar } from '../avatar/avatar';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import { OverlayPane } from '../menu/menu';
import { overlayContainer, STANDARD_DROPDOWN_BELOW_POSITIONS } from '../menu/overlay';
import './person-select.scss';

/** Someone to pick: what shows for them, and what their name or detail is searched by */
export interface UiPersonOption {
  id: string;
  name: string;
  /** Under the name, such as their email */
  detail?: string;
  /** A photo; without one, their initials */
  avatar?: string;
}

/** One line of the list: a person, or nobody in particular (id null) */
interface Choice {
  id: string | null;
  person: UiPersonOption | null;
}

export interface UiPersonSelectProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** What it filters by, shown before what is picked: "Done by: Anyone" */
  label: string;
  people?: readonly UiPersonOption[];
  /** The id of the person picked; null for anyone */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  anyoneLabel?: string;
  searchLabel?: string;
  emptyLabel?: string;
  /** The cross that clears it, which shows only an icon */
  clearLabel?: string;
  /** How many people the list shows at once; typing finds the others */
  limit?: number;
  /** Under the list when it shows only some of those found */
  moreText?: (shown: number, total: number) => string;
}

let nextId = 0;
const NO_PEOPLE: readonly UiPersonOption[] = [];
const moreByDefault = (shown: number, total: number) => `Showing ${shown} of ${total.toLocaleString('en')}. Type a name to find the others.`;

/**
 * Picks one person, or anyone, as a filter, among however many there are: the list it opens searches by name or
 * detail as you type and shows the first `limit` it finds, saying how many more there are. The keyboard works it as
 * a combobox: the arrow keys move through the list, Enter picks, Escape closes. Every piece of text comes in, as the
 * Angular app's ui-person-select.
 *
 *   <UiPersonSelect label="Done by" people={people} value={actorId} onValueChange={setActorId} anyoneLabel="Anyone"
 *     searchLabel="Search name or email" emptyLabel="No one found" clearLabel="Clear Done by" moreText={more} />
 */
export function UiPersonSelect({
  label, people = NO_PEOPLE, value = null, onValueChange, anyoneLabel = 'Anyone', searchLabel = 'Search', emptyLabel = 'No one found',
  clearLabel = 'Clear', limit = 50, moreText = moreByDefault, className, ...rest
}: UiPersonSelectProps) {
  const [id] = useState(() => `ui-person-select-${nextId++}`);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** The line the arrow keys are on */
  const [active, setActive] = useState(0);
  const host = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const picked = value === null ? null : people.find(person => person.id === value) ?? { id: value, name: value };

  const { matches, shown, choices } = listFor(people, query, picked, limit);

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) {
      trigger.current?.focus();
    }
  };
  const show = () => {
    setQuery('');
    setActive(Math.max(0, listFor(people, '', picked, limit).choices.findIndex(choice => choice.id === value)));
    setOpen(true);
  };

  // A click outside closes it; one on its own button toggles it there
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const clicked = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!pane.current?.contains(target) && !host.current?.contains(target)) {
        close(false);
      }
    };
    document.body.addEventListener('click', clicked, true);
    return () => document.body.removeEventListener('click', clicked, true);
  }, [open]);

  const scrollToActive = (index: number) => {
    list.current?.querySelector(`#${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' });
  };

  const pick = (choice: string | null) => {
    close(true);
    if (choice !== value) {
      onValueChange?.(choice);
    }
  };

  const searchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = choices.length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (count) {
          const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
          setActive(next);
          scrollToActive(next);
        }
        break;
      }
      case 'Enter':
        event.preventDefault();
        if (count) {
          pick(choices[active].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        // On to what follows the button, as if the list were not there
        close(true);
        break;
    }
  };

  return (
    <ui-person-select ref={host} {...rest} className={cx('ui-person-select', open && 'ui-ps-open', !!picked && 'ui-ps-picked', className)}>
      <button ref={trigger} type="button" className="ui-ps-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => open ? close(false) : show()}
        onKeyDown={event => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
            event.preventDefault();
            show();
          }
        }}>
        <span className="ui-ps-label">{`${label}:`}</span>
        {picked ? (
          <>
            <UiAvatar name={picked.name} src={picked.avatar ?? ''} size="xs" />
            <span className="ui-ps-value">{picked.name}</span>
          </>
        ) : (
          <>
            <span className="ui-ps-value">{anyoneLabel}</span>
            <NgIcon svg={lucideChevronDown} className="ui-ps-caret" />
          </>
        )}
      </button>
      {picked && (
        <button type="button" className="ui-ps-clear" aria-label={clearLabel} title={clearLabel}
          onClick={() => {
            onValueChange?.(null);
            trigger.current?.focus();
          }}>
          <NgIcon svg={lucideX} />
        </button>
      )}
      {open && host.current && createPortal(
        <OverlayPane paneRef={pane} origin={host.current} positions={STANDARD_DROPDOWN_BELOW_POSITIONS} onFocusLeft={() => undefined}
          onPlaced={() => {
            search.current?.focus();
            scrollToActive(active);
          }}>
          <div className="ui-ps-panel" role="dialog" id={`${id}-panel`} aria-label={label}>
            <div className="ui-ps-search">
              <NgIcon svg={lucideSearch} className="ui-ps-search-icon" />
              <input ref={search} type="text" className="ui-input ui-input-sm ui-ps-input" role="combobox" aria-autocomplete="list" aria-expanded="true"
                aria-controls={`${id}-list`} aria-activedescendant={choices.length ? `${id}-option-${active}` : undefined}
                placeholder={searchLabel} aria-label={searchLabel} value={query} autoComplete="off" spellCheck={false}
                onChange={event => {
                  setQuery(event.target.value);
                  setActive(0);
                  if (list.current) {
                    list.current.scrollTop = 0;
                  }
                }}
                onKeyDown={searchKey} />
            </div>
            {choices.length ? (
              <div ref={list} className="ui-ps-list" role="listbox" id={`${id}-list`} aria-label={label}>
                {choices.map((choice, index) => (
                  <div key={choice.id ?? ''} className={cx('ui-ps-option', index === active && 'ui-ps-active')} role="option" id={`${id}-option-${index}`}
                    aria-selected={index === active} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()}
                    onClick={() => pick(choice.id)}>
                    {choice.person ? (
                      <>
                        <UiAvatar name={choice.person.name} src={choice.person.avatar ?? ''} size="xs" />
                        <span className="ui-ps-text">
                          <span className="ui-ps-name">{choice.person.name}</span>
                          {choice.person.detail && <span className="ui-ps-detail">{choice.person.detail}</span>}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="ui-ps-anyone" aria-hidden="true"><NgIcon svg={lucideUsers} /></span>
                        <span className="ui-ps-text"><span className="ui-ps-name">{anyoneLabel}</span></span>
                      </>
                    )}
                    {choice.id === value && <NgIcon svg={lucideCheck} className="ui-ps-check" />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ui-ps-empty" role="status">{emptyLabel}</p>
            )}
            {matches.length > shown.length && <p className="ui-ps-more">{moreText(shown.length, matches.length)}</p>}
          </div>
        </OverlayPane>,
        overlayContainer(),
      )}
    </ui-person-select>
  );
}

/**
 * What the list shows for what is typed: everyone whose name or detail holds it, those whose name starts with it
 * first; the first `limit` of them, and, before anything is typed, the one picked among them; and anyone first,
 * until something is typed
 */
function listFor(people: readonly UiPersonOption[], query: string, picked: UiPersonOption | null, limit: number) {
  const typed = query.trim().toLocaleLowerCase();
  let matches = people;
  if (typed) {
    const found = people.filter(person => person.name.toLocaleLowerCase().includes(typed) || !!person.detail?.toLocaleLowerCase().includes(typed));
    matches = [...found.filter(person => person.name.toLocaleLowerCase().startsWith(typed)),
      ...found.filter(person => !person.name.toLocaleLowerCase().startsWith(typed))];
  }
  const first = matches.slice(0, limit);
  const shown = !picked || typed || first.some(person => person.id === picked.id) ? first : [picked, ...first.slice(0, limit - 1)];
  const choices: Choice[] = [...(typed ? [] : [{ id: null, person: null }]), ...shown.map(person => ({ id: person.id, person }))];
  return { matches, shown, choices };
}
