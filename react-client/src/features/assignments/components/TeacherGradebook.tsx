import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { useResource } from "../../../shared/hooks/operationsData";
import PageActions from "../../../shared/layout/PageActions";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { ClassGradebookPage, GradeAssignment, GradeCell, GradeStudent } from "../../school/api/classGradesApi";
import GradeHistory from "./GradeHistory";
import StudioTableSkeleton from "./StudioTableSkeleton";
import { useStudioPortal } from "./useStudioPortal";

const STATES: Record<string, string> = { MISSED_DEADLINE: "Quá hạn · Không nộp", NOT_ASSIGNED: "Không được giao", NOT_STARTED: "Chưa làm", IN_PROGRESS: "Đang làm", SUBMITTED: "Chưa chấm", RETURNED: "Trả làm lại", AI_GRADED: "Điểm tạm tính", TEACHER_CONFIRMED: "Đã xác nhận" };
const TONES: Record<string, string> = { MISSED_DEADLINE: "b-danger", IN_PROGRESS: "b-info", SUBMITTED: "b-warn", RETURNED: "b-danger", AI_GRADED: "b-warn", TEACHER_CONFIRMED: "b-success" };
const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const time = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
type Selected = { student: GradeStudent; assignment: GradeAssignment; cell: GradeCell };

