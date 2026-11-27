package com.example.backend.system.reviewer.dto;

import com.example.backend.system.reviewer.model.entity.LawGap;
import java.util.UUID;
import java.time.Instant;

public final class LawGapContracts {
    private LawGapContracts() { }
    public record Item(UUID id, String kind, String schemaId, String topic, String role, String unit, String label, int occurrences,
            String exampleDescription, String exampleFormula, String status, String note,
            String decidedByName, Instant decidedAt, Long assignedToId, String assignedToName, Instant assignedAt,
            UUID sourceComplaintId, Instant createdAt, Instant updatedAt) {
        public static Item from(LawGap gap) {
            return from(gap, null);
        }

        public static Item from(LawGap gap, String assignedToName) {
            return new Item(gap.getId(), gap.getKind(), gap.getSchemaId(), gap.getTopic(), gap.getRole(), gap.getUnit(), gap.getLabel(), gap.getOccurrences(),
                    gap.getExampleDescription(), gap.getExampleFormula(), gap.getStatus(), gap.getNote(),
                    gap.getDecidedBy() == null ? null : gap.getDecidedBy().getFullName(), gap.getDecidedAt(),
                    gap.getAssignedToId(), assignedToName, gap.getAssignedAt(),
                    gap.getSourceComplaintId(), gap.getCreatedAt(), gap.getUpdatedAt());
        }
    }

    public record Decision(String status, String note) { }

    public record Audit(UUID id, UUID lawGapId, String kind, String schemaId, String topic, String label, String role,
                        String actorName, String actorEmail, String action, String fromStatus, String toStatus,
                        String note, Instant createdAt) { }

}
