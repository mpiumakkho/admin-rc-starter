import { renderAt } from '../testing-render';
import { Error404Component } from './error404';
import { Error500Component } from './error500';

describe('the error pages', () => {
  it('Error404Component should create', async () => {
    const { container } = await renderAt(<Error404Component />, '/error-pages/404');
    expect(container.querySelector('app-error404')).toBeTruthy();
  });

  it('Error500Component should create', async () => {
    const { container } = await renderAt(<Error500Component />, '/error-pages/500');
    expect(container.querySelector('app-error500')).toBeTruthy();
  });
});
