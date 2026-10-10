import { routes } from './app.routes';

describe('routes', () => {
  it('sends the home page and unknown URLs to the acronym glossary', () => {
    expect(routes.find(r => r.path === '')?.redirectTo).toBe('/acronyms');
    expect(routes.find(r => r.path === '**')?.redirectTo).toBe('/acronyms');
  });

  it('has the study pages and the networking lessons, and no practice exam route', () => {
    expect(routes.map(r => r.path)).toEqual(['', 'networking', 'networking/:slug', 'acronyms', 'terms', 'reference', '**']);
  });
});
