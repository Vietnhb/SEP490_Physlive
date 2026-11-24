import { useState } from "react";
import { Link } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import LearningIcon from "../../../shared/ui/LearningIcon";
import type { Assignment, LibraryItem, TeacherClassOption } from "../../../shared/types/physlive";
import type { SimulationComplaint } from "../../support/api/supportApi";
import styles from "./TeacherDashboardPage.module.css";

type Progress = { assignmentId: string; recipients: number; submitted: number; awaitingGrade: number };
type IconName = Parameters<typeof LearningIcon>[0]["name"];

const DAY = 86_400_000;
const HOUR = 3_600_000;
const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });
const deadlineFormat = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

function deadlineLabel(timeLeft: number) {
  if (timeLeft <= 0) return "Đã quá hạn";
  if (timeLeft < HOUR) return "Còn dưới 1 giờ";
  if (timeLeft < DAY) return `Còn ${Math.floor(timeLeft / HOUR)} giờ`;
  return `Còn ${Math.floor(timeLeft / DAY)} ngày`;
}

function assignmentLink(item: Assignment) {
  const assignment = encodeURIComponent(item.id);
  return item.classId
    ? `/workspace/classes/${encodeURIComponent(item.classId)}?tab=assignments&assignment=${assignment}`
    : `/workspace/assignments?assignment=${assignment}`;
}

function SubmissionProgress({ progress }: { progress?: Progress }) {
  if (!progress) return <small className={styles.muted}>Chưa có số liệu nộp bài</small>;

  const label = `${progress.submitted}/${progress.recipients} đã nộp`;
  return <span className={styles.submissionProgress}>
    <small>{label}</small>
    <progress max={progress.recipients || 1} value={progress.submitted} aria-label={label} />
  </span>;
}

