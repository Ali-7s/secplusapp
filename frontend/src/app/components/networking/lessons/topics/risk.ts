import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, exam, examPbqs, h, list, mcq, p, pbq, recap, riskCalc, table, tip, trap, words } from '../dsl';

const PRICE_TWO_RISKS: MatchQuestion = {
  id: 'topic-risk-two-risks', domain: 5, objective: '5.2', kind: 'match',
  scenario: 'An online shop\'s customer database is valued at $250,000. A breach would cost 40% of that in fines, notification and lost trade, and the shop expects one about every 10 years. A web application firewall would cost $4,000 a year and cut breaches to about one every 50 years. Separately, staff lose about three company phones a year, at $800 each.',
  stem: 'Work out each value and choose each response.',
  prompts: [
    { label: 'Breach: single loss expectancy (SLE)', group: 'Risk 1: database breach', choices: ['$10,000', '$40,000', '$100,000', '$250,000'], answer: '$100,000',
      why: 'SLE is asset value times exposure factor: $250,000 times 0.40 is $100,000 for one breach.' },
    { label: 'Breach: annualized rate of occurrence (ARO)', group: 'Risk 1: database breach', choices: ['0.02', '0.1', '0.4', '10'], answer: '0.1',
      why: 'Once every 10 years is 1 divided by 10, so 0.1 a year. The 10 is the gap between events, not the rate.' },
    { label: 'Breach: annualized loss expectancy (ALE) today', group: 'Risk 1: database breach', choices: ['$2,000', '$4,000', '$10,000', '$100,000'], answer: '$10,000',
      why: 'ALE is SLE times ARO: $100,000 times 0.1 is $10,000 of expected loss each year.' },
    { label: 'Breach: ALE with the firewall', group: 'Risk 1: database breach', choices: ['$2,000', '$4,000', '$6,000', '$8,000'], answer: '$2,000',
      why: 'The firewall changes the rate to once every 50 years, an ARO of 0.02, so the ALE becomes $100,000 times 0.02, which is $2,000.' },
    { label: 'Breach: response', group: 'Risk 1: database breach', choices: ['Mitigate: the firewall is worth $4,000 a year after its cost', 'Mitigate: the firewall is worth $8,000 a year', 'Accept: the firewall costs more than it saves', 'Transfer: buy insurance instead'], answer: 'Mitigate: the firewall is worth $4,000 a year after its cost',
      why: 'It cuts the expected loss by $10,000 minus $2,000, which is $8,000, and costs $4,000, so it is worth $4,000 a year. Forgetting to subtract its cost overstates the value.' },
    { label: 'Lost phones: ALE', group: 'Risk 2: lost phones', choices: ['$267', '$800', '$2,400', '$8,000'], answer: '$2,400',
      why: 'Each loss costs the full $800, and three a year is an ARO of 3, so the ALE is $2,400. An ARO can be more than 1.' },
  ],
  takeaway: 'SLE is AV times EF, ARO is one over the years between events (or the count per year), ALE is SLE times ARO, and a control is worth it only if the ALE it removes is more than it costs each year.',
};

