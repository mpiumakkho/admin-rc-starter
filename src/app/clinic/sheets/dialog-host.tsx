import { useState } from 'react';

import { UiAlert, UiButton, UiDialog, UiFormField } from '../../user-management/ui';
import { clinicUi, useClinicUi, type DialogField, type DialogRequest } from '../clinic-ui';
import { useClinicI18n } from '../i18n/clinic-i18n';

/** The fields' values a question starts with, from what each field brings */
function startValues(request: DialogRequest | null): Record<string, string> {
  const fields = request?.fields ?? [];
  return Object.fromEntries(fields.map(f => [f.name, f.value ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')]));
}

/**
 * The workspace's confirmation dialog, with fields when a decision needs them (the design's openDialog): a reason, a
 * finding, how a result was acknowledged. Confirm stays off until every field it needs will do.
 */
export function DialogHost() {
  const request = useClinicUi(state => state.dialog);
  const { tx } = useClinicI18n();

  // A new question starts from its fields' values, untouched
  const [values, setValues] = useState(() => startValues(request));
  /** The fields someone has changed; their errors show. All of them, once Confirm was pressed */
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [question, setQuestion] = useState(request);
  if (question !== request) {
    setQuestion(request);
    setValues(startValues(request));
    setTouched(new Set());
    setSubmitted(false);
  }

  const set = (name: string, value: string) => {
    setValues(current => ({ ...current, [name]: value }));
    setTouched(current => new Set(current).add(name));
  };
  const shown = (field: DialogField) => submitted || touched.has(field.name);
  const error = (field: DialogField): string | null => {
    const value = values[field.name] ?? '';
    if (!field.optional && field.type !== 'checkbox' && !value.trim()) {
      return 'กรุณากรอกข้อมูล';
    }
    return field.validate?.(value, values) ?? null;
  };
  const valid = (request?.fields ?? []).every(field => !error(field));

  const confirm = () => {
    if (!request || !valid) {
      setSubmitted(true);
      return;
    }
    // Read before closing: the values start over with the next question
    const answer = values;
    clinicUi.closeDialog();
    request.onConfirm(answer);
  };

  return (
    <cl-dialog-host className="contents">
      <UiDialog open={!!request} onOpenChange={open => open || clinicUi.closeDialog()} title={tx(request?.title ?? '')} size="sm" closeLabel={tx('ปิด')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => clinicUi.closeDialog()}>{tx('ยกเลิก')}</UiButton>
          <UiButton type="button" variant={request?.tone === 'danger' ? 'danger' : 'primary'} disabled={!valid} onClick={confirm}>
            {` ${tx(request?.confirmLabel ?? '')} `}
          </UiButton>
        </>}>
        {request && (
          <div className="clinic-dialog">
            {(request.intro ?? []).map((line, index) => <p key={index} className="dialog-text">{tx(line)}</p>)}
            {request.facts?.length ? (
              <dl className="data-grid">
                {request.facts.map((fact, index) => [
                  <dt key={`t${index}`}>{tx(fact[0])}</dt>,
                  <dd key={`d${index}`}>{tx(fact[1])}</dd>,
                ])}
              </dl>
            ) : null}
            {request.warning && <UiAlert tone="danger">{tx(request.warning)}</UiAlert>}
            {(request.fields ?? []).map(field => {
              const message = shown(field) ? error(field) : null;
              const invalid = shown(field) && !!error(field);
              if (field.type === 'checkbox') {
                return (
                  <label key={field.name} className="check">
                    <input type="checkbox" checked={values[field.name] === 'yes'} onChange={event => set(field.name, event.target.checked ? 'yes' : '')} />
                    {` ${tx(field.label)} `}
                  </label>
                );
              }
              const id = `dlg-${field.name}`;
              return (
                <UiFormField key={field.name} label={tx(field.label)} for={id} optionalLabel={field.optional ? tx('(ไม่บังคับ)') : ''}>
                  {field.type === 'select' ? (
                    <select className="ui-input" id={id} value={values[field.name]} onChange={event => set(field.name, event.target.value)} aria-invalid={invalid}>
                      {(field.options ?? []).map(option => <option key={option.value} value={option.value}>{tx(option.label)}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea className="ui-input" id={id} rows={3} value={values[field.name]} placeholder={tx(field.placeholder ?? '')}
                      onChange={event => set(field.name, event.target.value)} aria-invalid={invalid}></textarea>
                  ) : (
                    <input className="ui-input" id={id} value={values[field.name]} placeholder={tx(field.placeholder ?? '')}
                      onChange={event => set(field.name, event.target.value)} aria-invalid={invalid} />
                  )}
                  {message && <p className="field-error" role="alert">{tx(message)}</p>}
                </UiFormField>
              );
            })}
            {request.after && <p className="secondary">{tx(request.after)}</p>}
          </div>
        )}
      </UiDialog>
    </cl-dialog-host>
  );
}
