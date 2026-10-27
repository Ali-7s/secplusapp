import { CLOZE_BLANK as BLANK, answerSpans, isAcronymClozeCorrect, maskAnswer, otherCardNamed } from './cloze';

describe('maskAnswer', () => {
  it('blanks the acronym wherever it appears', () => {
    expect(maskAnswer('CCMP is the encryption protocol used in WPA2. It replaced TKIP.', ['CCMP']))
      .toBe(`${BLANK} is the encryption protocol used in WPA2. It replaced TKIP.`);
    expect(maskAnswer('Use an ACL. An ACL filters traffic.', ['ACL']))
      .toBe(`Use an ${BLANK}. An ${BLANK} filters traffic.`);
  });

  it('ignores case', () => {
    expect(maskAnswer('Both ipsec and IPsec protect traffic.', ['IPSec']))
      .toBe(`Both ${BLANK} and ${BLANK} protect traffic.`);
  });

  it('blanks plurals and possessives together with the name', () => {
    expect(maskAnswer("ACLs are lists, and an ACL's order matters.", ['ACL']))
      .toBe(`${BLANK} are lists, and an ${BLANK} order matters.`);
    expect(maskAnswer('Backups protect data.', ['Backup'])).toBe(`${BLANK} protect data.`);
  });

  it('only blanks whole names', () => {
    expect(maskAnswer('IP routes packets, unlike IPv4 or IPS or a description.', ['IP']))
      .toBe(`${BLANK} routes packets, unlike IPv4 or IPS or a description.`);
    expect(maskAnswer('An address is not an ad.', ['AD'])).toBe(`An address is not an ${BLANK}.`);
  });

  it('copes with names that contain punctuation', () => {
    expect(maskAnswer('TACACS+ encrypts the whole packet.', ['TACACS+'])).toBe(`${BLANK} encrypts the whole packet.`);
    expect(maskAnswer('S/MIME and SMIME sign mail.', ['S/MIME'])).toBe(`${BLANK} and ${BLANK} sign mail.`);
    expect(maskAnswer('MITRE ATT&CK catalogs tactics.', ['ATT&CK'])).toBe(`MITRE ${BLANK} catalogs tactics.`);
    expect(maskAnswer('CI/CD automates builds.', ['CI/CD'])).toBe(`${BLANK} automates builds.`);
    expect(maskAnswer('PCI DSS and PCI-DSS apply.', ['PCI DSS'])).toBe(`${BLANK} and ${BLANK} apply.`);
    expect(maskAnswer('SD-WAN picks the best link.', ['SD-WAN'])).toBe(`${BLANK} picks the best link.`);
    expect(maskAnswer('AES-256 uses a 256-bit key.', ['AES-256'])).toBe(`${BLANK} uses a 256-bit key.`);
    expect(maskAnswer('SE Linux, also written SELinux, enforces MAC.', ['SE Linux']))
      .toBe(`${BLANK}, also written ${BLANK}, enforces MAC.`);
    expect(maskAnswer('TCP/IP is a protocol suite.', ['TCP/IP'])).toBe(`${BLANK} is a protocol suite.`);
  });

  it('blanks the expansion too, and merges it with an adjacent acronym', () => {
    expect(maskAnswer('The Address Resolution Protocol (ARP) maps IPs to MACs.', ['ARP', 'Address Resolution Protocol']))
      .toBe(`The ${BLANK} maps IPs to MACs.`);
    expect(maskAnswer('Active Directory is a directory service.', ['AD', 'Active Directory']))
      .toBe(`${BLANK} is a directory service.`);
  });

  it('blanks the plural and singular forms of ordinary words', () => {
    expect(maskAnswer('Vulnerabilities are weaknesses; a vulnerability is one.', ['Vulnerability']))
      .toBe(`${BLANK} are weaknesses; a ${BLANK} is one.`);
    expect(maskAnswer('Security policies and a security policy.', ['Security policy']))
      .toBe(`${BLANK} and a ${BLANK}.`);
  });

  it('treats a plural-looking acronym and its singular alike', () => {
    expect(maskAnswer('TTPs describe how a TTP looks.', ['TTPs'])).toBe(`${BLANK} describe how a ${BLANK} looks.`);
  });

  it('leaves other acronyms in the text alone', () => {
    expect(maskAnswer('CCMP replaced TKIP in WPA2.', ['CCMP'])).toBe(`${BLANK} replaced TKIP in WPA2.`);
  });

  it('returns the text unchanged when nothing matches, and an empty string for missing text', () => {
    expect(maskAnswer('Nothing to hide here.', ['XYZ'])).toBe('Nothing to hide here.');
    expect(maskAnswer('', ['XYZ'])).toBe('');
    expect(maskAnswer(undefined, ['XYZ'])).toBe('');
    expect(maskAnswer('Some text.', [undefined, '', '  '])).toBe('Some text.');
  });
});

