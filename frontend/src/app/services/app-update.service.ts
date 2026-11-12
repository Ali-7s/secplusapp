import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { coverIsOn } from '../components/cover/cover.component';

/** When the tab comes back into view, look for a new version if this long has passed since the last look. */
const CHECK_EVERY = 30 * 60_000;

/**
 * Moves to a new version of the site once the service worker has downloaded it, at a moment that interrupts
 * nothing: straight away if nothing has been tapped, typed or scrolled since the page opened or came back into
 * view, otherwise at the next page change. Never while the cover screen is up. Work is saved as it happens, so
 * the reload loses none of it.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private ready = false;
  private untouched = true;
  private checked = Date.now();

  constructor() {
    const sw = inject(SwUpdate, { optional: true });
    if (!sw?.isEnabled) return;
    const touched = () => (this.untouched = false);
    for (const type of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(type, touched, { capture: true, passive: true });

    sw.versionUpdates.subscribe(e => {
      if (e.type !== 'VERSION_READY') return;
      this.ready = true;
      if (this.untouched) this.reload();
    });
    // Part of the saved copy is gone (the browser cleared it to free space): load the site afresh.
    sw.unrecoverable.subscribe(() => this.reload());
    inject(Router).events.subscribe(e => {
      if (this.ready && e instanceof NavigationStart && !coverIsOn()) location.assign(e.url);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.untouched = true;
      if (this.ready) this.reload();
      else if (Date.now() - this.checked >= CHECK_EVERY && navigator.onLine) {
        this.checked = Date.now();
        sw.checkForUpdate().catch(() => { /* the check failed (connection dropped): the next one will do */ });
      }
    });
  }

  private reload() {
    if (!coverIsOn()) location.reload();
  }
}
