import { rankBySearch, searchRank } from './search-rank';

describe('search ranking', () => {
  const cards = [
    { acronym: 'CA', expansion: 'Certificate Authority', definition: 'Issues certificates in a PKI' },
    { acronym: 'CRL', expansion: 'Certificate Revocation List', definition: 'A PKI list of revoked certificates' },
    { acronym: 'PKI', expansion: 'Public Key Infrastructure', definition: 'The system of certificates and CAs' },
    { acronym: 'PKIX', expansion: 'PKI X.509', definition: 'Standards for PKI on the internet' },
    { acronym: 'SPKI', expansion: 'Simple Public Key Infrastructure', definition: 'An alternative trust model' },
  ];
  const search = (q: string) =>
    rankBySearch(cards, c => searchRank(q, c.acronym, c.expansion, [c.definition])).map(c => c.acronym);

  it('puts the exact acronym first, then acronyms that start with it, then the rest', () => {
    expect(search('PKI')).toEqual(['PKI', 'PKIX', 'SPKI', 'CA', 'CRL']);
  });

  it('ignores case and surrounding spaces', () => {
    expect(search('  pki ')[0]).toBe('PKI');
  });

  it('finds a card by its full name, and by the start of a word in it', () => {
    expect(search('public key infrastructure')[0]).toBe('PKI');
    expect(search('revocation')).toEqual(['CRL']);
  });

  it('keeps alphabetical order within a rank and drops cards that do not match', () => {
    expect(search('certificate')).toEqual(['CA', 'CRL', 'PKI']);
    expect(search('zzz')).toEqual([]);
  });

  it('ranks an acronym containing the search above a word in a full name', () => {
    const list = [
      { acronym: 'HMAC', expansion: 'Hash-Based Message Authentication Code', definition: '' },
      { acronym: 'ML', expansion: 'Machine Learning', definition: '' },
      { acronym: 'MAC', expansion: 'Mandatory Access Control', definition: '' },
    ];
    expect(rankBySearch(list, c => searchRank('mac', c.acronym, c.expansion, [c.definition])).map(c => c.acronym))
      .toEqual(['MAC', 'HMAC', 'ML']);
  });

  it('ignores short searches hidden inside longer words of a definition', () => {
    expect(searchRank('aes', 'AUP', 'Acceptable Use Policy', ['Rules users agree to, in plain phrases'])).toBeNull();
    expect(searchRank('aes', 'WPA2', 'Wi-Fi Protected Access 2', ['Uses AES encryption'])).toBe(8);
    expect(searchRank('crypt', 'TLS', 'Transport Layer Security', ['Provides encryption in transit'])).toBe(9);
  });

  it('returns everything in the original order for an empty search', () => {
    expect(search('')).toEqual(['CA', 'CRL', 'PKI', 'PKIX', 'SPKI']);
  });
});
