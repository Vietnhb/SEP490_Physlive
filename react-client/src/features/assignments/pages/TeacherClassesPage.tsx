import StudentProfileDialog from "../components/StudentProfileDialog";
import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import { queryClient } from "../../../shared/api/queryClient";
import PageActions from "../../../shared/layout/PageActions";
import type { Assignment, AssignmentSubmission, StudentOption, TeacherClassOption } from "../../../shared/types/physlive";
import { TeacherSubmissionTable } from "../components/TeacherSubmissionTable";
import StudioTableSkeleton from "../components/StudioTableSkeleton";
import { downloadAssignmentGrades, gradeAssignmentSubmission, reopenAssignmentSubmission } from "../api/assignmentApi";
import { classReportUrl, type ClassReport } from "../api/classReportApi";
import type { SubmissionFilter } from "../model/teacherSubmissionTypes";
import TeacherGradebook from "../components/TeacherGradebook";
import { ClassReportPanel } from "./TeacherClassReport";
import { apiMessage } from "../../../shared/lib/apiError";

type Progress = { assignmentId: string; recipients: number; submitted: number; awaitingGrade: number; confirmed: number };
const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const due = (value?: string) => value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Không giới hạn";
const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : 0);
const ALL_TIME = { query: "", status: "ALL", from: "", to: "" };
const PAGE = 9;

/** Teacher classes — the canvas artboards "Lớp phụ trách" and "Chi tiết lớp", markup for markup. */
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();

export default function TeacherClassesPage() {
  const { classId } = useParams();
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const work = useResource<Assignment[]>("/assignments/mine/teacher");
  const progress = useResource<Progress[]>("/assignments/mine/teacher/progress");
  const refresh = () => { void classes.refresh(); void work.refresh(); void progress.refresh(); };
  const byId = useMemo(() => new Map((progress.data ?? []).map(item => [item.assignmentId, item])), [progress.data]);
  const classroom = classes.data?.find(item => item.id === classId);
  if (classId) {
    if (classes.loading) return <main className="page"><section className="card"><StudioTableSkeleton headers={["Học sinh", "Email"]} label="Đang tải lớp…" /></section></main>;
    if (!classroom) return <main className="page"><section className="card"><div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <h1 className="h1" style={{ fontSize: 22 }}>Không truy cập được lớp</h1><p className="muted" style={{ margin: 0 }}>Lớp không thuộc danh sách bạn đang phụ trách hoặc đã ngừng hoạt động.</p>
      <Link className="btn" to="/lab/classes">{icon("back")}Về danh sách lớp</Link></div></section></main>;
    return <ClassWorkspace key={classId} classroom={classroom} assignments={(work.data ?? []).filter(item => item.classId === classId)} progress={byId}
      assignmentsLoading={work.loading || progress.loading} assignmentsError={work.error} onRefresh={refresh} />;
  }
  return <ClassList classes={classes.data ?? []} loading={classes.loading} error={classes.error || work.error || ""} work={work.data ?? []} workLoading={work.loading || progress.loading} progress={byId} onRefresh={refresh} />;
}

