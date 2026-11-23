package com.example.backend.system.reviewer.service;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.exception.ApiException;
import com.example.backend.system.physics.dto.SchemaContracts;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import com.example.backend.system.physics.service.SchemaDefinitionService;
import com.example.backend.system.physics.service.SchemaService;
import com.example.backend.system.reviewer.model.entity.LawGap;
import com.example.backend.system.reviewer.repository.LawGapRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewerVersionService {
    private final SchemaService schemaService;
    private final SchemaDefinitionService schemaDefinitions;
    private final SchemaVersionRepository schemaVersions;
    private final LawGapRepository lawGaps;

    public record DryRunGapMatch(UUID id, String kind, String label, int occurrences, boolean covered) { }
    public record DryRunResult(boolean valid, List<String> errors, int openGapsTotal, int coveredCount, List<DryRunGapMatch> gaps) { }

    @Transactional(readOnly = true)
    public List<SchemaVersion> schemas() {
        return schemaService.list(false);
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Summary> schemaSummaries() {
        return schemaService.listSummaries();
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Audit> schemaHistory(UUID id) {
        return schemaService.history(id);
    }

    public SchemaVersion updateSchema(UUID id, SchemaContracts.Request request) {
        return schemaService.updateDraft(id, request);
    }

    public void deleteSchema(UUID id) {
        schemaService.deleteDraft(id);
    }

    public SchemaVersion schemaLifecycle(UUID id, LifecycleStatus status) {
        return schemaService.changeVersionLifecycle(id, status);
    }

    /** Dry-run a topic draft: validate schema/laws and check coverage against OPEN law gaps for this topic. */
    @Transactional(readOnly = true)
    public DryRunResult dryRun(SchemaContracts.Request request) {
        List<String> errors = new ArrayList<>();
        try {
            schemaDefinitions.validateTopicPackForAuthoring(request.definition(), request.schemaId());
            schemaDefinitions.validateDefinition(request.definition(), request.schemaId(), request.version(), request.topic());
        } catch (ApiException | IllegalArgumentException ex) {
            errors.add(ex.getMessage());
        }

        JsonNode cat = request.definition() == null ? null : request.definition().path("lawCatalogue");
        Map<String, JsonNode> definedRoles = new HashMap<>();
        if (cat != null && cat.path("roles").isObject()) {
            cat.path("roles").fields().forEachRemaining(entry ->
                    definedRoles.put(entry.getKey().trim().toLowerCase(Locale.ROOT), entry.getValue()));
        }
        Set<String> referencedRoles = new HashSet<>();
        Map<String, JsonNode> draftLawsById = new HashMap<>();
        if (cat != null && cat.path("laws").isArray()) {
            cat.path("laws").forEach(law -> {
                String lawId = law.path("id").asText("").trim().toLowerCase(Locale.ROOT);
                if (!lawId.isBlank()) draftLawsById.put(lawId, law);
                collectRoles(law, referencedRoles);
            });
        }

        // Compare against currently APPROVED version (if any) so AMBIGUOUS/VIOLATION gaps are only marked covered
        // when the offending law was actually refined (or removed/replaced), not merely left untouched.
        String targetSchema = request.schemaId() == null ? "" : request.schemaId().trim().toLowerCase(Locale.ROOT);
        String targetTopic = request.topic() == null ? "" : request.topic().trim().toLowerCase(Locale.ROOT);
        Map<String, JsonNode> approvedLawsById = new HashMap<>();
        Set<String> approvedRoleKeys = new HashSet<>();
        if (!targetSchema.isBlank()) {
            schemaVersions.findTopBySchemaIdIgnoreCaseAndLifecycleStatusOrderByCreatedAtDesc(targetSchema, LifecycleStatus.APPROVED)
                    .map(SchemaVersion::getDefinition)
                    .map(def -> def.path("lawCatalogue"))
                    .ifPresent(approvedCat -> {
                        if (approvedCat.path("roles").isObject()) {
                            approvedCat.path("roles").fieldNames().forEachRemaining(n -> approvedRoleKeys.add(n.trim().toLowerCase(Locale.ROOT)));
                        }
                        if (approvedCat.path("laws").isArray()) {
                            approvedCat.path("laws").forEach(law -> {
                                String lawId = law.path("id").asText("").trim().toLowerCase(Locale.ROOT);
                                if (!lawId.isBlank()) approvedLawsById.put(lawId, law);
                            });
                        }
                    });
        }

        List<LawGap> openForTopic = lawGaps.findTop300ByStatusOrderByOccurrencesDescUpdatedAtDesc("OPEN").stream()
                .filter(gap -> (gap.getSchemaId() != null && gap.getSchemaId().trim().equalsIgnoreCase(targetSchema))
                        || (gap.getTopic() != null && gap.getTopic().trim().equalsIgnoreCase(targetTopic)))
                .toList();

        List<DryRunGapMatch> matches = new ArrayList<>();
        int coveredCount = 0;
        for (LawGap gap : openForTopic) {
            boolean covered = false;
            if ("UNCHECKED".equals(gap.getKind()) && gap.getRole() != null) {
                covered = referencedRoles.contains(gap.getRole().trim().toLowerCase(Locale.ROOT));
            } else if ("NO_ROLE".equals(gap.getKind())) {
                covered = matchesNewOrUnitRole(gap, definedRoles, approvedRoleKeys, referencedRoles);
            } else if ("AMBIGUOUS".equals(gap.getKind()) || "VIOLATION".equals(gap.getKind())) {
                String gapLawId = extractLawId(gap);
                if (!gapLawId.isBlank()) {
                    JsonNode draftLaw = draftLawsById.get(gapLawId);
                    JsonNode approvedLaw = approvedLawsById.get(gapLawId);
                    if (draftLaw != null) {
                        if (approvedLaw != null) {
                            // Law must actually differ from the approved version that triggered the gap.
                            covered = !draftLaw.equals(approvedLaw);
                        } else if ("AMBIGUOUS".equals(gap.getKind())) {
                            // No approved baseline: require explicit disambiguation clause (where/scope).
                            covered = hasDisambiguationClause(draftLaw);
                        }
                    }
                }
            }
            if (covered) coveredCount++;
            matches.add(new DryRunGapMatch(gap.getId(), gap.getKind(),
                    "UNCHECKED".equals(gap.getKind()) && gap.getRole() != null ? gap.getRole() : gap.getLabel(),
                    gap.getOccurrences(), covered));
        }

        return new DryRunResult(errors.isEmpty(), errors, openForTopic.size(), coveredCount, matches);
    }

    private static String extractLawId(LawGap gap) {
        String key = gap.getGapKey() == null ? "" : gap.getGapKey().trim();
        int sep = key.indexOf('|');
        if (sep >= 0 && sep + 1 < key.length()) {
            return key.substring(sep + 1).trim().toLowerCase(Locale.ROOT);
        }
        return gap.getLabel() == null ? "" : gap.getLabel().trim().toLowerCase(Locale.ROOT);
    }

    private static boolean hasDisambiguationClause(JsonNode law) {
        if (law == null || !law.isObject()) return false;
        if (law.hasNonNull("where") || law.hasNonNull("scope")) return true;
        var fields = law.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            JsonNode val = entry.getValue();
            if (val != null && (val.isObject() || val.isArray()) && containsKey(val, "where", "scope")) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsKey(JsonNode node, String k1, String k2) {
        if (node == null || node.isNull()) return false;
        if (node.isObject()) {
            if (node.hasNonNull(k1) || node.hasNonNull(k2)) return true;
            var it = node.elements();
            while (it.hasNext()) {
                if (containsKey(it.next(), k1, k2)) return true;
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                if (containsKey(item, k1, k2)) return true;
            }
        }
        return false;
    }

    private static boolean matchesNewOrUnitRole(LawGap gap, Map<String, JsonNode> definedRoles,
                                                Set<String> approvedRoleKeys, Set<String> referencedRoles) {
        String gapUnit = gap.getUnit() == null ? "" : gap.getUnit().trim().toLowerCase(Locale.ROOT);
        String gapLabel = gap.getLabel() == null ? "" : gap.getLabel().trim().toLowerCase(Locale.ROOT);
        for (var entry : definedRoles.entrySet()) {
            String roleKey = entry.getKey();
            if (!referencedRoles.contains(roleKey)) continue;
            JsonNode roleDef = entry.getValue();
            boolean isNewRole = !approvedRoleKeys.isEmpty() && !approvedRoleKeys.contains(roleKey);
            String roleUnit = roleDef.path("unit").asText("").trim().toLowerCase(Locale.ROOT);
            String roleLabel = roleDef.path("label").asText("").trim().toLowerCase(Locale.ROOT);
            boolean unitMatch = !gapUnit.isBlank() && !roleUnit.isBlank() && gapUnit.equals(roleUnit);
            boolean labelMatch = !gapLabel.isBlank() && !roleLabel.isBlank()
                    && (roleLabel.contains(gapLabel) || gapLabel.contains(roleLabel));
            if ((isNewRole && (gapUnit.isBlank() || unitMatch || labelMatch)) || unitMatch || labelMatch) {
                return true;
            }
        }
        return false;
    }

    private static void collectRoles(JsonNode node, Set<String> out) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                if ("role".equals(entry.getKey()) && entry.getValue().isTextual()) {
                    out.add(entry.getValue().asText().trim().toLowerCase());
                } else {
                    collectRoles(entry.getValue(), out);
                }
            });
        } else if (node.isArray()) {
            node.forEach(item -> collectRoles(item, out));
        }
    }
}
