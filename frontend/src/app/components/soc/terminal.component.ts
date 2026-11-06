import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { COMMANDS } from './engine/commands';
import { Follow, Shell, needsMore } from './engine/shell';
import { HOME } from './engine/vfs';
import { TermLine } from './soc-store';

const MAX_LINES = 1500;
const MAX_SHOW = 2000;

/**
 * The workstation's terminal: a prompt, scrollback, history, Tab completion, tail -f that keeps following while the
 * shift clock runs, and a small editor for scripts. Every command's output is reported so tasks can be checked.
 */
@Component({
  selector: 'app-soc-terminal',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.scss',
})
export class SocTerminalComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) shell!: Shell;
  /** The shift clock; a running tail -f picks up new lines when it moves. */
  @Input() now = 0;
  @Input() saved?: { lines: TermLine[]; history: string[]; cwd: string };
  @Output() ran = new EventEmitter<{ line: string; out: string }>();
  @Output() changed = new EventEmitter<{ lines: TermLine[]; history: string[]; cwd: string }>();
  @Output() filesChanged = new EventEmitter<void>();

  @ViewChild('screen') screen?: ElementRef<HTMLElement>;
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  @ViewChild('editorArea') editorArea?: ElementRef<HTMLTextAreaElement>;

  lines: TermLine[] = [];
  history: string[] = [];
  value = '';
  pending = '';
  follow: Follow | null = null;
  private histIndex = -1;
  private draft = '';
  editor: { path: string; text: string; isNew: boolean; saved: boolean } | null = null;
  completions: string[] = [];
  readonly symbols = ['|', '-', "'", '"', '$', '/', '~', '*', '>', '{', '}'];

  get prompt(): string {
    if (this.pending) return '> ';
    const cwd = this.shell?.cwd ?? HOME;
    const shown = cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd;
    return `analyst@soc-ws:${shown}$ `;
  }

  ngOnChanges() {
    if (this.follow && this.shell) {
      const fresh = this.shell.followTick(this.follow);
      if (fresh) this.print('out', fresh);
    }
  }

  /**
   * Restores the scrollback, history and folder before the first render. Doing it after the view was drawn
   * changed the lines and the prompt under Angular's feet (an ExpressionChangedAfterItHasBeenChecked error in
   * development, and a late redraw in production).
   */
  ngOnInit() {
    if (this.saved) {
      this.lines = this.saved.lines ?? [];
      this.history = this.saved.history ?? [];
      this.shell.history = [...this.history];
      if (this.saved.cwd && this.shell.vfs.isDir(this.saved.cwd)) this.shell.cwd = this.saved.cwd;
    }
    if (!this.lines.length) {
      this.lines.push({ k: 'note', t: 'Fernco SOC workstation. Type help for the commands, or try: ls /var/log' });
    }
  }

  ngAfterViewInit() {
    queueMicrotask(() => this.scrollDown());
  }

  ngOnDestroy() {
    this.follow = null;
  }

  focus() {
    if (window.getSelection()?.toString()) return;
    this.input?.nativeElement.focus({ preventScroll: true });
  }

  private emitChange() {
    this.changed.emit({ lines: this.lines, history: this.history.slice(-200), cwd: this.shell.cwd });
  }

  private print(k: TermLine['k'], text: string) {
    if (!text) return;
    let body = text.endsWith('\n') ? text.slice(0, -1) : text;
    const count = body.split('\n').length;
    if (count > MAX_SHOW) {
      body = body.split('\n').slice(0, MAX_SHOW).join('\n');
      this.lines.push({ k, t: body });
      this.lines.push({ k: 'note', t: `... ${count - MAX_SHOW} more lines not shown. Pipe into head, tail or grep to narrow it down.` });
    } else this.lines.push({ k, t: body });
    let total = 0;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      total += this.lines[i].t.split('\n').length;
      if (total > MAX_LINES) { this.lines = this.lines.slice(i + 1); break; }
    }
    queueMicrotask(() => this.scrollDown());
  }

  private scrollDown() {
    const el = this.screen?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  submit() {
    const typed = this.value;
    this.value = '';
    this.completions = [];
    this.lines.push({ k: 'in', t: this.prompt + typed });
    const src = this.pending ? this.pending + '\n' + typed : typed;
    if (needsMore(src)) {
      this.pending = src;
      queueMicrotask(() => this.scrollDown());
      return;
    }
    this.pending = '';
    if (!src.trim()) { queueMicrotask(() => this.scrollDown()); return; }
    this.history.push(src.replace(/\n/g, '; ').replace(/(do|then|else|\{);/g, '$1'));
    this.shell.history = [...this.history];
    this.histIndex = -1;
    const before = JSON.stringify(this.shell.vfs.userFiles());
    const res = this.shell.run(src);
    if (res.clear) this.lines = [];
    this.print(res.code === 0 || res.out ? 'out' : 'err', res.display);
    if (res.follow) {
      this.follow = res.follow;
      this.print('note', 'Following the file as the shift goes on. Press Ctrl+C (or the Stop button) to stop.');
    }
    if (res.edit) this.openEditor(res.edit);
    this.ran.emit({ line: src, out: res.out });
    if (JSON.stringify(this.shell.vfs.userFiles()) !== before) this.filesChanged.emit();
    this.emitChange();
  }

  stopFollow() {
    if (!this.follow) return;
    this.follow = null;
    this.lines.push({ k: 'in', t: '^C' });
    this.emitChange();
    queueMicrotask(() => this.scrollDown());
  }

  keydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); if (!this.follow) this.submit(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.recall(e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'Tab') { e.preventDefault(); this.complete(); return; }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      this.interrupt();
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); this.lines = []; this.emitChange(); return; }
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); this.value = ''; return; }
  }

  interrupt() {
    if (this.follow) { this.stopFollow(); return; }
    this.lines.push({ k: 'in', t: this.prompt + this.value + '^C' });
    this.value = '';
    this.pending = '';
    this.completions = [];
    queueMicrotask(() => this.scrollDown());
  }

  recall(dir: -1 | 1) {
    if (!this.history.length) return;
    if (this.histIndex === -1) { if (dir === 1) return; this.draft = this.value; this.histIndex = this.history.length; }
    this.histIndex = Math.max(0, Math.min(this.history.length, this.histIndex + dir));
    this.value = this.histIndex === this.history.length ? this.draft : this.history[this.histIndex];
    if (this.histIndex === this.history.length) this.histIndex = -1;
    queueMicrotask(() => { const el = this.input?.nativeElement; if (el) el.setSelectionRange(el.value.length, el.value.length); });
  }

  /** Tab: completes a command name or a path, or lists the choices. */
  complete() {
    const v = this.value;
    const m = /(\S*)$/.exec(v)!;
    const word = m[1];
    const before = v.slice(0, v.length - word.length);
    const isCmd = !before.trim() || /[|;&]\s*$/.test(before);
    let options: string[];
    if (isCmd && !word.includes('/')) {
      const fromBin = this.shell.vfs.list(`${HOME}/bin`);
      options = [...new Set([...Object.keys(COMMANDS), ...fromBin])].filter(c => c.startsWith(word) && /^[a-z]/.test(c)).sort();
    } else {
      const slash = word.lastIndexOf('/');
      const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
      const base = word.slice(slash + 1);
      const dir = this.shell.vfs.resolve(this.shell.cwd, dirPart || '.');
      options = this.shell.vfs.list(dir).filter(n => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.')))
        .map(n => dirPart + n + (this.shell.vfs.isDir(`${dir}/${n}`) ? '/' : ''));
    }
    if (!options.length) { this.completions = []; return; }
    if (options.length === 1) {
      const o = options[0];
      this.value = before + o + (o.endsWith('/') ? '' : ' ');
      this.completions = [];
      return;
    }
    let common = options[0];
    for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
    if (common.length > word.length) this.value = before + common;
    this.completions = options.slice(0, 40);
  }

  /** Buttons for phones, which have no Tab, Ctrl or arrow keys. */
  key(k: string) {
    switch (k) {
      case 'tab': this.complete(); break;
      case 'up': this.recall(-1); break;
      case 'down': this.recall(1); break;
      case 'ctrlc': this.interrupt(); break;
      default: this.value += k;
    }
    this.input?.nativeElement.focus({ preventScroll: true });
  }

  // ── Editor ──────────────────────────────────────────────────────────────

  openEditor(path: string) {
    const text = this.shell.vfs.read(path);
    this.editor = { path, text: text ?? '', isNew: text === undefined, saved: text !== undefined };
    if (this.editor.isNew && path.endsWith('.sh')) this.editor.text = '#!/bin/bash\n\n';
    // After the render: the textarea does not exist until change detection has run.
    setTimeout(() => {
      const el = this.editorArea?.nativeElement;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  }

  get editorName() {
    const p = this.editor?.path ?? '';
    return p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p;
  }

  saveEditor() {
    if (!this.editor) return;
    const err = this.shell.vfs.write(this.editor.path, this.editor.text);
    if (err) { this.print('err', `nano: ${err}`); return; }
    this.editor.saved = true;
    this.editor.isNew = false;
    this.filesChanged.emit();
  }

  closeEditor() {
    if (!this.editor) return;
    const ed = this.editor;
    this.editor = null;
    this.print('note', ed.saved ? `Saved ${this.editorNameOf(ed.path)}.${ed.path.endsWith('.sh') && !this.shell.vfs.file(ed.path)?.exec ? ` Run it with: bash ${this.editorNameOf(ed.path)}` : ''}` : `Closed ${this.editorNameOf(ed.path)} without saving.`);
    this.emitChange();
    setTimeout(() => this.focus());
  }

  private editorNameOf(p: string) { return p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p; }

  editorKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); this.saveEditor(); return; }
    if (e.key === 'Escape') { e.preventDefault(); this.closeEditor(); return; }
    if ((e.ctrlKey) && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); this.closeEditor(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target as HTMLTextAreaElement;
      const s = el.selectionStart;
      this.editor!.text = this.editor!.text.slice(0, s) + '  ' + this.editor!.text.slice(el.selectionEnd);
      this.editor!.saved = false;
      queueMicrotask(() => el.setSelectionRange(s + 2, s + 2));
    }
  }
}
