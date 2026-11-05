import { LessonBody } from '../../networking.model';
import { analogy, controlSorter, exam, examPbqs, h, list, mcq, p, recap, table, tip, trap, words } from '../dsl';

export const CONTROLS: LessonBody = {
  goals: [
    'Sort any security control by category: technical, managerial, operational or physical',
    'Sort it by type: preventive, deterrent, detective, corrective, compensating or directive',
    'Follow a request through a zero trust architecture: subject, policy engine, policy administrator and enforcement point',
    'Tell the control plane from the data plane, and explain adaptive identity and threat scope reduction',
  ],
  blocks: [
    recap('From Networking lesson 9: a firewall **allows or blocks** traffic by rules, and an IDS **detects** while an IPS **prevents**. From topic 7: least privilege and attribute-based policies. This topic names the kinds of control those are, then shows how zero trust checks every request instead of trusting the network.'),
    words(
      ['Security control', 'Anything that reduces a risk: a device, a setting, a policy, a person\'s job, a lock'],
      ['Control category', 'How a control is put in place: technical, managerial, operational or physical'],
      ['Control type', 'What a control does: prevent, deter, detect, correct, compensate or direct'],
      ['Compensating control', 'A substitute used when the normal control is not possible'],
      ['Zero trust', 'Never trust a request because of where it comes from; check every one'],
      ['Implicit trust zone', 'An area where anything inside is trusted, such as an old internal network'],
      ['Policy engine', 'The part of zero trust that decides whether a request is allowed'],
      ['Policy administrator', 'The part that carries out the decision, setting up or ending the session'],
      ['Policy enforcement point', 'The gateway in the data path that lets the connection through or blocks it'],
      ['Control plane', 'Where decisions about access are made'],
      ['Data plane', 'Where the actual traffic flows'],
    ),

    h('Four categories, six types', { objective: '1.1', keep: 'Category is how a control is put in place: technical (systems), managerial (policies and oversight), operational (people), physical (things you can touch). Type is what it does: prevent, deter, detect, correct, compensate or direct.' }),
    p('Every control can be described twice. The **category** says *how* it is put in place; the **type** says *what it does* about a threat. A firewall rule is a technical control (a system enforces it) and a preventive one (it stops traffic before harm is done).'),
    table(
      ['Category', 'Put in place by', 'Examples'],
      [
        ['Technical', 'Hardware, software and firmware', 'Firewall rules, encryption, MFA, antivirus, EDR, SIEM rules'],
        ['Managerial', 'Management: policies, plans and oversight', 'Security policies, risk assessments, reviewing access reports'],
        ['Operational', 'People, as part of the daily work', 'Guards, awareness training, change procedures, incident drills'],
        ['Physical', 'Things in the real world', 'Locks, fences, badge readers, cameras, fire extinguishers'],
      ],
      { caption: 'Control categories' },
    ),
    table(
      ['Type', 'What it does', 'Example'],
      [
        ['Preventive', 'Stops an incident from happening', 'A lock, a firewall rule, removing admin rights'],
        ['Deterrent', 'Discourages an attacker, without stopping them', 'A warning sign, a sign-in banner, visible cameras'],
        ['Detective', 'Finds an incident while or after it happens', 'Logs and SIEM alerts, motion sensors, audits'],
        ['Corrective', 'Puts things right after an incident', 'Restoring from backup, patching the exploited flaw, a fire extinguisher'],
        ['Compensating', 'Stands in when the normal control is not possible', 'Isolating a system that cannot be patched, a generator'],
        ['Directive', 'Tells people what to do', 'A policy, a procedure, an "Authorized personnel only" sign'],
      ],
      { caption: 'Control types' },
    ),
    analogy('A house: the front door lock is preventive, the "beware of the dog" sign is deterrent, the burglar alarm is detective, the insurance claim and the locksmith are corrective, a bar across a broken lock is compensating, and the house rules on the fridge are directive.'),
    trap('Deterrent versus preventive: a deterrent only makes an attacker **choose** not to try. If a determined attacker could simply ignore it, it is deterrent. A guard who can physically stop someone is preventive; a sign is not.'),

    h('Try it: sort twelve controls', { objective: '1.1', keep: 'Ask two questions: who or what puts it in place (category), and does it stop, discourage, find, fix, stand in for or tell (type)? Some controls fit two types; pick the best.' }),
    controlSorter(),
    exam('Questions often describe a control and ask for its type. Look for the verb: **stops** is preventive, **discourages** is deterrent, **alerts** or **reveals** is detective, **restores** is corrective, **instead of** is compensating, **requires** or **instructs** is directive.'),

    h('Zero trust: check every request', { objective: '1.2', keep: 'Zero trust never trusts a request because of its network location. Every request is checked against identity, device health and context, and only the smallest necessary access is granted, then rechecked.' }),
    p('Old networks had a hard shell and a soft middle: once you were inside, on the office network or the VPN, you were trusted. That inside area is an **implicit trust zone**, and attackers love it, because one phished laptop can reach everything. **Zero trust** removes it:'),
    list(
      '**Never trust, always verify**: every request is checked, from inside or outside.',
      '**Adaptive identity**: how hard the sign-in is depends on context, such as location, time, device and behavior.',
      '**Threat scope reduction**: grant the least access, to one application rather than the whole network, so a compromise reaches as little as possible.',
      '**Policy-driven access control**: decisions come from written policy that combines who, what device, from where and how risky.',
    ),
    p('Zero trust splits the work into two planes. The **control plane** makes decisions; the **data plane** carries the traffic. Step through one request:'),
    {
      type: 'sequence',
      title: 'Zero trust: one request to the payroll app',
      steps: [
        { from: 'Subject', to: 'Policy enforcement point', label: 'Request: open payroll', note: 'The **subject** (Dana, a finance analyst) on her **system** (a company laptop) asks for the payroll application. The request reaches a **policy enforcement point (PEP)**, a gateway in the data plane. Nothing passes it without a decision.' },
        { from: 'Policy enforcement point', to: 'Policy engine', label: 'Should this be allowed?', note: 'The PEP asks the control plane. The **policy engine** gathers what it needs: Dana\'s role, the laptop\'s patch level and EDR status, her location and threat intelligence.' },
        { from: 'Policy engine', to: 'Subject', label: 'Prove it: stronger MFA', note: 'She is signing in from a new country at an unusual hour, so **adaptive identity** asks for a stronger MFA step than it would in the office. She passes, the laptop is healthy, and policy allows finance staff to use payroll. The engine decides: **grant**, to payroll only.' },
        { from: 'Policy engine', to: 'Policy administrator', label: 'Grant: payroll only', note: 'The **policy administrator** carries out the decision. It creates a short-lived session token or credential for this one connection. Together, the engine and administrator are the **policy decision point**.' },
        { from: 'Policy administrator', to: 'Policy enforcement point', label: 'Open session', note: 'The administrator tells the PEP to let this session through. If the laptop later fails a health check, it can tell the PEP to cut the session.' },
        { from: 'Subject', to: 'Payroll app', label: 'Traffic flows', note: 'Dana reaches payroll and **only** payroll: that is **threat scope reduction**. She cannot see file servers or other apps, and the decision is re-evaluated as conditions change.' },
      ],
    },
    table(
      ['Plane', 'Components', 'Job'],
      [
        ['Control plane', 'Policy engine, policy administrator (together the policy decision point)', 'Decides and sets up access'],
        ['Data plane', 'Subject and system, policy enforcement point, the resource', 'Carries the traffic, but only as the control plane allows'],
      ],
      { caption: 'The two planes of zero trust' },
    ),
    tip('**ZTNA** (zero trust network access) products replace the VPN in exactly this way, and **SASE** (secure access service edge) delivers it, with other security services, from the cloud.'),
    exam('Match the job to the part: **decides** is the policy engine, **creates the session or token** is the policy administrator, **allows or blocks the connection** is the policy enforcement point. "Context changes how hard sign-in is" is **adaptive identity**.'),

    h('Practice: zero trust components', { objective: '1.2', keep: 'Subject and system request; the policy engine decides; the policy administrator sets up the session; the policy enforcement point allows or blocks; adaptive identity and threat scope reduction make each grant small and context-aware.' }),
    examPbqs('controls', 'This comes from the practice exam: follow a traveling analyst\'s request through a zero trust architecture and name each component. It loads when you press Start.'),
  ],
  check: [
    mcq('A company cannot patch an old manufacturing controller, so it places it on an isolated network segment that only one jump box can reach. What type of control is the isolation?',
      'Compensating', ['Corrective', 'Deterrent', 'Directive'],
      'The normal control, patching, is not possible, so something else reduces the same risk instead. That substitute is a compensating control.'),
    mcq('Which pair is an operational, detective control?',
      'Guards patrolling the site at night and reporting open doors', ['A firewall that blocks inbound connections', 'A written acceptable use policy', 'A lock on the server room door'],
      'Patrols are carried out by people (operational) and find problems rather than stopping them (detective). The others are technical preventive, managerial directive and physical preventive.'),
    mcq('In a zero trust architecture, which component decides whether a request should be granted?',
      'Policy engine', ['Policy enforcement point', 'Policy administrator', 'Subject'],
      'The policy engine evaluates the request against policy and context and makes the decision. The administrator carries it out, and the enforcement point lets the traffic through or blocks it.'),
    mcq('A user signing in from a new country is asked for an extra verification step that the same user is not asked for in the office. What is this?',
      'Adaptive identity', ['Threat scope reduction', 'An implicit trust zone', 'Separation of duties'],
      'Adaptive identity raises or lowers the authentication required based on context such as location, time and device.'),
  ],
};
