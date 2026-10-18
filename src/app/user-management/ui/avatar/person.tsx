import type { HTMLAttributes } from 'react';

import { cx } from '../core/types';
import { UiAvatar, type UiAvatarSize } from './avatar';
import './person.scss';

export interface UiPersonProps extends HTMLAttributes<HTMLElement> {
  name?: string;
  detail?: string;
  src?: string | null;
  size?: UiAvatarSize;
}

/**
 * Avatar with a name and a second line (email, role, job title). Extra content appears after the name.
 *
 *   <UiPerson name="Henry Klein" detail="henry@example.com" src="..." />
 */
export function UiPerson({ name = '', detail = '', src = '', size = 'sm', className, children, ...rest }: UiPersonProps) {
  return (
    <ui-person {...rest} className={cx('ui-person', className)}>
      <UiAvatar name={name} src={src} size={size} />
      <span className="ui-person-text">
        <span className="ui-person-name">{name}{children}</span>
        {detail && <span className="ui-person-detail">{detail}</span>}
      </span>
    </ui-person>
  );
}
