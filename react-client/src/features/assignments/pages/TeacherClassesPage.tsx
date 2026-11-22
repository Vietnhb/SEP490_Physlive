import SchoolAccountProfileDialog from "../../account/components/SchoolAccountProfileDialog";
import StudentAvatar from "../components/StudentAvatar";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Select, Tabs, Tooltip } from "@radix-ui/themes";
import { useResource } from "../../../shared/hooks/operationsData";
import { queryClient } from "../../../shared/api/queryClient";
import type { Assignment, AssignmentSubmission, StudentOption, TeacherClassOption } from "../../../shared/types/physlive";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { TeacherSubmissionTable } from "../components/TeacherSubmissionTable";
import { TeacherSubmissionTableLoading } from "../components/TeacherSubmissionTableLoading";
import { downloadAssignmentGrades, gradeAssignmentSubmission, reopenAssignmentSubmission } from "../api/assignmentApi";
import type { SubmissionFilter } from "../model/teacherSubmissionTypes";
import SchoolClassGrades from "../../school/components/SchoolClassGrades";
import { apiMessage } from "../../../shared/lib/apiError";
import { DownloadIcon } from "@radix-ui/react-icons";
import LearningIcon from "../../../shared/ui/LearningIcon";
import styles from "./TeacherClassesPage.module.css";

const due = (value?: string) => value ? new Date(value).toLocaleString("vi-VN") : "Không giới hạn";

