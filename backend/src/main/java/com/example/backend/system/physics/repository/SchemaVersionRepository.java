package com.example.backend.system.physics.repository;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchemaVersionRepository extends JpaRepository<SchemaVersion, UUID> {
    /** How many rows there are and when the latest changed: moves whenever any schema version is added or changed. */
    interface ChangeMark { Long getCount(); java.time.Instant getUpdated(); }

    @org.springframework.data.jpa.repository.Query("select count(s) as count, max(s.updatedAt) as updated from SchemaVersion s")
    ChangeMark changeMark();

    List<SchemaVersion> findByLifecycleStatus(LifecycleStatus lifecycleStatus);
    List<SchemaVersion> findAllByLifecycleStatusAndTopicInOrderByTopicAscSchemaIdAscCreatedAtDesc(
            LifecycleStatus lifecycleStatus, List<String> topics);
    Optional<SchemaVersion> findFirstBySchemaIdAndVersion(String schemaId, String version);
    Optional<SchemaVersion> findTopBySchemaIdIgnoreCaseAndLifecycleStatusOrderByCreatedAtDesc(
            String schemaId, LifecycleStatus lifecycleStatus);
    Optional<SchemaVersion> findTopBySchemaIdIgnoreCaseOrderByCreatedAtDesc(String schemaId);
    boolean existsBySchemaIdAndVersion(String schemaId, String version);
    List<SchemaVersion> findAllByLifecycleStatusOrderByTopicAscSchemaIdAscCreatedAtDesc(LifecycleStatus lifecycleStatus);
    List<SchemaVersion> findAllByOrderByTopicAscNameAscVersionAsc();

    /** Topic code and display name of every version, without the (large) definitions. */
    interface TopicName { String getTopic(); String getName(); LifecycleStatus getLifecycleStatus(); }

    @org.springframework.data.jpa.repository.Query("select s.topic as topic, s.name as name, s.lifecycleStatus as lifecycleStatus from SchemaVersion s order by s.topic, s.name")
    List<TopicName> findTopicNames();
}
