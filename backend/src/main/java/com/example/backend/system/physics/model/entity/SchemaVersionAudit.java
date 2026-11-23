package com.example.backend.system.physics.model.entity;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.system.account.model.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "schema_version_audits")
@Getter
@Setter
public class SchemaVersionAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schema_version_id", nullable = false)
    private SchemaVersion schemaVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(nullable = false, length = 32)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 24)
    private LifecycleStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 24)
    private LifecycleStatus toStatus;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
