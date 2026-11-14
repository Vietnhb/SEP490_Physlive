import GradeHistory from "../../assignments/components/GradeHistory";
import { useResource } from "../../../shared/hooks/operationsData";
import { useState } from "react";
import { Badge, Button, Dialog, Flex, Select, TextField } from "@radix-ui/themes";
import { DownloadIcon, ReloadIcon } from "@radix-ui/react-icons";
import { downloadClassGrades, type ClassGradebook, type GradeAssignment, type GradeCell, type GradeStudent } from "../api/classGradesApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import s from "./SchoolClassGrades.module.css";

const STATES: Record<string, string> = { NOT_ASSIGNED: "Không được giao", NOT_STARTED: "Chưa làm", IN_PROGRESS: "Đang làm", SUBMITTED: "Chưa chấm", RETURNED: "Trả làm lại", AI_GRADED: "AI đã chấm", TEACHER_CONFIRMED: "Đã xác nhận" };
const STATE_COLORS: Record<string, "gray" | "blue" | "amber" | "red" | "purple" | "green"> = {
  NOT_STARTED: "gray", IN_PROGRESS: "blue", SUBMITTED: "amber", RETURNED: "red", AI_GRADED: "purple", TEACHER_CONFIRMED: "green",
};
const time = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function SchoolClassGrades({ schoolId, classId }: Readonly<{ schoolId: string; classId: string }>) {
  const [actionError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState("CURRENT");
  const [assignmentId, setAssignmentId] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selection, setSelected] = useState<{ student: GradeStudent; assignment: GradeAssignment; cell: GradeCell } | null>(null);
  const gradeResource = useResource<ClassGradebook>(`/schools/${schoolId}/classes/${classId}/grades`, true);
  const book = gradeResource.data ?? null;
  const loading = gradeResource.loading;
  const error = actionError || gradeResource.error || "";
  const load = () => { setError(""); return gradeResource.refresh(); };
  const selectedStudent = book?.students.find(item => item.id === selection?.student.id);
  const selectedAssignment = book?.assignments.find(item => item.id === selection?.assignment.id);
  const selectedCell = selectedStudent?.cells.find(item => item.assignmentId === selectedAssignment?.id);
  const selected = selectedStudent && selectedAssignment && selectedCell ? { student: selectedStudent, assignment: selectedAssignment, cell: selectedCell } : null;
  const students = (book?.students ?? []).filter(item => (membership === "ALL" || item.current === (membership === "CURRENT"))
    && `${item.fullName} ${item.email}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const assignments = (book?.assignments ?? []).filter(item => assignmentId === "ALL" || item.id === assignmentId);
  const assignedBy = [...new Set(assignments.map(item => item.assignedBy?.trim()).filter(Boolean))].join(", ");
  const pages = Math.max(1, Math.ceil(students.length / 10)), currentPage = Math.min(page, pages);
  const exportCsv = async () => {
    if (!book || exporting) return;
    setExporting(true); setError(""); setNotice("");
    try { await downloadClassGrades(schoolId, classId, book.className); setNotice("Đã xuất toàn bộ bảng điểm của lớp, bao gồm lịch sử học sinh đã rời lớp."); }
    catch (err) { setError(apiMessage(err, "Không thể xuất bảng điểm.")); }
    finally { setExporting(false); }
  };
  return <section className={s.panel} aria-label="Bảng điểm lớp học">
    <Flex className={s.heading} justify="between" align="center" gap="3" wrap="wrap"><div><h2>Bảng điểm {book?.className}</h2><p>Năm học {book?.schoolYear ?? "…"} · Bảng điểm chỉ xem</p>{assignedBy && <p className={s.assignedBy}>Giáo viên giao bài: {assignedBy}</p>}</div><Flex gap="3"><Button variant="outline" disabled={loading} onClick={() => void load()}><ReloadIcon />Làm mới</Button><Button variant="soft" loading={exporting} disabled={!book?.assignments.length || exporting} onClick={() => void exportCsv()}><DownloadIcon />Xuất toàn bộ CSV</Button></Flex></Flex>
    {error && <p role="alert" className="admin-error-banner">{error}</p>}{notice && <p role="status" className={s.success}>{notice}</p>}
    <Flex gap="3" wrap="wrap" mb="4"><TextField.Root aria-label="Tìm học sinh trong bảng điểm" placeholder="Tìm tên hoặc email học sinh…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <Select.Root value={membership} onValueChange={value => { setMembership(value); setPage(1); }}><Select.Trigger aria-label="Thành viên lớp" /><Select.Content><Select.Item value="ALL">Tất cả học sinh</Select.Item><Select.Item value="CURRENT">Đang học trong lớp</Select.Item><Select.Item value="FORMER">Đã rời lớp</Select.Item></Select.Content></Select.Root>
      <Select.Root value={assignmentId} onValueChange={setAssignmentId}><Select.Trigger aria-label="Lọc bài tập" /><Select.Content><Select.Item value="ALL">Tất cả bài tập</Select.Item>{book?.assignments.map(item => <Select.Item value={item.id} key={item.id}>{item.title}</Select.Item>)}</Select.Content></Select.Root>
    </Flex>
    {loading && !book ? <TableLoadingSkeleton headers={["Học sinh", "Bài tập", "Điểm"]} /> : !book?.assignments.length ? <p className={s.empty}>Lớp chưa có bài tập được giao theo lớp để lập bảng điểm.</p> : <div className={s.scroll} tabIndex={0} aria-label="Bảng điểm có thể cuộn"><table><thead><tr><th className={s.studentColumn}>Học sinh</th>{assignments.map(item => <th key={item.id}><strong>{item.title}</strong></th>)}</tr></thead><tbody>
      {students.slice((currentPage - 1) * 10, currentPage * 10).map(student => <tr key={student.id}><th className={s.studentColumn}><div className={s.studentIdentity}><span className={s.studentName} title={student.fullName}>{student.fullName}</span>{!student.current && <Badge className={s.formerBadge} color="gray">Đã rời lớp</Badge>}</div><small>{student.email}</small></th>{assignments.map(assignment => {
        const cell = student.cells.find(item => item.assignmentId === assignment.id);
        return <td key={assignment.id}>{!cell || cell.state === "NOT_ASSIGNED" ? <span title="Học sinh không được giao bài này">—</span> : <button type="button" className={s.gradeCell} data-state={cell.state} aria-label={`${student.fullName} - ${assignment.title}: ${cell.score != null ? cell.score + "/" + cell.maxScore : STATES[cell.state]}`} onClick={() => setSelected({ student, assignment, cell })}>
          {cell.score != null ? <><strong>{cell.score} / {cell.maxScore}</strong><small>{STATES[cell.state] ?? cell.state}</small></> : <span>{STATES[cell.state] ?? cell.state}</span>}
        </button>}</td>;
      })}</tr>)}{students.length === 0 && <tr><td colSpan={assignments.length + 1}>Không có học sinh phù hợp.</td></tr>}
    </tbody></table></div>}
    {book && <Flex justify="between" align="center" mt="4" wrap="wrap" gap="3"><span>{students.length} học sinh · {assignments.length} bài tập</span><Flex gap="3" align="center"><Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button><span>Trang {currentPage}/{pages}</span><Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></Flex></Flex>}
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Content maxWidth="620px" className={modal.dialog}><div className={modal.body}><Dialog.Title>Chi tiết kết quả học tập</Dialog.Title><Dialog.Description>{selected?.student.fullName} · {selected?.assignment.title}</Dialog.Description>
      {selected && <><dl className={s.meta}><div><dt>Điểm</dt><dd>{selected.cell.score != null ? `${selected.cell.score} / ${selected.cell.maxScore}` : STATES[selected.cell.state]}</dd></div><div><dt>Trạng thái</dt><dd><Badge color={STATE_COLORS[selected.cell.state] ?? "gray"}>{STATES[selected.cell.state]}</Badge></dd></div><div><dt>Người giao bài</dt><dd>{selected.assignment.assignedBy}</dd></div><div><dt>Người chấm</dt><dd>{selected.cell.gradedBy || (selected.cell.state === "AI_GRADED" ? "AI tự động" : "—")}</dd></div><div><dt>Ngày nộp</dt><dd>{time(selected.cell.completedAt)}</dd></div><div><dt>Ngày chấm</dt><dd>{time(selected.cell.gradedAt)}</dd></div></dl><h3>Nhận xét</h3><p className={s.feedback}>{selected.cell.feedback || "Chưa có nhận xét."}</p>{selected.cell.submissionId && <GradeHistory key={selected.cell.submissionId} assignmentId={selected.assignment.id} submissionId={selected.cell.submissionId} />}</>}
      <Dialog.Close><Button variant="soft">Đóng</Button></Dialog.Close>
    </div></Dialog.Content></Dialog.Root>
  </section>;
}
