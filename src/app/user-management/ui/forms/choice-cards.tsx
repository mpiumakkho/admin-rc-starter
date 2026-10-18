import { useState, type HTMLAttributes } from 'react';

import { lucideCircle, lucideCircleCheck } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './choice-cards.scss';

export interface UiChoice<T = string> {
  value: T;
  title: string;
  description?: string;
  /** Short text at the top right, such as a price or a count */
  meta?: string;
  /** Shown but cannot be picked; say why in the description */
  disabled?: boolean;
}

export interface UiChoiceCardsProps<T> extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  choices?: UiChoice<T>[];
  value?: T | null;
  onValueChange?: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  onTouched?: () => void;
}

let nextId = 0;

/**
 * Radio choices as cards, for picking a plan, a role or a layout.
 *
 *   <UiChoiceCards choices={roles} value={roleId} onValueChange={setRoleId} ariaLabel="Role" />
 */
export function UiChoiceCards<T = string>({
  choices = [], value = null, onValueChange, ariaLabel = '', disabled = false, onTouched, className, ...rest
}: UiChoiceCardsProps<T>) {
  const [name] = useState(() => `ui-choice-${nextId++}`);
  return (
    <ui-choice-cards role="radiogroup" aria-label={ariaLabel || undefined} {...rest} className={cx('ui-choice-cards', className)}>
      {choices.map(choice => (
        <label key={String(choice.value)} className={cx('ui-choice', choice.value === value && 'ui-choice-selected', (disabled || choice.disabled) && 'ui-choice-disabled')}>
          <input type="radio" className="ui-sr-only" name={name} checked={choice.value === value} disabled={disabled || choice.disabled}
            onChange={() => onValueChange?.(choice.value)} onBlur={() => onTouched?.()} />
          <span className="ui-choice-head">
            <span className="ui-choice-title">{choice.title}</span>
            {choice.meta && <span className="ui-choice-meta">{choice.meta}</span>}
            <NgIcon className="ui-choice-mark" svg={choice.value === value ? lucideCircleCheck : lucideCircle} />
          </span>
          {choice.description && <span className="ui-choice-description">{choice.description}</span>}
        </label>
      ))}
    </ui-choice-cards>
  );
}
