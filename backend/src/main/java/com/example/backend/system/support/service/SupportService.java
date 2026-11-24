package com.example.backend.system.support.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.support.dto.SupportContracts.CreateSupportRequest;
import com.example.backend.system.support.dto.SupportContracts.SupportView;
import com.example.backend.system.support.dto.SupportContracts.UpdateSupportRequest;
import com.example.backend.system.support.dto.SupportContracts;
import com.example.backend.system.support.model.entity.SupportItem;
import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.model.enums.SupportStatus;
import com.example.backend.system.support.repository.SupportItemRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportService {
    private static final int MAX_SNAPSHOT_BYTES = 1_500_000;
    private final SupportItemRepository repository;
    private final CurrentUserService currentUser;
    private final com.example.backend.system.account.service.AccountAccessService accountAccess;
    private final com.example.backend.system.simulation.repository.SimulationRepository simulations;
    private final com.example.backend.system.library.repository.LibraryItemRepository library;
    private final com.example.backend.system.reviewer.service.LawGapService lawGapService;

    @org.springframework.beans.factory.annotation.Autowired
    public SupportService(SupportItemRepository repository, CurrentUserService currentUser,
            com.example.backend.system.account.service.AccountAccessService accountAccess,
            com.example.backend.system.simulation.repository.SimulationRepository simulations,
            com.example.backend.system.library.repository.LibraryItemRepository library,
            com.example.backend.system.reviewer.service.LawGapService lawGapService) {
        this.repository = repository;
        this.currentUser = currentUser;
        this.accountAccess = accountAccess;
        this.simulations = simulations;
        this.library = library;
        this.lawGapService = lawGapService;
    }

    public SupportService(SupportItemRepository repository, CurrentUserService currentUser,
            com.example.backend.system.account.service.AccountAccessService accountAccess) {
        this(repository, currentUser, accountAccess, null, null, null);
    }

    @Transactional
    public SupportView create(SupportKind kind, CreateSupportRequest request) {
        if (kind == null) {
            throw ApiException.badRequest("Vui lòng chọn loại yêu cầu hỗ trợ");
        }
        if (request == null || request.subject() == null || request.subject().isBlank()
                || request.content() == null || request.content().isBlank()) {
            throw ApiException.badRequest("Vui lòng nhập tiêu đề và nội dung");
        }
        if (request.subject().trim().length() > 180 || request.content().trim().length() > 10000) {
            throw ApiException.badRequest("Tiêu đề hoặc nội dung quá dài");
        }
        User sender = currentUser.requireCurrentUser();
        if (kind == SupportKind.COMPLAINT && !accountAccess.canTeach(sender))
            throw ApiException.forbidden("Chỉ giáo viên có quyền giảng dạy mới được báo lỗi mô phỏng.");
        SupportItem item = new SupportItem();
        item.setKind(kind);
        item.setSender(sender);
        item.setSubject(request.subject().trim());
        item.setContent(request.content().trim());
        item.setStatus(SupportStatus.OPEN);
        return view(repository.save(item));
    }

    @Transactional
    public SupportView createComplaint(SupportContracts.CreateComplaintRequest request) {
        User sender = currentUser.requireCurrentUser();
        if (!accountAccess.canTeach(sender))
            throw ApiException.forbidden("Chỉ giáo viên mới gửi được khiếu nại về mô phỏng.");
        if (request.simulationId() != null && simulations != null && library != null) {
            var simulation = simulations.findById(request.simulationId())
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy mô phỏng đính kèm."));
            boolean isOwner = simulation.getOwner() != null && sender.getId().equals(simulation.getOwner().getId());
            boolean isVisibleLibrary = library.findVisiblePublishedSimulation(
                    request.simulationId(),
                    java.util.Set.of(com.example.backend.system.library.model.enums.Visibility.SHARED,
                            com.example.backend.system.library.model.enums.Visibility.PUBLIC),
                    com.example.backend.system.library.model.enums.Visibility.PUBLIC,
                    java.util.Set.of(com.example.backend.system.library.model.enums.LibraryModerationStatus.APPROVED,
                            com.example.backend.system.library.model.enums.LibraryModerationStatus.FEATURED),
                    sender.getInstitutionId()).isPresent();
            if (!isOwner && !isVisibleLibrary) {
                throw ApiException.forbidden("Bạn không có quyền đính kèm mô phỏng này vào khiếu nại.");
            }
        }
        if (request.simulationSnapshot() != null
                && request.simulationSnapshot().toString().length() > MAX_SNAPSHOT_BYTES) {
            throw ApiException.badRequest("Dữ liệu bản chụp mô phỏng quá lớn.");
        }
        SupportView created = create(SupportKind.COMPLAINT,
                new CreateSupportRequest(request.subject(), request.content()));
        if (request.simulationId() == null && request.simulationSnapshot() == null)
            return created;
        SupportItem item = repository.findById(created.id())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy yêu cầu hỗ trợ"));
        if (request.simulationId() != null)
            item.setSimulationId(request.simulationId());
        if (request.simulationSnapshot() != null)
            item.setSimulationSnapshot(request.simulationSnapshot());
        return view(repository.save(item));
    }

    @Transactional(readOnly = true)
    public SupportContracts.ComplaintCounts complaintCounts() {
        requireReviewer();
        long open = repository.countByKindAndStatus(SupportKind.COMPLAINT, SupportStatus.OPEN);
        long read = repository.countByKindAndStatus(SupportKind.COMPLAINT, SupportStatus.READ);
        long resolved = repository.countByKindAndStatus(SupportKind.COMPLAINT, SupportStatus.RESOLVED);
        Instant now = Instant.now();
        Instant ago24h = now.minusSeconds(24 * 3600L);
        Instant ago48h = now.minusSeconds(48 * 3600L);
        long under24h = repository.countByKindAndStatusNotAndCreatedAtGreaterThanEqual(SupportKind.COMPLAINT,
                SupportStatus.RESOLVED, ago24h);
        long from24To48h = repository.countByKindAndStatusNotAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                SupportKind.COMPLAINT, SupportStatus.RESOLVED, ago48h, ago24h);
        long over48h = repository.countByKindAndStatusNotAndCreatedAtLessThan(SupportKind.COMPLAINT,
                SupportStatus.RESOLVED, ago48h);
        Instant oldestOpen = repository.findOldestCreatedAtByKindAndStatusNot(SupportKind.COMPLAINT,
                SupportStatus.RESOLVED);
        return new SupportContracts.ComplaintCounts(open, read, resolved, open + read + resolved, under24h, from24To48h,
                over48h, oldestOpen);
    }

    @Transactional
    public SupportView claimComplaint(UUID id, boolean release) {
        return claimComplaint(id, release, false);
    }

    @Transactional
    public SupportView claimComplaint(UUID id, boolean release, boolean force) {
        User reviewer = requireReviewer();
        SupportItem item = repository.findByIdForUpdate(id).filter(value -> value.getKind() == SupportKind.COMPLAINT)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khiếu nại."));
        if (item.getStatus() == SupportStatus.RESOLVED) {
            throw ApiException.conflict("Khiếu nại đã được giải quyết.");
        }
        if (release) {
            if (item.getAssignedTo() != null && !item.getAssignedTo().getId().equals(reviewer.getId())) {
                throw ApiException.conflict("Chỉ người đang nhận xử lý mới có thể bỏ nhận.");
            }
            item.setAssignedTo(null);
        } else {
            if (!force && item.getAssignedTo() != null && !item.getAssignedTo().getId().equals(reviewer.getId())) {
                throw ApiException
                        .conflict("Khiếu nại này đang được " + item.getAssignedTo().getFullName() + " xử lý.");
            }
            item.setAssignedTo(reviewer);
        }
        return view(repository.save(item));
    }

    @Transactional(readOnly = true)
    public List<SupportView> complaintsForReview() {
        requireReviewer();
        return repository.findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT).stream()
                .map(item -> view(item, false)).toList();
    }

    @Transactional(readOnly = true)
    public SupportContracts.ComplaintPage complaintsForReviewPage(String group, SupportStatus status, String query,
                                                                  boolean assignedToMe, boolean unassignedOnly,
                                                                  Integer slaHours, java.time.LocalDate from,
                                                                  java.time.LocalDate to, int page, int size) {
        User reviewer = requireReviewer();
        if (from != null && to != null && from.isAfter(to)) {
            throw ApiException.badRequest("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        }
        String normalizedGroup = switch (group == null ? "TODO" : group.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "DONE", "ALL" -> group.trim().toUpperCase(java.util.Locale.ROOT);
            default -> "TODO";
        };
        int safePage = Math.max(0, page);
        int safeSize = Math.clamp(size, 1, 50);
        // FIFO (oldest first) for TODO so SLA-urgent complaints stay on top; newest first for DONE/ALL.
        org.springframework.data.domain.Sort sort = "TODO".equals(normalizedGroup)
                ? org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC, "createdAt", "id")
                : org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt", "id");
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(safePage, safeSize, sort);
        var zone = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        Instant fromInstant = from == null ? Instant.parse("1900-01-01T00:00:00Z") : from.atStartOfDay(zone).toInstant();
        Instant untilInstant = to == null ? Instant.parse("9999-12-31T00:00:00Z") : to.plusDays(1).atStartOfDay(zone).toInstant();
        boolean useSla = slaHours != null && slaHours > 0;
        Instant slaBefore = useSla ? Instant.now().minusSeconds(slaHours * 3600L) : Instant.now();
        String pattern = (query != null && !query.isBlank()) ? "%" + foldVietnamese(query.trim()) + "%" : "";
        int assignedToId = assignedToMe ? reviewer.getId() : -1;
        String exactStatus = status == null ? "ALL" : status.name();
        org.springframework.data.domain.Page<SupportItem> result = repository.findComplaintsForReviewPage(
                normalizedGroup, exactStatus, assignedToId, unassignedOnly && !assignedToMe, useSla, slaBefore,
                fromInstant, untilInstant, pattern, pageable);
        return new SupportContracts.ComplaintPage(
                result.getContent().stream().map(item -> view(item, false)).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public SupportView complaintForReview(UUID id) {
        requireReviewer();
        SupportItem item = repository.findDetailedByIdAndKind(id, SupportKind.COMPLAINT)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khiếu nại."));
        return view(item, true);
    }

    @Transactional
    public SupportView escalateComplaintToLawGap(UUID id, SupportContracts.EscalateLawGapRequest request) {
        User reviewer = requireReviewer();
        if (accountAccess.canEditContext(reviewer)) {
            throw ApiException.forbidden("Tài khoản đã có quyền biên soạn dữ liệu chuẩn, hãy chỉnh sửa trực tiếp chủ đề vật lý thay vì chuyển tiếp.");
        }
        if (lawGapService == null) {
            throw ApiException.badRequest("Chức năng chuyển sang rà soát định luật chưa sẵn sàng.");
        }
        SupportItem item = repository.findByIdForUpdate(id).filter(value -> value.getKind() == SupportKind.COMPLAINT)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khiếu nại."));
        if (item.getStatus() == SupportStatus.RESOLVED)
            throw ApiException.conflict("Khiếu nại đã hoàn tất, không thể chuyển sang rà soát định luật.");
        if (item.getSender().getId().equals(reviewer.getId()))
            throw ApiException.conflict("Không thể tự chuyển khiếu nại của chính mình.");
        if (item.getAssignedTo() != null && !item.getAssignedTo().getId().equals(reviewer.getId()))
            throw ApiException.conflict("Khiếu nại đang được " + item.getAssignedTo().getFullName()
                    + " nhận xử lý. Hãy bấm \"Tiếp nhận lại\" trước khi chuyển.");
        if (item.getLawGap() != null)
            throw ApiException.conflict("Khiếu nại này đã được chuyển sang mục Định luật cần rà soát.");

        String schemaId = request == null ? null : request.schemaId();
        String topic = request == null ? null : request.topic();
        if ((schemaId == null || schemaId.isBlank()) && item.getSimulationSnapshot() != null) {
            String snapSchema = item.getSimulationSnapshot().path("simulationSpec").path("schemaId").asText("");
            if (!snapSchema.isBlank()) schemaId = snapSchema;
        }
        if ((topic == null || topic.isBlank()) && item.getSimulationSnapshot() != null) {
            String snapTopic = item.getSimulationSnapshot().path("simulationSpec").path("topic").asText("");
            if (!snapTopic.isBlank()) topic = snapTopic;
        }
        if ((schemaId == null || schemaId.isBlank() || topic == null || topic.isBlank())
                && item.getSimulationId() != null && simulations != null) {
            var sim = simulations.findById(item.getSimulationId()).orElse(null);
            if (sim != null && sim.getSpecification() != null) {
                if (schemaId == null || schemaId.isBlank()) schemaId = sim.getSpecification().getSchemaId();
                if (topic == null || topic.isBlank()) topic = sim.getSpecification().getTopic();
            }
        }
        String note = request == null ? null : request.note();
        var gap = lawGapService.createFromComplaint(item.getId(), item.getSubject(), item.getContent(), schemaId, topic, note);
        item.setLawGap(gap);
        item.setReviewerReferred(true);
        if (item.getStatus() == SupportStatus.OPEN) {
            item.setStatus(SupportStatus.READ);
        }
        if (item.getAdminResponse() == null || item.getAdminResponse().isBlank()) {
            item.setAdminResponse("Đã ghi nhận lỗi hiển thị/tính toán và chuyển sang bộ phận biên soạn dữ liệu chuẩn để khắc phục.");
            item.setRespondedBy(reviewer);
            item.setRespondedAt(Instant.now());
        }
        return view(repository.save(item), true);
    }

    @Transactional
    public SupportView resolveComplaint(UUID id, UpdateSupportRequest request) {
        User reviewer = requireReviewer();
        SupportItem item = repository.findByIdForUpdate(id).filter(value -> value.getKind() == SupportKind.COMPLAINT)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khiếu nại."));
        if (item.getStatus() == SupportStatus.RESOLVED)
            throw ApiException.conflict("Khiếu nại đã hoàn tất. Vui lòng tạo báo lỗi mới nếu vấn đề vẫn tồn tại.");
        if (item.getSender().getId().equals(reviewer.getId()))
            throw ApiException.conflict("Không thể tự giải quyết khiếu nại của chính mình.");
        if (item.getAssignedTo() != null && !item.getAssignedTo().getId().equals(reviewer.getId()))
            throw ApiException.conflict("Khiếu nại đang được " + item.getAssignedTo().getFullName()
                    + " nhận xử lý. Hãy bấm \"Tiếp nhận lại\" trước khi cập nhật.");
        if (request != null && request.expectedStatus() != null && item.getStatus() != request.expectedStatus())
            throw ApiException.conflict("Trạng thái khiếu nại đã thay đổi bởi người kiểm duyệt khác. Hãy tải lại danh sách.");
        if (request != null && request.expectedRespondedAt() != null && item.getRespondedAt() != null
                && !request.expectedRespondedAt().equals(item.getRespondedAt()))
            throw ApiException.conflict("Khiếu nại vừa được người kiểm duyệt khác phản hồi. Hãy tải lại để xem nội dung mới nhất.");
        String response = request == null || request.response() == null ? "" : request.response().trim();
        if (response.length() > 10000)
            throw ApiException.badRequest("Phản hồi quá dài.");
        SupportStatus status = request == null || request.status() == null ? item.getStatus() : request.status();
        if (status == SupportStatus.RESOLVED && response.isBlank()
                && (item.getAdminResponse() == null || item.getAdminResponse().isBlank()))
            throw ApiException.badRequest("Cần ghi kết quả xử lý trước khi đánh dấu đã giải quyết.");
        if (!response.isBlank()) {
            item.setAdminResponse(response);
            item.setRespondedBy(reviewer);
            item.setRespondedAt(Instant.now());
            if (status == SupportStatus.OPEN)
                status = SupportStatus.READ;
        }
        item.setStatus(status);
        if (status == SupportStatus.RESOLVED) {
            item.setAssignedTo(null);
        }
        return view(repository.save(item));
    }

    @Transactional(readOnly = true)
    public List<SupportView> mine() {
        return repository.findBySenderIdOrderByCreatedAtDesc(currentUser.requireCurrentUser().getId()).stream()
                .map(this::view)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SupportView> adminList(SupportKind kind) {
        requireManager();
        return (kind == null ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findTop200ByKindOrderByCreatedAtDesc(kind)).stream()
                .map(this::view)
                .toList();
    }

    @Transactional
    public SupportView update(UUID id, UpdateSupportRequest request) {
        User admin = requireManager();
        if (request == null) {
            throw ApiException.badRequest("Vui lòng nhập nội dung cập nhật yêu cầu hỗ trợ");
        }
        SupportItem item = repository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy yêu cầu hỗ trợ"));
        if (item.getKind() == SupportKind.COMPLAINT)
            throw ApiException.forbidden("Manager chỉ được xem báo lỗi mô phỏng. Reviewer chịu trách nhiệm xử lý.");
        SupportStatus status = request.status() == null ? item.getStatus() : request.status();
        String response = request.response() == null ? null : request.response().trim();
        if (response != null && response.length() > 10000) {
            throw ApiException.badRequest("Phản hồi của quản trị viên quá dài");
        }
        if (status == SupportStatus.RESOLVED && (response == null || response.isBlank())
                && (item.getAdminResponse() == null || item.getAdminResponse().isBlank()))
            throw ApiException.badRequest("Cần nhập phản hồi trước khi hoàn tất yêu cầu hỗ trợ.");
        if (response != null && !response.isBlank()) {
            item.setAdminResponse(response);
            item.setRespondedBy(admin);
            item.setRespondedAt(Instant.now());
            if (status == SupportStatus.OPEN) {
                status = SupportStatus.READ;
            }
        }
        item.setStatus(status);
        if (status == SupportStatus.RESOLVED) {
            item.setAssignedTo(null);
        }
        return view(repository.save(item));
    }

    @Transactional(readOnly = true)
    public List<SupportView> viewsByIds(java.util.Collection<UUID> ids) {
        requireManager();
        if (ids.isEmpty())
            return List.of();
        return repository.findAllById(ids).stream().map(this::view).toList();
    }

    private SupportView view(SupportItem item) {
        return view(item, true);
    }

    private SupportView view(SupportItem item, boolean includeSnapshot) {
        User sender = item.getSender();
        User assignee = item.getAssignedTo();
        var lawGap = item.getLawGap();
        boolean hasSnapshot = item.getSimulationSnapshot() != null && !item.getSimulationSnapshot().isNull();
        return new SupportView(item.getId(), item.getKind(), sender.getId(), sender.getFullName(), sender.getEmail(),
                item.getSubject(), item.getContent(), item.getStatus(), item.getAdminResponse(), item.getCreatedAt(),
                item.getRespondedAt(), item.getSimulationId(),
                item.getRespondedBy() == null ? null : item.getRespondedBy().getFullName(), item.isReviewerReferred(),
                includeSnapshot ? item.getSimulationSnapshot() : null,
                assignee == null ? null : assignee.getId(),
                assignee == null ? null : assignee.getFullName(),
                hasSnapshot,
                lawGap == null ? null : lawGap.getId(),
                lawGap == null ? null : lawGap.getStatus());
    }

    private static String foldVietnamese(String value) {
        String normalized = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'd');
        return normalized.toLowerCase(java.util.Locale.ROOT);
    }

    private User requireReviewer() {
        User user = currentUser.requireCurrentUser();
        if (!accountAccess.canHandleComplaints(user))
            throw ApiException.forbidden("Chỉ người kiểm duyệt được cấp quyền mới xử lý được khiếu nại mô phỏng.");
        return user;
    }

    private static boolean hasRole(User user, RoleName role) {
        return user.getRole() != null && role.matches(user.getRole().getName());
    }

    private User requireManager() {
        User user = currentUser.requireCurrentUser();
        if (user.getRole() == null || !RoleName.MANAGER.matches(user.getRole().getName()))
            throw ApiException.forbidden("Chỉ người quản lý mới được quản lý yêu cầu hỗ trợ");
        return user;
    }
}
