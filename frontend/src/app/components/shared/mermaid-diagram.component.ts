import { Component, ElementRef, Input, OnChanges, ViewChild, effect, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

let mermaidSeq = 0;

/**
 * Renders AI-generated mermaid flowchart source into an inline SVG.
 * - mermaid is lazy-loaded so it stays out of the initial bundle.
 * - securityLevel 'strict' sanitizes labels (no click handlers / HTML).
 * - If the source doesn't parse (AI drift), the component hides itself
 *   rather than breaking the page.
 * - Re-renders when the app theme toggles so colors stay legible.
 */
@Component({
  selector: 'app-mermaid-diagram',
  standalone: true,
  template: `<div #host class="mermaid-host" [style.display]="failed ? 'none' : 'block'"></div>`,
  styles: [`
    .mermaid-host { display: flex; justify-content: center; overflow-x: auto; }
    .mermaid-host ::ng-deep svg { max-width: 100%; height: auto; }
  `],
})
export class MermaidDiagramComponent implements OnChanges {
  @Input({ required: true }) code = '';

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  failed = false;

  private theme = inject(ThemeService);

  constructor() {
    // Re-render on theme change (mermaid bakes colors into the SVG at render time)
    effect(() => { this.theme.dark(); this.render(); });
  }

  ngOnChanges() { this.render(); }

  private async render() {
    const code = (this.code ?? '').trim();
    if (!code || !this.host) return;
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: this.theme.dark() ? 'dark' : 'neutral',
        fontFamily: 'Roboto, sans-serif',
      });
      const { svg } = await mermaid.render(`mmd-${++mermaidSeq}`, code);
      this.host.nativeElement.innerHTML = svg;
      this.failed = false;
    } catch {
      this.failed = true;                       // bad AI syntax → hide quietly
      this.host.nativeElement.innerHTML = '';
      // mermaid leaves an orphan error node behind on parse failures — clean it up
      document.querySelectorAll('[id^="dmmd-"], [id^="mmd-"]').forEach(el => {
        if (!this.host.nativeElement.contains(el)) el.remove();
      });
    }
  }
}
