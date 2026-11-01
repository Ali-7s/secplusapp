import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, cvssCalc, exam, examPbqs, h, list, mcq, p, pbq, recap, steps, table, tip, trap, words } from '../dsl';

const PRIORITIZE: MatchQuestion = {
  id: 'topic-vulnerabilities-prioritize', domain: 4, objective: '4.3', kind: 'match',
  scenario: 'This week\'s scans produced the findings below. The company\'s policy: anything exposed and actively exploited is fixed within 24 hours, other confirmed findings within 30 days, and a risk the business accepts needs a documented exception with an owner and an end date.',
  blocks: [
    { kind: 'table', title: 'Scan findings', columns: ['ID', 'Finding', 'CVSS', 'Internet-facing', 'Known exploited'], rows: [
      ['F1', 'Remote code execution in the VPN gateway', '9.8', 'Yes', 'Yes'],
      ['F2', 'Script injection on the public customer portal', '6.1', 'Yes', 'Yes'],
      ['F3', 'Privilege escalation on the internal file server', '7.8', 'No', 'No'],
      ['F4', 'Old SSH version reported from the banner of a web server; the package changelog shows the vendor backported the fix', '8.1', 'Yes', 'No'],
      ['F5', 'Remote code execution on an isolated lab machine with no data, being retired in two weeks', '9.1', 'No', 'No'],
    ] },
  ],
  stem: 'Choose the right response to each finding, then name the scanning problem in the last item.',
  choices: ['Fix within 24 hours', 'Fix within 30 days', 'Accept with a documented exception', 'False positive: close it with evidence'],
  prompts: [
    { label: 'F1: the VPN gateway', answer: 'Fix within 24 hours',
      why: 'Critical, reachable from the internet and already being exploited: this is the most urgent finding on the list.' },
    { label: 'F2: the customer portal', answer: 'Fix within 24 hours',
      why: 'Only a medium score, but it is exposed and attackers are using it now, so it goes ahead of higher-scored internal findings.' },
    { label: 'F3: the internal file server', answer: 'Fix within 30 days',
      why: 'High severity but internal and not known to be exploited, so it is patched in the normal cycle.' },
    { label: 'F4: the web server\'s SSH banner', answer: 'False positive: close it with evidence',
      why: 'The scanner judged by the version string, but the fix was backported. Record the changelog as evidence so it is not reopened.' },
    { label: 'F5: the lab machine', answer: 'Accept with a documented exception',
      why: 'It is isolated, holds no data and is about to be retired, so fixing it costs more than the risk. Document the exception with an end date.' },
    { label: 'A non-credentialed scan missed a vulnerable library inside an application that a credentialed scan later found. What was the first result?',
      choices: ['A false negative', 'A false positive', 'A true positive', 'A true negative'], answer: 'A false negative',
      why: 'The flaw was there and the scan said nothing: a false negative. Credentialed scans sign in and see installed software, so they miss far less.' },
  ],
  takeaway: 'Severity is only the start: exposure, active exploitation and the value of the asset decide the order, false positives are closed with evidence, and accepted risks get a documented exception.',
};

