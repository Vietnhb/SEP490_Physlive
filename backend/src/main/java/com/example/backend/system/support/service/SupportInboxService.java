package com.example.backend.system.support.service;

import com.example.backend.exception.ApiException;
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

    private String source() {
        var actor = currentUser.requireCurrentUser();
        String role = actor.getRole() == null ? "" : actor.getRole().getName();
        if (!Set.of("SCHOOL", "MANAGER").contains(role)) throw ApiException.forbidden("Not an inbox handler.");
        String scope;
        if ("SCHOOL".equals(role)) {
            if (actor.getSchool() == null) throw ApiException.forbidden("No school.");
            scope = " and a.school_id = '" + actor.getSchool().getId() + "' and r.name in ('STAFF','STUDENT')";
        } else scope = "";
        // UUID above is obtained from the authenticated principal, never a request parameter.
        return "select a.id, 'ACCOUNT' as kind, a.reason as subject, a.status, a.created_at, u.full_name, u.email, "
            + "case when a.suspension_scope = 'SCHOOL' then 'SCHOOL' else 'MANAGER' end as handler "
            + "from account_appeals a join users u on u.id = a.user_id join roles r on r.id = u.role_id "
            + "where r.name not in ('ADMIN','MANAGER')" + scope
            + ("SCHOOL".equals(role) ? "" : " union all select s.id, s.kind, s.subject, s.status, s.created_at, u.full_name, u.email, "
                + "case when s.kind = 'COMPLAINT' then 'REVIEWER' else 'MANAGER' end as handler "
                + "from support_items s join users u on u.id = s.sender_id");
    }

    public InboxPage page(int page, int size, String kind, String handler, String status, String search) {
        com.example.backend.common.dto.PageResponse.request(page, size, org.springframework.data.domain.Sort.unsorted());
        if (search != null && search.length() > 200) throw ApiException.badRequest("Search is too long.");
        String sql = " from (" + source() + ") inbox where 1=1";
        Map<String,Object> parameters = new HashMap<>();
        if (kind != null && !kind.equals("ALL")) { sql += " and kind = :kind"; parameters.put("kind", kind); }
        if (handler != null && !handler.equals("ALL")) { sql += " and handler = :handler"; parameters.put("handler", handler); }
        if ("DONE".equals(status)) sql += " and status in ('RESOLVED','APPROVED','REJECTED')";
        if ("TODO".equals(status)) sql += " and status not in ('RESOLVED','APPROVED','REJECTED')";
        if (search != null && !search.isBlank()) {
            sql += " and lower(concat(coalesce(full_name,''), ' ', email, ' ', subject)) like :search escape '!'";
            parameters.put("search", "%" + search.trim().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_") + "%");
        }
        var count = entityManager.createNativeQuery("select count(*)" + sql);
        parameters.forEach(count::setParameter);
        long total = ((Number) count.getSingleResult()).longValue();
        int pages = (int) Math.ceil((double)total / size);
        int effective = Math.min(page, Math.max(0, pages - 1));
        var rows = entityManager.createNativeQuery("select id, kind" + sql + " order by created_at desc, id desc");
        parameters.forEach(rows::setParameter);
        rows.setFirstResult(Math.multiplyExact(effective, size)); rows.setMaxResults(size);
        List<UUID> supportIds = new ArrayList<>(), appealIds = new ArrayList<>();
        for (Object raw : rows.getResultList()) {
            Object[] row = (Object[]) raw;
            ("ACCOUNT".equals(row[1]) ? appealIds : supportIds).add(UUID.fromString(row[0].toString()));
        }
        return new InboxPage(supportIds.isEmpty() ? List.of() : support.viewsByIds(supportIds),
                appeals.viewsByIds(appealIds), total, pages, effective);
    }

    public long pendingCount() {
        source(); // Enforce exactly the same handler access as the inbox.
        var actor = currentUser.requireCurrentUser();
        boolean manager = "MANAGER".equals(actor.getRole().getName());
        String sql = "select count(*) from account_appeals a join users u on u.id = a.user_id join roles r on r.id = u.role_id "
            + "where a.status = 'PENDING' and a.suspension_id = u.suspension_id and a.suspension_scope = u.suspension_scope "
            + "and (u.active = false or u.account_status = 'SUSPENDED_READ_ONLY') and u.id <> :actor "
            + "and r.name not in ('ADMIN','MANAGER') and a.suspension_scope = '" + (manager ? "SYSTEM" : "SCHOOL") + "'"
            + (manager ? "" : " and r.name in ('STAFF','STUDENT') and a.school_id = '" + actor.getSchool().getId() + "' and u.school_id = a.school_id");
        long count = ((Number)entityManager.createNativeQuery(sql).setParameter("actor", actor.getId()).getSingleResult()).longValue();
        if (manager) count += ((Number)entityManager.createNativeQuery("select count(*) from support_items where kind <> 'COMPLAINT' and status <> 'RESOLVED'").getSingleResult()).longValue();
        return count;
    }
}