export const RISK: LessonBody = {
  goals: [
    'Calculate SLE, ARO and ALE, and decide whether a control is worth what it costs',
    'Choose between accepting, avoiding, mitigating and transferring a risk, including insurance with a deductible',
    'Tell qualitative from quantitative analysis, inherent from residual risk, and appetite from tolerance',
    'Use RTO, RPO, MTBF and MTTR correctly, and work out availability for chains and redundant pairs',
  ],
  blocks: [
    recap('From topic 6: an incident costs money, downtime and reputation, and **recovery** restores systems from clean backups. From Networking lesson 11: **hardening** and other safeguards, called **controls**, reduce how likely or how damaging an attack is. Controls cost money too, which is where this topic starts.'),
    words(
      ['Risk', 'The chance that a threat harms something you value, and how badly'],
      ['Threat', 'Anything that could cause harm: an attacker, a flood, a careless employee'],
      ['Vulnerability', 'A weakness a threat could use: an unpatched server, a building on a flood plain'],
      ['Control', 'A safeguard that lowers the likelihood or the impact of a risk'],
      ['Asset value (AV)', 'What the thing at risk is worth, in money'],
      ['Exposure factor (EF)', 'The share of the asset\'s value lost in one event, as a percentage'],
      ['SLE', 'Single loss expectancy: the cost of one event'],
      ['ARO', 'Annualized rate of occurrence: how many times a year it is expected to happen'],
      ['ALE', 'Annualized loss expectancy: the expected cost per year'],
      ['Risk register', 'The list of an organization\'s risks, with owners, scores and responses'],
      ['Inherent risk', 'The risk before any controls'],
      ['Residual risk', 'The risk left over after the controls'],
      ['BIA', 'Business impact analysis: what each process is worth and how long it can be down'],
      ['RTO', 'Recovery time objective: how long a system may be down'],
      ['RPO', 'Recovery point objective: how much recent data may be lost, measured in time'],
    ),

    h('What risk is, and two ways to measure it', { objective: '5.2', keep: 'Risk is likelihood times impact. Qualitative analysis rates them in words (low, medium, high) on a heat map; quantitative analysis puts numbers in money on them. Qualitative is quick, quantitative supports spending decisions.' }),
    p('A risk needs two things: a **threat** and a **vulnerability** it can use. How much it matters depends on the **likelihood** that it happens and its **impact** if it does. Risk management finds risks, measures them, decides what to do about each, and keeps watching.'),
    table(
      ['', 'Qualitative', 'Quantitative'],
      [
        ['Measures with', 'Words or scores: low, medium, high, or 1 to 5', 'Money and rates: $200,000 a time, once every 5 years'],
        ['Result', 'A ranking, often shown as a heat map (likelihood against impact, colored green to red)', 'An expected yearly loss in money (ALE)'],
        ['Good for', 'Quick comparison of many risks, including hard-to-price ones such as reputation', 'Deciding whether a control is worth what it costs'],
        ['Weakness', 'Subjective: two people may rate the same risk differently', 'Needs numbers you may have to estimate'],
      ],
      { caption: 'Two ways to analyze risk' },
    ),
    p('Risk assessments happen at different times: **one-time** (before a project), **ad hoc** (when something changes, such as a new threat), **recurring** (every quarter or year) and **continuous** (automated monitoring).'),

    h('Putting a price on risk: SLE, ARO and ALE', { objective: '5.2', keep: 'SLE = AV × EF is the cost of one event. ARO is events per year: once every 5 years is 0.2, and it can be more than 1. ALE = SLE × ARO is the expected cost per year.' }),
    p('Quantitative analysis builds the yearly cost of a risk in three steps:'),
    list(
      '**SLE = AV × EF.** A $400,000 warehouse that a flood would half destroy (EF 50%) has an SLE of $200,000.',
      '**ARO** is how many times a year it happens. Floods once every 5 years is **1 ÷ 5 = 0.2**. Ten laptops stolen a year is an ARO of **10**.',
      '**ALE = SLE × ARO.** $200,000 × 0.2 = **$40,000 a year**. That is the most it makes sense to spend each year on protecting against this one risk.',
    ),
    trap('"Once every 20 years" is an ARO of **0.05**, not 20. Multiplying the SLE by the number of years gives a hugely wrong answer. And the ARO is not limited to 1: something that happens six times a year has an ARO of 6.'),
    p('To judge a control, work out the ALE again **with** it in place. A control usually changes either the exposure factor (less damage each time) or the ARO (it happens less often). It is worth it if the ALE it removes is more than its yearly cost:'),
    p('**Value of a control = (ALE before − ALE after) − yearly cost of the control.**'),
    riskCalc('ale'),
    exam('Read carefully which number the control changes. EDR and immutable backups mostly cut the **exposure factor** (less is lost per attack); a flood barrier mostly cuts the **ARO** (floods get in less often). And always subtract the control\'s own cost before calling it worth it.'),

    h('Choosing a response', { objective: '5.2', keep: 'Accept (live with it), avoid (stop the risky activity), mitigate (add controls), or transfer (insurance, outsourcing). Insurance still leaves premiums and deductibles to pay. An exemption or exception is a formal, approved acceptance of not meeting a rule.' }),
    table(
      ['Response', 'What it means', 'Example'],
      [
        ['Accept', 'Live with it, because handling it would cost more than it could lose', 'A $300 printer has no spare. If it breaks, buy another'],
        ['Avoid', 'Stop doing the risky thing altogether', 'Retire an old file transfer service instead of securing it'],
        ['Mitigate', 'Add controls that reduce likelihood or impact', 'Patch, add MFA, install a flood barrier'],
        ['Transfer', 'Move the financial impact to someone else', 'Cyber insurance, or outsourcing to a provider that carries the liability'],
      ],
      { caption: 'The four risk responses' },
    ),
    p('**Insurance** is the classic transfer, but it is not free: you pay the **premium**, and each claim usually leaves a **deductible** for you to pay. Six stolen laptops a year at $1,500 each is an ALE of $9,000. A $4,000 policy with a $500 deductible costs $4,000 + 6 × $500 = **$7,000 a year**, so insuring saves $2,000.'),
    p('Two kinds of acceptance have their own names. An **exception** lets something break a security rule for a while, such as an old machine allowed to run unpatched until it is replaced. An **exemption** releases something from a rule altogether. Both are formally approved and recorded, with the risk owner signing off.'),
    trap('Transferring a risk moves the **money**, not the **responsibility**. If customer data leaks, the company still answers to its customers and regulators, insurance or not.'),

    h('Keeping track: the register, appetite and tolerance', { objective: '5.2', keep: 'The risk register lists each risk with its owner, score, response and indicators. Appetite is how much risk you will take on; tolerance is how far results may stray. Controls turn inherent risk into residual risk.' }),
    p('The **risk register** is the organization\'s list of risks. Each entry usually has a description, a **risk owner** who is accountable for it, likelihood and impact (and the score they give), the chosen response and controls, and **key risk indicators (KRIs)**: measurements that warn when the risk is growing, such as the number of unpatched servers.'),
    table(
      ['Term', 'Meaning'],
      [
        ['Inherent risk', 'The risk as it is before any controls'],
        ['Residual risk', 'What is left after the controls. It is never zero; it must fit within the appetite'],
        ['Risk appetite', 'How much risk the organization is willing to pursue to reach its goals: expansionary (seeks it), neutral, or conservative (avoids it)'],
        ['Risk tolerance', 'How far results may stray from that before action is required'],
        ['Risk threshold', 'The specific level above which a risk must be handled, for example any score above 15'],
      ],
    ),
    analogy('An investor\'s appetite is "growth stocks, some risk is fine". Their tolerance is "if a stock falls more than 20%, I sell". The threshold is the 20% line itself.'),

    h('Business impact: RTO, RPO, MTBF and MTTR', { objective: '5.2', keep: 'RTO is how long a system may be down; RPO is how much data may be lost. MTBF is the average time between failures, MTTR the average repair time. Availability = MTBF ÷ (MTBF + MTTR). Series multiplies availabilities; redundant pairs multiply unavailabilities.' }),
    p('A **business impact analysis (BIA)** works out which processes matter most (the **mission-essential functions**), what an outage of each would cost, and so how fast each must come back. It sets four numbers:'),
    table(
      ['Measure', 'Question it answers', 'Example'],
      [
        ['RTO, recovery time objective', 'How long may it be down?', 'Orders must be taken again within 4 hours'],
        ['RPO, recovery point objective', 'How much recent data may be lost?', 'At most 15 minutes of orders, so back up or replicate at least that often'],
        ['MTTR, mean time to repair', 'How long does a fix take, on average?', 'Total repair time ÷ number of failures'],
        ['MTBF, mean time between failures', 'How long does it run between failures, on average?', 'Total working time ÷ number of failures'],
      ],
      { caption: 'Recovery objectives and reliability measures' },
    ),
    trap('RTO is about **time to recover**; RPO is about **data lost**, set by how often you back up. Meeting one says nothing about the other: a fast restore of a backup from last night still loses up to a day of data.'),
    p('**Availability** is the share of time something is up. From MTBF and MTTR it is **MTBF ÷ (MTBF + MTTR)**. A contract, the **service-level agreement (SLA)**, often promises a number of "nines": 99.9% of a 30-day month (43,200 minutes) allows 43.2 minutes down.'),
    table(
      ['Availability', 'Downtime a year', 'Downtime a 30-day month'],
      [
        ['99% ("two nines")', '3.65 days', '7.2 hours'],
        ['99.9% ("three nines")', '8.76 hours', '43.2 minutes'],
        ['99.99% ("four nines")', '52.6 minutes', '4.32 minutes'],
        ['99.999% ("five nines")', '5.26 minutes', '26 seconds'],
      ],
      { caption: 'What the nines allow' },
    ),
    p('Systems are built from parts. If **all** of them must work (a chain, "in series"), multiply their availabilities: the result is always lower than the weakest part. If **any one** of a redundant pair will do ("in parallel"), multiply their **un**availabilities instead: both have to fail at once.'),
    riskCalc('availability'),
    tip('To check an SLA, add up **all** the downtime in the period and compare it with the allowance. Three short outages can break a 99.9% promise even if none of them alone is longer than 43.2 minutes.'),

    h('Practice: price two risks', { objective: '5.2', keep: 'Work line by line: SLE, then ARO, then ALE, then the ALE with the control, then subtract the control\'s yearly cost. A positive result means mitigate; a negative one means accept or transfer.' }),
    pbq('Price two risks', PRICE_TWO_RISKS, { intro: 'Work each value out on paper first, or use the calculator above, then pick it.' }),
    examPbqs('risk', 'These come from the practice exam: a flood barrier, ransomware and laptop insurance, and an SLA with a chain of servers. They load when you press Start.'),
  ],
  check: [
    mcq('A data center floods badly about once every 25 years. What is the annualized rate of occurrence?',
      '0.04', ['25', '0.25', '4'],
      'The ARO is how many times a year it happens: 1 divided by 25 is 0.04. Using the 25 years directly is the classic mistake.'),
    mcq('A control would reduce a risk\'s ALE from $50,000 to $10,000 and costs $45,000 a year. What should the organization do?',
      'Not buy it, because it costs more each year than the $40,000 of loss it prevents',
      ['Buy it, because it lowers the ALE', 'Buy it, because it removes 80% of the risk', 'Avoid the risk, because the ALE is over $10,000'],
      'A control is worth it only if the ALE reduction ($40,000) is larger than its yearly cost ($45,000). Here it loses $5,000 a year, so accepting or transferring the risk is better.'),
    mcq('A company buys cyber insurance to cover the cost of a data breach. Which risk response is this?',
      'Transference', ['Acceptance', 'Avoidance', 'Mitigation'],
      'Insurance moves the financial impact to the insurer, which is transference. The company still owns the responsibility for the data.'),
    mcq('The business can lose at most one hour of customer orders. Which measure does this describe?',
      'Recovery point objective (RPO)', ['Recovery time objective (RTO)', 'Mean time to repair (MTTR)', 'Mean time between failures (MTBF)'],
      'The RPO is how much data may be lost, measured in time, and it decides how often data must be backed up or replicated. The RTO is how long the system may be down.'),
  ],
};
