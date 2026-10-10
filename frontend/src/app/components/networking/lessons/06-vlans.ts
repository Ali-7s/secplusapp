import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, table } from './dsl';

export const VLANS: LessonBody = {
  goals: [
    'Explain what a VLAN is and why you would use one',
    'Tell access ports from trunk ports and say what an 802.1Q tag is',
    'Explain how devices in different VLANs communicate',
    'Describe the two VLAN hopping attacks and how to stop them',
    'Compare VLANs with the other ways of segmenting a network',
  ],
  blocks: [
    p('A **VLAN** (virtual LAN) lets you carve one physical switch into several separate **virtual** switches. Devices in different VLANs cannot talk to each other directly, even when they are plugged into the same switch. To cross over, traffic has to go through a router or a firewall, where rules can be applied.'),
    analogy('One office floor with glass walls. Everybody is in the same building (the switch), but Finance and Guests sit in separate rooms. To get from one room to the other you go through a security desk (the router or firewall).'),
    {
      type: 'ports',
      caption: 'A small switch carved into VLANs. Which VLAN a port belongs to decides which network a plugged-in device lands on.',
      cells: [
        { label: '1', group: 'staff' }, { label: '2', group: 'staff' }, { label: '3', group: 'staff' },
        { label: '4', group: 'guest' }, { label: '5', group: 'guest' },
        { label: '6', group: 'mgmt' }, { label: '7', group: 'off' }, { label: '8', group: 'trunk' },
      ],
      legend: [
        { group: 'staff', label: 'VLAN 10: staff PCs (ports 1 to 3)', tone: 'blue' },
        { group: 'guest', label: 'VLAN 20: guest Wi-Fi access point (ports 4 and 5)', tone: 'green' },
        { group: 'mgmt', label: 'VLAN 99: management (port 6)', tone: 'orange' },
        { group: 'off', label: 'Unused port, shut down (port 7)', tone: 'gray' },
        { group: 'trunk', label: 'Trunk carrying every VLAN to the router or firewall (port 8)', tone: 'purple' },
      ],
    },

    h('Why bother with VLANs?'),
    list(
      '**Security.** An infected laptop or a guest in one VLAN cannot sniff or directly reach another VLAN, so attackers have a harder time moving sideways.',
      '**Different rules for different groups.** Guests get internet only, servers get strict rules, and cameras and printers cannot reach finance.',
      '**Less noise.** Each VLAN is its own broadcast domain, so broadcasts stay small.',
      '**Compliance.** Standards such as PCI DSS expect systems that handle card data to be separated from everything else.',
    ),

    h('Access ports and trunk ports'),
    table(
      ['Port type', 'Carries', 'Used for'],
      [
        ['Access port', 'One VLAN, with no tag', 'PCs, printers, phones and access points'],
        ['Trunk port', 'Many VLANs at once, each frame **tagged**', 'Switch to switch, switch to router or firewall, and switch to a virtualization host'],
      ],
    ),
    p('On a trunk, each frame carries an **802.1Q tag** holding the **VLAN ID** (1 to 4094). The receiving switch reads the tag and keeps the frame inside the right VLAN. One VLAN on a trunk can be left **untagged**. That is the **native VLAN** (VLAN 1 by default, which is something you should change).'),
    p('To let VLANs talk to each other in a controlled way, a router or Layer 3 switch has an interface (or sub-interface) in each VLAN. This is **inter-VLAN routing**, and the ACLs or firewall rules there decide what is allowed.'),

    h('VLAN hopping'),
    p('**VLAN hopping** is an attack that lets someone reach a VLAN they should not. There are two classic ways:'),
    table(
      ['Method', 'How it works', 'The fix'],
      [
        ['Switch spoofing', 'The attacker\'s device pretends to be a switch and negotiates a trunk using DTP, so it receives traffic from every VLAN', 'Set user ports to **access** and **disable trunk negotiation**'],
        ['Double tagging', 'The attacker sends a frame with two 802.1Q tags. The first switch strips the outer tag (it matches the native VLAN) and forwards the inner tag into the target VLAN', 'Change the **native VLAN** to an unused ID, tag the native VLAN, and never put user ports in it'],
      ],
    ),

    h('Segmentation: the whole family'),
    p('VLANs are one tool among several for splitting a network into zones.'),
    table(
      ['Method', 'What it is', 'Example'],
      [
        ['Physical segmentation or air gap', 'Separate hardware with no connection', 'An industrial control network that is physically isolated'],
        ['Logical segmentation (VLAN or subnet plus ACL)', 'Same hardware, separate virtual networks', 'Staff, guests and servers on different VLANs'],
        ['Screened subnet (DMZ)', 'A buffer zone between the internet and the inside', 'A public web server (lesson 8)'],
        ['Microsegmentation', 'Rules for each individual workload, often in virtual or cloud environments', 'Zero trust: a database only accepts connections from its application server'],
      ],
    ),
    exam('"Which control limits **lateral movement** after a breach?" Segmentation. "Which attack lets a user reach another VLAN by negotiating a trunk?" Switch spoofing (VLAN hopping). Know that **VLANs separate but do not filter**: you still need ACLs or a firewall between them.'),

    hSecure('How to secure it: VLANs and trunks'),
    {
      type: 'harden',
      title: 'Harden VLANs and trunks',
      items: [
        { action: 'Do not use VLAN 1 for anything', why: 'It is the default for everything (native VLAN, management, user ports), so attackers know to try it. Use a different, unused ID for the native VLAN.' },
        { action: 'Set each port to access or trunk explicitly and turn off trunk negotiation', why: 'This stops switch spoofing. A user port should never be able to become a trunk.', example: 'switchport mode access' },
        { action: 'Park unused ports in an unused VLAN and shut them down', why: 'Anything plugged in lands nowhere useful.' },
        { action: 'Prune trunks to the VLANs that are actually needed', why: 'A trunk carrying every VLAN gives an attacker who reaches it everything.' },
        { action: 'Create a separate management VLAN for switch administration', why: 'Only administrator workstations should be able to reach device management.' },
        { action: 'Put a firewall or ACL between VLANs, with default deny', why: 'VLANs on their own separate traffic, but once a router joins them they do not filter it. Allow only the flows you need and log the denied ones.' },
        { action: 'Use 802.1X with dynamic VLAN assignment and a quarantine VLAN', why: 'Devices land in the right VLAN based on who or what they are, and non-compliant devices go to a restricted VLAN until they are fixed (this is NAC).' },
        { action: 'Keep guest, IoT and operational technology (OT) devices in their own VLANs with limited access', why: 'These are the least trustworthy and hardest to patch devices, so contain them.' },
      ],
    },
  ],
  check: [
    mcq(
      'Two PCs on the same switch are in different VLANs. How can they communicate?',
      'Through a router or Layer 3 device that routes between the VLANs',
      ['Directly, because they share the same switch', 'Only through a hub', 'By changing their MAC addresses'],
      'VLANs behave like separate switches. Traffic between them has to be routed, and that is where ACLs and firewall rules can be applied.',
    ),
    mcq(
      'Which port type carries traffic for many VLANs using 802.1Q tags?',
      'A trunk port',
      ['An access port', 'A console port', 'A mirror (SPAN) port'],
      'Trunk ports carry multiple VLANs with tags. Access ports carry a single VLAN, usually untagged.',
    ),
    mcq(
      'What should you do on user-facing ports to stop switch-spoofing VLAN hopping?',
      'Configure them as access ports and disable trunk negotiation',
      ['Enable more VLANs on them', 'Leave DTP in automatic mode', 'Set the native VLAN to 1'],
      'If a port can never negotiate a trunk, an attacker\'s device cannot pretend to be a switch.',
    ),
    mcq(
      'An attacker sends frames with two 802.1Q tags to reach another VLAN. What is this attack?',
      'Double tagging',
      ['MAC flooding', 'A SYN flood', 'DNS poisoning'],
      'Double tagging is a form of VLAN hopping. Moving the native VLAN away from the user VLANs defeats it.',
    ),
  ],
};
