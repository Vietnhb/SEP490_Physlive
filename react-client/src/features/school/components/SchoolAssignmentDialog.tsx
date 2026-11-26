import { useState } from "react";
import { Dialog } from "radix-ui";
import { useResource } from "../../../shared/hooks/operationsData";

type Student = {
  id: number; fullName: string; email: string; avatarUrl: string | null;
  startedAt: string | null; completedAt: string | null; gradingStatus: string | null; score: number | null; maxScore: number | null;
};
type Detail = {
  id: string; title: string; description: string | null; classId: string | null; className: string | null; schoolYear: string | null;
  teacherId: number; teacherName: string; teacherEmail: string; status: string; assignedAt: string; dueAt: string | null;
  allowLateSubmission: boolean; maxScore: number; questionCount: number; students: Student[];
};
type Filter = "ALL" | "DONE" | "WAITING" | "OPEN";

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
const when = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
const plain = (value: string) => value.normalize("NFD").replaceAll(/[̀-ͯ]/g, "").toLocaleLowerCase("vi");
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** Where a student is on the assignment, in the words the teacher's own table uses. */
function progress(student: Student) {
  if (!student.startedAt) return { label: "Chưa bắt đầu", tone: "", group: "OPEN" as const };
  if (!student.completedAt) return student.gradingStatus === "MISSED_DEADLINE"
    ? { label: "Quá hạn", tone: "b-danger", group: "OPEN" as const } : { label: "Đang làm", tone: "b-info", group: "OPEN" as const };
  switch (student.gradingStatus) {
    case "TEACHER_CONFIRMED": return { label: "Đã chấm", tone: "b-success", group: "DONE" as const };
    case "RETURNED": return { label: "Trả lại làm lại", tone: "b-warn", group: "OPEN" as const };
    case "AI_GRADED": return { label: "Điểm chưa xác nhận", tone: "b-warn", group: "WAITING" as const };
    case "MISSED_DEADLINE": return { label: "Quá hạn", tone: "b-danger", group: "OPEN" as const };
    default: return { label: "Chờ chấm", tone: "b-warn", group: "WAITING" as const };
  }
}

/**
 * An assignment of the school, opened by the department head: what the teacher set, for which class, and how far each
 * student got. Read-only — answers and grading stay with the teacher in charge.
 */
