import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TRACKS, trackLessons } from './lessons/lesson-index';
import { LessonMeta } from './networking.model';
import { ProgressService } from '../../services/progress.service';

/**
 * The lesson list: Networking Basics, a guided path through the networking Security+ takes for granted, then the
 * hands-on topics, where the hard-to-picture parts of the exam are taught by doing.
 */
@Component({
  selector: 'app-networking',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, MatIconModule],
  templateUrl: './networking.component.html',
  styleUrl: './networking.component.scss',
})
export class NetworkingComponent {
  readonly networking = trackLessons('networking');
  readonly topics = trackLessons('topics');
  readonly tracks = TRACKS;
  private progress = inject(ProgressService);

  /** Template outlets pass untyped context; this restores the type. */
  lessonsOf(list: unknown): LessonMeta[] { return list as LessonMeta[]; }

  /** The page scrolls inside the side-nav content, so jump links scroll that instead of changing the URL. */
  jump(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  minutes(lessons: { minutes: number }[]): number { return lessons.reduce((sum, l) => sum + l.minutes, 0); }
  done(slug: string): boolean { return !!this.progress.lessonRecord(slug)?.completedAt; }
  doneCount(lessons: { slug: string }[]): number { return lessons.filter(l => this.done(l.slug)).length; }
}
