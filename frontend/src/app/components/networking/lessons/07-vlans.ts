import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, pbq, recap, table, words } from './dsl';
import { VLAN_CONFIG } from './practice';

export const VLANS: LessonBody = {
  goals: [
    'Explain what a VLAN is and why you would use one',
    'Tell access ports from trunk ports and say what an 802.1Q tag is',
    'Explain how devices in different VLANs communicate',
    'Describe the two VLAN hopping attacks and how to stop them',
    'Compare VLANs with the other ways of splitting up a network',
  ],
  blocks: [
    recap('A **switch** connects the devices on one local network, and everything plugged into it hears each other\'s **broadcasts** (one broadcast domain). Only a **router** separates networks (lesson 6). Devices on different subnets need a router between them (lesson 2).'),
    words(
      ['VLAN', 'Virtual LAN: one physical switch split into several separate networks in software'],
      ['Segmentation', 'Splitting a network into separate zones so a problem in one cannot easily spread'],
      ['Lateral movement', 'An attacker who got into one device moving on to others inside the network'],
      ['Access port', 'A switch port that belongs to one VLAN, for a normal device such as a PC'],
      ['Trunk port', 'A switch port that carries many VLANs at once, usually a link between switches'],
      ['802.1Q tag', 'A small label added to a frame on a trunk, saying which VLAN it belongs to'],
      ['VLAN ID', 'The number that identifies a VLAN, from 1 to 4094'],
      ['Native VLAN', 'The one VLAN on a trunk whose frames travel without a tag. VLAN 1 by default'],
      ['ACL', 'Access control list: a list of rules on a router or switch saying which traffic is allowed and which is blocked'],
      ['VLAN hopping', 'An attack that lets someone reach a VLAN they should not be able to'],
      ['NAC', 'Network access control: checking who or what a device is, and whether it is safe, before letting it on the network'],
    ),

    h('What a VLAN is'),
    p('Lesson 6 showed that everything plugged into a switch is one network: every device hears every broadcast, and every device can reach every other. That is a problem when the guest Wi-Fi, the security cameras and the finance team\'s PCs all hang off the same switches.'),
    p('A **VLAN** (virtual LAN) solves it. It lets you split one physical switch into several separate **virtual** switches, just by setting which VLAN each port belongs to. Devices in different VLANs cannot talk to each other directly, even when they are plugged into the same switch. As far as the devices can tell, they are on completely separate networks, and in practice each VLAN gets its own subnet (lesson 2).'),
    p('To get from one VLAN to another, traffic has to go through a router or a firewall, and that is exactly where rules can be applied about what may cross.'),
    analogy('One office floor with glass walls. Everybody is in the same building (the switch), but Finance and Guests sit in separate rooms with their own doors. To get from one room to the other you must go through the security desk (the router or firewall), which checks whether you are allowed.'),
    {
      type: 'ports',
      caption: 'A small switch split into VLANs. The VLAN a port belongs to decides which network a plugged-in device lands on.',
      cells: [
        { label: '1', group: 'staff' }, { label: '2', group: 'staff' }, { label: '3', group: 'staff' },
        { label: '4', group: 'guest' }, { label: '5', group: 'guest' },
        { label: '6', group: 'mgmt' }, { label: '7', group: 'off' }, { label: '8', group: 'trunk' },
      ],
      legend: [
        { group: 'staff', label: 'VLAN 10: staff PCs (ports 1 to 3)', tone: 'blue' },
        { group: 'guest', label: 'VLAN 20: guest Wi-Fi access point (ports 4 and 5)', tone: 'green' },
        { group: 'mgmt', label: 'VLAN 99: management, for administering the network gear (port 6)', tone: 'orange' },
        { group: 'off', label: 'Unused port, switched off (port 7)', tone: 'gray' },
        { group: 'trunk', label: 'Trunk carrying every VLAN to the router or firewall (port 8)', tone: 'purple' },
      ],
    },

    h('Why bother with VLANs?'),
    p('Splitting a network into separate zones is called **segmentation**, and VLANs are the most common way to do it. The benefits:'),
    list(
      '**Security.** An infected laptop or a guest in one VLAN cannot directly reach or listen in on another VLAN. That makes **lateral movement** (an attacker hopping from the first device they broke into on to others) much harder.',
      '**Different rules for different groups.** Guests get the internet only, servers get strict rules, and cameras and printers cannot reach the finance PCs.',
      '**Less noise.** Each VLAN is its own broadcast domain, so broadcasts stay small.',
      '**Compliance.** Some rules require separation. For example, the card payment industry\'s standard (**PCI DSS**) expects systems that handle card numbers to be kept apart from everything else.',
    ),

    h('Access ports and trunk ports'),
    p('Each switch port is set up in one of two ways:'),
    table(
      ['Port type', 'Carries', 'Used for'],
      [
        ['Access port', 'One VLAN only, with no tag', 'Normal devices: PCs, printers, phones, access points'],
        ['Trunk port', 'Many VLANs at once, each frame **tagged**', 'Links between switches, and from a switch to a router, firewall or server that hosts virtual machines'],
      ],
    ),
    p('A trunk has a problem to solve: if frames from many VLANs share one cable, how does the switch at the other end know which VLAN each frame belongs to? The answer is a small label added to each frame, called an **802.1Q tag** (802.1Q is the name of the standard). The tag holds the **VLAN ID**, a number from 1 to 4094. The receiving switch reads the tag, keeps the frame inside the right VLAN, and removes the tag before delivering it to a normal device.'),
    p('One VLAN on a trunk is allowed to travel **without** a tag. That is the **native VLAN**, and by default it is VLAN 1. Remember that: it matters for an attack below.'),

    h('How VLANs talk to each other'),
    p('Since each VLAN is a separate network, getting from one to another needs a router, just like getting between any two networks. A router or **Layer 3 switch** (a switch that can also route, lesson 6) has a connection in each VLAN and passes traffic between them. This is called **inter-VLAN routing**.'),
    p('The important part is that this crossing point is where you control what is allowed, using an **ACL** (access control list: a list of allow and block rules) or a full firewall. For example: "staff may reach the printers, guests may reach nothing internal".'),
    exam('Know that **VLANs separate traffic but do not filter it**. Once a router joins two VLANs, everything can cross unless an ACL or firewall says otherwise.'),

    h('VLAN hopping'),
    p('**VLAN hopping** is an attack that lets someone reach a VLAN they should not. There are two classic ways, and both abuse switch defaults:'),
    table(
      ['Method', 'How it works', 'The fix'],
      [
        ['Switch spoofing', 'By default, many switch ports can automatically become trunks if the device plugged in asks, using a protocol called **DTP** (dynamic trunking protocol). The attacker\'s laptop pretends to be a switch, the port becomes a trunk, and the laptop now receives traffic from every VLAN', 'Set user ports to **access** mode and **switch off trunk negotiation**'],
        ['Double tagging', 'The attacker sends a frame with **two** tags. The first switch removes the outer tag (because it matches the untagged native VLAN) and passes the frame on, where the next switch reads the inner tag and drops it into the target VLAN', 'Change the **native VLAN** to an unused number, and never put user ports in it'],
      ],
    ),

    h('Segmentation: the whole family'),
    p('VLANs are one tool among several for splitting a network into zones of different trust:'),
    table(
      ['Method', 'What it is', 'Example'],
      [
        ['Physical separation or air gap', 'Completely separate equipment with no connection at all (an "air gap")', 'A factory control network that is physically cut off'],
        ['Logical segmentation (VLANs or subnets with ACLs)', 'Same equipment, separate virtual networks', 'Staff, guests and servers on different VLANs'],
        ['Screened subnet (DMZ)', 'A buffer zone between the internet and the inside, for servers the public must reach', 'A public web server (lesson 9)'],
        ['Microsegmentation', 'Rules for each individual server or workload, often in virtual or cloud environments', 'A database only accepts connections from its own application server'],
      ],
    ),
    p('Microsegmentation is part of a wider approach called **zero trust**: never trust a device just because it is inside the network, and check every connection.'),
    exam('"Which control limits **lateral movement** after a breach?" Segmentation. "Which attack lets a user reach another VLAN by negotiating a trunk?" Switch spoofing (VLAN hopping).'),

    pbq('Try it: configure the switch ports', VLAN_CONFIG, { intro: 'A performance-based question often hands you a switch and asks you to set up each port. Here is a small one.' }),

    hSecure('How to secure it: VLANs and trunks'),
    {
      type: 'harden',
      title: 'Harden VLANs and trunks',
      items: [
        { action: 'Do not use VLAN 1 for anything', why: 'VLAN 1 is the default for everything (the native VLAN, management, every unconfigured port), so attackers know to try it. Use a different, unused number as the native VLAN.' },
        { action: 'Set each port to access or trunk yourself, and switch off trunk negotiation', why: 'This stops switch spoofing. A port where users plug in should never be able to become a trunk.', example: 'switchport mode access' },
        { action: 'Put unused ports in an unused VLAN and switch them off', why: 'Anything plugged in lands nowhere useful.' },
        { action: 'Allow only the VLANs that are needed on each trunk', why: 'A trunk carrying every VLAN gives everything to an attacker who reaches it. Removing unneeded VLANs from a trunk is called pruning.' },
        { action: 'Use a separate management VLAN for administering network equipment', why: 'Only administrators\' computers should be able to reach the login pages of switches and routers.' },
        { action: 'Put a firewall or ACL between VLANs, blocking by default', why: 'VLANs separate traffic, but once a router joins them they do not filter it. Allow only the traffic that is needed and log what gets blocked.' },
        { action: 'Use 802.1X to place each device in the right VLAN, with a quarantine VLAN', why: 'Devices log in and land in the right VLAN based on who or what they are. Devices that fail the health check (missing updates, no antivirus) go to a restricted **quarantine** VLAN until they are fixed. This is **NAC**, network access control.' },
        { action: 'Keep guest, smart (IoT) and factory control (OT) devices in their own VLANs with limited access', why: 'These are the least trustworthy and hardest to update devices, so contain them.' },
      ],
    },
  ],
  check: [
    mcq(
      'Two PCs on the same switch are in different VLANs. How can they communicate?',
      'Through a router or Layer 3 switch that routes between the VLANs',
      ['Directly, because they share the same switch', 'Only through a hub', 'By changing their MAC addresses'],
      'VLANs behave like separate switches. Traffic between them has to be routed, and that is where ACLs and firewall rules can be applied.',
    ),
    mcq(
      'Which port type carries traffic for many VLANs using 802.1Q tags?',
      'A trunk port',
      ['An access port', 'A console port', 'A mirror (SPAN) port'],
      'Trunk ports carry multiple VLANs with tags. Access ports carry a single VLAN, untagged.',
    ),
    mcq(
      'What should you do on ports where users plug in, to stop switch spoofing?',
      'Set them as access ports and switch off trunk negotiation',
      ['Allow more VLANs on them', 'Leave trunk negotiation on automatic', 'Set the native VLAN to 1'],
      'If a port can never become a trunk, an attacker\'s laptop cannot pretend to be a switch.',
    ),
    mcq(
      'An attacker sends frames with two 802.1Q tags to reach another VLAN. What is this attack?',
      'Double tagging',
      ['MAC flooding', 'A SYN flood', 'DNS poisoning'],
      'Double tagging is a form of VLAN hopping. Moving the native VLAN away from the user VLANs defeats it.',
    ),
  ],
};
