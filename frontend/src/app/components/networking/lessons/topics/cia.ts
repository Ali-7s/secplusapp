import { LessonBody } from '../../networking.model';
import { analogy, ciaSorter, decide, exam, h, mcq, p, recap, step, table, tip, trap, words } from '../dsl';

export const CIA: LessonBody = {
  goals: [
    'Say what confidentiality, integrity and availability each protect, and what breaks each one',
    'Name the goal any attack breaks and any control protects, including the ones that touch two',
    'Explain why systems put the three in a different order, and balance them when they pull against each other',
    'Tell integrity from non-repudiation, walk through authentication, authorization and accounting, and describe a gap analysis',
  ],
  blocks: [
    recap('This topic needs no earlier lesson: it is the starting point for the others. Every control in this app, from a firewall rule to a backup, exists to protect one or more of three goals. Learn to name which, and most exam questions get easier.'),
    words(
      ['CIA triad', 'The three goals of security: confidentiality, integrity and availability'],
      ['Confidentiality', 'Only the people and systems allowed to see data can see it'],
      ['Integrity', 'Data and systems are changed only by those allowed to, and changes can be detected'],
      ['Availability', 'Systems and data are there and usable when the people allowed to use them need them'],
      ['DAD triad', 'The attacker\'s view: disclosure, alteration and destruction (or denial), the opposites of C, I and A'],
      ['Non-repudiation', 'Proof of who did something, so they cannot later deny it'],
      ['Authenticity', 'Proof that data really came from who it claims to come from'],
      ['Authentication', 'Proving you are who you claim to be'],
      ['Authorization', 'Deciding what an authenticated person or system is allowed to do'],
      ['Accounting', 'Recording who did what and when, in logs'],
      ['Gap analysis', 'Comparing how things are now with how they should be, and listing the differences'],
    ),

    h('Three goals: confidentiality, integrity, availability', { objective: '1.2', keep: 'Confidentiality: only the right people can read it. Integrity: only the right people can change it, and changes are detected. Availability: it works when needed. Attackers disclose, alter or destroy.' }),
    p('Security sounds like one thing, but it protects three different properties of information. Each has its own attacks and its own controls, and a control that helps one can do nothing for another.'),
    table(
      ['Goal', 'The question it asks', 'Broken by (DAD)', 'Protected by'],
      [
        ['Confidentiality', 'Can only the right people **read** it?', 'Disclosure: eavesdropping, data theft, shoulder surfing', 'Encryption, access controls, data masking, MFA'],
        ['Integrity', 'Can only the right people **change** it, and would we **notice** a change?', 'Alteration: tampering, on-path changes, edited logs', 'Hashes, digital signatures, write permissions, change control'],
        ['Availability', 'Does it **work** when it is needed?', 'Destruction or denial: DoS, ransomware, outages, disasters', 'Redundancy, backups, load balancing, backup power, patching'],
      ],
      { caption: 'The CIA triad and its opposite, the DAD triad' },
    ),
    analogy('A sealed letter in the post. **Confidentiality** is the envelope: nobody else reads it. **Integrity** is the wax seal: if someone opened it and changed a word, you would see the broken seal. **Availability** is the postal service actually delivering it, on time.'),
    trap('Encryption is not integrity. An encrypted message cannot be read, but on its own nothing stops someone flipping bits in it, and a hash hides nothing at all. That is why secure protocols such as TLS add an integrity check on top of encryption.'),

    h('Try it: what does each attack break?', { objective: '1.2', keep: 'Ask what happened to the data: read by the wrong person (confidentiality), changed (integrity), or made unusable (availability). Accidents and disasters break availability too. Many attacks break one goal to get at another.' }),
    ciaSorter('attacks'),
    exam('Look for the verb in the question. **Viewed, leaked, stolen, intercepted** points to confidentiality. **Modified, tampered, altered, forged** points to integrity. **Down, unreachable, slow, deleted, encrypted by ransomware** points to availability.'),

    h('Try it: what does each control protect?', { objective: '1.2', keep: 'Encryption, masking and read restrictions protect confidentiality. Hashes, signatures, write restrictions and change control protect integrity. Redundancy, backups, load balancing and backup power protect availability. TLS protects confidentiality and integrity.' }),
    ciaSorter('controls'),
    tip('Write access and read access protect different goals. Letting everyone read a document but only one team edit it is an integrity control. Letting only one team read it is a confidentiality control.'),

    h('Balancing the three', { objective: '1.2', keep: 'Every system ranks the goals differently: availability for emergency systems, integrity for medical results and money, confidentiality for secrets and personal data. Strengthening one can weaken another, so choose controls that protect the top goal without breaking the rest.' }),
    p('The three goals pull against each other. More locks and checks protect confidentiality but slow people down; more copies keep things available but give attackers more places to find the data. The right balance depends on what the system is for.'),
    decide('Three systems at a clinic', [
      step(
        { phase: 'Availability first', situation: 'The emergency department\'s patient chart system. A consultant proposes locking any account for 30 minutes after three failed sign-ins, on every workstation including the emergency bays.', question: 'What do you recommend?' },
        { text: 'Keep a fast emergency ("break-glass") sign-in on the emergency bay stations, with every use logged and reviewed afterwards', feedback: 'In an emergency, a doctor locked out for 30 minutes can cost a life, so availability comes first here. Break-glass access keeps the chart available while logging keeps people accountable.' },
        { text: 'Adopt the lockout as proposed: health records are confidential, so confidentiality wins', feedback: 'Confidentiality matters, but a long lockout on emergency stations turns a typo into a patient-safety risk. A control that protects one goal by breaking a more important one is the wrong fit.' },
        { text: 'Remove sign-in from the emergency bay stations entirely so nobody is ever locked out', feedback: 'That keeps the system available but throws away confidentiality and any record of who looked at which chart. Balance means protecting the top goal without abandoning the others.' },
        { text: 'Make the lockout longer, one hour, to stop password guessing completely', feedback: 'Longer lockouts make the availability problem worse and invite attackers to lock out staff on purpose. It moves away from the system\'s main need.' },
      ),
      step(
        { phase: 'Integrity first', situation: 'Blood test results travel from the lab system to the patient charts. The results are not secret inside the clinic, but a changed potassium value could lead to the wrong treatment.', question: 'Which control matters most for this feed?' },
        { text: 'Sign or hash-check every result message, and reject and alert on any that fail the check', feedback: 'A wrong number is the real danger, so integrity comes first. A signature or keyed hash on each message means any change in transit, accidental or deliberate, is caught before a doctor sees it.' },
        { text: 'Add a second lab server so results still arrive if one fails', feedback: 'Redundancy protects availability. It is useful, but it does nothing to stop a changed value reaching a chart.' },
        { text: 'Limit which staff can view lab results', feedback: 'That is a confidentiality control. It decides who reads results, not whether the results are correct.' },
        { text: 'Encrypt the database where results are stored', feedback: 'Encryption at rest protects confidentiality if the disk is stolen. It does not detect a result altered on its way from the lab.' },
      ),
      step(
        { phase: 'Confidentiality first', situation: 'A university research team asks for five years of patient records to study treatment outcomes. They need ages, diagnoses and outcomes, not names or addresses.', question: 'How do you provide the data?' },
        { text: 'Send a de-identified extract with only the fields they need, with names and identifiers masked or tokenized, over an encrypted channel', feedback: 'Confidentiality comes first for personal health data. Giving only the needed fields, with identities removed, means even a leak of the extract reveals little. Encryption protects it on the way.' },
        { text: 'Copy the full database onto an encrypted USB drive and hand it over', feedback: 'Encryption protects the drive in transit, but the researchers still receive every name and address they never needed. Minimizing the data is the stronger confidentiality control.' },
        { text: 'Give the researchers read-only accounts on the live records system', feedback: 'Read-only stops them changing records (integrity), but they can still read every identity, and an outside team now has access to a live clinical system.' },
        { text: 'Make a backup of the records first, in case the researchers damage them', feedback: 'A backup protects availability and integrity of the clinic\'s copy, but this request is about who gets to see personal data.' },
      ),
      step(
        { phase: 'When goals collide', situation: 'Ransomware has encrypted the chart server. Clean offline backups from last night exist. Managers want charts back within the hour, and the attackers offer a decryption key for payment.', question: 'How do you restore the charts?' },
        { text: 'Restore last night\'s backup onto a clean, patched server, check the data before going live, and use paper downtime procedures meanwhile', feedback: 'This brings availability back without trusting the attackers, and checking the restored data protects integrity. Downtime procedures keep patients safe while you work.' },
        { text: 'Pay for the key: it is the fastest way back', feedback: 'There is no guarantee the key works or that the attackers did not change or copy data. You also fund the next attack, and may break sanctions rules.' },
        { text: 'Restore the backup onto the same server right away', feedback: 'Fast, but the malware and the way it got in may still be on that server, so the restored charts could be encrypted again within hours.' },
        { text: 'Keep everything offline until a full forensic investigation is finished, even if that takes weeks', feedback: 'Evidence matters, but weeks without charts in a clinic is an unacceptable availability loss. Capture the evidence, then restore on clean hardware in parallel.' },
      ),
    ], 'Each system ranks the three goals differently. Pick the control that protects what matters most, without breaking the rest.'),
    exam('When a question asks what a business should **prioritize**, find what failure would hurt most: an outage (availability), wrong data (integrity) or a leak (confidentiality). Hospitals and factories often rank availability first; banks rank integrity very high; secrets and personal data rank confidentiality first.'),

    h('Non-repudiation and AAA', { objective: '1.2', keep: 'A hash proves integrity; an HMAC adds proof it came from a key holder; only a digital signature gives non-repudiation. AAA: authentication proves who you are, authorization decides what you may do, accounting logs what you did.' }),
    p('Integrity says the data was not changed. Two more questions often matter: **who** sent or did it, and can they **deny** it later? Three tools answer them differently:'),
    table(
      ['Tool', 'Integrity', 'Shows who sent it', 'Non-repudiation'],
      [
        ['Hash (SHA-256)', 'Yes', 'No: anyone can compute a hash', 'No'],
        ['HMAC (hash with a shared secret key)', 'Yes', 'Yes, someone who holds the key', 'No: both sides hold the same key, so either could have made it'],
        ['Digital signature (private key)', 'Yes', 'Yes, the holder of the private key', 'Yes: only the signer has the private key'],
      ],
      { caption: 'What each tool proves' },
    ),
    p('**AAA** is how a system controls and records access. **Authentication** proves identity: a person with a password, MFA or biometrics; a system with a certificate or 802.1X. **Authorization** then decides what that identity may do, often by role or by attributes. **Accounting** records what it did, so there is an audit trail.'),
    {
      type: 'sequence',
      title: 'AAA: Sam connects to the company VPN',
      steps: [
        { from: 'Sam', to: 'VPN gateway', label: 'Username: sam', note: 'Sam **claims** an identity. A username alone proves nothing; this is identification, the step before authentication.' },
        { from: 'VPN gateway', to: 'RADIUS server', label: 'Password and MFA code', note: '**Authentication.** The gateway passes Sam\'s password and MFA code to a central RADIUS server, which checks them against the directory. Something he knows and something he has.' },
        { from: 'RADIUS server', to: 'VPN gateway', label: 'Accept: group Sales', note: '**Authorization.** The server accepts Sam and returns his group. Policy says Sales may reach the CRM and email, nothing else, which is least privilege.' },
        { from: 'VPN gateway', to: 'RADIUS server', label: 'Accounting start', note: '**Accounting.** The gateway records that the session started: who, when and from which address.' },
        { from: 'Sam', to: 'CRM', label: 'Works for three hours', note: 'Sam reaches the CRM. If he tries the finance server, the gateway blocks it, because authorization did not allow it.' },
        { from: 'VPN gateway', to: 'RADIUS server', label: 'Accounting stop: 3 h, 120 MB', note: 'When Sam disconnects, the stop record gives the session length and data sent. If his account is ever misused, these records show exactly when and how much.' },
      ],
    },
    trap('Authentication is **who you are**; authorization is **what you may do**. A user who signs in successfully but is refused a folder has passed authentication and failed authorization.'),

    h('Gap analysis: where you are and where you need to be', { objective: '1.2', keep: 'A gap analysis compares the current state with a target, often a framework such as NIST CSF or ISO 27001, lists each shortfall, and turns the gaps into a prioritized plan with owners and dates.' }),
    p('Before you can improve security, you need to know what is missing. A **gap analysis** compares the current state with a desired state, usually a framework or a regulation, one requirement at a time.'),
    table(
      ['Step', 'What happens', 'Example'],
      [
        ['Choose the target', 'Pick the standard or goal to measure against', 'NIST Cybersecurity Framework, ISO 27001, PCI DSS'],
        ['Assess the current state', 'Review systems, policies and people against each requirement', 'Interviews, configuration reviews, documentation'],
        ['List the gaps', 'Record where current practice falls short, and how far', '"MFA on email only; the requirement is MFA on all remote access"'],
        ['Plan the fixes', 'Prioritize by risk and cost, give each gap an owner and a date', 'A roadmap the managers sign off and track'],
      ],
      { caption: 'A gap analysis, step by step' },
    ),
    exam('A question about comparing current security with a standard, or finding what is needed to meet a new requirement, is describing a **gap analysis**. It produces a plan; it does not fix anything by itself.'),
  ],
  check: [
    mcq('An attacker on the same network changes the bank account number in a payment file while it is being uploaded. Which goal is broken?',
      'Integrity', ['Confidentiality', 'Availability', 'Non-repudiation'],
      'The data was altered without authorization. Integrity is about data being changed only by those allowed to, and changes being detected.'),
    mcq('A contract is sent with a hash of the document attached. Which does the hash provide?',
      'Proof the document was not changed', ['Proof of who sent the document', 'Proof the sender cannot deny sending it', 'Protection from anyone reading it'],
      'A hash proves integrity only: anyone can compute one, so it shows nothing about the sender, and it hides nothing. Sender proof and non-repudiation need a digital signature.'),
    mcq('A factory\'s control systems must keep running even during an attack, because a stop costs thousands per minute and can be dangerous. Which goal is its highest priority?',
      'Availability', ['Confidentiality', 'Integrity', 'Non-repudiation'],
      'When downtime is the worst outcome, availability comes first. Industrial and emergency systems usually rank it highest.'),
    mcq('A VPN gateway sends a record of each session\'s start, end and data used to a RADIUS server. Which part of AAA is this?',
      'Accounting', ['Authentication', 'Authorization', 'Identification'],
      'Accounting records what an authenticated user did and when. Authentication proves identity and authorization decides what is allowed.'),
    mcq('A company must meet a new regulation and first wants a list of every requirement it does not yet meet. What should it do?',
      'A gap analysis', ['A penetration test', 'A business impact analysis', 'A tabletop exercise'],
      'A gap analysis compares the current state with the target, the regulation here, and lists the shortfalls to fix.'),
  ],
};
