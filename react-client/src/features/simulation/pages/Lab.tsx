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
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(() => searchParams.get("assignment") ?? "");
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
  const currentId = assignments.some(item => item.id === selectedId) ? selectedId : assignments.find(item => item.id === wanted)?.id ?? assignments[0]?.id ?? "";
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
    return { assigned, submitted, pending: Math.max(assigned - submitted, 0) };
  })();

  const selectedTotal = selected?.assignment.studentIds.length ?? 0;
  const selectedSubmitted = selected?.submissions.filter(submission => submission.completedAt).length ?? 0;
  const selectedProgress =
    selectedTotal === 0
      ? 0
      : Math.round((selectedSubmitted / selectedTotal) * 100);

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
    <>
      <main className="lab-main">
        <div className="lab-container">
          <section className="lab-summary-strip" aria-label="Tổng quan bài nộp">
            <span className="lab-summary-label">Tổng quan</span>
            <div className="lab-summary-items">
              <div className="lab-summary-item">
                <strong>{records.length}</strong>
                <span>Bài đã giao</span>
              </div>
              <div className="lab-summary-item">
                <strong className="lab-summary-success">
                  {submissionsLoading ? "—" : totals.submitted}
                </strong>
                <span>Đã nộp</span>
              </div>
              <div className="lab-summary-item">
                <strong className="lab-summary-warning">
                  {submissionsLoading ? "—" : totals.pending}
                </strong>
                <span>Chưa nộp</span>
              </div>
            </div>
          </section>

          {error && (
            <div className="lab-error" role="alert">
              {error}
            </div>
          )}
          {loading && records.length === 0 && <CardLoadingSkeleton cards={3} label="Đang tải bài giao và bài nộp…" />}
          {!loading && !error && records.length === 0 && (
            <div className="lab-empty-card">
              <Icon name="message" />
              <h2>Chưa có bài giao để theo dõi</h2>
              <p>
                Hãy giao một bài tập trước. Bài nộp của học sinh sẽ xuất hiện
                tại đây.
              </p>
              <Link to="/assignments/workspace">
                Đi tới khu giao bài <Icon name="arrow" />
              </Link>
            </div>
          )}

          {records.length > 0 && (
            <div className="lab-content-grid">
              <TeacherAssignmentList
                records={records}
                selectedId={currentId}
                onSelect={setSelectedId}
                loadedIds={loadedIds}
              />
              <section
                className="lab-submission-card"
                aria-label="Chi tiết bài nộp"
              >
                {selected ? (
                  <>
                    <div className="lab-detail-header">
                      <div>
                        <h2>{selected.assignment.title}</h2>
                        <p className="lab-detail-meta">
                          Hạn nộp: {formatDate(selected.assignment.dueAt)}
                        </p>
                      </div>
                      <div className="lab-progress-summary">
                        <strong>
                          {selectedLoaded
                            ? `${selectedSubmitted} / ${selectedTotal}`
                            : "—"}
                        </strong>
                        <span>đã nộp</span>
                      </div>
                    </div>
                    <div
                      className="lab-progress-track"
                      role="progressbar"
                      aria-label="Tiến độ nộp bài"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={selectedProgress}
                    >
                      <span style={{ width: `${selectedProgress}%` }} />
                    </div>

                    <div className="lab-table-toolbar">
                      <div
                        className="lab-filter-group"
                        role="group"
                        aria-label="Lọc bài nộp"
                      >
                        <button
                          type="button"
                          className={submissionFilter === "all" ? "active" : ""}
                          aria-pressed={submissionFilter === "all"}
                          onClick={() => setSubmissionFilter("all")}
                        >
                          Tất cả
                        </button>
                        <button
                          type="button"
                          className={
                            submissionFilter === "submitted" ? "active" : ""
                          }
                          aria-pressed={submissionFilter === "submitted"}
                          onClick={() => setSubmissionFilter("submitted")}
                        >
                          Đã nộp
                        </button>
                        <button
                          type="button"
                          className={
                            submissionFilter === "pending" ? "active" : ""
                          }
                          aria-pressed={submissionFilter === "pending"}
                          onClick={() => setSubmissionFilter("pending")}
                        >
                          Chưa nộp
                        </button>
                      </div>
                      <label className="lab-search">
                        <span>Tìm học sinh</span>
                        <input
                          value={studentQuery}
                          onChange={(event) =>
                            setStudentQuery(event.target.value)
                          }
                          placeholder="Nhập tên học sinh"
                        />
                      </label>
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
                        record={selected}
                        students={students}
                        filter={submissionFilter}
                        query={studentQuery}
                        onGrade={handleGrade}
                        onReopen={handleReopen}
                      />
                    )}
                  </>
                ) : (
                  <div className="lab-empty-state">
                    Chọn một bài tập để xem bài nộp.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
