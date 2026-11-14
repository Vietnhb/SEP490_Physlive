package com.example.backend.system.assignment.model.entity;

import com.example.backend.base.crud.model.entity.AuditedEntity;
import com.example.backend.system.account.model.entity.User;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

/** Append-only history; no update or delete endpoint is exposed. */
@Entity
@Table(name = "assignment_grade_changes")
@Immutable
@Getter
@Setter
public class AssignmentGradeChange extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private AssignmentSubmission submission;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;
    @Column(nullable = false, length = 255)
    private String actorName;
    @Column(nullable = false, length = 24)
    private String eventType;
    @Column(precision = 8, scale = 3)
    private BigDecimal previousScore;
    @Column(precision = 8, scale = 3)
    private BigDecimal newScore;
    @Column(columnDefinition = "text")
    private String previousFeedback;
    @Column(columnDefinition = "text")
    private String newFeedback;
    @Column(length = 32)
    private String previousStatus;
    @Column(length = 32)
    private String newStatus;
    private Integer previousGraderId;
    @Column(length = 255)
    private String previousGraderName;
    private Instant previousGradedAt;
    @Column(length = 2000)
    private String reason;
}
