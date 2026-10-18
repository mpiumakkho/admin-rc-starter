import { useState } from 'react';

import { lucideCheck, lucideCopy, lucideDownload } from '../../icons';
import { downloadText } from '../shared/csv';
import { useFormat } from '../shared/formatting';
import { NgIcon, UiAlert, UiButton } from '../ui';
import './recovery-codes.scss';

/**
 * Recovery codes, shown once when they are made (API.md, "Recovery codes"): each stands in for a code from the app,
 * once, when the phone is lost. People copy or download them to keep somewhere safe, such as a password manager.
 */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const { t } = useFormat();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard?.writeText(codes.join('\n')).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => downloadText('recovery-codes.txt', codes.join('\n') + '\n', 'text/plain;charset=utf-8;');

  return (
    <app-recovery-codes>
      <UiAlert tone="warning">{t('recoveryCodesOnce')}</UiAlert>
      <ol className="recovery-codes" aria-label={t('Recovery codes')}>
        {codes.map(code => <li key={code}><code>{code}</code></li>)}
      </ol>
      <div className="recovery-actions">
        <UiButton variant="secondary" size="sm" type="button" onClick={copy}>
          <NgIcon svg={copied ? lucideCheck : lucideCopy} />{` ${t(copied ? 'Copied' : 'Copy all')} `}
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" onClick={download}>
          <NgIcon svg={lucideDownload} />{` ${t('Download')} `}
        </UiButton>
      </div>
    </app-recovery-codes>
  );
}
