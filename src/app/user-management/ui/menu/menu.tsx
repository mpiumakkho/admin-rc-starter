import {
  Children, cloneElement, createContext, useContext, useEffect, useLayoutEffect, useRef, useState,
  type AnchorHTMLAttributes, type ButtonHTMLAttributes, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type MouseEvent,
  type ReactElement, type ReactNode, type Ref, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, type To } from 'react-router';

import { lucideCheck } from '../../../icons';
import { cx, type UiIcon } from '../core/types';
import { NgIcon } from '../icon/icon';
import './menu.scss';
import { nextOverlayId, overlayContainer, placeOverlay, STANDARD_DROPDOWN_BELOW_POSITIONS, type UiConnectedPosition } from './overlay';

export { STANDARD_DROPDOWN_BELOW_POSITIONS, type UiConnectedPosition } from './overlay';

/** The open menu's link back to its trigger: items close it, the menu names itself after it */
interface MenuStack {
  menuId: string;
  stackId: string;
  /** Closes the menu; `focusTrigger` puts focus back on its button, as after picking an item or Escape */
  close(focusTrigger: boolean): void;
}

const MenuContext = createContext<MenuStack | null>(null);

let menuCount = 0;
let stackCount = 0;

/** What a press of the trigger asks of the menu once it is open */
type FocusOnOpen = 'first' | 'last';

/** The items of a menu, in order, as its keyboard moves through them */
function itemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('.cdk-menu-item'));
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref) {
        (ref as RefObject<T | null>).current = value;
      }
    }
  };
}

export interface UiMenuTriggerProps {
  /** The menu it opens: <UiMenu>…items…</UiMenu> */
  menu: ReactNode;
  /** Where the menu may open, in order of preference; below the button, lined up with its start, by default */
  position?: UiConnectedPosition[];
  onOpened?: () => void;
  onClosed?: () => void;
  /** The button that opens it */
  children: ReactElement;
}

/**
 * Opens a menu from the button inside it, as the Angular CDK menu does (keyboard navigation, focus handling,
 * positioning).
 *
 *   <UiMenuTrigger menu={
 *     <UiMenu>
 *       <UiMenuItem icon={lucidePencil} onTriggered={edit}>Edit</UiMenuItem>
 *       <UiMenuDivider />
 *       <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={remove}>Delete</UiMenuItem>
 *     </UiMenu>
 *   }>
 *     <UiButton variant="ghost" iconOnly aria-label="Actions">…</UiButton>
 *   </UiMenuTrigger>
 *
 * For one choice out of several, use `UiMenuItemRadio` items, with a label for the group:
 *
 *   <UiMenu aria-label="Rows per page">
 *     <UiMenuHeading>Rows per page</UiMenuHeading>
 *     <UiMenuItemRadio checked={size === 10} onTriggered={() => setSize(10)}>10</UiMenuItemRadio>
 *   </UiMenu>
 */
