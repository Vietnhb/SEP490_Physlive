package com.example.backend.system.operations.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminAnalyticsDto(
        long postsThisWeek,
        long postsThisMonth,
        long operationsThisWeek,
        long operationsThisMonth,
        RevenueData revenue,
        PostBreakdown postBreakdown,
        OperationBreakdown operationBreakdown
) {
    public record OperationStats(long simulationRuns, long submissions, long gradedSubmissions) {}
    public record OperationBreakdown(OperationStats weekly, OperationStats monthly, Instant weekStart, Instant monthStart, Instant measuredAt) {}

    public record PostBreakdown(
            long totalCumulativePosts,
            PostStats cumulative,
            PostStats weekly,
            PostStats monthly
    ) {}

    public record PostStats(
            long periodTotalPosts,
            long publicPosts,
            long privatePosts,
            long deletedOrHiddenPosts
    ) {}

    public record RevenueData(
            long totalVnd,
            long weeklyVnd,
            long monthlyVnd,
            long paidCount,
            long pendingCount,
            long failedCount,
            List<PlanRevenue> byPlan,
            List<TimelinePoint> timeline,
            List<TransactionRow> recentTransactions
    ) {}

    public record PlanRevenue(String planCode, String name, long amountVnd, long count) {}
    public record TimelinePoint(String period, long amountVnd, long posts, long operations) {}
    public record TransactionRow(UUID id, String schoolName, String planCode, String planName, long amountVnd, String status, Instant createdAt) {}
}

