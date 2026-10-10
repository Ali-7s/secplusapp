import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, table, trap } from './dsl';

export const ADDRESSES: LessonBody = {
  goals: [
    'Tell a MAC address from an IP address and say what each is used for',
    'Read an IPv4 address and a CIDR block such as 192.168.1.0/24',
    'Recognize private, loopback and link-local (APIPA) addresses on sight',
    'Explain what a default gateway does',
    'Describe the main ways IPv6 differs from IPv4',
  ],
  blocks: [
    h('Two addresses, two jobs'),
    p('Every network card has a **MAC address** burned in at the factory. It is 48 bits long and written as six pairs of hex digits, like `00:1A:2B:3C:4D:5E`. It names that specific card on the **local** network.'),
    p('A device also has an **IP address**, assigned by the network (usually through DHCP) or set by hand. It says where the device sits in the larger network, and it is what lets traffic be routed across networks and the internet.'),
    analogy('Your **name** versus your **mailing address**. Mail is routed across the country using the mailing address (IP), but the final hand-off at the door uses a name (MAC). The name stays with you. The address changes when you move to a different network.'),
    table(
      ['Property', 'MAC address', 'IP address'],
      [
        ['Looks like', '`00:1A:2B:3C:4D:5E` (48 bits, hex)', '`192.168.1.25` (IPv4, 32 bits) or `2001:db8::1` (IPv6, 128 bits)'],
        ['Layer', '2, Data Link', '3, Network'],
        ['Assigned by', 'The manufacturer (it can be changed in software)', 'DHCP or an administrator'],
        ['Works across', 'One local network only', 'The whole internet'],
        ['Used by', 'Switches', 'Routers'],
        ['Faked by', 'MAC spoofing and MAC flooding', 'IP spoofing'],
      ],
    ),

    h('Reading an IPv4 address'),
    p('An IPv4 address is four numbers from 0 to 255 separated by dots, such as `192.168.1.25`. Each number is called an **octet** because it is 8 bits. The address has two parts: the **network part** (which network) and the **host part** (which device on that network). The **subnet mask** says where the split is.'),
    p('With the mask `255.255.255.0`, the first three octets are the network and the last octet is the host. So `192.168.1.25` is host 25 on the network `192.168.1.0`. The first address of a block (`.0`) names the network and the last (`.255`) is the **broadcast** address, so devices can use `.1` to `.254`.'),

    h('CIDR notation: the /24 you keep seeing'),
    p('Writing the mask in full is clumsy, so we just count the network bits. **CIDR notation** puts a slash and that count after the address. `192.168.1.0/24` means "the first 24 bits are the network", which is the same as the mask `255.255.255.0`. A **bigger** number after the slash means a **smaller** network.'),
    table(
      ['CIDR', 'Subnet mask', 'Usable hosts', 'Typically used for'],
      [
        ['/8', '255.0.0.0', '16,777,214', 'A huge organization'],
        ['/16', '255.255.0.0', '65,534', 'A large site'],
        ['/24', '255.255.255.0', '254', 'A normal LAN or VLAN'],
        ['/30', '255.255.255.252', '2', 'A link between two routers'],
        ['/32', '255.255.255.255', '1', 'One single host (used in rules)'],
      ],
      { mono: [0, 1] },
    ),
    p('To estimate the hosts, count the host bits (`32 - prefix`). That gives `2^(host bits) - 2` usable addresses, because two are lost to the network and broadcast addresses. Try it yourself:'),
    { type: 'cidr' },
    exam('You will **not** be asked to do heavy subnetting in Security+ (that is Network+). Know how to **read** `10.0.0.0/8` and `192.168.1.0/24`, know what a mask means, and know that devices in the same subnet talk directly while devices in different subnets need a router or firewall between them.'),

    h('Private, public and special addresses'),
    p('Some ranges are reserved. **Private addresses** can be used by anyone inside their own network but are never routed on the public internet. A router doing NAT translates them to a public address (lesson 7).'),
    table(
      ['Range', 'What it is', 'Notes'],
      [
        ['`10.0.0.0/8`', 'Private (RFC 1918)', 'Large organizations'],
        ['`172.16.0.0/12`', 'Private (RFC 1918)', 'Only 172.16 to 172.31 is private'],
        ['`192.168.0.0/16`', 'Private (RFC 1918)', 'Homes and small offices'],
        ['`127.0.0.0/8`', 'Loopback', '`127.0.0.1` always means "this computer"'],
        ['`169.254.0.0/16`', 'Link-local (APIPA)', 'The device could not reach a DHCP server and gave itself an address. A troubleshooting clue'],
        ['`224.0.0.0/4`', 'Multicast', 'Traffic for a group of listeners'],
        ['Everything else', 'Public', 'Reachable on the internet'],
      ],
    ),
    trap('`172.32.0.1` is **not** private. The private block stops at `172.31.255.255`. Questions love this one.'),

    h('The default gateway'),
    p('A device only talks **directly** to addresses in its own subnet. For anything else it hands the traffic to its **default gateway**, which is the router\'s address on its own subnet (often the `.1` or `.254` address). If a computer can reach local devices but not the internet, check the gateway setting first.'),

    h('IPv6 in a minute'),
    list(
      'IPv6 addresses are **128 bits**, written in hex with colons: `2001:db8:85a3::8a2e:370:7334`. A double colon (`::`) replaces a run of zeros, once per address.',
      '`::1` is the loopback address and `fe80::/10` is link-local, which every IPv6 interface has for talking on its own network.',
      'There is **no broadcast** in IPv6 (multicast is used instead) and **no ARP** (a protocol called NDP does that job).',
      'There are so many addresses that NAT is not needed, which means devices can be reached directly. That makes a **firewall** more important, not less.',
    ),

    hSecure('How to secure it: do not trust addresses'),
    p('Addresses can be forged, and attackers use that. Defend like this:'),
    list(
      '**Anti-spoofing filters.** At the network edge, drop packets arriving from the internet that claim a private, loopback or your-own-network source address (**ingress filtering**), and stop your own users from sending packets with source addresses that are not yours (**egress filtering**).',
      '**Tie addresses to ports.** On switches, DHCP snooping, IP source guard and port security bind an IP and MAC address to a switch port so a device cannot pretend to be another one.',
      '**Plan and document addresses.** Use reserved (static) addresses for servers and network gear, and keep an IP address plan (IPAM) so an unknown address stands out.',
      '**Segment by trust.** Give guests, IoT devices, servers and staff their own subnets so a firewall can sit between them.',
      '**Do not ignore IPv6.** If IPv6 is enabled but unmanaged it can bypass controls that only cover IPv4, so secure it properly or disable it where it is not used.',
    ),
  ],
  check: [
    mcq(
      'A PC shows the address 169.254.12.7. What does this most likely mean?',
      'It could not reach a DHCP server and gave itself an address',
      ['It has a static public address from the internet provider', 'It is using the loopback address to test itself', 'It is the DHCP server for the network'],
      '169.254.0.0/16 is the link-local (APIPA) range. A device falls back to it when DHCP fails, so it is a common clue when a computer cannot get online.',
    ),
    mcq(
      'Which of these is a private IPv4 address?',
      '172.20.4.9',
      ['172.32.0.1', '192.169.1.5', '11.0.0.1'],
      'The private ranges are 10.0.0.0/8, 172.16.0.0/12 (172.16 through 172.31) and 192.168.0.0/16. The other addresses fall just outside them, which is a favorite trick.',
    ),
    mcq(
      'What does the default gateway do?',
      'It forwards traffic that is destined for other networks',
      ['It assigns IP addresses to devices', 'It translates domain names into IP addresses', 'It maps IP addresses to MAC addresses on the LAN'],
      'A device sends anything outside its own subnet to the default gateway, which is a router. Assigning addresses is DHCP, translating names is DNS and mapping to MAC addresses is ARP.',
    ),
    mcq(
      'In 10.4.0.0/16, how many bits identify the network?',
      '16',
      ['4', '8', '24'],
      'The number after the slash is how many bits make up the network part. A /16 uses the first 16 bits (the mask is 255.255.0.0) and leaves 16 bits for hosts.',
    ),
  ],
};
