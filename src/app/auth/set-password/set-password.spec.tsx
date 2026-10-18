import { act, fireEvent } from '@testing-library/react';

import { renderAt } from '../../testing-render';
import { configureUserManagement } from '../../user-management/config';
import { AdminApiError, type AdminApi } from '../../user-management/data/admin-api';
import { SetPasswordComponent } from './set-password';

describe('SetPasswordComponent', () => {
  let element: HTMLElement;
  let api: {
    acceptInvitation: ReturnType<typeof vi.fn>;
    confirmPasswordReset: ReturnType<typeof vi.fn>;
    getPasswordPolicy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { acceptInvitation: vi.fn(), confirmPasswordReset: vi.fn(), getPasswordPolicy: vi.fn().mockResolvedValue({ minLength: 8, history: 0 }) };
    configureUserManagement({ api: api as unknown as AdminApi });
  });

  /** The page at its address: ?token=… from the link, an invitation unless `link` says reset */
  async function open(path: string, link: 'invite' | 'reset' = 'invite') {
    element = (await renderAt(<SetPasswordComponent link={link} />, path)).container;
  }

  async function fill(password: string, repeat: string) {
    for (const [id, value] of [['newPassword', password], ['repeatPassword', repeat]]) {
      fireEvent.input(element.querySelector<HTMLInputElement>(`#${id}`)!, { target: { value } });
    }
    await act(async () => {
      element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await new Promise(resolve => setTimeout(resolve));
    });
  }

  it('says when the link has no token', async () => {
    await open('/activate');
    expect(element.textContent).toContain('This link is not complete.');
    expect(element.querySelector('form')).toBeNull();
  });

  it('accepts an invitation, and does not send passwords that do not match', async () => {
    await open('/activate?token=invite-token');
    await fill('first-password-1', 'something-else');
    expect(api.acceptInvitation).not.toHaveBeenCalled();

    await fill('first-password-1', 'first-password-1');
    expect(api.acceptInvitation).toHaveBeenCalledWith('invite-token', 'first-password-1');
  });

  it('asks for the shortest password the settings allow', async () => {
    api.getPasswordPolicy.mockResolvedValue({ minLength: 12, history: 0 });
    await open('/activate?token=invite-token');
    // The page takes the rule once the settings answer: wait for that, however busy the machine is
    await act(() => api.getPasswordPolicy.mock.results[0].value);
    expect(element.textContent).toContain('atLeastCharacters');

    await fill('eleven-char', 'eleven-char');
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    await fill('twelve-chars', 'twelve-chars');
    expect(api.acceptInvitation).toHaveBeenCalledWith('invite-token', 'twelve-chars');
  });

  it('offers a new link when a reset link no longer works', async () => {
    api.confirmPasswordReset.mockRejectedValue(new AdminApiError('invalid_token'));
    await open('/reset-password?token=used-token', 'reset');
    await fill('new-password-1', 'new-password-1');
    expect(element.textContent).toContain('This link has expired or was already used.');
    expect(element.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });
});
