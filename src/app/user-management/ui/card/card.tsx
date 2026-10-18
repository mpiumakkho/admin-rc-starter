import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../core/types';
import './card.scss';

export interface UiCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: string;
  description?: string;
  /** Shown at the right of the header, such as buttons or a menu ([uiCardActions] in the Angular app) */
  actions?: ReactNode;
  /** A strip at the bottom of the card, usually form buttons ([uiCardFooter]) */
  footer?: ReactNode;
  /** Classes for the footer's own element, as on <div uiCardFooter class="…"> in the Angular app */
  footerClassName?: string;
  flush?: boolean;
  fit?: boolean;
  fill?: boolean;
}

/**
 * A surface with an optional header (title, description, actions) and footer.
 *
 *   <UiCard title="Users" description="Everyone with access" actions={<UiButton>Add</UiButton>} footer={…}>
 *     ...body...
 *   </UiCard>
 *
 * Set `flush` to drop the body padding, for tables and lists that run edge to edge.
 * Set `fit` to make the card take the height its parent gives it, in a flex column such as a page-fit page: the body
 * becomes a column and a scrolling area inside it, such as `.ui-table-scroll`, takes the difference while the rest
 * keeps its size. It shrinks and scrolls for a long table, and grows for a short one, so the pagination under the
 * table stays at the bottom.
 * Set `fill` to make the card take all the height its parent gives it, as a form on a page-fit page does: the body
 * grows to fill it and scrolls when its content is taller, so the footer's buttons stay at the bottom. While it scrolls,
 * the body is a named region in the tab order, so it scrolls from the keyboard too (WCAG 2.1.1).
 */
export function UiCard({ title = '', description = '', actions, footer, footerClassName, flush, fit, fill, className, children, ...rest }: UiCardProps) {
  const body = useRef<HTMLDivElement>(null);
  /** Whether a fill card's body is taller inside than it shows */
  const [scrolls, setScrolls] = useState(false);

  // The content changes with any render, and the space for it with the window
  useLayoutEffect(() => {
    const element = body.current!;
    setScrolls(!!fill && element.scrollHeight > element.clientHeight + 1);
  });
  useLayoutEffect(() => {
    const element = body.current!;
    const observer = new ResizeObserver(() => setScrolls(!!fill && element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fill]);

  const hasActions = actions !== undefined && actions !== null && actions !== false;
  return (
    <ui-card {...rest} className={cx('ui-card', fit && 'ui-card-fit', fill && 'ui-card-fill', className)}>
      {(title || description || hasActions) && (
        <div className="ui-card-head">
          <div className="ui-card-heading">
            {title && <h3 className="ui-card-title">{title}</h3>}
            {description && <p className="ui-card-description">{description}</p>}
          </div>
          <div className="ui-card-actions">{actions}</div>
        </div>
      )}
      <div ref={body} className={cx('ui-card-body', flush && 'ui-card-body-flush')}
        tabIndex={scrolls ? 0 : undefined} role={scrolls ? 'region' : undefined} aria-label={scrolls ? title || undefined : undefined}>
        {children}
      </div>
      {footer !== undefined && footer !== null && footer !== false && (
        <div className="ui-card-footer">
          <div {...{ uicardfooter: '' }} className={footerClassName}>{footer}</div>
        </div>
      )}
    </ui-card>
  );
}
