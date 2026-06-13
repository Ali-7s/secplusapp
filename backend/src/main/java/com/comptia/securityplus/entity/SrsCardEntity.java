package com.comptia.securityplus.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

/**
 * One spaced-repetition schedule row per (user, section). The SM-2 state lives
 * here so a learner's review schedule follows them across devices instead of
 * being trapped in one browser's localStorage.
 */
@Entity
@Table(name = "srs_card",
       uniqueConstraints = @UniqueConstraint(name = "uk_srs_user_section", columnNames = {"user_id", "section_id"}))
public class SrsCardEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    private Long id;

    @Column(name = "user_id", nullable = false)
    @JsonIgnore
    private Long userId;

    @Column(name = "section_id", nullable = false)
    private String sectionId;

    @Column(name = "section_name")
    @JsonProperty("name")
    private String sectionName;

    private double ease = 2.5;
    private int intervalDays = 0;
    private int reps = 0;
    private int lapses = 0;

    /** Most recent brain-dump coverage % (0–100); drives the dashboard weak-spot list. Nullable. */
    private Integer lastScore;

    @Column(name = "due_at", nullable = false)
    @JsonProperty("due")
    private long dueAt;

    @Column(name = "last_reviewed_at")
    @JsonProperty("lastReviewed")
    private long lastReviewedAt;

    public SrsCardEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
    public double getEase() { return ease; }
    public void setEase(double ease) { this.ease = ease; }
    public int getIntervalDays() { return intervalDays; }
    public void setIntervalDays(int intervalDays) { this.intervalDays = intervalDays; }
    public int getReps() { return reps; }
    public void setReps(int reps) { this.reps = reps; }
    public int getLapses() { return lapses; }
    public void setLapses(int lapses) { this.lapses = lapses; }
    public Integer getLastScore() { return lastScore; }
    public void setLastScore(Integer lastScore) { this.lastScore = lastScore; }
    public long getDueAt() { return dueAt; }
    public void setDueAt(long dueAt) { this.dueAt = dueAt; }
    public long getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(long lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }
}
