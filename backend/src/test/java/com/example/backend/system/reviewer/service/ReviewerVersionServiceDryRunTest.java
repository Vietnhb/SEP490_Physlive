package com.example.backend.system.reviewer.service;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.system.physics.dto.SchemaContracts;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import com.example.backend.system.physics.service.SchemaDefinitionService;
import com.example.backend.system.physics.service.SchemaService;
import com.example.backend.system.reviewer.model.entity.LawGap;
import com.example.backend.system.reviewer.repository.LawGapRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReviewerVersionServiceDryRunTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final SchemaService schemaService = mock(SchemaService.class);
    private final SchemaDefinitionService schemaDefinitions = mock(SchemaDefinitionService.class);
    private final SchemaVersionRepository schemaVersions = mock(SchemaVersionRepository.class);
    private final LawGapRepository lawGaps = mock(LawGapRepository.class);
    private final ReviewerVersionService service = new ReviewerVersionService(schemaService, schemaDefinitions, schemaVersions, lawGaps);

    @Test
    void dryRunEvaluatesUncheckedNoRoleAmbiguousAndViolationAccurately() throws Exception {
        var approvedDef = mapper.readTree("""
            {
              "lawCatalogue": {
                "roles": { "velocity": { "label": "Vận tốc", "unit": "m/s" } },
                "laws": [
                  { "id": "law_amb", "title": "Định luật mơ hồ", "expr": { "role": "velocity" } },
                  { "id": "law_viol", "title": "Định luật bác bỏ", "expr": { "role": "velocity" } }
                ]
              }
            }
            """);
        SchemaVersion approved = new SchemaVersion();
        approved.setSchemaId("thpt_kinematics");
        approved.setLifecycleStatus(LifecycleStatus.APPROVED);
        approved.setDefinition(approvedDef);
        when(schemaVersions.findTopBySchemaIdIgnoreCaseAndLifecycleStatusOrderByCreatedAtDesc("thpt_kinematics", LifecycleStatus.APPROVED))
                .thenReturn(Optional.of(approved));

        // Draft adds a new role "range" (unit "m") used by a law, modifies "law_amb" with where clause, leaves "law_viol" untouched.
        var draftDef = mapper.readTree("""
            {
              "lawCatalogue": {
                "roles": {
                  "velocity": { "label": "Vận tốc", "unit": "m/s" },
                  "range": { "label": "Tầm xa", "unit": "m" }
                },
                "laws": [
                  { "id": "law_amb", "title": "Định luật mơ hồ", "where": "x > 0", "expr": { "role": "velocity" } },
                  { "id": "law_viol", "title": "Định luật bác bỏ", "expr": { "role": "velocity" } },
                  { "id": "law_range", "title": "Tầm xa", "expr": { "role": "range" } }
                ]
              }
            }
            """);

        LawGap uncheckedCovered = gap("UNCHECKED", "UNCHECKED|range|m", "range", "m", "Tầm xa");
        LawGap noRoleCovered = gap("NO_ROLE", "NO_ROLE|thpt_kinematics|m", null, "m", "Tầm xa");
        LawGap noRoleUncovered = gap("NO_ROLE", "NO_ROLE|thpt_kinematics|N*s", null, "N*s", "Xung lượng");
        LawGap ambiguousModified = gap("AMBIGUOUS", "AMBIGUOUS|law_amb", null, null, "Định luật mơ hồ");
        LawGap violationUntouched = gap("VIOLATION", "VIOLATION|law_viol", null, null, "Định luật bác bỏ");

        when(lawGaps.findTop300ByStatusOrderByOccurrencesDescUpdatedAtDesc("OPEN"))
                .thenReturn(List.of(uncheckedCovered, noRoleCovered, noRoleUncovered, ambiguousModified, violationUntouched));

        var result = service.dryRun(new SchemaContracts.Request("thpt_kinematics", "Động học", "KINEMATICS", "1.1", draftDef, LifecycleStatus.DRAFT));

        assertTrue(result.valid());
        assertEquals(5, result.openGapsTotal());
        assertEquals(3, result.coveredCount());
        assertTrue(find(result, uncheckedCovered.getId()).covered());
        assertTrue(find(result, noRoleCovered.getId()).covered());
        assertFalse(find(result, noRoleUncovered.getId()).covered());
        assertTrue(find(result, ambiguousModified.getId()).covered());
        assertFalse(find(result, violationUntouched.getId()).covered());
    }

    private static LawGap gap(String kind, String key, String role, String unit, String label) {
        LawGap g = new LawGap();
        g.setId(UUID.randomUUID());
        g.setKind(kind);
        g.setGapKey(key);
        g.setSchemaId("thpt_kinematics");
        g.setTopic("KINEMATICS");
        g.setRole(role);
        g.setUnit(unit);
        g.setLabel(label);
        g.setOccurrences(3);
        g.setStatus("OPEN");
        return g;
    }

    private static ReviewerVersionService.DryRunGapMatch find(ReviewerVersionService.DryRunResult result, UUID id) {
        return result.gaps().stream().filter(m -> m.id().equals(id)).findFirst().orElseThrow();
    }
}
