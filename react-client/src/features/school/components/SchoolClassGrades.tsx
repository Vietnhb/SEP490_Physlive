import GradeHistory from "../../assignments/components/GradeHistory";
import { useResource } from "../../../shared/hooks/operationsData";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { Badge, Button, Dialog, Flex, Select, TextField, Tooltip } from "@radix-ui/themes";
import { DownloadIcon } from "@radix-ui/react-icons";
import { downloadClassGrades, type ClassGradebookPage, type GradeAssignment, type GradeCell, type GradeStudent } from "../api/classGradesApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import s from "./SchoolClassGrades.module.css";
import RefreshButton from "../../../shared/ui/RefreshButton";

const STATES: Record<string, string> = { MISSED_DEADLINE: "Quá hạn · Không nộp", NOT_ASSIGNED: "Không được giao", NOT_STARTED: "Chưa làm", IN_PROGRESS: "Đang làm", SUBMITTED: "Chưa chấm", RETURNED: "Trả làm lại", AI_GRADED: "Điểm tạm tính", TEACHER_CONFIRMED: "Đã xác nhận" };
const STATE_COLORS: Record<string, "gray" | "blue" | "amber" | "red" | "purple" | "green"> = { MISSED_DEADLINE: "red", NOT_STARTED: "gray", IN_PROGRESS: "blue", SUBMITTED: "amber", RETURNED: "red", AI_GRADED: "purple", TEACHER_CONFIRMED: "green" };
const time = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function SchoolClassGrades({ schoolId, classId, teacherMode = false, onReviewSubmission }: Readonly<{ schoolId?: string; classId: string; teacherMode?: boolean; onReviewSubmission?: (assignmentId: string, studentId: number) => void }>) {
  const [actionError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [membership, setMembership] = useState("CURRENT");
  const [assignmentId, setAssignmentId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [columns, setColumns] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<{ student: GradeStudent; assignment: GradeAssignment; cell: GradeCell } | null>(null);
  const studentQuery = useDebouncedValue(query), assignmentQuery = useDebouncedValue(title);
  const invalidDates = Boolean(from && to && from > to);
  useEffect(() => {
    if (!panel.current) return;
    let previous = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.max(1, Math.min(5, Math.floor(entry.contentRect.width * .74 / 180)));
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
  const base = teacherMode ? `/assignments/mine/teacher/classes/${classId}/grades` : `/schools/${schoolId}/classes/${classId}/grades`;
  const gradeResource = useResource<ClassGradebookPage>(base + "/page?" + params, columns > 0 && !invalidDates);
  const book = gradeResource.data;
  const assignments = book?.assignments ?? [], students = book?.students ?? [];
  const loading = gradeResource.loading || gradeResource.refreshing;
  const error = invalidDates ? "Từ ngày phải trước hoặc bằng đến ngày." : actionError || gradeResource.error || "";
  const load = () => { setError(""); return gradeResource.refresh(); };
  const resetPages = () => { setPage(0); setAssignmentPage(0); setSelected(null); };
  const clearFilters = () => { setQuery(""); setTitle(""); setMembership("CURRENT"); setAssignmentId("ALL"); setFrom(""); setTo(""); resetPages(); };
  const presetMonth = (offset: number) => {
    const vietnam = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const year = Number(vietnam.find(part => part.type === "year")!.value), month = Number(vietnam.find(part => part.type === "month")!.value) - 1 + offset;
    setFrom(new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10));
    setTo(new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)); setAssignmentId("ALL"); resetPages();
  };
  const assignedBy = [...new Set(assignments.map(item => item.assignedBy?.trim()).filter(Boolean))].join(", ");
  const currentPage = book?.studentPage ?? 0, pages = book?.studentPages ?? 1, shownPageSize = book?.studentSize ?? pageSize;
  const totalStudents = book?.totalStudents ?? 0, totalAssignments = book?.totalAssignments ?? 0;
  const currentAssignmentPage = book?.assignmentPage ?? 0, assignmentPages = book?.assignmentPages ?? 1;
  const exportCsv = async () => {
    if (!book || !schoolId || exporting) return;
    setExporting(true); setError(""); setNotice("");
    try { await downloadClassGrades(schoolId, classId, book.className); setNotice("Đã xuất toàn bộ bảng điểm của lớp, bao gồm lịch sử học sinh đã rời lớp."); }
    catch (err) { setError(apiMessage(err, "Không thể xuất bảng điểm.")); }
    finally { setExporting(false); }
  };
  return <section ref={panel} className={s.panel} aria-label="Bảng điểm lớp học">
    <Flex className={s.heading} justify="between" align="center" gap="3" wrap="wrap"><div><h2>Bảng điểm {book?.className}</h2><p>Năm học {book?.schoolYear ?? "…"} · {teacherMode ? "Chọn kết quả để xem bài nộp" : "Bảng điểm chỉ xem"}</p>{assignedBy && <p className={s.assignedBy}>Giáo viên giao bài: {assignedBy}</p>}</div><Flex gap="3"><RefreshButton onClick={() => void load()} disabled={loading || invalidDates} />{!teacherMode && <Button variant="soft" loading={exporting} disabled={!book || exporting} onClick={() => void exportCsv()}><DownloadIcon />Xuất toàn bộ CSV</Button>}</Flex></Flex>
    <div className={s.filters}>
      <label>Tìm bài tập<TextField.Root aria-label="Tìm bài tập trong bảng điểm" placeholder="Nhập tên bài tập…" value={title} onChange={event => { setTitle(event.target.value); setAssignmentId("ALL"); resetPages(); }} /></label>
      <label>Ngày giao từ<input type="date" aria-label="Ngày giao từ" value={from} onChange={event => { setFrom(event.target.value); setAssignmentId("ALL"); resetPages(); }} /></label>
      <label>Đến ngày<input type="date" aria-label="Ngày giao đến" value={to} onChange={event => { setTo(event.target.value); setAssignmentId("ALL"); resetPages(); }} /></label>
      <div className={s.presets}><Button size="1" variant="soft" onClick={() => presetMonth(0)}>Tháng này</Button><Button size="1" variant="soft" onClick={() => presetMonth(-1)}>Tháng trước</Button><Button size="1" variant="ghost" onClick={clearFilters}>Xóa bộ lọc</Button></div>
      <label>Tìm học sinh<TextField.Root aria-label="Tìm học sinh trong bảng điểm" placeholder="Tên hoặc email học sinh…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); setSelected(null); }} /></label>
      <label>Thành viên<Select.Root value={membership} onValueChange={value => { setMembership(value); setPage(0); setSelected(null); }}><Select.Trigger aria-label="Thành viên lớp" /><Select.Content><Select.Item value="ALL">Tất cả học sinh</Select.Item><Select.Item value="CURRENT">Đang học trong lớp</Select.Item><Select.Item value="FORMER">Đã rời lớp</Select.Item></Select.Content></Select.Root></label>
      <label className={s.assignmentChooser}>Xem riêng một bài<Select.Root value={assignmentId} onValueChange={value => { setAssignmentId(value); resetPages(); }}><Select.Trigger aria-label="Lọc bài tập" className={s.assignmentFilter} /><Select.Content position="popper" className={s.assignmentOptions}><Select.Item value="ALL">Tất cả bài phù hợp</Select.Item>{assignments.map(item => <Select.Item value={item.id} key={item.id}><span className={s.filterOption} title={item.title}>{item.title}</span></Select.Item>)}</Select.Content></Select.Root></label>
    </div>
    {error && <p role="alert" className="admin-error-banner">{error}</p>}{notice && <p role="status" className={s.success}>{notice}</p>}
    {assignmentId !== "ALL" && <p className={s.recipientHint}>Chỉ hiển thị học sinh được giao bài tập đã chọn, theo bộ lọc thành viên lớp.</p>}
    <div className={s.assignmentPager} role="group" aria-label="Phân trang bài tập"><span aria-live="polite">Bài tập <strong>{totalAssignments ? currentAssignmentPage * (book?.assignmentSize ?? 1) + 1 : 0}–{Math.min((currentAssignmentPage + 1) * (book?.assignmentSize ?? 1), totalAssignments)} / {totalAssignments}</strong></span><div><Button size="1" variant="outline" disabled={loading || invalidDates || currentAssignmentPage === 0} onClick={() => { setAssignmentPage(currentAssignmentPage - 1); setSelected(null); }}>Bài trước</Button><span>Trang bài {currentAssignmentPage + 1}/{assignmentPages}</span><Button size="1" variant="outline" disabled={loading || invalidDates || currentAssignmentPage + 1 >= assignmentPages} onClick={() => { setAssignmentPage(currentAssignmentPage + 1); setSelected(null); }}>Bài tiếp</Button></div></div>
    {loading && !book && !invalidDates ? <TableLoadingSkeleton headers={["Học sinh", "Bài tập", "Điểm"]} /> : !invalidDates && (!assignments.length ? <p className={s.empty}>Không có bài tập phù hợp. Thử đổi tên bài hoặc khoảng ngày giao.</p> : <div className={s.scroll} role="region" aria-label="Bảng điểm lớp học có phân trang" aria-busy={loading}><table><colgroup><col style={{ width: assignments.length === 1 ? "40%" : "26%" }} />{assignments.map(item => <col key={item.id} />)}</colgroup><thead><tr><th scope="col" className={s.studentColumn}>Học sinh</th>{assignments.map(item => <th key={item.id} scope="col"><Tooltip content={item.title}><strong className={s.assignmentTitle} tabIndex={0}>{item.title}</strong></Tooltip></th>)}</tr></thead><tbody>
      {students.map(student => <tr key={student.id}><th scope="row" className={s.studentColumn}><div className={s.studentIdentity}><span className={s.studentName} title={student.fullName}>{student.fullName}</span>{!student.current && <Badge className={s.formerBadge} color="gray">Đã rời lớp</Badge>}</div><small>{student.email}</small></th>{assignments.map(assignment => {
        const cell = student.cells.find(item => item.assignmentId === assignment.id);
        return <td key={assignment.id}>{!cell || cell.state === "NOT_ASSIGNED" ? <span className={s.notAssigned}>Không được giao</span> : <button type="button" className={s.gradeCell} data-state={cell.state} aria-label={`${student.fullName} - ${assignment.title}: ${cell.score != null ? cell.score + "/" + cell.maxScore : STATES[cell.state]}`} onClick={() => setSelected({ student, assignment, cell })}>
          {cell.score != null ? <><strong>{cell.score} / {cell.maxScore}</strong><small>{STATES[cell.state] ?? cell.state}</small></> : <span>{STATES[cell.state] ?? cell.state}</span>}
        </button>}</td>;
      })}</tr>)}{students.length === 0 && <tr><td colSpan={assignments.length + 1}>Không có học sinh phù hợp.</td></tr>}
    </tbody></table></div>)}
    {book && !invalidDates && <div className={s.studentPager}><span aria-live="polite">Hiển thị {totalStudents ? currentPage * shownPageSize + 1 : 0}–{Math.min((currentPage + 1) * shownPageSize, totalStudents)} / {totalStudents} học sinh</span><div><label className={s.pageSize}>Số học sinh/trang<Select.Root value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(0); setSelected(null); }}><Select.Trigger aria-label="Số học sinh mỗi trang trong bảng điểm" /><Select.Content>{[5, 10, 20, 50].map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content></Select.Root></label><Button size="1" variant="soft" disabled={loading || currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelected(null); }}>Trước</Button><span>Trang học sinh {currentPage + 1}/{pages}</span><Button size="1" variant="soft" disabled={loading || currentPage + 1 >= pages} onClick={() => { setPage(currentPage + 1); setSelected(null); }}>Sau</Button></div></div>}
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Content maxWidth="620px" className={modal.dialog}><div className={modal.body}><Dialog.Title>Chi tiết kết quả học tập</Dialog.Title><Dialog.Description>{selected?.student.fullName} · {selected?.assignment.title}</Dialog.Description>
      {selected && <><dl className={s.meta}><div><dt>Điểm</dt><dd>{selected.cell.score != null ? `${selected.cell.score} / ${selected.cell.maxScore}` : STATES[selected.cell.state]}</dd></div><div><dt>Trạng thái</dt><dd><Badge color={STATE_COLORS[selected.cell.state] ?? "gray"}>{STATES[selected.cell.state]}</Badge></dd></div><div><dt>Người giao bài</dt><dd>{selected.assignment.assignedBy}</dd></div><div><dt>Người chấm</dt><dd>{selected.cell.gradedBy || (selected.cell.state === "AI_GRADED" ? "Hệ thống" : "—")}</dd></div><div><dt>Ngày nộp</dt><dd>{time(selected.cell.completedAt)}</dd></div><div><dt>Ngày chấm</dt><dd>{time(selected.cell.gradedAt)}</dd></div></dl><h3>Nhận xét</h3><p className={s.feedback}>{selected.cell.feedback || "Chưa có nhận xét."}</p>{selected.cell.submissionId && <GradeHistory key={selected.cell.submissionId} assignmentId={selected.assignment.id} submissionId={selected.cell.submissionId} />}</>}
      {selected && onReviewSubmission && selected.cell.submissionId && <Button onClick={() => { onReviewSubmission(selected.assignment.id, selected.student.id); setSelected(null); }}>Xem bài nộp và chấm</Button>}<Dialog.Close><Button variant="soft">Đóng</Button></Dialog.Close>
    </div></Dialog.Content></Dialog.Root>
  </section>;
}
