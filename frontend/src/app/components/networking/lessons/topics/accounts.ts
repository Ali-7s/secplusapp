import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, exam, examPbqs, h, list, mcq, p, passwordPolicy, pbq, permsLab, recap, table, tip, trap, words } from '../dsl';

const FACTORS: MatchQuestion = {
  id: 'topic-accounts-factors', domain: 4, objective: '4.6', kind: 'match',
  scenario: 'A company lists everything its sign-in systems can ask for.',
  stem: 'Choose the authentication factor each one belongs to. Each answer can be used more than once.',
  choices: ['Something you know', 'Something you have', 'Something you are', 'Somewhere you are'],
  prompts: [
    { label: 'A six-digit code from an authenticator app on the user\'s phone', answer: 'Something you have',
      why: 'The code proves you hold the phone the app was set up on, so it is a possession factor, even though you type it.' },
    { label: 'A fingerprint scan on the laptop', answer: 'Something you are',
      why: 'A fingerprint is a physical trait, a biometric, so it is an inherence factor.' },
    { label: 'The PIN that unlocks a smart card', answer: 'Something you know',
      why: 'A PIN is memorized, so it is a knowledge factor. The card itself would be something you have.' },
    { label: 'Sign-in allowed only from the office network\'s IP addresses', answer: 'Somewhere you are',
      why: 'Checking the location of the request is a location factor.' },
    { label: 'A hardware security key the user plugs in and taps', answer: 'Something you have',
      why: 'A security key is a physical token you possess, and phishing-resistant because it checks the website it is talking to.' },
    { label: 'The answer to "What was your first pet\'s name?"', answer: 'Something you know',
      why: 'Any answer you remember is knowledge, which is why a password plus a security question is still single-factor.' },
  ],
  takeaway: 'Multifactor means factors of different kinds: know, have, are, or where you are. Two things you know are still one factor, and a code from a device counts as something you have.',
};

const NTFS: MatchQuestion = {
  id: 'topic-accounts-ntfs', domain: 4, objective: '4.6', kind: 'match',
  scenario: 'A Windows file server shares the Finance folder as \\\\FS01\\Finance. Users\' group memberships are given in each item.',
  blocks: [
    { kind: 'table', title: 'Share permissions on \\\\FS01\\Finance', columns: ['Group', 'Permission'], rows: [['Everyone', 'Allow Read']] },
    { kind: 'table', title: 'NTFS permissions on the Finance folder', columns: ['Group', 'Permission'], rows: [['Users', 'Allow Read'], ['Finance', 'Allow Modify'], ['Managers', 'Allow Full control'], ['Interns', 'Deny Write']] },
  ],
  stem: 'Choose each user\'s effective access.',
  choices: ['Full control', 'Read and change', 'Read only', 'No access'],
  prompts: [
    { label: 'Fatima (Finance) opens a spreadsheet through the share from her PC and tries to save it', answer: 'Read only',
      why: 'Over the network both sets apply and the more restrictive wins: NTFS gives Modify, but the share gives only Read.' },
    { label: 'Fatima signs in at the server itself and edits the same file', answer: 'Read and change',
      why: 'Signed in locally, share permissions do not apply at all, so her NTFS Modify from Finance decides.' },
    { label: 'Marco (Finance and Managers) signs in at the server', answer: 'Full control',
      why: 'NTFS permissions from different groups add up, so Modify plus Full control gives Full control.' },
    { label: 'Ines (Finance and Interns) signs in at the server and tries to save a change', answer: 'Read only',
      why: 'Finance allows Modify, but Interns has an explicit Deny on Write, and a deny overrides any allow. She can still read.' },
    { label: 'How should the administrator let Finance edit over the network while keeping control?', choices: ['Set the share to Change or Full control for authenticated users, and control access with NTFS', 'Give Everyone Full control in NTFS', 'Remove the share and email the files', 'Add Finance to the Administrators group'],
      answer: 'Set the share to Change or Full control for authenticated users, and control access with NTFS',
      why: 'The common practice is a permissive share and precise NTFS permissions, so access is decided in one place, NTFS, which also applies locally.' },
  ],
  takeaway: 'NTFS permissions from groups add up, an explicit deny wins, and over the network the more restrictive of the share and NTFS permissions applies. Locally, only NTFS counts.',
};

