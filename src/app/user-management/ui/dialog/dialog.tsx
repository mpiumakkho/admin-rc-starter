import { useLayoutEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';

import { lucideX } from '../../../icons';
import { UiButton } from '../button/button';
import { NgIcon } from '../icon/icon';
import './dialog.scss';

let nextId = 0;

export interface UiDialogProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
  /**
   * Close with Escape, the close button or a click on the dimmed area around the dialog. Without it, only the
   * dialog's own buttons close it, for a question that must be answered.
   */
  dismissible?: boolean;
  /** The button row at the bottom ([uiDialogFooter] in the Angular app) */
  footer?: ReactNode;
}

/**
 * A modal dialog on the native <dialog> element: focus stays inside, Escape closes it.
 *
 *   <UiDialog open={editing} onOpenChange={setEditing} title="Edit role" description="Change its name and description"
 *     footer={<><UiButton variant="secondary" onClick={() => setEditing(false)}>Cancel</UiButton><UiButton onClick={save}>Save</UiButton></>}>
 *     ...form...
 *   </UiDialog>
 */
export function UiDialog({
  open, onOpenChange, title = '', description = '', size = 'md', closeLabel = 'Close', dismissible = true, footer, className, children, ...rest
}: UiDialogProps) {
  const [titleId] = useState(() => `ui-dialog-title-${nextId++}`);
  const dialog = useRef<HTMLDialogElement>(null);

  const shown = useRef(false);
  useLayoutEffect(() => {
    const element = dialog.current!;
    if (open && !element.open) {
      // One that is open from the start, as UiConfirmService's questions are, opens in the Angular app before its close
      // button is drawn: the focus goes to the first control of its content (the reason to type), not to that button
      const close = shown.current ? null : element.querySelector<HTMLElement>('.ui-dialog-head > button');
      close?.setAttribute('inert', '');
      element.showModal();
      close?.removeAttribute('inert');
    } else if (!open && element.open) {
      element.close();
    }
    shown.current = true;
  }, [open]);

  const cancel = (event: SyntheticEvent) => {
    if (!dismissible) {
      event.preventDefault();
    }
  };
  const closed = () => {
    // The browser can still close a modal on a second Escape; one that must be answered opens again
    if (!dismissible && open) {
      dialog.current!.showModal();
    } else if (open) {
      onOpenChange?.(false);
    }
  };
  const closeOnBackdrop = (event: MouseEvent) => {
    // The panel fills the dialog box, so a click that lands on the <dialog> itself is on the backdrop
    if (dismissible && event.target === dialog.current) {
      onOpenChange?.(false);
    }
  };

  return (
    <ui-dialog {...rest} className={className}>
      <dialog ref={dialog} className={`ui-dialog ui-dialog-${size}`} aria-labelledby={titleId} onCancel={cancel} onClose={closed} onClick={closeOnBackdrop}>
        <div className="ui-dialog-panel">
          <header className="ui-dialog-head">
            <div>
              <h2 className="ui-dialog-title" id={titleId}>{title}</h2>
              {description && <p className="ui-dialog-description">{description}</p>}
            </div>
            {dismissible && (
              <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={closeLabel} onClick={() => onOpenChange?.(false)}>
                <NgIcon svg={lucideX} />
              </UiButton>
            )}
          </header>
          <div className="ui-dialog-body">{children}</div>
          {footer !== undefined && footer !== null && footer !== false && (
            <footer className="ui-dialog-foot">
              <div {...{ uidialogfooter: '' }}>{footer}</div>
            </footer>
          )}
        </div>
      </dialog>
    </ui-dialog>
  );
}

