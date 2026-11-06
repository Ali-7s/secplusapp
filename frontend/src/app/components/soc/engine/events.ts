/**
 * The SOC lab's events: one record per log line, with the fields the SIEM searches on and the raw text the
 * terminal shows. Times are seconds since midnight on the shift's day; every shift happens on 5 November 2026.
 */

export type Source = 'auth' | 'web' | 'fw' | 'dns' | 'proxy' | 'edr' | 'win' | 'idp' | 'ids';

export interface Ev {
  t: number;
  source: Source;
  host: string;
  f: Record<string, string>;
  raw: string;
}

/** Where each source's log lives on the analyst workstation, and what it is. */
export const LOG_FILES: Record<Source, { path: string; what: string }> = {
  auth: { path: '/var/log/auth.log', what: 'Linux sign-ins, sudo and cron on web01 (syslog format)' },
  web: { path: '/var/log/access.log', what: 'Web server requests on web01 (combined log format)' },
  fw: { path: '/var/log/firewall.log', what: 'Edge firewall connections, allowed and denied' },
  dns: { path: '/var/log/dns.log', what: 'DNS queries seen by the internal resolver dns01' },
  proxy: { path: '/var/log/proxy.log', what: 'Web proxy requests made by staff' },
  edr: { path: '/var/log/edr.log', what: 'Endpoint detection and response: processes, files and registry on laptops' },
  win: { path: '/var/log/security.log', what: 'Windows security events from the domain controller dc01' },
  idp: { path: '/var/log/signin.log', what: 'Cloud identity provider sign-ins' },
  ids: { path: '/var/log/ids.log', what: 'Network intrusion detection on sensor01, which watches mirror ports on the floor 2 and server switches' },
};

export const DAY = '2026-11-05';

export const hms = (t: number) => {
  const s = Math.max(0, Math.floor(t));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
};
export const iso = (t: number) => `${DAY}T${hms(t)}Z`;
const syslog = (t: number) => `Nov  5 ${hms(t)}`;
const clf = (t: number) => `[05/Nov/2026:${hms(t)} +0000]`;

