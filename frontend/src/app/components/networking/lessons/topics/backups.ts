import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, backupWeek, exam, examPbqs, h, list, mcq, p, pbq, recap, table, tip, trap, words } from '../dsl';

const PICK_THE_PROTECTION: MatchQuestion = {
  id: 'topic-backups-pick', domain: 3, objective: '3.4', kind: 'match',
  scenario: 'A retailer is reviewing how it protects its systems against loss and outages.',
  stem: 'Choose the option that best meets each requirement.',
  choices: ['Hot site', 'Warm site', 'Cold site', 'Synchronous replication', 'Snapshot', 'Immutable backup', 'Uninterruptible power supply'],
  prompts: [
    { label: 'The payment system must be running again at another location within minutes of losing the main data center', answer: 'Hot site',
      why: 'A hot site is fully equipped and kept up to date, so it can take over within minutes. It is also the most expensive option.' },
    { label: 'The reporting system may be down for a day or two. Hardware is installed at the second site, but data must be restored first', answer: 'Warm site',
      why: 'A warm site has equipment ready but not current data, so it comes up in hours to days at a middle cost.' },
    { label: 'For the archive system, a building with power and network connections but no equipment is enough', answer: 'Cold site',
      why: 'A cold site is just space, power and connectivity. Equipment must be delivered and set up, which takes days or weeks, but it is cheapest.' },
    { label: 'The order database must not lose a single committed order if the main site is destroyed', answer: 'Synchronous replication',
      why: 'Synchronous replication confirms each write only after both copies have it, so no committed data is lost: an RPO of zero.' },
    { label: 'Before patching a virtual server, the team wants to be able to roll it back to this exact moment in seconds', answer: 'Snapshot',
      why: 'A snapshot captures a system\'s state at one moment and can be reverted to quickly, ideal before a risky change.' },
    { label: 'Ransomware with admin rights must not be able to delete or encrypt the backups', answer: 'Immutable backup',
      why: 'An immutable backup cannot be changed or deleted until its retention period ends, even by an administrator account.' },
    { label: 'The servers must keep running for the few seconds until the generator starts', answer: 'Uninterruptible power supply',
      why: 'A UPS runs on batteries the moment mains power fails, bridging the gap until the generator takes over.' },
  ],
  takeaway: 'Hot, warm and cold sites trade cost against recovery time, synchronous replication gives a zero RPO, snapshots give quick rollback, immutable backups resist ransomware, and a UPS bridges the gap to the generator.',
};

