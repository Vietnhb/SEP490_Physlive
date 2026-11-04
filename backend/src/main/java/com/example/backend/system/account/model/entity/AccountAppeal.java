package com.example.backend.system.account.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Data;

@Entity
@Table(name = "account_appeals")
@Data
public class AccountAppeal {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false, length = 24)
    private String status = "PENDING";

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "suspension_id")
    private UUID suspensionId;
    @Column(name = "suspension_scope", length = 12)
    private String suspensionScope;
    @Column(name = "school_id")
    private UUID schoolId;
    @Column(name = "suspended_by")
    private Integer suspendedBy;
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
