package com.comptia.securityplus.repository;

import com.comptia.securityplus.entity.NoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<NoteEntity, Long> {
    List<NoteEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<NoteEntity> findByUserIdAndSectionIdOrderByCreatedAtDesc(Long userId, String sectionId);
}
