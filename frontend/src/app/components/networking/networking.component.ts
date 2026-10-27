import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LESSON_META } from './lessons/lesson-index';
import { ProgressService } from '../../services/progress.service';

/** The lesson list: a short guided path through the networking Security+ takes for granted. */
@Component({
  selector: 'app-networking',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './networking.component.html',
  styleUrl: './networking.component.scss',
})
export class NetworkingComponent {
  readonly lessons = LESSON_META;
  readonly totalMinutes = LESSON_META.reduce((sum, l) => sum + l.minutes, 0);
  private progress = inject(ProgressService);

  done(slug: string): boolean { return !!this.progress.lessonRecord(slug)?.completedAt; }
  get doneCount(): number { return this.lessons.filter(l => this.done(l.slug)).length; }
}
