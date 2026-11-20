import { useState, type ComponentProps, type ReactNode } from "react";
import { Avatar, Badge, Button, SegmentedControl } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import type { AdminAnalytics } from "../api/userApi";
import { useResource } from "../../../shared/hooks/operationsData";
import { ROLE_LABELS, type RoleType } from "../../../shared/auth/roles";
import type { User } from "../../../shared/auth/types";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { DashboardLoadingSkeleton, CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import s from "./AdminOverview.module.css";

const ROLE_ORDER: RoleType[] = ["ADMIN", "MANAGER", "REVIEWER", "SCHOOL", "STAFF", "STUDENT"];
const number = (value: number) => value.toLocaleString("vi-VN");
const money = (value: number) => number(value) + " ₫";
const compactMoney = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 }).format(value);
const isLocked = (user: User) => user.active === false || user.accountStatus === "SUSPENDED_READ_ONLY";

function Metric({ label, value, compact, detail, icon, tone }: Readonly<{ label: string; value: string; compact?: string; detail: string; icon: ComponentProps<typeof LearningIcon>["name"]; tone: "primary" | "secondary" | "success" | "neutral" }>) {
  return <article className={s.metric + " " + s[tone]}><h2><LearningIcon name={icon} />{label}</h2><strong title={value} className={compact ? s.hasCompact : undefined}><span className={s.fullValue} data-full-value>{value}</span>{compact && <span className={s.compactValue}>{compact}</span>}</strong><p>{detail}</p></article>;
}
function EmptyState({ icon, children }: Readonly<{ icon: ComponentProps<typeof LearningIcon>["name"]; children: ReactNode }>) {
  return <div className={s.empty}><span><LearningIcon name={icon} /></span><p>{children}</p></div>;
}
function SectionHeading({ id, title, description, children }: Readonly<{ id: string; title: string; description: string; children?: ReactNode }>) {
  return <div className={s.panelHeading}><div><h2 id={id}>{title}</h2><p>{description}</p></div>{children}</div>;
}

