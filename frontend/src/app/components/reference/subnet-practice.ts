/**
 * Random subnetting problems for the cheat sheet's practice panel, with the worked steps for each one.
 * Problems stay in the last octet (/24 to /30), which is what practice exams ask.
 */

export interface SubnetAnswers {
  mask: string;
  block: string;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  hosts: string;
}

export interface SubnetProblem {
  address: string;
  prefix: number;
  answers: SubnetAnswers;
  /** The worked solution, one step per line. */
  steps: string[];
}

export const ANSWER_FIELDS: { key: keyof SubnetAnswers; label: string; placeholder: string }[] = [
  { key: 'mask', label: 'Subnet mask', placeholder: '255.255.255.x' },
  { key: 'block', label: 'Block size', placeholder: 'addresses per subnet' },
  { key: 'network', label: 'Network address', placeholder: 'a.b.c.d' },
  { key: 'broadcast', label: 'Broadcast address', placeholder: 'a.b.c.d' },
  { key: 'first', label: 'First usable address', placeholder: 'a.b.c.d' },
  { key: 'last', label: 'Last usable address', placeholder: 'a.b.c.d' },
  { key: 'hosts', label: 'Usable hosts', placeholder: 'a number' },
];

const FIRST_OCTETS: [number, number][] = [[192, 168], [10, 20], [10, 1], [172, 16], [172, 20]];
/** Prefixes weighted toward the ones that actually need working out. */
const PREFIXES = [24, 25, 25, 26, 26, 26, 27, 27, 27, 28, 28, 28, 29, 29, 30, 30];

export function makeProblem(rand: () => number): SubnetProblem {
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const [a, b] = pick(FIRST_OCTETS);
  const c = Math.floor(rand() * 255);
  const d = 1 + Math.floor(rand() * 254);
  const prefix = pick(PREFIXES);
  return solve(`${a}.${b}.${c}`, d, prefix);
}

/** Works out one problem: `base` is the first three octets, `host` the last octet of the given address. */
export function solve(base: string, host: number, prefix: number): SubnetProblem {
  const hostBits = 32 - prefix;
  const block = 2 ** hostBits;
  const maskOctet = 256 - block;
  const start = Math.floor(host / block) * block;
  const end = start + block - 1;
  const usable = block - 2;
  const answers: SubnetAnswers = {
    mask: `255.255.255.${maskOctet}`,
    block: String(block),
    network: `${base}.${start}`,
    broadcast: `${base}.${end}`,
    first: `${base}.${start + 1}`,
    last: `${base}.${end - 1}`,
    hosts: String(usable),
  };
  const starts = Array.from({ length: Math.min(256 / block, 6) }, (_, i) => i * block);
  const steps = [
    `/${prefix} leaves 32 − ${prefix} = ${hostBits} host bits, so each subnet (block) holds 2 to the power of ${hostBits} = ${block} addresses.`,
    block === 256
      ? 'A /24 uses the whole last octet, so the mask ends in 0: 255.255.255.0.'
      : `The mask's last octet is 256 − ${block} = ${maskOctet}, so the mask is 255.255.255.${maskOctet}.`,
    block === 256
      ? `There is only one block in the last octet: .0 to .255. ${host} is inside it.`
      : `Blocks start at multiples of ${block}: ${starts.join(', ')}${256 / block > 6 ? ', and so on' : ''}. ${host} falls in the block that starts at ${start}.`,
    `So the network address is ${answers.network}. The next block starts at ${end + 1}, so the broadcast (the last address of this block) is ${answers.broadcast}.`,
    `Usable addresses are everything in between: ${answers.first} to ${answers.last}, which is ${block} − 2 = ${usable} hosts.`,
  ];
  return { address: `${base}.${host}`, prefix, answers, steps };
}

/** Lenient comparison: ignores spaces and a leading slash or dot the learner may type. */
export function sameAnswer(given: string, expected: string): boolean {
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '').replace(/^[/.]/, '');
  return !!given.trim() && clean(given) === clean(expected);
}
