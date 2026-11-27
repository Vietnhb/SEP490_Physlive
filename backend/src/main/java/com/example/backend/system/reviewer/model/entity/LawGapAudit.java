package com.example.backend.system.reviewer.model.entity;

import com.example.backend.system.account.model.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "law_gap_audits")
@Getter
@Setter
public class LawGapAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "law_gap_id", nullable = false)
    private LawGap lawGap;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(nullable = false, length = 32)
    private String action;

    @Column(name = "from_status", length = 24)
    private String fromStatus;

    @Column(name = "to_status", length = 24)
    private String toStatus;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
