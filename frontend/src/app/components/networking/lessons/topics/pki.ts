import { CertInfo, LessonBody } from '../../networking.model';
import { analogy, certs, exam, examPbqs, h, list, mcq, p, recap, steps, table, tip, trap, words } from '../dsl';

// ── The certificate cases ───────────────────────────────────────────────

const TODAY = '2026-10-31';

const ROOT: CertInfo = {
  role: 'Root CA', subject: 'CN=Example Root CA R1', issuer: 'CN=Example Root CA R1',
  validFrom: '2016-05-01', validTo: '2036-05-01', trusted: true,
};

const ISSUING: CertInfo = {
  role: 'Intermediate (issuing) CA', subject: 'CN=Example Issuing CA 2', issuer: 'CN=Example Root CA R1',
  validFrom: '2021-03-01', validTo: '2031-03-01',
};

const SAN = 'Names (SAN)';
const STATUS = 'Revocation check (OCSP)';

/** A site certificate issued by the example CA, with the fields that vary from case to case. */
const site = (cn: string, names: string, from: string, to: string, status = 'Good'): CertInfo => ({
  role: 'Site certificate', subject: `CN=${cn}`, issuer: 'CN=Example Issuing CA 2', validFrom: from, validTo: to,
  fields: [{ name: SAN, value: names }, { name: 'Key usage', value: 'Digital signature, server authentication' }, { name: STATUS, value: status }],
});

const VERDICTS = [
  'Trust it: show the padlock',
  'Warn: the name does not match',
  'Warn: expired or not yet valid',
  'Warn: it does not lead to a trusted root',
  'Warn: it has been revoked',
];
const [TRUST, NAME, DATES, UNTRUSTED, REVOKED] = VERDICTS;

// ── The lesson ──────────────────────────────────────────────────────────

