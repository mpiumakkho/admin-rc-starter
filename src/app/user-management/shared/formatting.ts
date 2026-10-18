import i18next from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SAMPLE_NAMES } from '../data/mock-data';

/** A translation function, such as i18next's t or useTranslation().t */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** i18next's t, for code outside components (ngx-translate's instant()) */
export const translate: Translate = (key, params) => i18next.t(key, params) as string;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** An idle timeout as people say it: "Never", "30 minutes", "1 hour", "4 hours" */
export function idleTimeoutLabel(t: Translate, minutes: number): string {
  return minutes ? minutesLabel(t, minutes) : t('Never sign out');
}

/** How long a sign-in or a confirmed password lets someone make risky changes: "10 minutes", "1 hour", or never asking */
export function reauthLabel(t: Translate, minutes: number): string {
  return minutes ? minutesLabel(t, minutes) : t('Never ask again');
}

/** How long an account may go unused before it is suspended: "90 days", or never */
export function inactiveLabel(t: Translate, days: number): string {
  return days ? t('dayCount', { count: days }) : t('Never suspend');
}

/** "15 minutes", "1 hour", "8 hours" */
function minutesLabel(t: Translate, minutes: number): string {
  if (minutes % 60) {
    return t('minuteCount', { count: minutes });
  }
  return minutes === 60 ? t('1 hour') : t('hourCount', { count: minutes / 60 });
}

/** How long the activity log keeps entries: "90 days", "1 year", "5 years" */
export function retentionLabel(t: Translate, days: number): string {
  if (days % 365) {
    return t('dayCount', { count: days });
  }
  return days === 365 ? t('1 year') : t('yearCount', { count: days / 365 });
}

/** The password history setting: "Any password", "Not the current one", "Not the last 3" */
export function passwordHistoryLabel(t: Translate, count: number): string {
  if (!count) {
    return t('Any password');
  }
  return count === 1 ? t('Not the current one') : t('notLastPasswords', { count });
}

/** Locale for Intl formatting: Thai uses the Buddhist calendar, as Thai readers expect */
export function intlLocale(language: string): string {
  return language === 'th' ? 'th-TH' : 'en-GB';
}

/** "3 hours ago" / "3 ชั่วโมงที่แล้ว", in the interface language */
export function timeAgo(iso: string, language: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(intlLocale(language), { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(0, 'second');
}

/**
 * A name in the interface language when it comes from the sample data, such as a sample access review's (SAMPLE_NAMES);
 * a name someone typed, as they typed it
 */
export function localName(t: Translate, name: string): string {
  return SAMPLE_NAMES.has(name) ? t(name) : name;
}

export type LocalDateStyle = 'medium' | 'long' | 'full' | 'time' | 'datetime';

/**
 * A date in the interface language.
 *
 *   localDate('th', user.createdAt)               4 ต.ค. 2569
 *   localDate('th', entry.at, 'time')             14:05
 *   localDate('th', entry.at, 'long')             วันเสาร์ที่ 4 ตุลาคม 2569
 *   localDate('th', entry.at, 'full')             วันเสาร์ที่ 4 ตุลาคม 2569 เวลา 14:05:32
 */
export function localDate(language: string, iso: string | null | undefined, style: LocalDateStyle = 'medium'): string {
  if (!iso) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions =
    style === 'time' ? { timeStyle: 'short' }
    : style === 'datetime' ? { dateStyle: 'medium', timeStyle: 'short' }
    : style === 'long' ? { dateStyle: 'full' }
    : style === 'full' ? { dateStyle: 'full', timeStyle: 'medium' }
    : { dateStyle: 'medium' };
  return new Intl.DateTimeFormat(intlLocale(language), options).format(new Date(iso));
}

/** The interface language as i18next has it, for code outside components */
export function currentLanguage(): string {
  return i18next.language ?? '';
}

export interface Format {
  t: Translate;
  /** The interface language: 'th' or 'en' */
  language: string;
  /** Time since a date, in the interface language (the timeAgo pipe) */
  timeAgo(iso: string | null | undefined, fallback?: string): string;
  /** A date in the interface language (the localDate pipe) */
  localDate(iso: string | null | undefined, style?: LocalDateStyle): string;
  /** A sample name in the interface language (the localName pipe) */
  localName(name: string): string;
}

/**
 * Translation and the formats the Angular app's pipes give, in a component; it renders again when the language
 * changes, as those pipes follow it
 *
 *   const f = useFormat();
 *   <span>{f.t('Active')}</span> <span>{f.localDate(user.createdAt)}</span>
 */
export function useFormat(): Format {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const translateWith: Translate = (key, params) => t(key, params) as string;
    return {
      t: translateWith,
      language,
      timeAgo: (iso, fallback = '') => iso ? timeAgo(iso, language) : fallback,
      localDate: (iso, style) => localDate(language, iso, style),
      localName: name => localName(translateWith, name),
    };
  }, [t, language]);
}
