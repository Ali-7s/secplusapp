import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, table, trap } from './dsl';

export const ADDRESSES: LessonBody = {
  goals: [
    'Tell a MAC address from an IP address and say what each is used for',
    'Explain what a subnet mask is for and use one to tell whether two addresses are on the same network',
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
    p('An IPv4 address is four numbers separated by dots, such as `192.168.1.25`. Each number is called an **octet** and can only be 0 to 255. The reason is that computers store everything as **bits**: a bit is a single on/off switch (1 or 0). Each octet is 8 switches, and 8 switches can make exactly 256 combinations, which are the numbers 0 to 255.'),

    h('Why an address has two parts'),
    p('An IP address works like a street address. Part of it says **which network** the device is on (the street) and the rest says **which device** it is on that network (the house number). These are called the **network part** and the **host part**.'),
    p('The split matters because of one decision every device makes before it sends anything: **is the destination on my own network?**'),
    list(
      '**Yes, same network:** the device delivers the traffic itself, directly.',
      '**No, a different network:** it hands the traffic to its router (the **default gateway**, covered below), which knows how to reach other networks.',
    ),
    analogy('Houses on the **same street** can pass a note over the fence. To reach a house on **another street**, you take it to the post office (the router) and let it deliver. To decide which to do, you only compare the **street names**, never the house numbers.'),

    h('The subnet mask: where the street name ends'),
    p('Here is the problem. Looking at `192.168.1.25`, you cannot tell where the network part stops. It could be network `192.168.1` with device 25, or network `192.168` with device `1.25`. The address alone does not say.'),
    p('The **subnet mask** is a second number, set alongside the IP address on every device, that answers exactly this. Line it up under the address, octet by octet. Where the mask says **255**, that octet belongs to the **network**. Where it says **0**, that octet belongs to the **host**.'),
    table(
      ['Octet', 'Address', 'Mask', 'Part'],
      [
        ['1st', '192', '255', '**network**'],
        ['2nd', '168', '255', '**network**'],
        ['3rd', '1', '255', '**network**'],
        ['4th', '25', '0', '**host**'],
      ],
      { caption: 'Address 192.168.1.25 with mask 255.255.255.0: host 25 on network 192.168.1.0', mono: [1, 2] },
    ),
    p('Now the device can make its decision. With address `192.168.1.25` and mask `255.255.255.0`, it compares the network octets (the first three) of itself and the destination:'),
    table(
      ['Destination', 'Same network?', 'So the device'],
      [
        ['`192.168.1.80`', 'Yes: 192.168.1 matches', 'Sends it directly'],
        ['`192.168.2.10`', 'No: 192.168.2 differs', 'Sends it to the gateway'],
        ['`8.8.8.8`', 'No: 8.8.8 differs', 'Sends it to the gateway'],
      ],
    ),
    p('Change the mask and the answer changes. With `255.255.0.0`, only the first **two** octets are the network, so `192.168.2.10` **would** count as the same network. That is all a subnet mask does: it tells a device how much of an address is the network, so it knows what it can reach directly.'),
    p('Why 255 and 0? Remember each octet is 8 switches. **255** is all 8 switches on (`11111111`) and **0** is all 8 off (`00000000`). The mask is really 32 switches in a row: **on means network, off means host**, and the on switches always come first. Usually the split falls between octets, which gives the friendly 255s and 0s. When it falls in the middle of an octet you get values like `255.255.255.192`; the calculator below handles those.'),
    p('Two addresses in every network are reserved. The first (host part all zeros, such as `192.168.1.0`) is the name of the network itself, and the last (host part all ones, such as `192.168.1.255`) is the **broadcast** address, which reaches every device on the network at once. So devices get `.1` to `.254`.'),

    h('CIDR notation: the /24 you keep seeing'),
    p('Writing the mask in full is clumsy, so we just count how many of the 32 switches are on. **CIDR notation** puts a slash and that count after the address. `255.255.255.0` is three octets of 8 on switches, so 24 on: `192.168.1.0/24`. It means exactly the same as the mask, just shorter. A **bigger** number after the slash means more of the address is network and less is host, so the network holds **fewer** devices.'),
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
      'A PC has the address 10.1.5.20 with the mask 255.255.255.0. It sends data to 10.1.6.20. What does it do?',
      'It sends the data to its default gateway, because 10.1.6 is a different network',
      ['It delivers the data directly, because both addresses start with 10.1', 'It drops the data, because the host numbers are the same', 'It asks DNS which network 10.1.6.20 is on'],
      'The mask 255.255.255.0 makes the first three octets the network. 10.1.5 and 10.1.6 differ, so the destination is on another network and the PC hands the traffic to its default gateway (the router).',
    ),
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
