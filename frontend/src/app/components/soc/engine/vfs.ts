/**
 * The analyst workstation's file system. Log files are generated on demand from the shift's events up to the
 * current moment, so they grow while you watch. Only your home folder and /tmp can be written to.
 */

export const HOME = '/home/analyst';

export interface VFile {
  /** Fixed contents, or a function for files that change (the logs). */
  text?: string;
  gen?: () => string;
  exec?: boolean;
  /** Seconds since midnight of the last change, for ls -l. */
  mtime?: number | (() => number);
}

export class Vfs {
  private files = new Map<string, VFile>();
  private dirs = new Set<string>(['/']);

  /** The text each system-provided file started with, so only the analyst's own changes are saved. */
  private stock = new Map<string, string>();

  constructor(private clock: () => number = () => 0) {}

  static normalize(path: string): string {
    const parts: string[] = [];
    for (const p of path.split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') parts.pop();
      else parts.push(p);
    }
    return '/' + parts.join('/');
  }

  resolve(cwd: string, path: string): string {
    if (path === '~' || path.startsWith('~/')) path = HOME + path.slice(1);
    return Vfs.normalize(path.startsWith('/') ? path : `${cwd}/${path}`);
  }

  mkdirp(path: string) {
    let cur = '';
    for (const p of Vfs.normalize(path).split('/').filter(Boolean)) {
      cur += '/' + p;
      this.dirs.add(cur);
    }
  }

  /** Adds a system file (read-only to the analyst). */
  add(path: string, file: VFile) {
    const p = Vfs.normalize(path);
    if (file.text !== undefined) this.stock.set(p, file.text);
    this.mkdirp(p.slice(0, p.lastIndexOf('/')) || '/');
    this.files.set(p, file);
  }

  isDir(path: string) { return this.dirs.has(Vfs.normalize(path)); }
  isFile(path: string) { return this.files.has(Vfs.normalize(path)); }
  exists(path: string) { return this.isDir(path) || this.isFile(path); }

  read(path: string): string | undefined {
    const p = Vfs.normalize(path);
    if (p === '/dev/null') return '';
    const f = this.files.get(p);
    return f ? (f.gen ? f.gen() : f.text ?? '') : undefined;
  }

  file(path: string) { return this.files.get(Vfs.normalize(path)); }

  mtime(path: string): number {
    const f = this.files.get(Vfs.normalize(path));
    const m = f?.mtime;
    return typeof m === 'function' ? m() : m ?? 0;
  }

  writable(path: string) {
    const p = Vfs.normalize(path);
    return p === '/dev/null' || p === HOME || p.startsWith(HOME + '/') || p === '/tmp' || p.startsWith('/tmp/');
  }

  /** Writes a file; returns an error message, or null when it worked. */
  write(path: string, text: string, append = false): string | null {
    const p = Vfs.normalize(path);
    if (p === '/dev/null') return null;
    if (this.isDir(p)) return `${path}: Is a directory`;
    const parent = p.slice(0, p.lastIndexOf('/')) || '/';
    if (!this.isDir(parent)) return `${path}: No such file or directory`;
    if (!this.writable(p)) return `${path}: Permission denied`;
    const old = this.files.get(p);
    const now = this.clock();
    this.files.set(p, { text: append ? (old?.text ?? '') + text : text, exec: old?.exec, mtime: now });
    return null;
  }

  mkdir(path: string): string | null {
    const p = Vfs.normalize(path);
    if (this.exists(p)) return `cannot create directory '${path}': File exists`;
    const parent = p.slice(0, p.lastIndexOf('/')) || '/';
    if (!this.isDir(parent)) return `cannot create directory '${path}': No such file or directory`;
    if (!this.writable(p)) return `cannot create directory '${path}': Permission denied`;
    this.dirs.add(p);
    return null;
  }

  remove(path: string, recursive = false): string | null {
    const p = Vfs.normalize(path);
    if (!this.exists(p)) return `cannot remove '${path}': No such file or directory`;
    if (!this.writable(p) || p === HOME) return `cannot remove '${path}': Permission denied`;
    if (this.isDir(p)) {
      if (!recursive) return `cannot remove '${path}': Is a directory`;
      for (const f of [...this.files.keys()]) if (f.startsWith(p + '/')) this.files.delete(f);
      for (const d of [...this.dirs]) if (d === p || d.startsWith(p + '/')) this.dirs.delete(d);
      return null;
    }
    this.files.delete(p);
    return null;
  }

  setExec(path: string, on: boolean): string | null {
    const f = this.files.get(Vfs.normalize(path));
    if (!f) return `cannot access '${path}': No such file or directory`;
    if (!this.writable(path)) return `changing permissions of '${path}': Operation not permitted`;
    f.exec = on;
    return null;
  }

  /** Names directly inside a folder, sorted. */
  list(path: string): string[] {
    const p = Vfs.normalize(path);
    const prefix = p === '/' ? '/' : p + '/';
    const names = new Set<string>();
    for (const k of [...this.files.keys(), ...this.dirs]) {
      if (k !== p && k.startsWith(prefix)) {
        const rest = k.slice(prefix.length);
        if (rest && !rest.includes('/')) names.add(rest);
      }
    }
    return [...names].sort();
  }

  /** Every path under a folder (for find and grep -r). */
  walk(path: string): string[] {
    const p = Vfs.normalize(path);
    const prefix = p === '/' ? '/' : p + '/';
    return [...new Set([...this.dirs, ...this.files.keys()])].filter(k => k === p || k.startsWith(prefix)).sort();
  }

  /** The analyst's own files and folders, to save between visits. */
  /** The analyst's files: new or changed ones, and the provided ones they deleted. Unchanged provided files are left out. */
  userFiles(): UserFiles {
    const files: Record<string, { text: string; exec?: boolean }> = {};
    for (const [k, f] of this.files) {
      if (!this.writable(k) || f.text === undefined || (this.stock.get(k) === f.text && !f.exec)) continue;
      files[k] = f.exec ? { text: f.text, exec: true } : { text: f.text };
    }
    const removed = [...this.stock.keys()].filter(k => this.writable(k) && !this.files.has(k));
    return { files, dirs: [...this.dirs].filter(d => this.writable(d) && d !== HOME && d !== '/tmp'), ...(removed.length ? { removed } : {}) };
  }

  restoreUserFiles(saved: Partial<UserFiles> | undefined) {
    for (const k of saved?.removed ?? []) if (this.writable(k)) this.files.delete(k);
    for (const d of saved?.dirs ?? []) if (this.writable(d)) this.mkdirp(d);
    for (const [k, f] of Object.entries(saved?.files ?? {})) {
      if (!this.writable(k)) continue;
      this.mkdirp(k.slice(0, k.lastIndexOf('/')));
      this.files.set(k, { text: f.text, exec: f.exec });
    }
  }
}

export interface UserFiles { files: Record<string, { text: string; exec?: boolean }>; dirs: string[]; removed?: string[] }