export default function SchoolAssignmentDialog({ schoolId, assignmentId, portal, onClose }: Readonly<{ schoolId: string; assignmentId: string; portal: HTMLElement; onClose: () => void }>) {
  const resource = useResource<Detail>(`/schools/${schoolId}/assignments/${assignmentId}`);
  const detail = resource.data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(1);
  const size = 10;
  const students = detail?.students ?? [];
  const completed = students.filter(student => student.completedAt);
  const graded = students.filter(student => student.completedAt && student.gradingStatus === "TEACHER_CONFIRMED" && student.score != null);
  const average = graded.length ? graded.reduce((sum, student) => sum + 10 * (student.score ?? 0) / (student.maxScore || detail?.maxScore || 10), 0) / graded.length : null;
  const counts = { ALL: students.length, DONE: graded.length, WAITING: students.filter(student => progress(student).group === "WAITING").length, OPEN: students.filter(student => progress(student).group === "OPEN").length };
  const visible = students.filter(student => (filter === "ALL" || progress(student).group === filter) && plain(student.fullName + " " + student.email).includes(plain(query.trim())));
  const pages = Math.max(1, Math.ceil(visible.length / size));
  const current = Math.min(page, pages);
  const late = (student: Student) => Boolean(detail?.dueAt && student.completedAt && Date.parse(student.completedAt) > Date.parse(detail.dueAt));

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal container={portal}><Dialog.Overlay className="scrim is-fixed" />
      <Dialog.Content className="dialog is-fixed school-assignment-dialog" aria-describedby={undefined}>
        <div className="card-h" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <Dialog.Title className="h2 clamp-2" title={detail?.title}>{detail?.title ?? "Đang tải bài tập…"}</Dialog.Title>
            {detail && <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>{detail.teacherName} · {detail.className ? `${detail.className}${detail.schoolYear ? ` (${detail.schoolYear})` : ""}` : "Giao trực tiếp"}</p>}
          </div>
          {detail && <span className={"badge " + (detail.status === "ACTIVE" ? "b-success" : "")} style={{ flex: "none" }}>{detail.status === "ACTIVE" ? "Đang giao" : "Đã đóng"}</span>}
          <Dialog.Close className="btn btn-sm btn-ghost" aria-label="Đóng">{icon("x")}</Dialog.Close>
        </div>
        <div className="card-b dialog-scroll">
          {resource.error && <div className="badge b-danger" role="alert" style={{ alignSelf: "flex-start", whiteSpace: "normal" }}>{resource.error} <button type="button" className="btn btn-sm" onClick={() => void resource.refresh()}>Thử lại</button></div>}
          {resource.loading ? <div role="status" aria-label="Đang tải bài tập" style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="sk" style={{ width: "60%", height: 14 }} /><span className="sk" style={{ width: "90%", height: 60 }} /><span className="sk" style={{ width: "80%", height: 12 }} /></div>
            : detail && <>
              <dl className="kv assignment-kv">
                <div><small>Đã giao</small><b>{students.length}</b></div>
                <div><small>Đã nộp</small><b>{completed.length}<span className="muted"> / {students.length}</span></b></div>
                <div><small>Đã chấm</small><b>{graded.length}</b></div>
                <div><small>Điểm trung bình</small><b>{average == null ? "—" : number(average)}<span className="muted"> /10</span></b></div>
              </dl>
              <dl className="assignment-facts">
                <dt>Giao lúc</dt><dd>{when(detail.assignedAt)}</dd>
                <dt>Hạn nộp</dt><dd>{when(detail.dueAt) ?? "Không giới hạn"}{detail.dueAt && <span className="muted"> · {detail.allowLateSubmission ? "cho nộp muộn" : "không nhận bài muộn"}</span>}</dd>
                <dt>Bài làm</dt><dd>{detail.questionCount ? `${detail.questionCount} câu hỏi` : "Thí nghiệm, không có câu hỏi"} · thang điểm {number(detail.maxScore)}</dd>
                <dt>Giáo viên</dt><dd>{detail.teacherName} <span className="muted">· {detail.teacherEmail}</span></dd>
              </dl>
              {detail.description?.trim() && <div><p className="dialog-sub">Yêu cầu của giáo viên</p><p className="prose" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detail.description}</p></div>}
              <div>
                <p className="dialog-sub">Học sinh</p>
                <div className="toolbar" style={{ padding: 0, border: 0, marginBottom: 10 }}>
                  <label className="search"><span className="sr">Tìm học sinh</span>{icon("search")}<input className="input" type="search" placeholder="Tìm theo tên hoặc email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
                  <div className="seg" role="group" aria-label="Lọc theo tiến độ">{([["ALL", "Tất cả"], ["WAITING", "Chờ chấm"], ["DONE", "Đã chấm"], ["OPEN", "Chưa nộp"]] as const).map(([value, label]) =>
                    <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{label} <span className="muted">{counts[value]}</span></button>)}</div>
                </div>
                {!students.length ? <p className="muted" style={{ margin: 0 }}>Bài chưa giao cho học sinh nào.</p>
                  : !visible.length ? <p className="muted" style={{ margin: 0 }}>Không có học sinh phù hợp.</p>
                  : <div className="table-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10 }}><table className="table">
                    <thead><tr><th scope="col">Học sinh</th><th scope="col">Tiến độ</th><th scope="col">Nộp lúc</th><th scope="col" className="num">Điểm</th></tr></thead>
                    <tbody>{visible.slice((current - 1) * size, current * size).map(student => {
                      const state = progress(student);
                      return <tr key={student.id}>
                        <th scope="row"><span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          {student.avatarUrl ? <img className="avatar" src={student.avatarUrl} alt="" loading="lazy" style={{ width: 28, height: 28, objectFit: "cover" }} /> : <span className="avatar r-student" aria-hidden="true">{initials(student.fullName)}</span>}
                          <span className="row-sub" style={{ minWidth: 0 }}><span className="clamp-1">{student.fullName}</span><small className="clamp-1">{student.email}</small></span></span></th>
                        <td><span className={"badge " + state.tone}>{state.label}</span>{late(student) && <span className="badge b-warn" style={{ marginLeft: 6 }}>Nộp muộn</span>}</td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{when(student.completedAt) ?? "—"}</td>
                        <td className="num">{student.score != null && student.completedAt ? <b style={{ fontWeight: 500 }}>{number(student.score)}<span className="muted">/{number(student.maxScore ?? detail.maxScore)}</span></b> : <span className="muted">—</span>}</td>
                      </tr>;
                    })}</tbody>
                  </table></div>}
                {visible.length > size && <div className="pager" style={{ padding: "10px 0 0" }}><span>Hiển thị {(current - 1) * size + 1}–{Math.min(current * size, visible.length)} / {visible.length} học sinh</span>
                  <span className="actions" style={{ gap: 8, alignItems: "center" }}><button type="button" className="btn btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>{icon("lock")} Bài làm và việc chấm điểm do giáo viên phụ trách thực hiện; tổ trưởng chỉ theo dõi tiến độ.</p>
            </>}
        </div>
        <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost" disabled={resource.refreshing || resource.loading} onClick={() => void resource.refresh()}>{icon("refresh")}Làm mới</button>
          <Dialog.Close className="btn btn-primary">Đóng</Dialog.Close></div>
      </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
