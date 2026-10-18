import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

import { UiButton } from '../button/button';
import { cx } from '../core/types';
import { UiFormField } from '../forms/form-field';
import { UiDialog } from './dialog';

export interface UiConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red, for deleting and other actions that cannot be undone */
  tone?: 'primary' | 'danger';
}

export interface UiPromptOptions extends UiConfirmOptions {
  /** The text field's label, such as "Reason" */
  label: string;
  /** It must not be left blank */
  required?: boolean;
  /** After the label of a field that can be left empty, such as "(optional)" */
  optionalLabel?: string;
  /** Shown when a required field is left blank */
  requiredMessage?: string;
  maxLength?: number;
}

type Question =
  | { id: number; kind: 'confirm'; options: UiConfirmOptions; resolve: (answer: boolean) => void }
  | { id: number; kind: 'prompt'; options: UiPromptOptions; resolve: (answer: string | null) => void };

const useQuestions = create<{ questions: Question[] }>(() => ({ questions: [] }));

let nextQuestion = 0;
let nextPrompt = 0;

/** Answered: the dialog closes, and goes from the page once its closing has had time to show */
function settle(id: number) {
  setTimeout(() => useQuestions.setState(state => ({ questions: state.questions.filter(question => question.id !== id) })), 200);
}

/**
 * Ask a yes/no question in a modal dialog, or ask for a line of text with it, such as a reason. Needs one
 * <UiConfirmHost /> in the app.
 *
 *   if (await uiConfirm.ask({ title: 'Delete 3 users?', message: 'This cannot be undone.', tone: 'danger', confirmLabel: 'Delete' })) { ... }
 *   const reason = await uiConfirm.prompt({ title: 'Suspend Ann?', label: 'Reason', required: true, confirmLabel: 'Suspend' });
 *   if (reason !== null) { ... }   // the text, trimmed; null when cancelled
 */
export const uiConfirm = {
  ask(options: UiConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      const id = nextQuestion++;
      useQuestions.setState(state => ({ questions: [...state.questions, { id, kind: 'confirm', options, resolve }] }));
    });
  },
  prompt(options: UiPromptOptions): Promise<string | null> {
    return new Promise(resolve => {
      const id = nextQuestion++;
      useQuestions.setState(state => ({ questions: [...state.questions, { id, kind: 'prompt', options, resolve }] }));
    });
  },
};

/**
 * Where uiConfirm's dialogs open: each in its own element at the end of <body>, as the Angular app's
 * UiConfirmService puts them
 */
export function UiConfirmHost() {
  const questions = useQuestions(state => state.questions);
  return (
    <>
      {questions.map(question => createPortal(
        question.kind === 'confirm'
          ? <ConfirmDialog options={question.options} onAnswer={answer => { question.resolve(answer); settle(question.id); }} />
          : <PromptDialog options={question.options} onAnswer={answer => { question.resolve(answer); settle(question.id); }} />,
        document.body,
        String(question.id),
      ))}
    </>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: UiConfirmOptions; onAnswer: (answer: boolean) => void }) {
  const [open, setOpen] = useState(true);
  const done = useRef(false);
  const answer = (confirmed: boolean) => {
    if (!done.current) {
      done.current = true;
      setOpen(false);
      onAnswer(confirmed);
    }
  };
  return (
    <ui-confirm-dialog>
      <UiDialog open={open} onOpenChange={next => !next && answer(false)} title={options.title} description={options.message ?? ''} size="sm"
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => answer(false)}>{options.cancelLabel ?? 'Cancel'}</UiButton>
          <UiButton type="button" variant={options.tone === 'danger' ? 'danger' : 'primary'} onClick={() => answer(true)}>{options.confirmLabel ?? 'Confirm'}</UiButton>
        </>} />
    </ui-confirm-dialog>
  );
}

function PromptDialog({ options, onAnswer }: { options: UiPromptOptions; onAnswer: (answer: string | null) => void }) {
  const [open, setOpen] = useState(true);
  const [formId] = useState(() => `ui-prompt-${nextPrompt++}`);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** Sent blank while it must not be: the error until the text changes, as the Angular form's setErrors */
  const [blankRefused, setBlankRefused] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  const answer = (value: string | null) => {
    if (!done.current) {
      done.current = true;
      setOpen(false);
      onAnswer(value);
    }
  };
  const submit = () => {
    if (options.required && !text.trim()) {
      setBlankRefused(true);
      setTouched(true);
      field.current?.focus();
      return;
    }
    answer(text.trim());
  };

  return (
    <ui-prompt-dialog>
      <UiDialog open={open} onOpenChange={next => !next && answer(null)} title={options.title} description={options.message ?? ''} size="sm"
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => answer(null)}>{options.cancelLabel ?? 'Cancel'}</UiButton>
          <UiButton type="submit" form={formId} variant={options.tone === 'danger' ? 'danger' : 'primary'}>{options.confirmLabel ?? 'Confirm'}</UiButton>
        </>}>
        <form id={formId} onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
          <UiFormField label={options.label} for={`${formId}-text`} required={!!options.required}
            optionalLabel={options.required ? '' : options.optionalLabel ?? ''} errors={{ required: options.requiredMessage ?? 'This field is required.' }}
            control={{ errors: blankRefused ? { required: true } : null, touched, dirty }}>
            <textarea ref={field} className={cx('ui-input', blankRefused && 'ng-invalid ng-touched')} id={`${formId}-text`} rows={3} maxLength={options.maxLength} value={text}
              onChange={event => { setText(event.target.value); setDirty(true); setBlankRefused(false); }} onBlur={() => setTouched(true)}></textarea>
          </UiFormField>
        </form>
      </UiDialog>
    </ui-prompt-dialog>
  );
}