export function UiMenuTrigger({ menu, position, onOpened, onClosed, children }: UiMenuTriggerProps) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [stackId] = useState(() => `cdk-menu-stack-${stackCount++}`);
  const [menuId, setMenuId] = useState('');
  const trigger = useRef<HTMLElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<FocusOnOpen | null>(null);
  const callbacks = useRef({ onOpened, onClosed });
  callbacks.current = { onOpened, onClosed };

  const show = (focus: FocusOnOpen) => {
    focusOnOpen.current = focus;
    if (!openRef.current) {
      openRef.current = true;
      setMenuId(`cdk-menu-${menuCount++}`);
      setOpen(true);
      callbacks.current.onOpened?.();
    } else {
      focusItem(focus);
    }
  };
  const close = (focusTrigger: boolean) => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      callbacks.current.onClosed?.();
    }
    if (focusTrigger) {
      trigger.current?.focus();
    }
  };
  const focusItem = (which: FocusOnOpen) => {
    const items = pane.current ? itemsOf(pane.current) : [];
    (which === 'first' ? items[0] : items[items.length - 1])?.focus();
  };

  // A click outside the menu and its button closes it; so does focus leaving them both
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let downTarget: EventTarget | null = null;
    const pointerDown = (event: PointerEvent) => {
      downTarget = event.target;
    };
    const clicked = (event: globalThis.MouseEvent) => {
      const target = (downTarget ?? event.target) as Node;
      downTarget = null;
      if (!pane.current?.contains(target) && !trigger.current?.contains(target)) {
        close(false);
      }
    };
    document.body.addEventListener('pointerdown', pointerDown, true);
    document.body.addEventListener('click', clicked, true);
    return () => {
      document.body.removeEventListener('pointerdown', pointerDown, true);
      document.body.removeEventListener('click', clicked, true);
    };
  }, [open]);

  // Closed with the page it is on
  useEffect(() => () => {
    if (openRef.current) {
      openRef.current = false;
      callbacks.current.onClosed?.();
    }
  }, []);

  const focusLeft = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (openRef.current && (!next || (!pane.current?.contains(next) && !trigger.current?.contains(next)))) {
      // As the CDK's menu stack: after the focus has settled, which a click on the button itself keeps
      setTimeout(() => {
        const active = document.activeElement;
        if (openRef.current && !pane.current?.contains(active) && !trigger.current?.contains(active)) {
          close(false);
        }
      });
    }
  };

  const child = Children.only(children) as ReactElement<Record<string, any>>;
  const props = child.props;
  const isButton = typeof child.type === 'string' ? child.type === 'button' : props['type'] !== undefined || !('to' in props || 'href' in props);
  const triggerProps = {
    ref: mergeRefs(props['ref'], trigger),
    className: cx('cdk-menu-trigger', props['className']),
    type: props['type'] ?? (isButton ? 'button' : undefined),
    role: 'button',
    'data-cdk-menu-stack-id': stackId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (event: MouseEvent) => {
      props['onClick']?.(event);
      if (openRef.current) {
        close(false);
      } else {
        show('first');
      }
    },
    onKeyDown: (event: KeyboardEvent) => {
      props['onKeyDown']?.(event);
      const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !modified) {
        event.preventDefault();
        show(event.key === 'ArrowDown' ? 'first' : 'last');
      } else if ((event.key === ' ' || event.key === 'Enter') && !modified && !isButton && !(event.key === 'Enter' && (event.target as Element).tagName === 'A')) {
        // What does not click itself from the keyboard
        event.preventDefault();
        if (openRef.current) {
          close(false);
        } else {
          show('first');
        }
      }
    },
    onBlur: (event: FocusEvent) => {
      props['onBlur']?.(event);
      focusLeft(event);
    },
  };

  return (
    <>
      {cloneElement(child, triggerProps)}
      {open && trigger.current && createPortal(
        <MenuContext.Provider value={{ menuId, stackId, close }}>
          <OverlayPane paneRef={pane} origin={trigger.current} positions={position ?? STANDARD_DROPDOWN_BELOW_POSITIONS}
            onPlaced={() => focusOnOpen.current && focusItem(focusOnOpen.current)} onFocusLeft={focusLeft}>
            {menu}
          </OverlayPane>
        </MenuContext.Provider>,
        overlayContainer(),
      )}
    </>
  );
}

export interface OverlayPaneProps {
  paneRef: RefObject<HTMLDivElement | null>;
  origin: Element;
  positions: UiConnectedPosition[];
  onPlaced: () => void;
  onFocusLeft: (event: FocusEvent) => void;
  children: ReactNode;
}

/**
 * The CDK's overlay for one menu, or for another panel opened from a control (UiPersonSelect, as cdkConnectedOverlay):
 * a popover over the whole window (the top layer, over dialogs too) holding the pane, which sits against the button.
 * Its place is kept while it is open, and follows the button as the page scrolls.
 */
