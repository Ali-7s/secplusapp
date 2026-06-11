package com.comptia.securityplus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.logging.Logger;

@Service
public class ClaudeService {

    private static final Logger log = Logger.getLogger(ClaudeService.class.getName());

    @Value("${anthropic.api.key:}")
    private String apiKey;

    @Value("${anthropic.api.url}")
    private String apiUrl;

    @Value("${anthropic.model}")
    private String model;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String callClaude(String systemPrompt, String userPrompt) {
        return callClaude(systemPrompt, userPrompt, 4096);
    }

    public String callClaude(String systemPrompt, String userPrompt, int maxTokens) {
        if (!isConfigured()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY is not configured. Set it in application.properties or as an environment variable.");
        }

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", maxTokens);

            ObjectNode systemMsg = mapper.createObjectNode();
            systemMsg.put("type", "text");
            systemMsg.put("text", systemPrompt);
            ArrayNode systemArray = mapper.createArrayNode();
            systemArray.add(systemMsg);
            body.set("system", systemMsg.textNode(systemPrompt));

            ArrayNode messages = mapper.createArrayNode();
            ObjectNode userMsg = mapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.put("content", userPrompt);
            messages.add(userMsg);
            body.set("messages", messages);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .timeout(Duration.ofSeconds(300))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warning("Claude API error " + response.statusCode() + ": " + response.body());
                throw new RuntimeException("Claude API returned status " + response.statusCode());
            }

            JsonNode responseJson = mapper.readTree(response.body());
            String text = responseJson.get("content").get(0).get("text").asText();
            return stripMarkdownFences(text);

        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.severe("Claude API call failed: " + e.getMessage());
            throw new RuntimeException("Failed to call Claude API: " + e.getMessage(), e);
        }
    }

    private String stripMarkdownFences(String text) {
        String trimmed = text.strip();

        // If a code fence exists anywhere (Claude sometimes adds preamble before it),
        // extract only the content between the opening and closing fences.
        int fenceOpen = trimmed.indexOf("```");
        if (fenceOpen != -1) {
            int newline = trimmed.indexOf('\n', fenceOpen);
            if (newline != -1) {
                trimmed = trimmed.substring(newline + 1).stripLeading();
                int fenceClose = trimmed.lastIndexOf("```");
                if (fenceClose != -1) {
                    trimmed = trimmed.substring(0, fenceClose).stripTrailing();
                }
            }
        }

        // If still not starting with a JSON character, advance to the first { or [
        if (!trimmed.isEmpty() && trimmed.charAt(0) != '{' && trimmed.charAt(0) != '[') {
            int brace   = trimmed.indexOf('{');
            int bracket = trimmed.indexOf('[');
            int start;
            if (brace == -1 && bracket == -1) {
                start = -1;
            } else if (brace == -1) {
                start = bracket;
            } else if (bracket == -1) {
                start = brace;
            } else {
                start = Math.min(brace, bracket);
            }
            if (start != -1) {
                trimmed = trimmed.substring(start);
            }
        }

        return trimmed;
    }
}
