import { act, fireEvent } from '@testing-library/react';

import { renderAt } from '../../testing-render';
import { configureUserManagement } from '../../user-management/config';
import { AdminApiError, type AdminApi } from '../../user-management/data/admin-api';
import { ForgotPasswordComponent } from './forgot-password';

describe('ForgotPasswordComponent', () => {
  let element: HTMLElement;
  let api: { requestPasswordReset: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = { requestPasswordReset: vi.fn().mockResolvedValue(undefined) };
    configureUserManagement({ api: api as unknown as AdminApi });
    element = (await renderAt(<ForgotPasswordComponent />, '/forgot-password')).container;
  });

  async function send(email: string) {
    fireEvent.input(element.querySelector<HTMLInputElement>('#resetEmail')!, { target: { value: email } });
    await act(async () => {
      element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await new Promise(resolve => setTimeout(resolve));
    });
  }

  it('asks for a reset link and says the same whoever the email belongs to', async () => {
    await send('ann@example.com');
    expect(api.requestPasswordReset).toHaveBeenCalledWith('ann@example.com');
    expect(element.querySelector('ui-alert')!.textContent).toContain('resetLinkSent');
    expect(element.querySelector('form')).toBeNull();
  });

  it('does not send an address that is not an email', async () => {
    await send('not an email');
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('says when there were too many attempts', async () => {
    api.requestPasswordReset.mockRejectedValue(new AdminApiError('too_many_requests'));
    await send('ann@example.com');
    expect(element.textContent).toContain('Too many attempts.');
  });
});
