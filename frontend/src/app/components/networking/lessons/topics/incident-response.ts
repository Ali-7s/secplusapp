import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, decide, exam, examPbqs, h, list, mcq, p, pbq, recap, step, table, tip, trap, words } from '../dsl';

const FORENSICS_TERMS: MatchQuestion = {
  id: 'topic-forensics-terms', domain: 4, objective: '4.8', kind: 'match',
  scenario: 'After the ransomware incident, the firm\'s investigators and lawyers describe what they did.',
  stem: 'Name the practice behind each action.',
  choices: ['Chain of custody', 'Legal hold', 'Write blocker', 'Hashing the image', 'e-Discovery', 'Order of volatility', 'Root cause analysis'],
  prompts: [
    { label: 'Every person who handled the seized laptop signs and dates a form, with what they did and why', answer: 'Chain of custody', why: 'The chain of custody records every hand-over, so nobody can claim the evidence was swapped or tampered with in between.' },
    { label: 'Legal tells IT to stop the automatic deletion of a manager\'s mailbox because a lawsuit is expected', answer: 'Legal hold', why: 'A legal hold suspends normal retention and deletion for anything that may be relevant to expected litigation.' },
    { label: 'The suspect drive is connected to the forensic workstation through a device that makes changing it impossible', answer: 'Write blocker', why: 'A write blocker lets the drive be read but blocks every write, so taking the image cannot alter the original.' },
    { label: 'The team proves in court that the image analyzed today is identical to the one made last month', answer: 'Hashing the image', why: 'A hash taken when the image was made, and matched again now, proves not one bit has changed.' },
    { label: 'Lawyers search email and file shares for every document about the contract, to hand to the other side', answer: 'e-Discovery', why: 'e-Discovery is finding, preserving and producing electronic records for a legal case.' },
    { label: 'The responder captures RAM before pulling the power cable', answer: 'Order of volatility', why: 'Memory vanishes at power-off while the disk does not, so the most volatile evidence is collected first.' },
    { label: 'The team keeps asking "why?" until it finds that the gateway went unpatched because nobody owned it', answer: 'Root cause analysis', why: 'Root cause analysis looks past the symptom (the malware) to the underlying reason it could happen, so the fix prevents a repeat.' },
  ],
  takeaway: 'Chain of custody tracks who held the evidence, a write blocker and a hash keep it unchanged and prove it, order of volatility sets what to grab first, legal hold and e-Discovery serve the lawyers, and root cause analysis finds the real reason.',
};

