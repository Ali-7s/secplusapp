package com.comptia.securityplus.service;

import com.comptia.securityplus.data.CurriculumData;
import com.comptia.securityplus.entity.GeneratedContentEntity;
import com.comptia.securityplus.model.*;
import com.comptia.securityplus.repository.GeneratedContentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Service
public class ContentService {

    private static final Logger log = Logger.getLogger(ContentService.class.getName());

    private final ClaudeService claude;
    private final CurriculumData curriculum;
    private final GeneratedContentRepository contentRepo;
    private final ObjectMapper mapper = new ObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        .configure(DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_AS_NULL, true)
        .configure(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES, false)
        .configure(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS, true);

    private static final String SYSTEM_PROMPT = """
        You are an expert CompTIA Security+ SY0-701 instructor and exam preparation specialist.
        Your questions match the EXACT difficulty level of the official CompTIA Security+ exam:
        - Long scenario-based questions that test real-world application
        - Plausible distractors that require deep understanding to eliminate
        - Current threats, technologies, and compliance standards
        - Questions that cover what the exam ACTUALLY tests (not surface-level recall)
        Always respond ONLY with valid JSON. No markdown, no explanation outside JSON.
        """;

    public ContentService(ClaudeService claude, CurriculumData curriculum,
                          GeneratedContentRepository contentRepo) {
        this.claude = claude;
        this.curriculum = curriculum;
        this.contentRepo = contentRepo;
    }

    // ── Question parse helper ───────────────────────────────────────────────────

    private List<Question> parseQuestions(String response) throws Exception {
        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(response);
        if (root.isArray()) {
            return mapper.convertValue(root, new TypeReference<List<Question>>() {});
        }
        // Claude returned a wrapper object — find the questions array inside it
        for (String field : new String[]{"questions", "Questions", "items", "data"}) {
            if (root.has(field) && root.get(field).isArray()) {
                log.warning("AI returned wrapped object; extracting '" + field + "' array");
                return mapper.convertValue(root.get(field), new TypeReference<List<Question>>() {});
            }
        }
        // No known array field — rethrow the original error with context
        return mapper.readValue(response, new TypeReference<List<Question>>() {});
    }

    // ── DB helpers ─────────────────────────────────────────────────────────────

