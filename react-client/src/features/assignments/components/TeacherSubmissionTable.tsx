import { useMemo, useRef, useState, type FormEvent } from "react";
import { Dialog, Tabs } from "radix-ui";
import type { AssignmentSubmission } from "../../../shared/types/physlive";
import type { SubmissionTableProps } from "../model/teacherSubmissionTypes";
import { formatDateTime, initials, predictionDetails } from "../model/teacherSubmissionUtils";
import GradeHistory from "./GradeHistory";
import { apiMessage } from "../../../shared/lib/apiError";

function gradingLabel(submission: AssignmentSubmission) {
  if (submission.gradingStatus === "RETURNED") return "Cần làm lại";
  if (!submission.completedAt) return "Đang làm";
  if (submission.gradingStatus === "TEACHER_CONFIRMED") return "Đã chấm";
  if (submission.gradingStatus === "AI_GRADED") return "Điểm tự động";
  return "Chờ chấm";
}

export function TeacherSubmissionTable({ record, students, filter, query, onGrade, onReopen }: Readonly<SubmissionTableProps>) {
  const [gradingId, setGradingId] = useState("");
  const [tab, setTab] = useState("work");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const maxScore = record.assignment.maxScore ?? 10;
  const canManage = record.assignment.canManage !== false;
  const selected = record.submissions.find(item => item.id === gradingId);
  const selectedName = selected?.studentName?.trim() || (selected && students.get(selected.studentId)?.fullName?.trim()) || "Học sinh";
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

  if (record.assignment.studentIds.length === 0) return <div className="lab-empty-state"><strong>Chưa có học sinh trong bài giao này</strong><span>Thêm học sinh ở khu giao bài để bắt đầu theo dõi.</span></div>;

  return <>
    {notice && <p className="lab-grade-success" role="status">{notice}</p>}
    <div className="modern-table-wrapper lab-submission-table-wrapper">
      <table className="modern-table lab-submission-table">
        <colgroup><col style={{ width: "22%" }} /><col style={{ width: "28%" }} /><col style={{ width: "18%" }} /><col style={{ width: "17%" }} /><col style={{ width: "15%" }} /></colgroup>
        <thead><tr><th scope="col">Học sinh</th><th scope="col">Kết luận / bài làm</th><th scope="col">Nộp lúc</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{rows.map(({ studentId, studentName, submission }) => {
          const details = predictionDetails(submission?.predictions);
          const text = (details.conclusion || details.answer).replace(/\s+/g, " ").trim();
          const preview = text.length > 160 ? text.slice(0, 160) + "…" : text;
          const completed = Boolean(submission?.completedAt);
          return <tr key={studentId}>
            <td data-label="Học sinh"><div className="lab-student-cell"><span className="lab-student-avatar" aria-hidden="true">{initials(studentName, studentId)}</span><span><strong title={studentName}>{studentName}</strong></span></div></td>
            <td data-label="Kết luận" className={submission ? "" : "lab-muted-cell"}>{submission ? <div className="lab-answer-preview"><small>{details.conclusion ? "Kết luận" : "Dự đoán"}</small><p>{preview}</p></div> : "Chưa bắt đầu"}</td>
            <td data-label="Nộp lúc">{submission?.completedAt ? <><time dateTime={submission.completedAt}>{formatDateTime(submission.completedAt)}</time>{record.assignment.dueAt && new Date(submission.completedAt).getTime() > new Date(record.assignment.dueAt).getTime() && <small className="lab-late-badge">Nộp muộn</small>}</> : "—"}</td>
            <td data-label="Trạng thái"><div className="lab-grade-status"><span className={`lab-status ${completed ? "submitted" : submission ? "progress" : "pending"}`}><span className="lab-status-dot" aria-hidden="true" />{submission ? gradingLabel(submission) : "Chưa bắt đầu"}</span>{completed && submission?.score != null && <strong>{submission.score}/{submission.maxScore ?? maxScore}</strong>}</div></td>
            <td data-label="Thao tác" className="lab-grade-action">{submission ? <div className="lab-row-actions">
              <button type="button" className="lab-grade-button" aria-haspopup="dialog" onClick={() => openGrading(submission)}>{canManage && completed ? submission.gradingStatus === "TEACHER_CONFIRMED" ? "Sửa điểm" : "Chấm bài" : "Xem bài"}</button>
              <button type="button" className="lab-history-button" aria-label="Lịch sử điểm" aria-haspopup="dialog" onClick={() => openGrading(submission, "history")}>Lịch sử</button>
            </div> : <span className="lab-muted-cell">—</span>}</td>
          </tr>;
        })}{rows.length === 0 && <tr><td colSpan={5} className="lab-muted-cell">Không có học sinh phù hợp với bộ lọc hiện tại.</td></tr>}</tbody>
      </table>
    </div>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open && !busy) setGradingId(""); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="lab-review-overlay" />
        <Dialog.Content className="lab-page lab-review-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}>
          <header className="lab-review-header"><div><Dialog.Title>Bài làm của {selectedName}</Dialog.Title><Dialog.Description>{record.assignment.title}</Dialog.Description></div><Dialog.Close className="lab-review-close" disabled={busy} aria-label="Đóng chi tiết bài làm">×</Dialog.Close></header>
          <Tabs.Root className="lab-review-tabs" value={tab} onValueChange={value => { if (!busy) setTab(value); }}>
            <Tabs.List className="lab-review-tab-list" aria-label="Nội dung bài nộp"><Tabs.Trigger value="work">Bài làm & chấm điểm</Tabs.Trigger><Tabs.Trigger value="history">Lịch sử điểm</Tabs.Trigger></Tabs.List>
            <Tabs.Content className="lab-review-body" value="work">
              {selected && <div className="lab-review-grid"><section className="lab-review-answer" aria-label="Nội dung bài làm đầy đủ">
                <h3>Nội dung bài làm</h3><p className="lab-review-submission-meta">{gradingLabel(selected)}{selected.completedAt ? " · Nộp lúc " + formatDateTime(selected.completedAt) : " · Học sinh chưa nộp bài"}</p>
                <dl><div><dt>Dự đoán / câu trả lời ban đầu</dt><dd>{selectedDetails.answer}</dd></div>
                  {selectedDetails.estimatedValue !== undefined && <div><dt>Giá trị đo</dt><dd>{selectedDetails.estimatedValue}</dd></div>}
                  <div><dt>Lập luận</dt><dd>{selectedDetails.reasoning || "Chưa có lập luận."}</dd></div><div><dt>Kết luận</dt><dd>{selectedDetails.conclusion || "Chưa có kết luận."}</dd></div></dl>
              </section>
                {canManage && selected.completedAt ? <form className="lab-grading-form" onSubmit={event => void submitGrade(event)}>
                  <div className="lab-grading-heading"><div><strong>Chấm điểm</strong><small>Thang điểm tối đa: {maxScore}</small></div></div>
                  <div className="lab-grading-fields"><label>Điểm<input type="number" min="0" max={maxScore} step="0.1" required disabled={busy} value={score} onChange={event => setScore(event.target.value)} /></label><label>Nhận xét<textarea rows={4} maxLength={4000} disabled={busy} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Nhận xét về bài làm của học sinh…" /></label></div>
                  <label className="lab-grade-reason">{selected.gradingStatus === "TEACHER_CONFIRMED" ? "Lý do thay đổi điểm / trả bài (bắt buộc)" : "Lý do / ghi chú (không bắt buộc)"}<textarea rows={2} maxLength={2000} disabled={busy} required={selected.gradingStatus === "TEACHER_CONFIRMED"} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nêu lý do để lưu trong lịch sử…" /></label>
                  {actionError && <p className="lab-grading-error" role="alert">{actionError}</p>}
                  {confirmReturn && <div className="lab-reopen-confirm"><p>Trả bài cho {selectedName} làm lại? Điểm và nhận xét trước đó được lưu trong lịch sử. Học sinh sẽ cần nộp lại bài.</p><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmReturn(false)}>Hủy trả bài</button><button type="button" className="lab-reopen-button" disabled={busy} onClick={() => void reopen()}>Xác nhận trả bài</button></div>}
                  <div className="lab-grading-actions">{record.assignment.status === "ACTIVE" && <button type="button" className="lab-reopen-button" disabled={busy} onClick={() => setConfirmReturn(true)}>Trả bài làm lại</button>}<button type="submit" className="prediction-submit-btn" disabled={busy}>{busy ? "Đang lưu…" : "Xác nhận điểm"}</button></div>
                </form> : <section className="lab-review-readonly"><h3>Kết quả chấm</h3><p>{!selected.completedAt ? "Học sinh chưa nộp bài nên chưa thể chấm điểm." : selected.score == null ? "Chưa có điểm." : `Điểm: ${selected.score}/${selected.maxScore ?? maxScore}`}</p>{selected.gradedByName && <p>Người chấm: {selected.gradedByName}</p>}<p>{selected.feedback || "Chưa có nhận xét."}</p></section>}
              </div>}
            </Tabs.Content>
            <Tabs.Content className="lab-review-body" value="history">{selected && <GradeHistory key={selected.id} assignmentId={record.assignment.id} submissionId={selected.id} />}</Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