/** The class gradebook of the teacher area: students down, assignments across, each result opens its detail. */
export default function TeacherGradebook({ classId, onReviewSubmission }: Readonly<{ classId: string; onReviewSubmission?: (assignmentId: string, studentId: number) => void }>) {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [membership, setMembership] = useState("CURRENT");
  const [assignmentId, setAssignmentId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [columns, setColumns] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const portal = useStudioPortal(host);
  const panel = useRef<HTMLDivElement>(null);
  const studentQuery = useDebouncedValue(query), assignmentQuery = useDebouncedValue(title);
  const invalidDates = Boolean(from && to && from > to);
  // as many assignment columns as fit beside the student column (180px each, at most five)
  useEffect(() => {
    if (!panel.current) return;
    let previous = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.max(1, Math.min(5, Math.floor((entry.contentRect.width - 240) / 170)));
      if (previous !== next) { previous = next; setColumns(next); setAssignmentPage(0); }
    });
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);
  const params = new URLSearchParams({ assignmentPage: String(assignmentPage), assignmentSize: String(Math.max(1, columns)), studentPage: String(page), studentSize: String(pageSize), membership, assignment: assignmentId });
  if (studentQuery.trim()) params.set("studentQuery", studentQuery.trim());
  if (assignmentQuery.trim()) params.set("title", assignmentQuery.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const resource = useResource<ClassGradebookPage>(`/assignments/mine/teacher/classes/${classId}/grades/page?${params}`, columns > 0 && !invalidDates);
  const book = resource.data;
  const assignments = book?.assignments ?? [], students = book?.students ?? [];
  const busy = resource.loading || resource.refreshing;
  const resetPages = () => { setPage(0); setAssignmentPage(0); setSelected(null); };
  const filtered = Boolean(query || title || membership !== "CURRENT" || assignmentId !== "ALL" || from || to);
  const clear = () => { setQuery(""); setTitle(""); setMembership("CURRENT"); setAssignmentId("ALL"); setFrom(""); setTo(""); resetPages(); };
  const month = (offset: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const year = Number(parts.find(part => part.type === "year")!.value), index = Number(parts.find(part => part.type === "month")!.value) - 1 + offset;
    setFrom(new Date(Date.UTC(year, index, 1)).toISOString().slice(0, 10));
    setTo(new Date(Date.UTC(year, index + 1, 0)).toISOString().slice(0, 10)); setAssignmentId("ALL"); resetPages();
  };
  const studentPage = book?.studentPage ?? 0, studentPages = book?.studentPages ?? 1, shownSize = book?.studentSize ?? pageSize, totalStudents = book?.totalStudents ?? 0;
  const columnPage = book?.assignmentPage ?? 0, columnPages = book?.assignmentPages ?? 1, totalAssignments = book?.totalAssignments ?? 0, columnSize = book?.assignmentSize ?? 1;

  return <div ref={node => { panel.current = node; setHost(node); }} style={{ display: "flex", flexDirection: "column" }}>
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={busy || invalidDates} onClick={() => void resource.refresh()}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="toolbar" role="group" aria-label="Lọc bảng điểm" style={{ flexWrap: "wrap" }}>
      <label className="search"><span className="sr">Tìm học sinh</span>{icon("search")}<input className="input" type="search" placeholder="Tìm học sinh…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); setSelected(null); }} /></label>
      <label className="search"><span className="sr">Tìm bài tập</span>{icon("file")}<input className="input" type="search" placeholder="Tìm bài tập…" value={title} onChange={event => { setTitle(event.target.value); setAssignmentId("ALL"); resetPages(); }} /></label>
      <select className="input" style={{ width: 170 }} aria-label="Thành viên lớp" value={membership} onChange={event => { setMembership(event.target.value); setPage(0); setSelected(null); }}>
        <option value="CURRENT">Đang học trong lớp</option><option value="FORMER">Đã rời lớp</option><option value="ALL">Tất cả học sinh</option></select>
      <select className="input" style={{ width: 200 }} aria-label="Xem riêng một bài" value={assignmentId} onChange={event => { setAssignmentId(event.target.value); resetPages(); }}>
        <option value="ALL">Tất cả bài phù hợp</option>{assignments.map(item => <option key={item.id} value={item.id}>{item.title.length > 48 ? item.title.slice(0, 48) + "…" : item.title}</option>)}</select>
    </div>
    <div className="toolbar gb-dates" role="group" aria-label="Khoảng ngày giao" style={{ borderTop: 0, paddingTop: 0, flexWrap: "wrap" }}>
      <span className="muted" style={{ fontSize: 13 }}>Ngày giao</span>
      <span className="date-range"><input className="input" type="date" aria-label="Ngày giao từ" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setAssignmentId("ALL"); resetPages(); }} /><span className="muted">–</span>
        <input className="input" type="date" aria-label="Ngày giao đến" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setAssignmentId("ALL"); resetPages(); }} /></span>
      <div className="seg" role="group" aria-label="Chọn nhanh tháng"><button type="button" aria-pressed={false} onClick={() => month(0)}>Tháng này</button><button type="button" aria-pressed={false} onClick={() => month(-1)}>Tháng trước</button></div>
      {filtered && <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>{icon("x")}Xóa bộ lọc</button>}
    </div>
    {invalidDates && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0", alignSelf: "flex-start" }}>Từ ngày phải trước hoặc bằng đến ngày.</p>}
    {resource.error && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0", alignSelf: "flex-start" }}>{resource.error}</p>}
    {assignmentId !== "ALL" && <p className="muted" style={{ margin: "12px 16px 0", fontSize: 13 }}>Chỉ hiện học sinh được giao bài đã chọn, theo bộ lọc thành viên lớp.</p>}
    {!invalidDates && (!book ? <StudioTableSkeleton headers={["Học sinh", "Bài tập", "Bài tập", "Bài tập"]} label="Đang tải bảng điểm…" />
      : !assignments.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{filtered ? "Không có bài tập phù hợp. Thử đổi tên bài hoặc khoảng ngày giao." : "Lớp chưa có bài tập nào."}</p>
      : <div className="table-scroll" aria-busy={busy}><table className="table gradebook">
        <thead><tr><th scope="col" className="gb-student"><span className="gb-corner"><span>Học sinh</span>
          {/* the assignments shown as columns page sideways here, beside them; the pager below only pages students */}
          {columnPages > 1 && <span className="gb-colnav" role="group" aria-label="Chuyển nhóm bài tập">
            <small className="muted" aria-live="polite">Bài {columnPage * columnSize + 1}–{Math.min((columnPage + 1) * columnSize, totalAssignments)} / {totalAssignments}</small>
            <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Các bài trước" title="Các bài trước" disabled={busy || columnPage === 0} onClick={() => { setAssignmentPage(columnPage - 1); setSelected(null); }}>{icon("back")}</button>
            <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label="Các bài tiếp theo" title="Các bài tiếp theo" disabled={busy || columnPage + 1 >= columnPages} onClick={() => { setAssignmentPage(columnPage + 1); setSelected(null); }}>{icon("chevron")}</button>
          </span>}</span></th>
          {assignments.map(item => <th key={item.id} scope="col" className="gb-col" title={item.title}><span className="gb-col-head"><span className="clamp-2">{item.title}</span><small className="muted">Tối đa {item.maxScore}{item.dueAt ? " · hạn " + new Date(item.dueAt).toLocaleDateString("vi-VN") : ""}</small></span></th>)}</tr></thead>
        <tbody>{students.map(student => <tr key={student.id}>
          <th scope="row" className="gb-student"><span className="row-sub"><span style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="clamp-1" title={student.fullName}>{student.fullName}</span>{!student.current && <span className="badge">Đã rời lớp</span>}</span><small className="clamp-1">{student.email}</small></span></th>
          {assignments.map(assignment => {
            const cell = student.cells.find(item => item.assignmentId === assignment.id);
            if (!cell || cell.state === "NOT_ASSIGNED") return <td key={assignment.id} className="gb-cell"><span className="gb-na">Không được giao</span></td>;
            return <td key={assignment.id} className="gb-cell"><button type="button" className="gb-btn" data-state={cell.state} aria-haspopup="dialog"
              aria-label={`${student.fullName} - ${assignment.title}: ${cell.score != null ? cell.score + "/" + cell.maxScore : STATES[cell.state]}`} onClick={() => setSelected({ student, assignment, cell })}>
              {cell.score != null ? <b>{cell.score}<span className="muted">/{cell.maxScore}</span></b> : null}<span className={"badge " + (TONES[cell.state] ?? "")}>{STATES[cell.state] ?? cell.state}</span></button></td>;
          })}
        </tr>)}{students.length === 0 && <tr><td colSpan={assignments.length + 1} className="muted">Không có học sinh phù hợp.</td></tr>}</tbody>
      </table></div>)}
    {book && !invalidDates && <div className="pager" style={{ flexWrap: "wrap", gap: 12 }}>
      <span aria-live="polite">Học sinh {totalStudents ? studentPage * shownSize + 1 : 0}–{Math.min((studentPage + 1) * shownSize, totalStudents)} / {totalStudents}<span className="muted"> · bấm một ô để xem chi tiết</span></span>
      <span className="actions" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label className="pager-size">Số dòng <select className="input" style={{ width: 72 }} aria-label="Số học sinh mỗi trang" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0); setSelected(null); }}>{[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        <button type="button" className="btn btn-sm" disabled={busy || studentPage === 0} onClick={() => { setPage(studentPage - 1); setSelected(null); }}>Trước</button><span>Trang {studentPage + 1} / {studentPages}</span>
        <button type="button" className="btn btn-sm" disabled={busy || studentPage + 1 >= studentPages} onClick={() => { setPage(studentPage + 1); setSelected(null); }}>Sau</button></span></div>}

    <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <Dialog.Portal container={portal.isConnected ? portal : undefined}><Dialog.Overlay className="scrim is-fixed" />
        <Dialog.Content className="dialog is-fixed" style={{ width: "min(620px, calc(100% - 32px))" }}>
          <div className="card-h" style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0 }}><Dialog.Title className="h2">Chi tiết kết quả</Dialog.Title><Dialog.Description className="muted clamp-1" style={{ fontSize: 13, marginTop: 2 }}>{selected?.student.fullName} · {selected?.assignment.title}</Dialog.Description></div>
            <Dialog.Close className="btn btn-sm btn-ghost" aria-label="Đóng chi tiết kết quả">{icon("x")}</Dialog.Close></div>
          {selected && <div className="card-b dialog-scroll">
            <dl className="grade-meta">
              <div><dt>Điểm</dt><dd><b>{selected.cell.score != null ? `${selected.cell.score} / ${selected.cell.maxScore}` : "—"}</b></dd></div>
              <div><dt>Trạng thái</dt><dd><span className={"badge " + (TONES[selected.cell.state] ?? "")}>{STATES[selected.cell.state] ?? selected.cell.state}</span></dd></div>
              <div><dt>Người giao bài</dt><dd>{selected.assignment.assignedBy || "—"}</dd></div>
              <div><dt>Người chấm</dt><dd>{selected.cell.gradedBy || (selected.cell.state === "AI_GRADED" ? "Hệ thống" : "—")}</dd></div>
              <div><dt>Ngày nộp</dt><dd>{time(selected.cell.completedAt)}</dd></div>
              <div><dt>Ngày chấm</dt><dd>{time(selected.cell.gradedAt)}</dd></div>
            </dl>
            <section><h3 className="dialog-sub">Nhận xét</h3><p className={"prose" + (selected.cell.feedback ? "" : " muted")}>{selected.cell.feedback || "Chưa có nhận xét."}</p></section>
            {selected.cell.submissionId && <GradeHistory key={selected.cell.submissionId} assignmentId={selected.assignment.id} submissionId={selected.cell.submissionId} canvas />}
          </div>}
          <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close className="btn btn-ghost">Đóng</Dialog.Close>
            {selected && onReviewSubmission && selected.cell.submissionId && <button type="button" className="btn btn-primary" onClick={() => { onReviewSubmission(selected.assignment.id, selected.student.id); setSelected(null); }}>Xem bài nộp và chấm</button>}</div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </div>;
}
