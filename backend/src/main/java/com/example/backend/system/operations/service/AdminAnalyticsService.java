package com.example.backend.system.operations.service;

import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import com.example.backend.system.library.model.entity.LibraryItem;
import com.example.backend.system.library.model.enums.Visibility;
import com.example.backend.system.library.repository.LibraryItemRepository;
import com.example.backend.system.operations.dto.AdminAnalyticsDto;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PlanRevenue;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PostBreakdown;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.PostStats;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.RevenueData;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.TimelinePoint;
import com.example.backend.system.operations.dto.AdminAnalyticsDto.TransactionRow;
import com.example.backend.system.school.model.entity.SchoolPayment;
import com.example.backend.system.school.repository.SchoolPaymentRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {
    private final SchoolPaymentRepository paymentRepository;
    private final LibraryItemRepository libraryRepository;
    private final AssignmentSubmissionRepository submissionRepository;

    @Transactional(readOnly = true)
    public AdminAnalyticsDto getAnalytics() {
        Instant now = Instant.now();
        Instant oneWeekAgo = now.minus(7, ChronoUnit.DAYS);
        Instant oneMonthAgo = now.minus(30, ChronoUnit.DAYS);

        Instant w4 = oneWeekAgo, w3 = now.minus(14, ChronoUnit.DAYS), w2 = now.minus(21, ChronoUnit.DAYS);
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
        long postsThisWeek = posts.getWeekTotal(), postsThisMonth = posts.getMonthTotal();
        long totalSubmissions = submissionRepository.count();
        // Preserve the existing operations metric contract; this optimization does not redefine it.
        long operationsThisWeek = Math.max(25, totalSubmissions / 3 + 15);
        long operationsThisMonth = Math.max(80, totalSubmissions + 40);
        var byPlan = paymentRepository.dashboardPlans().stream().map(plan -> {
            String name = switch (plan.getCode()) {
                case "STANDARD" -> "Gói Tiêu chuẩn";
                case "PRO" -> "Gói Chuyên nghiệp";
                case "ENTERPRISE" -> "Gói Mở rộng / Trường học";
                default -> "Gói " + plan.getCode();
            };
            return new PlanRevenue(plan.getCode(), name, plan.getAmount(), plan.getTotal());
        }).toList();
        var recentTransactions = paymentRepository.dashboardRecent(org.springframework.data.domain.PageRequest.of(0, 10)).stream()
            .map(p -> new TransactionRow(p.getId(), p.getSchool() != null ? p.getSchool().getName()
                    : p.getRegistrationSchoolName() != null ? p.getRegistrationSchoolName() : "Trường học",
                    p.getPlanCode() == null ? "STANDARD" : p.getPlanCode(), p.getAmountVnd() == null ? 0 : p.getAmountVnd(),
                    p.getStatus() == null ? "PENDING" : p.getStatus().toUpperCase(java.util.Locale.ROOT), p.getCreatedAt() == null ? now : p.getCreatedAt())).toList();
        List<TimelinePoint> timeline = List.of(
            new TimelinePoint("Tuần 1", payment.getRevW1(), posts.getPostsW1(), operationsThisWeek / 3),
            new TimelinePoint("Tuần 2", payment.getRevW2(), posts.getPostsW2(), operationsThisWeek / 2),
            new TimelinePoint("Tuần 3", payment.getRevW3(), posts.getPostsW3(), (long)(operationsThisWeek * 0.7)),
            new TimelinePoint("Tuần này", payment.getRevW4(), posts.getPostsW4(), operationsThisWeek));
        RevenueData revenue = new RevenueData(payment.getTotalVnd(), payment.getWeeklyVnd(), payment.getMonthlyVnd(),
            payment.getPaidCount(), payment.getPendingCount(), payment.getFailedCount(), byPlan, timeline, recentTransactions);

        return new AdminAnalyticsDto(postsThisWeek, postsThisMonth, operationsThisWeek, operationsThisMonth, revenue, postBreakdown);
    }
}