describe('isAcronymClozeCorrect', () => {
  const deck = [
    { acronym: 'AES', expansion: 'Advanced Encryption Standard' },
    { acronym: 'AES-256', expansion: 'Advanced Encryption Standards 256-bit' },
    { acronym: 'IP', expansion: 'Internet Protocol' },
    { acronym: 'IPS', expansion: 'Intrusion Prevention System' },
    { acronym: 'S/MIME', expansion: 'Secure/Multipurpose Internet Mail Extensions' },
    { acronym: 'TTP', expansion: 'Tactics, Techniques, and Procedures' },
    { acronym: 'TTPs', expansion: 'Tactics, Techniques, and Procedures' },
  ];
  const card = (acronym: string) => deck.find(d => d.acronym === acronym)!;

  it('accepts the acronym ignoring case, spaces and punctuation', () => {
    expect(isAcronymClozeCorrect('ip', card('IP'), deck)).toBeTrue();
    expect(isAcronymClozeCorrect('  smime ', card('S/MIME'), deck)).toBeTrue();
    expect(isAcronymClozeCorrect('s/mime', card('S/MIME'), deck)).toBeTrue();
    expect(isAcronymClozeCorrect('aes 256', card('AES-256'), deck)).toBeTrue();
  });

  it('rejects an empty answer and a part of the acronym', () => {
    expect(isAcronymClozeCorrect('', card('AES'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('   ', card('AES'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('A', card('AES'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('AE', card('AES'), deck)).toBeFalse();
  });

  it('rejects a longer or shorter acronym that belongs to another card', () => {
    expect(isAcronymClozeCorrect('IPS', card('IP'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('IP', card('IPS'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('AES', card('AES-256'), deck)).toBeFalse();
    expect(isAcronymClozeCorrect('AES-256', card('AES'), deck)).toBeFalse();
  });

  it('accepts a synonym that has the same expansion', () => {
    expect(isAcronymClozeCorrect('TTPs', card('TTP'), deck)).toBeTrue();
    expect(isAcronymClozeCorrect('ttp', card('TTPs'), deck)).toBeTrue();
  });
});

describe('answerSpans', () => {
  it('splits the text into plain text and mentions of the answer, keeping the original wording', () => {
    expect(answerSpans('AH is an IPsec protocol. Use an AH header.', ['AH', 'Authentication Header'])).toEqual([
      { text: 'AH', answer: true },
      { text: ' is an IPsec protocol. Use an ', answer: false },
      { text: 'AH', answer: true },
      { text: ' header.', answer: false },
    ]);
  });

  it('keeps plurals with the name and skips upper-case look-alikes', () => {
    expect(answerSpans('ACLs and ACLS', ['ACL'])).toEqual([
      { text: 'ACLs', answer: true },
      { text: ' and ACLS', answer: false },
    ]);
  });

  it('rebuilds the original text exactly', () => {
    const text = 'The Address Resolution Protocol (ARP) maps IPs to MACs.';
    expect(answerSpans(text, ['ARP', 'Address Resolution Protocol']).map(s => s.text).join('')).toBe(text);
    expect(answerSpans('', ['ARP'])).toEqual([]);
  });
});

describe('otherCardNamed', () => {
  const deck = [{ name: 'AH' }, { name: 'IPsec' }, { name: 'ESP' }];

  it('finds the other card a wrong answer names, ignoring case and punctuation', () => {
    expect(otherCardNamed('ip-sec', deck[0], deck, c => c.name)).toBe(deck[1]);
  });

  it('ignores the card itself, unknown answers and blank input', () => {
    expect(otherCardNamed('AH', deck[0], deck, c => c.name)).toBeUndefined();
    expect(otherCardNamed('nope', deck[0], deck, c => c.name)).toBeUndefined();
    expect(otherCardNamed('  ', deck[0], deck, c => c.name)).toBeUndefined();
  });
});
