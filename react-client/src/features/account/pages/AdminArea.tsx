import { useState } from "react";
import { Badge, Card, Flex, Heading, SegmentedControl, Text } from "@radix-ui/themes";
import { CheckCircledIcon, CrossCircledIcon, StopwatchIcon } from "@radix-ui/react-icons";
import type { AdminAnalytics } from "../api/userApi";
import { useResource } from "../../../shared/hooks/operationsData";
import { ROLE_LABELS, type RoleType } from "../../../shared/auth/roles";
import type { User } from "../../../shared/auth/types";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import AppSidebarLayout, { type SidebarGroup } from "../../../shared/layout/AppSidebar";
import CountUp from "../../../shared/effects/reactbits/CountUp";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { DashboardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import "../styles/admin-directory.css";

const groups: SidebarGroup[] = [
  { items: [{ to: "/admin", label: "Tổng quan", icon: "grid", end: true }] },
  { label: "Quản trị", items: [{ to: "/admin/users", label: "Tài khoản người dùng", icon: "users" }] },
];

/** ADMIN area: sees every account, manages MANAGER accounts only. */
export default function AdminAreaLayout() {
  return <AppSidebarLayout id="admin" subtitle="Quản trị hệ thống" home="/admin" groups={groups} />;
}

const ROLE_ORDER: RoleType[] = ["ADMIN", "MANAGER", "REVIEWER", "SCHOOL", "STAFF", "STUDENT"];

export function AdminOverviewPage() {
  const name = useSessionStore(state => state.user?.fullName);
  const [timeframe, setTimeframe] = useState<"week" | "month">("week");

  const usersResource = useResource<User[]>("/admin/users");
  const analyticsResource = useResource<AdminAnalytics>("/admin/analytics");
  const users = usersResource.data ?? [];
  const analytics = analyticsResource.data ?? null;
  const loading = usersResource.loading || analyticsResource.loading;
  const error = usersResource.error || "";
  const analyticsError = analyticsResource.error || "";

  const managers = users.filter(item => item.role === "MANAGER");
  const locked = users.filter(item => item.active === false).length;
  const firstName = name?.trim().split(/\s+/).at(-1);

  const postBreakdown = analytics?.postBreakdown;
  const noPosts = { periodTotalPosts: 0, publicPosts: 0, privatePosts: 0, deletedOrHiddenPosts: 0 };
  const currentPostStats = (timeframe === "week" ? postBreakdown?.weekly : postBreakdown?.monthly) ?? noPosts;
  const totalCumulativePosts = postBreakdown?.totalCumulativePosts ?? 0;
  // all-time breakdown behind the bar and the three counts
  const cumulative = postBreakdown?.cumulative ?? noPosts;

  const cumulativeBasis = Math.max(1, totalCumulativePosts);
  const publicWidth = (cumulative.publicPosts / cumulativeBasis) * 100;
  const privateWidth = (cumulative.privatePosts / cumulativeBasis) * 100;
  const deletedWidth = (cumulative.deletedOrHiddenPosts / cumulativeBasis) * 100;

  const operationsCount = (timeframe === "week" ? analytics?.operationsThisWeek : analytics?.operationsThisMonth) ?? 0;
  const measured = analytics !== null;

  const revenueDisplay = timeframe === "week"
    ? (analytics?.revenue.weeklyVnd ?? 0)
    : (analytics?.revenue.monthlyVnd ?? (analytics?.revenue.totalVnd ?? 0));

  if (loading) return <div className="directory-content admin-home"><DashboardLoadingSkeleton cards={5} label="Đang tải tổng quan hệ thống…" /></div>;

  const timeline = analytics?.revenue.timeline ?? [];
  const maxAmount = Math.max(1, ...timeline.map(point => point.amountVnd));
  const hasRevenue = timeline.some(point => point.amountVnd > 0);
  const recent = (analytics?.revenue.recentTransactions ?? []).slice(0, 4);
  const plans = analytics?.revenue.byPlan ?? [];
  const periodLabel = timeframe === "week" ? "tuần này" : "tháng này";
  const postLegend = [
    { key: "public", label: "công khai", value: cumulative.publicPosts, width: publicWidth, tone: "green" },
    { key: "private", label: "cá nhân", value: cumulative.privatePosts, width: privateWidth, tone: "indigo" },
    { key: "hidden", label: "đã ẩn", value: cumulative.deletedOrHiddenPosts, width: deletedWidth, tone: "red" },
  ] as const;

  return (
    <div className="directory-content admin-home">
      <div className="directory-heading">
        <div>
          <Heading as="h1" size="7">{firstName ? `Chào ${firstName}` : "Tổng quan hệ thống"}</Heading>
          <Text as="p" size="2" color="gray" mt="1">Doanh thu, nội dung và tài khoản trên toàn nền tảng.</Text>
        </div>
        <SegmentedControl.Root size="2" value={timeframe} onValueChange={value => setTimeframe(value as "week" | "month")} aria-label="Khoảng thời gian">
          <SegmentedControl.Item value="week">Tuần này</SegmentedControl.Item>
          <SegmentedControl.Item value="month">Tháng này</SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>

      {error && <div className="ops-alert" role="alert">{error}</div>}
      {analyticsError && <div className="ops-alert" role="alert">{analyticsError}</div>}

      <div className="directory-stats" aria-label="Chỉ số hoạt động và doanh thu">
        <Card size="3" className="directory-stat admin-kpi" data-tone="green">
          <Flex justify="between" align="center">
            <Text size="2" color="gray" weight="medium">Doanh thu {periodLabel}</Text>
            <Badge color="green" size="2"><LearningIcon name="shield" /></Badge>
          </Flex>
          <Heading as="h2" size="7" mt="3">{measured ? `${revenueDisplay.toLocaleString("vi-VN")} ₫` : "—"}</Heading>
          <Text as="p" size="1" color="gray" mt="1">Tổng tích lũy {(analytics?.revenue.totalVnd ?? 0).toLocaleString("vi-VN")} ₫</Text>
        </Card>

        <Card size="3" className="directory-stat admin-kpi" data-tone="indigo">
          <Flex justify="between" align="center">
            <Text size="2" color="gray" weight="medium">Mô phỏng mới {periodLabel}</Text>
            <Badge color="indigo" size="2"><LearningIcon name="book" /></Badge>
          </Flex>
          <Heading as="h2" size="7" mt="3">{measured ? <CountUp to={currentPostStats.periodTotalPosts} duration={1} /> : "—"}</Heading>
          <Text as="p" size="1" color="gray" mt="1">Tổng tích lũy {totalCumulativePosts.toLocaleString("vi-VN")}</Text>
          <div className="admin-kpi__stack" role="img" aria-label={postLegend.map(item => `${item.value} ${item.label}`).join(", ")}>
            {postLegend.map(item => item.width > 0 && <span key={item.key} data-tone={item.tone} style={{ width: `${item.width}%` }} />)}
          </div>
          <ul className="admin-kpi__legend">
            {postLegend.map(item => <li key={item.key} data-tone={item.tone}><strong>{item.value}</strong> {item.label}</li>)}
          </ul>
        </Card>

        <Card size="3" className="directory-stat admin-kpi" data-tone="amber">
          <Flex justify="between" align="center">
            <Text size="2" color="gray" weight="medium">Thao tác {periodLabel}</Text>
            <Badge color="amber" size="2"><LearningIcon name="refresh" /></Badge>
          </Flex>
          <Heading as="h2" size="7" mt="3">{measured ? <CountUp to={operationsCount} duration={1} /> : "—"}</Heading>
          <Text as="p" size="1" color="gray" mt="1">Lượt chạy mô phỏng, nộp bài và chấm điểm</Text>
        </Card>

        <Card size="3" className="directory-stat admin-kpi" data-tone="cyan">
          <Flex justify="between" align="center">
            <Text size="2" color="gray" weight="medium">Tài khoản hoạt động</Text>
            <Badge color="cyan" size="2"><CheckCircledIcon /></Badge>
          </Flex>
          <Heading as="h2" size="7" mt="3"><CountUp to={users.length - locked} duration={1} /></Heading>
          <Text as="p" size="1" color="gray" mt="1">{users.length} tài khoản · {locked} tạm khóa</Text>
        </Card>
      </div>

      <div className="admin-home__charts">
        <Card size="3">
          <Heading as="h2" size="4">Doanh thu 4 tuần gần nhất</Heading>
          <Text as="p" size="1" color="gray">Chỉ tính giao dịch đã thanh toán</Text>

          {hasRevenue ? (
            <div className="admin-chart" role="img" aria-label={timeline.map(point => `${point.period}: ${point.amountVnd.toLocaleString("vi-VN")} ₫`).join("; ")}>
              {timeline.map(point => (
                <div key={point.period} className="admin-chart__col">
                  <Text size="1" weight="bold" color={point.amountVnd > 0 ? undefined : "gray"}>
                    {point.amountVnd > 0 ? `${(point.amountVnd / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : "—"}
                  </Text>
                  <span className="admin-chart__bar" data-empty={point.amountVnd === 0 || undefined} style={{ height: `${point.amountVnd > 0 ? Math.max(8, (point.amountVnd / maxAmount) * 100) : 2}%` }} />
                  <Text size="1" color="gray">{point.period}</Text>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-chart admin-chart--empty">
              <Text size="2" color="gray">{measured ? "Chưa có giao dịch nào được thanh toán trong 4 tuần qua." : "Chưa tải được số liệu."}</Text>
            </div>
          )}

          <Heading as="h3" size="2" mt="4" mb="2">Theo gói</Heading>
          <div className="admin-plans">
            {plans.length === 0 && <Text size="2" color="gray">{measured ? "Chưa có giao dịch đã thanh toán." : "—"}</Text>}
            {plans.map(plan => {
              const total = analytics?.revenue.totalVnd ?? 0;
              const pct = total ? Math.round((plan.amountVnd / total) * 100) : 0;
              return (
                <div key={plan.planCode}>
                  <Flex justify="between" align="baseline" gap="3" mb="1">
                    <Text size="2" weight="medium">{plan.name}</Text>
                    <Text size="2"><strong>{plan.amountVnd.toLocaleString("vi-VN")} ₫</strong> <Text color="gray">· {plan.count} giao dịch</Text></Text>
                  </Flex>
                  <span className="admin-home__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card size="3">
          <Heading as="h2" size="4">Giao dịch</Heading>
          <Text as="p" size="1" color="gray" mb="3">Theo kết quả thanh toán</Text>
          <div className="admin-tx-status">
            <div data-tone="green"><CheckCircledIcon /><strong>{analytics?.revenue.paidCount ?? "—"}</strong><span>Đã thanh toán</span></div>
            <div data-tone="amber"><StopwatchIcon /><strong>{analytics?.revenue.pendingCount ?? "—"}</strong><span>Chờ thanh toán</span></div>
            <div data-tone="red"><CrossCircledIcon /><strong>{analytics?.revenue.failedCount ?? "—"}</strong><span>Thất bại</span></div>
          </div>

          <Heading as="h3" size="2" mt="4" mb="2">Gần nhất</Heading>
          {recent.length === 0 ? (
            <Text size="2" color="gray">Chưa có giao dịch nào.</Text>
          ) : (
            <ul className="admin-home__managers">
              {recent.map(tx => (
                <li key={tx.id}>
                  <span>
                    <strong>{tx.schoolName}</strong>
                    <small>{tx.planName} · {new Date(tx.createdAt).toLocaleDateString("vi-VN")}</small>
                  </span>
                  <span className="admin-tx-amount">
                    <strong>{tx.amountVnd.toLocaleString("vi-VN")} ₫</strong>
                    <Badge color={tx.status === "PAID" ? "green" : (tx.status === "FAILED" ? "red" : "amber")} size="1" variant="soft">
                      {tx.status === "PAID" ? "Đã thanh toán" : (tx.status === "FAILED" ? "Thất bại" : "Chờ thanh toán")}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Account Distribution Grid */}
      <div className="admin-home__grid">
        <Card size="3">
          <Heading as="h2" size="4" mb="3">Tài khoản theo vai trò</Heading>
          <ul className="admin-home__roles">
            {ROLE_ORDER.map(role => {
              const count = users.filter(item => item.role === role).length;
              const share = users.length ? (count / users.length) * 100 : 0;
              return (
                <li key={role}>
                  <span>{ROLE_LABELS[role]}</span>
                  <span className="admin-home__bar" aria-hidden="true">
                    <span style={{ width: `${share}%` }} />
                  </span>
                  <strong>{count}</strong>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card size="3">
          <Heading as="h2" size="4" mb="3">Tài khoản vận hành</Heading>
          {loading ? (
            <Text size="2" color="gray">Đang tải…</Text>
          ) : managers.length === 0 ? (
            <Text size="2" color="gray">Chưa có tài khoản vận hành nào.</Text>
          ) : (
            <ul className="admin-home__managers">
              {managers.slice(0, 6).map(item => (
                <li key={item.id}>
                  <span>
                    <strong>{item.fullName || item.email}</strong>
                    <small>{item.email}</small>
                  </span>
                  <Badge color={item.active === false ? "gray" : "green"} variant="soft">
                    {item.active === false ? "Tạm khóa" : "Hoạt động"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
