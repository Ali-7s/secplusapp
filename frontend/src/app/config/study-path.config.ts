export interface StudyPhase {
  id: string;
  name: string;
  /** Why this phase comes before the next — shown to the user */
  rationale: string;
  icon: string;
  color: string;
  /** Objective numbers (e.g. "1.2") in the recommended study order */
  objectives: string[];
  estWeeks: number;
}

export const STUDY_PHASES: StudyPhase[] = [
  {
    id: 'foundation',
    name: 'Security Foundations',
    rationale:
      'Before any technical topic makes sense you need a mental framework. ' +
      'The CIA triad, security control categories, and core principles give you ' +
      'the lens through which every topic that follows becomes easier to categorize and remember.',
    icon: 'foundation',
    color: '#1565c0',
    objectives: ['1.2', '1.1'],
    estWeeks: 0.5,
  },
  {
    id: 'threats',
    name: 'Threats & Vulnerabilities',
    rationale:
      'Learn the adversary before learning the defenses — this is how security ' +
      'professionals actually think. Understanding attack vectors, malware behavior, ' +
      'and vulnerability types makes every defensive topic feel intuitive rather than ' +
      'an arbitrary list to memorize.',
    icon: 'bug_report',
    color: '#c62828',
    objectives: ['2.1', '2.2', '2.4', '2.3', '2.5'],
    estWeeks: 2,
  },
  {
    id: 'architecture',
    name: 'Security Architecture',
    rationale:
      'With a threat model in your head, now learn what you are designing and ' +
      'protecting. Network segmentation, cloud models, resilience, and data protection ' +
      'all make far more sense when you can ask "what specific attack am I preventing here?"',
    icon: 'account_tree',
    color: '#2e7d32',
    objectives: ['3.2', '3.1', '3.4', '3.3'],
    estWeeks: 1.5,
  },
  {
    id: 'cryptography',
    name: 'Cryptography & PKI',
    rationale:
      'Cryptography underpins TLS, VPNs, digital signatures, and certificate chains. ' +
      'Studying it as a focused phase here means every identity and operations topic ' +
      'you encounter next will have a concrete technical foundation to attach to.',
    icon: 'lock',
    color: '#6a1b9a',
    objectives: ['1.4'],
    estWeeks: 1,
  },
  {
    id: 'identity',
    name: 'Identity & Access Management',
    rationale:
      'IAM builds directly on cryptography. MFA, SSO, federation, PAM, and RBAC all ' +
      'rely on asymmetric keys and certificate trust chains. Students who study IAM ' +
      'before cryptography must constantly backtrack — this order eliminates that.',
    icon: 'badge',
    color: '#e65100',
    objectives: ['4.6'],
    estWeeks: 1,
  },
  {
    id: 'operations',
    name: 'Security Operations',
    rationale:
      'Day-to-day defender work. At this point you understand attacks, architecture, ' +
      'cryptography, and IAM — hardening, vulnerability scanning, SIEM, endpoint ' +
      'protection, and automation finally feel like a coherent toolkit rather than ' +
      'disconnected features.',
    icon: 'security',
    color: '#00695c',
    objectives: ['4.5', '4.1', '4.3', '4.4', '4.7', '4.2'],
    estWeeks: 2.5,
  },
  {
    id: 'response',
    name: 'Incident Response & Forensics',
    rationale:
      'When things go wrong. These topics require deep knowledge of what normal ' +
      'operations look like before you can recognize anomalies, contain threats, ' +
      'and conduct forensic investigations. The dependency on Phase 6 is real.',
    icon: 'emergency_share',
    color: '#bf360c',
    objectives: ['4.8', '4.9'],
    estWeeks: 0.75,
  },
  {
    id: 'governance',
    name: 'Governance, Risk & Compliance',
    rationale:
      'Study GRC last. Frameworks like NIST, ISO 27001, GDPR, HIPAA, and PCI-DSS ' +
      'describe how to manage what you have spent the previous phases learning to ' +
      'implement. Risk calculations, audits, and awareness programs are most ' +
      'meaningful when you already understand what you are governing.',
    icon: 'gavel',
    color: '#37474f',
    objectives: ['1.3', '5.1', '5.2', '5.3', '5.4', '5.5', '5.6'],
    estWeeks: 1.75,
  },
];

export const RECOMMENDED_FLAT_ORDER: string[] = STUDY_PHASES.flatMap(p => p.objectives);
