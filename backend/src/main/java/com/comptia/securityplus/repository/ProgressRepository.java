package com.comptia.securityplus.repository;

import com.comptia.securityplus.entity.ProgressEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProgressRepository extends JpaRepository<ProgressEntity, Long> {
    Optional<ProgressEntity> findByUserIdAndSectionId(Long userId, String sectionId);
    List<ProgressEntity> findByUserId(Long userId);
    List<ProgressEntity> findByUserIdAndDomainId(Long userId, String domainId);
    List<ProgressEntity> findByUserIdAndExamPassedTrue(Long userId);
    long countByUserIdAndExamPassedTrue(Long userId);

    @Transactional
    void deleteByUserId(Long userId);
}
