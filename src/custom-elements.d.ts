/*
 * The app renders the same element names the Angular app does for its components (<ui-card>, <app-navbar>,
 * <ng-icon> and so on), so the styles, which select them, and the end-to-end tests stay the same. Any name with a
 * hyphen is allowed in JSX, with the usual HTML attributes.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type CustomElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attribute: string]: unknown;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [tag: `${string}-${string}`]: CustomElementProps;
    }
  }
}
