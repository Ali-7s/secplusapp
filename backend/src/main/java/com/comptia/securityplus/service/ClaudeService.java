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
        // Remove opening ```json or ``` fence
        if (trimmed.startsWith("```")) {
            int newline = trimmed.indexOf('\n');
            if (newline != -1) {
                trimmed = trimmed.substring(newline + 1);
            }
        }
        // Remove closing ``` fence
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.lastIndexOf("```")).stripTrailing();
        }
        return trimmed;
    }
}
