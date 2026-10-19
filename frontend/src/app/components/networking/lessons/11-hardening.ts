import { LessonBody } from '../networking.model';
import { analogy, exam, examPbqs, h, list, mcq, p, pbq, recap, table, words } from './dsl';
import { HARDEN_ORDER } from './practice';

export const HARDENING: LessonBody = {
  goals: [
    'Define hardening and attack surface in your own words',
    'Apply a checklist that works for any device',
    'Know the main hardening steps for each kind of device',
    'Recognize weaknesses in a device configuration, the way a performance-based question asks',
    'Explain how baselines and drift checks keep devices hardened over time',
  ],
  blocks: [
    recap('Every open port is a door an attacker can try, and all those doors together are the **attack surface** (lesson 3). Plaintext protocols such as Telnet have secure replacements such as SSH (lesson 5). The switch and router checklists in lesson 6 were hardening for those two devices; this lesson turns that into a method for any device.'),
    words(
      ['Hardening', 'Making a device harder to attack: removing what is not needed and locking down what is'],
      ['Default credentials', 'The username and password a device ships with, which are published online'],
      ['Configuration', 'A device\'s settings, usually stored as a text file of commands (often called the "config")'],
      ['Baseline', 'The approved, hardened set of settings that every device of one kind should match'],
      ['Configuration drift', 'A device slowly moving away from its baseline as people change things'],
      ['Patch', 'An update that fixes a flaw in software or firmware'],
      ['Least privilege', 'Giving each person or program only the access it needs, and no more'],
      ['SIEM', 'Security information and event management: a system that collects logs from everywhere and raises alerts'],
      ['Change management', 'A process where every change is requested, approved, tested and recorded before it happens'],
      ['Decommissioning', 'Retiring a device safely: wiping it, removing it from records, and disposing of it properly'],
    ),

    h('What hardening means'),
    p('**Hardening** means making a device harder to attack by reducing its **attack surface**: turning off everything it does not need, and locking down everything it does.'),
    p('Why is it needed at all? Because devices come out of the box built to be **easy to set up**, not to be secure. They ship with **default credentials** (a username and password printed in the manual and published online), extra features switched on, unnecessary ports open, and old plaintext protocols enabled. Hardening fixes all of that, and then keeps it fixed.'),
    analogy('Moving into a new house. You change the locks, because the builder and previous owners have keys (default passwords). You brick up the doors you never use (unused services and ports). You fit an alarm (logging), and you check the windows from time to time (patching and audits).'),
    exam('Related terms to know: **attack surface**, **secure baseline** (the approved hardened settings), **least functionality** (a device runs only what it needs), **configuration drift** (a device slowly moving away from its baseline), and published hardening guides such as the **CIS Benchmarks** (free, detailed hardening guides from the Center for Internet Security) and vendors\' own guides.'),

    h('A checklist that works for any device'),
    p('Whether it is a switch, router, firewall, access point, server or a smart camera, the same steps apply. Tap each item as you go; each one says what to do and why.'),
    {
      type: 'harden',
      title: 'The universal hardening checklist',
      intro: 'It applies to a switch, a router, a firewall, an access point, a server or an IoT camera. Tap each item as you work through it.',
      items: [
        { action: 'Change default credentials, remove unused accounts, and give each person their own strong login', why: 'Default usernames and passwords are published online and attackers scan for them constantly. Personal accounts (with **MFA**, a second proof such as a phone code, for administrators) show who did what and can be removed one at a time.' },
        { action: 'Remove or switch off whatever you do not use', why: 'Every running service, protocol and open port is attack surface. Turn off Telnet, plain FTP and HTTP, old SNMP, SMBv1, and any feature you do not need (lesson 5).' },
        { action: 'Manage it only over encrypted connections, from a restricted place', why: 'Use SSH, HTTPS and SNMPv3, and allow admin logins only from an admin network, a jump server (lesson 9) or a short allow list.' },
        { action: 'Install updates (patches) on a schedule', why: 'Most successful attacks use known flaws that already have fixes. Test updates first, roll them out through change management, and have a faster route for urgent fixes.' },
        { action: 'Apply least privilege', why: 'Give each person only the access their job needs: for example, read-only accounts for people who only need to look, and admin accounts only for those who must make changes. Never share accounts.' },
        { action: 'Log, send the logs somewhere else, and keep the clock in sync', why: 'Logs kept only on a hacked device can be erased by the attacker. Send them to a central log server or **SIEM**, and use NTP (lesson 8) so timestamps from different devices line up.' },
        { action: 'Protect the device with network controls too', why: 'Firewall rules and ACLs, segmentation (lesson 7), port security and 802.1X (lesson 6), all blocking by default. A hardened device sitting in a wide open network is still exposed.' },
        { action: 'Secure it physically', why: 'Lock the room or cabinet, protect the console port (the socket for direct admin access), switch off unused ports and use tamper-evident seals. Physical access gets around many software protections.' },
        { action: 'Back up and track the configuration', why: 'Keep encrypted backups of the settings, store them with a history of changes, and compare each device with its approved baseline to catch drift and unauthorized changes.' },
        { action: 'Add login protections', why: 'A warning banner, automatic logout of idle sessions, and limits on failed login attempts make password guessing and unattended sessions harder.' },
        { action: 'Control changes and keep an inventory', why: 'You cannot protect a device you do not know exists. Keep a list of every device, and make changes through change management so nobody weakens a setting by accident.' },
        { action: 'Retire devices safely', why: 'Wipe settings and keys, remove the device from monitoring, DNS and certificate lists, and securely erase or destroy its storage. This is called **decommissioning**.' },
      ],
    },

    h('Quick reference by device'),
    p('The checklist applies everywhere. On top of it, each kind of device has its own extra steps, all explained in the earlier lessons:'),
    table(
      ['Device', 'The most important hardening steps'],
      [
        ['**Switch**', 'Switch off unused ports, port security, 802.1X, DHCP snooping and Dynamic ARP Inspection, BPDU Guard, no automatic trunks, change the native VLAN, SSH only (lessons 6 and 7)'],
        ['**Router**', 'Change defaults, turn off unneeded services, disable source routing and directed broadcasts, filter fake addresses in both directions, restrict admin logins, require proof on routing updates, SSH only (lesson 6)'],
        ['**Firewall**', 'Block by default in both directions, remove "allow anything" rules, review rules regularly, MFA and restricted admin access, updates, logging (lesson 9)'],
        ['**Wireless access point**', 'WPA3 or WPA2 with AES, Enterprise mode, WPS off, a separate guest network, admin defaults changed, wireless intrusion prevention, updates (lesson 9)'],
        ['**DNS server**', 'Do not answer lookups for strangers on the internet, allow zone transfers only to your own servers, DNSSEC, limit answer rates, patch, log lookups (lesson 8)'],
        ['**DHCP server**', 'Approve only your real DHCP servers, DHCP snooping on switches, fixed addresses for important devices, alerts when an unknown DHCP server appears (lesson 8)'],
        ['**Servers and computers**', 'Patch, remove unneeded software, a host-based firewall, endpoint protection (**EDR**, software that watches the device for attacks), full disk encryption, least privilege, and **application allow listing** (only approved programs may run)'],
        ['**IoT and embedded devices**', 'Change defaults, update firmware, put them in their own VLAN with limited access, turn off features such as UPnP, and monitor them'],
      ],
    ),

    h('Exercise: spot the weaknesses'),
    p('Security+ includes **performance-based questions**: small hands-on tasks instead of multiple choice. A common one shows you a device\'s **configuration** (its settings, written as a list of commands) and asks you to find the problems. Below is part of a router\'s configuration in the style used by Cisco, the most common brand. You do not need to know the command language: each line is close to plain English, and the explanations appear when you check your answers.'),
    {
      type: 'spot',
      title: 'Spot the weaknesses in this router configuration',
      intro: 'Tap every line you think is a **security weakness**, then check. Some lines are fine on purpose, and picking them counts as a false alarm. Hint: look for default or plaintext passwords, plaintext protocols, unneeded services, and things left switched on.',
      lines: [
        { text: 'hostname EDGE-RTR1', fine: 'Gives the router a meaningful name, which helps the inventory and the logs. Not a weakness.' },
        {
          text: 'enable password cisco',
          issue: { why: 'The admin password is "cisco", the most famous default there is, and the `password` keyword stores it in plaintext in the configuration.', fix: 'Use `enable secret` with a strong password, so it is stored scrambled (as a hash), or better, use a central login server.' },
        },
        {
          text: 'username admin password admin',
          issue: { why: 'An account called "admin" with the password "admin", stored in plaintext.', fix: 'Create personal accounts with strong passwords stored as hashes (`username ... secret ...`), or use a central login server with MFA.' },
        },
        { text: 'ip ssh version 2', fine: 'Forces version 2 of SSH, the secure one. Good practice.' },
        {
          text: 'ip http server',
          issue: { why: 'Turns on the router\'s web admin page over plain HTTP, so passwords and settings cross the network in plaintext.', fix: 'Turn it off (`no ip http server`), and use HTTPS only if web admin is truly needed.' },
        },
        {
          text: 'snmp-server community public RO',
          issue: { why: 'Old-style SNMP with the community string (shared password) "public", the well-known default. Anyone who can reach the router can read its details.', fix: 'Use SNMPv3, which has real logins and encryption, and limit which machines may ask.' },
        },
        { text: 'ntp server 10.0.9.2', fine: 'Keeps the clock in sync with a time server, so the logs are trustworthy. Good practice.' },
        { text: 'logging host 10.0.9.5', fine: 'Sends logs to a central server, so an attacker cannot simply erase the evidence on the router. Good practice.' },
        {
          text: 'ip source-route',
          issue: { why: 'Lets senders choose the path their packets take through the network, which attackers can use to get around controls.', fix: 'Turn it off (`no ip source-route`).' },
        },
        { text: 'interface GigabitEthernet0/0', fine: 'The heading for the settings of one connection (the internet link). Not a weakness by itself.' },
        { text: ' description WAN link to ISP', fine: 'A clear label for the connection helps documentation. Good practice.' },
        { text: ' ip access-group BLOCK-SPOOFED in', fine: 'Applies an allow and block list (ACL) to incoming traffic that drops fake private source addresses (lesson 2). Good practice.' },
        {
          text: ' ip directed-broadcast',
          issue: { why: 'Lets someone on the internet send a broadcast to the whole network behind the router, which powers Smurf-style flooding attacks (lesson 8).', fix: 'Turn it off (`no ip directed-broadcast`).' },
        },
        { text: 'interface GigabitEthernet0/3', fine: 'The heading for another connection. Not a weakness by itself.' },
        {
          text: ' no shutdown',
          issue: { why: 'This unused port is switched **on**, with no description. Anyone can plug something into it.', fix: 'Switch unused ports off (`shutdown`) and label them as unused.' },
        },
        { text: 'line vty 0 4', fine: 'The heading for the remote login settings. Not a weakness by itself.' },
        { text: ' access-class 10 in', fine: 'Only addresses allowed by list 10 (the admin network) can reach the remote login. Good practice.' },
        {
          text: ' transport input telnet',
          issue: { why: 'Allows remote logins over Telnet, which sends the password and every command in plaintext.', fix: 'Allow SSH only (`transport input ssh`).' },
        },
        {
          text: ' exec-timeout 0 0',
          issue: { why: 'Idle admin sessions never log out, so a terminal left unattended stays logged in forever.', fix: 'Set a short timeout, for example `exec-timeout 5 0` (five minutes).' },
        },
      ],
    },

    h('Keeping devices hardened over time'),
    p('Hardening is not done once and forgotten. Devices drift: someone opens a port "just for now", an update is missed, a factory reset brings the defaults back. These habits keep devices hardened:'),
    list(
      '**Baselines.** Write down the approved hardened settings for each kind of device (start from the CIS Benchmarks or the vendor\'s guide) and build every new device from them.',
      '**Compliance scans.** Regularly compare every device with its baseline to catch **drift**, whether it comes from mistakes or from attackers.',
      '**Patch cycles.** A regular schedule for routine updates, plus a fast route for urgent fixes when a serious flaw is announced.',
      '**Change management.** Every change is requested, approved, tested and recorded, with a plan to undo it if it goes wrong.',
      '**Testing.** **Vulnerability scans** look for known weaknesses, **penetration tests** have experts try to break in for real, and **audits** check that the process is actually being followed.',
      '**Monitoring.** Logs and alerts (often in a SIEM) show attack attempts and unexpected changes, so hardening does not quietly decay.',
    ),
    pbq('Try it: bring a new router into service', HARDEN_ORDER),
    exam('"Which is the BEST first step when deploying a new device?" Usually: **change the default credentials and switch off unnecessary services**, then patch it, then apply the baseline. Also expect "which control detects a device that has moved away from its approved configuration?" (a compliance or configuration scan).'),
    examPbqs('hardening'),
  ],
  check: [
    mcq(
      'Which is the BEST first step when deploying a new router?',
      'Change the default credentials and disable unneeded services',
      ['Connect it to the internet and test before changing anything', 'Enable every available feature so it is ready for later', 'Wait for the first security incident and then adjust the settings'],
      'Default credentials and unnecessary services are the easiest things for an attacker to abuse, so they come first, followed by patching and applying the baseline.',
    ),
    mcq(
      'A switch port in an empty meeting room is not in use. Which hardening action fits best?',
      'Switch the port off and place it in an unused VLAN',
      ['Leave it enabled in case it is needed later', 'Turn on SNMP version 1 for that port', 'Give the port a default gateway'],
      'An unused but live port is an open door for rogue devices. Switching it off removes the risk.',
    ),
    mcq(
      'What is a secure baseline used for?',
      'Defining the approved hardened settings and detecting devices that drift from them',
      ['Speeding up the network by removing encryption', 'Replacing the need for patching', 'Recording how many users log in each day'],
      'A baseline is the standard to build from and compare against. Compliance scans find devices that have drifted away from it.',
    ),
    mcq(
      'Moving SSH from port 22 to port 2222 mainly achieves what?',
      'It reduces automated scanning noise but is not real security',
      ['It makes the service immune to attacks', 'It encrypts the connection more strongly', 'It removes the need for a firewall'],
      'Changing a port is security through obscurity. A port scan finds the new port quickly, so real controls such as strong logins, patching and firewall rules are still needed.',
    ),
  ],
};
