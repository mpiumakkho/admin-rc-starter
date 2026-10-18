import { adminStore } from '../data/admin-store';
import type { ReasonAction } from '../data/models';
import { uiConfirm, type UiConfirmOptions } from '../ui';
import { translate } from './formatting';

/** As long as a reason may be (API.md, "Reasons") */
export const MAX_REASON = 500;

/**
 * Confirms a change that takes or resets someone's access with the reason the activity log keeps (API.md, "Reasons"):
 * required when the settings' reasonsRequired lists the action, optional otherwise.
 *
 *   const reason = await reasonPrompt.ask('delete', { title: 'Delete Ann?', confirmLabel: 'Delete', tone: 'danger' });
 *   if (reason !== null) { await adminStore.deleteUsers([id], reason || undefined); }
 *
 * A change that asks nothing first, such as suspending someone, passes `onlyIfRequired`: it then asks only when the
 * settings require a reason, and answers '' at once otherwise.
 */
export const reasonPrompt = {
  /** The reason, trimmed and maybe empty; null when cancelled */
  async ask(action: ReasonAction, options: UiConfirmOptions, onlyIfRequired = false): Promise<string | null> {
    const required = adminStore.state.settings.reasonsRequired.includes(action);
    if (!required && onlyIfRequired) {
      return '';
    }
    return uiConfirm.prompt({
      cancelLabel: translate('Cancel'),
      ...options,
      label: translate('Reason'),
      required,
      optionalLabel: translate('(optional)'),
      requiredMessage: translate('Give a reason. The activity log keeps it.'),
      maxLength: MAX_REASON,
    });
  },
};
