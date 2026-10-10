import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LESSON_META } from './lessons/lesson-index';

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
}
