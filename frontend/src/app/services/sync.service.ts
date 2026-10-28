import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ProgressService } from './progress.service';
import { BrainDumpStore } from './brain-dump-store.service';
import { SYNC_CONFIG } from '../sync-config';
import {
  Sealed, SyncKeys, SyncPayload, deriveSyncKeys, formatSyncCode, mergeSynced, newSyncCode, normalizeSyncCode, seal,
  stableStringify, unseal,
} from '../utils/sync';

/** This device's sync code. Removed when sync is turned off here. */
const SYNC_KEY = 'sp-sync';
/** Wait this long after a change before sending, so a burst of answers goes up as one save. */
const SEND_DELAY = 3000;
/** How often to look for changes made on other devices while the page is open and visible. */
const CHECK_EVERY = 60_000;

export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

/** A copy fetched from the cloud, with the version stamp used to avoid overwriting a newer one. */
interface Remote { payload: SyncPayload; updateTime: string }

class SyncError extends Error {}

/**
 * Keeps progress the same on every device that has the sync code. Each device works from its own localStorage as
 * before; this service sends an encrypted copy to Firestore after changes and takes in changes from other devices
 * when the page opens, comes back into view, reconnects, and every minute while it is open.
 *
 * Every save first fetches the cloud copy, combines it with this device's (see mergeSynced) and writes only if
 * the cloud copy has not changed in the meantime, so two devices saving at once never lose each other's work.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private progress = inject(ProgressService);
  private dumpStore = inject(BrainDumpStore);

  readonly state = signal<SyncState>('off');
  readonly lastSynced = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  /** The code formatted for display ("K7P2-9XMA-QR4T"), or null when sync is off. */
  readonly code = signal<string | null>(null);

  private keys: SyncKeys | null = null;
  private running = false;
  private again = false;
  private sendTimer?: ReturnType<typeof setTimeout>;
  private checkTimer?: ReturnType<typeof setInterval>;

  constructor() {
    // Any change on this device schedules a send.
    effect(() => {
      this.progress.changes();
      this.dumpStore.changes();
      untracked(() => this.scheduleSend());
    });
    const saved = this.readCode();
    if (saved) void this.start(saved);
  }

  get configured(): boolean { return !!SYNC_CONFIG.apiKey && !!SYNC_CONFIG.projectId; }

  // ── Turning sync on and off ───────────────────────────────────────────

  /** Starts syncing with a new code, uploading this device's progress. Returns the code to show. */
  async turnOn(): Promise<string> {
    const code = newSyncCode();
    await this.start(code);
    return formatSyncCode(code);
  }

  /**
   * Joins an existing code typed on this device. This device's progress, if any, is combined with the cloud copy.
   * Returns an error message, or null when it worked.
   */
  async connect(input: string): Promise<string | null> {
    const code = normalizeSyncCode(input);
    if (!code) return 'That is not a sync code. It has 12 letters and numbers, like K7P2-9XMA-QR4T.';
    try {
      const keys = await deriveSyncKeys(code);
      const remote = await this.fetch(keys);
      if (!remote) return 'No progress was found for that code. Check it for typos.';
    } catch (e) {
      return e instanceof SyncError ? e.message : 'Could not reach the sync service. Check your connection and try again.';
    }
    await this.start(code);
    return this.state() === 'error' ? this.error() : null;
  }

  /** Stops syncing on this device. Progress stays here and in the cloud. */
  turnOff() {
    this.stop();
    try { localStorage.removeItem(SYNC_KEY); } catch { /* storage unavailable */ }
  }

  /** Stops syncing and wipes this device's copy, for leaving a borrowed computer clean. The cloud copy is kept. */
  async turnOffAndForget() {
    // Send anything not yet saved, so nothing studied here is lost.
    if (this.keys) await this.syncNow();
    this.stop();
    this.progress.forgetThisDevice();
  }

  /** Runs a sync now instead of waiting for the next one. */
  async syncNow() {
    clearTimeout(this.sendTimer);
    await this.run();
  }

  // ── The sync loop ─────────────────────────────────────────────────────

  private async start(code: string) {
    this.stop();
    if (!this.configured) return;
    this.code.set(formatSyncCode(code));
    this.state.set('syncing');
    try { localStorage.setItem(SYNC_KEY, code); } catch { /* storage unavailable: sync lasts until the page closes */ }
    this.keys = await deriveSyncKeys(code);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
    this.checkTimer = setInterval(() => { if (document.visibilityState === 'visible') void this.run(); }, CHECK_EVERY);
    await this.run();
  }

  private stop() {
    clearTimeout(this.sendTimer);
    clearInterval(this.checkTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
    this.keys = null;
    this.code.set(null);
    this.state.set('off');
    this.error.set(null);
    this.lastSynced.set(null);
  }

  private onVisible = () => { if (document.visibilityState === 'visible') void this.run(); };

  private scheduleSend() {
    if (!this.keys) return;
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => void this.run(), SEND_DELAY);
  }

  /** One sync at a time; a request during a sync runs another one straight after. */
  private async run() {
    if (!this.keys) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      do {
        this.again = false;
        this.state.set('syncing');
        await this.syncOnce(this.keys);
      } while (this.again && this.keys);
      if (this.keys) {
        this.state.set('synced');
        this.error.set(null);
        this.lastSynced.set(Date.now());
      }
    } catch (e) {
      if (!this.keys) return;
      const offline = e instanceof TypeError || !navigator.onLine;
      this.state.set(offline ? 'offline' : 'error');
      this.error.set(offline ? null : e instanceof SyncError ? e.message : 'Sync failed. It will try again shortly.');
    } finally {
      this.running = false;
    }
  }

  /** Fetch, combine, keep the result here, and send it if the cloud copy differs. Retries if another device saved first. */
  private async syncOnce(keys: SyncKeys) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await this.fetch(keys);
      const local = this.localPayload();
      const merged = remote ? mergeSynced(local, remote.payload) : local;
      const mergedText = stableStringify(merged);
      if (mergedText !== stableStringify(local)) this.applyLocal(merged);
      if (remote && mergedText === stableStringify(remote.payload)) return;
      if (await this.write(keys, merged, remote?.updateTime)) return;
    }
    throw new SyncError('Another device kept saving at the same moment. Sync will try again shortly.');
  }

  private localPayload(): SyncPayload {
    return { progress: this.progress.data(), braindump: this.dumpStore.forSync() };
  }

  private applyLocal(payload: SyncPayload) {
    this.progress.replaceFromSync(payload.progress);
    this.dumpStore.replaceFromSync(payload.braindump);
  }

  // ── Firestore (REST, so the app needs no Firebase library) ─────────────

  private url(keys: SyncKeys, params = ''): string {
    const { projectId, apiKey } = SYNC_CONFIG;
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sync/${keys.id}?key=${apiKey}${params}`;
  }

  private async fetch(keys: SyncKeys): Promise<Remote | null> {
    const res = await fetch(this.url(keys), { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await this.failure(res);
    const doc = await res.json() as { updateTime: string; fields: Record<string, { stringValue?: string; booleanValue?: boolean }> };
    const sealed: Sealed = { iv: doc.fields['iv']?.stringValue ?? '', data: doc.fields['data']?.stringValue ?? '', z: !!doc.fields['z']?.booleanValue };
    try {
      return { payload: await unseal(keys, sealed), updateTime: doc.updateTime };
    } catch {
      throw new SyncError('The synced copy could not be unlocked with this code.');
    }
  }

  /** Writes only if the cloud copy is still the one combined with; returns false when another device saved first. */
  private async write(keys: SyncKeys, payload: SyncPayload, updateTime?: string): Promise<boolean> {
    const sealed = await seal(keys, payload);
    const precondition = updateTime
      ? `&currentDocument.updateTime=${encodeURIComponent(updateTime)}`
      : '&currentDocument.exists=false';
    const res = await fetch(this.url(keys, precondition), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        v: { integerValue: '1' },
        iv: { stringValue: sealed.iv },
        data: { stringValue: sealed.data },
        z: { booleanValue: sealed.z },
      } }),
    });
    if (res.ok) return true;
    if (res.status === 400 || res.status === 409) {
      const body = await res.clone().json().catch(() => null) as { error?: { status?: string } } | null;
      const status = body?.error?.status;
      if (status === 'FAILED_PRECONDITION' || status === 'ALREADY_EXISTS' || status === 'ABORTED') return false;
    }
    throw await this.failure(res);
  }

  private async failure(res: Response): Promise<SyncError> {
    if (res.status === 403) return new SyncError('The sync service refused the request. Its setup may not be finished yet.');
    if (res.status === 429) return new SyncError('The sync service is busy (its free daily limit may be used up). It will try again later.');
    return new SyncError(`The sync service had a problem (error ${res.status}). It will try again shortly.`);
  }

  private readCode(): string | null {
    try { return normalizeSyncCode(localStorage.getItem(SYNC_KEY) ?? ''); } catch { return null; }
  }
}
