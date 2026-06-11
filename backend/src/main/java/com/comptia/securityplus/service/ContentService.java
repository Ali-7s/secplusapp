package com.comptia.securityplus.service;

import com.comptia.securityplus.data.CurriculumData;
import com.comptia.securityplus.entity.GeneratedContentEntity;
import com.comptia.securityplus.model.*;
import com.comptia.securityplus.repository.GeneratedContentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.logging.Logger;

@Service
public class ContentService {

    private static final Logger log = Logger.getLogger(ContentService.class.getName());

    private final ClaudeService claude;
    private final CurriculumData curriculum;
    private final GeneratedContentRepository contentRepo;
    private final ObjectMapper mapper = new ObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        .configure(DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_AS_NULL, true)
        .configure(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES, false);

    private static final String SYSTEM_PROMPT = """
        You are an expert CompTIA Security+ SY0-701 instructor and exam preparation specialist.
        Your questions match the EXACT difficulty level of Jason Dion's practice exams:
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

            CRITICAL: Match EXACTLY the difficulty and style of Jason Dion's practice exams:
            - Include scenario-based questions with detailed context (2-4 paragraphs for hard questions)
            - Make wrong answers plausible — they should be close to correct, require real knowledge to eliminate
            - Mix difficulty: 30%% Easy, 50%% Medium, 20%% Hard
            - Include at least 2 multi-select questions (SELECT TWO/THREE THAT APPLY)
            - Include at least 3 scenario/performance-based questions
            - Test application, not just recall

            Return JSON array:
            [
              {
                "id": "q-uuid",
                "sectionId": "%s",
                "domainId": "domain-id",
                "type": "MULTIPLE_CHOICE|MULTI_SELECT|SCENARIO",
                "scenario": "detailed scenario paragraph (null if no scenario)",
                "stem": "the actual question",
                "options": ["A. option one", "B. option two", "C. option three", "D. option four"],
                "correctAnswer": "A",
                "correctAnswers": ["A","C"],
                "explanation": "detailed explanation of why the correct answer is right AND why wrong answers are wrong",
                "difficulty": "Easy|Medium|Hard",
                "tags": ["tag1", "tag2"],
                "points": 1
              }
            ]
            """,
            count, section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()), sectionId);

        String response = fetchOrGenerate(key, prompt, 10240);
        try {
            return mapper.readValue(response, new TypeReference<List<Question>>() {});
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
            - All distractors must be technically plausible
            - Include performance-based question scenarios
            - Minimum 60%% Medium/Hard difficulty
            - Cover ALL key topics comprehensively
            - Include questions that require cross-topic knowledge

            Return same JSON format as practice questions.
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()));

        String response = fetchOrGenerate(key, prompt, 16384);
        try {
            return mapper.readValue(response, new TypeReference<List<Question>>() {});
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

                Match Jason Dion difficulty exactly:
                - At least 35%% scenario-based questions with detailed context
                - At least 15%% multi-select (SELECT ALL THAT APPLY / SELECT TWO)
                - All wrong answers must be technically plausible
                - Current exam objectives including cloud, IoT, zero trust, SASE
                - Set domainId to "%s" in every question

                Return JSON array using the standard question format.
                """, spec.count(), spec.name(), spec.id(), spec.id());

            String response = claude.callClaude(SYSTEM_PROMPT, prompt, 16384);
            try {
                List<Question> chunk = mapper.readValue(response, new TypeReference<List<Question>>() {});
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

        // Split into 3 batches by letter range to keep each call under the timeout
        String[][] batches = {
            { "A-D", "AAA, ACL, AD, AES, AH, AI, AIS, ALE, AP, API, APT, ARO, ARP, ASLR, ATT&CK, AUP, AV, BASH, BCP, BGP, BIA, BIOS, BPA, BYOD, CA, CAB, CAPTCHA, CBC, CCMP, CERT, CI/CD, CIRT, CMDB, COPE, CPU, CRC, CRL, CSIRT, CSP, CSR, CSRF, CVE, CVSS, CYOD, DAC, DDoS, DEP, DES, DHCP, DLL, DLP, DMZ, DNAT, DNS, DNSSEC, DoS, DRP, DSA" },
            { "E-N", "EAP, ECC, EDR, EF, EFS, EMM, EOL, EOS, ESP, FDE, FIM, FPGA, FTP, FTPS, GRE, HA, HDD, HMAC, HOTP, HSM, HTML, HTTP, HTTPS, HVAC, IaaS, IaC, IAM, ICMP, ICS, IDS, IKE, IM, IMAP, IoT, IP, IPS, IPsec, IR, IRP, ISO, IV, KDC, KEK, KMS, LDAP, LDAPS, MAC, MAM, MBR, MD5, MDM, MFA, MITM, MOA, MOU, MSA, MSP, MSSP, MTBF, MTTR, MTU, NAC, NAT, NDA, NFC, NIDS, NIST, NOC, NTLM, NVD" },
            { "O-Z", "OAUTH, OCSP, OID, OSINT, OT, OVAL, PAM, PAP, PAT, PCI, PEM, PGP, PHI, PII, PKI, PKCS, POP, RADIUS, RAID, RAS, RAT, RBAC, RC4, RDP, RF, RFC, RMF, RPO, RSA, RTO, S/MIME, SaaS, SAML, SCAP, SCSI, SDK, SDLC, SED, SFTP, SHA, SIEM, SIM, SLA, SMB, SMTP, SMTPS, SNMP, SOAP, SOC, SOW, SPF, SQL, SSH, SSL, SSO, SSID, STIG, TAXII, TKIP, TLS, TOTP, TPM, TTPs, UAT, UEFI, UPS, URL, USB, UTM, UEBA, VBA, VPC, VPN, WAF, WEP, WIDS, WPA2, WPA3, XDR, XSRF, XSS, ZTNA" }
        };

        List<Acronym> all = new ArrayList<>();
        for (String[] batch : batches) {
            String prompt = String.format("""
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
                """, batch[1]);

            String response = claude.callClaude(SYSTEM_PROMPT, prompt, 8192);
            try {
                List<Acronym> chunk = mapper.readValue(response, new TypeReference<List<Acronym>>() {});
                all.addAll(chunk);
            } catch (Exception e) {
                log.severe("Failed to parse acronym batch " + batch[0] + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                    + response.substring(0, Math.min(1000, response.length())));
                throw new RuntimeException("Failed to parse acronym batch " + batch[0] + ": " + e.getMessage());
            }
        }

        try {
            persist(key, mapper.writeValueAsString(all));
        } catch (Exception e) {
            log.warning("Could not persist acronyms: " + e.getMessage());
        }
        return all;
    }
}
