package com.comptia.securityplus.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/** A learner's personal note anchored to a highlighted snippet of section content. */
@Entity
@Table(name = "note", indexes = @Index(name = "idx_note_user", columnList = "user_id"))
public class NoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    @JsonIgnore
    private Long userId;

    @Column(name = "section_id", nullable = false)
    private String sectionId;

    @Column(name = "section_name")
    private String sectionName;

    /** The highlighted text the note is attached to. */
    @Column(length = 2000)
    private String quote;

    /** The learner's note. */
    @Column(length = 4000, nullable = false)
    private String note;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public NoteEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
    public String getQuote() { return quote; }
    public void setQuote(String quote) { this.quote = quote; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