export default function TeacherClassesPage() {
  const { classId } = useParams();
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const work = useResource<Assignment[]>("/assignments/mine/teacher");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [classPage, setClassPage] = useState(1);
  const filteredClasses = (classes.data ?? []).filter(item => (grade === "ALL" || String(item.gradeLevel) === grade) && (item.name + " " + item.gradeLevel + " " + item.schoolYear).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const classPages = Math.max(1, Math.ceil(filteredClasses.length / 9));
  const visibleClassPage = Math.min(classPage, classPages);
  const classroom = classes.data?.find(item => item.id === classId);
  const refresh = () => { void classes.refresh(); void work.refresh(); };
  if (classes.loading) return <main className={"lab-main " + styles.page}><TableLoadingSkeleton headers={["Lớp", "Năm học", "Học sinh", "Bài đã giao"]} /></main>;
  return <main className={"lab-main " + styles.page}>
    {(classes.error || work.error) && <p className={styles.error} role="alert">{classes.error || work.error}<Button variant="outline" onClick={refresh}>Thử lại</Button></p>}
    {classId ? classroom ? <ClassWorkspace key={classId} classroom={classroom} assignments={(work.data ?? []).filter(item => item.classId === classId)} assignmentsLoading={work.loading} assignmentsError={work.error} onRefresh={refresh} /> : <section className={styles.panel}><h1>Không truy cập được lớp</h1><p>Lớp không còn trong danh sách phân công của bạn hoặc đã ngừng hoạt động.</p><Link to="/lab/classes">Quay lại lớp phụ trách</Link></section>
      : <>
        <header className={styles.listHeading}><div><h1>Lớp phụ trách</h1><p>{classes.data?.length ?? 0} lớp · {(classes.data ?? []).reduce((sum,item)=>sum+item.students.length,0)} lượt học sinh</p></div><Button asChild variant="soft"><Link to="/lab/reports"><LearningIcon name="chart" />Báo cáo kết quả</Link></Button><RefreshButton disabled={classes.refreshing || work.refreshing} onClick={refresh} /></header>
        <div className={styles.classFilters}><label className={styles.search}><LearningIcon name="search" /><input type="search" aria-label="Tìm lớp phụ trách" placeholder="Tìm lớp hoặc năm học…" value={query} onChange={event => {setQuery(event.target.value);setClassPage(1);}} /></label><Select.Root value={grade} onValueChange={value=>{setGrade(value);setClassPage(1);}}><Select.Trigger aria-label="Lọc khối lớp phụ trách" /><Select.Content position="popper"><Select.Item value="ALL">Tất cả khối</Select.Item>{[10,11,12].map(value=><Select.Item key={value} value={String(value)}>Khối {value}</Select.Item>)}</Select.Content></Select.Root><span>{filteredClasses.length} lớp</span></div>
        <div className={styles.classGrid}>
          {filteredClasses.slice((visibleClassPage-1)*9,visibleClassPage*9).map(item=>{
            const count=work.loading||work.error?null:(work.data??[]).filter(lesson=>lesson.classId===item.id).length;
            return <article className={styles.classCard} key={item.id} data-grade={item.gradeLevel}>
              <header><span className={styles.classSymbol}><LearningIcon name="book" /></span><Badge variant="soft">Khối {item.gradeLevel}</Badge><h2><Link to={"/lab/classes/"+item.id} title={item.name}>{item.name}</Link></h2><p>{item.subject||"Vật lý"} · {item.schoolYear}</p></header>
              <div className={styles.cardMetrics}><span><LearningIcon name="users" /><strong>{item.students.length}</strong> học sinh</span><span><LearningIcon name="file" /><strong>{count??"—"}</strong> bài đã giao</span></div>
              <nav aria-label={"Mở lớp "+item.name}><Link to={"/lab/classes/"+item.id}>Học sinh</Link><Link to={"/lab/classes/"+item.id+"?tab=assignments"}>Chấm bài</Link><Link to={"/lab/classes/"+item.id+"?tab=grades"}>Bảng điểm<LearningIcon name="arrow" /></Link></nav>
            </article>;
          })}
        </div>
        {!filteredClasses.length&&<section className={styles.emptyState}><LearningIcon name="book" /><h2>{classes.data?.length?"Không tìm thấy lớp phù hợp":"Chưa có lớp được phân công"}</h2><p>{classes.data?.length?"Thử đổi từ khóa hoặc khối lớp.":"Các lớp do nhà trường phân công sẽ xuất hiện tại đây."}</p>{Boolean(classes.data?.length)&&<Button variant="soft" onClick={()=>{setQuery("");setGrade("ALL");setClassPage(1);}}>Xóa bộ lọc</Button>}</section>}
        {classPages>1&&<footer className={styles.footer}><span>Hiển thị {(visibleClassPage-1)*9+1}–{Math.min(visibleClassPage*9,filteredClasses.length)} / {filteredClasses.length} lớp</span><div><Button variant="soft" disabled={visibleClassPage===1} onClick={()=>setClassPage(visibleClassPage-1)}>Trước</Button><span>Trang {visibleClassPage}/{classPages}</span><Button variant="soft" disabled={visibleClassPage===classPages} onClick={()=>setClassPage(visibleClassPage+1)}>Sau</Button></div></footer>}

      </>}
  </main>;
}

function ClassWorkspace({ classroom, assignments, assignmentsLoading, assignmentsError, onRefresh }: Readonly<{ classroom: TeacherClassOption; assignments: Assignment[]; assignmentsLoading: boolean; assignmentsError?: string; onRefresh: () => void }>) {
  const [params, setParams] = useSearchParams();
  const tab = ["students", "assignments", "grades"].includes(params.get("tab") ?? "") ? params.get("tab")! : "students";
  const selected = assignments.find(item => item.id === params.get("assignment")) ?? assignments[0];
  const [studentQuery, setStudentQuery] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [submissionQuery, setSubmissionQuery] = useState("");
  const exportLock = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [filter, setFilter] = useState<SubmissionFilter>("all");
  const students = useMemo(() => new Map<number, StudentOption>(classroom.students.map(student => [student.id, student])), [classroom.students]);
  const submissions = useResource<AssignmentSubmission[]>("/assignments/" + (selected?.id ?? "none") + "/submissions", tab === "assignments" && Boolean(selected) && !assignmentsError);
  const submittedCount = new Set((submissions.data ?? []).filter(item => item.completedAt && selected?.studentIds.includes(item.studentId)).map(item => item.studentId)).size;
  const matchingStudents = classroom.students.filter(student => (student.fullName + " " + (student.email ?? "")).toLocaleLowerCase("vi").includes(studentQuery.trim().toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(matchingStudents.length / size));
  const current = Math.min(page, pages);
  const navigateTab = (value: string, assignmentId?: string) => {
    const next = new URLSearchParams(params); next.set("tab", value);
    if (assignmentId) next.set("assignment", assignmentId);
    setParams(next);
  };
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
    void queryClient.invalidateQueries({ predicate: query => String(query.queryKey[2]).startsWith("/assignments/mine/teacher/classes/" + classroom.id + "/grades/page?") });
  };
  const reopen = async (id: string, reason?: string) => {
    if (!selected) return;
    const result = await reopenAssignmentSubmission(selected.id, id, reason);
    submissions.setData(previous => previous.map(item => item.id === result.id ? result : item));
    void queryClient.invalidateQueries({ predicate: query => String(query.queryKey[2]).startsWith("/assignments/mine/teacher/classes/" + classroom.id + "/grades/page?") });
  };
  return <>
    {profileId != null && <SchoolAccountProfileDialog teacherClassId={classroom.id} userId={profileId} onClose={()=>setProfileId(null)} />}
    <header className={styles.classHeader}>
      <div className={styles.classIdentity}><Link className={styles.back} to="/lab/classes"><LearningIcon name="back" />Lớp phụ trách</Link><h1>{classroom.name}</h1><p>Khối {classroom.gradeLevel} · {classroom.schoolYear} · {classroom.subject || "Vật lý"}</p></div>
      <div className={styles.headerActions}><Button asChild variant="outline"><Link to={"/lab/reports?classId="+classroom.id}><LearningIcon name="chart" />Báo cáo kết quả</Link></Button><Button asChild><Link to={"/assignments/workspace?classId="+encodeURIComponent(classroom.id)}><LearningIcon name="plus" />Giao bài</Link></Button></div>
      <div className={styles.classSummary}><span><LearningIcon name="users" /><strong>{classroom.students.length}</strong> học sinh đang học</span><span><LearningIcon name="file" /><strong>{assignmentsLoading||assignmentsError?"—":assignments.length}</strong> bài đã giao</span></div>
    </header>
    {tab !== "grades" && <RefreshButton onClick={()=>{onRefresh();if(tab === "assignments" && selected)void submissions.refresh();}} disabled={submissions.refreshing} />}
    <Tabs.Root value={tab} onValueChange={value => { navigateTab(value); setSubmissionQuery(""); }}>
      <Tabs.List className={styles.tabs}><Tabs.Trigger value="students">Học sinh</Tabs.Trigger><Tabs.Trigger value="assignments">Bài đã giao & chấm điểm</Tabs.Trigger><Tabs.Trigger value="grades">Bảng điểm</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="students"><section className={styles.panel}>
        <div className={styles.toolbar}><h2>Danh sách học sinh</h2><input type="search" aria-label="Tìm học sinh của lớp" placeholder="Tìm tên hoặc email học sinh…" value={studentQuery} onChange={event => { setStudentQuery(event.target.value); setPage(1); }} /></div>
        <div className={styles.scroll}><table className={styles.table}><thead><tr><th>STT</th><th>Họ và tên</th><th>Email</th></tr></thead><tbody>{matchingStudents.slice((current - 1) * size, current * size).map((student, index) => <tr key={student.id}><td>{(current - 1) * size + index + 1}</td><td><span className={styles.studentIdentity}><button type="button" className={styles.studentProfile} aria-label={"Xem hồ sơ " + student.fullName} onClick={()=>setProfileId(student.id)}><StudentAvatar src={student.avatarUrl} /><span>{student.fullName}</span></button></span></td><td>{student.email || "—"}</td></tr>)}</tbody></table></div>
        {matchingStudents.length === 0 && <p className={styles.empty}>Không có học sinh phù hợp.</p>}
        <footer className={styles.footer}><span>{matchingStudents.length} học sinh</span><div><label>Số dòng <select aria-label="Số học sinh mỗi trang" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label><Button variant="soft" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</Button><span>Trang {current}/{pages}</span><Button variant="soft" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</Button></div></footer>
      </section></Tabs.Content>
      <Tabs.Content value="assignments"><section className={styles.panel}>
        {assignmentsLoading ? <TableLoadingSkeleton headers={["Bài tập", "Hạn nộp", "Trạng thái"]} /> : assignmentsError ? <p role="alert">Chưa tải được bài tập. <Button onClick={onRefresh}>Thử lại</Button></p> : !selected ? <div className={styles.empty}><p>Lớp chưa có bài tập được giao.</p><Button asChild><Link to={"/assignments/workspace?classId=" + classroom.id}>Giao bài đầu tiên</Link></Button></div> : <>
          <div className={styles.assignmentOverview}>
            <div className={styles.assignmentSelection}>
              <label id="class-assignment-label">Bài tập đang xem</label>
              <Select.Root value={selected.id} onValueChange={value => { navigateTab("assignments", value); setSubmissionQuery(""); setFilter("all"); setExportError(""); setExportNotice(""); }}>
                <Tooltip content={selected.title}><Select.Trigger aria-label="Chọn bài tập của lớp" className={styles.assignmentTrigger} /></Tooltip>
                <Select.Content position="popper" className={styles.assignmentOptions}>{assignments.map(item => <Select.Item key={item.id} value={item.id}><span title={item.title} className={styles.optionTitle}>{item.title}</span></Select.Item>)}</Select.Content>
              </Select.Root>
              <div className={styles.assignmentFacts}><Badge color={selected.status === "ACTIVE" ? "green" : "gray"}>{selected.status === "ACTIVE" ? "Đang mở" : "Đã đóng"}</Badge><span>Hạn nộp <strong>{due(selected.dueAt)}</strong></span>{selected.dueAt && <span>{selected.allowLateSubmission === false ? "Không nhận bài trễ · Quá hạn chưa nộp: 0 điểm" : "Cho phép nộp trễ"}</span>}{selected.assignedByName && <span>Người giao <strong>{selected.assignedByName}</strong></span>}</div>
            </div>
            <div className={styles.submissionProgress} aria-label="Tiến độ nộp bài">
              <span>Tiến độ nộp bài</span><strong>{submissions.loading || submissions.error ? "—" : submittedCount}<small> / {selected.studentIds.length}</small></strong>
              <div className={styles.progressTrack}><span style={{ width: selected.studentIds.length ? Math.min(100, submittedCount / selected.studentIds.length * 100) + "%" : "0%" }} /></div>
              <small>{selected.studentIds.length} học sinh nhận bài</small>
            </div>
          </div>
          {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
          {exportNotice && <p role="status" className={styles.exportNotice}>{exportNotice}</p>}
          <div className={styles.submissionToolbar}>
            <div className={styles.submissionFilters} role="group" aria-label="Lọc bài nộp của lớp">{([
              ["all", "Tất cả", selected.studentIds.length], ["submitted", "Đã nộp", submittedCount], ["pending", "Chưa nộp", selected.studentIds.length - submittedCount],
            ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{submissions.loading || submissions.error ? "—" : count}</span></button>)}</div>
            <div className={styles.submissionTools}><Button variant="soft" loading={exporting} disabled={exporting || selected.canManage === false} onClick={() => void exportGrades()}><DownloadIcon />Xuất điểm CSV</Button><input type="search" aria-label="Tìm học sinh để chấm" placeholder="Tìm tên học sinh…" value={submissionQuery} onChange={event => setSubmissionQuery(event.target.value)} /></div>
          </div>
          {submissions.error && <p className={styles.error} role="alert">{submissions.error}<Button onClick={() => void submissions.refresh()}>Thử lại</Button></p>}
          {submissions.loading ? <TeacherSubmissionTableLoading /> : submissions.data && <TeacherSubmissionTable key={selected.id} record={{ assignment: selected, submissions: submissions.data }} students={students} filter={filter} query={submissionQuery} onGrade={save} onReopen={reopen} />}
        </>}
      </section></Tabs.Content>
      <Tabs.Content value="grades"><SchoolClassGrades classId={classroom.id} embedded teacherMode onReviewSubmission={(assignmentId, studentId) => { setSubmissionQuery(students.get(studentId)?.fullName ?? ""); setFilter("all"); navigateTab("assignments", assignmentId); }} /></Tabs.Content>
    </Tabs.Root>
  </>;
}
