import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, type UiIcon, type UiTone } from '../core/types';
import { NgIcon } from '../icon/icon';
import './display.scss';

/**
 * A vertical list of events joined by a line.
 *
 *   <UiTimeline>
 *     <UiTimelineItem icon={lucideUserPlus} tone="success" time="2 hours ago">Henry added Jane</UiTimelineItem>
 *   </UiTimeline>
 */
export function UiTimeline({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return <ui-timeline role="list" {...rest} className={cx('ui-timeline', className)}>{children}</ui-timeline>;
}

export interface UiTimelineItemProps extends HTMLAttributes<HTMLElement> {
  icon?: UiIcon;
  tone?: UiTone;
  time?: string;
}

export function UiTimelineItem({ icon, tone = 'neutral', time = '', className, children, ...rest }: UiTimelineItemProps) {
  return (
    <ui-timeline-item role="listitem" {...rest} className={cx('ui-timeline-item', className)}>
      <span className={`ui-tl-marker ui-tl-${tone}`}>{icon && <NgIcon svg={icon} />}</span>
      <div className="ui-tl-body">
        <div className="ui-tl-content">{children}</div>
        {time && <span className="ui-tl-time">{time}</span>}
      </div>
    </ui-timeline-item>
  );
}

export interface UiDetailListProps extends HTMLAttributes<HTMLElement> {
  columns?: number;
}

/**
 * Label and value pairs, such as a profile's details.
 *
 *   <UiDetailList columns={2}>
 *     <UiDetailItem label="Email">jane@example.com</UiDetailItem>
 *   </UiDetailList>
 */
export function UiDetailList({ columns = 1, className, style, children, ...rest }: UiDetailListProps) {
  return (
    <ui-detail-list {...rest} className={cx('ui-detail-list', className)} style={{ '--ui-detail-columns': columns, ...style } as React.CSSProperties}>
      {children}
    </ui-detail-list>
  );
}

export interface UiDetailItemProps extends HTMLAttributes<HTMLElement> {
  label: string;
  /** What an abbreviation in the label stands for, shown on hover and read by screen readers (WCAG 3.1.4) */
  labelTitle?: string;
}

export function UiDetailItem({ label, labelTitle = '', className, children, ...rest }: UiDetailItemProps) {
  return (
    <ui-detail-item {...rest} className={cx('ui-detail-item', className)}>
      {labelTitle ? <abbr className="ui-detail-label" title={labelTitle}>{label}</abbr> : <span className="ui-detail-label">{label}</span>}
      <span className="ui-detail-value">{children}</span>
    </ui-detail-item>
  );
}

export interface UiProgressProps extends HTMLAttributes<HTMLElement> {
  value: number;
  tone?: UiTone;
  label?: string;
  valueLabel?: string;
}

/**
 * A thin progress bar, with an optional label and value above it.
 *
 *   <UiProgress value={72} tone="success" label="Admins" valueLabel="18 of 25" />
 */
export function UiProgress({ value, tone = 'primary', label = '', valueLabel = '', className, ...rest }: UiProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <ui-progress {...rest} className={cx('ui-progress', className)}>
      {(label || valueLabel) && (
        <div className="ui-progress-head">
          <span className="ui-progress-label">{label}</span>
          <span className="ui-progress-value">{valueLabel}</span>
        </div>
      )}
      <div className="ui-progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label || undefined}>
        <div className={`ui-progress-bar ui-progress-${tone}`} style={{ width: `${clamped}%` }}></div>
      </div>
    </ui-progress>
  );
}

export interface UiSplitPart {
  label: string;
  value: number;
  tone: UiTone;
}

export interface UiSplitBarProps extends HTMLAttributes<HTMLElement> {
  parts: UiSplitPart[];
}

/**
 * One thin bar split into colored parts by size, with their labels and numbers under it. For what a
 * total is made of, such as accounts by status.
 *
 *   <UiSplitBar parts={[{ label: 'Active', value: 40, tone: 'success' }, { label: 'Suspended', value: 5, tone: 'danger' }]} />
 */
export function UiSplitBar({ parts, className, ...rest }: UiSplitBarProps) {
  /** What screen readers hear for the bar, such as "Active 40, Suspended 5" */
  const summary = parts.map(part => `${part.label} ${part.value}`).join(', ');
  return (
    <ui-split-bar {...rest} className={cx('ui-split-bar', className)}>
      <div className="ui-split-track" role="img" aria-label={summary}>
        {parts.map(part => part.value > 0 && <span key={part.label} className={`ui-split-part ui-split-${part.tone}`} style={{ flexGrow: part.value }}></span>)}
      </div>
      <div className="ui-split-legend" aria-hidden="true">
        {parts.map(part => (
          <span key={part.label} className="ui-split-key">
            <span className={`ui-split-dot ui-split-${part.tone}`}></span>
            {` ${part.label} `}
            <span className="ui-split-value">{part.value}</span>
          </span>
        ))}
      </div>
    </ui-split-bar>
  );
}

export interface UiLegendItem {
  label: string;
  color: string;
  value?: string | number;
  /** Link that makes the item clickable, for example to a list filtered by it */
  link?: string;
  queryParams?: Record<string, string>;
}

export interface UiChartLegendProps extends HTMLAttributes<HTMLElement> {
  items?: UiLegendItem[];
  layout?: 'inline' | 'list';
}

/**
 * Colored dots with labels, for a chart drawn elsewhere. `list` stacks them with values on the right.
 * Items with a `link` are links.
 *
 *   <UiChartLegend items={[{ label: 'Admins', color: '#6366f1', value: 12, link: '/users', queryParams: { role: 'admin' } }]} layout="list" />
 */
export function UiChartLegend({ items = [], layout = 'inline', className, ...rest }: UiChartLegendProps) {
  const content = (item: UiLegendItem): ReactNode => (
    <>
      <span className="ui-legend-dot" style={{ background: item.color }}></span>
      <span className="ui-legend-label">{item.label}</span>
      {item.value !== undefined && <span className="ui-legend-value">{item.value}</span>}
    </>
  );
  return (
    <ui-chart-legend {...rest} className={cx(`ui-chart-legend ui-chart-legend-${layout}`, className)}>
      {items.map(item => item.link
        ? (
          <Link key={item.label} className="ui-legend-item ui-legend-link"
            to={{ pathname: item.link, search: item.queryParams ? `?${new URLSearchParams(item.queryParams)}` : '' }}>
            {content(item)}
          </Link>
        )
        : <span key={item.label} className="ui-legend-item">{content(item)}</span>)}
    </ui-chart-legend>
  );
}