export default function AdminOverviewPage() {
  const name = useSessionStore(state => state.user?.fullName);
  const [timeframe, setTimeframe] = useState<"week" | "month">("week");
  const usersResource = useResource<User[]>("/admin/users");
  const analyticsResource = useResource<AdminAnalytics>("/admin/analytics");
  const users = usersResource.data ?? [];
  const usersKnown = usersResource.data !== undefined;
  const analytics = analyticsResource.data;
  const refreshing = usersResource.refreshing || analyticsResource.refreshing;
  const refresh = () => Promise.all([usersResource.refresh(), analyticsResource.refresh()]);
  const managers = users.filter(item => item.role === "MANAGER");
  const locked = users.filter(isLocked).length;
  const firstName = name?.trim().split(/\s+/).at(-1);
  const periodLabel = timeframe === "week" ? "tuần này" : "tháng này";
  const postStats = timeframe === "week" ? analytics?.postBreakdown?.weekly : analytics?.postBreakdown?.monthly;
  const posts = postStats?.periodTotalPosts ?? (timeframe === "week" ? analytics?.postsThisWeek : analytics?.postsThisMonth);
  const operations = timeframe === "week" ? analytics?.operationsThisWeek : analytics?.operationsThisMonth;
  const revenue = timeframe === "week" ? analytics?.revenue.weeklyVnd : analytics?.revenue.monthlyVnd;
  const timeline = analytics?.revenue.timeline ?? [];
  const maxAmount = Math.max(1, ...timeline.map(point => point.amountVnd));
  const hasRevenue = timeline.some(point => point.amountVnd > 0);
  const recent = (analytics?.revenue.recentTransactions ?? []).slice(0, 4);
  const plans = analytics?.revenue.byPlan ?? [];
  const cumulative = analytics?.postBreakdown?.cumulative;
  const postLegend = [
    { key: "public", label: "Công khai", value: cumulative?.publicPosts ?? 0, color: "green" },
    { key: "private", label: "Cá nhân", value: cumulative?.privatePosts ?? 0, color: "indigo" },
    { key: "hidden", label: "Đã ẩn", value: cumulative?.deletedOrHiddenPosts ?? 0, color: "red" },
  ] as const;
  const transactions = [
    { label: "Đã thanh toán", value: analytics?.revenue.paidCount, icon: "check", tone: "success" },
    { label: "Chờ thanh toán", value: analytics?.revenue.pendingCount, icon: "activity", tone: "warning" },
    { label: "Thất bại", value: analytics?.revenue.failedCount, icon: "close", tone: "danger" },
  ] as const;
  const firstLoading = !usersKnown && !analytics && (usersResource.loading || analyticsResource.loading);

  return <div className="directory-content"><div className={s.dashboard} data-testid="admin-dashboard">
    <header className={s.welcome}><div><span className={s.eyebrow}><LearningIcon name="shield" />Quản trị nền tảng</span><h1>{firstName ? "Chào " + firstName : "Tổng quan hệ thống"}</h1><p>Theo dõi hoạt động PhysLive và quản lý tài khoản vận hành.</p></div><div className={s.headerActions}><Button variant="soft" disabled={refreshing} onClick={() => void refresh()}><LearningIcon name="refresh" />{refreshing ? "Đang cập nhật…" : "Làm mới"}</Button><Button asChild><Link to="/admin/users">Quản lý tài khoản<LearningIcon name="arrow" /></Link></Button></div></header>
    {usersResource.error && <div className={s.error} role="alert"><span>Chưa cập nhật được tài khoản. {usersResource.error}</span><Button variant="soft" onClick={() => void usersResource.refresh()}>Thử lại tài khoản</Button></div>}
    {analyticsResource.error && <div className={s.error} role="alert"><span>Chưa cập nhật được thống kê. {analyticsResource.error}</span><Button variant="soft" onClick={() => void analyticsResource.refresh()}>Thử lại thống kê</Button></div>}
    {firstLoading ? <DashboardLoadingSkeleton cards={4} label="Đang tải tổng quan hệ thống…" /> : <>
      <section className={s.metricsSection} aria-label="Chỉ số hoạt động và doanh thu"><div className={s.periodBar}><span>Chỉ số trong kỳ</span><SegmentedControl.Root size="2" value={timeframe} onValueChange={value => setTimeframe(value as "week" | "month")} aria-label="Khoảng thời gian"><SegmentedControl.Item value="week">Tuần này</SegmentedControl.Item><SegmentedControl.Item value="month">Tháng này</SegmentedControl.Item></SegmentedControl.Root></div><div className={s.metrics}>
        <Metric label={"Doanh thu " + periodLabel} value={revenue == null ? "—" : money(revenue)} compact={revenue == null ? undefined : compactMoney(revenue)} detail={analytics ? "Tổng tích lũy " + money(analytics.revenue.totalVnd) : "Đang chờ số liệu doanh thu"} icon="chart" tone="primary" />
        <Metric label={"Mô phỏng mới " + periodLabel} value={posts == null ? "—" : number(posts)} detail={analytics?.postBreakdown ? "Tổng tích lũy " + number(analytics.postBreakdown.totalCumulativePosts) : "Số mô phỏng được tạo trong kỳ"} icon="atom" tone="secondary" />
        <Metric label={"Thao tác " + periodLabel} value={operations == null ? "—" : number(operations)} detail="Chạy mô phỏng, nộp bài và chấm điểm" icon="activity" tone="neutral" />
        <Metric label="Tài khoản hoạt động" value={usersKnown ? number(users.length - locked) : "—"} detail={usersKnown ? number(users.length) + " tài khoản · " + number(locked) + " tạm khóa" : "Đang chờ số liệu tài khoản"} icon="users" tone="success" />
      </div></section>
      <div className={s.grid}>
        <section className={s.panel} aria-labelledby="admin-revenue-title"><SectionHeading id="admin-revenue-title" title="Doanh thu 4 tuần gần nhất" description="Chỉ tính các giao dịch đã thanh toán."><span className={s.sectionIcon}><LearningIcon name="chart" /></span></SectionHeading>
          {analyticsResource.loading ? <CardLoadingSkeleton cards={1} label="Đang tải doanh thu…" /> : hasRevenue ? <figure className={s.chart} role="img" aria-label={timeline.map(point => point.period + ": " + money(point.amountVnd)).join("; ")}><div className={s.chartColumns} aria-hidden="true">{timeline.map(point => <div key={point.period} className={s.chartColumn}><span className={s.chartValue} title={money(point.amountVnd)}>{number(point.amountVnd / 1000000)} tr</span><div className={s.barTrack}><span className={s.chartBar} data-empty={point.amountVnd === 0 || undefined} title={money(point.amountVnd)} style={{ height: Math.max(4, point.amountVnd / maxAmount * 144) + "px" }} /></div><span className={s.chartLabel}>{point.period}</span></div>)}</div></figure> : <EmptyState icon="chart">{analytics ? "Chưa có giao dịch đã thanh toán trong 4 tuần qua." : "Chưa tải được số liệu doanh thu."}</EmptyState>}
          <div className={s.subheading}><h3>Doanh thu theo gói</h3><span>Tổng tích lũy</span></div><div className={s.plans}>{plans.length === 0 ? <p className={s.muted}>{analytics ? "Chưa có giao dịch đã thanh toán." : "Chưa có số liệu theo gói."}</p> : plans.map(plan => { const percentage = analytics?.revenue.totalVnd ? Math.min(100, Math.round(plan.amountVnd / analytics.revenue.totalVnd * 100)) : 0; return <div key={plan.planCode} className={s.plan}><div><span title={plan.name}>{plan.name}</span><strong>{money(plan.amountVnd)}</strong></div><progress value={percentage} max={100} aria-label={"Doanh thu gói " + plan.name + ": " + percentage + "%"} /><small>{number(plan.count)} giao dịch · {percentage}% tổng doanh thu</small></div>; })}</div>
        </section>
        <section className={s.panel} aria-labelledby="admin-transactions-title"><SectionHeading id="admin-transactions-title" title="Giao dịch" description="Tổng tích lũy theo trạng thái thanh toán." /><div className={s.transactionStats}>{transactions.map(item => <div className={s[item.tone]} key={item.label}><LearningIcon name={item.icon} /><strong>{item.value == null ? "—" : number(item.value)}</strong><span>{item.label}</span></div>)}</div><div className={s.subheading}><h3>Giao dịch gần nhất</h3><span>Tối đa 4 giao dịch</span></div>
          {analyticsResource.loading ? <CardLoadingSkeleton cards={1} label="Đang tải giao dịch…" /> : recent.length === 0 ? <EmptyState icon="file">{analytics ? "Chưa có giao dịch nào." : "Chưa tải được giao dịch."}</EmptyState> : <ul className={s.transactions}>{recent.map(tx => <li key={tx.id}><span className={s.transactionIcon}><LearningIcon name="file" /></span><div className={s.transactionCopy}><strong title={tx.schoolName}>{tx.schoolName}</strong><small>{tx.planName} · {new Date(tx.createdAt).toLocaleDateString("vi-VN")}</small></div><div className={s.transactionValue}><strong>{money(tx.amountVnd)}</strong><Badge color={tx.status === "PAID" ? "green" : tx.status === "FAILED" ? "red" : "amber"}>{tx.status === "PAID" ? "Đã thanh toán" : tx.status === "FAILED" ? "Thất bại" : "Chờ thanh toán"}</Badge></div></li>)}</ul>}
        </section>
        <section className={s.panel} aria-labelledby="admin-roles-title"><SectionHeading id="admin-roles-title" title="Tài khoản theo vai trò" description={usersKnown ? "Phân bổ trên toàn bộ " + number(users.length) + " tài khoản." : "Chưa tải được số liệu tài khoản."} />
          {usersResource.loading ? <CardLoadingSkeleton cards={1} label="Đang tải tài khoản…" /> : usersKnown ? <ul className={s.roles}>{ROLE_ORDER.map(role => { const count = users.filter(user => user.role === role).length; return <li key={role}><span>{ROLE_LABELS[role]}</span><progress value={count} max={Math.max(1, users.length)} aria-label={ROLE_LABELS[role] + ": " + number(count) + " tài khoản"} /><strong>{number(count)}</strong></li>; })}</ul> : <EmptyState icon="users">Chưa tải được phân bổ tài khoản.</EmptyState>}
          {cumulative && <div className={s.simulations}><h3>Mô phỏng trên nền tảng</h3><div>{postLegend.map(item => <Badge key={item.key} color={item.color}>{item.label} · {number(item.value)}</Badge>)}</div></div>}
        </section>
        <section className={s.panel} aria-labelledby="admin-managers-title"><SectionHeading id="admin-managers-title" title="Tài khoản vận hành" description={usersKnown ? number(managers.length) + " tài khoản Manager trong hệ thống." : "Danh sách tài khoản Manager."}><Button asChild variant="ghost"><Link to="/admin/users">Quản lý<LearningIcon name="arrow" /></Link></Button></SectionHeading>
          {usersResource.loading ? <CardLoadingSkeleton cards={1} label="Đang tải tài khoản vận hành…" /> : !usersKnown || managers.length === 0 ? <EmptyState icon="shield">{usersKnown ? "Chưa có tài khoản vận hành nào." : "Chưa tải được tài khoản vận hành."}</EmptyState> : <ul className={s.managers}>{managers.slice(0, 6).map(user => <li key={user.id}><Avatar size="2" radius="full" src={user.avatarUrl || undefined} fallback={(user.fullName || user.email).slice(0, 1).toLocaleUpperCase("vi")} /><span className={s.managerCopy}><strong title={user.fullName || user.email}>{user.fullName || user.email}</strong><small title={user.email}>{user.email}</small></span><Badge color={isLocked(user) ? "red" : user.accountStatus === "WARNED" ? "amber" : "green"}>{isLocked(user) ? "Tạm khóa" : user.accountStatus === "WARNED" ? "Cảnh báo" : "Hoạt động"}</Badge></li>)}</ul>}
          {managers.length > 6 && <p className={s.footnote}>Hiển thị 6 / {number(managers.length)} tài khoản vận hành</p>}
        </section>
      </div>
    </>}
  </div></div>;
}
