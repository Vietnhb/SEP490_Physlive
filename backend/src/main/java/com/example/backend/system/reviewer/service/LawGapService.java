package com.example.backend.system.reviewer.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.reviewer.model.entity.LawGap;
import com.example.backend.system.reviewer.repository.LawGapRepository;
import com.example.backend.system.simulation.service.LawGapSink;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The reviewers' list of what the law catalogues are missing, fed by the simulations teachers create. */
@Service
public class LawGapService implements LawGapSink {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(LawGapService.class);
    private static final Set<String> STATUSES = Set.of("OPEN", "RESOLVED", "DISMISSED");
    private final LawGapRepository gaps;
    private final CurrentUserService currentUser;

    @Autowired
    public LawGapService(LawGapRepository gaps, CurrentUserService currentUser) {
        this.gaps = gaps;
        this.currentUser = currentUser;
    }

    public LawGapService(LawGapRepository gaps) {
        this(gaps, null);
    }

    @Override
    @Transactional
    public int recordGaps(String schemaId, String topic, String description, JsonNode spec, JsonNode validation) {
        try {
            Map<String, JsonNode> quantities = new LinkedHashMap<>();
            spec.path("model").path("quantities").forEach(quantity -> quantities.put(quantity.path("id").asText(), quantity));
            Map<String, LawGap> found = new LinkedHashMap<>();
            Seen seen = new Seen(schemaId, topic, description);
            for (JsonNode id : validation.path("uncheckedQuantities")) {
                JsonNode quantity = quantities.get(id.asText());
                if (quantity == null) continue;
                String role = quantity.path("role").asText("other");
                String unit = quantity.path("unit").asText("");
                boolean named = !role.equals("other");
                // a named role is one gap wherever it is met; a quantity no role fitted is told apart by topic and unit
                String key = named ? "UNCHECKED|" + role + "|" + unit : "NO_ROLE|" + schemaId + "|" + unit;
                found.computeIfAbsent(key, ignored -> draft(key, named ? "UNCHECKED" : "NO_ROLE", seen, named ? role : null, unit,
                        quantity.path("label").asText(id.asText()), formula(quantity)));
            }
            for (JsonNode law : validation.path("ambiguousLaws")) {
                String key = "AMBIGUOUS|" + law.path("law").asText();
                found.computeIfAbsent(key, ignored -> draft(key, "AMBIGUOUS", seen, null, null, law.path("title").asText(law.path("law").asText()),
                        "Các đại lượng cùng khớp: " + law.path("quantities")));
            }
            // a law that still refuses the model after the repair loop: the model was wrong, or the law is too narrow
            if ("FLAGGED".equals(validation.path("status").asText()))
                for (JsonNode check : validation.path("lawChecks")) {
                    if (!"FAILED".equals(check.path("status").asText())) continue;
                    String key = "VIOLATION|" + check.path("law").asText();
                    found.computeIfAbsent(key, ignored -> draft(key, "VIOLATION", seen, null, null,
                            check.path("title").asText(check.path("law").asText()), check.path("message").asText("")));
                }
            for (LawGap gap : found.values()) {
                upsertGap(gap);
            }
            return found.size();
        } catch (RuntimeException failure) {
            // the teacher's simulation never waits on the reviewers' list
            log.warn("LAW_GAP_NOT_RECORDED {}", failure.getMessage());
            return 0;
        }
    }

    private void upsertGap(LawGap gap) {
        LawGap known = gaps.findByGapKey(gap.getGapKey()).orElse(null);
        if (known == null) {
            try {
                gaps.saveAndFlush(gap);
                return;
            } catch (DataIntegrityViolationException concurrentInsert) {
                known = gaps.findByGapKey(gap.getGapKey()).orElse(null);
                if (known == null) throw concurrentInsert;
            }
        }
        known.setOccurrences(known.getOccurrences() + 1);
        // the label and topic describe the latest example, so they move with it
        known.setSchemaId(gap.getSchemaId());
        known.setTopic(gap.getTopic());
        known.setLabel(gap.getLabel());
        known.setExampleDescription(gap.getExampleDescription());
        known.setExampleFormula(gap.getExampleFormula());
        // met again after a reviewer closed it: the decision did not hold, so it goes back on the list
        if (!"OPEN".equals(known.getStatus())) {
            known.setStatus("OPEN");
            known.setDecidedBy(null);
            known.setDecidedAt(null);
        }
        gaps.save(known);
    }

