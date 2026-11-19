package com.example.backend.system.support.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.AccountAppealService;
import com.example.backend.system.account.dto.AppealContracts.AppealResponse;
import com.example.backend.system.support.dto.SupportContracts.SupportView;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Merge the two sources in SQL BEFORE ordering and paging. No cross-school rows are loaded. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupportInboxService {
    private final EntityManager entityManager;
    private final CurrentUserService currentUser;
    private final SupportService support;
    private final AccountAppealService appeals;
    public record InboxPage(List<SupportView> support, List<AppealResponse> appeals, long totalElements, int totalPages, int page) { }

    /** The appeals a handler sees; the school query keeps to the handler's own school and its staff and students. */
    private static final String APPEAL_ROWS = "select a.id, 'ACCOUNT' as kind, a.reason as subject, a.status, a.created_at, u.full_name, u.email, "
            + "case when a.suspension_scope = 'SCHOOL' then 'SCHOOL' else 'MANAGER' end as handler "
            + "from account_appeals a join users u on u.id = a.user_id join roles r on r.id = u.role_id "
            + "where r.name not in ('ADMIN','MANAGER')";
    private static final String SCHOOL_APPEALS = APPEAL_ROWS + " and a.school_id = :school and r.name in ('STAFF','STUDENT')";
    private static final String ALL_ITEMS = APPEAL_ROWS + " union all select s.id, s.kind, s.subject, s.status, s.created_at, u.full_name, u.email, "
            + "case when s.kind = 'COMPLAINT' then 'REVIEWER' else 'MANAGER' end as handler "
            + "from support_items s join users u on u.id = s.sender_id";
    /** Each filter is a bound value; ALL (or an empty search) leaves that filter out. */
    private static final String FILTERS = ") inbox where (:kind = 'ALL' or kind = :kind) and (:handler = 'ALL' or handler = :handler) "
            + "and (:status = 'ALL' or (:status = 'DONE' and status in ('RESOLVED','APPROVED','REJECTED')) "
            + "or (:status = 'TODO' and status not in ('RESOLVED','APPROVED','REJECTED'))) "
            + "and created_at >= :fromInstant and created_at < :untilInstant "
            + "and (:search = '' or lower(concat(coalesce(full_name,''), ' ', email, ' ', subject)) like :search escape '!')";
    private static final String ROW_ORDER = " order by created_at desc, id desc";
    private static final String SCHOOL_COUNT = "select count(*) from (" + SCHOOL_APPEALS + FILTERS;
    private static final String SCHOOL_ROWS = "select id, kind from (" + SCHOOL_APPEALS + FILTERS + ROW_ORDER;
    private static final String ALL_COUNT = "select count(*) from (" + ALL_ITEMS + FILTERS;
    private static final String ALL_ROWS = "select id, kind from (" + ALL_ITEMS + FILTERS + ROW_ORDER;

    private static final String PENDING_APPEALS = "select count(*) from account_appeals a join users u on u.id = a.user_id join roles r on r.id = u.role_id "
            + "where a.status = 'PENDING' and a.suspension_id = u.suspension_id and a.suspension_scope = u.suspension_scope "
            + "and (u.active = false or u.account_status = 'SUSPENDED_READ_ONLY') and u.id <> :actor "
            + "and r.name not in ('ADMIN','MANAGER')";
    private static final String PENDING_SYSTEM = PENDING_APPEALS + " and a.suspension_scope = 'SYSTEM'";
    private static final String PENDING_SCHOOL = PENDING_APPEALS + " and a.suspension_scope = 'SCHOOL' and r.name in ('STAFF','STUDENT') "
            + "and a.school_id = :school and u.school_id = a.school_id";
    private static final String OPEN_SUPPORT = "select count(*) from support_items where kind <> 'COMPLAINT' and status <> 'RESOLVED'";
    private static final String ALL = "ALL";

    /** Who is asking: a manager sees every school; a school handler only its own. */
    private record Handler(User actor, UUID school) {
        boolean manager() { return school == null; }
    }

    private Handler handler() {
        User actor = currentUser.requireCurrentUser();
        String role = actor.getRole() == null ? "" : actor.getRole().getName();
        if (!Set.of("SCHOOL", "MANAGER").contains(role)) throw ApiException.forbidden("Not an inbox handler.");
        if (!"SCHOOL".equals(role)) return new Handler(actor, null);
        if (actor.getSchool() == null) throw ApiException.forbidden("No school.");
        return new Handler(actor, actor.getSchool().getId());
    }

    public InboxPage page(int page, int size, String kind, String handler, String status, String search) {
        return page(page, size, kind, handler, status, search, null, null);
    }

    public InboxPage page(int page, int size, String kind, String handler, String status, String search, java.time.LocalDate fromDate, java.time.LocalDate toDate) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) throw ApiException.badRequest("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        var zone = java.time.ZoneId.of("Asia/Ho_Chi_Minh");
        com.example.backend.common.dto.PageResponse.request(page, size, org.springframework.data.domain.Sort.unsorted());
        if (search != null && search.length() > 200) throw ApiException.badRequest("Search is too long.");
        Handler asking = handler();
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("fromInstant", fromDate == null ? java.time.Instant.parse("1900-01-01T00:00:00Z") : fromDate.atStartOfDay(zone).toInstant());
        parameters.put("untilInstant", toDate == null ? java.time.Instant.parse("9999-12-31T00:00:00Z") : toDate.plusDays(1).atStartOfDay(zone).toInstant());
        parameters.put("kind", kind == null ? ALL : kind);
        parameters.put("handler", handler == null ? ALL : handler);
        parameters.put("status", "DONE".equals(status) || "TODO".equals(status) ? status : ALL);
        parameters.put("search", search == null || search.isBlank() ? ""
                : "%" + search.trim().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
        if (!asking.manager()) parameters.put("school", asking.school());
        var count = entityManager.createNativeQuery(asking.manager() ? ALL_COUNT : SCHOOL_COUNT);
        parameters.forEach(count::setParameter);
        long total = ((Number) count.getSingleResult()).longValue();
        int pages = (int) Math.ceil((double) total / size);
        int effective = Math.clamp(page, 0, Math.max(0, pages - 1)); // page is never negative (checked above)
        var rows = entityManager.createNativeQuery(asking.manager() ? ALL_ROWS : SCHOOL_ROWS);
        parameters.forEach(rows::setParameter);
        rows.setFirstResult(Math.multiplyExact(effective, size));
        rows.setMaxResults(size);
        List<UUID> supportIds = new ArrayList<>();
        List<UUID> appealIds = new ArrayList<>();
        for (Object raw : rows.getResultList()) {
            Object[] row = (Object[]) raw;
            ("ACCOUNT".equals(row[1]) ? appealIds : supportIds).add(UUID.fromString(row[0].toString()));
        }
        return new InboxPage(supportIds.isEmpty() ? List.of() : support.viewsByIds(supportIds),
                appeals.viewsByIds(appealIds), total, pages, effective);
    }

    public long pendingCount() {
        Handler asking = handler(); // exactly the same handler access as the inbox
        var appealsQuery = entityManager.createNativeQuery(asking.manager() ? PENDING_SYSTEM : PENDING_SCHOOL)
                .setParameter("actor", asking.actor().getId());
        if (!asking.manager()) appealsQuery.setParameter("school", asking.school());
        long count = ((Number) appealsQuery.getSingleResult()).longValue();
        if (asking.manager()) count += ((Number) entityManager.createNativeQuery(OPEN_SUPPORT).getSingleResult()).longValue();
        return count;
    }
}