/** One class's official average, read from its report (the same figure the report page shows). */
function ClassAverage({ classroom, max }: Readonly<{ classroom: TeacherClassOption; max: number }>) {
  const report = useResource<ClassReport>(classReportUrl(classroom.id, ALL_TIME, 0, 1));
  const value = report.data?.summary.average10;
  return <div className="hrow"><span><span>{classroom.name}</span><b>{value == null ? "—" : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</b></span>
    <span className="bar"><i style={{ width: value == null ? "0%" : Math.round(value / max * 100) + "%" }}></i></span></div>;
}

function ClassList({ classes, loading, error, work, workLoading, progress, onRefresh }: Readonly<{ classes: TeacherClassOption[]; loading: boolean; error: string; work: Assignment[]; workLoading: boolean; progress: Map<string, Progress>; onRefresh: () => void }>) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [page, setPage] = useState(1);
  const grades = [...new Set(classes.map(item => item.gradeLevel))].sort((a, b) => a - b);
  const filtered = classes.filter(item => (grade === "ALL" || String(item.gradeLevel) === grade)
    && (item.name + " " + item.gradeLevel + " " + item.schoolYear).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const students = classes.reduce((sum, item) => sum + item.students.length, 0);
  const open = work.filter(item => item.status === "ACTIVE");
  const openDone = open.reduce((acc, item) => { const p = progress.get(item.id); return p ? { s: acc.s + p.submitted, r: acc.r + p.recipients } : acc; }, { s: 0, r: 0 });
  const dash = (busy: boolean, value: string | number) => busy ? "—" : value;
  // the most recent open assignment of each class: how far it has got
  const latest = classes.map(item => ({ item, lesson: open.filter(lesson => lesson.classId === item.id).sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt))[0] }))
    .filter(entry => entry.lesson && progress.get(entry.lesson.id)).slice(0, 6);

  return <main className="page">
    <PageActions><button type="button" className="btn btn-sm btn-ghost" onClick={onRefresh}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-classes.svg)" } as React.CSSProperties}><div><h1 className="h1">Lớp học</h1><p className="sub">Chọn một lớp để xem học sinh, bài tập và chấm bài, bảng điểm và báo cáo.</p></div><Link className="btn btn-primary" to="/assignments/workspace">{icon("plus")}Giao bài mới</Link></div>
    <section className="stats" aria-label="Chỉ số">
      <div className="stat"><i className="stat-ic" data-k="Lớp phụ trách" aria-hidden="true"></i><span className="stat-l">Lớp phụ trách</span><span className="stat-v">{dash(loading, classes.length)}</span><span className="stat-h">{grades.length ? "Khối " + grades.join(", ") : "Chưa có lớp"}</span></div>
      <div className="stat"><i className="stat-ic" data-k="Học sinh" aria-hidden="true"></i><span className="stat-l">Học sinh</span><span className="stat-v">{dash(loading, students)}</span><span className="stat-h">Trung bình {classes.length ? Math.round(students / classes.length) : 0} em một lớp</span></div>
      <div className="stat"><i className="stat-ic" data-k="Bài đã giao" aria-hidden="true"></i><span className="stat-l">Bài đã giao</span><span className="stat-v">{dash(workLoading, work.length)}</span><span className="stat-h">{open.length} bài đang mở</span></div>
      <div className="stat"><i className="stat-ic" data-k="Tỉ lệ nộp" aria-hidden="true"></i><span className="stat-l">Tỉ lệ nộp</span><span className="stat-v">{dash(workLoading, pct(openDone.s, openDone.r) + "%")}</span><span className="stat-h">Trên các bài đang mở</span></div>
    </section>
    {error && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{error}</p>}
    <div className="split"><div className="col" style={{ flex: "2.4 1 560px", gap: 16 }}>
      <section className="card" aria-label="Danh sách lớp phụ trách">
        <div className="toolbar">
          <label className="search"><span className="sr">Tìm lớp phụ trách</span>{icon("search")}<input className="input" type="search" placeholder="Tìm lớp, khối hoặc năm học" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
          <select className="input" style={{ width: 150 }} aria-label="Lọc theo khối" value={grade} onChange={event => { setGrade(event.target.value); setPage(1); }}><option value="ALL">Tất cả khối</option>{grades.map(value => <option key={value} value={value}>Khối {value}</option>)}</select>
        </div>
        {loading ? <StudioTableSkeleton headers={["Lớp", "Học sinh", "Bài đã giao", ""]} label="Đang tải lớp…" />
          : !filtered.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{classes.length ? "Không tìm thấy lớp phù hợp. Thử đổi từ khóa hoặc khối lớp." : "Chưa có lớp được phân công. Các lớp do nhà trường phân công sẽ xuất hiện ở đây."}</p>
          : <div className="table-scroll"><table className="table">
            <thead><tr><th scope="col">Lớp</th><th scope="col" className="num">Học sinh</th><th scope="col" className="num">Bài đã giao</th><th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
            <tbody>{filtered.slice((current - 1) * PAGE, current * PAGE).map(item => <tr key={item.id}>
              <th scope="row"><span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="tile" style={{ width: 28, height: 28, fontSize: 12 }}>{item.gradeLevel}</span>
                <span className="row-sub"><Link to={"/lab/classes/" + item.id}>{item.name}</Link><small>Khối {item.gradeLevel} · {item.schoolYear} · {item.subject || "Vật lý"}</small></span></span></th>
              <td className="num">{item.students.length}</td>
              <td className="num">{workLoading ? "—" : work.filter(lesson => lesson.classId === item.id).length}</td>
              <td className="num"><Link className="btn btn-sm" to={"/lab/classes/" + item.id}>Xem lớp</Link></td>
            </tr>)}</tbody>
          </table></div>}
        {pages > 1 && <div className="pager"><span>Hiển thị {(current - 1) * PAGE + 1}–{Math.min(current * PAGE, filtered.length)} / {filtered.length} lớp</span>
          <span className="actions" style={{ gap: 8, alignItems: "center" }}><button type="button" className="btn btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>}
      </section>
    </div><aside className="col insight-col" style={{ flex: "1 1 280px", gap: 16 }}>
      <section className="card"><div className="card-h"><h2 className="h2">Tỉ lệ nộp bài theo lớp</h2><span className="muted" style={{ fontSize: 12 }}>Bài đang mở gần nhất</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{latest.length ? latest.map(({ item, lesson }, index) => { const p = progress.get(lesson!.id)!; return <div className="hrow" key={item.id}>
          <span><span title={lesson!.title}>{item.name} · {lesson!.title.length > 28 ? lesson!.title.slice(0, 28) + "…" : lesson!.title}</span><b>{p.submitted}/{p.recipients}</b></span>
          <span className="bar"><i style={{ width: pct(p.submitted, p.recipients) + "%", animationDelay: index * 70 + "ms" }}></i></span></div>; })
          : <span className="muted">Chưa có bài đang mở.</span>}</div></section>
      <section className="card"><div className="card-h"><h2 className="h2">Điểm trung bình</h2><span className="muted" style={{ fontSize: 12 }}>Thang 10 · điểm chính thức</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{classes.length ? classes.slice(0, 6).map(item => <ClassAverage key={item.id} classroom={item} max={10} />) : <span className="muted">Chưa có lớp.</span>}</div></section>
    </aside></div>
  </main>;
}

