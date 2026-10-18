import type { Activity } from '../data/models';
import { useFormat } from '../shared/formatting';
import { UiButton, UiDialog, UiLinkButton } from '../ui';
import { ActivityDetails, targetTo } from './activity-details';
import { useActivityFormat } from './activity-format';

export interface ActivityDialogProps {
  /** The entry to show; null keeps the dialog closed */
  entry: Activity | null;
  onClosed: () => void;
}

/** One activity entry in a dialog, with a button to the user or role it was about. Used by the log and the overview. */
export function ActivityDialog({ entry, onClosed }: ActivityDialogProps) {
  const f = useFormat();
  const format = useActivityFormat();
  const title = entry ? format.action(entry) : '';
  const target = entry ? format.target(entry) : null;
  return (
    <app-activity-dialog>
      <UiDialog open={!!entry} onOpenChange={open => !open && onClosed()} title={title} size="lg" closeLabel={f.t('Close')}
        footer={<>
          {target && (
            <UiLinkButton variant="secondary" to={targetTo(target)}>
              {` ${f.t(entry?.action?.startsWith('role.') ? 'Open role' : 'View profile')} `}
            </UiLinkButton>
          )}
          <UiButton type="button" onClick={onClosed}>{f.t('Close')}</UiButton>
        </>}>
        {entry && <ActivityDetails entry={entry} />}
      </UiDialog>
    </app-activity-dialog>
  );
}
