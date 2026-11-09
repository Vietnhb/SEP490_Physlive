package com.example.backend.system.school.repository;

import com.example.backend.system.school.model.entity.SchoolPayment;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SchoolPaymentRepository extends JpaRepository<SchoolPayment, UUID> {
    interface DashboardTotals {
        long getTotalVnd();
        long getWeeklyVnd();
        long getMonthlyVnd();
        long getPaidCount();
        long getFailedCount();
        long getPendingCount();
        long getRevW4();
        long getRevW3();
        long getRevW2();
        long getRevW1();
    }
    @Query("""
        select coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' then coalesce(p.amountVnd, 0L) else 0L end), 0L) as totalVnd,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) > :weekAgo then coalesce(p.amountVnd, 0L) else 0L end), 0L) as weeklyVnd,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) > :monthAgo then coalesce(p.amountVnd, 0L) else 0L end), 0L) as monthlyVnd,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' then 1L else 0L end), 0L) as paidCount,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'FAILED' then 1L else 0L end), 0L) as failedCount,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') not in ('PAID','FAILED') then 1L else 0L end), 0L) as pendingCount,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) >= :w4 then coalesce(p.amountVnd, 0L) else 0L end), 0L) as revW4,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) >= :w3 and coalesce(p.createdAt, :now) < :w4 then coalesce(p.amountVnd, 0L) else 0L end), 0L) as revW3,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) >= :w2 and coalesce(p.createdAt, :now) < :w3 then coalesce(p.amountVnd, 0L) else 0L end), 0L) as revW2,
            coalesce(sum(case when coalesce(upper(p.status), 'PENDING') = 'PAID' and coalesce(p.createdAt, :now) >= :monthAgo and coalesce(p.createdAt, :now) < :w2 then coalesce(p.amountVnd, 0L) else 0L end), 0L) as revW1
        from SchoolPayment p
        """)
    DashboardTotals dashboardTotals(@Param("now") Instant now, @Param("weekAgo") Instant weekAgo, @Param("monthAgo") Instant monthAgo, @Param("w4") Instant w4, @Param("w3") Instant w3, @Param("w2") Instant w2);

    interface PlanTotals { String getCode(); long getAmount(); long getTotal(); }
    @Query("select coalesce(p.planCode, 'STANDARD') as code, coalesce(sum(p.amountVnd), 0L) as amount, count(p) as total from SchoolPayment p where upper(p.status) = 'PAID' group by coalesce(p.planCode, 'STANDARD')")
    List<PlanTotals> dashboardPlans();

    @Query("select p from SchoolPayment p left join fetch p.school order by p.createdAt desc, p.id desc")
    List<SchoolPayment> dashboardRecent(org.springframework.data.domain.Pageable page);

    interface PaymentAnalyticsRow {
        String getPlanCode();
        Long getAmountVnd();
        String getStatus();
        Instant getCreatedAt();
        Instant getPaidAt();
    }

    interface RevenueTotals {
        Long getPaidTransactions();
        Long getPendingTransactions();
        Long getReviewTransactions();
        Long getGrossPaidVnd();
    }

    @Query("""
            select
                coalesce(sum(case when p.status = 'PAID' then 1L else 0L end), 0L) as paidTransactions,
                coalesce(sum(case when p.status = 'PENDING' then 1L else 0L end), 0L) as pendingTransactions,
                coalesce(sum(case when p.status = 'REQUIRES_REVIEW' then 1L else 0L end), 0L) as reviewTransactions,
                coalesce(sum(case when p.status = 'PAID' then p.amountVnd else 0L end), 0L) as grossPaidVnd
            from SchoolPayment p
            """)
    RevenueTotals summarizeRevenue();

    @Query("""
            select p.planCode as planCode, p.amountVnd as amountVnd, p.status as status,
                   p.createdAt as createdAt, p.paidAt as paidAt
            from SchoolPayment p
            where (p.status = 'PAID' and coalesce(p.paidAt, p.createdAt) >= :from and coalesce(p.paidAt, p.createdAt) < :to)
               or (p.status <> 'PAID' and p.createdAt >= :from and p.createdAt < :to)
            """)
    List<PaymentAnalyticsRow> findAnalyticsRows(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select p from SchoolPayment p
            left join fetch p.school
            left join fetch p.manager
            order by p.createdAt desc
            """)
    List<SchoolPayment> findAllForAdmin();

    @Query("""
            select p from SchoolPayment p
            left join fetch p.school
            left join fetch p.manager
            where (p.status = 'PAID' and coalesce(p.paidAt, p.createdAt) >= :from and coalesce(p.paidAt, p.createdAt) < :to)
               or (p.status <> 'PAID' and p.createdAt >= :from and p.createdAt < :to)
            order by case when p.status = 'PAID' then coalesce(p.paidAt, p.createdAt) else p.createdAt end desc
            """)
    List<SchoolPayment> findAllForAdminPeriod(@Param("from") Instant from, @Param("to") Instant to);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"school", "manager"})
    @Query("""
        select p from SchoolPayment p left join p.school s left join p.manager m
        where ((p.status = 'PAID' and coalesce(p.paidAt, p.createdAt) >= :from and coalesce(p.paidAt, p.createdAt) < :to)
            or (p.status <> 'PAID' and p.createdAt >= :from and p.createdAt < :to))
        and (:status = 'ALL' or p.status = :status or (:status = 'FAILED' and p.status not in ('PAID','PENDING','REQUIRES_REVIEW')))
        and (lower(concat(coalesce(s.name, p.registrationSchoolName, ''), ' ', coalesce(m.email, p.registrationEmail, ''), ' ', p.planCode, ' ', cast(p.id as string))) like :query escape '!')
        order by case when p.status = 'PAID' then coalesce(p.paidAt, p.createdAt) else p.createdAt end desc, p.id desc
        """)
    org.springframework.data.domain.Page<SchoolPayment> findAdminPage(@Param("from") Instant from, @Param("to") Instant to,
            @Param("status") String status, @Param("query") String query, org.springframework.data.domain.Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from SchoolPayment p where p.id = :id")
    Optional<SchoolPayment> findLockedById(@Param("id") UUID id);
    List<SchoolPayment> findTop20ByStatusInOrderByPaidAtDesc(List<String> statuses);
    Optional<SchoolPayment> findFirstByManagerIdOrderByCreatedAtDesc(Integer managerId);
    Optional<SchoolPayment> findFirstByRegistrationEmailIgnoreCaseOrderByCreatedAtDesc(String registrationEmail);
    @Query("select count(p) > 0 from SchoolPayment p where p.purpose = 'REGISTRATION' and p.status = 'PENDING' and (lower(p.registrationEmail) = lower(:email) or upper(p.registrationSchoolCode) = upper(:code) or lower(p.registrationSchoolName) = lower(:name))")
    boolean hasPendingRegistrationConflict(@Param("email") String email, @Param("code") String code, @Param("name") String name);
    List<SchoolPayment> findBySchoolIdOrderByCreatedAtDesc(UUID schoolId);
    List<SchoolPayment> findByStatusAndCreatedAtBefore(String status, java.time.Instant cutoff);
}
