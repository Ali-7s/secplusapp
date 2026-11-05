import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, exam, examPbqs, h, list, mcq, p, pbq, recap, table, tip, trap, words } from '../dsl';

const SPOT_THE_PROTOCOL: MatchQuestion = {
  id: 'topic-signin-spot', domain: 4, objective: '4.6', kind: 'match',
  scenario: 'You are reading a packet capture and some application logs. Each line shows part of a sign-in or a directory lookup.',
  stem: 'Identify the protocol behind each line.',
  choices: ['Kerberos', 'SAML', 'OAuth 2.0', 'OpenID Connect', 'LDAPS', 'RADIUS', 'TACACS+'],
  prompts: [
    { label: 'A laptop sends a request for a ticket-granting ticket to the domain controller on port 88', answer: 'Kerberos', why: 'Ticket-granting tickets and the key distribution center on port 88 are Kerberos.' },
    { label: 'The browser posts a signed XML document from the identity provider to the payroll site', answer: 'SAML', why: 'A signed XML assertion carried through the browser from the identity provider to the service provider is SAML.' },
    { label: 'An app calls the photo API with "Authorization: Bearer eyJ..." and a token limited to the scope photos.read', answer: 'OAuth 2.0', why: 'A bearer access token limited to scopes is OAuth: it says what the app may do, not who the user is.' },
    { label: 'An app receives a signed JSON token with the fields iss, sub, aud and email after the user taps "Sign in with..."', answer: 'OpenID Connect', why: 'That is an ID token, the JSON web token that OpenID Connect adds on top of OAuth to say who the user is.' },
    { label: 'A Wi-Fi access point sends an Access-Request on UDP port 1812 during 802.1X', answer: 'RADIUS', why: 'Access-Request on UDP 1812 is RADIUS, which access points and VPNs use to check network logins.' },
    { label: 'A router asks the AAA server on TCP port 49 whether the admin may run "configure terminal"', answer: 'TACACS+', why: 'TCP 49 and authorizing a single command are TACACS+, built for administrator logins to network devices.' },
    { label: 'The HR app searches the directory for (department=Finance) over an encrypted connection on port 636', answer: 'LDAPS', why: 'A directory search is LDAP, and port 636 is LDAP wrapped in TLS.' },
  ],
  takeaway: 'Tickets and port 88 mean Kerberos, signed XML means SAML, a scoped bearer token means OAuth, an ID token means OpenID Connect, UDP 1812 means RADIUS, TCP 49 and per-command checks mean TACACS+, and port 636 means LDAPS.',
};

