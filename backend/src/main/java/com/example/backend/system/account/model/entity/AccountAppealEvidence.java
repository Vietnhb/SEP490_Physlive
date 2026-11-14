package com.example.backend.system.account.model.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "account_appeal_evidence")
@Getter @Setter
public class AccountAppealEvidence {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appeal_id", nullable = false)
    private AccountAppeal appeal;
    @Column(nullable = false, length = 32) private String contentType;
    @Column(nullable = false, columnDefinition = "bytea") private byte[] content;
}
