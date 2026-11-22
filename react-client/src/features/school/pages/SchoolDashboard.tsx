import RefreshButton from "../../../shared/ui/RefreshButton";
import ReportChart from "../../../shared/ui/ReportChart";
import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import type { SchoolClassSummary } from "../types";
import { ClassTableLoading } from "../components/SchoolLoading";
import { Link } from "react-router-dom";
import { Badge, Button } from "@radix-ui/themes";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import type { LicenseStatus } from "../../account/api/userApi";
import type { SchoolReportSummary } from "../api/schoolApi";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { DashboardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import s from "./SchoolDashboard.module.css";

const number = (value: number) => value.toLocaleString("vi-VN");
const dateLabel = (value: string | null) => value ? new Date(value + "T00:00:00").toLocaleDateString("vi-VN") : "Chưa thiết lập";
const monthLabel = (value: string) => { const [year, month] = value.split("-"); return "Tháng " + Number(month) + "/" + year; };
const licenseLabels: Record<SchoolReportSummary["licenseStatus"], string> = {
  ACTIVE: "Đang hiệu lực", EXPIRED: "Đã hết hạn", UPCOMING: "Chưa đến hạn sử dụng", UNLICENSED: "Chưa mua gói", SUSPENDED: "Trường tạm khóa",
};
type IconName = ComponentProps<typeof LearningIcon>["name"];

function SummaryCard({ label, value, icon, tone, detail }: Readonly<{ label: string; value: number; icon: IconName; tone: "primary" | "success" | "secondary" | "neutral"; detail: string }>) {
  return <article data-kpi className={s.stat + " " + s[tone]}><h2><LearningIcon name={icon} />{label}</h2><strong>{number(value)}</strong><p>{detail}</p></article>;
}

function QuotaUsage({ label, used, quota, detail }: Readonly<{ label: string; used: number; quota: number | null; detail: string }>) {
  const percentage = quota == null ? 0 : quota > 0 ? Math.min(100, Math.round(used / quota * 100)) : used > 0 ? 100 : 0;
  return <div className={s.quota}>
    <div className={s.quotaHeading}><h3>{label}</h3>{quota != null && <span className={percentage >= 80 ? s.warningText : ""}>{percentage}%</span>}</div>
    <p className={s.quotaValue}><strong>{number(used)}</strong><span> / {quota == null ? "Không giới hạn" : number(quota)}</span></p>
    {quota != null && <progress className={percentage >= 80 ? s.warningProgress : ""} value={percentage} max={100} aria-label={label + ": đã dùng " + percentage + "% hạn mức"} />}
    <p className={s.supporting}>{detail}</p>
  </div>;
}

const shortcuts = [
  { to: "/school/users", icon: "users", title: "Tài khoản", detail: "Giáo viên và học sinh" },
  { to: "/school/import", icon: "upload", title: "Nhập dữ liệu", detail: "Người dùng, lớp và xếp lớp" },
  { to: "/school/appeals", icon: "message", title: "Yêu cầu mở khóa", detail: "Xem và phản hồi yêu cầu" },
  { to: "/school/reports", icon: "chart", title: "Báo cáo", detail: "Thống kê và xuất dữ liệu" },
] as const;

export default function SchoolDashboard() {
  const reducedMotion = useReducedMotion();
  const user = useSessionStore(state => state.user);
  const schoolId = user?.schoolId;
  const report = useResource<SchoolReportSummary>("/schools/" + schoolId + "/reports/summary", Boolean(schoolId));
  const roster = useResource<DataPage<SchoolClassSummary>>("/schools/" + schoolId + "/classes/page?page=0&size=5&status=ACTIVE", Boolean(schoolId));
  const entitlement = useResource<LicenseStatus>("/user/me/license", Boolean(schoolId));
  const summary = report.data;
  const classes = roster.data?.items ?? [];
  const license = entitlement.data;
  const refreshing = report.refreshing || roster.refreshing || entitlement.refreshing;
  const load = () => Promise.all([report.refresh(), roster.refresh(), entitlement.refresh()]);

  const dashboardActions = <RefreshButton disabled={refreshing} onClick={() => void load()} />;
  return <div className="admin-content"><div className={s.dashboard} data-testid="school-dashboard" data-analytics="dashboard" data-dashboard-role="school">

    {!summary && dashboardActions}
    {report.error && <div className={s.error} role="alert"><LearningIcon name="activity" /><span>{report.error}</span><Button variant="soft" color="red" onClick={() => void report.refresh()}>Thử lại</Button></div>}
    {report.loading && !summary ? <DashboardLoadingSkeleton cards={4} label="Đang tải dữ liệu trường…" /> : summary && <>
      <section data-kpis className={s.stats} aria-label="Chỉ số trường học">
        <SummaryCard label="Học sinh đang hoạt động" value={summary.students} icon="users" tone="primary" detail={number(summary.enrolledStudents) + " lượt xếp lớp"} />
        <SummaryCard label="Giáo viên" value={summary.teachers} icon="book" tone="secondary" detail="Tài khoản thuộc trường" />
        <SummaryCard label="Lớp đang hoạt động" value={summary.activeClasses} icon="activity" tone="success" detail="Các lớp đang được sử dụng" />
        <SummaryCard label="Token AI đã dùng" value={summary.usedTokens} icon="chart" tone="neutral" detail={monthLabel(summary.usageMonth)} />
      </section>
      {dashboardActions}
      <motion.div className={s.content} data-school-campus initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
        <div className={s.main} data-school-roster>
          <section data-panel className={s.panel + " " + s.classes} aria-labelledby="school-recent-classes-title">
            <div className={s.panelHeading}><div><h2 id="school-recent-classes-title">Lớp học gần đây</h2><p>Tối đa 5 lớp đang hoạt động của trường.</p></div><Button asChild variant="ghost"><Link to="/school/classes">Tất cả lớp học<LearningIcon name="arrow" /></Link></Button></div>
            {roster.loading ? <ClassTableLoading headers={["Lớp", "Giáo viên", "Học sinh", "Chi tiết"]} /> : roster.error ? <div className={s.error} role="alert"><span>Không thể tải danh sách lớp.</span><Button variant="soft" onClick={() => void roster.refresh()}>Thử lại</Button></div> : classes.length === 0 ? <div className={s.empty}><span className={s.emptyIcon}><LearningIcon name="book" /></span><h3>Chưa có lớp đang hoạt động</h3><p>Tạo lớp học để bắt đầu phân công giáo viên và xếp lớp học sinh.</p><Button asChild><Link to="/school/classes">Quản lý lớp học</Link></Button></div> :
              <div className={s.tableContainer}><table className={s.table}><caption className={s.srOnly}>Các lớp học gần đây</caption><colgroup><col className={s.classColumn} /><col className={s.teacherColumn} /><col className={s.studentsColumn} /><col className={s.actionColumn} /></colgroup><thead><tr><th scope="col">Lớp</th><th scope="col">Giáo viên</th><th scope="col">Học sinh</th><th scope="col"><span className={s.srOnly}>Chi tiết</span></th></tr></thead><tbody>{classes.slice(0, 5).map(item => {
                const teachers = item.teacherNames?.length ? item.teacherNames.join(", ") : item.teacherCount > 0 ? number(item.teacherCount) + " giáo viên" : "Chưa phân công";
                return <tr key={item.id}><th scope="row"><Link className={s.className} to={"/school/classes/" + item.id} title={item.name}>{item.name}</Link><span className={s.classMeta}>Khối {item.gradeLevel} · {item.schoolYear}</span></th><td><span className={s.teacherName} title={teachers}>{teachers}</span></td><td className={s.studentCount}>{number(item.studentCount)}</td><td><Button asChild variant="ghost" className={s.viewClass}><Link to={"/school/classes/" + item.id} aria-label={"Xem lớp " + item.name}><LearningIcon name="arrow" /></Link></Button></td></tr>;
              })}</tbody></table></div>}
            {!roster.loading && !roster.error && classes.length > 0 && <p className={s.tableFootnote}>Đang hiển thị {Math.min(5, classes.length)} / {number(roster.data?.totalElements ?? summary.activeClasses)} lớp đang hoạt động</p>}
          </section>
      {!roster.loading && !roster.error && <div className="analytics-chart-grid"><ReportChart title="Quy mô lớp học gần đây" description="Số học sinh của tối đa 5 lớp đang hoạt động gần đây." unit="học sinh" items={classes.map(item => ({ label: item.name, value: item.studentCount }))} /><ReportChart title="Tài khoản giảng dạy và học tập" description="Số tài khoản giáo viên và học sinh trong trường." variant="donut" unit="tài khoản" items={[{ label: "Học sinh", value: summary.students }, { label: "Giáo viên", value: summary.teachers }]} /></div>}
          <section data-panel className={s.panel} aria-labelledby="school-shortcuts-title"><div className={s.panelHeading}><div><h2 id="school-shortcuts-title">Truy cập nhanh</h2><p>Các công việc thường dùng trong trường.</p></div></div><div className={s.shortcuts}>{shortcuts.map(item => <Link key={item.to} to={item.to} className={s.shortcut}><span className={s.shortcutIcon}><LearningIcon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><LearningIcon name="chevronRight" /></Link>)}</div></section>
        </div>
        <aside className={s.aside} aria-label="Gói sử dụng và hạn mức">
          <section className={s.license} aria-labelledby="school-license-title">
            <div className={s.panelHeading}><span className={s.licenseIcon}><LearningIcon name="shield" /></span><Badge color={summary.licenseStatus === "ACTIVE" ? "green" : summary.licenseStatus === "SUSPENDED" ? "red" : "orange"}>{licenseLabels[summary.licenseStatus]}</Badge></div>
            <h2 id="school-license-title">Gói sử dụng</h2><p className={s.planName}>{summary.planCode || "Chưa mua gói"}</p>
            {entitlement.error && <p className={s.licenseNotice} role="status">Chưa tải được thời gian còn lại. Bạn có thể thử làm mới.</p>}
            <dl className={s.licenseDetails}><div><dt>Hạn sử dụng</dt><dd>{dateLabel(license?.licenseEnd ?? summary.licenseEnd)}</dd></div><div><dt>Thời gian còn lại</dt><dd>{entitlement.loading ? "Đang kiểm tra…" : entitlement.error ? "Chưa xác minh" : license && Number.isFinite(license.daysUntilExpiry) && summary.licenseStatus !== "UNLICENSED" ? license.daysUntilExpiry >= 0 ? number(license.daysUntilExpiry) + " ngày" : "Đã hết hạn" : "—"}</dd></div></dl>
            <Button asChild><Link to="/school/billing">Xem gói & thanh toán<LearningIcon name="arrow" /></Link></Button>
          </section>
          <section data-panel className={s.panel + " " + s.usage} aria-labelledby="school-quota-title"><div className={s.panelHeading}><div><h2 id="school-quota-title">Hạn mức sử dụng</h2><p>{monthLabel(summary.usageMonth)}</p></div><LearningIcon name="chart" /></div>
            <QuotaUsage label="Học sinh đang hoạt động" used={summary.students} quota={summary.studentQuota} detail={summary.studentQuota == null ? "Không giới hạn học sinh theo gói." : "Còn " + number(Math.max(0, summary.studentQuota - summary.students)) + " chỗ trong hạn mức."} />
            <QuotaUsage label="Token AI tháng này" used={summary.usedTokens} quota={summary.tokenQuota} detail={summary.tokenQuota == null ? "Gói không giới hạn token AI." : "Còn " + number(Math.max(0, summary.tokenQuota - summary.usedTokens)) + " token trong tháng."} />
            <Button asChild variant="ghost"><Link to="/school/reports">Xem báo cáo chi tiết<LearningIcon name="arrow" /></Link></Button>
          </section>
        </aside>
      </motion.div>
    </>}
  </div></div>;
}