export default function TeacherDashboardPage() {
  const user = useSessionStore(state => state.user);
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const assignments = useResource<Assignment[]>("/assignments/mine/teacher");
  const progress = useResource<Progress[]>("/assignments/mine/teacher/progress");
  const library = useResource<LibraryItem[]>("/library/mine");
  const support = useResource<SimulationComplaint[]>("/support/mine");
  const [now] = useState(() => new Date());

  const byAssignment = new Map((progress.data ?? []).map(item => [item.assignmentId, item]));
  const roster = classes.data ?? [];
  const all = [...(assignments.data ?? [])].sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt));
  const open = all.filter(item => item.status === "ACTIVE");
  const toGrade = all.map(item => ({ item, waiting: byAssignment.get(item.id)?.awaitingGrade ?? 0 }))
    .filter(row => row.waiting > 0)
    .sort((a, b) => b.waiting - a.waiting);
  const awaitingTotal = toGrade.reduce((sum, row) => sum + row.waiting, 0);
  const deadlines = open.flatMap(item => {
    const time = Date.parse(item.dueAt ?? "");
    return time > now.getTime() - DAY && time <= now.getTime() + 7 * DAY ? [{ item, time }] : [];
  }).sort((a, b) => a.time - b.time);
  const overdueCount = deadlines.filter(row => row.time <= now.getTime()).length;
  const upcomingCount = deadlines.length - overdueCount;
  const studentCount = new Set(roster.flatMap(item => item.students.map(student => student.id))).size;
  const answered = (support.data ?? []).filter(item => item.kind === "COMPLAINT" && item.status === "READ" && item.adminResponse?.trim()).length;
  const firstName = user?.fullName?.trim().split(/\s+/).at(-1);

  const loadError = [classes.error, assignments.error, progress.error, library.error].find(Boolean);
  const gradingLoading = assignments.loading || progress.loading;
  const gradingAvailable = Boolean(assignments.data && progress.data);
  const refreshing = classes.refreshing || assignments.refreshing || progress.refreshing || library.refreshing;
  const summaryItems = [
    awaitingTotal > 0 && `${awaitingTotal} bài nộp cần chấm`,
    overdueCount > 0 && `${overdueCount} bài vừa quá hạn`,
    upcomingCount > 0 && `${upcomingCount} bài sắp đến hạn`,
  ].filter(Boolean);
  const summary = summaryItems.join(" · ") || (gradingLoading ? "Đang tải công việc của bạn…"
    : gradingAvailable ? "Bạn đã xử lý xong các bài cần chấm. Không có hạn nộp trong 7 ngày tới."
    : "");

  const stats: { label: string; value?: number; hint?: string; icon: IconName; to: string; tone: string }[] = [
    { label: "Lớp phụ trách", value: classes.data?.length, hint: classes.data && `${studentCount} học sinh`, icon: "users", to: "/workspace/classes", tone: styles.blue },
    { label: "Bài đang mở", value: assignments.data && open.length, hint: assignments.data && `Trong ${all.length} bài đã giao`, icon: "book", to: "/workspace/assignments", tone: styles.green },
    { label: "Bài nộp cần chấm", value: gradingAvailable ? awaitingTotal : undefined, hint: gradingAvailable ? `${toGrade.length} bài tập có bài nộp chờ chấm` : undefined, icon: "check", to: toGrade[0] ? assignmentLink(toGrade[0].item) : "/workspace/assignments", tone: styles.amber },
    { label: "Mô phỏng đã lưu", value: library.data?.length, icon: "folder", to: "/workspace/library", tone: styles.violet },
  ];

  return <main className={`lab-main ${styles.page}`} data-page-title="Tổng quan giáo viên">
    <section className={styles.hero}>
      <div className={styles.orbit} aria-hidden="true"><LearningIcon name="atom" /></div>
      <div className={styles.heroText}>
        <p className={styles.date}>{now.toLocaleDateString("vi-VN", { dateStyle: "full" })}</p>
        <h1>{greeting(now)}{firstName ? `, ${firstName}` : ""}</h1>
        {summary && <p className={styles.summary}>{summary}</p>}
        <div className={styles.heroActions}>
          <Link className={styles.primary} to="/workspace/assignments/new"><LearningIcon name="plus" />Giao bài mới</Link>
          <Link className={styles.secondary} to="/workspace/simulation"><LearningIcon name="atom" />Tạo mô phỏng</Link>
        </div>
      </div>
    </section>

    {loadError && <div className={styles.error} role="alert">
      <span>{loadError}</span>
      <button type="button" disabled={refreshing} onClick={() => {
        if (classes.error) void classes.refresh();
        if (assignments.error) void assignments.refresh();
        if (progress.error) void progress.refresh();
        if (library.error) void library.refresh();
      }}>Thử lại</button>
    </div>}

    <section className={styles.stats} aria-label="Số liệu tổng quan">
      {stats.map(stat => <Link key={stat.label} to={stat.to} className={`${styles.stat} ${stat.tone}`}>
        <span className={styles.statTop}><span className={styles.iconTile}><LearningIcon name={stat.icon} /></span><LearningIcon name="arrow" /></span>
        <span className={styles.statLabel}>{stat.label}</span>
        <strong>{stat.value ?? "—"}</strong>
        {stat.hint && <small>{stat.hint}</small>}
      </Link>)}
    </section>

    <div className={styles.columns}>
      <div className={styles.work}>
        <section className={styles.card} aria-labelledby="dash-grade">
          <header className={styles.cardHead}>
            <h2 id="dash-grade" className={styles.amber}><span className={styles.iconTile}><LearningIcon name="check" /></span>Cần chấm</h2>
            {gradingAvailable && awaitingTotal > 0 && <span className={`${styles.badge} ${styles.amber}`}>{awaitingTotal} bài nộp</span>}
          </header>
          {gradingLoading ? <p className={styles.panelMessage}>Đang tải bài cần chấm…</p>
            : !gradingAvailable ? <p className={styles.panelMessage}>Chưa tải được số liệu chấm bài.</p>
              : toGrade.length === 0 ? <p className={styles.panelMessage}>Đã chấm hết các bài nộp.</p>
                : <ul className={styles.list}>{toGrade.slice(0, 5).map(({ item, waiting }) => <li key={item.id}>
                  <Link to={assignmentLink(item)}>
                    <span className={styles.rowText}><strong>{item.title}</strong><small>{item.className ?? "Nhóm học sinh riêng"}</small></span>
                    <span className={`${styles.badge} ${styles.amber}`}>{waiting} chờ chấm</span>
                  </Link>
                </li>)}</ul>}
          {toGrade.length > 5 && <Link className={styles.panelLink} to="/workspace/assignments">Xem toàn bộ bài đã giao <LearningIcon name="arrow" /></Link>}
        </section>

        <section className={styles.card} aria-labelledby="dash-due">
          <header className={styles.cardHead}><h2 id="dash-due" className={styles.violet}><span className={styles.iconTile}><LearningIcon name="bell" /></span>Hạn nộp</h2></header>
          {assignments.loading ? <p className={styles.panelMessage}>Đang tải hạn nộp…</p>
            : !assignments.data ? <p className={styles.panelMessage}>Chưa tải được hạn nộp.</p>
              : deadlines.length === 0 ? <p className={styles.panelMessage}>Không có bài vừa quá hạn hoặc đến hạn trong 7 ngày tới.</p>
                : <ul className={styles.list}>{deadlines.slice(0, 5).map(({ item, time }) => {
                  const row = byAssignment.get(item.id);
                  const overdue = time <= now.getTime();
                  return <li key={item.id}><Link to={assignmentLink(item)}>
                    <span className={styles.rowText}>
                      <strong>{item.title}</strong>
                      <small><time dateTime={new Date(time).toISOString()}>{deadlineFormat.format(time)}</time>{row && ` · ${row.submitted}/${row.recipients} đã nộp`}</small>
                    </span>
                    <span className={`${styles.badge} ${overdue ? styles.red : styles.violet}`}>{deadlineLabel(time - now.getTime())}</span>
                  </Link></li>;
                })}</ul>}
          {deadlines.length > 5 && <Link className={styles.panelLink} to="/workspace/assignments">Xem toàn bộ bài đã giao <LearningIcon name="arrow" /></Link>}
        </section>

        {answered > 0 && <Link to="/workspace/complaints" className={styles.notice}>
          <LearningIcon name="message" /><span><b>{answered} khiếu nại</b> đã có phản hồi</span><LearningIcon name="arrow" />
        </Link>}
      </div>

      <div className={styles.learning}>
        <section className={styles.card} aria-labelledby="dash-classes">
          <header className={styles.cardHead}>
            <h2 id="dash-classes" className={styles.blue}><span className={styles.iconTile}><LearningIcon name="users" /></span>Lớp phụ trách</h2>
            <Link to="/workspace/classes" aria-label="Xem tất cả lớp phụ trách">Xem tất cả <LearningIcon name="arrow" /></Link>
          </header>
          {classes.loading ? <p className={styles.panelMessage}>Đang tải lớp phụ trách…</p>
            : !classes.data ? <p className={styles.panelMessage}>Chưa tải được lớp phụ trách.</p>
              : roster.length === 0 ? <p className={styles.panelMessage}>Bạn chưa được nhà trường phân công lớp.</p>
                : <div className={styles.classGrid}>{roster.map(classroom => {
                  const own = all.filter(item => item.classId === classroom.id);
                  const latest = own[0];
                  return <Link key={classroom.id} to={`/workspace/classes/${encodeURIComponent(classroom.id)}`} className={styles.classCard}>
                    <span className={styles.classTop}>
                      <span className={styles.classBadge} aria-hidden="true">{classroom.gradeLevel}</span>
                      <span className={styles.rowText}><strong>{classroom.name}</strong><small>Khối {classroom.gradeLevel} · {classroom.schoolYear}</small></span>
                      <LearningIcon name="chevronRight" />
                    </span>
                    <span className={styles.classFacts}>
                      <span><b>{classroom.students.length}</b> học sinh</span>
                      {assignments.data && <span><b>{own.filter(item => item.status === "ACTIVE").length}</b> bài đang mở</span>}
                    </span>
                    {latest ? <span className={styles.classLatest}>
                      <span className={styles.rowText}><small>Bài giao gần nhất</small><strong>{latest.title}</strong></span>
                      <SubmissionProgress progress={byAssignment.get(latest.id)} />
                    </span> : assignments.data && <span className={styles.muted}>Chưa giao bài cho lớp này.</span>}
                  </Link>;
                })}</div>}
        </section>

        <section className={styles.card} aria-labelledby="dash-recent">
          <header className={styles.cardHead}>
            <h2 id="dash-recent" className={styles.green}><span className={styles.iconTile}><LearningIcon name="book" /></span>Bài giao gần đây</h2>
            <Link to="/workspace/assignments" aria-label="Xem tất cả bài tập đã giao">Xem tất cả <LearningIcon name="arrow" /></Link>
          </header>
          {assignments.loading ? <p className={styles.panelMessage}>Đang tải bài tập…</p>
            : !assignments.data ? <p className={styles.panelMessage}>Chưa tải được bài tập.</p>
              : all.length === 0 ? <div className={styles.panelMessage}>Bạn chưa giao bài nào. <Link to="/workspace/assignments/new">Giao bài đầu tiên</Link></div>
                : <ul className={styles.recent}>{all.slice(0, 5).map(item => {
                  const active = item.status === "ACTIVE";
                  const overdue = active && Date.parse(item.dueAt ?? "") <= now.getTime();
                  const assignedAt = Date.parse(item.assignedAt);
                  return <li key={item.id}><Link to={assignmentLink(item)} className={styles.recentRow}>
                    <span className={styles.rowText}>
                      <strong>{item.title}</strong>
                      <small>{item.className ?? "Nhóm học sinh riêng"}{Number.isFinite(assignedAt) && ` · ${dateFormat.format(assignedAt)}`}</small>
                    </span>
                    <span className={`${styles.badge} ${overdue ? styles.red : active ? styles.green : ""}`}>{overdue ? "Quá hạn" : active ? "Đang mở" : "Đã đóng"}</span>
                    <SubmissionProgress progress={byAssignment.get(item.id)} />
                  </Link></li>;
                })}</ul>}
        </section>
      </div>
    </div>
  </main>;
}
