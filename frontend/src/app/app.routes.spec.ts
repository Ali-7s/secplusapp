import { routes } from './app.routes';

describe('routes', () => {
  it('sends the home page and unknown URLs to the Today plan', () => {
    expect(routes.find(r => r.path === '')?.redirectTo).toBe('/today');
    expect(routes.find(r => r.path === '**')?.redirectTo).toBe('/today');
    expect(routes.find(r => r.path === 'progress')?.redirectTo).toBe('/today');
  });

  it('sends the old networking lesson links to the lessons page', () => {
    expect(routes.find(r => r.path === 'networking')?.redirectTo).toBe('/lessons');
    expect(routes.find(r => r.path === 'networking/:slug')?.redirectTo).toBe('/lessons/:slug');
  });

  it('has the study pages, the lessons and the practice exam', () => {
    expect(routes.map(r => r.path)).toEqual(['', 'lessons', 'lessons/:slug', 'networking', 'networking/:slug', 'acronyms', 'terms', 'exam', 'objectives', 'today', 'progress', 'soc', 'soc/:id', 'ports', 'reference', '**']);
  });
});
