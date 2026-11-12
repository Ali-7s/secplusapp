import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress.service';
import { SyncService } from './sync.service';

/** A stand-in for the one Firestore document, so no request leaves the test. */
interface Doc { fields: Record<string, unknown>; updateTime: string }

describe('SyncService data use', () => {
  const KEYS = ['sp-progress', 'sp-sync'];
  let saved: (string | null)[];
  /** `race`: another device saves just before this one's next save. */
  const cloud: { doc: Doc | null; saves: number; race: boolean } = { doc: null, saves: 0, race: false };
  /** Each request: its method, and "stamp" when it asked for the version stamp alone. */
  let calls: string[];
  let sync: SyncService;
  let progress: ProgressService;

  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    saved = KEYS.map(k => localStorage.getItem(k));
    KEYS.forEach(k => localStorage.removeItem(k));
    cloud.doc = null;
    cloud.saves = 0;
    cloud.race = false;
    calls = [];
    spyOn(window, 'fetch').and.callFake(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const stamp = url.searchParams.get('mask.fieldPaths') === 'v';
      const method = init?.method ?? 'GET';
      calls.push(stamp ? `${method} stamp` : method);
      const answer = (doc: Doc) => reply(stamp ? { updateTime: doc.updateTime, fields: { v: doc.fields['v'] } } : doc);
      if (method === 'GET') return cloud.doc ? answer(cloud.doc) : reply({ error: { status: 'NOT_FOUND' } }, 404);
      if (cloud.race && cloud.doc) {
        cloud.race = false;
        cloud.doc = { ...cloud.doc, updateTime: '2026-11-12T12:00:00.000000Z' };
      }
      const at = url.searchParams.get('currentDocument.updateTime');
      const mustBeNew = url.searchParams.get('currentDocument.exists') === 'false';
      if (mustBeNew ? cloud.doc : at !== cloud.doc?.updateTime) return reply({ error: { status: 'FAILED_PRECONDITION' } }, 400);
      cloud.doc = { fields: JSON.parse(String(init!.body)).fields, updateTime: `2026-11-12T10:00:0${++cloud.saves}.000000Z` };
      return answer(cloud.doc);
    });
    sync = TestBed.inject(SyncService);
    progress = TestBed.inject(ProgressService);
  });

  afterEach(() => {
    sync.turnOff();
    KEYS.forEach((k, i) => saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]!));
  });

  it('downloads the synced copy only when another device has saved since the last sync', async () => {
    expect(sync.configured).toBeTrue();
    await sync.turnOn();
    expect(calls).withContext('first sync: look for a copy, then save one').toEqual(['GET', 'PATCH stamp']);
    expect(sync.state()).toBe('synced');

    calls = [];
    await sync.syncNow();
    expect(calls).withContext('nothing new anywhere: the stamp alone').toEqual(['GET stamp']);

    calls = [];
    progress.setExamDate('2026-12-15');
    TestBed.flushEffects();
    await sync.syncNow();
    expect(calls).withContext('a change here: the stamp, then a save').toEqual(['GET stamp', 'PATCH stamp']);

    calls = [];
    cloud.doc!.updateTime = '2026-11-12T11:00:00.000000Z';
    await sync.syncNow();
    expect(calls).withContext('another device saved: download the copy').toEqual(['GET stamp', 'GET']);
    expect(sync.state()).toBe('synced');

    calls = [];
    await sync.syncNow();
    expect(calls).withContext('and remember it').toEqual(['GET stamp']);
  });

  it('downloads the copy again when another device saves between the check and the save', async () => {
    await sync.turnOn();
    progress.setExamDate('2026-12-15');
    TestBed.flushEffects();
    calls = [];
    cloud.race = true;
    await sync.syncNow();
    expect(calls).toEqual(['GET stamp', 'PATCH stamp', 'GET stamp', 'GET', 'PATCH stamp']);
    expect(sync.state()).toBe('synced');
  });
});
