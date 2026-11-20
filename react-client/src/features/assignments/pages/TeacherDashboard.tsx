import { Link } from "react-router-dom";
import LearningHeader from "../../../shared/layout/LearningHeader";
import Icon from "../../../shared/ui/LearningIcon";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTeacherLibrary } from "../../library/hooks/useTeacherLibrary";
import type { Assignment, TeacherClassOption } from "../../../shared/types/physlive";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import "../../simulation/styles/learning.css";
import styles from "./TeacherDashboard.module.css";

const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn";
export default function TeacherDashboard() {
  const user = useSessionStore(state => state.user);
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
    <main className={styles.page}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>TỔNG QUAN GIẢNG DẠY</p><h1>Xin chào, {user?.fullName || "Thầy / Cô"}</h1><p>Theo dõi lớp học và tiếp tục công việc giảng dạy của bạn.</p></div><button className={styles.refresh} onClick={refresh} disabled={refreshing}><Icon name="reset" />{refreshing ? "Đang cập nhật…" : "Làm mới"}</button></header>
      <section className={styles.hero} aria-label="Thao tác nhanh"><div className={styles.heroIcon}><Icon name="atom" /></div><div><h2>Bắt đầu một khám phá mới</h2><p>Biến tình huống vật lý thành mô phỏng để học sinh quan sát và thực hành.</p></div><Link className={styles.primary} to="/workspace"><Icon name="plus" />Tạo mô phỏng</Link><Link className={styles.secondary} to="/assignments/workspace">Giao bài mới <Icon name="arrow" /></Link></section>
      <section className={styles.metrics} aria-label="Thống kê giảng dạy">{metrics.map(item => <Link key={item.label} className={styles.metric} to={item.to}><Icon name={item.icon} /><strong>{item.value}</strong><span>{item.label}</span></Link>)}</section>
      <div className={styles.columns}>
        <section className={styles.panel}><div className={styles.sectionHeading}><h2>Lớp đang phụ trách</h2><Link to="/lab/classes">Tất cả lớp <Icon name="arrow" /></Link></div>
          {classes.error ? <p role="alert" className={styles.error}>{classes.error}</p> : classes.loading ? <CardLoadingSkeleton cards={2} /> : rows.length ? <div className={styles.list}>{rows.slice(0,4).map(item => <Link className={styles.row} to={"/lab/classes/"+item.id} key={item.id}><span className={styles.tile}>{item.gradeLevel}</span><div><strong>{item.name}</strong><small>{item.subject || "Vật lý"} · {item.schoolYear}</small></div><span className={styles.meta}>{item.students.length} học sinh</span><Icon name="chevronRight" /></Link>)}</div> : <p className={styles.empty}>Bạn chưa được phân công lớp. Liên hệ nhà trường để được phân công.</p>}
        </section>
        <section className={styles.panel}><div className={styles.sectionHeading}><h2>Bài giao gần đây</h2><Link to="/lab">Xem và chấm bài <Icon name="arrow" /></Link></div>
          {work.error ? <p role="alert" className={styles.error}>{work.error}</p> : work.loading ? <CardLoadingSkeleton cards={2} /> : lessons.length ? <div className={styles.list}>{lessons.slice(0,4).map(item => <Link className={styles.row} to={"/lab?assignment="+encodeURIComponent(item.id)} key={item.id}><span className={styles.tile}><Icon name="book" /></span><div><strong title={item.title}>{item.title}</strong><small>{item.className || "Bài giao cá nhân"} · Hạn: {date(item.dueAt)}</small></div><Icon name="chevronRight" /></Link>)}</div> : <div className={styles.empty}>Chưa có bài đã giao. <Link to="/assignments/workspace">Giao bài đầu tiên</Link></div>}
        </section>
      </div>
      <section className={styles.panel}><div className={styles.sectionHeading}><h2>Mô phỏng gần đây</h2><Link to="/lab/library">Mở thư viện <Icon name="arrow" /></Link></div>
        {library.libraryError ? <p className={styles.error} role="alert">{library.libraryError}</p> : library.libraryLoading ? <CardLoadingSkeleton cards={3} /> : recent.length ? <div className={styles.simulations}>{recent.map(item => <Link key={item.id} className={styles.simulation} to={"/workspace?simulationId="+encodeURIComponent(item.simulationId)}><span className={styles.tile}><Icon name="atom" /></span><strong title={item.title}>{item.title}</strong><small>{library.topicName(item.topic)} · {date(item.createdAt)}</small><span className={styles.open}>Mở mô phỏng <Icon name="arrow" /></span></Link>)}</div> : <p className={styles.empty}>Những mô phỏng bạn lưu sẽ xuất hiện tại đây.</p>}
      </section>
    </main>
  </div>;
}
