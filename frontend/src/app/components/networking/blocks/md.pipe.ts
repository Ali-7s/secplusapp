import { Pipe, PipeTransform } from '@angular/core';

/**
 * Tiny inline formatter for lesson text: `**bold**` and `` `code` ``.
 *
 * The text is HTML-escaped first, so only the two tags produced here can appear in the result.
 * Angular still sanitizes it when bound with [innerHTML]. Code spans carry the `md-code` class, which is
 * styled once in styles.scss because component styles cannot reach injected HTML.
 */
export function formatInline(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

@Pipe({ name: 'md', standalone: true })
export class MdPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatInline(value);
  }
}
