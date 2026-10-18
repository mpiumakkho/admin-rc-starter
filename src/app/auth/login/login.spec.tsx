import { renderAt } from '../../testing-render';
import { configureUserManagement } from '../../user-management/config';
import { LocalAdminApi } from '../../user-management/data/local-admin-api';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  beforeEach(() => configureUserManagement({ api: new LocalAdminApi() }));

  it('should create', async () => {
    const { container } = await renderAt(<LoginComponent />, '/login');
    expect(container.querySelector('app-login')).toBeTruthy();
  });
});
