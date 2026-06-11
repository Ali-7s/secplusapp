package com.comptia.securityplus.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "generated_content")
public class GeneratedContentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "content_key", unique = true, nullable = false, length = 100)
    private String contentKey;

    @Column(name = "json_content", columnDefinition = "TEXT", nullable = false)
    private String jsonContent;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public GeneratedContentEntity() {
        this.createdAt = LocalDateTime.now();
    }

    public GeneratedContentEntity(String contentKey, String jsonContent) {
        this.contentKey = contentKey;
        this.jsonContent = jsonContent;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getContentKey() { return contentKey; }
    public void setContentKey(String contentKey) { this.contentKey = contentKey; }
    public String getJsonContent() { return jsonContent; }
    public void setJsonContent(String jsonContent) { this.jsonContent = jsonContent; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