export const VULNERABILITIES: LessonBody = {
  goals: [
    'Name the ways vulnerabilities are found: scans, code analysis, penetration tests, bug bounties and threat feeds',
    'Score a vulnerability with CVSS 3.1 and read its vector string',
    'Prioritize findings using exposure, exploitation and asset value, not the score alone',
    'Choose a response, from patching to a documented exception, and validate that it worked',
  ],
  blocks: [
    recap('From topic 5: risk is likelihood times impact, and you can mitigate, transfer, avoid or accept it. From topic 10: patching on a schedule is part of hardening. Vulnerability management is the loop that finds what needs patching and decides what comes first.'),
    words(
      ['Vulnerability', 'A weakness that could be exploited, such as a software bug or a misconfiguration'],
      ['Exploit', 'Code or a technique that takes advantage of a vulnerability'],
      ['CVE', 'Common Vulnerabilities and Exposures: the public ID for a known flaw, such as CVE-2021-44228'],
      ['CVSS', 'Common Vulnerability Scoring System: a 0 to 10 severity score'],
      ['NVD', 'National Vulnerability Database: the US database of CVEs with their scores'],
      ['Credentialed scan', 'A scan that signs in to each system, so it can see installed software and settings'],
      ['False positive', 'The scanner reports a flaw that is not really there'],
      ['False negative', 'The scanner misses a flaw that is there'],
      ['Exception', 'A documented decision to accept a vulnerability for a time, with an owner'],
      ['Zero-day', 'A flaw attackers know about before a fix exists'],
    ),

    h('Finding vulnerabilities', { objective: '4.3', keep: 'Vulnerability scans, credentialed or not, find known flaws; static and dynamic analysis test code; penetration tests and bug bounties use people; threat feeds and the CVE list say what is new and being exploited.' }),
    table(
      ['Method', 'What it does', 'Good to know'],
      [
        ['Vulnerability scan', 'Checks systems against a database of known flaws', 'Credentialed scans sign in and see far more; non-credentialed show the attacker\'s view'],
        ['Static analysis (SAST)', 'Reads source code without running it', 'Finds bugs early, but reports many false positives'],
        ['Dynamic analysis (DAST)', 'Tests the running application from outside', 'Finds what is really reachable'],
        ['Package monitoring', 'Tracks third-party libraries and their CVEs', 'Most code in an app was written by someone else'],
        ['Penetration test', 'People try to exploit the flaws, within agreed rules', 'Proves impact, not just presence'],
        ['Bug bounty', 'Outside researchers are paid for reporting flaws', 'Pairs with a responsible disclosure policy'],
        ['Threat feeds and OSINT', 'News of new flaws and active exploitation', 'Known exploited lists say what to fix first'],
      ],
      { caption: 'Ways to find vulnerabilities' },
    ),
    trap('A scan that reports nothing has not proved there is nothing: **false negatives** happen, especially with non-credentialed scans. A scan that reports something may be a **false positive**, so confirm before you fix.'),

    h('The vulnerability management loop', { objective: '4.3', keep: 'Identify, analyze (confirm and prioritize), respond (patch, isolate, add a compensating control, insure, or document an exception), validate by rescanning, then report. Then start again.' }),
    steps(
      '**Identify**: scans, tests and feeds produce findings.',
      '**Analyze**: confirm each finding is real, then **prioritize** it with its CVSS score, its exposure, whether it is being exploited, the value of the asset and the organization\'s risk tolerance.',
      '**Respond**: **patch** where possible; otherwise reduce the risk with **segmentation** or another **compensating control**, transfer it with **insurance**, or record an **exception** that accepts it for a set time.',
      '**Validate**: **rescan** to prove the fix worked everywhere, and confirm with an audit or manual check where needed.',
      '**Report**: share what was found, fixed and accepted, and how long fixes took, so trends are visible.',
    ),
    analogy('A building inspection: the inspector lists every crack (identify), an engineer decides which are structural (analyze), the builders repair or brace them (respond), the inspector comes back to check (validate), and the owner gets the report.'),

    h('CVSS: scoring how bad a flaw is', { objective: '4.3', keep: 'CVSS 3.1 scores a flaw from 0 to 10 from eight base metrics: how it is reached, how hard it is, privileges, user interaction, scope, and impact on confidentiality, integrity and availability. 9.0 and above is critical.' }),
    p('A **CVSS base score** describes a flaw the same way for everyone. The **exploitability** metrics say how easy the attack is; the **impact** metrics say how much damage it does; **scope** says whether it reaches beyond the vulnerable component. The result comes with a **vector string** that records every choice, such as `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` (9.8, critical).'),
    cvssCalc(),
    exam('Know the bands: **0.1 to 3.9 low, 4.0 to 6.9 medium, 7.0 to 8.9 high, 9.0 to 10.0 critical**. Network vector, low complexity, no privileges and no user interaction push a score up.'),

    h('Try it: prioritize this week\'s findings', { objective: '4.3', keep: 'Order findings by exposure and active exploitation first, then severity and asset value. Close false positives with evidence, and accept low-value risks only with a documented exception.' }),
    pbq('Try it: prioritize this week\'s findings', PRIORITIZE),
    tip('Lists of **known exploited vulnerabilities** (CISA publishes one) are among the best priority signals: a medium flaw being used today beats a critical one nobody has exploited.'),

    h('Practice: the full process', { objective: '4.3', keep: 'Identify, confirm, prioritize, remediate through change management, rescan to validate, and report.' }),
    examPbqs('vulnerabilities', 'This comes from the practice exam: put the steps for a critical, actively exploited finding in the right order. It loads when you press Start.'),
  ],
  check: [
    mcq('A scanner reports a critical flaw, but the vendor\'s changelog shows the fix was backported into the installed package. What is the finding?',
      'A false positive', ['A false negative', 'A zero-day', 'A compensating control'],
      'The scanner reported a flaw that is not present, a false positive. Record the evidence and close it.'),
    mcq('Which finding should be fixed first?',
      'CVSS 6.5, internet-facing and on a known exploited list', ['CVSS 9.0 on an isolated test machine', 'CVSS 7.2 on an internal server, not known to be exploited', 'CVSS 8.0 on a system already scheduled for retirement'],
      'Exposure and active exploitation make the medium flaw the most likely to be used against you right now.'),
    mcq('A legacy system cannot be patched. Which response reduces the risk without a patch?',
      'Move it to an isolated network segment with tightly limited access', ['Rescan it every day', 'Lower its CVSS score', 'Delete the finding from the report'],
      'Segmentation is a compensating control: it limits who can reach the flaw. Rescanning only confirms the flaw is still there.'),
    mcq('What does AV:N mean in a CVSS vector?',
      'The flaw can be exploited over the network', ['No attack vector exists', 'No privileges are needed', 'There is no impact on availability'],
      'AV is attack vector, and N is Network: the most exposed value, reachable from anywhere that can connect.'),
  ],
};
