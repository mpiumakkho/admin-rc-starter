import { configureUserManagement } from './user-management/config';
import { LocalAdminApi } from './user-management/data/local-admin-api';
import { App } from './app';
import { renderAt } from './testing-render';

describe('App', () => {
  beforeEach(() => configureUserManagement({ api: new LocalAdminApi() }));

  it('should create the app', async () => {
    const { container } = await renderAt(<App />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render the navbar, sidebar and footer around the page content', async () => {
    const { container } = await renderAt(<App />);
    expect(container.querySelector('app-navbar')).toBeTruthy();
    expect(container.querySelector('app-sidebar')).toBeTruthy();
    expect(container.querySelector('app-footer')).toBeTruthy();
  });
});