export function OverlayPane({ paneRef, origin, positions, onPlaced, onFocusLeft, children }: OverlayPaneProps) {
  const box = useRef<HTMLDivElement>(null);
  const [id] = useState(nextOverlayId);
  /**
   * The component the menu was opened from, whose styles reach into it as Angular's do into what its template declares,
   * wherever it shows (build/emulated-styles.ts): the nearest with styles of its own (data-emulated), and the elements
   * on the way to it
   */
  const [hosts] = useState(() => {
    const tags: string[] = [];
    for (let element = origin.parentElement; element; element = element.parentElement) {
      if (element.tagName.includes('-')) {
        tags.push(element.tagName.toLowerCase());
      }
      if (element.hasAttribute('data-emulated')) {
        break;
      }
    }
    return tags.join(' ');
  });

  useLayoutEffect(() => {
    const popover = box.current!;
    popover.showPopover?.();
    let locked = placeOverlay(paneRef.current!, origin, positions);
    onPlaced();
    const update = () => {
      if (paneRef.current) {
        locked = placeOverlay(paneRef.current, origin, positions, locked);
      }
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      if (popover.isConnected && popover.matches(':popover-open')) {
        popover.hidePopover?.();
      }
    };
  }, []);

  // A popover only where the browser has them, as the CDK decides; elsewhere (jsdom in the unit tests) a plain box
  const popoverSupported = 'showPopover' in document.body;
  return (
    <div ref={box} popover={popoverSupported ? 'manual' : undefined}
      className={cx(popoverSupported && 'cdk-overlay-popover', 'cdk-overlay-connected-position-bounding-box')} dir="ltr"
      style={{ inset: '0px auto auto 0px', height: '100%', width: '100%' }}>
      <div ref={paneRef} id={id} className="cdk-overlay-pane" data-host={hosts} onBlur={onFocusLeft}>
        {children}
      </div>
    </div>
  );
}

/** How long the letters typed to find an item gather before the search (the CDK's typeahead) */
const TYPEAHEAD_MS = 200;

export type UiMenuProps = HTMLAttributes<HTMLElement>;

