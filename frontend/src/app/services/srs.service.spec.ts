import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SrsService } from './srs.service';

describe('SrsService', () => {
  let srs: SrsService;
  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    srs = TestBed.inject(SrsService);
  });

  it('maps brain-dump coverage to SM-2 quality grades', () => {
    expect(srs.qualityFromScore(95)).toBe(5);
    expect(srs.qualityFromScore(70)).toBe(4);
    expect(srs.qualityFromScore(55)).toBe(3);
    expect(srs.qualityFromScore(40)).toBe(2);
    expect(srs.qualityFromScore(10)).toBe(1);
  });

  it('describes due dates relative to now', () => {
    const now = Date.now();
    expect(srs.describeDue(now - 1000)).toBe('now');
    expect(srs.describeDue(now + DAY)).toBe('tomorrow');
    expect(srs.describeDue(now + 3 * DAY)).toBe('in 3 days');
    expect(srs.describeDue(now + 10 * DAY)).toBe('in 1 week');
    expect(srs.describeDue(now + 21 * DAY)).toBe('in 3 weeks');
  });
});