export const INCIDENT_RESPONSE: LessonBody = {
  goals: [
    'Put the incident response phases in order and say what happens in each',
    'Make the right call at each stage of a ransomware incident, and explain why the alternatives are worse',
    'Collect evidence in order of volatility, and keep it admissible with write blockers, hashes and a chain of custody',
    'Tell tabletop exercises, simulations and threat hunting apart',
    'Use legal hold, e-Discovery and root cause analysis correctly',
  ],
  blocks: [
    recap('From topic 1: a **hash** is a fingerprint that changes completely if even one bit of the data changes. From Networking lesson 9: security devices such as an **IDS** and the **SIEM** (the central log collector) raise alerts. **EDR** is security software on each computer that watches for and can block attacks.'),
    words(
      ['Event', 'Anything that happens on a system: a sign-in, a file opened. Most are harmless'],
      ['Incident', 'An event that harms or threatens security: malware, a breach, stolen data'],
      ['Indicator of compromise (IoC)', 'A clue an attack happened: an odd file, a known-bad IP address, a strange account'],
      ['CSIRT', 'Computer security incident response team: the people who handle incidents'],
      ['Playbook', 'Step-by-step instructions for one kind of incident, such as ransomware or phishing'],
      ['Containment', 'Stopping an incident from spreading or doing more damage'],
      ['Isolation', 'Cutting a device off from the network while leaving it running'],
      ['Eradication', 'Removing the cause: the malware, the attacker\'s access and the hole they used'],
      ['Recovery', 'Bringing systems back to normal from known-good copies'],
      ['Root cause analysis', 'Working out the underlying reason an incident could happen'],
      ['Order of volatility', 'Collecting the evidence that disappears fastest first'],
      ['Forensic image', 'An exact bit-for-bit copy of a disk or memory, made for investigation'],
      ['Write blocker', 'A device that lets a drive be read but never written to'],
      ['Chain of custody', 'A record of everyone who handled evidence, when and why'],
      ['Legal hold', 'An instruction to keep data that may matter in a lawsuit, stopping normal deletion'],
    ),

    h('Events, incidents and the response process', { objective: '4.8', keep: 'An incident is an event that harms or threatens security. Respond in order: preparation, detection, analysis, containment, eradication, recovery, lessons learned. Contain before you clean up, and fix the cause before you restore.' }),
    p('Systems produce millions of **events** a day: sign-ins, file reads, connections. A few raise **alerts**, and most alerts turn out to be harmless. An **incident** is an event that actually harms or threatens security. Incident response is the planned way an organization handles one, so that people under pressure do the right things in the right order.'),
    {
      type: 'flow', direction: 'down', caption: 'The incident response process. Lessons learned feeds back into preparation.',
      nodes: [
        { label: 'Preparation', sub: 'Plan, team, tools and practice, before anything happens', tone: 'neutral' },
        { label: 'Detection', sub: 'Something is noticed: an alert, a user report, a threat feed', tone: 'accent' },
        { label: 'Analysis', sub: 'Is it real? What is affected, how badly, since when?', tone: 'accent' },
        { label: 'Containment', sub: 'Stop the spread, keep the evidence', tone: 'warn' },
        { label: 'Eradication', sub: 'Remove the cause and close the way in', tone: 'danger' },
        { label: 'Recovery', sub: 'Restore from clean copies and watch closely', tone: 'safe' },
        { label: 'Lessons learned', sub: 'What happened, what to change', tone: 'neutral' },
      ],
    },
    analogy('It is how firefighters work. They train before any fire (preparation), get the call (detection), size up the building (analysis), stop it spreading to the next house (containment), put it out (eradication), let people back in once it is safe (recovery), and investigate what started it (lessons learned).'),
    trap('Two orders catch people out. **Containment comes before eradication**: stop the spread first, then clean up. And **eradication comes before recovery**: if you restore before closing the hole the attacker used, they walk straight back in.'),

    h('Preparation, practice and threat hunting', { objective: '4.8', keep: 'Preparation means a written plan, a trained team, playbooks and ready tools. Practice it: a tabletop exercise talks a scenario through, a simulation acts it out. Threat hunting searches for attackers no alert has caught.' }),
    list(
      'An **incident response plan**: who is on the team, who decides what, and who must be told (management, legal, regulators, customers, possibly law enforcement), with contact details that work even if email is down.',
      'A **CSIRT** (computer security incident response team) with clear roles, plus outside help arranged in advance where needed.',
      '**Playbooks** for common incidents (ransomware, phishing, a lost laptop), and **runbooks**, the detailed technical steps, often automated.',
      'Tools ready before they are needed: forensic laptops, write blockers, clean storage, offline backups, and logging turned on everywhere.',
    ),
    table(
      ['Way to practice', 'What happens', 'Good for'],
      [
        ['Tabletop exercise', 'The team sits around a table and talks through a scenario step by step. No systems are touched', 'Cheap and safe. Finds gaps in the plan and in who decides what'],
        ['Simulation', 'A realistic incident is acted out on real or test systems, with the team responding as they would for real', 'Tests tools, people and timing under pressure'],
      ],
      { caption: 'Testing the plan' },
    ),
    p('**Threat hunting** turns detection around. Instead of waiting for alerts, hunters start from an idea ("an attacker who got in through phishing would be using PowerShell to reach file servers at night") and search the logs and endpoints for signs of it. It finds attackers who slipped past the automatic tools.'),

    h('Containment, eradication and recovery', { objective: '4.8', keep: 'Contain to stop the spread while keeping evidence: isolate a device rather than power it off. Eradicate the cause and the way in. Recover from clean backups and monitor closely. Root cause analysis asks why it happened, not only what.' }),
    table(
      ['Phase', 'Typical actions', 'Watch out'],
      [
        ['Containment', 'Isolate devices from the network (EDR can do this with one click), move them to a quarantine network, disable compromised accounts, block bad IP addresses', 'Do not power off: memory holds evidence such as running processes, connections and sometimes encryption keys'],
        ['Eradication', 'Remove malware and anything it set up to restart itself, close the entry point (patch, fix the configuration), reset stolen credentials', 'Missing the way in means the attacker comes back'],
        ['Recovery', 'Restore from known-good backups or rebuild from a clean baseline, then return systems to service gradually, with extra monitoring', 'Check backups are clean: an infected backup brings the problem back'],
        ['Lessons learned', 'A review soon after: timeline, what worked, what did not, what to change. Update the plan, playbooks and training', 'Blame-free, or people hide mistakes next time'],
      ],
    ),
    p('**Root cause analysis** keeps asking "why?" until it reaches something you can fix. The malware got in because someone opened an attachment; why did that work? Because macros were allowed; why? Because nobody owned the policy. Fixing only the first answer leaves the real cause in place.'),

    h('Work through an incident', { objective: '4.8', keep: 'At each moment, ask which phase you are in. Analyze before acting, isolate before cleaning, preserve evidence before eradicating, close the way in before restoring, and finish with lessons learned.' }),
    p('Here is a ransomware incident at a small law firm, one decision at a time. Pick what you would do. A weaker choice explains what goes wrong; then try again.'),
    decide('Ransomware at a law firm', [
      step(
        { phase: 'Detection and analysis', situation: '**Monday, 08:40.** Three people call the help desk: files on the shared drive have a new `.lkd` extension and will not open. The EDR console shows an alert on **FIN-PC-07**: "mass file rename".', question: 'What do you do first?' },
        { text: 'Confirm and scope it: check the EDR alert, which accounts and computers are writing to the share, and when it started', feedback: 'Analysis comes before action. In a few minutes you learn what is affected, which tells you what to contain. Acting blind risks missing an infected machine or disrupting the whole firm for nothing.' },
        { text: 'Restore the shared drive from last night\'s backup straight away', feedback: 'Whatever is encrypting the share is still running, so restored files would be encrypted again. It also overwrites evidence of what happened.' },
        { text: 'Switch off every computer in the office', feedback: 'You do not yet know which machines are involved, and switching off destroys the memory evidence on the infected ones. It also stops the whole firm working.' },
        { text: 'Email all staff that the firm has ransomware', feedback: 'Communication follows the plan, through the right people and channels, once you know the facts. Email may itself be compromised, and a panicked message helps nobody.' },
      ),
      step(
        { phase: 'Containment', situation: 'The share is being encrypted from **FIN-PC-07** using the account of **Dana** in finance. Two more PCs, **FIN-PC-03** and **FIN-PC-11**, have just started the same process.', question: 'What now?' },
        { text: 'Isolate the three PCs from the network with the EDR, and disable Dana\'s account', feedback: 'Isolation stops the spread at once while the PCs keep running, so their memory evidence survives. Disabling the account stops the attacker reusing it elsewhere.' },
        { text: 'Shut the three PCs down to stop the encryption', feedback: 'Shutting down does stop the encryption, but so does isolation, and powering off destroys running processes, network connections and possibly the encryption key in memory.' },
        { text: 'Wipe and reinstall the three PCs right away', feedback: 'That is eradication, and too early: it destroys the evidence of how the attacker got in, so you could miss the real entry point and be hit again.' },
        { text: 'Leave them connected and watch what the attacker does next', feedback: 'Watching an attacker can be useful, but not while they are encrypting the firm\'s files. Containment comes first.' },
      ),
      step(
        { phase: 'Evidence', situation: 'The PCs are isolated and the share is safe. The firm\'s insurer, and perhaps the police, will want to know exactly what happened.', question: 'How do you handle the three PCs?' },
        { text: 'Capture memory first, then image each disk through a write blocker, hash every image, and record the chain of custody', feedback: 'Most volatile first (memory), then a bit-for-bit copy that cannot alter the original, a hash to prove it never changes, and a record of who handled what. That keeps the evidence usable in court.' },
        { text: 'Copy the encrypted files and the ransom note to a USB stick for analysis', feedback: 'A partial copy made with ordinary tools is not forensically sound: it misses memory and hidden data, may change file times, and has no hash or custody record.' },
        { text: 'Run a full antivirus scan on each PC to see what it finds', feedback: 'Scanning (and auto-cleaning) changes the very evidence you need. Investigators work on images, not on the original disks.' },
        { text: 'Ask Dana to sign in and show you what she clicked', feedback: 'Talking to Dana is useful, but signing in on the infected PC changes it, and her account is disabled for good reason. Interview her separately.' },
      ),
      step(
        { phase: 'Eradication', situation: 'The forensic images show Dana opened a phishing attachment. The malware added a **scheduled task** to restart itself, and reached the other PCs through an **unpatched remote desktop gateway**.', question: 'What does eradication include?' },
        { text: 'Remove the malware and its scheduled task, patch the remote desktop gateway, and reset the passwords of affected accounts', feedback: 'Eradication removes the cause, how it persists, and the way it spread. Leaving any one of these lets the attacker back in.' },
        { text: 'Delete the phishing email from every mailbox, which removes the cause', feedback: 'That stops the next person opening it, but the malware already running, its scheduled task and the unpatched gateway would all still be there.' },
        { text: 'Restore everything from backup now; that removes the malware', feedback: 'Restoring is recovery, and the gateway is still unpatched. The attacker, or the next one, would come straight back in.' },
        { text: 'Block Dana\'s email address so it cannot happen again', feedback: 'Dana was the victim, not the cause. Blocking her fixes nothing about the attachment, the malware or the gateway.' },
      ),
      step(
        { phase: 'Recovery', situation: 'The cause is gone and the gateway is patched. The shared drive is still full of encrypted files. There are nightly online backups and a weekly offline backup.', question: 'How do you bring the files back?' },
        { text: 'Restore from the most recent backup taken before the infection that you can verify is clean (here, the offline one), check the files, and monitor closely', feedback: 'A verified clean, offline backup cannot have been touched by the malware. Restoring gradually with extra monitoring catches anything that was missed.' },
        { text: 'Pay the ransom, because it is the fastest way to get the files back', feedback: 'There is no guarantee the key works, payment funds the attackers and marks the firm as a payer, and it may even be illegal. With clean backups there is no need.' },
        { text: 'Restore last night\'s online backup because it is the newest', feedback: 'Online backups reachable from the network may have been encrypted too, or taken after the malware arrived. Newest is not the same as clean.' },
        { text: 'Leave the share as it is and ask people to recreate their documents', feedback: 'Backups exist for exactly this. Recovery means getting back to normal operation, not starting over.' },
      ),
      step(
        { phase: 'Lessons learned', situation: 'A week later everything is running normally and the insurer has its report.', question: 'What happens now?' },
        { text: 'Hold a blame-free lessons-learned review, then update the ransomware playbook, patch process and phishing training', feedback: 'The review turns this incident into better preparation: who owns patching the gateway, blocking macros in email attachments, faster isolation next time.' },
        { text: 'Close the ticket: the incident is over', feedback: 'Without a review the same gaps stay open. Lessons learned is a phase of its own, not an optional extra.' },
        { text: 'Discipline Dana for opening the attachment', feedback: 'Blame makes people hide mistakes. The root causes were an unpatched gateway and attachments allowed to run; any one person could have clicked.' },
        { text: 'Buy a new antivirus product, since the current one failed', feedback: 'Maybe, but deciding before the review is guessing. The review finds the real causes, and the EDR actually did spot the attack.' },
      ),
    ], 'Six decisions, one per phase. Your choices are saved, so you can stop and come back.'),

    h('Collecting evidence: digital forensics', { objective: '4.8', keep: 'Collect the most volatile evidence first: CPU and memory, then temporary files, the disk, remote logs, archives. Image disks through a write blocker, hash every copy, and record every hand-over in the chain of custody.' }),
    p('**Digital forensics** is collecting and examining evidence so that it stands up later, in court or with an insurer. Some evidence disappears in seconds and some lasts for years, so the **order of volatility** sets what to grab first:'),
    table(
      ['Order', 'Evidence', 'Why it goes first or last'],
      [
        ['1', 'CPU registers and cache', 'Change with every instruction'],
        ['2', 'Memory (RAM): running processes, network connections, the ARP cache, the routing table', 'Gone at power-off'],
        ['3', 'Temporary files and swap space', 'Overwritten or cleared at restart'],
        ['4', 'Disk', 'Survives power-off, so it can wait'],
        ['5', 'Remote logs and monitoring data (SIEM)', 'Safe from the device, but rotated out on a schedule'],
        ['6', 'Archives and backups', 'Change least of all'],
      ],
      { caption: 'Order of volatility, most volatile first' },
    ),
    list(
      '**Acquisition**: make a **forensic image**, an exact bit-for-bit copy, through a **write blocker** so the original cannot change. Investigators then work only on copies of the image.',
      '**Preservation and integrity**: **hash** the original and the image when the image is made. Matching hashes later prove nothing changed.',
      '**Chain of custody**: a record of every person who held the evidence, when, where and why. A gap lets the other side argue it was tampered with.',
      '**Legal hold**: when a lawsuit is expected, legal tells IT to keep everything that may be relevant and to suspend normal deletion.',
      '**e-Discovery**: finding, preserving and handing over electronic records (email, files, chats) for a legal case.',
      '**Reporting**: a clear, factual write-up of what was found and how, which someone else could repeat.',
    ),
    exam('"What should the investigator do **first**?" with a running machine: capture **memory** (order of volatility). "How can the investigator **prove** the image was not altered?": compare **hashes**. "How can the company show who handled the drive?": the **chain of custody**.'),
    tip('Time stamps differ between devices and time zones. Investigators record each device\'s clock offset and work in one time zone (usually UTC) when building the timeline.'),

    h('Practice: forensics and the response order', { objective: '4.8', keep: 'Chain of custody tracks who held evidence, a write blocker and a hash keep it unchanged and prove it, legal hold and e-Discovery serve the lawyers, and root cause analysis finds the real reason.' }),
    pbq('Name the practice', FORENSICS_TERMS, { intro: 'Seven actions from the firm\'s investigation. Each practice is used once.' }),
    examPbqs('incident-response', 'These come from the practice exam: put evidence sources in order of volatility, and put a real incident\'s response actions in order. They load when you press Start.'),
  ],
  check: [
    mcq('Which incident response phase comes directly after containment?',
      'Eradication', ['Recovery', 'Lessons learned', 'Analysis'],
      'Contain, then eradicate the cause, then recover. Recovering before eradication would let the attacker straight back in.'),
    mcq('A server is believed to be compromised. Why should responders isolate it from the network instead of powering it off?',
      'Powering off destroys memory evidence such as running processes and network connections',
      ['Isolation removes the malware automatically', 'A powered-off server cannot be imaged', 'Isolated servers can keep serving customers safely'],
      'Isolation stops the spread just as well while keeping volatile evidence in memory. A powered-off disk can still be imaged, but the memory is gone for good.'),
    mcq('A lawsuit is expected, and the legal team tells IT to keep all of a manager\'s email, including messages that would normally be deleted automatically. What is this called?',
      'Legal hold', ['Chain of custody', 'e-Discovery', 'Data retention policy'],
      'A legal hold suspends normal deletion for data that may matter in litigation. e-Discovery is the later search and handover, and the chain of custody tracks who handled evidence.'),
    mcq('The incident team sits around a table and talks through how it would handle a ransomware attack, without touching any systems. What is this?',
      'A tabletop exercise', ['A simulation', 'A penetration test', 'Threat hunting'],
      'Talking a scenario through without touching systems is a tabletop exercise. A simulation acts the incident out on systems, and threat hunting searches real data for hidden attackers.'),
  ],
};