export const BACKUPS: LessonBody = {
  goals: [
    'Say which backup sets a restore needs for full, incremental and differential schedules, and how long it takes',
    'Tell backups from snapshots, replication and journaling, and choose synchronous or asynchronous replication',
    'Keep backups safe with the 3-2-1 rule, offsite and immutable copies, encryption and restore tests',
    'Choose between hot, warm and cold sites, and put the failover and failback steps in order',
    'Explain how clustering, load balancing and power protection keep systems available',
  ],
  blocks: [
    recap('From topic 7: the **RTO** is how long a system may be down, and the **RPO** is how much recent data may be lost. From topic 6: the **recovery** phase restores from a backup you know is clean, and ransomware tries to encrypt the backups too. This topic is how you make sure those backups exist and work.'),
    words(
      ['Full backup', 'A copy of everything selected'],
      ['Incremental backup', 'A copy of what changed since the last backup of any kind'],
      ['Differential backup', 'A copy of everything that changed since the last full backup'],
      ['Archive bit', 'A flag on each file that says "changed since the last backup"'],
      ['Snapshot', 'A record of a system\'s state at one moment, which it can be rolled back to'],
      ['Replication', 'Copying data to a second system continuously, as it changes'],
      ['Journaling', 'Writing each change to a log first, so the changes can be replayed'],
      ['Offsite', 'Stored at a different location from the original'],
      ['Immutable backup', 'A backup that cannot be changed or deleted until its retention period ends'],
      ['Hot, warm, cold site', 'Recovery sites that are ready in minutes, hours to days, or days to weeks'],
      ['Failover', 'Switching work to a standby system or site when the main one fails'],
      ['Failback', 'Moving work back to the main site once it is repaired'],
      ['High availability', 'Designing so that a single failure does not stop the service'],
      ['UPS', 'Uninterruptible power supply: batteries that take over the moment power fails'],
    ),

    h('Full, incremental and differential', { objective: '3.4', keep: 'Full copies everything. Incremental copies changes since the last backup: fast nightly, but a restore needs the full plus every incremental in order. Differential copies changes since the last full: it grows, but a restore needs just two sets.' }),
    p('Copying everything every night takes a long time and a lot of storage, so most schedules take a **full backup** now and then and smaller backups in between. There are two kinds of smaller backup, and the difference is what they compare against.'),
    table(
      ['Type', 'Copies', 'Archive bit', 'Backup', 'Restore needs'],
      [
        ['Full', 'Everything selected', 'Cleared', 'Slowest, largest', 'Just that one backup'],
        ['Incremental', 'Changes since the **last backup of any kind**', 'Cleared', 'Fastest, smallest', 'The last full **plus every incremental since**, in order'],
        ['Differential', 'Changes since the **last full**', 'Left set', 'Grows each day until the next full', 'The last full **plus the latest differential**'],
      ],
      { caption: 'Backup types' },
    ),
    p('The **archive bit** explains the difference. Changing a file sets its bit. A full or an incremental backup clears it, so the next incremental only sees files changed since then. A differential leaves it set, so each differential sees everything changed since the last full.'),
    trap('Incrementals are fastest to **back up** but slowest to **restore**. Differentials are the reverse. And with incrementals, one missing or damaged set in the chain means every later one cannot be applied.'),

    h('Try it: a week of backups', { objective: '3.4', keep: 'The restore point is the last good backup, so nightly backups can lose up to a day of data whatever the type. Backup type changes restore time and storage, not data loss. Back up more often to meet a tighter RPO.' }),
    p('A file server fails in the middle of the afternoon. Try each strategy and each day, and compare how many sets the restore needs, how long it takes, and what each strategy stores.'),
    backupWeek(),
    exam('Notice what never changes: **data lost**. With one backup a night, a failure at 15:00 loses everything since 23:00 whatever the backup type. Backup type affects the **RTO** (restore time); only backing up more often, or replicating, improves the **RPO**.'),

    h('Snapshots, replication and journaling', { objective: '3.4', keep: 'A snapshot captures one moment for quick rollback. Replication keeps a live copy: synchronous loses nothing but needs short distances, asynchronous allows distance but loses the last few changes. Replication copies mistakes too, so it never replaces backups.' }),
    table(
      ['Method', 'What it does', 'Best for', 'Watch out'],
      [
        ['Snapshot', 'Records a system\'s state at one moment, usually a virtual machine or storage volume', 'Rolling back quickly, for example before a patch', 'Usually stored on the same system, so not a backup on its own'],
        ['Synchronous replication', 'Each write is confirmed only once both copies have it', 'Data that must never be lost: an RPO of zero', 'Every write waits for the far side, so the sites must be close'],
        ['Asynchronous replication', 'Writes are confirmed at once and copied to the second site shortly after', 'Long distances, such as another region', 'The last seconds or minutes of changes can be lost'],
        ['Journaling', 'Each change is written to a log (journal) before it is applied', 'Replaying changes after a crash, or since the last backup', 'The journal must be kept safe too'],
      ],
      { caption: 'Copies that are not traditional backups' },
    ),
    trap('Replication copies **everything**, including deletions, corruption and ransomware encryption, within seconds. It protects against losing a site, not against losing data. You still need backups you can go back in time with.'),

    h('Keeping backups safe', { objective: '3.4', keep: 'Follow 3-2-1: three copies, on two kinds of media, one offsite. Make at least one copy immutable or offline so ransomware cannot reach it, encrypt backups, and test restores regularly. An untested backup may not work.' }),
    list(
      '**The 3-2-1 rule**: keep at least **3** copies of the data, on **2** different kinds of storage, with **1** of them offsite.',
      '**Onsite and offsite**: onsite copies restore quickly; offsite copies (another building, or the cloud) survive a fire or flood at the main site.',
      '**Immutable or offline**: at least one copy that cannot be changed (immutable storage) or cannot be reached from the network (offline, sometimes called air-gapped), so ransomware cannot encrypt it.',
      '**Encryption**: backups hold all your data in one place. Encrypt them, and keep the keys somewhere you can reach when the main site is gone.',
      '**Frequency**: set by the RPO. An RPO of one hour needs a backup, log backup or replication at least every hour.',
      '**Recovery testing**: restore backups regularly to prove they work and to time the restore against the RTO.',
    ),
    analogy('A spare house key is only useful if it is somewhere else (offsite), the burglar cannot reach it (offline), and you have checked it actually opens the door (tested).'),

    h('Recovery sites and high availability', { objective: '3.4', keep: 'Hot sites take minutes and cost most; warm sites need data restored, hours to days; cold sites are empty space, days to weeks. Spread sites apart. Clustering and load balancing survive a failure; a UPS bridges to the generator.' }),
    table(
      ['Site', 'Has', 'Ready in', 'Cost'],
      [
        ['Hot', 'Equipment running, data kept current (often by replication)', 'Minutes', 'Highest'],
        ['Warm', 'Equipment installed, but data must be restored and systems started', 'Hours to days', 'Medium'],
        ['Cold', 'Space, power and network connections only', 'Days to weeks', 'Lowest'],
      ],
      { caption: 'Recovery sites' },
    ),
    p('**Geographic dispersion** puts the recovery site far enough away that the same flood, storm or power cut cannot hit both. A cloud provider can act as a recovery site too, paying for capacity only when it is used.'),
    p('**High availability (HA)** aims to keep the service running through a failure, without needing a recovery site at all:'),
    list(
      '**Clustering**: several servers act as one. In **active-active** all of them share the work; in **active-passive** a standby takes over when the active one fails.',
      '**Load balancing**: spreads requests across several servers and stops sending to one that fails.',
      '**Platform diversity** and **multi-cloud**: using different operating systems or cloud providers, so one flaw or one provider\'s outage cannot take everything down.',
      '**Power**: a **UPS** runs on batteries the instant power fails, long enough for a **generator** to start, which then runs for as long as it has fuel. Power distribution units (PDUs) share power out to the racks.',
    ),
    tip('**Capacity planning** makes sure there will be enough people, technology and infrastructure when demand grows, or when a recovery site has to carry the whole load. **Continuity of operations planning (COOP)** covers keeping the essential functions going during the disruption.'),

    h('Failover, failback and testing the plan', { objective: '3.4', keep: 'Failover: declare the disaster, bring up data first, then applications, test, then switch users over. Failback: copy the changes made at the recovery site back to the repaired primary, then switch back in a planned window. Test with tabletops, failover tests, simulations and parallel processing.' }),
    {
      type: 'flow', direction: 'down', caption: 'Failing over to a recovery site and back',
      nodes: [
        { label: 'Declare', sub: 'The authorized person declares a disaster, as the plan says', tone: 'warn' },
        { label: 'Data first', sub: 'Bring the databases up at the recovery site', tone: 'accent' },
        { label: 'Then applications', sub: 'Start the servers and point them at the data', tone: 'accent' },
        { label: 'Test, then switch', sub: 'Check it works, then move users and DNS over', tone: 'safe' },
        { label: 'Fail back', sub: 'Copy new data back to the repaired primary, switch back in a planned window', tone: 'neutral' },
      ],
    },
    table(
      ['Test', 'What happens'],
      [
        ['Tabletop exercise', 'The team talks through a disaster scenario. No systems are touched'],
        ['Failover test', 'Systems are actually switched to the backup system or site'],
        ['Simulation', 'A realistic disaster is acted out to see how people and systems cope'],
        ['Parallel processing', 'The recovery site runs the same work alongside the main site, and the results are compared'],
      ],
      { caption: 'Ways to test a recovery plan' },
    ),

    h('Practice: pick the protection', { objective: '3.4', keep: 'Match the requirement to the tool: recovery time picks the site type, zero data loss needs synchronous replication, quick rollback is a snapshot, ransomware calls for immutable or offline backups, and power cuts need a UPS then a generator.' }),
    pbq('Pick the protection', PICK_THE_PROTECTION, { intro: 'Seven requirements from the retailer\'s review. Each option is used once.' }),
    examPbqs('backups', 'These come from the practice exam: a restore with incrementals against an RTO and RPO, and the steps of failing over to a warm site and back. They load when you press Start.'),
  ],
  check: [
    mcq('Backups are a full on Sunday and incrementals Monday to Saturday. The server fails on Thursday afternoon. Which sets does the restore need?',
      'Sunday\'s full, then the Monday, Tuesday and Wednesday incrementals, in order', ['Sunday\'s full and Wednesday\'s incremental', 'Wednesday\'s incremental only', 'Sunday\'s full only'],
      'Each incremental holds only the changes since the previous backup, so the restore needs the full and every incremental since, applied in order.'),
    mcq('A company replicates its database to another site, so it decides it no longer needs backups. What is the main flaw?',
      'Replication copies deletions, corruption and ransomware encryption to the second copy too',
      ['Replication is slower than backup', 'Replication cannot cross long distances', 'Replicated data cannot be encrypted'],
      'Replication protects against losing a site, but it faithfully copies mistakes and attacks within seconds. Backups let you go back to a point before the damage.'),
    mcq('Which recovery site has equipment installed but needs data restored before it can take over, usually within hours to days?',
      'Warm site', ['Hot site', 'Cold site', 'Mobile site'],
      'A warm site sits between hot (current data, minutes) and cold (empty space, days to weeks).'),
    mcq('Which backup approach best protects against ransomware that has stolen an administrator account?',
      'An immutable or offline copy that cannot be changed or reached from the network',
      ['More frequent incremental backups to the same server', 'Synchronous replication to a second site', 'Snapshots stored on the same storage array'],
      'With admin rights, ransomware can reach and encrypt online backups, replicas and snapshots. An immutable or offline copy is out of its reach.'),
  ],
};
