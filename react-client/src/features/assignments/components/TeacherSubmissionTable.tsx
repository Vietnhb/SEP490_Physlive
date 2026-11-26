import StudentProfileDialog from "./StudentProfileDialog";
import profileStyles from "./StudentAvatar.module.css";
import StudentAvatar from "./StudentAvatar";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Dialog, Tabs } from "radix-ui";
import type { AssignmentSubmission } from "../../../shared/types/physlive";
import type { SubmissionTableProps } from "../model/teacherSubmissionTypes";
import { formatDateTime, predictionDetails } from "../model/teacherSubmissionUtils";
import GradeHistory from "./GradeHistory";
import { useStudioPortal } from "./useStudioPortal";
import { apiMessage } from "../../../shared/lib/apiError";

function gradingLabel(submission: AssignmentSubmission) {
  if (submission.gradingStatus === "MISSED_DEADLINE") return "Quá hạn · Không nộp";
  if (submission.gradingStatus === "RETURNED") return "Cần làm lại";
  if (!submission.completedAt) return "Đang làm";
  if (submission.gradingStatus === "TEACHER_CONFIRMED") return "Đã chấm";
  if (submission.gradingStatus === "AI_GRADED") return "Điểm tạm";
  return "Chờ chấm";
}

/** Status badge tone of the design canvas. */
function canvasTone(submission?: AssignmentSubmission) {
  if (!submission) return "";
  if (submission.gradingStatus === "MISSED_DEADLINE") return "b-danger";
  if (!submission.completedAt) return "b-info";
  if (submission.gradingStatus === "TEACHER_CONFIRMED") return "b-success";
  return "b-warn";
}

