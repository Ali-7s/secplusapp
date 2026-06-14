package com.comptia.securityplus.service;

import com.comptia.securityplus.data.CurriculumData;
import com.comptia.securityplus.entity.GeneratedContentEntity;
import com.comptia.securityplus.model.*;
import com.comptia.securityplus.repository.GeneratedContentRepository;
import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Service
public class ContentService {

    private static final Logger log = Logger.getLogger(ContentService.class.getName());

    private final ClaudeService claude;
    private final CurriculumData curriculum;
    private final GeneratedContentRepository contentRepo;
    // Lenient on purpose: the AI occasionally emits not-quite-valid JSON (unquoted keys,
    // single quotes, trailing commas, comments, raw control chars). Tolerate it rather than
    // throw away an otherwise-good 25-question exam.
    private final ObjectMapper mapper = JsonMapper.builder()
        .enable(JsonReadFeature.ALLOW_UNQUOTED_FIELD_NAMES)
        .enable(JsonReadFeature.ALLOW_SINGLE_QUOTES)
        .enable(JsonReadFeature.ALLOW_TRAILING_COMMA)
        .enable(JsonReadFeature.ALLOW_JAVA_COMMENTS)
        .enable(JsonReadFeature.ALLOW_YAML_COMMENTS)
        .enable(JsonReadFeature.ALLOW_UNESCAPED_CONTROL_CHARS)
        .enable(JsonReadFeature.ALLOW_BACKSLASH_ESCAPING_ANY_CHARACTER)
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        .configure(DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_AS_NULL, true)
        .configure(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES, false)
        .enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
        .build();

    // ── Async generation ────────────────────────────────────────────────────────
    // Exam generation can take minutes. Holding the HTTP request open that long
    // trips client/proxy/platform timeouts (broken pipe). Instead we generate in a
    // background thread and let the client poll: the first call kicks off work and
    // returns GENERATING; later calls return READY (from cache) or ERROR.
    public enum GenStatus { READY, GENERATING, ERROR }
    public record AsyncContent<T>(GenStatus status, T data, String error) {}

    private final ExecutorService genPool = Executors.newFixedThreadPool(3, r -> {
        Thread t = new Thread(r, "content-gen");
        t.setDaemon(true);   // don't block JVM shutdown
        return t;
    });
    private final Set<String> genInProgress = ConcurrentHashMap.newKeySet();
    private final Map<String, String> genErrors = new ConcurrentHashMap<>();

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
        JsonNode root = mapper.readTree(response);

        // Locate the questions array — bare array, or wrapped inside a metadata object
        JsonNode arrayNode = null;
        if (root.isArray()) {
            arrayNode = root;
        } else {
            for (String field : new String[]{"questions", "Questions", "items", "data"}) {
                if (root.has(field) && root.get(field).isArray()) {
                    log.warning("AI returned wrapped object; extracting '" + field + "' array");
                    arrayNode = root.get(field);
                    break;
                }
            }
        }
        if (arrayNode == null) {
            // No recognizable array — let readValue throw with full context for the log
            return mapper.readValue(response, new TypeReference<List<Question>>() {});
        }

