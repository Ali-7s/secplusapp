import { LessonBody } from '../networking.model';
import { analogy, exam, h, list, mcq, p, table } from './dsl';

export const HARDENING: LessonBody = {
  goals: [
    'Define hardening and attack surface in your own words',
    'Apply a checklist that works for any device',
    'Know the main hardening steps for each kind of device',
    'Recognize weaknesses in a device configuration, the way a performance-based question asks',
    'Explain how baselines and drift checks keep devices hardened over time',
  ],
  blocks: [
    h('What hardening means'),
    p('**Hardening** means reducing a device\'s **attack surface** by turning off what you do not need and locking down what you do. Out of the box, devices are built to be easy to set up, not to be secure: default passwords, extra services, open ports, weak protocols. Hardening fixes that, and keeps it fixed.'),
    analogy('Moving into a new house. You change the locks (default passwords), brick up the doors you never use (unused services and ports), fit an alarm (logging), and check the windows from time to time (patching and audits).'),
    exam('Related terms to know: **attack surface**, **secure baseline** (the approved hardened configuration), **least functionality** (only what is needed), **configuration drift** (a device slowly moving away from its baseline), and published guides such as the **CIS Benchmarks** and vendor hardening guides.'),

    h('A checklist that works for any device'),
    {
      type: 'harden',
      title: 'The universal hardening checklist',
      intro: 'It applies to a switch, a router, a firewall, an access point, a server or an IoT camera. Tap each item as you work through it.',
      items: [
        { action: 'Change default credentials, remove unused accounts, and use strong individual logins', why: 'Default usernames and passwords are published online and scanned for constantly. Individual accounts (with MFA for administrators) leave an audit trail and can be removed one at a time.' },
        { action: 'Remove or disable what you do not use', why: 'Every service, protocol and open port is attack surface. Turn off Telnet, plain FTP and HTTP, SNMP v1 and v2c, SMBv1, and any feature you do not need.' },
        { action: 'Manage it over encrypted channels, from a restricted place', why: 'Use SSH, HTTPS and SNMPv3, and allow management only from a management network, a jump server or an ACL.' },
        { action: 'Patch and update on a schedule', why: 'Most successful attacks use known flaws that already have fixes. Test updates first, deploy them through change management, and have a faster path for emergency fixes.' },
        { action: 'Apply least privilege', why: 'Separate read-only and administrator roles, use role-based access, and never share accounts.' },
        { action: 'Log, send the logs elsewhere, and keep time in sync', why: 'Logs that live only on a compromised device can be erased. Send them to a central server or SIEM, and use NTP so timestamps line up.' },
        { action: 'Use network controls around the device', why: 'ACLs and firewall rules, segmentation, port security and 802.1X, with default deny. A hardened device inside a flat network is still exposed.' },
        { action: 'Secure it physically', why: 'Lock the room or cabinet, protect the console port, disable unused ports and use tamper seals. Physical access can bypass many software controls.' },
        { action: 'Protect and track the configuration', why: 'Keep encrypted backups, store configurations in version control, and compare each device with its approved baseline to catch drift and unauthorized changes.' },
        { action: 'Add session protections', why: 'A login banner, idle timeouts and limits on failed logins make guessing and unattended sessions harder.' },
        { action: 'Control changes and keep an inventory', why: 'You cannot harden what you do not know about. Track every device, and make changes through documented approval so nobody weakens a setting by accident.' },
        { action: 'Retire devices safely', why: 'Wipe configurations and keys, remove the device from monitoring, DNS and certificate lists, and sanitize or destroy the storage. This is called decommissioning.' },
      ],
    },

    h('Quick reference by device'),
    table(
      ['Device', 'The most important hardening steps'],
      [
        ['**Switch**', 'Shut down unused ports, port security, 802.1X, DHCP snooping and Dynamic ARP Inspection, BPDU Guard, no trunk negotiation, change the native VLAN, SSH only'],
        ['**Router**', 'Change defaults, disable unneeded services, disable source routing and directed broadcasts, ingress and egress filtering, ACL on management, authenticated routing, SSH only'],
        ['**Firewall**', 'Default deny in both directions, remove "any to any" rules, review and clean up rules, MFA and restricted management, firmware updates, logging'],
        ['**Wireless access point**', 'WPA3 or WPA2 with AES, Enterprise mode, disable WPS, separate guest network, change admin defaults, WIPS, firmware updates'],
        ['**DNS server**', 'Disable open recursion, restrict zone transfers, DNSSEC, rate limiting, patching, split DNS for internal names, query logging'],
        ['**DHCP server**', 'Authorize only approved servers, DHCP snooping on switches, reservations for critical devices, small scopes per VLAN, alert on rogue servers'],
        ['**Servers and endpoints**', 'Patch, remove unneeded software, host firewall, endpoint protection (EDR), full-disk encryption, least privilege, application allow listing'],
        ['**IoT and embedded devices**', 'Change defaults, update firmware, put them on their own VLAN with limited access, disable features such as UPnP, monitor them'],
      ],
    ),

    h('Exercise: spot the weaknesses'),
    {
      type: 'spot',
      title: 'Spot the weaknesses in this router configuration',
      intro: 'Below is part of a router configuration in a Cisco-style syntax. Tap every line you think is a **security weakness**, then check. Some lines are fine on purpose, and picking them counts as a false alarm.',
      lines: [
        { text: 'hostname EDGE-RTR1', fine: 'A meaningful name helps inventory and logging. Not a weakness.' },
        {
          text: 'enable password cisco',
          issue: { why: 'A weak, guessable password stored in plain text.', fix: 'Use `enable secret` with a strong password so it is stored as a hash, or better, central AAA.' },
        },
        {
          text: 'username admin password admin',
          issue: { why: 'A default-style account and password, stored without hashing.', fix: 'Create unique accounts with strong secrets (`username ... secret ...`), or use central AAA with MFA.' },
        },
        { text: 'ip ssh version 2', fine: 'Forces SSH version 2, the secure version. Good practice.' },
        {
          text: 'ip http server',
          issue: { why: 'Turns on the unencrypted web management interface, so passwords and settings cross the network in clear text.', fix: 'Disable it (`no ip http server`) and use HTTPS only if web management is truly needed.' },
        },
        {
          text: 'snmp-server community public RO',
          issue: { why: 'SNMP v1 or v2c with the well-known community string "public". Anyone who can reach the router can read its data.', fix: 'Use SNMPv3 with authentication and encryption, and restrict who may poll.' },
        },
        { text: 'ntp server 10.0.9.2', fine: 'Synchronized time makes logs trustworthy. Good practice.' },
        { text: 'logging host 10.0.9.5', fine: 'Logs are sent to a central server, so an attacker cannot simply erase the evidence on the router. Good practice.' },
        {
          text: 'ip source-route',
          issue: { why: 'Lets senders dictate the path their packets take, which attackers can use to get around controls.', fix: 'Disable it (`no ip source-route`).' },
        },
        { text: 'interface GigabitEthernet0/0', fine: 'The heading for the WAN interface settings below. Not a weakness by itself.' },
        { text: ' description WAN link to ISP', fine: 'Clear descriptions help documentation and inventory. Good practice.' },
        { text: ' ip access-group BLOCK-SPOOFED in', fine: 'An inbound ACL that drops spoofed and private source addresses (ingress filtering). Good practice.' },
        {
          text: ' ip directed-broadcast',
          issue: { why: 'Lets a broadcast sent from the internet reach the whole network behind the router, which enables Smurf-style amplification attacks.', fix: 'Disable it (`no ip directed-broadcast`).' },
        },
        { text: 'interface GigabitEthernet0/3', fine: 'The heading for an interface. Not a weakness by itself.' },
        {
          text: ' no shutdown',
          issue: { why: 'An unused port left switched on with no description. Anyone can plug in.', fix: 'Shut down unused interfaces (`shutdown`) and label them as unused.' },
        },
        { text: 'line vty 0 4', fine: 'The heading for the remote login lines. Not a weakness by itself.' },
        { text: ' access-class 10 in', fine: 'Only addresses permitted by access list 10 (the administrator network) can reach the login lines. Good practice.' },
        {
          text: ' transport input telnet',
          issue: { why: 'Telnet sends the login and every command in clear text.', fix: 'Allow SSH only (`transport input ssh`).' },
        },
        {
          text: ' exec-timeout 0 0',
          issue: { why: 'Idle sessions never time out, so an unattended terminal stays logged in.', fix: 'Set a short timeout, for example `exec-timeout 5 0`.' },
        },
      ],
    },

    h('Keeping devices hardened over time'),
    p('Hardening is not one and done. Devices drift: someone opens a port "just for now", a patch is missed, a default comes back after a reset.'),
    list(
      '**Baselines.** Write down the approved hardened configuration for each kind of device (start from the CIS Benchmarks or the vendor\'s guide) and build new devices from it.',
      '**Configuration compliance scans.** Regularly compare devices with the baseline to catch **drift**, whether it comes from mistakes or attackers.',
      '**Patch cycles.** A regular schedule for routine updates, plus a fast path for emergency fixes when a critical flaw is announced.',
      '**Change management.** Every change is requested, approved, tested and documented, with a way to back it out.',
      '**Testing.** Vulnerability scans find known weaknesses, penetration tests show what an attacker could actually do, and audits confirm the process is followed.',
      '**Monitoring.** Logs, alerts and a SIEM show attempts and changes, so hardening does not quietly decay.',
    ),
    exam('"Which is the BEST first step when deploying a new device?" The answer is usually to **change default credentials and disable unnecessary services**, then patch it, then apply the baseline. Also expect "which control detects a device that has moved away from its approved configuration?" (a compliance or configuration scan).'),
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
      'Shut the port down and place it in an unused VLAN',
      ['Leave it enabled in case it is needed later', 'Turn on SNMP version 1 for that port', 'Give the port a default gateway'],
      'An unused but enabled port is an open door for rogue devices. Disabling it removes the risk.',
    ),
    mcq(
      'What is a secure baseline used for?',
      'Defining the approved hardened configuration and detecting devices that drift from it',
      ['Speeding up the network by removing encryption', 'Replacing the need for patching', 'Recording how many users log in each day'],
      'A baseline is the standard to build from and compare against. Drift scans find devices that have moved away from it.',
    ),
    mcq(
      'Moving SSH from port 22 to port 2222 mainly achieves what?',
      'It reduces automated scan noise but is not real security',
      ['It makes the service immune to attacks', 'It encrypts the connection more strongly', 'It removes the need for a firewall'],
      'Changing a port is security through obscurity. A port scan finds the new port quickly, so real controls such as strong authentication, patching and firewall rules are still required.',
    ),
  ],
};
