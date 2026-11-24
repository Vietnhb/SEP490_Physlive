import { useQueries } from "@tanstack/react-query";
import { useResource } from "../../../shared/hooks/operationsData";
import { apiKey, queryClient, sessionScope } from "../../../shared/api/queryClient";
import api from "../../../shared/api/client";
import { createRequestLimiter } from "../../../shared/api/requestLimiter";
import axios from "axios";

import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../../shared/ui/LearningIcon";
import { gradeAssignmentSubmission, reopenAssignmentSubmission } from "../../assignments/api/assignmentApi";
import type { Assignment, AssignmentSubmission, StudentOption } from "../../../shared/types/physlive";
import { TeacherAssignmentList } from "../../assignments/components/TeacherAssignmentList";
import { TeacherSubmissionTable } from "../../assignments/components/TeacherSubmissionTable";
import { TeacherSubmissionTableLoading } from "../../assignments/components/TeacherSubmissionTableLoading";
import type { AssignmentRecord, SubmissionFilter } from "../../assignments/model/teacherSubmissionTypes";
import { formatDate } from "../../assignments/model/teacherSubmissionUtils";
import "../styles/learning.css";
import "../styles/lab.css";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

const submissionsQueue = createRequestLimiter(4);

export default function Lab() {
  // "Xem và chấm bài nộp" on the assignment page links here with ?assignment=<id>.
  const [searchParams, setSearchParams] = useSearchParams();
  const [openedAt] = useState(Date.now);
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("all");
  const [studentQuery, setStudentQuery] = useState("");
  const assignmentsResource = useResource<Assignment[]>("/assignments/mine/teacher");
  const studentsResource = useResource<StudentOption[]>("/user/students");
  const assignments = useMemo(() => assignmentsResource.data ?? [], [assignmentsResource.data]);
  const students = useMemo(() => new Map((studentsResource.data ?? []).map(item => [item.id, item])), [studentsResource.data]);
  const loading = assignmentsResource.loading;
  const error = assignmentsResource.error || studentsResource.error || "";
  const scope = sessionScope();
  const submissions = useQueries({ queries: assignments.map(assignment => {
    const url = "/assignments/" + assignment.id + "/submissions";
    return { queryKey: apiKey(url), queryFn: ({ signal }: { signal: AbortSignal }) =>
      submissionsQueue(() => api.get<AssignmentSubmission[]>(url, { signal }).then(response => response.data), signal) };
  }) });
  const readable = submissions.map(result => axios.isAxiosError(result.error) && [401, 403, 404].includes(result.error.response?.status ?? 0) ? undefined : result.data);
  const records: AssignmentRecord[] = assignments.map((assignment, index) => ({ assignment, submissions: readable[index] ?? [] }));
  const loadedIds = new Set(assignments.filter((_, index) => readable[index] !== undefined).map(item => item.id));
  const failedIds = new Set(assignments.filter((_, index) => submissions[index]?.isError && readable[index] === undefined).map(item => item.id));
  const wanted = searchParams.get("assignment");
  const currentId = assignments.find(item => item.id === wanted)?.id ?? assignments[0]?.id ?? "";
  const selectAssignment = (id: string) => {
    if (id === currentId) return;
    const next = new URLSearchParams(searchParams);
    next.set("assignment", id);
    setSearchParams(next);
  };
  const retrySubmissions = () => { const index = assignments.findIndex(item => item.id === currentId); if (index >= 0) void submissions[index].refetch(); };

  const submissionsLoading = records.some(item => !loadedIds.has(item.assignment.id) && !failedIds.has(item.assignment.id));
  const selectedLoaded = loadedIds.has(currentId);
  const selectedFailed = failedIds.has(currentId);

  const selected = records.find((item) => item.assignment.id === currentId);
  const totals = (() => {
    const assigned = records.reduce(
      (total, item) => total + item.assignment.studentIds.length,
      0,
    );
    const submitted = records.reduce(
      (total, item) => total + item.submissions.filter(submission => submission.completedAt).length,
      0,
    );
    return { submitted, pending: Math.max(assigned - submitted, 0) };
  })();

  const selectedTotal = selected?.assignment.studentIds.length ?? 0;
  const selectedSubmitted = selected?.submissions.filter(submission => submission.completedAt).length ?? 0;
  const selectedOpen = selected?.assignment.status === "ACTIVE";
  const dueAt = selected?.assignment.dueAt;
  const overdue = selectedOpen && Date.parse(dueAt ?? "") < openedAt;
  const totalsAvailable = !loading && !assignmentsResource.error && !submissionsLoading && failedIds.size === 0;
  const filters: { value: SubmissionFilter; label: string; count: number }[] = [
    { value: "all", label: "Tất cả", count: selectedTotal },
    { value: "submitted", label: "Đã nộp", count: selectedSubmitted },
    { value: "pending", label: "Chưa nộp", count: Math.max(selectedTotal - selectedSubmitted, 0) },
  ];

  const updateSubmission = useCallback((assignmentId: string, updated: AssignmentSubmission) => {
    if (scope !== sessionScope()) return;
    queryClient.setQueryData<AssignmentSubmission[]>(["api", scope, "/assignments/" + assignmentId + "/submissions"], current => current?.map(item => item.id === updated.id ? updated : item));
  }, [scope]);

  const handleGrade = async (submissionId: string, score: number, feedback: string, reason?: string) => {
    const record = records.find(item => item.assignment.id === currentId);
    if (!record) return;
    const updated = await gradeAssignmentSubmission(record.assignment.id, submissionId, score, feedback, true, reason);
    updateSubmission(record.assignment.id, updated);
  };

  const handleReopen = async (submissionId: string, reason?: string) => {
    const record = records.find(item => item.assignment.id === currentId);
    if (!record) return;
    const updated = await reopenAssignmentSubmission(record.assignment.id, submissionId, reason);
    updateSubmission(record.assignment.id, updated);
  };

  return (
    <main className="lab-main">
      <div className="lab-container lab-assigned-page">
        <header className="lab-page-head">
          <h1>Bài tập đã giao</h1>
          <Link className="lab-new-assignment" to="/workspace/assignments/new"><Icon name="plus" />Giao bài mới</Link>
        </header>

        <dl className="lab-stat-row" aria-label="Tổng quan bài nộp">
          <div className="lab-stat">
            <dt><span className="lab-stat-icon"><Icon name="book" /></span>Bài đã giao</dt>
            <dd>{assignmentsResource.data ? records.length : "—"}</dd>
          </div>
          <div className="lab-stat lab-stat--success">
            <dt><span className="lab-stat-icon"><Icon name="check" /></span>Lượt đã nộp</dt>
            <dd>{totalsAvailable ? totals.submitted : "—"}</dd>
          </div>
          <div className="lab-stat lab-stat--warning">
            <dt><span className="lab-stat-icon"><Icon name="activity" /></span>Lượt chưa nộp</dt>
            <dd>{totalsAvailable ? totals.pending : "—"}</dd>
          </div>
        </dl>

        {error && <div className="lab-error" role="alert">{error}</div>}
        {failedIds.size > 0 && <p className="lab-totals-note" role="status">Một số bài nộp chưa tải được. Tổng lượt nộp sẽ hiển thị khi đủ dữ liệu.</p>}
        {loading && <CardLoadingSkeleton cards={3} label="Đang tải bài giao và bài nộp…" />}
        {!loading && !error && records.length === 0 && (
          <div className="lab-empty-card">
            <Icon name="message" />
            <h2>Chưa có bài giao để theo dõi</h2>
            <p>Bài nộp của học sinh sẽ xuất hiện tại đây sau khi giao bài.</p>
          </div>
        )}

        {selected && (
          <div className="lab-content-grid">
            <TeacherAssignmentList records={records} selectedId={currentId} onSelect={selectAssignment} loadedIds={loadedIds} failedIds={failedIds} />
            <section className="lab-submission-card" aria-label="Chi tiết bài nộp">
              <header className="lab-detail-header">
                <div className="lab-detail-heading">
                  <div className="lab-detail-meta">
                    <span className={`lab-state${overdue ? " lab-state--overdue" : selectedOpen ? " lab-state--open" : ""}`}>
                      {overdue ? "Quá hạn" : selectedOpen ? "Đang mở" : "Đã đóng"}
                    </span>
                    <span>{selected.assignment.className ?? "Nhóm học sinh riêng"}</span>
                    <span className="lab-detail-due"><Icon name="bell" />{dueAt ? `Hạn nộp ${formatDate(dueAt)}` : "Chưa đặt hạn"}</span>
                  </div>
                  <h2>{selected.assignment.title}</h2>
                </div>
                <div className="lab-progress-summary">
                  <p><strong>{selectedLoaded ? `${selectedSubmitted}/${selectedTotal}` : "—"}</strong><span>đã nộp</span></p>
                  {!selectedFailed && <progress
                    className="lab-progress-track"
                    aria-label="Tiến độ nộp bài"
                    max={selectedTotal || 1}
                    value={selectedLoaded ? selectedSubmitted : undefined}
                  />}
                </div>
              </header>

              <div className="lab-table-controls">
                <h3>Bài nộp của học sinh</h3>
                <div className="lab-table-toolbar">
                  <div className="lab-filter-group" role="group" aria-label="Lọc bài nộp">
                    {filters.map(({ value, label, count }) => (
                      <button type="button" key={value} aria-pressed={submissionFilter === value} onClick={() => setSubmissionFilter(value)}>
                        {label}
                        {(selectedLoaded || value === "all") && <span aria-hidden="true">{count}</span>}
                      </button>
                    ))}
                  </div>
                  <label className="lab-search">
                    <Icon name="search" />
                    <input type="search" aria-label="Tìm học sinh" value={studentQuery} onChange={event => setStudentQuery(event.target.value)} placeholder="Tìm học sinh" />
                  </label>
                </div>
              </div>

              {selectedFailed ? (
                <div className="lab-empty-state" role="alert">
                  <strong>Chưa tải được bài nộp của bài này</strong>
                  <button type="button" className="lab-grade-button" onClick={retrySubmissions}>Thử lại</button>
                </div>
              ) : !selectedLoaded ? (
                <TeacherSubmissionTableLoading />
              ) : (
                <TeacherSubmissionTable
                  key={currentId}
                  record={selected}
                  students={students}
                  filter={submissionFilter}
                  query={studentQuery}
                  onGrade={handleGrade}
                  onReopen={handleReopen}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
