package com.example.backend.system.physics.repository;

import com.example.backend.system.physics.model.entity.SchemaVersionAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SchemaVersionAuditRepository extends JpaRepository<SchemaVersionAudit, UUID> {
    @EntityGraph(attributePaths = {"actor"})
    List<SchemaVersionAudit> findTop100BySchemaVersionIdOrderByCreatedAtDesc(UUID schemaVersionId);

    /** The version is not fetched: only its id is read, and its definition is hundreds of kilobytes. */
    @EntityGraph(attributePaths = {"actor"})
    List<SchemaVersionAudit> findAllBySchemaVersionIdInOrderByCreatedAtDesc(List<UUID> schemaVersionIds);

    /** One line of a history list: the columns it shows, never the version's definition. */
    interface HistoryRow {
        UUID getId();
        UUID getVersionId();
        String getSchemaId();
        String getName();
        String getVersion();
        String getActorName();
        String getActorEmail();
        String getAction();
        com.example.backend.base.crud.model.enums.LifecycleStatus getFromStatus();
        com.example.backend.base.crud.model.enums.LifecycleStatus getToStatus();
        String getNote();
        java.time.Instant getCreatedAt();
    }

    String HISTORY_SELECT = "select a.id as id, v.id as versionId, v.schemaId as schemaId, v.name as name, v.version as version, "
            + "u.fullName as actorName, u.email as actorEmail, a.action as action, a.fromStatus as fromStatus, "
            + "a.toStatus as toStatus, a.note as note, a.createdAt as createdAt "
            + "from SchemaVersionAudit a join a.schemaVersion v left join a.actor u ";

    @Query(HISTORY_SELECT + "order by a.createdAt desc")
    List<HistoryRow> recentHistory(org.springframework.data.domain.Pageable page);

    @Query(HISTORY_SELECT + "where lower(v.schemaId) = lower(:schemaId) order by a.createdAt desc")
    List<HistoryRow> familyHistory(@org.springframework.data.repository.query.Param("schemaId") String schemaId,
                                   org.springframework.data.domain.Pageable page);
}
