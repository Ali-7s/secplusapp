import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, emailInspector, exam, examPbqs, h, list, mcq, p, pbq, recap, table, tip, trap, words } from '../dsl';

const MAIL_AUTH: MatchQuestion = {
  id: 'topic-phishing-mail-auth', domain: 4, objective: '4.5', kind: 'match',
  scenario: 'Fernleaf (fernleaf.com) sends mail from its gateway at 198.51.100.10 and through a newsletter platform listed at _spf.newsletter.example. Its own mail is DKIM signed with d=fernleaf.com. Five messages arrive at a partner\'s mail server, all with From: someone@fernleaf.com.',
  blocks: [
    { kind: 'table', title: 'Fernleaf\'s DNS records', columns: ['Name', 'Type', 'Value'], mono: [0, 2], rows: [
      ['fernleaf.com.', 'TXT', '"v=spf1 ip4:198.51.100.10 include:_spf.newsletter.example -all"'],
      ['s1._domainkey.fernleaf.com.', 'TXT', '"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."'],
      ['_dmarc.fernleaf.com.', 'TXT', '"v=DMARC1; p=reject; rua=mailto:dmarc-reports@fernleaf.com"'],
    ] },
  ],
  stem: 'Choose what the receiving server does with each message, then the right change for a new requirement.',
  choices: ['Delivered', 'Quarantined (spam folder)', 'Rejected'],
  prompts: [
    { label: 'Sent from 198.51.100.10 and signed with d=fernleaf.com', answer: 'Delivered',
      why: 'The gateway is in the SPF record and the DKIM signature is valid for fernleaf.com, so both pass and align with the From domain.' },
    { label: 'Sent from 203.0.113.99, a server in a botnet, with no DKIM signature', answer: 'Rejected',
      why: 'The address is not in the SPF record and -all makes that a fail. There is no signature, so DMARC fails, and p=reject tells the receiver to refuse it.' },
    { label: 'A newsletter sent by the platform in the include:, signed with d=fernleaf.com', answer: 'Delivered',
      why: 'include: brings in the platform\'s own list of servers, so SPF passes, and the signature passes too.' },
    { label: 'A real Fernleaf message forwarded by a university\'s mail server; the signature is untouched', answer: 'Delivered',
      why: 'SPF fails because the forwarder is not in Fernleaf\'s record, but DMARC needs only one aligned pass, and the DKIM signature survived forwarding.' },
    { label: 'Sent from the attacker\'s own server, which passes SPF and DKIM for attacker.example', answer: 'Rejected',
      why: 'Both checks pass, but for attacker.example, not for the fernleaf.com in the From line. DMARC requires alignment with the From domain, so it fails.' },
    { label: 'Marketing will also send through a new CRM platform that cannot sign with DKIM. What should change?',
      choices: ['Add the platform\'s servers to the SPF record with another include:', 'Change the DMARC policy to p=none', 'Replace -all with +all in the SPF record', 'Publish a second DKIM record with no key'],
      answer: 'Add the platform\'s servers to the SPF record with another include:',
      why: 'With the platform listed in SPF, its mail passes an aligned SPF check, which is enough for DMARC. Weakening DMARC or SPF would let spoofers through too.' },
  ],
  takeaway: 'SPF lists the servers allowed to send, DKIM signs each message, and DMARC passes when either one passes for the domain in the From line, then says what to do with failures: none, quarantine or reject.',
};

