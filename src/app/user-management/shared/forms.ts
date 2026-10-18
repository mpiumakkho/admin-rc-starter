import { get, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

import type { UiFieldControl } from '../ui';

/**
 * How every form here behaves, as an Angular reactive form does: each field is checked once it is changed or left, and
 * every field when the form is sent; sending a form with mistakes leaves the focus where it was.
 *
 *   const form = useForm<LoginForm>({ ...FORM_BEHAVIOUR, defaultValues: { email: '' } });
 */
export const FORM_BEHAVIOUR = { mode: 'all', shouldFocusError: false } as const;

/**
 * A field's state for UiFormField, as an Angular control has it: its error once it has been checked. The forms run with
 * react-hook-form's mode 'all', so a field is checked once it is changed or left, and every field when the form is
 * sent: when Angular's form field shows an error (touched or dirty, or all touched on submit).
 *
 *   <UiFormField label="Email" errors={{ required: '…', email: '…' }} control={fieldControl(form, 'email')}>
 */
export function fieldControl<T extends FieldValues>(form: UseFormReturn<T>, name: Path<T>): UiFieldControl {
  const error = get(form.formState.errors, name) as { type?: string } | undefined;
  return { errors: error?.type ? { [error.type]: true } : null, touched: true, dirty: true };
}

/**
 * The classes Angular gives a control left (or sent) with a value that is not right, which the library's inputs show in
 * red (.ui-input.ng-invalid.ng-touched)
 *
 *   <input className={cx('ui-input', invalidClass(form, 'email'))} {...form.register('email', { required: true })} />
 */
export function invalidClass<T extends FieldValues>(form: UseFormReturn<T>, name: Path<T>): string | undefined {
  const { errors, touchedFields, isSubmitted } = form.formState;
  return get(errors, name) && (get(touchedFields, name) || isSubmitted) ? 'ng-invalid ng-touched' : undefined;
}

/**
 * The attribute Angular's reactive forms leave on a control bound with formControlName, formcontrolname="email", so the
 * page is the same as the Angular app's to anything that looks for it (tests, tools)
 *
 *   <input {...controlName('email')} {...form.register('email')} />
 */
export function controlName(name: string): Record<string, string> {
  return { formcontrolname: name };
}

/** A valid email, as Angular's Validators.email checks it */
export const EMAIL_PATTERN = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
