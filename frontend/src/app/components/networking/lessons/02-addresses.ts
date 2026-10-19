import { LessonBody } from '../networking.model';
import { analogy, exam, examPbqs, h, hSecure, list, mcq, p, pbq, recap, table, trap, words } from './dsl';
import { ADDRESS_DECISION, ADDRESS_TYPES } from './practice';

export const ADDRESSES: LessonBody = {
  goals: [
    'Tell a MAC address from an IP address and say what each is used for',
    'Explain what a subnet mask is for and use one to tell whether two addresses are on the same network',
    'Read a CIDR block such as 192.168.1.0/24',
    'Recognize private, loopback and link-local (APIPA) addresses on sight',
    'Explain what a default gateway does',
    'Describe the main ways IPv6 differs from IPv4',
  ],
  blocks: [
    recap('A **packet** is a small chunk of data with a **header** (its label) at the front. The header holds addresses, so the network knows where to deliver it. A **router** joins networks together, and a **LAN** is the network in one place. (Lesson 1.)'),
    words(
      ['MAC address', 'A fixed ID built into each network card, used to deliver data on the local network'],
      ['IP address', 'A device\'s address on the network, used to get data across networks and the internet'],
      ['Hexadecimal (hex)', 'A way of writing numbers using 0 to 9 and the letters a to f. MAC addresses are written in hex'],
      ['Octet', 'One of the four numbers in an IPv4 address. Each is 8 bits, so it can be 0 to 255'],
      ['Network part, host part', 'The two halves of an IP address: which network, and which device on that network'],
      ['Subnet mask', 'A second number that says where the network part ends and the host part begins'],
      ['Subnet', 'One network, defined by an address and a mask. Devices in the same subnet talk directly'],
      ['CIDR notation', 'A short way to write the mask: a slash and a number, such as /24'],
      ['Broadcast', 'A message sent to every device on the local network at once'],
      ['Default gateway', 'The router a device sends traffic to when the destination is on another network'],
      ['DHCP', 'A service that hands out IP addresses to devices automatically (lesson 8)'],
      ['Private address', 'An address meant for use inside a network, never sent across the internet'],
      ['NAT', 'A router feature that swaps private addresses for a public one on the way out (lesson 8)'],
      ['Spoofing', 'Faking an address so traffic seems to come from somewhere else'],
    ),

    h('Two addresses, two jobs'),
    p('Every device on a network has **two different addresses**, and they do different jobs. This trips up almost everyone at first, so take it slowly.'),
    p('**1. The MAC address.** Every network card (NIC) has a **MAC address** set at the factory. It is 48 bits long and written as six pairs of **hexadecimal** characters (hex uses the digits 0 to 9 plus the letters a to f), like `00:1A:2B:3C:4D:5E`. It identifies that one card. MAC addresses are only used to deliver data **between devices on the same local network**.'),
    p('**2. The IP address.** A device also gets an **IP address**, such as `192.168.1.25`. This one is not built in: the network gives it to the device, usually automatically through a service called **DHCP** (lesson 8), or an administrator types it in. The IP address says **where on the network** the device sits, and it is what lets data travel **across networks and the internet**.'),
    analogy('Your **name** and your **mailing address**. Mail crosses the country using your mailing address (the IP address). The final hand-off at the door uses your name (the MAC address). Your name stays with you for life; your mailing address changes when you move. In the same way, a laptop keeps its MAC address but gets a new IP address on each network it joins.'),
    table(
      ['', 'MAC address', 'IP address'],
      [
        ['Looks like', '`00:1A:2B:3C:4D:5E` (48 bits, in hex)', '`192.168.1.25` (IPv4, 32 bits) or `2001:db8::1` (IPv6, 128 bits)'],
        ['Comes from', 'Built into the network card (software can change it)', 'Given out by the network (DHCP) or set by an administrator'],
        ['Used to reach', 'Devices on the **same local network** only', 'Devices **anywhere**, across networks and the internet'],
        ['Read by', 'Switches (lesson 6)', 'Routers (lesson 6)'],
        ['Faked by', 'MAC spoofing', 'IP spoofing'],
      ],
    ),

    h('Reading an IPv4 address'),
    p('The common kind of IP address is called **IPv4** (version 4). It is four numbers separated by dots, such as `192.168.1.25`. Each number is called an **octet** and can only be 0 to 255.'),
    p('Why 0 to 255? Remember that computers store everything as **bits** (0s and 1s, like light switches). Each octet is 8 bits. Eight switches can be set in exactly 256 different on/off combinations, which give the numbers 0 to 255. Four octets make 32 bits in total.'),

    h('Why an address has two parts'),
    p('An IP address works like a street address. Part of it says **which network** the device is on (the street), and the rest says **which device** it is on that network (the house number). These are called the **network part** and the **host part** ("host" is just another word for device).'),
    p('The split matters because of one decision every device makes before it sends anything: **is the destination on my own network?**'),
    list(
      '**Yes, same network:** the device delivers the traffic itself, directly.',
      '**No, a different network:** it hands the traffic to its router, called the **default gateway** (explained below), which knows how to reach other networks.',
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
    p('A network defined by an address and a mask is called a **subnet** (short for subnetwork). "Same subnet" and "same network" mean the same thing in this course.'),
    p('Why 255 and 0? Remember each octet is 8 switches. **255** is all 8 switches on (`11111111`) and **0** is all 8 off (`00000000`). The mask is really 32 switches in a row: **on means network, off means host**, and the on switches always come first. Usually the split falls between octets, which gives the friendly 255s and 0s. When it falls in the middle of an octet you get values like `255.255.255.192`; the calculator below handles those for you.'),
    p('Two addresses in every subnet are reserved. The first one (host part all zeros, such as `192.168.1.0`) is the name of the network itself. The last one (host part all ones, such as `192.168.1.255`) is the **broadcast** address: a message sent to it reaches **every** device on that network at once. So the devices themselves get `.1` to `.254`.'),

    pbq('Try it: directly, or through the gateway?', ADDRESS_DECISION, { intro: 'This is the decision every device makes before sending anything. Use the mask to compare the network octets.' }),

    h('CIDR notation: the /24 you keep seeing'),
    p('Writing the mask in full is clumsy, so we just count how many of the 32 switches are on. **CIDR notation** (pronounced "cider") puts a slash and that count after the address. `255.255.255.0` is three octets of 8 on switches, so 24 on: `192.168.1.0/24`. It means exactly the same as the mask, just shorter.'),
    p('A **bigger** number after the slash means more of the address is network and less is host, so the network holds **fewer** devices.'),
    table(
      ['CIDR', 'Subnet mask', 'Usable addresses', 'Typically used for'],
      [
        ['/8', '255.0.0.0', '16,777,214', 'A huge organization'],
        ['/16', '255.255.0.0', '65,534', 'A large site'],
        ['/24', '255.255.255.0', '254', 'A normal LAN'],
        ['/30', '255.255.255.252', '2', 'A link between two routers'],
        ['/32', '255.255.255.255', '1', 'One single device (used in firewall rules)'],
      ],
      { mono: [0, 1] },
    ),
    p('Where do those counts come from? Each host switch doubles the number of possible addresses. A /24 leaves 32 − 24 = **8** host switches, and 8 switches give 2 × 2 × 2 × 2 × 2 × 2 × 2 × 2 = **256** combinations. Take away the 2 reserved ones (network and broadcast) and you get **254** usable addresses. Try a few in the calculator:'),
    { type: 'cidr' },
    exam('You will **not** be asked to do heavy subnetting in Security+ (that is the Network+ exam). Know how to **read** `10.0.0.0/8` and `192.168.1.0/24`, know what a mask does, and know that devices in the same subnet talk directly while devices in different subnets need a router or firewall between them.'),

    h('Private, public and special addresses'),
    p('Some address ranges are set aside for special uses. The most important are the **private** ranges. Anyone can use them inside their own network, but they are **never sent across the internet**. That is why millions of homes can all use `192.168.1.x` without clashing: those addresses never leave the home.'),
    p('So how does a device with a private address reach the internet? The router swaps the private address for its own **public** address on the way out, and swaps it back for the reply. This trick is called **NAT** (network address translation), and lesson 8 shows it step by step.'),
    table(
      ['Range', 'What it is', 'Notes'],
      [
        ['`10.0.0.0/8`', 'Private', 'Any address starting with 10. Large organizations'],
        ['`172.16.0.0/12`', 'Private', 'Only 172.16 to 172.31 is private'],
        ['`192.168.0.0/16`', 'Private', 'Any address starting with 192.168. Homes and small offices'],
        ['`127.0.0.0/8`', 'Loopback', '`127.0.0.1` always means "this computer itself", used for testing'],
        ['`169.254.0.0/16`', 'Link-local (APIPA)', 'A device could not get an address from DHCP, so it gave itself one. A troubleshooting clue'],
        ['`224.0.0.0/4`', 'Multicast', 'Traffic meant for a group of listening devices'],
        ['Everything else', 'Public', 'Reachable on the internet'],
      ],
    ),
    p('The three private ranges are defined in a standards document called **RFC 1918**, so you will see them called "RFC 1918 addresses".'),
    trap('`172.32.0.1` is **not** private. The private block stops at `172.31.255.255`. Questions love this one.'),

    pbq('Try it: what kind of address is this?', ADDRESS_TYPES),

    h('The default gateway'),
    p('Back to the decision every device makes. When the destination is on **another** network, the device does not try to find the way itself. It hands the packet to its **default gateway**: the router\'s address on the device\'s own subnet (often the `.1` or `.254` address). The router takes it from there.'),
    p('Every device is configured with three settings for this to work: its **IP address**, its **subnet mask** and its **default gateway**. DHCP usually hands out all three at once.'),
    analogy('The default gateway is the post office at the end of your street. Anything addressed to another street goes there, and the post office works out the rest.'),
    p('This gives you a handy troubleshooting rule. If a computer can reach devices on its own network but **nothing** beyond it, not even an internet address typed in directly, check the default gateway setting first.'),

    h('IPv6 in a minute'),
    p('IPv4 only has about 4.3 billion addresses, which is not enough for every device on Earth. **IPv6** (version 6) is the newer version with vastly more. You will meet it less often, but you should recognize it.'),
    list(
      'IPv6 addresses are **128 bits**, written in hex with colons: `2001:db8:85a3::8a2e:370:7334`. A double colon (`::`) is shorthand for a run of zeros, and can appear once per address.',
      '`::1` is the IPv6 loopback ("this computer"), and addresses starting `fe80:` are link-local: every IPv6 device has one for talking on its own network.',
      'IPv6 has **no broadcast** address (it sends to groups instead), and it does not use ARP (a helper from lesson 8). A protocol called **NDP** does that job.',
      'There are so many addresses that NAT is not needed, which means devices can be reached directly from the internet. That makes a **firewall** more important, not less.',
    ),

    hSecure('How to secure it: do not trust addresses'),
    p('Addresses are just numbers written in a packet\'s header, and an attacker can write anything there. Faking an address is called **spoofing**. Here is how defenders cope:'),
    list(
      '**Filter impossible addresses at the edge.** A packet arriving from the internet that claims a private, loopback or your-own-network source address must be fake, so the edge router or firewall drops it. Checking incoming traffic like this is **ingress filtering**. Checking that your own outgoing traffic only uses your real addresses is **egress filtering**.',
      '**Tie addresses to switch ports.** Switch features such as **DHCP snooping**, **IP source guard** and **port security** (lesson 6) remember which device is plugged into which socket, so a device cannot pretend to be another one.',
      '**Plan and record addresses.** Give servers and network equipment fixed, documented addresses, and keep an IP address plan (often in a tool called **IPAM**, IP address management), so an unknown address stands out.',
      '**Separate by trust.** Put guests, smart devices, servers and staff in their own subnets, so a firewall can sit between them (lesson 7).',
      '**Do not forget IPv6.** If IPv6 is switched on but nobody manages it, it can slip past controls that only cover IPv4. Secure it properly or turn it off where it is not used.',
    ),
    examPbqs('addresses'),
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
