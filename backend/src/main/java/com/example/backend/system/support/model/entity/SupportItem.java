package com.example.backend.system.support.model.entity;

import com.example.backend.base.crud.model.entity.AuditedEntity;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.model.enums.SupportStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "support_items")
@Getter
@Setter
public class SupportItem extends AuditedEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SupportKind kind;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, length = 180)
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SupportStatus status = SupportStatus.OPEN;

    @Column(columnDefinition = "text")
    private String adminResponse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responded_by")
    private User respondedBy;

    @Column
    private Instant respondedAt;

    /** Simulation a COMPLAINT is about; null for feedback, messages and unsaved simulations. */
    @Column(name = "simulation_id")
    private java.util.UUID simulationId;

    /** Snapshot of an unsaved generated simulation attached to a COMPLAINT so reviewers can replay it. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "simulation_snapshot", columnDefinition = "jsonb")
    private JsonNode simulationSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    private User assignedTo;

    @Column(name = "reviewer_referred", nullable = false)
    private boolean reviewerReferred;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "law_gap_id")
    private com.example.backend.system.reviewer.model.entity.LawGap lawGap;
}