        // Coerce known AI-drift shapes into what the Question model expects, BEFORE binding.
        // This is independent of Jackson annotations (which convertValue does not always honor).
        for (JsonNode n : arrayNode) {
            if (n.isObject()) normalizeQuestionNode((ObjectNode) n);
        }
        return mapper.convertValue(arrayNode, new TypeReference<List<Question>>() {});
    }

    /** Rewrite a single question node so the AI's looser JSON binds cleanly to {@link Question}. */
    private void normalizeQuestionNode(ObjectNode q) {
        // 1. stem: accept "question"/"prompt"/"text"/"q" as aliases
        if (!q.hasNonNull("stem")) {
            for (String alt : new String[]{"question", "prompt", "text", "q"}) {
                if (q.hasNonNull(alt)) { q.set("stem", q.get(alt)); break; }
            }
        }

        // 2. type: normalize to UPPER_SNAKE so it matches the enum (e.g. "scenario", "drag-drop")
        if (q.hasNonNull("type") && q.get("type").isTextual()) {
            q.put("type", q.get("type").asText().trim().toUpperCase().replace('-', '_').replace(' ', '_'));
        }

        // 3. correctAnswer: AI sometimes sends ["B"] — take the first element; preserve the rest
        JsonNode ca = q.get("correctAnswer");
        if (ca != null && ca.isArray()) {
            if (!q.hasNonNull("correctAnswers") && ca.size() > 1) {
                q.set("correctAnswers", ca.deepCopy());   // multi-answer leaked into correctAnswer
            }
            q.put("correctAnswer", ca.size() > 0 ? ca.get(0).asText() : null);
        }

        // 4. correctPairs: must be an object map {dragId: targetId}; salvage if sent as an array
        JsonNode cp = q.get("correctPairs");
        if (cp != null && cp.isArray()) {
            ObjectNode map = mapper.createObjectNode();
            for (JsonNode pair : cp) {
                if (!pair.isObject()) continue;
                String k = firstText(pair, "key", "from", "left", "pairId", "dragId", "drag", "source", "id");
                String v = firstText(pair, "value", "to", "right", "targetId", "dropId", "drop", "target", "definition", "match");
                if (k != null && v != null) { map.put(k, v); continue; }
                if (pair.size() == 1) {   // single-entry object like {"a":"2"}
                    String f = pair.fieldNames().next();
                    map.put(f, pair.get(f).asText());
                }
            }
            if (map.size() > 0) q.set("correctPairs", map); else q.remove("correctPairs");
        }

        // 5. String-array fields: coerce a stray scalar to an array, and flatten
        //    array-of-objects (e.g. orderItems:[{"step":"..."}]) down to plain strings
        for (String f : new String[]{"options", "correctAnswers", "correctOrder", "orderItems", "tags"}) {
            JsonNode v = q.get(f);
            if (v == null || v.isNull()) continue;
            if (v.isArray()) {
                boolean allStrings = true;
                for (JsonNode el : v) { if (!el.isTextual()) { allStrings = false; break; } }
                if (allStrings) continue;                       // already clean
                ArrayNode cleaned = mapper.createArrayNode();
                for (JsonNode el : v) {
                    if (el.isValueNode()) {
                        cleaned.add(el.asText());
                    } else if (el.isObject()) {
                        String t = firstText(el, "text", "step", "item", "label", "value", "name", "option", "title");
                        if (t == null && el.size() == 1) {      // single-field object {"1":"..."}
                            String fn = el.fieldNames().next();
                            if (el.get(fn).isValueNode()) t = el.get(fn).asText();
                        }
                        if (t != null) cleaned.add(t);
                    }
                    // nested arrays are dropped
                }
                q.set(f, cleaned);
            } else if (v.isValueNode()) {
                ArrayNode arr = mapper.createArrayNode();
                arr.add(v.asText());
                q.set(f, arr);
            } else {
                q.remove(f);
            }
        }

        // 6. Options MUST carry an "A. " / "B. " letter prefix — the UI badge, the
        //    answer the user submits, and grading all key off that leading letter.
        //    The AI sometimes omits it (e.g. on the full exam), which both garbles
        //    the display (first chars sliced off) and breaks grading. Add prefixes
        //    by position when missing, and remap any full-text answers to letters.
        JsonNode opts = q.get("options");
        if (opts != null && opts.isArray() && opts.size() > 0) {
            boolean anyMissing = false;
            for (JsonNode o : opts) {
                if (!o.isTextual() || !o.asText().strip().matches("^[A-Za-z][.)]\\s.*")) { anyMissing = true; break; }
            }
            if (anyMissing) {
                ArrayNode newOpts = mapper.createArrayNode();
                Map<String, String> textToLetter = new HashMap<>();
                for (int i = 0; i < opts.size() && i < 26; i++) {
                    String letter = String.valueOf((char) ('A' + i));
                    String raw = opts.get(i).asText().strip();
                    String text = raw.replaceFirst("^[A-Za-z][.)]\\s+", "");   // drop any partial prefix
                    newOpts.add(letter + ". " + text);
                    textToLetter.put(raw.toLowerCase(), letter);
                    textToLetter.put(text.toLowerCase(), letter);
                }
                q.set("options", newOpts);
                remapAnswerToLetter(q, "correctAnswer", textToLetter);
                remapAnswersToLetters(q, "correctAnswers", textToLetter);
            }
        }
    }

    /** If a correctAnswer holds full option text (not a letter), convert it to the option's letter. */
    private void remapAnswerToLetter(ObjectNode q, String field, Map<String, String> textToLetter) {
        JsonNode node = q.get(field);
        if (node == null || !node.isTextual()) return;
        String val = node.asText().strip();
        if (val.length() == 1 && Character.isLetter(val.charAt(0))) return;   // already a letter
        String letter = textToLetter.get(val.toLowerCase());
        if (letter == null) letter = textToLetter.get(val.replaceFirst("^[A-Za-z][.)]\\s+", "").toLowerCase());
        if (letter != null) q.put(field, letter);
    }

    private void remapAnswersToLetters(ObjectNode q, String field, Map<String, String> textToLetter) {
        JsonNode node = q.get(field);
        if (node == null || !node.isArray()) return;
        ArrayNode out = mapper.createArrayNode();
        for (JsonNode el : node) {
            String val = el.asText().strip();
            if (val.length() == 1 && Character.isLetter(val.charAt(0))) { out.add(val); continue; }
            String letter = textToLetter.get(val.toLowerCase());
            if (letter == null) letter = textToLetter.get(val.replaceFirst("^[A-Za-z][.)]\\s+", "").toLowerCase());
            out.add(letter != null ? letter : val);
        }
        q.set(field, out);
    }

    private String firstText(JsonNode obj, String... keys) {
        for (String k : keys) {
            if (obj.hasNonNull(k) && obj.get(k).isValueNode()) return obj.get(k).asText();
        }
        return null;
    }

    // ── DB helpers ─────────────────────────────────────────────────────────────

    private String fetchOrGenerate(String key, String prompt, int maxTokens) {
        return fetchOrGenerate(key, SYSTEM_PROMPT, prompt, maxTokens);
    }

    private String fetchOrGenerate(String key, String systemPrompt, String prompt, int maxTokens) {
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            return cached.get().getJsonContent();
        }
        String response = claude.callClaude(systemPrompt, prompt, maxTokens);
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
            - When the objective involves networking, firewalls, ports, traffic, or logs, include 1-2
              ADVANCED PBQs from: FIREWALL_RULES, NETWORK_PLACEMENT, LOG_ANALYSIS (otherwise skip them)
            - Test application, not just recall

            FIELD RULES (must follow exactly):
            - "correctAnswer" is a SINGLE string (e.g. "A"), never an array.
            - "correctAnswers" is an array of strings, used ONLY for MULTI_SELECT.
            - "correctPairs" is a JSON object map {"dragId":"targetId"}, never an array.
            - "type" is UPPERCASE: MULTIPLE_CHOICE, MULTI_SELECT, SCENARIO, DRAG_DROP, ORDER_LIST,
              FIREWALL_RULES, NETWORK_PLACEMENT, or LOG_ANALYSIS.
            - The question text field is named "stem", not "question".
            - FIREWALL_RULES: "firewallColumns" names the columns; "firewallOptions" maps each column to its
              dropdown values; "correctRules" is an ORDERED list of rows where EVERY value is one of that
              column's firewallOptions. Use 3-6 rows and end with a deny-all catch-all.
            - LOG_ANALYSIS: include a realistic multi-line "logText" plus standard options/correctAnswer
              (it is graded exactly like MULTIPLE_CHOICE).
            - NETWORK_PLACEMENT: uses the SAME fields as DRAG_DROP (dragPairs/dropTargets/correctPairs).

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

            FIREWALL_RULES question (build an ACL to satisfy the stated requirements):
            {
              "id": "q-<uuid>", "domainId": "domain-id",
              "type": "FIREWALL_RULES",
              "stem": "Configure the firewall to: (1) allow HTTPS from any host to the Web Server, (2) allow SSH to the Web Server only from the admin subnet 10.0.0.0/24, (3) deny everything else.",
              "options": [], "correctAnswer": null,
              "firewallColumns": ["Source","Destination","Service","Action"],
              "firewallOptions": {
                "Source": ["Any","10.0.0.0/24","192.168.1.0/24","Web Server"],
                "Destination": ["Any","Web Server","Database"],
                "Service": ["HTTPS (443)","SSH (22)","MySQL (3306)","Any"],
                "Action": ["Allow","Deny"]
              },
              "correctRules": [
                {"Source":"Any","Destination":"Web Server","Service":"HTTPS (443)","Action":"Allow"},
                {"Source":"10.0.0.0/24","Destination":"Web Server","Service":"SSH (22)","Action":"Allow"},
                {"Source":"Any","Destination":"Any","Service":"Any","Action":"Deny"}
              ],
              "explanation": "Specific allow rules come first; an implicit deny-all closes the list.",
              "difficulty": "Hard", "tags": [], "points": 1
            }

            LOG_ANALYSIS question (identify the attack from a log — graded like MULTIPLE_CHOICE):
            {
              "id": "q-<uuid>", "domainId": "domain-id",
              "type": "LOG_ANALYSIS",
              "stem": "Review the authentication log. Which attack is most likely in progress?",
              "logText": "09:14:01 sshd: Failed password for root from 203.0.113.7\\n09:14:02 sshd: Failed password for admin from 203.0.113.7\\n09:14:02 sshd: Failed password for oracle from 203.0.113.7\\n09:14:03 sshd: Failed password for root from 203.0.113.7",
              "options": ["A. Password spraying / brute force","B. SQL injection","C. Cross-site scripting","D. ARP poisoning"],
              "correctAnswer": "A",
              "explanation": "Many rapid failed logins from one IP across multiple accounts indicate brute forcing.",
              "difficulty": "Medium", "tags": [], "points": 1
            }

            NETWORK_PLACEMENT question (place security devices in a topology — same fields as DRAG_DROP):
            {
              "id": "q-<uuid>", "domainId": "domain-id",
              "type": "NETWORK_PLACEMENT",
              "stem": "Place each security device at the correct point in the network.",
              "options": [], "correctAnswer": null,
              "dragPairs": [{"id":"fw","label":"Next-Gen Firewall"},{"id":"ids","label":"IDS Sensor"},{"id":"lb","label":"Load Balancer"}],
              "dropTargets": [{"id":"edge","label":"Internet edge, before the DMZ"},{"id":"mon","label":"SPAN port monitoring internal traffic"},{"id":"web","label":"In front of the web server farm"}],
              "correctPairs": {"fw":"edge","ids":"mon","lb":"web"},
              "explanation": "Firewall at the edge, IDS on a monitoring port, load balancer ahead of the web farm.",
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

    // ── Async generation plumbing ────────────────────────────────────────────────

    /**
     * Return cached questions if ready, otherwise kick off generation in the
     * background and report progress. Never blocks on the Claude call, so the HTTP
     * request returns immediately and the client polls instead of holding a
     * minutes-long connection open.
     */
    private AsyncContent<List<Question>> asyncQuestions(String key, Runnable generator) {
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                return new AsyncContent<>(GenStatus.READY, parseQuestions(cached.get().getJsonContent()), null);
            } catch (Exception e) {
                log.warning("Cached content for " + key + " unparseable, regenerating: " + e.getMessage());
                evict(key);
            }
        }
        // Surface (and clear) an error from a prior attempt so the next poll retries
        String err = genErrors.remove(key);
        if (err != null) return new AsyncContent<>(GenStatus.ERROR, null, err);

        // Atomically claim the work — only the first caller submits the job
        if (genInProgress.add(key)) {
            genPool.submit(() -> {
                try {
                    generator.run();
                } catch (Exception e) {
                    log.severe("Background generation failed for " + key + ": " + e.getMessage());
                    genErrors.put(key, e.getMessage());
                } finally {
                    genInProgress.remove(key);
                }
            });
        }
        return new AsyncContent<>(GenStatus.GENERATING, null, null);
    }

    // ── Section exam ────────────────────────────────────────────────────────────

    public AsyncContent<List<Question>> getSectionExamAsync(String sectionId) {
        String key = "sectionExam:" + sectionId;
        return asyncQuestions(key, () -> generateAndCacheSectionExam(sectionId));
    }

    /** Synchronous accessor used at grading time, when the exam is already cached. */
    public List<Question> getSectionExamQuestions(String sectionId) {
        Section section = findSection(sectionId);
        String key = "sectionExam:" + sectionId;
        String response = fetchOrGenerate(key, buildSectionExamPrompt(section), 16384);
        try {
            return parseQuestions(response);
        } catch (Exception e) {
            evict(key);
            throw new RuntimeException("Failed to parse exam questions: " + e.getMessage());
        }
    }

    private void generateAndCacheSectionExam(String sectionId) {
        Section section = findSection(sectionId);
        String key = "sectionExam:" + sectionId;
        String prompt = buildSectionExamPrompt(section);
        String response = fetchOrGenerate(key, prompt, 16384);
        try {
            parseQuestions(response);   // validate before leaving it cached
        } catch (Exception e) {
            log.severe("Failed to parse exam questions for " + sectionId + ". " + e.getClass().getSimpleName() + ": " + e.getMessage() + ". Response (first 1000 chars): "
                + response.substring(0, Math.min(1000, response.length())));
            evict(key);
            throw new RuntimeException("Failed to parse exam questions: " + e.getMessage());
        }
    }

    private String buildSectionExamPrompt(Section section) {
        return String.format("""
            Generate 25 EXAM-LEVEL CompTIA Security+ SY0-701 section exam questions for objective %s: "%s"
            Topics: %s

            This is a SECTION EXAM — questions must be harder than practice questions.
            Requirements:
            - 40%% scenario-based (detailed real-world scenarios, 2-4 paragraphs each)
            - 20%% multi-select questions (SELECT ALL THAT APPLY or SELECT TWO)
            - 2-3 DRAG_DROP matching questions (match protocols/concepts/terms to descriptions)
            - 2-3 ORDER_LIST sequencing questions (procedures, attack phases, response steps)
            - When the objective involves networking, firewalls, ports, traffic, or logs, ALSO include
              1-2 of: FIREWALL_RULES, NETWORK_PLACEMENT, LOG_ANALYSIS
            - All distractors must be technically plausible
            - Minimum 60%% Medium/Hard difficulty
            - Cover ALL key topics comprehensively

            Per-question JSON format (options:[] for the PBQ types that have no options):
            - DRAG_DROP / NETWORK_PLACEMENT: dragPairs:[{id,label}], dropTargets:[{id,label}], correctPairs:{dragId:targetId}
            - ORDER_LIST: orderItems:[...], correctOrder:[...]
            - FIREWALL_RULES: firewallColumns:[...], firewallOptions:{column:[...]}, correctRules:[{column:value}]
              (every correctRules value MUST be one of that column's firewallOptions; 3-6 rows; end with a deny-all)
            - LOG_ANALYSIS: a multi-line "logText" plus standard options + correctAnswer (graded like MULTIPLE_CHOICE)

            FIELD RULES (must follow exactly):
            - "correctAnswer" is a SINGLE string (e.g. "A"), never an array.
            - "correctAnswers" is an array of strings, used ONLY for MULTI_SELECT.
            - "correctPairs" is a JSON object map {"dragId":"targetId"}, never an array.
            - Each options entry MUST start with its letter ("A. ", "B. ", ...).
            - "type" is UPPERCASE; the question text field is named "stem", not "question".

            IMPORTANT: Return ONLY a raw JSON array. Your response MUST start with `[` and end with `]`.
            Do NOT wrap in an object or add any metadata fields (examTitle, objective, totalQuestions, etc.).
            """,
            section.getObjectiveNumber(), section.getName(),
            String.join(", ", section.getKeyTopics()));
    }

    // ── Full practice exam ──────────────────────────────────────────────────────

    public List<Question> getFullPracticeExam() {
        String key = "fullExam:all";
        Optional<GeneratedContentEntity> cached = contentRepo.findByContentKey(key);
        if (cached.isPresent()) {
            try {
                // parseQuestions (not raw readValue) so the same normalization the display
                // path applies — e.g. lettered option prefixes — also drives grading.
                return parseQuestions(cached.get().getJsonContent());
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

                FIELD RULES (must follow exactly):
                - Each "options" entry MUST start with its letter, e.g. "A. ", "B. ", "C. ", "D. ".
                - "correctAnswer" is the SINGLE letter of the right option (e.g. "A"), never the text, never an array.
                - "correctAnswers" (MULTI_SELECT only) is an array of those letters, e.g. ["A","C"].
                - "type" is UPPERCASE; the question text field is named "stem".

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

    public AsyncContent<List<Question>> getFullExamAsync() {
        return asyncQuestions("fullExam:all", this::getFullPracticeExam);
    }

    // ── Explain-it-simpler ───────────────────────────────────────────────────────

    private static final String TUTOR_SYSTEM_PROMPT = """
        You are a patient tutor who explains technical security concepts in plain, simple
        language for an absolute beginner who is struggling. Use short sentences, everyday
        words, and concrete analogies. Respond with prose only — no markdown headings, no JSON.
        """;

    /**
     * Re-explain a passage in plain language with a concrete analogy. User-initiated and
     * cached by a hash of the input, so the same passage is never re-generated.
     */
    public String simplifyText(String text) {
        if (text == null || text.isBlank()) return "";
        String trimmed = text.strip();
        String key = "simplify:" + Long.toHexString(((long) trimmed.hashCode() << 16) ^ trimmed.length());
        String prompt = """
            A student is struggling to understand this Security+ study passage. Rewrite it so a
            complete beginner can grasp it:
            - Use short sentences and plain, everyday words.
            - Explain any jargon the first time it appears.
            - Include ONE concrete everyday analogy or example that makes the idea click.
            - Stay accurate; do not add facts that change the meaning.
            - Return ONLY the rewritten explanation as plain prose. Start with the explanation,
              no preamble like "Sure" or "Here is".

            PASSAGE:
            %s
            """.formatted(trimmed);
        return fetchOrGenerate(key, TUTOR_SYSTEM_PROMPT, prompt, 1536).strip();
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