export const PKI: LessonBody = {
  goals: [
    'Read a certificate: subject and SAN names, issuer, validity dates, public key and signature',
    'Explain the chain of trust from a site certificate up to a root your device already trusts',
    'Describe how a certificate is requested with a CSR, and how it is revoked with a CRL, OCSP or OCSP stapling',
    'Decide whether a browser should trust a certificate, and say exactly why not when it should not',
    'Choose the right certificate type, and the right place to keep a private key',
  ],
  blocks: [
    recap('From topic 1: a **public key** can be shared with anyone, a **private key** never leaves its owner, and a **digital signature** is made with a private key and checked with the matching public key. A **hash** is a fixed-length fingerprint of data.'),
    words(
      ['Certificate', 'A signed document that says "this public key belongs to this name", valid for a set time'],
      ['Certificate authority (CA)', 'An organization trusted to check identities and sign certificates'],
      ['Root CA', 'A CA at the top of a chain. Its certificate is signed by itself and comes preinstalled on your device'],
      ['Intermediate (issuing) CA', 'A CA whose certificate the root signed, and which signs the certificates of sites'],
      ['Chain of trust', 'The line of signatures from a site certificate up to a trusted root'],
      ['Trust store', 'The list of root CA certificates a device or browser trusts. Also called the root store'],
      ['Subject', 'Who the certificate is for'],
      ['SAN', 'Subject Alternative Name: the list of names (websites) a certificate is valid for'],
      ['CSR', 'Certificate signing request: what you send a CA to ask for a certificate. Holds your public key, not your private key'],
      ['RA', 'Registration authority: checks who you are on behalf of the CA'],
      ['Revocation', 'Cancelling a certificate before its expiry date'],
      ['CRL', 'Certificate revocation list: a signed list of cancelled certificates that clients download'],
      ['OCSP', 'Online Certificate Status Protocol: asking the CA about one certificate, "is it still good?"'],
      ['Self-signed', 'A certificate signed by its own key rather than by a CA'],
      ['HSM', 'Hardware security module: a tamper-resistant device that stores keys and does cryptography inside itself'],
    ),

    h('What a certificate is', { objective: '1.4', keep: 'A certificate binds a public key to a name, for a limited time, and is signed by a certificate authority. Its key fields are the subject and SAN names, the issuer, the validity dates, the public key and the signature.' }),
    p('Topic 1 left a gap. To send Bob a secret you lock it with Bob\'s public key, but if you download "Bob\'s public key" from the internet, how do you know it is really his? An attacker sitting in the middle could hand you **their** public key instead, read everything, and pass it on. This is a **man-in-the-middle** attack.'),
    p('A **certificate** closes the gap. It is a small document that says "this public key belongs to shop.example.com", and it is **digitally signed** by a **certificate authority (CA)** that checked the claim. If you trust the CA, and the signature checks out with the CA\'s public key, you can trust the binding. Certificates follow a standard format called **X.509**.'),
    analogy('A certificate is a **passport**. The government (the CA) checked who you are and signed the passport so it cannot be forged. A border officer (your browser) does not know you, but trusts the government\'s signature, checks your face (the name) and the expiry date.'),
    table(
      ['Field', 'What it says', 'Example'],
      [
        ['Subject', 'Who the certificate is for', 'CN=shop.example.com'],
        ['Subject Alternative Name (SAN)', 'Every name it is valid for. Browsers check the address against this list', 'shop.example.com, www.shop.example.com'],
        ['Issuer', 'Which CA signed it', 'CN=Example Issuing CA 2'],
        ['Valid from, valid to', 'The dates it may be used between', '2026-08-01 to 2026-11-29'],
        ['Public key', 'The subject\'s public key, which the certificate vouches for', 'An RSA or ECC public key'],
        ['Serial number', 'A unique number from the CA, used when revoking it', '04:A3:9F:...'],
        ['Key usage', 'What the key may be used for', 'Server authentication, code signing, email'],
        ['Signature', 'The CA\'s signature over all of the above', 'Signed with SHA-256 and RSA'],
      ],
    ),
    trap('A certificate holds the **public** key only. The private key is never in it, and never leaves the server. Anyone may have a copy of a certificate: your browser receives one from every HTTPS site.'),

    h('The chain of trust', { objective: '1.4', keep: 'Your device trusts a short list of root CAs. A root signs intermediate CAs, and an intermediate signs site certificates. The browser follows the signatures up to a root it already trusts, so a site must send its intermediate too.' }),
    p('Your browser cannot know every CA in the world. Instead, your operating system or browser ships with a **trust store**: a list of a few hundred **root CA** certificates it trusts. Each root is the **root of trust** for everything below it. A root certificate is signed by its own key (it has nobody above it), which is fine because the device already trusts it.'),
    p('Roots almost never sign site certificates directly. They sign **intermediate** (issuing) CAs, and the intermediates sign sites. The result is a chain:'),
    {
      type: 'flow', direction: 'down', caption: 'Each certificate is signed by the one above it',
      nodes: [
        { label: 'Example Root CA R1', sub: 'Root CA: preinstalled in your trust store, kept offline', tone: 'safe' },
        { label: 'Example Issuing CA 2', sub: 'Intermediate CA: signed by the root, online, signs sites', tone: 'accent' },
        { label: 'shop.example.com', sub: 'Site certificate: signed by the intermediate', tone: 'neutral' },
      ],
    },
    p('Why the middle step? The root\'s private key is so valuable that it is kept **offline**, often in a safe, and used only to sign intermediates. If an intermediate is ever compromised, the CA revokes just that intermediate; the root, already installed on billions of devices, does not change.'),
    p('When you visit a site, the server sends its own certificate **and** the intermediate. Your browser then checks, in order:'),
    steps(
      'The address you typed is one of the certificate\'s **SAN** names.',
      'Today is between the **valid from** and **valid to** dates.',
      'Each **signature** checks out with the public key of the certificate above it, all the way up.',
      'The top of the chain is a root in the **trust store**.',
      'The certificate has not been **revoked** (covered two parts on).',
    ),
    tip('A common real-world mistake: the server sends only its own certificate and forgets the intermediate. Some browsers can fetch the missing piece and some cannot, so the site works for some visitors and shows a warning for others.'),

    h('Getting a certificate: the CSR', { objective: '1.4', keep: 'Generate the key pair where it will be used. Send the CA only a CSR (public key plus names, signed with the private key). The CA validates you and signs. Install the certificate with its intermediate chain, and track the expiry.' }),
    p('Here is how a web server gets its certificate, with the private key never leaving it. Step through it:'),
    {
      type: 'sequence',
      title: 'Requesting a certificate',
      steps: [
        { from: 'Admin', to: 'Web server', label: 'Generate a key pair on the server', note: 'The administrator generates the key pair **on the server itself** (or in its HSM). The private key is never copied anywhere.' },
        { from: 'Web server', to: 'CA', label: 'CSR', note: 'A **certificate signing request** carries the public key and the names wanted (subject and SAN), and is signed with the private key to prove the requester holds it. It does **not** contain the private key.' },
        { from: 'CA', to: 'Web server', label: 'Prove you control the domain', note: 'The CA, or a **registration authority (RA)** working for it, checks the request. For a website that means proving control of the domain, for example by publishing a DNS record or a file the CA asks for.' },
        { from: 'CA', to: 'Web server', label: 'Signed certificate', note: 'The CA signs the certificate with its intermediate\'s private key and sends it back, along with the intermediate certificate.' },
        { from: 'Web server', to: 'Browser', label: 'Certificate + intermediate', note: 'The administrator installs both, tests the site from a browser, and sets up monitoring so the certificate is renewed **before** it expires. Public certificates now last months, not years, so renewal is usually automated.' },
      ],
    },
    p('CAs check different amounts before signing, and the certificate records which:'),
    table(
      ['Validation level', 'What the CA checked', 'Typical use'],
      [
        ['Domain validation (DV)', 'Only that you control the domain', 'Most websites. Fast and often free'],
        ['Organization validation (OV)', 'The domain, plus that the organization legally exists', 'Business sites'],
        ['Extended validation (EV)', 'A thorough check of the organization\'s identity', 'Banks and payment sites. Only for public domain names, never internal ones'],
      ],
    ),

    h('Revocation: cancelling a certificate early', { objective: '1.4', keep: 'If a private key leaks or a certificate was issued wrongly, it is revoked before it expires. Browsers check a CRL (a downloaded list), ask OCSP about one certificate, or read an OCSP answer the server staples into the handshake.' }),
    p('A certificate is valid until its expiry date, unless something goes wrong first: its private key leaks, the CA made a mistake, or the site closes. Then the CA **revokes** it. The hard part is telling every browser in the world. There are three ways:'),
    table(
      ['Method', 'How it works', 'Weak spots'],
      [
        ['CRL (certificate revocation list)', 'The CA publishes a signed list of revoked serial numbers. Clients download it now and then', 'Can be large, and is only as fresh as the last download'],
        ['OCSP', 'The client asks the CA\'s OCSP responder about one certificate and gets a signed "good", "revoked" or "unknown"', 'An extra round trip, and the CA learns which sites you visit'],
        ['OCSP stapling', 'The **server** asks OCSP about its own certificate every few hours and attaches (staples) the signed answer to the TLS handshake', 'Needs the server to support it. Fixes both of OCSP\'s problems'],
      ],
    ),
    exam('Slow revocation checks plus a privacy worry (the CA can see where users go) point to **OCSP stapling**. A question about checking many certificates offline, or a published list, points to a **CRL**.'),
    p('If a private key leaks, the order matters. Confirm which certificate it belongs to, then:'),
    steps(
      'Generate a **new** key pair. Never get a new certificate for the leaked key.',
      'Create a CSR from the new key and get the replacement certificate.',
      'Install it and confirm the site serves it, so the site is never left without a valid certificate.',
      'Revoke the old certificate with the reason **keyCompromise**, and check the CRL or OCSP shows it as revoked.',
      'Find out how the key leaked and fix that.',
    ),

    h('Should the browser trust it?', { objective: '1.4', keep: 'Check four things: the address is in the SAN list, today is within the dates, the chain leads to a trusted root, and the certificate is not revoked. Any one failing means a warning. A wildcard covers exactly one level.' }),
    p('Time to be the browser. Each case shows the address being visited, today\'s date and the chain the server sent, root at the top. Work through the five checks from "The chain of trust" and pick a verdict.'),
    certs('Should the browser trust it?', VERDICTS, [
      {
        name: 'Case 1', site: 'https://shop.example.com', today: TODAY, answer: TRUST,
        chain: [site('shop.example.com', 'shop.example.com, www.shop.example.com', '2026-08-01', '2026-11-29'), ISSUING, ROOT],
        why: 'Every check passes. The address is in the SAN list, today falls between the dates, each certificate is signed by the one above, the root is in the trust store and OCSP says Good. The root being signed by itself is normal: every root is.',
      },
      {
        name: 'Case 2', site: 'https://shop.example.com', today: TODAY, answer: DATES,
        chain: [site('shop.example.com', 'shop.example.com, www.shop.example.com', '2026-07-16', '2026-10-14'), ISSUING, ROOT],
        clue: { cert: 0, field: 'Valid to' },
        why: 'The certificate expired on 14 October, and today is the 31st. Nothing else is wrong, which is typical: forgotten renewals are the most common certificate outage. The fix is to renew it and automate renewal.',
      },
      {
        name: 'Case 3', site: 'https://mail.example.com', today: TODAY, answer: TRUST,
        chain: [site('*.example.com', '*.example.com, example.com', '2026-09-01', '2027-03-01'), ISSUING, ROOT],
        why: 'A **wildcard** name `*.example.com` covers any single label in place of the star, so mail.example.com matches. The rest of the chain is fine, so the browser trusts it.',
      },
      {
        name: 'Case 4', site: 'https://api.dev.example.com', today: TODAY, answer: NAME,
        chain: [site('*.example.com', '*.example.com, example.com', '2026-09-01', '2027-03-01'), ISSUING, ROOT],
        clue: { cert: 0, field: SAN },
        why: 'The star replaces exactly **one** label. `*.example.com` covers dev.example.com but not api.dev.example.com, which has two labels in front. The fix is a certificate for `*.dev.example.com`, or a SAN certificate listing the exact names.',
      },
      {
        name: 'Case 5', site: 'https://nas.office.example', today: TODAY, answer: UNTRUSTED,
        chain: [{
          role: 'Site certificate (self-signed)', subject: 'CN=nas.office.example', issuer: 'CN=nas.office.example',
          validFrom: '2025-01-10', validTo: '2035-01-10', trusted: false,
          fields: [{ name: SAN, value: 'nas.office.example' }],
        }],
        clue: { cert: 0, field: 'Trust store' },
        why: 'The issuer is the same as the subject: the device signed its own certificate. Nothing vouches for it, so the chain stops at a certificate that is not in the trust store. An attacker could make an identical-looking one. The fix is a certificate from the company\'s **internal CA**, whose root is pushed to every company device.',
      },
      {
        name: 'Case 6', site: 'https://pay.example.com', today: TODAY, answer: REVOKED,
        chain: [site('pay.example.com', 'pay.example.com', '2026-09-15', '2026-12-14', 'Revoked on 2026-10-20, reason: keyCompromise'), ISSUING, ROOT],
        clue: { cert: 0, field: STATUS },
        why: 'Name, dates and chain are all fine, but the OCSP answer says the certificate was revoked because its private key leaked. Someone holding that key could pretend to be the site, so the browser must refuse it however valid it looks otherwise.',
      },
    ], 'Look at the chain, then pick one verdict per case. The outlined field after checking is the one that decides it.'),

    h('Kinds of certificates', { objective: '1.4', keep: 'SAN lists several names, a wildcard covers one level under a domain, self-signed is trusted by nobody by default, an internal CA suits company-only systems, code signing proves software is unchanged, and pinning accepts only the expected certificate.' }),
    table(
      ['Type', 'What it is for', 'Watch out'],
      [
        ['SAN certificate', 'One certificate listing several different names, even different domains', 'Every name must be listed; adding one means reissuing'],
        ['Wildcard certificate', 'Any one label under a domain: `*.example.com`', 'Exactly one level. One leaked key exposes every subdomain'],
        ['Self-signed certificate', 'Labs, testing, a device\'s first setup', 'No CA vouches for it, so browsers warn'],
        ['Third-party (public CA)', 'Public websites that any visitor must trust', 'Costs money for OV and EV; DV is often free'],
        ['Internal CA', 'Company-only sites and devices; the CA\'s root is pushed to company devices by policy', 'Outside devices do not trust it'],
        ['Code signing', 'Proves software or scripts come from the publisher and were not changed', 'Lets endpoints refuse unsigned or altered code'],
        ['Email (S/MIME)', 'Signing and encrypting email for one person\'s address', 'Each user needs their own'],
        ['User or device (client)', 'Proves a user or machine\'s identity, for example for VPN or Wi-Fi sign-in, or on a smart card', 'Issued and revoked per person or device'],
      ],
    ),
    p('**Certificate pinning** goes one step further than the chain checks. An app (often a mobile banking app) is built to accept only one specific certificate or public key for its server. Even a valid certificate from a trusted but compromised CA is refused. The cost: when the server\'s key changes, the app must be updated too.'),

    h('Protecting private keys', { objective: '1.4', keep: 'Keep private keys in hardware where possible: an HSM for servers and CAs, a TPM or secure enclave in devices, a KMS in the cloud. Keep the root CA offline. Key escrow keeps a copy with a trusted party for recovery.' }),
    p('A certificate is only as safe as its private key. These are the places keys are kept, from strongest to most convenient:'),
    table(
      ['Where', 'What it is', 'Typical use'],
      [
        ['HSM (hardware security module)', 'A tamper-resistant appliance or card. Keys are made inside and never leave; it does the signing itself', 'CA keys, payment systems, busy TLS servers'],
        ['TPM (trusted platform module)', 'A chip on a computer\'s motherboard that stores keys and checks the boot process', 'Full-disk encryption keys (BitLocker), device identity'],
        ['Secure enclave', 'A protected area inside a phone or computer processor', 'Phone passcodes, fingerprint and face data, payment keys'],
        ['KMS (key management service)', 'A cloud service that creates, stores, rotates and logs use of keys', 'Encrypting cloud storage and databases'],
        ['Key escrow', 'A copy of a key held by a trusted third party', 'Recovering encrypted data if the original key is lost, or for legal access'],
      ],
    ),
    list(
      'The **root CA** stays **offline**, switched off in a safe, and is brought out only to sign or renew intermediates.',
      '**Rotate** keys on a schedule and whenever someone with access leaves, and give certificates short lifetimes so a leaked key is useful for less time.',
    ),

    h('Exam-level PBQs', { objective: '1.4', keep: 'The certificate PBQs test three things: choosing the certificate type or feature for each need, the order of requesting a certificate, and the order of responding to a leaked key.' }),
    examPbqs('pki', 'These come from the practice exam: matching certificate types to needs, ordering a certificate request, and responding to a leaked private key. Everything they need is in this topic. They load when you press Start.'),
  ],
  check: [
    mcq('A server reached as api.dev.example.com has a certificate for *.example.com. What happens when a browser connects?',
      'The browser warns of a name mismatch, because a wildcard covers only one level',
      ['It works, because a wildcard covers every subdomain at any depth', 'The browser warns that the certificate is self-signed', 'It works only if OCSP stapling is turned on'],
      'The star stands for exactly one label. api.dev.example.com has two labels in front of example.com, so it needs `*.dev.example.com` or a SAN entry for the exact name.'),
    mcq('Users find revocation checks slow, and the privacy team objects that the CA learns which sites users visit. What fixes both?',
      'OCSP stapling', ['Publishing the CRL every hour', 'Certificate pinning', 'Switching to a wildcard certificate'],
      'With stapling, the server fetches its own signed OCSP answer and hands it over in the handshake, so clients never contact the CA. A CRL still has to be fetched and can be large; pinning and wildcards do not deal with revocation.'),
    mcq('Why do certificate authorities sign site certificates with an intermediate CA instead of the root?',
      'So the root\'s private key can stay offline, and a compromised intermediate can be revoked without replacing the root on every device',
      ['Because root certificates cannot contain a public key', 'Because intermediates encrypt web traffic faster', 'So that site certificates do not need an expiry date'],
      'The root is the anchor installed everywhere. Keeping it offline and doing day-to-day signing with an intermediate limits the damage of any compromise to that one intermediate.'),
    mcq('What does a certificate signing request (CSR) contain?',
      'The public key and the names to be certified, signed with the matching private key',
      ['The private key, so the CA can sign with it', 'The CA\'s signature and the full chain', 'The list of certificates the CA has revoked'],
      'The private key never leaves the server. The CSR carries only the public key and the requested names, and signing it with the private key proves the requester holds that key.'),
  ],
};