export const ACCOUNTS: LessonBody = {
  goals: [
    'Tell user, administrator, service, shared and guest accounts apart, and manage them through a directory',
    'Build a password and lockout policy that stops real attacks without frustrating users',
    'Classify authentication factors, and say why some MFA methods are stronger than others',
    'Set Linux permissions as rwx and as three digits, for files and folders',
    'Work out effective NTFS and share permissions on Windows',
  ],
  blocks: [
    recap('From topic 7: **least privilege**, **groups** whose permissions add up, and an **explicit deny** that beats any allow. From topic 4: **LDAP** reads a directory, **Kerberos** signs users in to Windows domains, and **SSO** lets one sign-in cover many systems. From topic 2: passwords are stored as salted **hashes**.'),
    words(
      ['Service account', 'An account used by software rather than a person, such as a backup service'],
      ['Shared account', 'One account used by several people. Nobody can tell who did what'],
      ['Directory service', 'The central list of users, groups and computers, such as Active Directory'],
      ['OU', 'Organizational unit: a folder in the directory that groups users or computers'],
      ['GPO', 'Group Policy object: settings the directory pushes to every computer or user in an OU'],
      ['Password spraying', 'One common password tried against many accounts'],
      ['Credential stuffing', 'Trying usernames and passwords leaked from other websites'],
      ['Account lockout', 'Blocking sign-in after too many failed attempts'],
      ['MFA', 'Multifactor authentication: proof of two or more different kinds'],
      ['TOTP', 'Time-based one-time password: the six-digit code in an authenticator app'],
      ['Passwordless', 'Signing in with a device and a biometric or PIN instead of a password'],
      ['Permission', 'What an account may do with a file or folder: read, write, run'],
      ['NTFS', 'The Windows file system, which stores permissions on each file and folder'],
    ),

    h('Accounts and the directory', { objective: '4.6', keep: 'Give every person their own account, keep admin rights on separate accounts, lock down service accounts, and avoid shared and guest accounts. A directory such as Active Directory holds them all, and Group Policy pushes settings like the password policy to every computer.' }),
    table(
      ['Account type', 'Used for', 'Keep it safe by'],
      [
        ['User', 'One person\'s everyday work', 'Least privilege, MFA, removed the day they leave'],
        ['Administrator (privileged)', 'Changing systems', 'A separate account from the everyday one, just-in-time access, vaulted passwords'],
        ['Service', 'Software that runs without a person, such as a backup job', 'Only the rights the service needs, no interactive sign-in, long random passwords managed automatically'],
        ['Shared or generic', 'Several people on one login', 'Avoiding it: nobody can tell who did what, so there is no accountability'],
        ['Guest', 'Temporary visitors', 'Disabling it, or limiting it to a separate, restricted network'],
      ],
      { caption: 'Kinds of account' },
    ),
    p('Companies keep accounts in a **directory service**, most often Microsoft **Active Directory**, read and written with **LDAP**. The directory holds users, groups and computers, sorted into **organizational units (OUs)**. **Group Policy** pushes settings to every computer or user in an OU: the password policy, the screen lock, which software may run, and much more, so one change reaches thousands of machines.'),
    tip('The account lifecycle matters as much as the settings. **Provisioning** gives a joiner the right groups on day one, a move between jobs removes the old access as well as adding the new, and **deprovisioning** disables the account the moment someone leaves. Regular access reviews catch what slipped through.'),

    h('Passwords that hold up', { objective: '4.6', keep: 'Modern guidance: long passwords (15+), no composition rules, no scheduled expiry (change when compromise is suspected), reject breached passwords, remember past passwords, lock out after about 10 failures with automatic unlock, and add MFA.' }),
    p('Password advice changed a lot in recent years. NIST, the US standards body, now says length matters far more than complexity, that forced changes every 90 days make passwords weaker, and that every new password should be checked against lists of passwords already leaked. A **password manager** makes long, unique passwords practical, and **passwordless** sign-in removes them altogether.'),
    table(
      ['Setting', 'Old habit', 'Better'],
      [
        ['Length', '8 characters', '15 or more, and allow long passphrases'],
        ['Composition', 'Upper, lower, digit and symbol required', 'No rules; check against breach lists instead'],
        ['Expiration (age)', 'Every 30 or 90 days', 'Only when compromise is suspected'],
        ['Reuse', 'Last 5 remembered', 'Remember many (say 24), so old passwords cannot come back'],
        ['Lockout', '3 failures, until the help desk unlocks', 'About 10 failures, unlock automatically after a while'],
        ['Reset', 'Security questions', 'A factor registered earlier, such as an authenticator app'],
      ],
      { caption: 'Password policy, then and now' },
    ),
    passwordPolicy(),
    trap('Lockout stops **brute force** against one account but not **password spraying**, which tries each account only once or twice. Spraying is stopped by rejecting common and breached passwords, and above all by MFA.'),

    h('Multifactor authentication', { objective: '4.6', keep: 'Factors: something you know (password, PIN), have (phone, token, smart card), are (fingerprint, face) and somewhere you are (location). MFA needs two different kinds. Security keys and authenticator apps beat SMS codes; two passwords are still one factor.' }),
    table(
      ['Factor', 'Examples'],
      [
        ['Something you know', 'Password, PIN, answer to a security question'],
        ['Something you have', 'Phone with an authenticator app, hardware token, security key, smart card'],
        ['Something you are', 'Fingerprint, face, iris, voice (biometrics)'],
        ['Somewhere you are', 'Office network, country, GPS location'],
      ],
      { caption: 'Authentication factors' },
    ),
    list(
      '**Security keys** (FIDO2) are the strongest common method: phishing-resistant, because the key checks which website is asking.',
      '**Authenticator apps** give a **TOTP** code that changes every 30 seconds, or a **push** notification to approve. Watch for **MFA fatigue**: attackers sending push after push until a tired user taps Approve. Number matching stops it.',
      '**SMS codes** are better than nothing but the weakest: messages can be intercepted, and phone numbers stolen by SIM swapping.',
      '**Biometrics** are convenient but cannot be changed if copied, so they are best as an unlock for a device, not as the only proof.',
    ),
    pbq('Name the factor', FACTORS, { intro: 'Six things the sign-in systems can ask for.' }),

    h('File permissions on Linux', { objective: '4.6', keep: 'Linux gives read (4), write (2) and execute (1) to the owner, the group and everyone else. Add them per class for one digit each: 750 is rwxr-x---. On a folder, r lists, w adds or deletes, x lets you enter. Never 777.' }),
    p('Every Linux file has an **owner**, a **group**, and permissions for three classes: the owner, members of the group, and **others** (everyone else). Each class gets **r** (read, worth 4), **w** (write, 2) and **x** (execute, 1). Add them up for one digit per class, and `chmod` sets them: `chmod 640 db.conf` gives rw- to the owner, r-- to the group and nothing to others. `ls -l` shows the same thing as letters: `-rw-r-----`.'),
    permsLab(),
    exam('Know the common ones: **600** (private files such as SSH keys), **644** (readable by everyone, writable by the owner), **640** (config files with secrets), **755** (programs and shared folders), **750** (shared with the group only). **777** lets anyone change anything and is almost always wrong.'),

    h('File permissions on Windows: NTFS and shares', { objective: '4.6', keep: 'NTFS permissions from all your groups add up, and an explicit deny wins. Over the network, share and NTFS permissions both apply and the more restrictive wins; signed in locally, only NTFS counts. Folders pass permissions down by inheritance.' }),
    p('Windows stores **NTFS permissions** on each file and folder: Full control, Modify, Read & execute, Read, and Write. They pass down from a folder to everything inside it (**inheritance**), unless inheritance is turned off. A folder can also be **shared** over the network, and the share has its own, simpler permissions: Read, Change and Full control.'),
    list(
      'Permissions from all the groups you are in **add up**.',
      'An explicit **Deny** overrides any Allow.',
      'Through the network, **both** the share and the NTFS permissions apply, and the **more restrictive** of the two wins.',
      'Signed in at the computer itself, only NTFS applies.',
    ),
    analogy('The share permission is the door to the building, and NTFS is the lock on each office. Coming from outside you pass through both, and the tighter one limits you. Staff already inside only meet the office locks.'),
    pbq('Work out the effective access', NTFS, { intro: 'Read both permission tables, then work out what each person can do.' }),
    examPbqs('accounts', 'This one comes from the practice exam: bring an old password and lockout policy up to a modern standard. It loads when you press Start.'),
  ],
  check: [
    mcq('Which password policy change does most to stop password spraying?',
      'Rejecting passwords found in breach lists, together with MFA', ['Locking accounts after three failures', 'Forcing a password change every 30 days', 'Requiring a symbol and a digit'],
      'Spraying tries each account only once or twice, so lockout rarely triggers. Blocking common, breached passwords and requiring MFA stop it.'),
    mcq('A user signs in with a password and then answers a security question. How many authentication factors is that?',
      'One, because both are something you know', ['Two, because there are two prompts', 'Two, because the question is a second factor', 'Three, counting the username'],
      'Both a password and a security answer are knowledge. Multifactor needs factors of different kinds, such as a password and a phone.'),
    mcq('Which permissions should a private SSH key file have on Linux?',
      '600', ['644', '755', '777'],
      '600 is read and write for the owner and nothing for anyone else. SSH refuses keys that others can read.'),
    mcq('A share allows Everyone Read. NTFS gives the Finance group Modify. What can a Finance member do when opening the files over the network?',
      'Read only, because the more restrictive of the share and NTFS permissions applies', ['Modify, because NTFS overrides share permissions', 'Full control, because the permissions add up', 'Nothing, because the two conflict'],
      'Over the network both apply and the tighter one wins, so the share\'s Read limits them. At the server itself they would have Modify.'),
  ],
};