    private String fetchOrGenerate(String key, String prompt, int maxTokens) {
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            return cached.get().getJsonContent();
        }
        String response = claude.callClaude(SYSTEM_PROMPT, prompt, maxTokens);
        persist(key, response);
        return response;
    }

    private void persist(String key, String json) {
        try {
            contentRepo.save(new GeneratedContentEntity(key, json));
        } catch (Exception e) {
            log.warning("Could not persist content for key=" + key + ": " + e.getMessage());
        }
    }

    public void evict(String key) {
        contentRepo.deleteByContentKey(key);
    }

    public boolean isCached(String key) {
        return contentRepo.findByContentKey(key).isPresent();
    }

    // ── Content lookup ──────────────────────────────────────────────────────────

    private Section findSection(String sectionId) {
        return curriculum.getAllDomains().stream()
            .flatMap(d -> d.getSections().stream())
            .filter(s -> s.getId().equals(sectionId))
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Section not found: " + sectionId));
    }

    // ── Explanation ─────────────────────────────────────────────────────────────

    public ConceptExplanation getExplanation(String sectionId) {
        Section section = findSection(sectionId);
        String key = "explanation:" + sectionId;
        String prompt = String.format("""
            Generate a comprehensive Security+ SY0-701 concept explanation for objective %s: "%s"
            Key topics to cover: %s

            Return JSON matching this exact structure:
            {
              "sectionId": "%s",
              "title": "string",
              "overview": "2-3 sentence overview",
              "detailedExplanation": "comprehensive multi-paragraph explanation (HTML allowed)",
              "keyPoints": ["bullet point 1", "bullet point 2", ...],
              "realWorldExamples": ["example 1", "example 2", ...],
              "examTips": ["tip for the exam 1", "tip 2", ...],
              "commonMistakes": ["mistake students make 1", ...],
              "analogyExplanation": "simple analogy to understand this concept",
              "relatedTopics": ["related section/topic 1", ...]
            }
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()), sectionId);

        String response = fetchOrGenerate(key, prompt, 4096);
        try {
            return mapper.readValue(response, ConceptExplanation.class);
        } catch (Exception e) {
            log.severe("Failed to parse explanation for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse explanation response: " + e.getMessage());
        }
    }

    // ── Flashcards ──────────────────────────────────────────────────────────────

    public List<Flashcard> getFlashcards(String sectionId) {
        Section section = findSection(sectionId);
        String key = "flashcards:" + sectionId;
        String prompt = String.format("""
            Generate 20 high-quality flashcards for Security+ SY0-701 objective %s: "%s"
            Topics: %s
            Key terms: %s

            Include: definitions, concepts, acronyms, and exam-critical distinctions.
            Return JSON array:
            [
              {
                "id": "uuid-string",
                "sectionId": "%s",
                "front": "term or question on card front",
                "back": "detailed answer/definition",
                "category": "Definition|Concept|Acronym|Comparison|Process",
                "difficulty": "Easy|Medium|Hard",
                "mnemonic": "memory trick if applicable, or empty string",
                "examTip": "specific exam tip for this card"
              }
            ]
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()),
            String.join(", ", section.getKeyTerms()), sectionId);

        String response = fetchOrGenerate(key, prompt, 8192);
        try {
            return mapper.readValue(response, new TypeReference<List<Flashcard>>() {});
        } catch (Exception e) {
            log.severe("Failed to parse flashcards for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse flashcards: " + e.getMessage());
        }
    }

    // ── Practice questions ──────────────────────────────────────────────────────

    public List<Question> getPracticeQuestions(String sectionId, int count) {
        Section section = findSection(sectionId);
        String key = "questions:" + sectionId;
        String prompt = String.format("""
            Generate %d CompTIA Security+ SY0-701 practice questions for objective %s: "%s"
            Topics: %s

            CRITICAL: Match EXACTLY the difficulty and style of the official CompTIA Security+ exam:
            - Include scenario-based questions with detailed context (2-4 paragraphs for hard questions)
            - Make wrong answers plausible — they should be close to correct, require real knowledge to eliminate
            - Mix difficulty: 30%% Easy, 50%% Medium, 20%% Hard
            - Include at least 2 multi-select questions (SELECT TWO/THREE THAT APPLY)
            - Include at least 2 scenario-based questions (SCENARIO type with detailed scenario field)
            - Include 1-2 DRAG_DROP matching questions (match terms to definitions or protocols to ports)
            - Include 1-2 ORDER_LIST sequencing questions (put steps or phases in correct order)
            - Test application, not just recall

            Return JSON array. Each question uses ONE of these formats:

            Standard MC/Scenario question:
            {
              "id": "q-<uuid>", "sectionId": "%s", "domainId": "domain-id",
              "type": "MULTIPLE_CHOICE|MULTI_SELECT|SCENARIO",
              "scenario": "paragraph context or null",
              "stem": "the question",
              "options": ["A. option one", "B. option two", "C. option three", "D. option four"],
              "correctAnswer": "A",
              "correctAnswers": ["A","C"],
              "explanation": "why correct and why wrong",
              "difficulty": "Easy|Medium|Hard", "tags": [], "points": 1
            }

            DRAG_DROP matching question (match each term to its definition):
            {
              "id": "q-<uuid>", "sectionId": "%s", "domainId": "domain-id",
              "type": "DRAG_DROP",
              "stem": "Match each term to its correct description",
              "options": [], "correctAnswer": null, "correctAnswers": null,
              "dragPairs": [{"id":"a","label":"AES"},{"id":"b","label":"RSA"},{"id":"c","label":"SHA-256"}],
              "dropTargets": [{"id":"1","label":"Asymmetric key exchange algorithm"},{"id":"2","label":"Symmetric block cipher"},{"id":"3","label":"Cryptographic hash function"}],
              "correctPairs": {"a":"2","b":"1","c":"3"},
              "explanation": "why each pairing is correct",
              "difficulty": "Medium", "tags": [], "points": 1
            }

            ORDER_LIST sequencing question (put steps in correct order):
            {
              "id": "q-<uuid>", "sectionId": "%s", "domainId": "domain-id",
              "type": "ORDER_LIST",
              "stem": "Place these incident response phases in the correct order",
              "options": [], "correctAnswer": null, "correctAnswers": null,
              "orderItems": ["Eradication","Identification","Recovery","Containment","Lessons Learned"],
              "correctOrder": ["Identification","Containment","Eradication","Recovery","Lessons Learned"],
              "explanation": "why this order follows NIST incident response guidelines",
              "difficulty": "Medium", "tags": [], "points": 1
            }
            """,
            count, section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()), sectionId, sectionId, sectionId);

        String response = fetchOrGenerate(key, prompt, 10240);
        try {
            return parseQuestions(response);
        } catch (Exception e) {
            log.severe("Failed to parse questions for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse questions: " + e.getMessage());
        }
    }

    // ── Section exam ────────────────────────────────────────────────────────────

    public List<Question> getSectionExamQuestions(String sectionId) {
        Section section = findSection(sectionId);
        String key = "sectionExam:" + sectionId;
        String prompt = String.format("""
            Generate 25 EXAM-LEVEL CompTIA Security+ SY0-701 section exam questions for objective %s: "%s"
            Topics: %s

            This is a SECTION EXAM — questions must be harder than practice questions.
            Requirements:
            - 40%% scenario-based (detailed real-world scenarios, 2-4 paragraphs each)
            - 20%% multi-select questions (SELECT ALL THAT APPLY or SELECT TWO)
            - 2-3 DRAG_DROP matching questions (match protocols/concepts/terms to descriptions)
            - 2-3 ORDER_LIST sequencing questions (procedures, attack phases, response steps)
            - All distractors must be technically plausible
            - Minimum 60%% Medium/Hard difficulty
            - Cover ALL key topics comprehensively

            Use the same per-question JSON format as practice questions — DRAG_DROP uses dragPairs/dropTargets/correctPairs fields, ORDER_LIST uses orderItems/correctOrder fields, both with options:[].

            IMPORTANT: Return ONLY a raw JSON array. Your response MUST start with `[` and end with `]`.
            Do NOT wrap in an object or add any metadata fields (examTitle, objective, totalQuestions, etc.).
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()));

        String response = fetchOrGenerate(key, prompt, 16384);
        try {
            return parseQuestions(response);
        } catch (Exception e) {
            log.severe("Failed to parse exam questions for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse exam questions: " + e.getMessage());
        }
    }

    // ── Full practice exam ──────────────────────────────────────────────────────

    public List<Question> getFullPracticeExam() {
        String key = "fullExam:all";
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return mapper.readValue(cached.get().getJsonContent(), new TypeReference<List<Question>>() {});
            } catch (Exception e) {
                evict(key);
            }
        }

        // Generate in domain chunks to stay under per-call token limits
        record DomainSpec(String id, String name, int count) {}
        List<DomainSpec> specs = List.of(
            new DomainSpec("domain1", "General Security Concepts", 11),
            new DomainSpec("domain2", "Threats, Vulnerabilities, and Mitigations", 20),
            new DomainSpec("domain3", "Security Architecture", 16),
            new DomainSpec("domain4", "Security Operations", 25),
            new DomainSpec("domain5", "Program Management and Oversight", 18)
        );

        List<Question> all = new ArrayList<>();
        for (DomainSpec spec : specs) {
            String prompt = String.format("""
                Generate %d CompTIA Security+ SY0-701 FULL EXAM questions for %s (%s).

                Match official CompTIA Security+ exam difficulty:
                - At least 35%% scenario-based questions with detailed context
                - At least 15%% multi-select (SELECT ALL THAT APPLY / SELECT TWO)
                - All wrong answers must be technically plausible
                - Current exam objectives including cloud, IoT, zero trust, SASE
                - Set domainId to "%s" in every question

                Return ONLY a raw JSON array. Your response MUST start with `[` and end with `]`.
                Do NOT wrap in an object or add metadata fields.
                """, spec.count(), spec.name(), spec.id(), spec.id());

            String response = claude.callClaude(SYSTEM_PROMPT, prompt, 16384);
            try {
                List<Question> chunk = parseQuestions(response);
                all.addAll(chunk);
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse full exam chunk for " + spec.id() + ": " + e.getMessage());
            }
        }

        // Persist the merged result so subsequent loads are instant
        try {
            persist(key, mapper.writeValueAsString(all));
        } catch (Exception e) {
            log.warning("Could not persist full exam: " + e.getMessage());
        }
        return all;
    }

    // ── Lab ─────────────────────────────────────────────────────────────────────

    public Lab getLab(String sectionId) {
        Section section = findSection(sectionId);
        String key = "lab:" + sectionId;
        String prompt = String.format("""
            Generate a hands-on Security+ SY0-701 lab exercise for objective %s: "%s"
            Topics: %s

            The lab should simulate what a security professional actually does for this topic.
            Include realistic terminal commands where applicable.

            Return JSON:
            {
              "id": "lab-uuid",
              "sectionId": "%s",
              "title": "Lab title",
              "objective": "What you will accomplish",
              "scenario": "Real-world business scenario that requires this lab",
              "background": "Background knowledge needed",
              "steps": [
                {
                  "stepNumber": 1,
                  "title": "Step title",
                  "instruction": "Detailed instruction",
                  "command": "actual command if applicable (or empty string)",
                  "expectedOutput": "what you should see",
                  "hint": "hint if stuck"
                }
              ],
              "tools": ["tool1", "tool2"],
              "difficulty": "Beginner|Intermediate|Advanced",
              "estimatedMinutes": 30,
              "questions": [
                {
                  "question": "Lab comprehension question 1",
                  "answer": "correct answer",
                  "explanation": "detailed explanation"
                }
              ],
              "walkthrough": "Full walkthrough explanation with key security concepts reinforced"
            }
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()), sectionId);

        String response = fetchOrGenerate(key, prompt, 16384);
        try {
            return mapper.readValue(response, Lab.class);
        } catch (Exception e) {
            log.severe("Failed to parse lab for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse lab: " + e.getMessage());
        }
    }

    // ── Acronyms ────────────────────────────────────────────────────────────────

    public List<Acronym> getAcronyms() {
        String key = "acronyms:all";
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return mapper.readValue(cached.get().getJsonContent(), new TypeReference<List<Acronym>>() {});
            } catch (Exception e) {
                evict(key);
            }
        }

        // 7 smaller batches (~28 acronyms each) run in parallel — keeps each call
        // fast enough to avoid the Railway 60-second nginx timeout.
        String[][] batches = {
            { "A-C1", "AAA, ACL, AD, AES, AH, AI, AIS, ALE, AP, API, APT, ARO, ARP, ASLR, ATT&CK, AUP, AV, BASH, BCP, BGP, BIA, BIOS, BPA, BYOD, CA, CAB, CAPTCHA, CBC" },
            { "C2-D", "CCMP, CERT, CI/CD, CIRT, CMDB, COPE, CPU, CRC, CRL, CSIRT, CSP, CSR, CSRF, CVE, CVSS, CYOD, DAC, DDoS, DEP, DES, DHCP, DLL, DLP, DMZ, DNAT, DNS, DNSSEC, DoS, DRP, DSA" },
            { "E-I",  "EAP, ECC, EDR, EF, EFS, EMM, EOL, EOS, ESP, FDE, FIM, FPGA, FTP, FTPS, GRE, HA, HDD, HMAC, HOTP, HSM, HTML, HTTP, HTTPS, HVAC, IaaS, IaC, IAM, ICMP, ICS, IDS" },
            { "IK-N", "IKE, IM, IMAP, IoT, IP, IPS, IPsec, IR, IRP, ISO, IV, KDC, KEK, KMS, LDAP, LDAPS, MAC, MAM, MBR, MD5, MDM, MFA, MITM, MOA, MOU, MSA, MSP, MSSP, MTBF, MTTR, MTU, NAC, NAT, NDA, NFC, NIDS, NIST, NOC, NTLM, NVD" },
            { "O-R",  "OAUTH, OCSP, OID, OSINT, OT, OVAL, PAM, PAP, PAT, PCI, PEM, PGP, PHI, PII, PKI, PKCS, POP, RADIUS, RAID, RAS, RAT, RBAC, RC4, RDP, RF, RFC, RMF, RPO, RSA, RTO" },
            { "S",    "S/MIME, SaaS, SAML, SCAP, SCSI, SDK, SDLC, SED, SFTP, SHA, SIEM, SIM, SLA, SMB, SMTP, SMTPS, SNMP, SOAP, SOC, SOW, SPF, SQL, SSH, SSL, SSO, SSID, STIG" },
            { "T-Z",  "TAXII, TKIP, TLS, TOTP, TPM, TTPs, UAT, UEFI, UPS, URL, USB, UTM, UEBA, VBA, VPC, VPN, WAF, WEP, WIDS, WPA2, WPA3, XDR, XSRF, XSS, ZTNA" }
        };

        final String promptTemplate = """
                Generate Security+ SY0-701 acronym definitions for EXACTLY this list: %s

                Return a JSON array — one entry per acronym in the list above, no additions or omissions:
                [
                  {
                    "acronym": "AAA",
                    "expansion": "Authentication, Authorization, and Accounting",
                    "definition": "Framework for controlling access and tracking activity on a network",
                    "category": "Access Control",
                    "examContext": "How this appears on the exam and what to know",
                    "relatedAcronyms": "RADIUS, TACACS+"
                  }
                ]
                Valid category values: Access Control, Cryptography, Network, Protocol, Compliance, Attack, Tool, Cloud, Identity
                """;

        // Fire all batches concurrently — total latency = slowest single call (~15s)
        // instead of sum of all calls (~90s) which triggers Railway's 60s timeout.
        List<CompletableFuture<List<Acronym>>> futures = Arrays.stream(batches)
            .map(batch -> {
                String prompt = String.format(promptTemplate, batch[1]);
                String batchName = batch[0];
                return CompletableFuture.supplyAsync(() -> {
                    String response = claude.callClaude(SYSTEM_PROMPT, prompt, 8192);
                    try {
                        return mapper.<List<Acronym>>readValue(response, new TypeReference<List<Acronym>>() {});
                    } catch (Exception e) {
                        log.severe("Failed to parse acronym batch " + batchName + ": " + e.getMessage()
                            + ". Response start: " + response.substring(0, Math.min(500, response.length())));
                        throw new RuntimeException("Failed to parse acronym batch " + batchName + ": " + e.getMessage());
                    }
                });
            })
            .collect(Collectors.toList());

        List<Acronym> all = futures.stream()
            .map(CompletableFuture::join)   // waits for all; throws CompletionException on any failure
            .flatMap(List::stream)
            .collect(Collectors.toList());

        try {
            persist(key, mapper.writeValueAsString(all));
        } catch (Exception e) {
            log.warning("Could not persist acronyms: " + e.getMessage());
        }
        return all;
    }

    public AcronymDetail getAcronymDetail(String acronym, String expansion) {
        String key = "acronym_detail:" + acronym;
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return mapper.readValue(cached.get().getJsonContent(), AcronymDetail.class);
            } catch (Exception e) {
                evict(key);
            }
        }

        String prompt = String.format("""
                For the Security+ SY0-701 acronym "%s" (%s):
                Return ONLY this JSON object — no markdown, no code fences, nothing else:
                {
                  "practicalScenario": "2-3 sentence real-world scenario using a specific person name (Alex, Maria, Sam). Describe exactly what they configure/implement and the concrete security outcome.",
                  "quizQuestion": "A realistic exam-style scenario question testing application of this concept — not just its definition. 1-2 sentences.",
                  "quizOptions": ["A) ...", "B) ...", "C) ...", "D) ..."],
                  "quizAnswer": "B"
                }
                Rules:
                - quizAnswer must be exactly one letter (A, B, C, or D) matching the correct option
                - All four options must be plausible distractors — related concepts the student might confuse
                - Do not make the answer obvious from the question stem alone
                """, acronym, expansion);

        String response = claude.callClaude(SYSTEM_PROMPT, prompt, 1024);
        try {
            AcronymDetail detail = mapper.readValue(response, AcronymDetail.class);
            persist(key, mapper.writeValueAsString(detail));
            return detail;
        } catch (Exception e) {
            log.severe("Failed to parse acronym detail for " + acronym + ": " + e.getMessage()
                + ". Response: " + response.substring(0, Math.min(300, response.length())));
            throw new RuntimeException("Failed to generate detail for " + acronym + ": " + e.getMessage());
        }
    }

    // ── Terms ──────────────────────────────────────────────────────────────────

    public List<Term> getTerms() {
        String key = "terms:all";
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return mapper.readValue(cached.get().getJsonContent(), new TypeReference<List<Term>>() {});
            } catch (Exception e) {
                evict(key);
            }
        }

        // 6 parallel batches of ~22 terms each
        String[][] batches = {
            { "core",     "Confidentiality, Integrity, Availability, Non-repudiation, Authentication, Authorization, Accountability, CIA triad, Defense in depth, Least privilege, Separation of duties, Need to know, Zero trust, Fail secure, Fail open, Implicit deny, Due diligence, Due care, Governance, Risk management, Privacy, Data sovereignty" },
            { "threats",  "Threat actor, Vulnerability, Threat, Risk, Exploit, Attack vector, Attack surface, Zero-day, Social engineering, Phishing, Spear phishing, Whaling, Vishing, Smishing, Pretexting, Tailgating, Shoulder surfing, Dumpster diving, Watering hole attack, Supply chain attack, Insider threat, Advanced persistent threat" },
            { "malware",  "Malware, Ransomware, Spyware, Rootkit, Keylogger, Worm, Virus, Trojan horse, Backdoor, Botnet, Logic bomb, Cryptojacking, Steganography, Obfuscation, Privilege escalation, Lateral movement, Persistence, Exfiltration, Pivoting, Command and control, Pass-the-hash, Man-in-the-middle attack, Buffer overflow" },
            { "crypto",   "Encryption, Symmetric encryption, Asymmetric encryption, Hashing, Salting, Digital signature, Certificate, Public key, Private key, Key exchange, Key escrow, Key stretching, Block cipher, Stream cipher, Cipher suite, Perfect forward secrecy, Tokenization, Data masking, Certificate authority, Chain of trust, Replay attack, Hybrid encryption" },
            { "network",  "Firewall, Stateful inspection, Packet filtering, Proxy server, Honeypot, Honeynet, Network segmentation, Microsegmentation, Network tap, Port mirroring, Hardening, Baseline configuration, Patch management, Vulnerability scanning, Penetration testing, Red team, Blue team, Purple team, Threat hunting, Threat intelligence, Indicator of compromise" },
            { "identity", "Federation, Single sign-on, Multifactor authentication, Biometrics, Smart card, Account lockout, Role-based access control, Mandatory access control, Discretionary access control, Incident response, Business continuity, Disaster recovery, Fault tolerance, High availability, Load balancing, Failover, Change management, Data classification, Data loss prevention, Brute force attack, Dictionary attack, Credential stuffing" }
        };

        final String promptTemplate = """
                Generate Security+ SY0-701 term definitions for EXACTLY this list: %s

                Return a JSON array — one entry per term in the list above, no additions or omissions:
                [
                  {
                    "term": "Non-repudiation",
                    "definition": "The assurance that an entity cannot deny having performed an action such as sending a message or completing a transaction",
                    "category": "Core Concepts",
                    "examContext": "Frequently tested with digital signatures and audit logs — requires both authentication and integrity controls",
                    "analogy": "Like a signed receipt: the signature proves you received the package and you cannot later claim you did not",
                    "relatedTerms": "Digital signature, Authentication, Integrity, Accountability"
                  }
                ]
                Valid category values: Core Concepts, Cryptography, Network Security, Threat Intelligence, Attack Types, Malware, Identity & Access, Governance, Incident Response, Architecture
                """;

        List<CompletableFuture<List<Term>>> futures = Arrays.stream(batches)
            .map(batch -> {
                String prompt = String.format(promptTemplate, batch[1]);
                String batchName = batch[0];
                return CompletableFuture.supplyAsync(() -> {
                    String response = claude.callClaude(SYSTEM_PROMPT, prompt, 8192);
                    try {
                        return mapper.<List<Term>>readValue(response, new TypeReference<List<Term>>() {});
                    } catch (Exception e) {
                        log.severe("Failed to parse term batch " + batchName + ": " + e.getMessage()
                            + ". Response start: " + response.substring(0, Math.min(500, response.length())));
                        throw new RuntimeException("Failed to parse term batch " + batchName + ": " + e.getMessage());
                    }
                });
            })
            .collect(Collectors.toList());

        List<Term> all = futures.stream()
            .map(CompletableFuture::join)
            .flatMap(List::stream)
            .collect(Collectors.toList());

        try {
            persist(key, mapper.writeValueAsString(all));
        } catch (Exception e) {
            log.warning("Could not persist terms: " + e.getMessage());
        }
        return all;
    }

    /**
     * Generates definitions for terms that are referenced as related-terms
     * but don't yet have cards. Appends to the terms:all cache.
     */
    public List<Term> generateMissingTerms(List<String> requestedNames) {
        if (requestedNames == null || requestedNames.isEmpty()) return Collections.emptyList();

        // Load existing terms from cache
        List<Term> existing = new ArrayList<>();
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey("terms:all");
        if (cached.isPresent()) {
            try {
                existing = mapper.readValue(cached.get().getJsonContent(), new TypeReference<List<Term>>() {});
            } catch (Exception e) {
                log.warning("Could not parse existing terms for gap-fill: " + e.getMessage());
            }
        }

        Set<String> existingLower = existing.stream()
            .map(t -> t.getTerm().toLowerCase())
            .collect(Collectors.toSet());

        // De-duplicate and filter to truly missing names
        List<String> toGenerate = requestedNames.stream()
            .map(String::trim)
            .filter(n -> !n.isEmpty())
            .distinct()
            .filter(n -> !existingLower.contains(n.toLowerCase()))
            .collect(Collectors.toList());

        if (toGenerate.isEmpty()) return Collections.emptyList();

        log.info("Generating " + toGenerate.size() + " missing terms: " + toGenerate);

        // Batch into groups of 12 and run in parallel
        final int BATCH = 12;
        List<List<String>> batches = new ArrayList<>();
        for (int i = 0; i < toGenerate.size(); i += BATCH) {
            batches.add(toGenerate.subList(i, Math.min(i + BATCH, toGenerate.size())));
        }

        final String promptTemplate = """
                Generate Security+ SY0-701 term definitions for EXACTLY this list: %s

                Return a JSON array — one entry per term in the list above, no additions or omissions:
                [
                  {
                    "term": "Non-repudiation",
                    "definition": "The assurance that an entity cannot deny having performed an action such as sending a message or completing a transaction",
                    "category": "Core Concepts",
                    "examContext": "Frequently tested with digital signatures and audit logs — requires both authentication and integrity controls",
                    "analogy": "Like a signed receipt: the signature proves you received the package and you cannot later claim you did not",
                    "relatedTerms": "Digital signature, Authentication, Integrity, Accountability"
                  }
                ]
                Valid category values: Core Concepts, Cryptography, Network Security, Threat Intelligence, Attack Types, Malware, Identity & Access, Governance, Incident Response, Architecture
                """;

        List<CompletableFuture<List<Term>>> futures = batches.stream()
            .map(batch -> {
                String prompt = String.format(promptTemplate, String.join(", ", batch));
                return CompletableFuture.supplyAsync(() -> {
                    String response = claude.callClaude(SYSTEM_PROMPT, prompt, 8192);
                    try {
                        return mapper.<List<Term>>readValue(response, new TypeReference<List<Term>>() {});
                    } catch (Exception e) {
                        log.warning("Failed to parse missing term batch " + batch + ": " + e.getMessage()
                            + ". Response: " + response.substring(0, Math.min(300, response.length())));
                        return new ArrayList<Term>();
                    }
                });
            })
            .collect(Collectors.toList());

        List<Term> newTerms = futures.stream()
            .map(CompletableFuture::join)
            .flatMap(List::stream)
            .collect(Collectors.toList());

        if (!newTerms.isEmpty()) {
            List<Term> combined = new ArrayList<>(existing);
            combined.addAll(newTerms);
            evict("terms:all");
            try {
                persist("terms:all", mapper.writeValueAsString(combined));
            } catch (Exception e) {
                log.warning("Could not persist updated terms after gap-fill: " + e.getMessage());
            }
        }

        return newTerms;
    }

    public AcronymDetail getTermDetail(String term, String definition) {
        String key = "term_detail:" + term.toLowerCase().replaceAll("[^a-z0-9]", "_");
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return mapper.readValue(cached.get().getJsonContent(), AcronymDetail.class);
            } catch (Exception e) {
                evict(key);
            }
        }

        String prompt = String.format("""
                For the Security+ SY0-701 concept "%s" (%s):
                Return ONLY this JSON object — no markdown, no code fences, nothing else:
                {
                  "practicalScenario": "2-3 sentence real-world scenario using a specific person name (Alex, Maria, Sam). Describe exactly what they configure/implement and the concrete security outcome.",
                  "quizQuestion": "A realistic exam-style scenario question testing application of this concept — not just its definition. 1-2 sentences.",
                  "quizOptions": ["A) ...", "B) ...", "C) ...", "D) ..."],
                  "quizAnswer": "B"
                }
                Rules:
                - quizAnswer must be exactly one letter (A, B, C, or D) matching the correct option
                - All four options must be plausible distractors — related concepts a student might confuse
                - Do not make the answer obvious from the question stem alone
                """, term, definition);

        String response = claude.callClaude(SYSTEM_PROMPT, prompt, 1024);
        try {
            AcronymDetail detail = mapper.readValue(response, AcronymDetail.class);
            persist(key, mapper.writeValueAsString(detail));
            return detail;
        } catch (Exception e) {
            log.severe("Failed to parse term detail for " + term + ": " + e.getMessage()
                + ". Response: " + response.substring(0, Math.min(300, response.length())));
            throw new RuntimeException("Failed to generate detail for term " + term + ": " + e.getMessage());
        }
    }
}
