package com.comptia.securityplus.repository;

import com.comptia.securityplus.entity.SrsCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface SrsCardRepository extends JpaRepository<SrsCardEntity, Long> {
    List<SrsCardEntity> findByUserId(Long userId);
    Optional<SrsCardEntity> findByUserIdAndSectionId(Long userId, String sectionId);

    @Transactional
    void deleteByUserId(Long userId);
}
