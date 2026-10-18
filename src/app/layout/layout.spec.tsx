import { renderAt } from '../testing-render';
import { configureUserManagement } from '../user-management/config';
import { LocalAdminApi } from '../user-management/data/local-admin-api';
import { Footer } from './footer/footer';
import { Navbar } from './navbar/navbar';
import { Sidebar } from './sidebar/sidebar';
import { Spinner } from './spinner/spinner';

// The Angular app's "should create" tests of the layout's parts, one each
describe('the layout', () => {
  beforeEach(() => configureUserManagement({ api: new LocalAdminApi() }));

  it.each([
    ['Spinner', Spinner, 'app-spinner'],
    ['Footer', Footer, 'app-footer'],
    ['Navbar', Navbar, 'app-navbar'],
    ['Sidebar', Sidebar, 'app-sidebar'],
  ])('%s should create', async (_name, Part, tag) => {
    const { container } = await renderAt(<Part />);
    expect(container.querySelector(tag)).toBeTruthy();
  });
});