function ClassWorkspace({ classroom, assignments, progress, assignmentsLoading, assignmentsError, onRefresh }: Readonly<{ classroom: TeacherClassOption; assignments: Assignment[]; progress: Map<string, Progress>; assignmentsLoading: boolean; assignmentsError?: string; onRefresh: () => void }>) {
  const [params, setParams] = useSearchParams();
  const tab = ["students", "assignments", "grades", "report"].includes(params.get("tab") ?? "") ? params.get("tab")! : "students";
  const ordered = useMemo(() => [...assignments].sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt)), [assignments]);
  const selected = ordered.find(item => item.id === params.get("assignment")) ?? ordered[0];
  const [studentQuery, setStudentQuery] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [lessonQuery, setLessonQuery] = useState("");
  const exportLock = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [filter, setFilter] = useState<SubmissionFilter>("all");
  const [now] = useState(() => Date.now());
  const students = useMemo(() => new Map<number, StudentOption>(classroom.students.map(student => [student.id, student])), [classroom.students]);
  const submissions = useResource<AssignmentSubmission[]>("/assignments/" + (selected?.id ?? "none") + "/submissions", tab === "assignments" && Boolean(selected) && !assignmentsError);
  const report = useResource<ClassReport>(classReportUrl(classroom.id, ALL_TIME, 0, 1));
  const submittedCount = new Set((submissions.data ?? []).filter(item => item.completedAt && selected?.studentIds.includes(item.studentId)).map(item => item.studentId)).size;
  const matchingStudents = classroom.students.filter(student => (student.fullName + " " + (student.email ?? "")).toLocaleLowerCase("vi").includes(studentQuery.trim().toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(matchingStudents.length / size));
  const current = Math.min(page, pages);
  const open = assignments.filter(item => item.status === "ACTIVE").length;
  const recent = ordered.slice(0, 4).map(item => progress.get(item.id)).filter(Boolean) as Progress[];
  const recentRate = pct(recent.reduce((s, p) => s + p.submitted, 0), recent.reduce((s, p) => s + p.recipients, 0));
  const state = (item: Assignment) => item.status !== "ACTIVE" ? { label: "Đã đóng", tone: "" } : item.dueAt && Date.parse(item.dueAt) < now ? { label: "Quá hạn", tone: "b-danger" } : { label: "Đang mở", tone: "b-success" };
  const navigateTab = (value: string, assignmentId?: string) => {
    const next = new URLSearchParams(params); next.set("tab", value);
    if (assignmentId) next.set("assignment", assignmentId);
    setParams(next);
  };
  const invalidateGrades = () => void queryClient.invalidateQueries({ predicate: query => String(query.queryKey[2]).startsWith("/assignments/mine/teacher/classes/" + classroom.id + "/grades/page?") });
  const exportGrades = async () => {
    if (!selected || exportLock.current) return;
    exportLock.current = true; setExporting(true); setExportError(""); setExportNotice("");
    try { await downloadAssignmentGrades(selected.id, selected.title); setExportNotice("Đã xuất điểm CSV cho bài: " + selected.title + ". File gồm toàn bộ học sinh được giao bài."); }
    catch (error) { setExportError(apiMessage(error, "Không thể xuất điểm CSV. Vui lòng thử lại.")); }
    finally { exportLock.current = false; setExporting(false); }
  };
  const save = async (id: string, score: number, feedback: string, reason?: string) => {
    if (!selected) return;
    const result = await gradeAssignmentSubmission(selected.id, id, score, feedback, true, reason);
    submissions.setData(previous => previous.map(item => item.id === result.id ? result : item));
    invalidateGrades();
  };
  const reopen = async (id: string, reason?: string) => {
    if (!selected) return;
    const result = await reopenAssignmentSubmission(selected.id, id, reason);
    submissions.setData(previous => previous.map(item => item.id === result.id ? result : item));
    invalidateGrades();
  };
  const tabs: [string, string][] = [["students", "Học sinh"], ["assignments", "Bài tập & chấm bài"], ["grades", "Bảng điểm"], ["report", "Báo cáo"]];
  const filters: [SubmissionFilter, string, number][] = selected ? [["all", "Tất cả", selected.studentIds.length], ["submitted", "Đã nộp", submittedCount], ["pending", "Chưa nộp", selected.studentIds.length - submittedCount]] : [];

  return <main className="page">
    {profileId != null && <StudentProfileDialog classId={classroom.id} userId={profileId} onClose={() => setProfileId(null)} />}
    {tab !== "grades" && tab !== "report" && <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={submissions.refreshing} onClick={() => { onRefresh(); if (tab === "assignments" && selected) void submissions.refresh(); }}>{icon("refresh")}Làm mới</button></PageActions>}
    <Link className="link" to="/lab/classes">{icon("back")}Lớp học</Link>
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-users.svg)" } as React.CSSProperties}>
      <div><h1 className="h1">{classroom.name}</h1><p className="sub">Khối {classroom.gradeLevel} · {classroom.schoolYear} · {classroom.subject || "Vật lý"}</p></div>
      <span className="actions" style={{ gap: 8 }}><Link className="btn btn-primary" to={"/assignments/workspace?classId=" + encodeURIComponent(classroom.id)}>{icon("plus")}Giao bài cho lớp này</Link></span>
    </div>
    {/* the report tab has its own figures, filtered by date and status: the class ones would repeat them */}
    {tab !== "report" && <section className="stats" aria-label={"Chỉ số lớp " + classroom.name}>
      <div className="stat"><i className="stat-ic" data-k="Học sinh đang học" aria-hidden="true"></i><span className="stat-l">Học sinh đang học</span><span className="stat-v">{classroom.students.length}</span><span className="stat-h">Khối {classroom.gradeLevel} · môn {classroom.subject || "Vật lý"}</span></div>
      <div className="stat"><i className="stat-ic" data-k="Bài đã giao" aria-hidden="true"></i><span className="stat-l">Bài đã giao</span><span className="stat-v">{assignmentsLoading ? "—" : assignments.length}</span><span className="stat-h">{open} bài đang mở</span></div>
      <div className="stat"><i className="stat-ic" data-k="Tỉ lệ nộp" aria-hidden="true"></i><span className="stat-l">Tỉ lệ nộp</span><span className="stat-v">{recent.length ? recentRate + "%" : "—"}</span><span className="stat-h">{recent.length} bài gần nhất của lớp</span></div>
      <div className="stat"><i className="stat-ic" data-k="Điểm trung bình" aria-hidden="true"></i><span className="stat-l">Điểm trung bình</span><span className="stat-v">{report.data?.summary.average10 == null ? "—" : report.data.summary.average10.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</span><span className="stat-h">Trên các bài đã chấm</span></div>
    </section>}
    <div className="tabs" role="tablist">{tabs.map(([value, label]) => <button key={value} role="tab" type="button" aria-selected={tab === value} onClick={() => { navigateTab(value); setSubmissionQuery(""); }}>{label}</button>)}</div>

    {tab === "students" && <section className="card" aria-label={"Danh sách học sinh " + classroom.name}>
      <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <label className="search"><span className="sr">Tìm học sinh trong lớp</span>{icon("search")}<input className="input" type="search" placeholder="Tìm theo tên hoặc email…" value={studentQuery} onChange={event => { setStudentQuery(event.target.value); setPage(1); }} /></label>
        <span className="muted" style={{ fontSize: 13, minWidth: 0 }}>{classroom.students.length} học sinh đang học · bấm tên để xem hồ sơ</span>
      </div>
      {matchingStudents.length === 0 ? <p className="muted" style={{ padding: 20, margin: 0 }}>Không có học sinh phù hợp.</p>
        : <div className="table-scroll"><table className="table">
          <thead><tr><th scope="col" className="num" style={{ width: 56 }}>STT</th><th scope="col">Họ và tên</th><th scope="col">Email</th></tr></thead>
          <tbody>{matchingStudents.slice((current - 1) * size, current * size).map((student, index) => <tr key={student.id}>
            <td className="num muted">{(current - 1) * size + index + 1}</td>
            <th scope="row"><button type="button" className="student-cell" onClick={() => setProfileId(student.id)}>
              {student.avatarUrl ? <img className="avatar" src={student.avatarUrl} alt="" loading="lazy" /> : <span className="avatar r-student" aria-hidden="true">{initialsOf(student.fullName)}</span>}
              <span className="clamp-1">{student.fullName}</span></button></th>
            <td className="muted">{student.email || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      <div className="pager"><span>Hiển thị {matchingStudents.length ? (current - 1) * size + 1 : 0}–{Math.min(current * size, matchingStudents.length)} / {matchingStudents.length} học sinh</span>
        <span className="actions" style={{ gap: 8, alignItems: "center" }}><label className="pager-size">Số dòng <select className="input" style={{ width: 72 }} value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <button type="button" className="btn btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>
    </section>}

    {tab === "assignments" && (assignmentsLoading ? <section className="card"><StudioTableSkeleton headers={["Bài tập", "Hạn nộp", "Trạng thái"]} label="Đang tải bài tập…" /></section>
      : assignmentsError ? <section className="card"><div className="card-b" role="alert" style={{ display: "flex", gap: 12, alignItems: "center" }}>Chưa tải được bài tập.<button type="button" className="btn btn-sm" onClick={onRefresh}>Thử lại</button></div></section>
      : !selected ? <section className="card"><div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}><p className="muted" style={{ margin: 0 }}>Lớp chưa có bài tập được giao.</p><Link className="btn btn-primary" to={"/assignments/workspace?classId=" + encodeURIComponent(classroom.id)}>{icon("plus")}Giao bài cho lớp này</Link></div></section>
      : <div className="split">
        <section className="card" style={{ flex: "0 1 320px", minWidth: 0 }} aria-label="Bài tập của lớp">
          <div className="card-h"><h2 className="h2">Bài tập của lớp</h2><span className="muted" style={{ fontSize: 12 }}>{ordered.length} bài</span></div>
          {ordered.length > 6 && <div className="toolbar" style={{ padding: "10px 12px" }}><label className="search" style={{ width: "100%" }}><span className="sr">Tìm bài tập của lớp</span>{icon("search")}<input className="input" type="search" placeholder="Tìm bài tập…" value={lessonQuery} onChange={event => setLessonQuery(event.target.value)} /></label></div>}
          {/* the list scrolls on its own, so a class with many assignments keeps the submissions beside it in view */}
          <ul className="rows lesson-list">{ordered.filter(item => item.id === selected.id || item.title.toLocaleLowerCase("vi").includes(lessonQuery.trim().toLocaleLowerCase("vi"))).map(item => { const s = state(item), p = progress.get(item.id), on = item.id === selected.id; return <li key={item.id}>
            <a className="row" href={"?tab=assignments&assignment=" + encodeURIComponent(item.id)} aria-current={on ? "true" : undefined} style={{ background: on ? "var(--row-selected)" : "transparent" }}
              onClick={event => { event.preventDefault(); navigateTab("assignments", item.id); setSubmissionQuery(""); setFilter("all"); setExportError(""); setExportNotice(""); }}>
              <span className="row-t"><b>{item.title}</b><small>{item.dueAt ? "Hạn " + due(item.dueAt) : "Không giới hạn"}{p ? ` · ${p.submitted}/${p.recipients} đã nộp` : ""}</small></span><span className={"badge " + s.tone}>{s.label}</span></a></li>; })}</ul>
        </section>
        <section className="card" style={{ flex: "1 1 520px", minWidth: 0 }} aria-label="Bài nộp">
          <div className="card-h"><div><h2 className="h2 clamp-2" title={selected.title}>{selected.title}</h2></div><button type="button" className="btn btn-sm" disabled={exporting || selected.canManage === false} onClick={() => void exportGrades()}>{icon("download")}{exporting ? "Đang xuất…" : "Xuất điểm"}</button></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 13, color: "var(--text-2)" }}><span className={"badge " + state(selected).tone}>{state(selected).label}</span><span>Hạn nộp {due(selected.dueAt)}</span>
              {selected.dueAt && <span>{selected.allowLateSubmission === false ? "Không nhận bài trễ · Quá hạn chưa nộp: 0 điểm" : "Nhận bài trễ"}</span>}{selected.assignedByName && <span>Người giao {selected.assignedByName}</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="sr">Tiến độ nộp bài</span><span className="bar" style={{ flex: 1 }}><i style={{ width: pct(submittedCount, selected.studentIds.length) + "%" }}></i></span><span style={{ fontSize: 13 }}>{submissions.loading || submissions.error ? "—" : submittedCount}/{selected.studentIds.length} đã nộp</span></div>
            {exportError && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start", margin: 0 }}>{exportError}</p>}
            {exportNotice && <p className="badge b-success" role="status" style={{ alignSelf: "flex-start", margin: 0 }}>{exportNotice}</p>}
          </div>
          <div className="toolbar" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="seg" role="group" aria-label="Lọc bài nộp của lớp">{filters.map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} {submissions.loading || submissions.error ? "" : count}</button>)}</div>
            <label className="search"><span className="sr">Tìm học sinh để chấm</span>{icon("search")}<input className="input" type="search" placeholder="Tìm tên học sinh…" value={submissionQuery} onChange={event => setSubmissionQuery(event.target.value)} /></label>
          </div>
          {submissions.error ? <div className="card-b" role="alert" style={{ display: "flex", gap: 12, alignItems: "center" }}>{submissions.error}<button type="button" className="btn btn-sm" onClick={() => void submissions.refresh()}>Thử lại</button></div>
            : submissions.loading ? <StudioTableSkeleton headers={["Học sinh", "Kết luận / bài làm", "Nộp lúc", "Trạng thái", "Thao tác"]} label="Đang tải bài nộp…" />
            : submissions.data && <TeacherSubmissionTable canvas key={selected.id} record={{ assignment: selected, submissions: submissions.data }} students={students} filter={filter} query={submissionQuery} onGrade={save} onReopen={reopen} />}
        </section>
      </div>)}

    {tab === "grades" && <section className="card" aria-label="Bảng điểm"><TeacherGradebook classId={classroom.id} onReviewSubmission={(assignmentId, studentId) => { setSubmissionQuery(students.get(studentId)?.fullName ?? ""); setFilter("all"); navigateTab("assignments", assignmentId); }} /></section>}
    {tab === "report" && <ClassReportPanel classId={classroom.id} />}
  </main>;
}
