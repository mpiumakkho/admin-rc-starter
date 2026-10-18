import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

/**
 * For unit tests: a component on a page of its own, at an address (with its query string), inside a router as the app
 * has one, as the Angular tests' TestBed with provideRouter.
 *
 *   const { container } = await renderAt(<LoginComponent />, '/login');
 */
export async function renderAt(element: ReactElement, path = '/') {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] });
  const result = render(<RouterProvider router={router} />);
  // The router settles before the page shows
  await new Promise(resolve => setTimeout(resolve));
  return { ...result, router };
}
