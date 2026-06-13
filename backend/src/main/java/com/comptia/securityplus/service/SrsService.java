package com.comptia.securityplus.service;

import com.comptia.securityplus.entity.SrsCardEntity;
import com.comptia.securityplus.repository.SrsCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Server-side spaced-repetition scheduler (SM-2 variant). Mirrors the algorithm
 * the client used to run against localStorage, but persists per-user so the
 * review schedule is shared across every device the learner signs in from.
 *
 * Items are scheduled at the section grain: each review pushes the next due date
 * out along an expanding interval, unless the learner did poorly (a lapse), in
 * which case it resets to one day and the ease factor drops.
 */
@Service
public class SrsService {

    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    private final SrsCardRepository repo;

    public SrsService(SrsCardRepository repo) {
        this.repo = repo;
    }

    public List<SrsCardEntity> getAll(Long userId) {
        return repo.findByUserId(userId);
    }

    /**
     * Record a review and reschedule. {@code quality} is 0–5 (SM-2 convention);
     * quality &lt; 3 is a lapse: reset the interval and review again tomorrow.
     * {@code scorePct} (nullable) is the brain-dump coverage that drives weak-spots.
     */
    @Transactional
    public SrsCardEntity review(Long userId, String sectionId, String name, int quality, Integer scorePct) {
        long now = System.currentTimeMillis();
        SrsCardEntity card = repo.findByUserIdAndSectionId(userId, sectionId)
                .orElseGet(() -> {
                    SrsCardEntity c = new SrsCardEntity();
                    c.setUserId(userId);
                    c.setSectionId(sectionId);
                    return c;
                });
        if (name != null && !name.isBlank()) card.setSectionName(name);
        if (scorePct != null) card.setLastScore(scorePct);

        double ease = card.getEase();
        int reps = card.getReps();
        int interval = card.getIntervalDays();
        int lapses = card.getLapses();

        // SM-2 ease update
        ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ease < 1.3) ease = 1.3;

        if (quality < 3) {
            reps = 0;
            interval = 1;
            lapses += 1;
        } else {
            if (reps == 0) interval = 1;
            else if (reps == 1) interval = 6;
            else interval = (int) Math.round(interval * ease);
            reps += 1;
        }
        if (interval < 1) interval = 1;

        card.setEase(ease);
        card.setReps(reps);
        card.setIntervalDays(interval);
        card.setLapses(lapses);
        card.setLastReviewedAt(now);
        card.setDueAt(now + (long) interval * DAY_MS);
        return repo.save(card);
    }

    /**
     * One-time migration: insert legacy cards from a client's localStorage, but
     * only where the user has no server card for that section yet (server wins).
     */
    @Transactional
    public List<SrsCardEntity> importLegacy(Long userId, List<SrsCardEntity> incoming) {
        if (incoming != null) {
            for (SrsCardEntity in : incoming) {
                if (in.getSectionId() == null) continue;
                Optional<SrsCardEntity> existing = repo.findByUserIdAndSectionId(userId, in.getSectionId());
                if (existing.isPresent()) continue;
                SrsCardEntity c = new SrsCardEntity();
                c.setUserId(userId);
                c.setSectionId(in.getSectionId());
                c.setSectionName(in.getSectionName());
                c.setEase(in.getEase() > 0 ? in.getEase() : 2.5);
                c.setIntervalDays(Math.max(in.getIntervalDays(), 0));
                c.setReps(Math.max(in.getReps(), 0));
                c.setLapses(Math.max(in.getLapses(), 0));
                c.setLastScore(in.getLastScore());
                c.setDueAt(in.getDueAt() > 0 ? in.getDueAt() : System.currentTimeMillis());
                c.setLastReviewedAt(in.getLastReviewedAt());
                repo.save(c);
            }
        }
        return repo.findByUserId(userId);
    }
}