/** The menu itself, inside the `menu` of a UiMenuTrigger */
export function UiMenu({ className, children, onKeyDown, onFocus, ...rest }: UiMenuProps) {
  const stack = useContext(MenuContext);
  const element = useRef<HTMLElement>(null);
  const typed = useRef<{ letters: string; timer?: ReturnType<typeof setTimeout> }>({ letters: '' });

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  const keydown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    const menu = element.current!;
    const items = itemsOf(menu);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    const focus = (at: number) => items[(at + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focus(index < 0 ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focus(index < 0 ? items.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focus(0);
        break;
      case 'End':
        event.preventDefault();
        focus(items.length - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (!modified) {
          event.preventDefault();
        }
        break;
      case 'Escape':
        if (!modified) {
          event.preventDefault();
          stack?.close(true);
        }
        break;
      case 'Tab':
        if (!event.altKey && !event.ctrlKey && !event.metaKey) {
          // Back on the button, from where the browser moves on as Tab does
          stack?.close(true);
        }
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          // Letters find the next item that starts with them, once typing pauses
          const state = typed.current;
          state.letters += event.key.toLocaleUpperCase();
          clearTimeout(state.timer);
          state.timer = setTimeout(() => {
            const letters = state.letters;
            state.letters = '';
            const current = items.indexOf(document.activeElement as HTMLElement);
            for (let step = 1; step <= items.length; step++) {
              const item = items[(current + step + items.length) % items.length];
              if ((item.textContent ?? '').trim().toLocaleUpperCase().startsWith(letters)) {
                item.focus();
                break;
              }
            }
          }, TYPEAHEAD_MS);
        }
    }
  };

  // The item with focus is the one Tab would reach, as the CDK's roving tab index keeps it
  const focused = (event: FocusEvent<HTMLElement>) => {
    onFocus?.(event);
    const items = itemsOf(element.current!);
    if (items.includes(event.target as HTMLElement)) {
      items.forEach(item => item.tabIndex = item === event.target ? 0 : -1);
    }
  };

  return (
    <ui-menu ref={element} role="menu" tabIndex={0} id={stack?.menuId} aria-orientation="vertical" data-cdk-menu-stack-id={stack?.stackId} {...rest}
      className={cx('cdk-menu cdk-menu-group ui-menu', className)} onKeyDown={keydown} onFocus={focused}>
      {children}
    </ui-menu>
  );
}

interface ItemBehaviour {
  disabled?: boolean;
  /** The item was picked, with a click or from the keyboard; the menu then closes */
  onTriggered?: () => void;
}

/** What every kind of item does: picking it, and focus following the pointer */
function useItem({ disabled, onTriggered }: ItemBehaviour) {
  const stack = useContext(MenuContext);
  return {
    tabIndex: -1,
    'aria-disabled': disabled || undefined,
    onClick: (event: MouseEvent) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onTriggered?.();
      stack?.close(true);
    },
    // Focus moves to the item under the pointer, as menus in the operating system do: one item shows at a time, and
    // the arrow keys go on from the item pointed at. On every move, so after an arrow key took focus elsewhere,
    // moving the pointer brings it back
    onMouseMove: (event: MouseEvent<HTMLElement>) => {
      if (!disabled && document.activeElement !== event.currentTarget) {
        event.currentTarget.focus();
      }
    },
  };
}

export type UiMenuItemProps = ItemBehaviour & {
  icon?: UiIcon;
  tone?: 'default' | 'danger';
} & (
  | ({ to: To; href?: never } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)
  | ({ href: string; to?: never } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ to?: never; href?: never } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/** An item that does something: a button, a link to a page of the app (`to`), or a plain link (`href`) */
export function UiMenuItem(props: UiMenuItemProps) {
  const { icon, tone = 'default', disabled, onTriggered, className, children, ...rest } = props;
  const behaviour = useItem({ disabled, onTriggered });
  const classes = cx('cdk-menu-item ui-menu-item', tone === 'danger' && 'ui-menu-item-danger', disabled && 'cdk-menu-item-disabled', className);
  const content = <>{icon && <NgIcon svg={icon} />}{children}</>;
  const onClick = (event: MouseEvent<any>) => {
    (rest as { onClick?: (event: MouseEvent<any>) => void }).onClick?.(event);
    behaviour.onClick(event);
  };
  if ('to' in rest && rest.to !== undefined) {
    const { to, ...anchor } = rest as { to: To } & AnchorHTMLAttributes<HTMLAnchorElement>;
    return <Link {...anchor} to={to} role="menuitem" {...behaviour} onClick={onClick} className={classes}>{content}</Link>;
  }
  if ('href' in rest && rest.href !== undefined) {
    return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} role="menuitem" {...behaviour} onClick={onClick} className={classes}>{content}</a>;
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} role="menuitem" {...behaviour} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

export type UiMenuItemRadioProps = ItemBehaviour & ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean };

/** A menu item that is one choice out of several; the chosen one shows a check mark */
export function UiMenuItemRadio({ checked, disabled, onTriggered, className, children, ...rest }: UiMenuItemRadioProps) {
  const behaviour = useItem({ disabled, onTriggered });
  return (
    <button type="button" {...rest} role="menuitemradio" aria-checked={!!checked} {...behaviour}
      className={cx('cdk-menu-item ui-menu-item', disabled && 'cdk-menu-item-disabled', className)}>
      {children}
      <NgIcon className="ui-menu-item-check" svg={lucideCheck} />
    </button>
  );
}

export type UiMenuItemCheckboxProps = UiMenuItemRadioProps & { icon?: UiIcon };

/** A menu item that is on or off, such as a setting; on, it shows a check mark */
export function UiMenuItemCheckbox({ icon, checked, disabled, onTriggered, className, children, ...rest }: UiMenuItemCheckboxProps) {
  const behaviour = useItem({ disabled, onTriggered });
  return (
    <button type="button" {...rest} role="menuitemcheckbox" aria-checked={!!checked} {...behaviour}
      className={cx('cdk-menu-item ui-menu-item', disabled && 'cdk-menu-item-disabled', className)}>
      {icon && <NgIcon svg={icon} />}
      {children}
      <NgIcon className="ui-menu-item-check" svg={lucideCheck} />
    </button>
  );
}

/** A small label above a group of items. Name the menu itself with aria-label for screen readers. */
export function UiMenuHeading({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('ui-menu-heading', className)} aria-hidden="true">{children}</div>;
}

export function UiMenuDivider({ className, ...rest }: HTMLAttributes<HTMLHRElement>) {
  return <hr {...rest} className={cx('ui-menu-divider', className)} role="separator" />;
}
