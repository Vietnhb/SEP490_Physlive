package com.example.backend.system.support.repository;

import com.example.backend.system.support.model.entity.SupportItem;
import com.example.backend.system.support.model.enums.SupportKind;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportItemRepository extends JpaRepository<SupportItem, UUID> {
    List<SupportItem> findTop200ByKindOrderByCreatedAtDesc(SupportKind kind);
    List<SupportItem> findTop200ByKindAndReviewerReferredTrueOrderByCreatedAtDesc(SupportKind kind);
    List<SupportItem> findAllByOrderByCreatedAtDesc();
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from SupportItem s where s.id = :id")
    java.util.Optional<SupportItem> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
    List<SupportItem> findBySenderIdOrderByCreatedAtDesc(Integer senderId);
}
