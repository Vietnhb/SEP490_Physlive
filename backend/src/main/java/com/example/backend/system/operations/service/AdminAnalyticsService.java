package com.example.backend.system.operations.service;

import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import com.example.backend.system.library.repository.LibraryItemRepository;
import com.example.backend.system.operations.dto.AdminAnalyticsDto;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PlanRevenue;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PostBreakdown;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PostStats;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.RevenueData;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.TimelinePoint;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.TransactionRow;
import com.example.backend.system.school.model.entity.LicensePlan;
import com.example.backend.system.school.repository.LicensePlanRepository;
import com.example.backend.system.school.repository.SchoolPaymentRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {
    private final SchoolPaymentRepository paymentRepository;
    private final LibraryItemRepository libraryRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final LicensePlanRepository planRepository;
    private final com.example.backend.system.simulation.repository.SimulationRunRepository runRepository;

    @Transactional(readOnly = true)
    public AdminAnalyticsDto getAnalytics() {
        Instant now = Instant.now();
        Instant oneWeekAgo = now.minus(7, ChronoUnit.DAYS);
        Instant oneMonthAgo = now.minus(30, ChronoUnit.DAYS);

        Instant w4 = oneWeekAgo;
        Instant w3 = now.minus(14, ChronoUnit.DAYS);
        Instant w2 = now.minus(21, ChronoUnit.DAYS);
        var payment = paymentRepository.dashboardTotals(now, oneWeekAgo, oneMonthAgo, w4, w3, w2);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        ZonedDateTime local = now.atZone(zone);
        Instant startOfMonth = local.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS).toInstant();
        Instant startOfWeek = local.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).truncatedTo(ChronoUnit.DAYS).toInstant();
        var posts = libraryRepository.dashboardPosts(now, startOfWeek, startOfMonth, w4, w3, w2, oneMonthAgo);
        var cumulativeStats = new PostStats(posts.getCumTotal(), posts.getCumPub(), posts.getCumPriv(), posts.getCumDeleted());
        var weeklyStats = new PostStats(posts.getWeekTotal(), posts.getWeekPub(), posts.getWeekPriv(), posts.getWeekDeleted());
        var monthlyStats = new PostStats(posts.getMonthTotal(), posts.getMonthPub(), posts.getMonthPriv(), posts.getMonthDeleted());
        var postBreakdown = new PostBreakdown(posts.getCumTotal(), cumulativeStats, weeklyStats, monthlyStats);
        long postsThisWeek = posts.getWeekTotal();
        long postsThisMonth = posts.getMonthTotal();
        // operations are what happened: simulation runs, submissions handed in and submissions graded
        var runs = runRepository.operationCounts(startOfWeek, startOfMonth, oneMonthAgo, w2, w3, w4);
        var work = submissionRepository.operationCounts(startOfWeek, startOfMonth, oneMonthAgo, w2, w3, w4);
        long operationsThisWeek = runs.getWeek() + work.getWeek();
        long operationsThisMonth = runs.getMonth() + work.getMonth();
        // plan names come from the plan catalogue, as schools see them when they buy
        java.util.Map<String, String> planNames = new java.util.HashMap<>();
        for (LicensePlan plan : planRepository.findAll()) planNames.put(plan.getCode(), plan.getName());
        var byPlan = paymentRepository.dashboardPlans().stream()
                .map(plan -> new PlanRevenue(plan.getCode(), planName(planNames, plan.getCode()), plan.getAmount(), plan.getTotal()))
                .toList();
        var recentTransactions = paymentRepository.dashboardRecent(org.springframework.data.domain.PageRequest.of(0, 10)).stream()
            .map(p -> new TransactionRow(p.getId(), p.getSchool() != null ? p.getSchool().getName()
                    : p.getRegistrationSchoolName() != null ? p.getRegistrationSchoolName() : "Trường học",
                    p.getPlanCode(), planName(planNames, p.getPlanCode()), p.getAmountVnd() == null ? 0 : p.getAmountVnd(),
                    p.getStatus() == null ? "PENDING" : p.getStatus().toUpperCase(java.util.Locale.ROOT), p.getCreatedAt() == null ? now : p.getCreatedAt())).toList();
        List<TimelinePoint> timeline = List.of(
            new TimelinePoint("Tuần 1", payment.getRevW1(), posts.getPostsW1(), runs.getW1() + work.getW1()),
            new TimelinePoint("Tuần 2", payment.getRevW2(), posts.getPostsW2(), runs.getW2() + work.getW2()),
            new TimelinePoint("Tuần 3", payment.getRevW3(), posts.getPostsW3(), runs.getW3() + work.getW3()),
            new TimelinePoint("Tuần này", payment.getRevW4(), posts.getPostsW4(), runs.getW4() + work.getW4()));
        RevenueData revenue = new RevenueData(payment.getTotalVnd(), payment.getWeeklyVnd(), payment.getMonthlyVnd(),
            payment.getPaidCount(), payment.getPendingCount(), payment.getFailedCount(), byPlan, timeline, recentTransactions);

        return new AdminAnalyticsDto(postsThisWeek, postsThisMonth, operationsThisWeek, operationsThisMonth, revenue, postBreakdown,
                new AdminAnalyticsDto.OperationBreakdown(
                        new AdminAnalyticsDto.OperationStats(runs.getWeek(), work.getSubmittedWeek(), work.getGradedWeek()),
                        new AdminAnalyticsDto.OperationStats(runs.getMonth(), work.getSubmittedMonth(), work.getGradedMonth()),
                        startOfWeek, startOfMonth, now));
    }

    /** The name a plan is sold under; its code where the catalogue no longer lists it. */
    private static String planName(java.util.Map<String, String> names, String code) {
        if (code == null) return "Chưa xác định gói";
        String name = names.get(code);
        return name == null || name.isBlank() ? code : name;
    }
}


