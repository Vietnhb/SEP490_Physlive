import RefreshButton from "../../../shared/ui/RefreshButton";
import ReportChart from "../../../shared/ui/ReportChart";
import { Link } from "react-router-dom";
import LearningHeader from "../../../shared/layout/LearningHeader";
import Icon from "../../../shared/ui/LearningIcon";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTeacherLibrary } from "../../library/hooks/useTeacherLibrary";
import type { Assignment, TeacherClassOption } from "../../../shared/types/physlive";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import "../../simulation/styles/learning.css";
import styles from "./TeacherDashboard.module.css";

const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn";
export default function TeacherDashboard() {
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const work = useResource<Assignment[]>("/assignments/mine/teacher");
  const library = useTeacherLibrary();
  const rows = classes.data ?? [];
  const lessons = [...(work.data ?? [])].sort((a,b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt));
  const recent = [...library.libraryItems].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0,4);
  const refreshing = classes.refreshing || work.refreshing;
  const refresh = () => { void classes.refresh(); void work.refresh(); library.retryLibrary(); };
  const metrics = [
    { label:"Lớp phụ trách", value: classes.loading || classes.error ? "—" : rows.length, icon:"users" as const, to:"/lab/classes" },
    { label:"Học sinh trong các lớp", value: classes.loading || classes.error ? "—" : new Set(rows.flatMap(item => item.students.map(student => student.id))).size, icon:"book" as const, to:"/lab/classes" },
    { label:"Bài đã giao", value: work.loading || work.error ? "—" : lessons.length, icon:"chart" as const, to:"/lab" },
    { label:"Mô phỏng đã lưu", value: library.libraryLoading || library.libraryError ? "—" : library.libraryItems.length, icon:"folder" as const, to:"/lab/library" },
  ];
  return <div className={"learning-app " + styles.shell}>
    <LearningHeader />
    <main className={styles.page} data-analytics="dashboard" data-dashboard-role="teacher">

      <section data-kpis className={styles.metrics} aria-label="Thống kê giảng dạy">{metrics.map(item => <Link data-kpi key={item.label} className={styles.metric} to={item.to}><Icon name={item.icon} /><strong>{item.value}</strong><span>{item.label}</span></Link>)}</section>
    <RefreshButton onClick={refresh} disabled={refreshing} />
      <section className={styles.hero} data-teacher-tools aria-label="Thao tác nhanh"><div className={styles.heroIcon}><Icon name="atom" /></div><div><h2>Bắt đầu một khám phá mới</h2><p>Biến tình huống vật lý thành mô phỏng để học sinh quan sát và thực hành.</p></div><Link className={styles.primary} to="/workspace"><Icon name="plus" />Tạo mô phỏng</Link><Link className={styles.secondary} to="/assignments/workspace">Giao bài mới <Icon name="arrow" /></Link><Link className={styles.secondary} to="/lab/reports">Báo cáo kết quả</Link></section>
      <div className={styles.columns} data-teacher-classroom>
        <div className="teacher-class-column"><section data-panel className={styles.panel}><div className={styles.sectionHeading}><h2>Lớp đang phụ trách</h2><Link to="/lab/classes">Tất cả lớp <Icon name="arrow" /></Link></div>
          {classes.error ? <p role="alert" className={styles.error}>{classes.error}</p> : classes.loading ? <CardLoadingSkeleton cards={2} /> : rows.length ? <div className="teacher-class-tiles">{rows.slice(0,4).map(item => <Link className="teacher-class-tile" to={"/lab/classes/"+item.id} key={item.id}><span className="teacher-class-grade">Khối {item.gradeLevel}</span><div><strong>{item.name}</strong><small>{item.subject || "Vật lý"} · {item.schoolYear}</small></div><span className={styles.meta}>{item.students.length} học sinh</span><Icon name="chevronRight" /></Link>)}</div> : <p className={styles.empty}>Bạn chưa được phân công lớp. Liên hệ nhà trường để được phân công.</p>}
        </section><ReportChart title="Học sinh theo lớp phụ trách" description="Tối đa 6 lớp đang được phân công; số học sinh được tính theo từng lớp." unit="học sinh" items={classes.error || classes.loading ? [] : rows.slice(0,6).map(item => ({ label: item.name, value: item.students.length }))} /></div>
        <div className="teacher-class-column"><section data-panel className={styles.panel}><div className={styles.sectionHeading}><h2>Bài giao gần đây</h2><Link to="/lab">Xem và chấm bài <Icon name="arrow" /></Link></div>
          {work.error ? <p role="alert" className={styles.error}>{work.error}</p> : work.loading ? <CardLoadingSkeleton cards={2} /> : lessons.length ? <div className={styles.list}>{lessons.slice(0,4).map(item => <Link className={styles.row} to={"/lab?assignment="+encodeURIComponent(item.id)} key={item.id}><span className={styles.tile}><Icon name="book" /></span><div><strong title={item.title}>{item.title}</strong><small>{item.className || "Bài giao cá nhân"} · Hạn: {date(item.dueAt)}</small></div><Icon name="chevronRight" /></Link>)}</div> : <div className={styles.empty}>Chưa có bài đã giao. <Link to="/assignments/workspace">Giao bài đầu tiên</Link></div>}
        </section><ReportChart title="Bài tập theo lớp" description="Tối đa 6 lớp đang phụ trách, tổng hợp từ danh sách bài đã giao." unit="bài tập" items={classes.error || work.error || classes.loading || work.loading ? [] : rows.slice(0,6).map(item => ({ label: item.name, value: lessons.filter(lesson => lesson.classId === item.id).length }))} /></div>
      </div>
      <section data-panel className={styles.panel}><div className={styles.sectionHeading}><h2>Mô phỏng gần đây</h2><Link to="/lab/library">Mở thư viện <Icon name="arrow" /></Link></div>
        {library.libraryError ? <p className={styles.error} role="alert">{library.libraryError}</p> : library.libraryLoading ? <CardLoadingSkeleton cards={3} /> : recent.length ? <div className={styles.simulations}>{recent.map(item => <Link key={item.id} className={styles.simulation} to={"/workspace?simulationId="+encodeURIComponent(item.simulationId)}><span className={styles.tile}><Icon name="atom" /></span><strong title={item.title}>{item.title}</strong><small>{library.topicName(item.topic)} · {date(item.createdAt)}</small><span className={styles.open}>Mở mô phỏng <Icon name="arrow" /></span></Link>)}</div> : <p className={styles.empty}>Những mô phỏng bạn lưu sẽ xuất hiện tại đây.</p>}
      </section>
    </main>
  </div>;
}
