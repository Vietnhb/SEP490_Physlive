package com.example.backend.system.reviewer.repository;

import com.example.backend.system.reviewer.model.entity.LawGapAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LawGapAuditRepository extends JpaRepository<LawGapAudit, UUID> {
    @EntityGraph(attributePaths = {"lawGap"})
    List<LawGapAudit> findTop200ByOrderByCreatedAtDesc();
}
