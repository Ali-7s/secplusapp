package com.comptia.securityplus.repository;

import com.comptia.securityplus.entity.GeneratedContentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface GeneratedContentRepository extends JpaRepository<GeneratedContentEntity, Long> {
    Optional<GeneratedContentEntity> findByContentKey(String contentKey);

    @Modifying
    @Transactional
    void deleteByContentKey(String contentKey);
}
