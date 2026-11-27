package com.example.backend.system.reviewer.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.reviewer.dto.LawGapContracts;
import com.example.backend.system.reviewer.model.entity.LawGap;
import com.example.backend.system.reviewer.model.entity.LawGapAudit;
import com.example.backend.system.reviewer.repository.LawGapAuditRepository;
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
    private final LawGapAuditRepository audits;
    private final UserRepository users;
    private final CurrentUserService currentUser;

    @Autowired
    public LawGapService(LawGapRepository gaps, LawGapAuditRepository audits, UserRepository users, CurrentUserService currentUser) {
        this.gaps = gaps;
        this.audits = audits;
        this.users = users;
        this.currentUser = currentUser;
    }

    public LawGapService(LawGapRepository gaps, CurrentUserService currentUser) {
        this(gaps, null, null, currentUser);
    }

    public LawGapService(LawGapRepository gaps) {
        this(gaps, null, null, null);
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
        // DISMISSED means the reviewer explicitly decided this does not need a law — keep it dismissed and only track occurrences.
        // RESOLVED means a law was supposedly added; if it still recurs, reopen it with context so reviewers know the fix didn't hold.
        if ("RESOLVED".equals(known.getStatus())) {
            known.setStatus("OPEN");
            known.setDecidedBy(null);
            known.setDecidedAt(null);
            String reopenTag = "Tự động mở lại do lỗi tái diễn sau khi đánh dấu đã bổ sung.";
            String existingNote = known.getNote();
            if (existingNote == null || existingNote.isBlank()) {
                known.setNote(reopenTag);
            } else if (!existingNote.contains(reopenTag)) {
                known.setNote(existingNote + " — " + reopenTag);
            }
            LawGap saved = gaps.save(known);
            recordAudit(saved, null, "AUTO_REOPEN", "RESOLVED", "OPEN", reopenTag);
            return;
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
        User actor = currentUser == null ? null : currentUser.currentUserOrNull();
        Long actorId = actor == null ? null : actor.getId().longValue();
        long openVisible = actorId == null
                ? gaps.countByStatus("OPEN")
                : gaps.findTop300ByStatusOrderByOccurrencesDescUpdatedAtDesc("OPEN").stream()
                        .filter(gap -> gap.getAssignedToId() == null || gap.getAssignedToId().equals(actorId))
                        .count();
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("OPEN", openVisible);
        result.put("RESOLVED", gaps.countByStatus("RESOLVED"));
        result.put("DISMISSED", gaps.countByStatus("DISMISSED"));
        return result;
    }

    @Transactional(readOnly = true)
    public List<LawGapContracts.Item> listItems(String status) {
        User actor = currentUser == null ? null : currentUser.currentUserOrNull();
        Long actorId = actor == null ? null : actor.getId().longValue();
        List<LawGap> rows = list(status);
        if ("OPEN".equals(status) && actorId != null) {
            rows = rows.stream()
                    .filter(gap -> gap.getAssignedToId() == null || gap.getAssignedToId().equals(actorId))
                    .toList();
        }
        Map<Long, User> userMap = loadUsers(rows.stream().map(LawGap::getAssignedToId).toList());
        return rows.stream()
                .map(gap -> {
                    User assignee = gap.getAssignedToId() == null ? null : userMap.get(gap.getAssignedToId());
                    return LawGapContracts.Item.from(gap, assignee == null ? null : assignee.getFullName());
                })
                .toList();
    }

    @Transactional
    public LawGapContracts.Item claimItem(UUID id, boolean release, boolean force) {
        LawGap saved = claim(id, release, force);
        String name = saved.getAssignedToId() == null ? null : resolveUserName(saved.getAssignedToId());
        return LawGapContracts.Item.from(saved, name);
    }

    @Transactional
    public LawGapContracts.Item decideItem(UUID id, String status, String note) {
        LawGap saved = decide(id, status, note);
        String name = saved.getAssignedToId() == null ? null : resolveUserName(saved.getAssignedToId());
        return LawGapContracts.Item.from(saved, name);
    }

    @Transactional
    public LawGap claim(UUID id, boolean release, boolean force) {
        LawGap gap = gaps.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy mục cần xử lý"));
        if (!"OPEN".equals(gap.getStatus())) {
            throw ApiException.conflict("Chỉ có thể nhận xử lý các mục đang mở.");
        }
        User actor = currentUser == null ? null : currentUser.requireCurrentUser();
        Long actorId = actor == null ? null : actor.getId().longValue();
        if (release) {
            if (gap.getAssignedToId() != null && actorId != null && !gap.getAssignedToId().equals(actorId)) {
                throw ApiException.conflict("Mục này đang được " + resolveUserName(gap.getAssignedToId()) + " nhận xử lý.");
            }
            gap.setAssignedToId(null);
            gap.setAssignedAt(null);
            LawGap saved = gaps.save(gap);
            recordAudit(saved, actor, "RELEASE", saved.getStatus(), saved.getStatus(), null);
            return saved;
        }
        if (gap.getAssignedToId() != null && actorId != null && !gap.getAssignedToId().equals(actorId)) {
            throw ApiException.conflict("Mục này đã được " + resolveUserName(gap.getAssignedToId()) + " nhận xử lý. Không thể xử lý chung.");
        }
        gap.setAssignedToId(actorId);
        gap.setAssignedAt(Instant.now());
        LawGap saved = gaps.save(gap);
        recordAudit(saved, actor, "CLAIM", saved.getStatus(), saved.getStatus(), null);
        return saved;
    }

    @Transactional
    public LawGap decide(UUID id, String status, String note) {
        if (!STATUSES.contains(status)) throw ApiException.badRequest("Trạng thái không hợp lệ");
        LawGap gap = gaps.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy mục cần xử lý"));
        String fromStatus = gap.getStatus();
        User actor = currentUser == null ? null : currentUser.currentUserOrNull();
        Long actorId = actor == null ? null : actor.getId().longValue();
        if ("OPEN".equals(fromStatus) && !"OPEN".equals(status) && gap.getAssignedToId() != null && actorId != null
                && !gap.getAssignedToId().equals(actorId)) {
            throw ApiException.conflict("Mục này đã được " + resolveUserName(gap.getAssignedToId()) + " nhận xử lý. Không thể xử lý chung.");
        }
        gap.setStatus(status);
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        gap.setNote(cleanNote);
        if ("OPEN".equals(status)) {
            gap.setDecidedBy(null);
            gap.setDecidedAt(null);
            gap.setAssignedToId(null);
            gap.setAssignedAt(null);
        } else {
            gap.setDecidedBy(actor);
            gap.setDecidedAt(Instant.now());
        }
        LawGap saved = gaps.save(gap);
        String action = "RESOLVED".equals(status) ? "RESOLVE" : "DISMISSED".equals(status) ? "DISMISS" : "REOPEN";
        recordAudit(saved, actor, action, fromStatus, status, cleanNote);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<LawGapContracts.Audit> history() {
        if (audits == null) return List.of();
        List<LawGapAudit> rows = audits.findTop200ByOrderByCreatedAtDesc();
        Map<Long, User> userMap = loadUsers(rows.stream().map(LawGapAudit::getActorId).toList());
        return rows.stream()
                .map(row -> {
                    User actor = row.getActorId() == null ? null : userMap.get(row.getActorId());
                    return new LawGapContracts.Audit(
                            row.getId(),
                            row.getLawGap().getId(),
                            row.getLawGap().getKind(),
                            row.getLawGap().getSchemaId(),
                            row.getLawGap().getTopic(),
                            row.getLawGap().getLabel(),
                            row.getLawGap().getRole(),
                            actor == null ? null : actor.getFullName(),
                            actor == null ? null : actor.getEmail(),
                            row.getAction(),
                            row.getFromStatus(),
                            row.getToStatus(),
                            row.getNote(),
                            row.getCreatedAt());
                })
                .toList();
    }

    private Map<Long, User> loadUsers(List<Long> rawIds) {
        if (users == null) return Map.of();
        List<Integer> ids = rawIds.stream()
                .filter(java.util.Objects::nonNull)
                .map(Long::intValue)
                .distinct()
                .toList();
        if (ids.isEmpty()) return Map.of();
        Map<Long, User> out = new LinkedHashMap<>();
        users.findAllById(ids).forEach(u -> out.put(u.getId().longValue(), u));
        return out;
    }

    private String resolveUserName(Long userId) {
        if (users == null || userId == null) return "người kiểm duyệt khác";
        return users.findById(userId.intValue()).map(User::getFullName).orElse("người kiểm duyệt khác");
    }

    private void recordAudit(LawGap gap, User actor, String action, String fromStatus, String toStatus, String note) {
        if (audits == null) return;
        LawGapAudit audit = new LawGapAudit();
        audit.setLawGap(gap);
        audit.setActorId(actor == null ? null : actor.getId().longValue());
        audit.setAction(action);
        audit.setFromStatus(fromStatus);
        audit.setToStatus(toStatus);
        audit.setNote(note);
        audits.save(audit);
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
