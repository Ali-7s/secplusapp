/**
 * The CompTIA Security+ SY0-701 exam objectives (version 5.0), every topic as CompTIA lists it. Each block is an
 * indented outline (two spaces per level). "=>" links a topic to the glossary cards that teach it when the card
 * has a different name. utils/coverage.ts turns this into the coverage map on the Objectives page.
 */

export const SY0_701_RETIRES = '2027-06-11';

export const OBJECTIVE_OUTLINES: ReadonlyArray<readonly [id: string, title: string, outline: string]> = [
  ['1.1', 'Compare and contrast various types of security controls.', `
Categories
  Technical => Technical control
  Managerial => Managerial control
  Operational => Operational control
  Physical => Physical control
Control types
  Preventive
  Deterrent
  Detective
  Corrective
  Compensating
  Directive
`],
  ['1.2', 'Summarize fundamental security concepts.', `
Confidentiality, Integrity, and Availability (CIA)
Non-repudiation
Authentication, Authorization, and Accounting (AAA)
  Authenticating people => Authentication; Multifactor authentication; Biometrics
  Authenticating systems => Authentication; 802.1X; Certificate
  Authorization models => Authorization; Role-based access control; Attribute-based access control
Gap analysis
Zero Trust
  Control Plane
    Adaptive identity
    Threat scope reduction
    Policy-driven access control => Zero trust; Policy Engine
    Policy Administrator
    Policy Engine
  Data Plane
    Implicit trust zones
    Subject/System => Zero trust; Data plane
    Policy Enforcement Point
Physical security
  Bollards
  Access control vestibule
  Fencing
  Video surveillance
  Security guard
  Access badge
  Lighting
  Sensors
    Infrared => Physical security sensors
    Pressure => Physical security sensors
    Microwave => Physical security sensors
    Ultrasonic => Physical security sensors
Deception and disruption technology
  Honeypot
  Honeynet
  Honeyfile
  Honeytoken
`],
  ['1.3', 'Explain the importance of change management processes and the impact to security.', `
Business processes impacting security operation
  Approval process => Change management; CAB
  Ownership => Change management
  Stakeholders => Change management
  Impact analysis => Change management
  Test results => Change management
  Backout plan
  Maintenance window
  Standard operating procedure
Technical implications
  Allow lists/deny lists => Allow list and deny list
  Restricted activities => Change management; Maintenance window
  Downtime => Maintenance window
  Service restart => Maintenance window
  Application restart => Maintenance window
  Legacy applications => Change management
  Dependencies => Change management
Documentation
  Updating diagrams => Change management; Version control
  Updating policies/procedures => Change management; Security policy; Security procedure
Version control
`],
  ['1.4', 'Explain the importance of using appropriate cryptographic solutions.', `
Public key infrastructure (PKI)
  Public key
  Private key
  Key escrow
Encryption
  Level
    Full-disk => FDE; Encryption levels
    Partition => Encryption levels
    File => EFS; Encryption levels
    Volume => Encryption levels
    Database => Encryption levels
    Record => Encryption levels
  Transport/communication => TLS; IPSec; Data in transit
  Asymmetric
  Symmetric
  Key exchange
  Algorithms => AES; RSA; Symmetric encryption; Asymmetric encryption
  Key length
Tools
  Trusted Platform Module (TPM)
  Hardware security module (HSM)
  Key management system
  Secure enclave
Obfuscation
  Steganography
  Tokenization
  Data masking
Hashing
Salting
Digital signatures
Key stretching
Blockchain
Open public ledger
Certificates
  Certificate authorities
  Certificate revocation lists (CRLs)
  Online Certificate Status Protocol (OCSP)
  Self-signed
  Third-party => Certificate authority; Certificate
  Root of trust
  Certificate signing request (CSR) generation
  Wildcard
`],
  ['2.1', 'Compare and contrast common threat actors and motivations.', `
Threat actors
  Nation-state => Nation-state actor
  Unskilled attacker
  Hacktivist
  Insider threat
  Organized crime
  Shadow IT
Attributes of actors
  Internal/external => Threat actor; Insider threat
  Resources/funding => Threat actor; Advanced persistent threat
  Level of sophistication/capability => Threat actor; Unskilled attacker; Advanced persistent threat
Motivations
  Data exfiltration => Exfiltration
  Espionage => Nation-state actor; Advanced persistent threat
  Service disruption => DoS; DDoS
  Blackmail => Ransomware; Organized crime
  Financial gain => Organized crime; Ransomware
  Philosophical/political beliefs => Hacktivist
  Ethical => Bug bounty program; Responsible disclosure
  Revenge => Insider threat
  Disruption/chaos => Unskilled attacker; Hacktivist
  War => Nation-state actor
`],
  ['2.2', 'Explain common threat vectors and attack surfaces.', `
Message-based
  Email => Phishing; Business email compromise
  Short Message Service (SMS)
  Instant messaging (IM)
Image-based => Steganography
File-based => Malware
Voice call => Vishing
Removable device => USB; Malware
Vulnerable software
  Client-based vs. agentless => Agent-based and agentless
Unsupported systems and applications => EOL; Patch management
Unsecure networks
  Wireless => Rogue access point; Evil twin
  Wired => 802.1X; Port security
  Bluetooth => Bluejacking; Bluesnarfing
Open service ports => Network port; Hardening
Default credentials
Supply chain
  Managed service providers (MSPs)
  Vendors => Vendor assessment; Supply chain attack
  Suppliers => Supply chain attack
Human vectors/social engineering
  Phishing
  Vishing
  Smishing
  Misinformation/disinformation
  Impersonation
  Business email compromise
  Pretexting
  Watering hole => Watering hole attack
  Brand impersonation
  Typosquatting
`],
  ['2.3', 'Explain various types of vulnerabilities.', `
Application
  Memory injection
  Buffer overflow
  Race conditions
    Time-of-check (TOC)
    Time-of-use (TOU)
  Malicious update
Operating system (OS)-based
Web-based
  Structured Query Language injection (SQLi)
  Cross-site scripting (XSS)
Hardware
  Firmware => UEFI
  End-of-life
  Legacy => EOL
Virtualization
  Virtual machine (VM) escape
  Resource reuse
Cloud-specific => Misconfiguration; Responsibility matrix; CASB
Supply chain
  Service provider => Supply chain attack; MSP
  Hardware provider => Supply chain attack
  Software provider => Supply chain attack; Package monitoring
Cryptographic => Cipher suite; Downgrade attack
Misconfiguration
Mobile device
  Side loading
  Jailbreaking
Zero-day
`],
  ['2.4', 'Given a scenario, analyze indicators of malicious activity.', `
Malware attacks
  Ransomware
  Trojan => Trojan horse; RAT
  Worm
  Spyware
  Bloatware
  Virus
  Keylogger
  Logic bomb
  Rootkit
Physical attacks
  Brute force => Brute force attack
  Radio frequency identification (RFID) cloning
  Environmental => HVAC
Network attacks
  Distributed denial-of-service (DDoS)
    Amplified => Amplification attack
    Reflected => Amplification attack
  Domain Name System (DNS) attacks
  Wireless => Evil twin; Deauthentication attack; Rogue access point; Wireless jamming
  On-path => Man-in-the-middle attack
  Credential replay => Replay attack; Pass-the-hash
  Malicious code => Malware; Fileless malware
Application attacks
  Injection => Command injection; SQLi; Memory injection
  Buffer overflow
  Replay => Replay attack
  Privilege escalation
  Forgery => CSRF; Server-side request forgery
  Directory traversal
Cryptographic attacks
  Downgrade => Downgrade attack
  Collision => Collision attack
  Birthday => Birthday attack
Password attacks
  Spraying => Password spraying
  Brute force => Brute force attack; Dictionary attack
Indicators
  Account lockout
  Concurrent session usage
  Blocked content => Indicators of malicious activity
  Impossible travel
  Resource consumption => Indicators of malicious activity
  Resource inaccessibility => Indicators of malicious activity
  Out-of-cycle logging
  Published/documented => Indicators of malicious activity; IoC
  Missing logs
`],
  ['2.5', 'Explain the purpose of mitigation techniques used to secure the enterprise.', `
Segmentation => Network segmentation; Microsegmentation
Access control
  Access control list (ACL)
  Permissions => Least privilege; ACL
Application allow list
Isolation
Patching => Patch management
Encryption
Monitoring => SIEM; Log aggregation
Least privilege
Configuration enforcement => Secure baseline; Baseline configuration
Decommissioning
Hardening techniques
  Encryption
  Installation of endpoint protection => EDR; Hardening
  Host-based firewall => Firewall; HIPS
  Host-based intrusion prevention system (HIPS)
  Disabling ports/protocols => Hardening; Network port
  Default password changes => Default credentials; Hardening
  Removal of unnecessary software => Hardening; Bloatware
`],
  ['3.1', 'Compare and contrast security implications of different architecture models.', `
Architecture and infrastructure concepts
  Cloud
    Responsibility matrix
    Hybrid considerations => Hybrid cloud
    Third-party vendors => Vendor assessment; Responsibility matrix
  Infrastructure as code (IaC)
  Serverless => Serverless computing
  Microservices
  Network infrastructure
    Physical isolation
      Air-gapped => Air-gapped network
    Logical segmentation => Network segmentation; VLAN
    Software-defined networking (SDN)
  On-premises
  Centralized vs. decentralized => Centralized and decentralized
  Containerization
  Virtualization
  IoT
  Industrial control systems (ICS)/supervisory control and data acquisition (SCADA)
  Real-time operating system (RTOS)
  Embedded systems
  High availability
Considerations
  Availability => Architecture considerations
  Resilience => Architecture considerations; High availability; Redundancy
  Cost => Architecture considerations
  Responsiveness => Architecture considerations
  Scalability => Architecture considerations; Scalability and elasticity
  Ease of deployment => Architecture considerations; IaC
  Risk transference => Architecture considerations
  Ease of recovery => Architecture considerations; Disaster recovery
  Patch availability => Architecture considerations; Patch management
  Inability to patch => Architecture considerations; Patch management; Compensating control; Embedded system
  Power => Architecture considerations; UPS; PDU
  Compute => Architecture considerations
`],
  ['3.2', 'Given a scenario, apply security principles to secure enterprise infrastructure.', `
Infrastructure considerations
  Device placement => Device placement and attributes; Screened subnet; Security zone
  Security zones
  Attack surface
  Connectivity => Device placement and attributes
  Failure modes
    Fail-open
    Fail-closed => Fail secure
  Device attribute
    Active vs. passive => Device placement and attributes; IPS; IDS
    Inline vs. tap/monitor => Device placement and attributes; Network tap; Port mirroring
  Network appliances
    Jump server
    Proxy server
    Intrusion prevention system (IPS)/intrusion detection system (IDS)
    Load balancer => Load balancing
    Sensors => IDS; Network tap
  Port security
    802.1X
    Extensible Authentication Protocol (EAP)
  Firewall types
    Web application firewall (WAF)
    Unified threat management (UTM)
    Next-generation firewall (NGFW)
    Layer 4/Layer 7 => Stateful inspection; NGFW; WAF; Packet filtering
Secure communication/access
  Virtual private network (VPN)
  Remote access => VPN; RAS; Jump server
  Tunneling
    Transport Layer Security (TLS)
    Internet protocol security (IPSec)
  Software-defined wide area network (SD-WAN)
  Secure access service edge (SASE)
Selection of effective controls => Control types; Control categories; Compensating control
`],
  ['3.3', 'Compare and contrast concepts and strategies to protect data.', `
Data types
  Regulated => Regulated data; Data types
  Trade secret => Trade secret; Data types
  Intellectual property => Intellectual property; Data types
  Legal information => Data types; Legal hold
  Financial information => Data types; PCI DSS
  Human- and non-human-readable => Data types
Data classifications
  Sensitive => Data classification
  Confidential => Data classification
  Public => Data classification
  Restricted => Data classification
  Private => Data classification
  Critical => Data classification
General data considerations
  Data states
    Data at rest
    Data in transit
    Data in use
  Data sovereignty
  Geolocation => Geofencing; Data sovereignty
Methods to secure data
  Geographic restrictions => Geofencing
  Encryption
  Hashing
  Masking => Data masking
  Tokenization
  Obfuscation
  Segmentation => Network segmentation
  Permission restrictions => Least privilege; ACL
`],
  ['3.4', 'Explain the importance of resilience and recovery in security architecture.', `
High availability
  Load balancing vs. clustering
Site considerations
  Hot
  Cold
  Warm
  Geographic dispersion
Platform diversity
Multi-cloud systems => Multi-cloud
Continuity of operations => COOP; Business continuity
Capacity planning
  People => Capacity planning
  Technology => Capacity planning
  Infrastructure => Capacity planning
Testing
  Tabletop exercises => Tabletop exercise; Resilience testing
  Fail over => Failover; Resilience testing
  Simulation => Resilience testing
  Parallel processing => Resilience testing
Backups
  Onsite/offsite => Backup; Geographic dispersion
  Frequency => Backup; RPO
  Encryption
  Snapshots
  Recovery => Backup; RTO; Disaster recovery
  Replication
  Journaling
Power
  Generators => Backup power
  Uninterruptible power supply (UPS) => UPS; Backup power
`],
  ['4.1', 'Given a scenario, apply common security techniques to computing resources.', `
Secure baselines
  Establish => Secure baseline
  Deploy => Secure baseline
  Maintain => Secure baseline
Hardening targets
  Mobile devices => MDM; Hardening
  Workstations => Hardening
  Switches => Hardening; Port security
  Routers
  Cloud infrastructure => Hardening; Responsibility matrix
  Servers => Hardening
  ICS/SCADA
  Embedded systems
  RTOS
  IoT devices => IoT; Hardening
Wireless devices
  Installation considerations
    Site surveys
    Heat maps
Mobile solutions
  Mobile device management (MDM)
  Deployment models
    Bring your own device (BYOD)
    Corporate-owned, personally enabled (COPE)
    Choose your own device (CYOD)
  Connection methods
    Cellular => Mobile connection methods
    Wi-Fi => Mobile connection methods; WPA3
    Bluetooth => Mobile connection methods; Bluejacking; Bluesnarfing
Wireless security settings
  Wi-Fi Protected Access 3 (WPA3)
  AAA/Remote Authentication Dial-In User Service (RADIUS)
  Cryptographic protocols => WPA3; CCMP; SAE
  Authentication protocols => EAP; 802.1X; RADIUS; PEAP
Application security
  Input validation
  Secure cookies => Secure cookie
  Static code analysis
  Code signing
Sandboxing
Monitoring => SIEM; EDR
`],
  ['4.2', 'Explain the security implications of proper hardware, software, and data asset management.', `
Acquisition/procurement process => Vendor assessment; Due diligence
Assignment/accounting
  Ownership => Asset management; Data owner
  Classification => Data classification
Monitoring/asset tracking
  Inventory => Asset management; CMDB
  Enumeration => Asset management
Disposal/decommissioning
  Sanitization => Data sanitization
  Destruction => Data destruction
  Certification => Data destruction
  Data retention
`],
  ['4.3', 'Explain various activities associated with vulnerability management.', `
Identification methods
  Vulnerability scan => Vulnerability scanning
  Application security
    Static analysis => Static code analysis; Package monitoring
    Dynamic analysis => Dynamic code analysis; Package monitoring
    Package monitoring => Package monitoring
  Threat feed
    Open-source intelligence (OSINT)
    Proprietary/third-party => Threat intelligence
    Information-sharing organization => AIS; STIX; Threat intelligence
    Dark web
  Penetration testing
  Responsible disclosure program
    Bug bounty program
  System/process audit => Internal audit
Analysis
  Confirmation
    False positive
    False negative
  Prioritize => CVSS
  Common Vulnerability Scoring System (CVSS)
  Common Vulnerability Enumeration (CVE)
  Vulnerability classification => CVE; CWE; CVSS
  Exposure factor
  Environmental variables => CVSS
  Industry/organizational impact => BIA; CVSS
  Risk tolerance
Vulnerability response and remediation
  Patching => Patch management
  Insurance => Risk transference
  Segmentation => Network segmentation
  Compensating controls
  Exceptions and exemptions => Risk acceptance; Compensating control
Validation of remediation
  Rescanning => Vulnerability scanning
  Audit => Internal audit
  Verification => Vulnerability scanning
Reporting => Vulnerability scanning; CVSS
`],
  ['4.4', 'Explain security alerting and monitoring concepts and tools.', `
Monitoring computing resources
  Systems => SIEM; Log aggregation
  Applications => SIEM; Log aggregation
  Infrastructure => SIEM; Log aggregation
Activities
  Log aggregation
  Alerting => SIEM; Alert tuning
  Scanning => Vulnerability scanning
  Reporting => SIEM
  Archiving => Log aggregation; Data retention
  Alert response and remediation/validation
    Quarantine
    Alert tuning
Tools
  Security Content Automation Protocol (SCAP)
  Benchmarks => CIS; STIG; SCAP
  Agents/agentless => Agent-based and agentless; EDR; NAC
  Security information and event management (SIEM)
  Antivirus
  Data loss prevention (DLP)
  Simple Network Management Protocol (SNMP) traps
  NetFlow
  Vulnerability scanners => Vulnerability scanning
`],
  ['4.5', 'Given a scenario, modify enterprise capabilities to enhance security.', `
Firewall
  Rules => Firewall; Implicit deny; ACL
  Access lists => ACL
  Ports/protocols => Firewall; Network port
  Screened subnets
IDS/IPS
  Trends => IDS; IPS
  Signatures => IDS; IPS
Web filter
  Agent-based => Agent-based and agentless; Web filter
  Centralized proxy => Proxy server; Web filter
  Universal Resource Locator (URL) scanning
  Content categorization => Web filter
  Block rules => Web filter
  Reputation => Web filter; DNS filtering
Operating system security
  Group Policy => GPO
  SELinux => SE Linux; Mandatory access control
Implementation of secure protocols
  Protocol selection => Secure protocol selection; HTTPS; SSH; SFTP
  Port selection => Secure protocol selection; Network port
  Transport method => Secure protocol selection; TLS; IPSec
DNS filtering
Email security
  Domain-based Message Authentication Reporting and Conformance (DMARC)
  DomainKeys Identified Mail (DKIM)
  Sender Policy Framework (SPF)
  Gateway => Email gateway
File integrity monitoring
DLP
Network access control (NAC)
Endpoint detection and response (EDR)/extended detection and response (XDR)
User behavior analytics => UEBA
`],
  ['4.6', 'Given a scenario, implement and maintain identity and access management.', `
Provisioning/de-provisioning user accounts => Account provisioning and deprovisioning
Permission assignments and implications => Least privilege; Role-based access control
Identity proofing
Federation
Single sign-on (SSO)
  Lightweight Directory Access Protocol (LDAP)
  Open authorization (OAuth)
  Security Assertions Markup Language (SAML)
Interoperability => Federation; SAML
Attestation
Access controls
  Mandatory
  Discretionary
  Role-based
  Rule-based
  Attribute-based
  Time-of-day restrictions
  Least privilege
Multifactor authentication
  Implementations
    Biometrics
    Hard/soft authentication tokens => Authentication token; TOTP; HOTP
    Security keys
  Factors
    Something you know => Multifactor authentication
    Something you have => Multifactor authentication
    Something you are => Multifactor authentication; Biometrics
    Somewhere you are => Multifactor authentication; Geofencing
Password concepts
  Password best practices
    Length => Password policy
    Complexity => Password policy
    Reuse => Password policy
    Expiration => Password policy
    Age => Password policy
  Password managers
  Passwordless => Passwordless authentication
Privileged access management tools
  Just-in-time permissions => Just-in-time access
  Password vaulting
  Ephemeral credentials
`],
  ['4.7', 'Explain the importance of automation and orchestration related to secure operations.', `
Use cases of automation and scripting
  User provisioning => Account provisioning and deprovisioning; Automation and orchestration
  Resource provisioning => IaC; Automation and orchestration
  Guard rails
  Security groups => Automation and orchestration
  Ticket creation => Automation and orchestration; SOAR
  Escalation => Automation and orchestration; SOAR
  Enabling/disabling services and access => Automation and orchestration; SOAR
  Continuous integration and testing => CI/CD
  Integrations and Application programming interfaces (APIs)
Benefits
  Efficiency/time saving => Automation and orchestration
  Enforcing baselines => Secure baseline; Automation and orchestration
  Standard infrastructure configurations => IaC; Secure baseline
  Scaling in a secure manner => Automation and orchestration; Scalability and elasticity
  Employee retention => Automation and orchestration
  Reaction time => Automation and orchestration; SOAR
  Workforce multiplier => Automation and orchestration
Other considerations
  Complexity => Automation and orchestration
  Cost => Automation and orchestration
  Single point of failure
  Technical debt
  Ongoing supportability => Automation and orchestration
`],
  ['4.8', 'Explain appropriate incident response activities.', `
Process
  Preparation => Incident response
  Detection => Incident response
  Analysis => Incident response
  Containment
  Eradication
  Recovery => Incident response
  Lessons learned
Training => Incident response; Tabletop exercise
Testing
  Tabletop exercise
  Simulation => Tabletop exercise; Incident response
Root cause analysis
Threat hunting
Digital forensics
  Legal hold
  Chain of custody
  Acquisition => Digital forensics; Order of volatility
  Reporting => Digital forensics
  Preservation => Digital forensics; Legal hold; Chain of custody
  E-discovery
`],
  ['4.9', 'Given a scenario, use data sources to support an investigation.', `
Log data
  Firewall logs => Firewall; Log aggregation
  Application logs => Log aggregation; SIEM
  Endpoint logs => EDR; Log aggregation
  OS-specific security logs => Syslog; Log aggregation
  IPS/IDS logs
  Network logs => Syslog; Log aggregation
  Metadata
Data sources
  Vulnerability scans => Vulnerability scanning
  Automated reports => SIEM
  Dashboards => SIEM
  Packet captures
`],
  ['5.1', 'Summarize elements of effective security governance.', `
Guidelines => Security guideline
Policies
  Acceptable use policy (AUP)
  Information security policies => Security policy
  Business continuity
  Disaster recovery
  Incident response
  Software development lifecycle (SDLC)
  Change management
Standards
  Password => Password policy; Security standard
  Access control => Security standard
  Physical security => Security standard
  Encryption
Procedures
  Change management
  Onboarding/offboarding => Onboarding and offboarding
  Playbooks
External considerations
  Regulatory => Compliance; Governance
  Legal => Compliance; Governance
  Industry => Compliance; PCI DSS
  Local/regional => Compliance; Governance
  National => Compliance; Governance
  Global => Compliance; GDPR
Monitoring and revision => Governance
Types of governance structures
  Boards => Governance
  Committees => Governance
  Government entities => Governance
  Centralized/decentralized => Centralized and decentralized; Governance
Roles and responsibilities for systems and data
  Owners => Data owner
  Controllers => Data controller
  Processors => Data processor
  Custodians/stewards => Data custodian; Data steward
`],
  ['5.2', 'Explain elements of the risk management process.', `
Risk identification => Risk management; Risk assessment
Risk assessment
  Ad hoc => Risk assessment
  Recurring => Risk assessment
  One-time => Risk assessment
  Continuous => Risk assessment
Risk analysis
  Qualitative
  Quantitative
  Single loss expectancy (SLE)
  Annualized loss expectancy (ALE)
  Annualized rate of occurrence (ARO)
  Probability => Qualitative risk analysis; Risk
  Likelihood => Qualitative risk analysis; Risk
  Exposure factor
  Impact => Qualitative risk analysis; BIA
Risk register
  Key risk indicators
  Risk owners => Risk register
  Risk threshold => Risk register; Risk tolerance
Risk tolerance
Risk appetite
  Expansionary => Risk appetite
  Conservative => Risk appetite
  Neutral => Risk appetite
Risk management strategies
  Transfer => Risk transference
  Accept
    Exemption => Risk acceptance
    Exception => Risk acceptance
  Avoid => Risk avoidance
  Mitigate => Risk mitigation
Risk reporting => Risk register; Key risk indicator
Business impact analysis
  Recovery time objective (RTO)
  Recovery point objective (RPO)
  Mean time to repair (MTTR)
  Mean time between failures (MTBF)
`],
  ['5.3', 'Explain the processes associated with third-party risk assessment and management.', `
Vendor assessment
  Penetration testing
  Right-to-audit clause
  Evidence of internal audits => Internal audit; Vendor assessment
  Independent assessments => Vendor assessment; External audit
  Supply chain analysis => Supply chain attack; Vendor assessment
Vendor selection
  Due diligence
  Conflict of interest
Agreement types
  Service-level agreement (SLA)
  Memorandum of agreement (MOA)
  Memorandum of understanding (MOU)
  Master service agreement (MSA)
  Work order (WO)/statement of work (SOW)
  Non-disclosure agreement (NDA)
  Business partners agreement (BPA)
Vendor monitoring => Vendor assessment
Questionnaires => Vendor assessment
Rules of engagement
`],
  ['5.4', 'Summarize elements of effective security compliance.', `
Compliance reporting
  Internal => Compliance; Internal audit
  External => Compliance; External audit
Consequences of non-compliance
  Fines => Compliance
  Sanctions => Compliance
  Reputational damage => Compliance
  Loss of license => Compliance
  Contractual impacts => Compliance
Compliance monitoring
  Due diligence/care
  Attestation and acknowledgement => Attestation
  Internal and external => Internal audit; External audit
  Automation => Automation and orchestration; SCAP
Privacy
  Legal implications
    Local/regional => Privacy
    National => Privacy
    Global => Privacy; GDPR
  Data subject
  Controller vs. processor => Data controller; Data processor
  Ownership => Data owner
  Data inventory and retention => Data retention
  Right to be forgotten
`],
  ['5.5', 'Explain types and purposes of audits and assessments.', `
Attestation
Internal
  Compliance
  Audit committee => Internal audit
  Self-assessments
External
  Regulatory => External audit
  Examinations => External audit
  Assessment => External audit
  Independent third-party audit => External audit
Penetration testing
  Physical => Penetration testing
  Offensive => Red team
  Defensive => Blue team
  Integrated => Purple team
  Known environment
  Partially known environment
  Unknown environment
  Reconnaissance
    Passive
    Active
`],
  ['5.6', 'Given a scenario, implement security awareness practices.', `
Phishing
  Campaigns => Phishing simulation
  Recognizing a phishing attempt => Phishing; Phishing simulation
  Responding to reported suspicious messages => Phishing; Security awareness training
Anomalous behavior recognition
  Risky => Security awareness training
  Unexpected => Security awareness training
  Unintentional => Security awareness training
User guidance and training
  Policy/handbooks => Security policy; AUP
  Situational awareness
  Insider threat
  Password management => Password manager; Password policy
  Removable media and cables => Security awareness training
  Social engineering
  Operational security
  Hybrid/remote work environments => Security awareness training
Reporting and monitoring
  Initial => Security awareness training
  Recurring => Security awareness training
Development => Security awareness training
Execution => Security awareness training
`],
];