export function TeacherSubmissionTable({ record, students, filter, query, onGrade, onReopen, canvas = false }: Readonly<SubmissionTableProps & { canvas?: boolean }>) {
  const [gradingId, setGradingId] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [tab, setTab] = useState("work");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // a class can hold hundreds of students: the submissions come a page at a time, back to page 1 when the filter changes
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [pagedFor, setPagedFor] = useState(filter + "|" + query);
  if (pagedFor !== filter + "|" + query) { setPagedFor(filter + "|" + query); setPage(1); }
  const portal = useStudioPortal(anchor);
  const maxScore = record.assignment.maxScore ?? 10;
  const canManage = record.assignment.canManage !== false;
  const selected = record.submissions.find(item => item.id === gradingId);
  const selectedName = selected?.studentName?.trim() || (selected && students.get(selected.studentId)?.fullName?.trim()) || "Học sinh";
  // a measurement keeps the simulation's own value as the teacher's reference (no automatic score)
  const criteria = record.assignment.gradingCriteria as { expectedValue?: number; tolerance?: number; unit?: string } | null | undefined;
  const reference = typeof criteria?.expectedValue === "number"
    ? `${Number(criteria.expectedValue.toPrecision(6))}${criteria.unit ? " " + criteria.unit : ""}${criteria.tolerance ? ` (sai số cho phép ±${criteria.tolerance})` : ""}`
    : "";
  const selectedDetails = predictionDetails(selected?.predictions);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
    const submissionsByStudent = new Map(record.submissions.map(submission => [submission.studentId, submission]));
    return record.assignment.studentIds.map(studentId => {
      const submission = submissionsByStudent.get(studentId);
      const studentName = submission?.studentName?.trim() || students.get(studentId)?.fullName?.trim() || `Học sinh #${studentId}`;
      return { studentId, studentName, submission };
    }).filter(({ submission, studentName }) => (filter === "all" || (filter === "submitted" ? Boolean(submission?.completedAt) : !submission?.completedAt))
      && (!normalizedQuery || studentName.toLocaleLowerCase("vi-VN").includes(normalizedQuery)));
  }, [filter, query, record, students]);

  const openGrading = (submission: AssignmentSubmission, view = "work") => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGradingId(submission.id); setTab(view);
    setScore(submission.score == null ? "" : String(submission.score)); setFeedback(submission.feedback ?? "");
    setReason(""); setConfirmReturn(false); setNotice(""); setActionError("");
  };

  const submitGrade = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || busy) return;
    const numericScore = Number(score);
    if (!score.trim() || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore) {
      setActionError(`Điểm phải nằm trong khoảng 0 đến ${maxScore}.`); return;
    }
    setBusy(true); setActionError("");
    try {
      await onGrade(selected.id, numericScore, feedback.trim(), reason.trim() || undefined);
      setGradingId(""); setNotice("Đã lưu điểm và nhận xét. Thay đổi đã được ghi vào lịch sử.");
    } catch (error) { setActionError(apiMessage(error, "Chưa lưu được điểm. Vui lòng thử lại.")); }
    finally { setBusy(false); }
  };

  const reopen = async () => {
    if (!selected || busy) return;
    if (selected.gradingStatus === "TEACHER_CONFIRMED" && !reason.trim()) { setActionError("Vui lòng nhập lý do trả lại bài đã xác nhận điểm."); return; }
    setBusy(true); setActionError("");
    try {
      await onReopen(selected.id, reason.trim() || undefined);
      setGradingId(""); setConfirmReturn(false); setNotice(`Đã trả bài cho ${selectedName} làm lại. Điểm trước đó được giữ trong lịch sử.`);
    } catch (error) { setActionError(apiMessage(error, "Chưa thể trả bài cho học sinh làm lại.")); }
    finally { setBusy(false); }
  };

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);

  if (record.assignment.studentIds.length === 0) return <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 4 }}><b style={{ fontWeight: 500 }}>Chưa có học sinh trong bài giao này</b><span className="muted">Thêm học sinh ở khu giao bài để bắt đầu theo dõi.</span></div>;

  return <>
    {notice && <p className={canvas ? "muted" : "lab-grade-success"} role="status" style={canvas ? { margin: "0 20px 8px", color: "var(--success)" } : undefined}>{notice}</p>}
    {profileId != null && record.assignment.classId && <StudentProfileDialog classId={record.assignment.classId} userId={profileId} onClose={()=>setProfileId(null)} />}
    {canvas ? <><div className="table-scroll"><table className="table">
      <thead><tr><th scope="col">Học sinh</th><th scope="col">Kết luận / bài làm</th><th scope="col">Nộp lúc</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
      <tbody>{rows.slice((current - 1) * size, current * size).map(({ studentId, studentName, submission }) => {
        const details = predictionDetails(submission?.predictions);
        const text = (details.conclusion || details.answer).replace(/\s+/g, " ").trim();
        const completed = Boolean(submission?.completedAt);
        const missed = submission?.gradingStatus === "MISSED_DEADLINE";
        const late = submission?.completedAt && record.assignment.dueAt && new Date(submission.completedAt).getTime() > new Date(record.assignment.dueAt).getTime();
        const grade = canManage && completed && submission?.gradingStatus !== "TEACHER_CONFIRMED";
        return <tr key={studentId}>
          <th scope="row" style={{ whiteSpace: "normal", minWidth: 140, lineHeight: 1.35 }}><button type="button" className="link" style={{ font: "inherit", fontWeight: 500, color: "var(--text)", background: "none", border: 0, padding: 0, textAlign: "left", cursor: record.assignment.classId ? "pointer" : "default" }} disabled={!record.assignment.classId} aria-label={"Xem hồ sơ " + studentName} onClick={() => setProfileId(studentId)}>{studentName}</button></th>
          <td className={text && !missed ? "" : "muted"} style={{ minWidth: 160, maxWidth: 260, whiteSpace: "normal", lineHeight: 1.45, paddingTop: 10, paddingBottom: 10 }}>{missed ? "Không nộp trước hạn" : submission ? (text.length > 90 ? text.slice(0, 90) + "…" : text || "—") : "Chưa bắt đầu"}</td>
          <td className="muted" style={{ whiteSpace: "normal", minWidth: 92, lineHeight: 1.4 }}>{submission?.completedAt ? <>{formatDateTime(submission.completedAt)}{late && <><br /><span className="badge b-warn">Nộp muộn</span></>}</> : "—"}</td>
          <td><span className={"badge " + canvasTone(submission)}>{submission ? gradingLabel(submission) : "Chưa bắt đầu"}</span>{(completed || missed) && submission?.score != null && <b style={{ marginLeft: 8, fontWeight: 500 }}>{submission.score}/{submission.maxScore ?? maxScore}</b>}</td>
          <td className="num">{submission && !missed ? <span className="actions" style={{ justifyContent: "flex-end", gap: 6 }}>
            <button type="button" className={"btn btn-sm" + (grade ? " btn-primary" : "")} aria-haspopup="dialog" onClick={() => openGrading(submission)}>{canManage && completed ? submission.gradingStatus === "TEACHER_CONFIRMED" ? "Sửa điểm" : "Chấm bài" : "Xem bài"}</button>
          </span> : <span className="muted">—</span>}</td>
        </tr>;
      })}{rows.length === 0 && <tr><td colSpan={5} className="muted">Không có học sinh phù hợp với bộ lọc hiện tại.</td></tr>}</tbody>
    </table></div>
      {rows.length > 0 && <div className="pager"><span aria-live="polite">Hiển thị {(current - 1) * size + 1}–{Math.min(current * size, rows.length)} / {rows.length} học sinh</span>
        <span className="actions" style={{ gap: 8, alignItems: "center" }}><label className="pager-size">Số dòng <select className="input" style={{ width: 72 }} aria-label="Số học sinh mỗi trang" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <button type="button" className="btn btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>}</> : <div className="modern-table-wrapper lab-submission-table-wrapper">
      <table className="modern-table lab-submission-table">
        <colgroup><col style={{ width: "22%" }} /><col style={{ width: "28%" }} /><col style={{ width: "18%" }} /><col style={{ width: "17%" }} /><col style={{ width: "15%" }} /></colgroup>
        <thead><tr><th scope="col">Học sinh</th><th scope="col">Kết luận / bài làm</th><th scope="col">Nộp lúc</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{rows.map(({ studentId, studentName, submission }) => {
          const details = predictionDetails(submission?.predictions);
          const text = (details.conclusion || details.answer).replace(/\s+/g, " ").trim();
          const preview = text.length > 160 ? text.slice(0, 160) + "…" : text;
          const completed = Boolean(submission?.completedAt);
          const missed = submission?.gradingStatus === "MISSED_DEADLINE";
          const tone = !submission ? "waiting" : missed ? "pending" : !completed ? "progress"
            : submission.gradingStatus === "TEACHER_CONFIRMED" ? "submitted" : "pending";
          return <tr key={studentId}>
            <td data-label="Học sinh"><button type="button" className={"lab-student-cell " + profileStyles.profileButton} disabled={!record.assignment.classId} aria-label={"Xem hồ sơ " + studentName} onClick={()=>setProfileId(studentId)}><StudentAvatar src={submission?.studentAvatarUrl || students.get(studentId)?.avatarUrl} /><span><strong title={studentName}>{studentName}</strong></span></button></td>
            <td data-label="Kết luận" className={submission ? "" : "lab-muted-cell"}>{missed ? "Không nộp trước hạn" : submission ? <div className="lab-answer-preview"><small>{details.conclusion ? "Kết luận" : "Dự đoán"}</small><p>{preview}</p></div> : "Chưa bắt đầu"}</td>
            <td data-label="Nộp lúc">{submission?.completedAt ? <><time dateTime={submission.completedAt}>{formatDateTime(submission.completedAt)}</time>{record.assignment.dueAt && new Date(submission.completedAt).getTime() > new Date(record.assignment.dueAt).getTime() && <small className="lab-late-badge">Nộp muộn</small>}</> : "—"}</td>
            <td data-label="Trạng thái"><div className="lab-grade-status"><span className={`lab-status ${tone}`}><span className="lab-status-dot" aria-hidden="true" />{submission ? gradingLabel(submission) : "Chưa bắt đầu"}</span>{(completed || missed) && submission?.score != null && <strong>{submission.score}/{submission.maxScore ?? maxScore}</strong>}</div></td>
            <td data-label="Thao tác" className="lab-grade-action">{submission && !missed ? <div className="lab-row-actions">
              <button type="button" className="lab-grade-button" aria-haspopup="dialog" onClick={() => openGrading(submission)}>{canManage && completed ? submission.gradingStatus === "TEACHER_CONFIRMED" ? "Sửa điểm" : "Chấm bài" : "Xem bài"}</button>
              <button type="button" className="lab-history-button" aria-label="Lịch sử điểm" aria-haspopup="dialog" onClick={() => openGrading(submission, "history")}>Lịch sử</button>
            </div> : <span className="lab-muted-cell">—</span>}</td>
          </tr>;
        })}{rows.length === 0 && <tr><td colSpan={5} className="lab-muted-cell">Không có học sinh phù hợp với bộ lọc hiện tại.</td></tr>}</tbody>
      </table>
    </div>}
    <span ref={setAnchor} hidden />
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open && !busy) setGradingId(""); }}>
      <Dialog.Portal container={portal.isConnected ? portal : undefined}>
        <Dialog.Overlay className="scrim is-fixed" />
        <Dialog.Content className="dialog is-fixed grade-dialog" aria-describedby={undefined} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}
          onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}>
          <div className="card-h" style={{ alignItems: "flex-start" }}><div style={{ minWidth: 0 }}><Dialog.Title className="h2">Bài làm của {selectedName}</Dialog.Title>
            <p className="muted clamp-1" style={{ margin: "2px 0 0", fontSize: 13 }} title={record.assignment.title}>{record.assignment.title}</p></div>
            <Dialog.Close className="btn btn-sm btn-ghost" disabled={busy} aria-label="Đóng chi tiết bài làm"><svg className="icon" aria-hidden="true"><use href="#i-x" /></svg></Dialog.Close></div>
          <Tabs.Root value={tab} onValueChange={value => { if (!busy) setTab(value); }} className="grade-tabs">
            <Tabs.List className="tabs" aria-label="Nội dung bài nộp" style={{ padding: "0 20px" }}><Tabs.Trigger value="work">Bài làm & chấm điểm</Tabs.Trigger><Tabs.Trigger value="history">Lịch sử điểm</Tabs.Trigger></Tabs.List>
            <Tabs.Content value="work" className="card-b dialog-scroll">
              {selected && <div className="grade-grid">
                <section className="grade-answer" aria-label="Nội dung bài làm đầy đủ">
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className={"badge " + canvasTone(selected)}>{gradingLabel(selected)}</span>
                    <small className="muted">{selected.completedAt ? "Nộp lúc " + formatDateTime(selected.completedAt) : "Học sinh chưa nộp bài"}</small></span>
                  <dl className="grade-facts">
                    <div><dt>Dự đoán / câu trả lời ban đầu</dt><dd>{selectedDetails.answer || "—"}</dd></div>
                    {selectedDetails.estimatedValue !== undefined && <div><dt>Giá trị đo</dt><dd>{selectedDetails.estimatedValue}</dd></div>}
                    {reference && <div><dt>Giá trị đúng từ mô phỏng</dt><dd>{reference}</dd></div>}
                    <div><dt>Lập luận</dt><dd className={selectedDetails.reasoning ? "" : "muted"}>{selectedDetails.reasoning || "Chưa có lập luận."}</dd></div>
                    <div><dt>Kết luận</dt><dd className={selectedDetails.conclusion ? "" : "muted"}>{selectedDetails.conclusion || "Chưa có kết luận."}</dd></div>
                  </dl>
                </section>
                {canManage && selected.completedAt ? <form className="grade-form" onSubmit={event => void submitGrade(event)}>
                  <div><b style={{ fontWeight: 600 }}>Chấm điểm</b><small className="muted" style={{ display: "block" }}>Thang điểm tối đa: {maxScore}</small></div>
                  <label className="field"><span>Điểm</span><input className="input" type="number" min="0" max={maxScore} step="0.1" required disabled={busy} value={score} onChange={event => setScore(event.target.value)} /></label>
                  <label className="field"><span>Nhận xét</span><textarea className="input" rows={4} maxLength={4000} disabled={busy} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Nhận xét về bài làm của học sinh…" /></label>
                  <label className="field"><span>{selected.gradingStatus === "TEACHER_CONFIRMED" ? "Lý do thay đổi điểm / trả bài (bắt buộc)" : "Lý do / ghi chú (không bắt buộc)"}</span>
                    <textarea className="input" rows={2} maxLength={2000} disabled={busy} required={selected.gradingStatus === "TEACHER_CONFIRMED"} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nêu lý do để lưu trong lịch sử…" /></label>
                  {actionError && <p className="badge b-danger" role="alert" style={{ margin: 0, whiteSpace: "normal" }}>{actionError}</p>}
                  {confirmReturn ? <div className="grade-confirm" role="group" aria-label="Xác nhận trả bài"><p>Trả bài cho {selectedName} làm lại? Điểm và nhận xét trước đó được lưu trong lịch sử; học sinh sẽ cần nộp lại.</p>
                    <span className="actions" style={{ gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setConfirmReturn(false)}>Hủy</button><button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => void reopen()}>Xác nhận trả bài</button></span></div>
                    : <div className="actions" style={{ gap: 8, justifyContent: "space-between" }}>{record.assignment.status === "ACTIVE" ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirmReturn(true)}>Trả bài làm lại</button> : <span />}
                      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Xác nhận điểm"}</button></div>}
                </form> : <section className="grade-form" aria-label="Kết quả chấm"><b style={{ fontWeight: 600 }}>Kết quả chấm</b>
                  <p style={{ margin: 0 }}>{!selected.completedAt ? "Học sinh chưa nộp bài nên chưa thể chấm điểm." : selected.score == null ? "Chưa có điểm." : `Điểm: ${selected.score}/${selected.maxScore ?? maxScore}`}</p>
                  {selected.gradedByName && <small className="muted">Người chấm: {selected.gradedByName}</small>}<p className="prose" style={{ margin: 0 }}>{selected.feedback || "Chưa có nhận xét."}</p></section>}
              </div>}
            </Tabs.Content>
            <Tabs.Content value="history" className="card-b dialog-scroll">{selected && <GradeHistory key={selected.id} assignmentId={record.assignment.id} submissionId={selected.id} canvas />}</Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
