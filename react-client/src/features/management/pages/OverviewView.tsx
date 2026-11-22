import RefreshButton from "../../../shared/ui/RefreshButton";
import { useId, useState, type ComponentProps } from "react";
import { Button } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import LearningIcon from "../../../shared/ui/LearningIcon";
import type { PaymentAnalytics } from "../../billing/api/billingApi";
import s from "./OverviewView.module.css";

type Overview = { accounts: Record<string, number>; schools: number; activeSchools: number; validation: { total: number; failed: number; failureRate: number } };
type Icon = ComponentProps<typeof LearningIcon>["name"];
const number = (value: number) => value.toLocaleString("vi-VN");
const money = (value: number) => number(value) + " ₫";
const compact = (value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const ROLES = [ ["STUDENT", "Học sinh"], ["STAFF", "Giáo viên / Tổ trưởng"], ["SCHOOL", "Quản lý trường"], ["REVIEWER", "Kiểm duyệt vật lý"], ["MANAGER", "Vận hành"], ["ADMIN", "Quản trị hệ thống"] ] as const;
function Metric({ label, value, note, icon, tone, to, title }: { label: string; value: string; note: string; icon: Icon; tone: string; to: string; title?: string }) {
  return <Link data-kpi to={to} className={s.metric + " " + tone}><span className={s.metricTop}><span className={s.icon}><LearningIcon name={icon} /></span><LearningIcon name="chevronRight" /></span><span className={s.metricLabel}>{label}</span><strong title={title ?? value}>{value}</strong><small>{note}</small></Link>;
}
function PanelError({ message, retry }: { message: string; retry: () => void }) { return <div className={s.panelError} role="alert"><LearningIcon name="activity" /><p>{message}</p><Button variant="soft" onClick={retry}>Thử lại</Button></div>; }
function Placeholder({ label }: { label: string }) { return <div className={s.placeholder} role="status" aria-label={label}><span /><span /><span /><span /></div>; }
function RevenueChart({ points }: { points: PaymentAnalytics["trend"] }) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const max = Math.max(...points.map(p => p.revenueVnd), 1);
  if (!points.some(p => p.revenueVnd > 0)) return <div className={s.chartEmpty}><span className={s.emptyIcon}><LearningIcon name="chart" /></span><strong>Chưa có doanh thu trong kỳ</strong><p>Giao dịch đã thanh toán sẽ được tổng hợp tại đây.</p></div>;
  const left = 64, right = 14, top = 16, height = 210, width = 760, baseline = height - 32;
  const x = (i: number) => left + i * (width - left - right) / Math.max(points.length - 1, 1);
  const y = (value: number) => baseline - value / max * (baseline - top);
  const path = points.map((p,i) => (i ? "L" : "M") + x(i) + "," + y(p.revenueVnd)).join(" ");
  return <div className={s.chart}>
    <div className={s.readout} role="status">{active === null ? <span>Di chuột hoặc chọn điểm để xem doanh thu</span> : <><span>{points[active].label}</span><strong>{money(points[active].revenueVnd)}</strong><small>{number(points[active].transactions)} giao dịch thành công</small></>}</div>
    <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="Biểu đồ doanh thu đã thanh toán trong kỳ">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".2"/><stop offset="100%" stopColor="currentColor" stopOpacity=".01"/></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} x2={width - right} y1={y(max * i / 4)} y2={y(max * i / 4)} className={s.gridLine} /><text x={left - 10} y={y(max * i / 4) + 4} textAnchor="end">{compact(max * i / 4)}</text></g>)}
      <path d={path + " L" + x(points.length - 1) + "," + baseline + " L" + left + "," + baseline + " Z"} fill={"url(#" + id + ")"}/><path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      {points.map((point, i) => <g key={point.key}><circle cx={x(i)} cy={y(point.revenueVnd)} r={active === i ? 5 : 3} fill="var(--panel)" stroke="currentColor" strokeWidth="2" tabIndex={0} aria-label={point.label + ": " + money(point.revenueVnd)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />{(i % Math.ceil(points.length / 10) === 0 || i === points.length - 1) && <text x={x(i)} y={height - 8} textAnchor="middle">{point.label.replace("Tháng ", "T").replace("Thg ", "T").replace("Ngày ", "")}</text>}</g>)}
    </svg><span className={s.chartUnit}>Đơn vị: đồng · Chỉ tính giao dịch đã thanh toán</span></div>;
}
export function OverviewView() {
  const current = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date());
  const year = Number(current.find(p => p.type === "year")?.value), month = Number(current.find(p => p.type === "month")?.value);
  const [period, setPeriod] = useState<"YEAR" | "MONTH">("YEAR");
  const overview = useResource<Overview>("/admin/overview-counts");
  const payment = useResource<PaymentAnalytics>("/admin/payment-analytics?" + new URLSearchParams({ period, year: String(year), ...(period === "MONTH" ? { month: String(month) } : {}), timezone: "Asia/Ho_Chi_Minh" }));
  const support = useResource<{ count: number }>("/support/inbox/pending-count");
  const base = overview.error ? undefined : overview.data, finances = payment.error ? undefined : payment.data;
  const supportCount = support.error ? undefined : support.data?.count;
  const accounts = base?.accounts, total = accounts?.total ?? 0, suspended = accounts?.suspended ?? 0;
  const validation = base?.validation;
  const passed = validation ? Math.max(0, validation.total - validation.failed) : 0;
  const passRate = validation?.total ? passed * 100 / validation.total : null;
  const periodLabel = period === "YEAR" ? "Năm " + year : "Tháng " + month + "/" + year;
  const refreshing = overview.refreshing || payment.refreshing || support.refreshing;
  const refresh = () => { void overview.refresh(); void payment.refresh(); void support.refresh(); };
  const roleCounts: { key: string; label: string; value: number; color: string }[] = ROLES.map(([key, label], i) => ({ key, label, value: accounts?.[key] ?? 0, color: "var(--role-" + (i + 1) + ")" }));
  const other = Math.max(0, total - roleCounts.reduce((sum, role) => sum + role.value, 0));
  if (other) roleCounts.push({ key: "OTHER", label: "Vai trò khác", value: other, color: "var(--muted)" });
  const donut = roleCounts.map((role, index) => { const start = roleCounts.slice(0, index).reduce((sum, item) => sum + item.value, 0) * 100 / Math.max(total, 1); return role.color + " " + start + "% " + (start + role.value * 100 / Math.max(total, 1)) + "%"; }).join(",");
  const tasks: { label: string; detail: string; count: number | undefined; to: string; icon: Icon }[] = [
    { label: "Yêu cầu hỗ trợ", detail: "Đang chờ Manager xử lý", count: supportCount, to: "/manager/support", icon: "message" },
    { label: "Thanh toán cần đối soát", detail: periodLabel, count: finances?.kpis.reviewTransactions, to: "/manager/payments", icon: "shield" },
    { label: "Kiểm định không đạt", detail: "Toàn bộ lịch sử được ghi nhận", count: validation?.failed, to: "/manager/validation", icon: "activity" },
  ];
  return <main className={s.page} data-analytics="dashboard" data-dashboard-role="manager">

    <section className={s.metrics} data-kpis aria-label="Số liệu vận hành">      <Metric label={"Doanh thu · " + periodLabel.toLowerCase()} value={finances ? compact(finances.kpis.grossPaidVnd) + " ₫" : "—"} title={finances ? money(finances.kpis.grossPaidVnd) : undefined} note={finances ? number(finances.kpis.paidTransactions) + " giao dịch đã thanh toán" : payment.error ? "Chưa tải được doanh thu" : "Đang tải doanh thu…"} icon="chart" tone={s.purple} to="/manager/payments" />
{overview.loading ? <><Placeholder label="Đang tải số trường" /><Placeholder label="Đang tải số tài khoản" /></> : <><Metric label="Trường học" value={base ? number(base.schools) : "—"} note={base ? number(base.activeSchools) + " trường đang hoạt động" : "Chưa tải được số liệu"} icon="book" tone={s.blue} to="/manager/schools" /><Metric label="Tài khoản hoạt động" value={base ? number(Math.max(0, total - suspended)) : "—"} note={base ? number(total) + " tài khoản · " + number(suspended) + " tạm khóa" : "Chưa tải được số liệu"} icon="users" tone={s.green} to="/manager/users" /></>}
      <Metric label="Hỗ trợ cần xử lý" value={supportCount === undefined ? "—" : number(supportCount)} note={supportCount === undefined ? support.error ? "Chưa tải được yêu cầu" : "Đang tải yêu cầu…" : supportCount ? "Mở hộp thư để tiếp nhận và phản hồi" : "Không có yêu cầu đang chờ xử lý"} icon="message" tone={s.amber} to="/manager/support" />
    </section>
    <RefreshButton onClick={refresh} disabled={refreshing} />
    <div className={s.mainGrid} data-role-main>
      <section data-panel className={s.panel}><header className={s.panelHeading}><div><h2>Doanh thu đã thanh toán</h2><p>{periodLabel} · Chi tiết theo {period === "YEAR" ? "tháng" : "ngày"}</p></div><div className={s.segment} role="group" aria-label="Kỳ doanh thu">{(["YEAR", "MONTH"] as const).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "YEAR" ? "Năm nay" : "Tháng này"}</button>)}</div></header>
        {payment.error ? <PanelError message={payment.error} retry={() => void payment.refresh()} /> : !finances ? <Placeholder label="Đang tải biểu đồ doanh thu" /> : <><RevenueChart key={period} points={finances.trend} /><div className={s.paymentStates}>{([["Đã thanh toán", finances.kpis.paidTransactions, s.success], ["Chờ thanh toán", finances.kpis.pendingTransactions, s.warning], ["Thất bại", finances.kpis.failedTransactions, s.danger]] as const).map(([label, count, tone]) => <div key={label} className={tone}><span>{label}</span><strong>{number(count)}</strong></div>)}</div><Link className={s.textLink} to="/manager/payments">Xem giao dịch & doanh thu <LearningIcon name="arrow" /></Link></>}
      </section>
      <aside className={s.panel + " " + s.taskPanel}><header className={s.panelHeading}><div><span className={s.eyebrow}>ƯU TIÊN VẬN HÀNH</span><h2>Cần theo dõi</h2><p>Mở từng mục để xem và xử lý.</p></div></header><div className={s.tasks}>{tasks.map(task => <Link key={task.label} to={task.to}><span className={s.taskIcon}><LearningIcon name={task.icon} /></span><span><strong>{task.label}</strong><small>{task.detail}</small></span><span className={task.count ? s.taskCount : s.taskZero}>{task.count === undefined ? "—" : number(task.count)}</span><LearningIcon name="chevronRight" /></Link>)}</div>{support.error && <p role="alert" className={s.inlineError}>Chưa tải được số yêu cầu hỗ trợ. <button onClick={() => void support.refresh()}>Thử lại</button></p>}<div className={s.customerHint}><LearningIcon name="activity" /><h3>Hiểu khách hàng hơn</h3><p>Xem trường sử dụng nhiều, mức tiêu thụ AI và nhóm cần chăm sóc.</p><Button asChild variant="soft"><Link to="/manager/customer-usage">Sử dụng khách hàng <LearningIcon name="arrow" /></Link></Button></div></aside>
    </div>
    <div className={s.bottomGrid} data-role-secondary>
      <section data-panel className={s.panel}><header className={s.panelHeading}><div><h2>Phân bổ tài khoản</h2><p>Theo vai trò · Bao gồm tài khoản đang tạm khóa</p></div><Button asChild variant="ghost"><Link to="/manager/users">Xem tài khoản <LearningIcon name="arrow" /></Link></Button></header>
        {overview.error ? <PanelError message={overview.error} retry={() => void overview.refresh()} /> : !base ? <Placeholder label="Đang tải phân bổ tài khoản" /> : <div className={s.accountContent}><div className={s.donut} role="img" aria-label={roleCounts.map(role => role.label + ": " + role.value).join(", ")} style={{ background: donut ? "conic-gradient(" + donut + ")" : "var(--outline)" }}><div><strong>{number(total)}</strong><span>tài khoản</span></div></div><div className={s.roleList}>{roleCounts.map(role => <div key={role.key}><i style={{ background: role.color }} /><span>{role.label}</span><strong>{number(role.value)}</strong><small>{total ? (role.value * 100 / total).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "0"}%</small></div>)}</div></div>}
      </section>
      <section data-panel className={s.panel}><header className={s.panelHeading}><div><h2>Chất lượng kiểm định</h2><p>Toàn bộ lượt kiểm định đã được lưu</p></div><span className={s.statusChip + " " + (validation?.failed ? s.warning : s.success)}>{!validation?.total ? "Chưa đủ dữ liệu" : validation.failed ? "Có lượt cần kiểm tra" : "Tất cả lượt kiểm định đạt"}</span></header>
        {overview.error ? <PanelError message={overview.error} retry={() => void overview.refresh()} /> : !validation ? <Placeholder label="Đang tải kiểm định" /> : <><div className={s.validationValue}><strong>{passRate === null ? "—" : passRate.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"}</strong><span>{passRate === null ? "Chưa ghi nhận lượt kiểm định" : "Tỷ lệ lượt kiểm định đạt"}</span></div><div className={s.healthTrack} role="progressbar" aria-label="Tỷ lệ kiểm định đạt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={passRate ?? undefined}><span style={{ width: (passRate ?? 0) + "%" }} /></div><div className={s.healthStats}><div><span>Tổng lượt</span><strong>{number(validation.total)}</strong></div><div><span>Đạt</span><strong>{number(passed)}</strong></div><div><span>Không đạt</span><strong>{number(validation.failed)}</strong></div></div><p className={s.note}>Kết quả kiểm định phản ánh các phép kiểm tra đã chạy; không thay thế việc rà soát nội dung vật lý của Reviewer.</p><Link className={s.textLink} to="/manager/validation">Theo dõi lịch sử kiểm định <LearningIcon name="arrow" /></Link></>}
      </section>
    </div>
    <section className={s.shortcuts} aria-label="Truy cập nhanh">{([
      { label: "Trường học", note: "Thông tin trường và gói sử dụng", icon: "book", to: "/manager/schools" },
      { label: "Tài khoản", note: "Quản lý trạng thái người dùng", icon: "users", to: "/manager/users" },
      { label: "Gói dịch vụ", note: "Hạn mức học sinh và AI", icon: "sliders", to: "/manager/plans" },
      { label: "Yêu cầu hỗ trợ", note: "Tiếp nhận và phản hồi khách hàng", icon: "message", to: "/manager/support" },
    ] as const).map(item => <Link key={item.to} to={item.to}><span className={s.shortcutIcon}><LearningIcon name={item.icon} /></span><span><strong>{item.label}</strong><small>{item.note}</small></span><LearningIcon name="chevronRight" /></Link>)}</section>
    <p className={s.footnote}>Trường học, tài khoản và yêu cầu hỗ trợ phản ánh trạng thái hiện tại. Bộ chọn năm/tháng chỉ áp dụng cho doanh thu và giao dịch.</p>
  </main>;
}
