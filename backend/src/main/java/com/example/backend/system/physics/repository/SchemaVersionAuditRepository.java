package com.example.backend.system.physics.repository;

import com.example.backend.system.physics.model.entity.SchemaVersionAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchemaVersionAuditRepository extends JpaRepository<SchemaVersionAudit, UUID> {
    @EntityGraph(attributePaths = {"actor"})
    List<SchemaVersionAudit> findTop100BySchemaVersionIdOrderByCreatedAtDesc(UUID schemaVersionId);
}