export const PHISHING: LessonBody = {
  goals: [
    'Name the kinds of phishing and other social engineering by their channel and target',
    'Inspect a message for warning signs: sender, reply address, links, attachments, urgency and authentication results',
    'Explain what SPF, DKIM and DMARC each check, and work out whether a message passes',
    'Recommend controls against phishing: email gateways, awareness training and reporting',
  ],
  blocks: [
    recap('From Networking lesson 8: DNS turns names into addresses and can hold text (TXT) records. From topic 3: a **digital signature** proves who signed and that nothing changed. Email authentication puts both together: rules and public keys in DNS, signatures on each message.'),
    words(
      ['Social engineering', 'Tricking people, rather than computers, into giving access or information'],
      ['Phishing', 'A fake message, usually email, that gets you to click, sign in, pay or open something'],
      ['Spear phishing', 'Phishing aimed at one person or team, using details about them'],
      ['Whaling', 'Spear phishing aimed at senior executives'],
      ['Vishing / smishing', 'Phishing by voice call / by text message'],
      ['BEC', 'Business email compromise: fraud using a real or lookalike business mailbox, often to redirect payments'],
      ['Pretexting', 'A made-up story that makes a request seem reasonable'],
      ['Typosquatting', 'Registering a domain that looks like a real one, such as c0ntoso.com'],
      ['SPF', 'A DNS record listing the servers allowed to send mail for a domain'],
      ['DKIM', 'A signature on each message, checked with a public key published in DNS'],
      ['DMARC', 'A DNS policy saying what to do when SPF and DKIM do not match the From domain, and where to send reports'],
    ),

    h('The many faces of phishing', { objective: '2.2', keep: 'Phishing is by email, vishing by phone, smishing by text. Spear phishing targets one person, whaling targets executives, and business email compromise redirects payments. Look for urgency, mismatched senders and links, and requests to sign in or pay.' }),
    p('Phishing works because it attacks people instead of technology. Every variant has the same shape: a believable **pretext**, a sense of **urgency**, and a request to **click, sign in, pay or open**.'),
    table(
      ['Attack', 'Channel', 'Recognize it by'],
      [
        ['Phishing', 'Email, sent widely', 'Generic greeting, a link to "verify your account"'],
        ['Spear phishing', 'Email, to one target', 'Real names, projects or colleagues, researched from social media'],
        ['Whaling', 'Email, to executives', 'Legal threats, board matters, wire transfers'],
        ['Vishing', 'Phone call', 'A "help desk" or "bank" asking for a code or a password reset'],
        ['Smishing', 'Text message', 'Parcel fees, bank alerts, short links'],
        ['Business email compromise', 'A real or lookalike business mailbox', 'Changed bank details, urgent payments, a boss who cannot be called'],
        ['Watering hole', 'A website the targets already visit', 'A trusted industry site quietly serving malware'],
        ['Typosquatting and brand impersonation', 'Lookalike domains and logos', 'One wrong letter in the address, copied branding'],
      ],
      { caption: 'Social engineering attacks' },
    ),
    trap('A logo, a signature and a reply to a real thread prove nothing: they are easy to copy, and in **business email compromise** the attacker is writing from inside a real mailbox. Judge the **request**, and confirm payment changes by phone on a number you already have.'),

    h('Try it: inspect the inbox', { objective: '2.2', keep: 'Check the sender\'s real address and the reply address, where links really go, the attachment\'s real type, the authentication results, and whether the message rushes you to sign in, pay or open something.' }),
    emailInspector(),
    tip('Real users need a **report phishing** button and no blame for using it. One early report lets the security team pull the same message from every inbox.'),

    h('SPF, DKIM and DMARC', { objective: '4.5', keep: 'SPF lists the servers allowed to send for a domain. DKIM signs each message with a key published in DNS. DMARC passes when either passes and matches the From domain, tells receivers to allow, quarantine or reject failures, and sends reports.' }),
    p('Anyone can write any From address, just as anyone can write any return address on an envelope. Three DNS records let a receiving server check the claim:'),
    table(
      ['Record', 'Lives at', 'Checks', 'Example'],
      [
        ['SPF', 'TXT at the domain', 'Is the sending server on the list?', 'v=spf1 ip4:198.51.100.10 include:_spf.newsletter.example -all'],
        ['DKIM', 'TXT at selector._domainkey', 'Is the signature valid, so the message is unchanged?', 'v=DKIM1; k=rsa; p=(public key)'],
        ['DMARC', 'TXT at _dmarc', 'Did SPF or DKIM pass for the From domain? If not, what now?', 'v=DMARC1; p=reject; rua=mailto:reports@...'],
      ],
      { caption: 'Email authentication records', mono: [3] },
    ),
    list(
      '**SPF endings**: `-all` means anything else fails (hard fail), `~all` means soft fail (accept but mark), `+all` lets anyone send, which defeats the point.',
      '**DKIM** signs headers and body with the domain\'s private key. The receiver fetches the public key from DNS. It survives forwarding, where SPF often fails.',
      '**DMARC alignment**: a pass only counts if it is for the same domain the reader sees in From. That is what stops an attacker passing SPF for their own domain.',
      '**DMARC policy**: `p=none` only reports, `p=quarantine` sends failures to spam, `p=reject` refuses them. Start at none, read the `rua` reports, then tighten.',
    ),
    analogy('SPF is the list of couriers allowed to deliver for a company, DKIM is the company\'s wax seal on each letter, and DMARC is the note on the mail room door: "If the courier is not on the list and the seal is broken, shred it, and tell us."'),
    exam('Spoofed mail from your own domain is still arriving: check **DMARC**, often stuck at **p=none**. Mail fails after forwarding: **SPF** broke, **DKIM** still works. A **secure email gateway** filters spam, malware and links before delivery; **S/MIME** encrypts and signs individual messages end to end.'),

    h('Try it: will this message be delivered?', { objective: '4.5', keep: 'For each message, ask: is the server in SPF, is there a valid DKIM signature, and does either pass for the From domain? One aligned pass is enough; otherwise the DMARC policy decides.' }),
    pbq('Try it: will this message be delivered?', MAIL_AUTH),

    h('Practice: email records at exam level', { objective: '4.5', keep: '-all is a hard fail, include: adds another sender\'s servers, adkim and aspf set strict or relaxed alignment, rua is where reports go, and p= is the policy for failures.' }),
    examPbqs('phishing', 'This comes from the practice exam: read a company\'s SPF, DKIM and DMARC records, say what each part does, and change them to meet new requirements. It loads when you press Start.'),
  ],
  check: [
    mcq('The finance team receives an email from a real supplier\'s address asking them to pay the next invoice into a new bank account. What should they do first?',
      'Call the supplier on a phone number they already have to confirm the change', ['Reply to the email asking the supplier to confirm', 'Check that the message passed SPF, DKIM and DMARC', 'Pay a small test amount to the new account'],
      'This is the pattern of business email compromise. A reply may go to the attacker, and a hijacked real mailbox passes every authentication check, so confirm through a separate channel.'),
    mcq('Which record tells receiving servers to refuse mail that fails authentication for a domain?',
      'DMARC with p=reject', ['SPF with ~all', 'DKIM with a new selector', 'An MX record'],
      'DMARC holds the policy for failures. SPF ~all is only a soft fail, DKIM publishes a key, and MX says where to deliver mail for the domain.'),
    mcq('An attacker sends mail from their own server, which passes SPF for attacker.example, while the From line shows your domain. Why does DMARC fail it?',
      'The SPF pass is for a different domain than the one in From, so it does not align', ['SPF never applies to forged messages', 'The message has too many recipients', 'DMARC checks only the IP reputation'],
      'DMARC counts a pass only when it is for the same domain the reader sees in the From line. That alignment is what defeats this kind of spoofing.'),
    mcq('A caller claiming to be from the help desk asks a user to read out the code that has just arrived on their phone. What is this?',
      'Vishing', ['Smishing', 'Whaling', 'Typosquatting'],
      'Phishing by voice call is vishing. The attacker is trying to get past MFA by getting the user to hand over the one-time code.'),
  ],
};