export const SIGN_IN: LessonBody = {
  goals: [
    'Tell authentication, authorization and accounting apart, and explain single sign-on and federation',
    'Follow a Kerberos sign-in from password to service ticket',
    'Follow SAML and OAuth sign-ins step by step, and say what OpenID Connect adds',
    'Compare RADIUS and TACACS+, and know where LDAP and LDAPS fit',
    'Identify the protocol from what you see in a scenario or a capture',
  ],
  blocks: [
    recap('From topic 3: a **digital signature** proves who made something, and is checked with the signer\'s public key. From topic 4: a **certificate** is how you get that public key and trust it. From Networking lesson 9: with **802.1X**, a Wi-Fi access point passes your login to a central server to check.'),
    words(
      ['Authentication', 'Proving who you are, for example with a password and a code from your phone'],
      ['Authorization', 'Deciding what you are allowed to do once you are known'],
      ['Accounting', 'Recording what you did and when, for audits and billing'],
      ['AAA', 'Authentication, authorization and accounting, together'],
      ['Identity provider (IdP)', 'The one service that checks your sign-in and vouches for you to others'],
      ['Service provider (SP)', 'The app or website you actually want to use, which trusts the identity provider'],
      ['Single sign-on (SSO)', 'Signing in once and reaching many services without signing in again'],
      ['Federation', 'Trust between organizations, so one company\'s identity provider can sign its people in to another company\'s services'],
      ['Directory', 'A database of users, groups and devices with their details, such as Active Directory'],
      ['Ticket', 'In Kerberos, a time-limited, encrypted proof that you signed in'],
      ['Assertion', 'In SAML, a signed XML statement from the identity provider saying who you are'],
      ['Token', 'A signed or random string that stands in for your sign-in, so the password does not travel'],
      ['Scope', 'In OAuth, exactly what an app is allowed to do with your data, such as "read photos"'],
      ['Redirect', 'A website sending your browser on to another website, often carrying a message with it'],
    ),

    h('Who are you, and what may you do?', { objective: '1.2', keep: 'Authentication proves who you are, authorization decides what you may do, and accounting records what you did (AAA). Single sign-on lets one sign-in at an identity provider open many services, which never see your password.' }),
    table(
      ['Step', 'The question', 'Example'],
      [
        ['Authentication', 'Who are you?', 'Password plus a code from an authenticator app'],
        ['Authorization', 'What may you do?', 'Members of Finance may open the payroll app; only managers may approve'],
        ['Accounting', 'What did you do?', 'A log: ana signed in at 09:02 from 203.0.113.7 and exported a report'],
      ],
    ),
    p('Years ago every application kept its own list of users and passwords. Staff had dozens of passwords, reused them, and leavers kept access to whatever IT forgot to remove. **Single sign-on (SSO)** fixes this with one **identity provider (IdP)**: you sign in there once, with strong multifactor authentication, and it vouches for you to each **service provider** you visit. The services receive a signed **token** or **ticket**, never your password.'),
    analogy('SSO is a **festival wristband**. You show your ID once at the gate (the identity provider) and get a wristband. Each stage (a service) just checks the wristband; nobody asks for your ID again, and none of them keeps a copy of it.'),
    p('When the identity provider and the service belong to different organizations, the trust between them is called **federation**: your company\'s IdP signs you in to a supplier\'s portal or a cloud app, using a trust set up once between the two.'),
    trap('SSO concentrates risk. If the identity provider is down, nobody can sign in to anything; if an attacker takes over someone\'s SSO account, every connected app opens. That is why the IdP gets the strongest protection: MFA for everyone, close monitoring, and a quick way to disable an account.'),

    h('Directories: LDAP and LDAPS', { objective: '4.6', keep: 'A directory stores users, groups and their details. Apps query it with LDAP on port 389; LDAPS wraps the same queries in TLS on port 636 so passwords and data are encrypted.' }),
    p('Behind most sign-ins sits a **directory**: the company\'s list of users, groups, computers and their details (department, manager, phone). Microsoft\'s **Active Directory** is the best known. Applications look things up with **LDAP** (Lightweight Directory Access Protocol), naming each entry by its place in the tree:'),
    p('`CN=Ana Silva,OU=Finance,DC=corp,DC=example` means: the entry named Ana Silva, in the Finance department\'s folder (organizational unit), in the domain corp.example.'),
    table(
      ['Protocol', 'Port', 'Notes'],
      [
        ['LDAP', 'TCP 389', 'Unencrypted. A simple sign-in ("bind") sends the password in the clear'],
        ['LDAPS', 'TCP 636', 'LDAP inside TLS: the secure choice'],
      ],
    ),

    h('Kerberos: tickets inside the company network', { objective: '4.6', keep: 'Kerberos signs you in once to the key distribution center, which issues a ticket-granting ticket. You trade it for a service ticket for each server. The password never crosses the network, tickets expire, and clocks must agree within about five minutes.' }),
    p('**Kerberos** is how Windows domains (and many others) sign you in to file shares, printers and internal apps. The central server is the **key distribution center (KDC)**, which on Windows runs on every domain controller and listens on port **88**. It hands out **tickets**: encrypted, time-stamped proofs of who you are. Step through a morning sign-in:'),
    {
      type: 'sequence',
      title: 'Kerberos: from password to file share',
      steps: [
        { from: 'Laptop', to: 'KDC', label: 'Authentication request', note: 'You type your password. The laptop does **not** send it. It turns it into a key and uses that key to encrypt the current time, then sends your username and the encrypted time stamp to the KDC\'s **authentication service**.' },
        { from: 'KDC', to: 'Laptop', label: 'Ticket-granting ticket (TGT)', note: 'The KDC knows your password\'s key too, so it can decrypt the time stamp. If it decrypts and the time is close to now, you have proved you know the password. The KDC returns a **ticket-granting ticket**: proof you signed in, encrypted with a key only the KDC knows, valid for about ten hours.' },
        { from: 'Laptop', to: 'KDC', label: 'TGT + "I need the file server"', note: 'Later you open \\\\files\\finance. The laptop shows the KDC\'s **ticket-granting service** your TGT and asks for a ticket for that one server. No password is needed: the TGT is the proof.' },
        { from: 'KDC', to: 'Laptop', label: 'Service ticket', note: 'The KDC issues a **service ticket** for the file server, encrypted with the file server\'s own key, so only that server can read it.' },
        { from: 'Laptop', to: 'File server', label: 'Service ticket', note: 'The laptop hands the service ticket to the file server. The server decrypts it with its own key, sees who you are and which groups you belong to, and decides what you may open. It never contacted the KDC and never saw your password.' },
        { from: 'File server', to: 'Laptop', label: 'Access granted', note: 'The server can also prove itself back to you (**mutual authentication**), so a fake file server is caught. Every other server you open repeats steps 3 to 5, which is why you sign in only once a day.' },
      ],
    },
    list(
      '**Time matters.** Tickets carry time stamps and expire. If a computer\'s clock drifts more than about five minutes from the domain controller\'s, Kerberos fails. That is why domains run NTP time sync.',
      '**Tickets can be stolen.** In a **pass-the-ticket** attack, malware copies a ticket from memory and replays it. A **golden ticket** is a forged TGT made with the KDC\'s own secret key, giving the attacker anything in the domain.',
      '**NTLM** is the older Windows method, still around as a fallback. It sends a hash-based response instead of tickets, and a stolen password hash can be replayed: **pass-the-hash**.',
    ),
    exam('Kerberos clues: **tickets**, **TGT**, **KDC**, **port 88**, **time synchronization**, **domain**, and "without sending the password over the network".'),

    h('SAML: sign in once, reach web apps', { objective: '4.6', keep: 'With SAML, the web app (service provider) sends your browser to the identity provider. You sign in there, and it signs an XML assertion saying who you are. The browser carries it back, and the app trusts the signature without ever seeing your password.' }),
    p('Kerberos works inside one company\'s network. For web applications, often run by other companies, the long-standing answer is **SAML** (Security Assertion Markup Language). The identity provider and the app swap certificates once when they set up the trust; after that, every sign-in goes through the browser:'),
    {
      type: 'sequence',
      title: 'SAML: signing in to a payroll website',
      steps: [
        { from: 'Browser', to: 'Payroll site', label: 'Open payroll.example', note: 'You open the payroll site, which is the **service provider**. It does not have your password and never will. It sees you are not signed in.' },
        { from: 'Payroll site', to: 'Browser', label: 'Redirect to the IdP', note: 'The site **redirects** your browser to your company\'s identity provider, carrying a request that says "please tell me who this is".' },
        { from: 'Browser', to: 'Identity provider', label: 'Sign in (password + MFA)', note: 'You sign in at the company identity provider, the only place your password goes. If you already signed in there today, this step is skipped: that is the single sign-on.' },
        { from: 'Identity provider', to: 'Browser', label: 'Signed SAML assertion', note: 'The IdP builds an **assertion**: an XML document saying who you are (name, email, groups), for which site, and valid for a few minutes. It **signs** it with its private key.' },
        { from: 'Browser', to: 'Payroll site', label: 'Post the assertion', note: 'Your browser carries the assertion to the payroll site. The site checks the signature with the IdP\'s public key from the certificate it was given at setup, checks it is meant for this site and not expired, and signs you in.' },
      ],
    },
    tip('Notice that the payroll site and the identity provider never talk directly. Your browser carries the messages both ways, which is why SAML works even when the two are run by different companies on different networks.'),

    h('OAuth 2.0: letting an app act for you', { objective: '4.6', keep: 'OAuth is about authorization: you let one app use your data at another service, limited to certain scopes, without giving it your password. The app gets an access token that says what it may do, not who you are.' }),
    p('**OAuth 2.0** answers a different question. Not "who are you?" but "may this app do something with my stuff?". A photo printing site wants to read your cloud photo album. You should not give it your cloud password, which would let it do anything, forever. Instead you grant it a limited **access token**:'),
    {
      type: 'sequence',
      title: 'OAuth: letting a printing site read your photos',
      steps: [
        { from: 'Browser', to: 'Printing site', label: '"Import from my cloud photos"', note: 'The printing site is the OAuth **client**: the app that wants access.' },
        { from: 'Printing site', to: 'Browser', label: 'Redirect, asking for scope photos.read', note: 'It redirects you to the cloud provider\'s **authorization server**, saying which **scopes** it wants: here only "read photos", not "delete" or "read email".' },
        { from: 'Browser', to: 'Authorization server', label: 'Sign in + consent', note: 'You sign in at the cloud provider (the printing site never sees this) and get a **consent** screen: "Printing site wants to view your photos. Allow?" You click Allow.' },
        { from: 'Authorization server', to: 'Printing site', label: 'Authorization code (via the browser)', note: 'Your browser is redirected back to the printing site with a short-lived, one-time **authorization code**.' },
        { from: 'Printing site', to: 'Authorization server', label: 'Code + client secret', note: 'The printing site\'s server swaps the code, plus its own secret, for an **access token** (and often a refresh token for later). This happens server to server, so the token never sits in your browser.' },
        { from: 'Printing site', to: 'Photo API', label: 'Access token', note: 'The site calls the photo service with the token. The photo service, the **resource server**, checks the token and its scope and returns your photos, nothing more. You can withdraw the access at any time without changing your password.' },
      ],
    },
    trap('An OAuth access token is like a **valet key**: it lets the holder do certain things, but it does not reliably say who the user is. Using a plain OAuth token as proof of identity is a classic mistake, and is what OpenID Connect was created to fix.'),

    h('OpenID Connect: OAuth plus who you are', { objective: '4.6', keep: 'OpenID Connect adds sign-in to OAuth. Alongside the access token, the app gets an ID token: a signed JSON web token saying who the user is. "Sign in with..." buttons are OpenID Connect.' }),
    p('**OpenID Connect (OIDC)** runs the same flow as OAuth with one addition: the app also receives an **ID token**, a small signed JSON document (a JSON web token, or JWT) that says who signed in. It is the protocol behind "Sign in with Google", "Sign in with Microsoft" and most modern single sign-on for web and mobile apps.'),
    p('An ID token\'s contents look like this: `iss` (who issued it, the identity provider), `sub` (a unique ID for the user), `aud` (which app it is for), `exp` (when it expires) and claims such as `email` and `name`. The app checks the signature, the audience and the expiry before trusting it.'),
    table(
      ['', 'SAML', 'OAuth 2.0', 'OpenID Connect'],
      [
        ['Answers', 'Who is this?', 'What may this app do?', 'Who is this?'],
        ['Format', 'XML assertion', 'Access token', 'JSON ID token (JWT), plus an access token'],
        ['Typical use', 'Enterprise single sign-on to web apps', 'Apps using an API on your behalf', 'Modern web and mobile sign-in, "Sign in with..."'],
        ['Kind of job', 'Authentication', 'Authorization', 'Authentication on top of OAuth'],
      ],
    ),

    h('Network and device logins: RADIUS and TACACS+', { objective: '4.1', keep: 'RADIUS checks logins for network access (VPN, Wi-Fi with 802.1X) over UDP and encrypts only the password. TACACS+ handles administrator logins to network devices over TCP 49, encrypts everything and can authorize each command.' }),
    p('Two more AAA protocols sit between network equipment and the central user database. The device asking the question (an access point, a VPN gateway, a router) is the client; the AAA server answers.'),
    table(
      ['', 'RADIUS', 'TACACS+'],
      [
        ['Built for', 'Network access: VPN, Wi-Fi 802.1X, dial-in', 'Administrators logging in to routers, switches and firewalls'],
        ['Transport and port', 'UDP 1812 (authentication), 1813 (accounting)', 'TCP 49'],
        ['What is encrypted', 'Only the password', 'The whole message'],
        ['AAA', 'Authentication and authorization combined', 'All three separate, with authorization of each command'],
        ['Origin', 'Open standard', 'Cisco, now an open specification'],
      ],
    ),
    exam('**Per-command authorization**, **device administration** or "the whole session encrypted" means **TACACS+**. **802.1X**, **Wi-Fi**, **VPN** or **network access** means **RADIUS**.'),

    h('Practice: which protocol is it?', { objective: '4.6', keep: 'Read the clues: tickets and port 88 are Kerberos, signed XML is SAML, a scoped bearer token is OAuth, an ID token is OpenID Connect, UDP 1812 is RADIUS, TCP 49 is TACACS+, port 636 is LDAPS.' }),
    pbq('Which protocol is it?', SPOT_THE_PROTOCOL, { intro: 'Each line is a clue from a capture or a log. Seven lines, seven protocols, each used once.' }),
    examPbqs('sign-in', 'This one comes from the practice exam: the same protocols, but described as project requirements instead of clues. It loads when you press Start.'),
  ],
  check: [
    mcq('A mobile app needs to sign users in with their existing corporate account and learn their name and email. Which protocol is designed for this?',
      'OpenID Connect', ['OAuth 2.0', 'RADIUS', 'Kerberos'],
      'OIDC adds an ID token describing the user on top of OAuth. OAuth alone grants access to data without reliably saying who the user is; RADIUS is for network access and Kerberos for tickets inside a domain.'),
    mcq('Users can no longer reach file shares on one server, and its logs show Kerberos ticket errors. Everything else in the domain works. What is the most likely cause?',
      'The server\'s clock is several minutes off from the domain controller', ['TCP port 636 is blocked', 'The SAML signing certificate has expired', 'The OAuth scope for the share was removed'],
      'Kerberos tickets carry time stamps, and a clock skew of more than about five minutes makes them fail. Port 636 is LDAPS, and SAML and OAuth are not used for Windows file shares.'),
    mcq('Network engineers\' logins to routers must be authorized command by command, with the whole session encrypted and logged. What should be used?',
      'TACACS+', ['RADIUS', 'LDAPS', 'SAML'],
      'TACACS+ separates the three As, can authorize every command, and encrypts the whole payload over TCP 49. RADIUS encrypts only the password and is built for network access.'),
    mcq('What is the main security trade-off of single sign-on?',
      'One strong, MFA-protected sign-in replaces many passwords, but the identity provider becomes a high-value target',
      ['Every service receives and checks the user\'s password itself', 'Each service must run its own multifactor prompt', 'Authorization is no longer needed once a user is authenticated'],
      'SSO means fewer passwords and one place to enforce MFA and disable leavers. The flip side is that compromising, or losing, the identity provider affects every connected service.'),
  ],
};
