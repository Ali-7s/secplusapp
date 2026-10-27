import { routes } from './app.routes';

describe('routes', () => {
  it('sends the home page and unknown URLs to the Today plan', () => {
    expect(routes.find(r => r.path === '')?.redirectTo).toBe('/today');
    expect(routes.find(r => r.path === '**')?.redirectTo).toBe('/today');
    expect(routes.find(r => r.path === 'progress')?.redirectTo).toBe('/today');
  });

  it('has the study pages, the networking lessons and the practice exam', () => {
    expect(routes.map(r => r.path)).toEqual(['', 'networking', 'networking/:slug', 'acronyms', 'terms', 'exam', 'objectives', 'today', 'progress', 'reference', '**']);
  });
});
