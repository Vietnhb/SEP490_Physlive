package com.example.backend.system.physics.service;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.physics.dto.SchemaContracts;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.model.entity.SchemaVersionAudit;
import com.example.backend.system.physics.repository.SchemaVersionAuditRepository;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SchemaService {
    private final SchemaVersionRepository schemaRepository;
    private final SchemaVersionAuditRepository auditRepository;
    private final SchemaDefinitionService schemaDefinitions;
    private final AccountAccessService access;
    private final CurrentUserService currentUser;

    @org.springframework.beans.factory.annotation.Autowired
    public SchemaService(SchemaVersionRepository schemaRepository,
                         SchemaVersionAuditRepository auditRepository,
                         SchemaDefinitionService schemaDefinitions,
                         AccountAccessService access,
                         CurrentUserService currentUser) {
        this.schemaRepository = schemaRepository;
        this.auditRepository = auditRepository;
        this.schemaDefinitions = schemaDefinitions;
        this.access = access;
        this.currentUser = currentUser;
    }

    public SchemaService(SchemaVersionRepository schemaRepository,
                         SchemaDefinitionService schemaDefinitions,
                         AccountAccessService access,
                         CurrentUserService currentUser) {
        this(schemaRepository, null, schemaDefinitions, access, currentUser);
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Response> listVisible(boolean enabledOnly) {
        boolean privileged = access.canEditContext(currentUser.requireCurrentUser());
        return list(enabledOnly).stream()
                .filter(schema -> privileged || schema.getLifecycleStatus() == LifecycleStatus.APPROVED)
                .map(SchemaContracts.Response::from).toList();
    }

    /** The names screens show for topic codes; the same versions as {@link #listVisible}, only three columns of each. */
    @Transactional(readOnly = true)
    public List<SchemaContracts.TopicName> topicNames() {
        boolean privileged = access.canEditContext(currentUser.requireCurrentUser());
        return schemaRepository.findTopicNames().stream()
                .filter(row -> privileged || row.getLifecycleStatus() == LifecycleStatus.APPROVED)
                .map(row -> new SchemaContracts.TopicName(row.getTopic(), row.getName(), row.getLifecycleStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SchemaVersion> list(boolean enabledOnly) {
        return enabledOnly
                ? schemaRepository.findAllByLifecycleStatusOrderByTopicAscSchemaIdAscCreatedAtDesc(LifecycleStatus.APPROVED)
                : schemaRepository.findAllByOrderByTopicAscNameAscVersionAsc();
    }

    @Transactional(readOnly = true)
    public SchemaVersion get(String schemaId) {
        return schemaRepository.findTopBySchemaIdIgnoreCaseAndLifecycleStatusOrderByCreatedAtDesc(
                schemaId.trim(), LifecycleStatus.APPROVED)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy mô hình"));
    }

    @Transactional
    public SchemaVersion create(SchemaContracts.Request request) {
        schemaDefinitions.validateTopicPackForAuthoring(request.definition(), request.schemaId());
        schemaDefinitions.validateDefinition(request.definition(), request.schemaId(), request.version(), request.topic());
        if (schemaRepository.existsBySchemaIdAndVersion(request.schemaId().trim(), request.version().trim())) {
            throw ApiException.conflict("Phiên bản mô hình đã tồn tại");
        }
        SchemaVersion schema = new SchemaVersion();
        schema.setSchemaId(request.schemaId().trim());
        schema.setName(request.name().trim());
        schema.setTopic(request.topic().trim());
        schema.setVersion(request.version().trim());
        schema.setDefinition(request.definition());
        schema.setLifecycleStatus(LifecycleStatus.DRAFT);
        SchemaVersion saved = schemaRepository.save(schema);
        recordAudit(saved, "CREATE_DRAFT", null, LifecycleStatus.DRAFT, null);
        return saved;
    }

    @Transactional
    public SchemaVersion changeLifecycle(String schemaId, LifecycleStatus status) {
        if (status == null) throw ApiException.badRequest("Vui lòng chọn trạng thái");
        List<SchemaVersion> family = schemaRepository.lockFamily(schemaId.trim());
        SchemaVersion schema = family.stream().max(java.util.Comparator.comparing(SchemaVersion::getCreatedAt,
                java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy mô hình"));
        transition(schema, status, family);
        return schemaRepository.save(schema);
    }

    @Transactional
    public SchemaVersion changeVersionLifecycle(java.util.UUID id, LifecycleStatus status) {
        if (status == null) throw ApiException.badRequest("Vui lòng chọn trạng thái");
        String schemaId = schemaRepository.schemaIdOf(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy phiên bản mô hình"));
        List<SchemaVersion> family = schemaRepository.lockFamily(schemaId);
        SchemaVersion schema = family.stream().filter(item -> item.getId().equals(id)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy phiên bản mô hình"));
        transition(schema, status, family);
        return schemaRepository.save(schema);
    }

    private void transition(SchemaVersion schema, LifecycleStatus status, List<SchemaVersion> family) {
        if (schema.getLifecycleStatus() == status) return;
        if (schema.getLifecycleStatus() == LifecycleStatus.RETIRED || status == LifecycleStatus.DRAFT)
            throw ApiException.conflict("Vui lòng tạo bản nháp mới thay vì mở lại phiên bản đã xuất bản");
        if (schema.getLifecycleStatus() == LifecycleStatus.DRAFT && status != LifecycleStatus.APPROVED) {
            throw ApiException.conflict("Chỉ có thể phê duyệt bản nháp sau khi kiểm định minh chứng");
        }
        if (status == LifecycleStatus.APPROVED) {
            schemaDefinitions.validateDefinition(schema.getDefinition(), schema.getSchemaId(), schema.getVersion(),
                    schema.getTopic());
            String actualChecksum = schemaDefinitions.compiledChecksum(schema.getDefinition());
            if (schema.getDefinitionChecksum() != null && !schema.getDefinitionChecksum().equals(actualChecksum)) {
                throw ApiException.conflict("Phát hiện dữ liệu mô hình không nhất quán: " + schema.getSchemaId() + "@" + schema.getVersion()
                                + "; vui lòng tạo phiên bản mô hình mới");
            }
            List<SchemaVersion> previous = family.stream().filter(item -> !item.getId().equals(schema.getId())
                    && item.getLifecycleStatus() == LifecycleStatus.APPROVED).toList();
            if (previous.stream().anyMatch(item -> SchemaVersionOrdering.compareVersions(schema.getVersion(), item.getVersion()) <= 0))
                throw ApiException.conflict("Đã có phiên bản mới hơn hoặc tương đương đang dùng. Hãy tạo phiên bản cao hơn.");
            previous.forEach(item -> item.setLifecycleStatus(LifecycleStatus.RETIRED));
            schemaRepository.saveAll(previous);
            // Retire the old row before the new one can satisfy the unique published-family index.
            schemaRepository.flush();
            previous.forEach(item -> recordAudit(item, "AUTO_RETIRE", LifecycleStatus.APPROVED, LifecycleStatus.RETIRED,
                    "Tự động ngừng dùng khi phê duyệt v" + schema.getVersion()));
            schema.setDefinitionChecksum(actualChecksum);
        }
        LifecycleStatus fromStatus = schema.getLifecycleStatus();
        schema.setLifecycleStatus(status);
        recordAudit(schema, status == LifecycleStatus.APPROVED ? "APPROVE" : "RETIRE", fromStatus, status, null);
    }

    @Transactional
    public SchemaVersion updateDraft(java.util.UUID id, SchemaContracts.Request request) {
        SchemaVersion schema = schemaRepository.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy phiên bản mô hình"));
        if (schema.getLifecycleStatus() != LifecycleStatus.DRAFT) throw ApiException.conflict("Chỉ có thể chỉnh sửa bản nháp");
        if (request.expectedRecordVersion() != null && !request.expectedRecordVersion().equals(schema.getRecordVersion()))
            throw ApiException.conflict("Bản nháp đã được người khác chỉnh sửa. Hãy tải lại trang để xem phiên bản mới nhất trước khi lưu.");
        if (!schema.getSchemaId().equals(request.schemaId()) || !schema.getVersion().equals(request.version()))
            throw ApiException.conflict("Không thể thay đổi định danh mô hình hoặc phiên bản");
        schemaDefinitions.validateTopicPackForAuthoring(request.definition(), request.schemaId());
        schemaDefinitions.validateDefinition(request.definition(), request.schemaId(), request.version(), request.topic());
        schema.setName(request.name().trim()); schema.setTopic(request.topic().trim()); schema.setDefinition(request.definition());
        SchemaVersion saved = schemaRepository.save(schema);
        recordAudit(saved, "UPDATE_DRAFT", LifecycleStatus.DRAFT, LifecycleStatus.DRAFT, null);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Summary> listSummaries() {
        return schemaRepository.findSummaries().stream()
                .map(row -> new SchemaContracts.Summary(row.getId(), row.getSchemaId(), row.getName(),
                        row.getTopic(), row.getVersion(), row.getLifecycleStatus(), row.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Response> listResponsesWithActors(boolean enabledOnly) {
        List<SchemaVersion> versions = list(enabledOnly);
        if (versions.isEmpty() || auditRepository == null) {
            return versions.stream().map(SchemaContracts.Response::from).toList();
        }
        List<UUID> ids = versions.stream().map(SchemaVersion::getId).toList();
        java.util.Map<UUID, String> creators = new java.util.HashMap<>();
        java.util.Map<UUID, String> approvers = new java.util.HashMap<>();
        java.util.Map<UUID, java.time.Instant> approvedDates = new java.util.HashMap<>();
        for (SchemaVersionAudit audit : auditRepository.findAllBySchemaVersionIdInOrderByCreatedAtDesc(ids)) {
            UUID versionId = audit.getSchemaVersion().getId();
            String actorLabel = actorDisplayName(audit);
            if ("CREATE_DRAFT".equals(audit.getAction()) && actorLabel != null) {
                creators.putIfAbsent(versionId, actorLabel);
            } else if ("APPROVE".equals(audit.getAction())) {
                if (actorLabel != null) approvers.putIfAbsent(versionId, actorLabel);
                approvedDates.putIfAbsent(versionId, audit.getCreatedAt());
            }
        }
        return versions.stream()
                .map(v -> SchemaContracts.Response.from(
                        v,
                        creators.get(v.getId()),
                        approvers.get(v.getId()),
                        approvedDates.get(v.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.FamilyAudit> allHistory() {
        if (auditRepository == null) {
            return List.of();
        }
        return auditRepository.recentHistory(org.springframework.data.domain.PageRequest.of(0, 200)).stream()
                .map(SchemaService::familyAudit)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.FamilyAudit> familyHistory(String schemaId) {
        if (auditRepository == null || schemaId == null || schemaId.isBlank()) {
            return List.of();
        }
        return auditRepository.familyHistory(schemaId.trim(), org.springframework.data.domain.PageRequest.of(0, 100)).stream()
                .map(SchemaService::familyAudit)
                .toList();
    }

    private static SchemaContracts.FamilyAudit familyAudit(SchemaVersionAuditRepository.HistoryRow row) {
        return new SchemaContracts.FamilyAudit(row.getId(), row.getVersionId(), row.getSchemaId(), row.getName(),
                row.getVersion(), row.getActorName(), row.getActorEmail(), row.getAction(), row.getFromStatus(),
                row.getToStatus(), row.getNote(), row.getCreatedAt());
    }

    private static String actorDisplayName(SchemaVersionAudit audit) {
        if (audit.getActor() == null) return null;
        String name = audit.getActor().getFullName();
        if (name != null && !name.isBlank()) return name.trim();
        String email = audit.getActor().getEmail();
        return (email != null && !email.isBlank()) ? email.trim() : null;
    }

    @Transactional(readOnly = true)
    public List<SchemaContracts.Audit> history(UUID id) {
        if (!schemaRepository.existsById(id)) {
            throw ApiException.notFound("Không tìm thấy phiên bản mô hình");
        }
        return auditRepository.findTop100BySchemaVersionIdOrderByCreatedAtDesc(id).stream()
                .map(row -> new SchemaContracts.Audit(
                        row.getId(),
                        row.getSchemaVersion().getId(),
                        row.getActor() == null ? null : row.getActor().getFullName(),
                        row.getActor() == null ? null : row.getActor().getEmail(),
                        row.getAction(),
                        row.getFromStatus(),
                        row.getToStatus(),
                        row.getNote(),
                        row.getCreatedAt()))
                .toList();
    }

    private void recordAudit(SchemaVersion schema, String action, LifecycleStatus fromStatus, LifecycleStatus toStatus, String note) {
        if (auditRepository == null) return;
        SchemaVersionAudit audit = new SchemaVersionAudit();
        audit.setSchemaVersion(schema);
        audit.setActor(currentUser == null ? null : currentUser.currentUserOrNull());
        audit.setAction(action);
        audit.setFromStatus(fromStatus);
        audit.setToStatus(toStatus);
        audit.setNote(note);
        auditRepository.save(audit);
    }

    @Transactional
    public void deleteDraft(java.util.UUID id) {
        SchemaVersion schema = schemaRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy phiên bản mô hình"));
        if (schema.getLifecycleStatus() != LifecycleStatus.DRAFT) {
            throw ApiException.conflict("Chỉ có thể xóa phiên bản ở trạng thái bản nháp");
        }
        schemaRepository.delete(schema);
    }
}
