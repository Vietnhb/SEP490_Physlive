package com.example.backend.system.support.dto;

import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.model.enums.SupportStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Requests and responses for feedback and support messages. */
public final class SupportContracts {
    private SupportContracts() { }

    public record CreateSupportRequest(
            @NotBlank @Size(max = 180) String subject,
            @NotBlank @Size(max = 10000) String content) {
    }

    public record CreateComplaintRequest(
            @NotBlank @Size(max = 180) String subject,
            @NotBlank @Size(max = 10000) String content,
            UUID simulationId,
            JsonNode simulationSnapshot) {
        public CreateComplaintRequest(String subject, String content, UUID simulationId) {
            this(subject, content, simulationId, null);
        }
    }
    public record UpdateSupportRequest(
            SupportStatus status,
            @Size(max = 10000) String response,
            SupportStatus expectedStatus,
            Instant expectedRespondedAt) {
        public UpdateSupportRequest(SupportStatus status, String response) {
            this(status, response, null, null);
        }
    }

    public record ComplaintCounts(long open, long read, long resolved, long total,
                                  long under24h, long from24To48h, long over48h,
                                  Instant oldestOpenCreatedAt) {
        public ComplaintCounts(long open, long read, long resolved, long total,
                               long under24h, long from24To48h, long over48h) {
            this(open, read, resolved, total, under24h, from24To48h, over48h, null);
        }
    }

    public record EscalateLawGapRequest(
            @Size(max = 80) String schemaId,
            @Size(max = 200) String topic,
            @Size(max = 2000) String note) {
    }

    public record ComplaintPage(java.util.List<SupportView> items, int page, int size,
                                long totalElements, int totalPages) { }

    public record SupportView(UUID id, SupportKind kind, Integer senderId, String senderName, String senderEmail,
                              String subject, String content, SupportStatus status, String adminResponse,
                              Instant createdAt, Instant respondedAt, UUID simulationId, String responderName,
                              boolean reviewerReferred, JsonNode simulationSnapshot,
                              Integer assignedToId, String assignedToName, boolean hasSimulationSnapshot,
                              UUID lawGapId, String lawGapStatus) {
        public SupportView(UUID id, SupportKind kind, Integer senderId, String senderName, String senderEmail,
                           String subject, String content, SupportStatus status, String adminResponse,
                           Instant createdAt, Instant respondedAt, UUID simulationId, String responderName,
                           boolean reviewerReferred, JsonNode simulationSnapshot,
                           Integer assignedToId, String assignedToName, boolean hasSimulationSnapshot) {
            this(id, kind, senderId, senderName, senderEmail, subject, content, status, adminResponse,
                    createdAt, respondedAt, simulationId, responderName, reviewerReferred, simulationSnapshot,
                    assignedToId, assignedToName, hasSimulationSnapshot, null, null);
        }

        public SupportView(UUID id, SupportKind kind, Integer senderId, String senderName, String senderEmail,
                           String subject, String content, SupportStatus status, String adminResponse,
                           Instant createdAt, Instant respondedAt, UUID simulationId, String responderName,
                           boolean reviewerReferred, JsonNode simulationSnapshot,
                           Integer assignedToId, String assignedToName) {
            this(id, kind, senderId, senderName, senderEmail, subject, content, status, adminResponse,
                    createdAt, respondedAt, simulationId, responderName, reviewerReferred, simulationSnapshot,
                    assignedToId, assignedToName, simulationSnapshot != null, null, null);
        }

        public SupportView(UUID id, SupportKind kind, Integer senderId, String senderName, String senderEmail,
                           String subject, String content, SupportStatus status, String adminResponse,
                           Instant createdAt, Instant respondedAt, UUID simulationId, String responderName,
                           boolean reviewerReferred) {
            this(id, kind, senderId, senderName, senderEmail, subject, content, status, adminResponse,
                    createdAt, respondedAt, simulationId, responderName, reviewerReferred, null, null, null, false, null, null);
        }
    }
}