/** "08:20" or "08:20:15" to seconds since midnight. */
export const at = (clock: string) => {
  const [h, m, s] = clock.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

const kv = (f: Record<string, string>) =>
  Object.entries(f).map(([k, v]) => (/[\s"]/.test(v) ? `${k}="${v.replace(/"/g, '\\"')}"` : `${k}=${v}`)).join(' ');

/** A key=value line, the format most of the lab's sources use. */
const kvEvent = (t: number, source: Source, host: string, f: Record<string, string>): Ev =>
  ({ t, source, host, f, raw: `${iso(t)} ${host} ${kv(f)}` });

// ── Linux auth log (web01) ────────────────────────────────────────────────

let pid = 2200;
/** Process ids restart for every build so a shift's logs come out the same each time. */
export const resetPids = () => { pid = 2200; };
const nextPid = () => (pid = pid >= 32000 ? 2200 : pid + 1 + (pid % 7));

export const auth = {
  failed(t: number, user: string, src: string, port: number, invalid: boolean, host = 'web01'): Ev[] {
    const p = nextPid();
    const out: Ev[] = [];
    if (invalid) out.push({
      t, source: 'auth', host, f: { prog: 'sshd', action: 'invalid_user', user, src, port: String(port) },
      raw: `${syslog(t)} ${host} sshd[${p}]: Invalid user ${user} from ${src} port ${port}`,
    });
    out.push({
      t, source: 'auth', host, f: { prog: 'sshd', action: 'failed', method: 'password', user, src, port: String(port) },
      raw: `${syslog(t)} ${host} sshd[${p}]: Failed password for ${invalid ? 'invalid user ' : ''}${user} from ${src} port ${port} ssh2`,
    });
    return out;
  },
  accepted(t: number, user: string, src: string, port: number, method: 'password' | 'publickey', host = 'web01'): Ev[] {
    const p = nextPid();
    return [
      { t, source: 'auth', host, f: { prog: 'sshd', action: 'accepted', method, user, src, port: String(port) },
        raw: `${syslog(t)} ${host} sshd[${p}]: Accepted ${method} for ${user} from ${src} port ${port} ssh2` },
      { t, source: 'auth', host, f: { prog: 'sshd', action: 'session_opened', user },
        raw: `${syslog(t)} ${host} sshd[${p}]: pam_unix(sshd:session): session opened for user ${user}(uid=${uid(user)}) by (uid=0)` },
    ];
  },
  closed(t: number, user: string, host = 'web01'): Ev {
    return { t, source: 'auth', host, f: { prog: 'sshd', action: 'session_closed', user },
      raw: `${syslog(t)} ${host} sshd[${nextPid()}]: pam_unix(sshd:session): session closed for user ${user}` };
  },
  sudo(t: number, user: string, command: string, host = 'web01'): Ev {
    return { t, source: 'auth', host, f: { prog: 'sudo', action: 'sudo', user, command },
      raw: `${syslog(t)} ${host} sudo: ${user.padStart(8)} : TTY=pts/0 ; PWD=/home/${user} ; USER=root ; COMMAND=${command}` };
  },
  cron(t: number, command: string, host = 'web01'): Ev {
    return { t, source: 'auth', host, f: { prog: 'CRON', action: 'cron', user: 'root', command },
      raw: `${syslog(t)} ${host} CRON[${nextPid()}]: (root) CMD (${command})` };
  },
};

const UIDS: Record<string, number> = { root: 0, deploy: 1001, 's.ito': 1002, 'l.moreau': 1003, 'p.harris': 1004, support2: 1005 };
const uid = (user: string) => UIDS[user] ?? 1100;

// ── Web server access log (web01) ─────────────────────────────────────────

export function web(t: number, src: string, method: string, path: string, status: number, bytes: number, ua: string, ref = '-'): Ev {
  return {
    t, source: 'web', host: 'web01',
    f: { src, method, path, status: String(status), bytes: String(bytes), ua },
    raw: `${src} - - ${clf(t)} "${method} ${path} HTTP/1.1" ${status} ${bytes} "${ref}" "${ua}"`,
  };
}

// ── Key=value sources ─────────────────────────────────────────────────────

export function fw(t: number, action: 'allow' | 'deny', src: string, spt: number, dst: string, dpt: number, bytes: number, proto = 'tcp'): Ev {
  return kvEvent(t, 'fw', 'fw-edge', { action, proto, src, spt: String(spt), dst, dpt: String(dpt), bytes: String(bytes) });
}

export function dns(t: number, client: string, query: string, qtype: string, answer: string, rcode = 'NOERROR'): Ev {
  return kvEvent(t, 'dns', 'dns01', { client, query, qtype, rcode, answer });
}

/** A network intrusion detection event from sensor01. */
export function ids(t: number, f: Record<string, string>): Ev {
  return kvEvent(t, 'ids', 'sensor01', f);
}

export function proxy(t: number, user: string, src: string, method: string, url: string, status: number, bytes: number, category: string, action = 'allowed'): Ev {
  return kvEvent(t, 'proxy', 'proxy01', { user, src, method, url, status: String(status), bytes: String(bytes), category, action });
}

export function edr(t: number, host: string, f: Record<string, string>): Ev {
  return kvEvent(t, 'edr', host, f);
}

export function win(t: number, f: Record<string, string>): Ev {
  return kvEvent(t, 'win', 'dc01', f);
}

export function idp(t: number, f: Record<string, string>): Ev {
  return kvEvent(t, 'idp', 'idp', f);
}

/** What the SIEM sees for an event: its fields plus the ones every event has. */
export function field(e: Ev, name: string): string | undefined {
  switch (name) {
    case 'source': return e.source;
    case 'host': return e.host;
    case '_raw': return e.raw;
    case '_time': return hms(e.t);
    default: return e.f[name];
  }
}
