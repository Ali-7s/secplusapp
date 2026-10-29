import { Injectable, inject } from '@angular/core';
import { ProgressService } from '../../services/progress.service';

/**
 * Lets a lesson's exercises save their work in progress without knowing which lesson they are in. The lesson page
 * provides one and sets its slug; each exercise saves under its own key ("check", "pbq:fw-1", "spot:Router config").
 * Saved work goes into the lesson's progress record, so it survives a refresh and syncs like the rest.
 */
@Injectable()
export class LessonWork {
  private progress = inject(ProgressService);
  slug = '';

  get<T>(key: string): T | undefined {
    return this.slug ? (this.progress.lessonWork(this.slug, key) as T | undefined) : undefined;
  }

  set(key: string, value: unknown) {
    if (this.slug) this.progress.setLessonWork(this.slug, key, value);
  }

  clear(key: string) {
    if (this.slug && this.get(key) !== undefined) this.progress.setLessonWork(this.slug, key, null);
  }
}