    @Transactional
    public LawGap createFromComplaint(UUID complaintId, String subject, String content,
                                      String schemaId, String topic, String reviewerNote) {
        String key = "COMPLAINT|" + complaintId;
        LawGap existing = gaps.findByGapKey(key).orElse(null);
        if (existing != null) return existing;
        String code = "KN-" + complaintId.toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
        LawGap gap = new LawGap();
        gap.setGapKey(key);
        gap.setKind("COMPLAINT");
        gap.setSchemaId(schemaId != null && !schemaId.isBlank() ? schemaId.trim() : null);
        gap.setTopic(topic != null && !topic.isBlank() ? topic.trim() : null);
        gap.setLabel("[" + code + "] " + (subject == null ? "Khiếu nại mô phỏng" : subject.trim()));
        gap.setExampleDescription(content);
        gap.setExampleFormula(reviewerNote != null && !reviewerNote.isBlank() ? reviewerNote.strip() : null);
        gap.setSourceComplaintId(complaintId);
        gap.setStatus("OPEN");
        gap.setOccurrences(1);
        return gaps.save(gap);
    }

    @Transactional(readOnly = true)
    public List<LawGap> list(String status) {
        return gaps.findTop300ByStatusOrderByOccurrencesDescUpdatedAtDesc(STATUSES.contains(status) ? status : "OPEN");
    }

    @Transactional(readOnly = true)
    public long open() {
        return gaps.countByStatus("OPEN");
    }

    @Transactional(readOnly = true)
    public Map<String, Long> counts() {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("OPEN", gaps.countByStatus("OPEN"));
        result.put("RESOLVED", gaps.countByStatus("RESOLVED"));
        result.put("DISMISSED", gaps.countByStatus("DISMISSED"));
        return result;
    }

    @Transactional
    public LawGap decide(UUID id, String status, String note) {
        if (!STATUSES.contains(status)) throw ApiException.badRequest("Trạng thái không hợp lệ");
        LawGap gap = gaps.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy mục cần xử lý"));
        gap.setStatus(status);
        gap.setNote(note == null || note.isBlank() ? null : note.strip());
        if ("OPEN".equals(status)) {
            gap.setDecidedBy(null);
            gap.setDecidedAt(null);
        } else {
            User actor = currentUser == null ? null : currentUser.currentUserOrNull();
            gap.setDecidedBy(actor);
            gap.setDecidedAt(Instant.now());
        }
        return gaps.save(gap);
    }

    /** Where a gap was met: the topic version the model was checked under and the teacher's description. */
    private record Seen(String schemaId, String topic, String description) { }

    private static LawGap draft(String key, String kind, Seen seen, String role, String unit, String label, String formula) {
        LawGap gap = new LawGap();
        gap.setGapKey(key.length() > 240 ? key.substring(0, 240) : key);
        gap.setKind(kind);
        gap.setSchemaId(seen.schemaId());
        gap.setTopic(seen.topic());
        gap.setRole(role);
        gap.setUnit(unit);
        gap.setLabel(label);
        gap.setExampleDescription(seen.description());
        gap.setExampleFormula(formula);
        return gap;
    }

    private static String formula(JsonNode quantity) {
        String id = quantity.path("id").asText();
        return quantity.has("rate") ? "d" + id + "/dt = " + quantity.path("rate") + "; " + id + "(0) = " + quantity.path("initial") : id + " = " + quantity.path("value");
    }
}
