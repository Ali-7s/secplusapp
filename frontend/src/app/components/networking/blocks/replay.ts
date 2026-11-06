/**
 * The credential replay console's engine: three things an attacker captured, three places to replay them, and the
 * defences that stop (or fail to stop) each. Pure, so the spec can check every mission.
 */

export type ItemId = 'hash' | 'cookie' | 'request';
export type TargetId = 'fs' | 'mail' | 'api';
export type GuardId = 'mfa' | 'kerberos' | 'credguard' | 'tls' | 'sessions' | 'nonce';

export const ITEMS: { id: ItemId; name: string; from: string; home: TargetId; icon: string }[] = [
  { id: 'hash', name: 'The admin\'s NTLM password hash', from: 'Dumped from memory on a finance PC the admin had signed in to', home: 'fs', icon: 'tag' },
  { id: 'cookie', name: 'Sam\'s webmail session cookie', from: 'Sniffed on café Wi-Fi while Sam read email', home: 'mail', icon: 'cookie' },
  { id: 'request', name: 'A recorded "pay supplier" API request', from: 'Captured on the network, token and all', home: 'api', icon: 'receipt_long' },
];

export const TARGETS: { id: TargetId; name: string; how: string }[] = [
  { id: 'fs', name: 'File server', how: 'Windows sign-in over SMB' },
  { id: 'mail', name: 'Webmail', how: 'Web sign-in, then a session cookie' },
  { id: 'api', name: 'Payments API', how: 'Signed requests with a token' },
];

export const GUARDS: { id: GuardId; name: string; detail: string }[] = [
  { id: 'mfa', name: 'MFA on every sign-in', detail: 'A code or push approval whenever someone signs in' },
  { id: 'kerberos', name: 'Disable NTLM', detail: 'Servers accept Kerberos tickets only' },
  { id: 'credguard', name: 'Credential Guard', detail: 'Password hashes kept in an isolated part of memory that malware cannot read' },
  { id: 'tls', name: 'HTTPS everywhere', detail: 'All web and API traffic encrypted; cookies marked Secure' },
  { id: 'sessions', name: 'Short, device-bound sessions', detail: 'Sessions expire in 15 minutes and only work from the device that signed in' },
  { id: 'nonce', name: 'Nonce and timestamp on API requests', detail: 'Each request carries a one-time number and the time; repeats and old ones are rejected' },
];

export interface ReplayResult { ok: boolean; text: string; note?: string; blockedBy?: GuardId }

/** Replay one captured item against one target, with the given defences on. */
export function replay(item: ItemId, target: TargetId, on: GuardId[]): ReplayResult {
  const has = (g: GuardId) => on.includes(g);
  // Some defences stop the theft itself, so there is nothing to replay.
  if (item === 'hash' && has('credguard')) return { ok: false, blockedBy: 'credguard', text: 'You never got it: Credential Guard keeps hashes where the memory dump could not reach them.' };
  if ((item === 'cookie' || item === 'request') && has('tls')) return { ok: false, blockedBy: 'tls', text: 'You never got it: the traffic was encrypted, so sniffing it showed nothing readable.' };

  const home = ITEMS.find(i => i.id === item)!.home;
  if (target !== home) {
    const why: Record<string, string> = {
      'hash:mail': 'The webmail page wants a password typed in, and a hash is not the password.',
      'hash:api': 'The API does not use Windows sign-ins at all.',
      'cookie:fs': 'The file server knows nothing about web cookies.',
      'cookie:api': 'The API does not accept webmail cookies.',
      'request:fs': 'An HTTP API request means nothing to a file server.',
      'request:mail': 'Webmail does not accept payment API requests.',
    };
    return { ok: false, text: `Rejected, and not because of any defence. ${why[item + ':' + target]} A captured credential only works where it came from.` };
  }

  if (item === 'hash') {
    if (has('kerberos')) return { ok: false, blockedBy: 'kerberos', text: 'Rejected: the file server only accepts Kerberos tickets now, and an NTLM hash cannot answer an NTLM challenge that is never sent.' };
    return { ok: true, text: 'Signed in to the file server as the admin. NTLM proves who you are with the hash itself, so the hash is as good as the password.',
      note: has('mfa') ? 'MFA did not help: SMB network sign-ins with NTLM never ask for a second factor.' : undefined };
  }
  if (item === 'cookie') {
    if (has('sessions')) return { ok: false, blockedBy: 'sessions', text: 'Rejected: the session was bound to Sam\'s device and had expired anyway.' };
    return { ok: true, text: 'You are in Sam\'s mailbox. To the server, whoever presents the session cookie is Sam.',
      note: has('mfa') ? 'MFA did not help: the cookie is the proof that Sam already passed MFA.' : undefined };
  }
  if (has('nonce')) return { ok: false, blockedBy: 'nonce', text: 'Rejected: that nonce has already been used, and the timestamp is three hours old.' };
  return { ok: true, text: 'The API paid the supplier again. Nothing was cracked or changed: the same valid request, sent twice.',
    note: has('mfa') ? 'MFA did not help: no one signs in to send an API request.' : undefined };
}

export type ReplayMission = 'hash' | 'cookie' | 'request' | 'mfa' | 'stop-hash' | 'stop-cookie' | 'stop-request';
export const REPLAY_MISSIONS: { id: ReplayMission; text: string }[] = [
  { id: 'hash', text: 'Sign in somewhere with the admin\'s hash' },
  { id: 'cookie', text: 'Get into a mailbox with the stolen cookie' },
  { id: 'request', text: 'Make the API pay again with the recorded request' },
  { id: 'mfa', text: 'Turn on MFA only, then replay all three again' },
  { id: 'stop-hash', text: 'Find a defence that stops the hash replay' },
  { id: 'stop-cookie', text: 'Find a defence that stops the cookie replay' },
  { id: 'stop-request', text: 'Find a defence that stops the request replay' },
];

/** Which missions one replay attempt completes. `mfaWins` is the items already replayed successfully with only MFA on. */
export function missionsFor(item: ItemId, target: TargetId, on: GuardId[], mfaWins: ItemId[]): { done: ReplayMission[]; mfaWins: ItemId[] } {
  const r = replay(item, target, on);
  const done: ReplayMission[] = [];
  let wins = mfaWins;
  if (r.ok) {
    done.push(item);
    if (on.length === 1 && on[0] === 'mfa') {
      wins = ITEMS.map(i => i.id).filter(id => id === item || mfaWins.includes(id));
      if (wins.length === ITEMS.length) done.push('mfa');
    }
  } else if (r.blockedBy && r.blockedBy !== 'mfa') {
    done.push(`stop-${item}` as ReplayMission);
  }
  return { done, mfaWins: wins };
}
