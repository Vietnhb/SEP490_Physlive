import { saveFile } from "../../../shared/lib/saveFile";
import axiosClient from "../../../shared/api/client";
import type { Assignment, AssignmentSubmission, CreateAssignment, StudentOption, TeacherClassOption } from "../../../shared/types/physlive";
import { normalizeSimulation, type BackendSimulation } from "../../simulation/api/simulationApi";

/**
 * API endpoints for assignment management
 * Handles assignment creation, submission, and student management
 */

export const studentOptions = () => 
  axiosClient.get<StudentOption[]>("/user/students").then(r => r.data);

export const createAssignment = (request: CreateAssignment) => 
  axiosClient.post<Assignment>("/assignments", request).then(r => r.data);

export const teacherAssignments = () => 
  axiosClient.get<Assignment[]>("/assignments/mine/teacher").then(r => r.data);

export const teacherAssignmentClasses = () =>
  axiosClient.get<TeacherClassOption[]>("/assignments/mine/teacher/classes").then(r => r.data);

export const studentAssignments = () => 
  axiosClient.get<Assignment[]>("/assignments/mine/student").then(r => r.data);

export const assignedSimulation = (assignmentId: string) =>
  axiosClient.get<BackendSimulation>(`/assignments/${assignmentId}/simulation`).then(r => normalizeSimulation(r.data));

export const adjustAssignedSimulation = (
  assignmentId: string,
  simulationId: string,
  adjustableParams: Record<string, number>
) => axiosClient.post<BackendSimulation>(
  `/assignments/${assignmentId}/simulation/adjust`,
  { simulationId, adjustableParams },
  { timeout: 20000 }
).then(r => normalizeSimulation(r.data));

export const assignmentSubmissions = (assignmentId: string) => 
  axiosClient.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`).then(r => r.data);

export const gradeAssignmentSubmission = (assignmentId: string, submissionId: string, score: number, feedback: string, confirm = true, reason?: string) =>
  axiosClient.put<AssignmentSubmission>(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, { score, feedback, confirm, reason }).then(r => r.data);

export const reopenAssignmentSubmission = (assignmentId: string, submissionId: string, reason?: string) =>
  axiosClient.post<AssignmentSubmission>(`/assignments/${assignmentId}/submissions/${submissionId}/reopen`, { reason }).then(r => r.data);

/** Closing stops students from handing in; reopening accepts work again. */
export const setAssignmentOpen = (assignmentId: string, open: boolean) =>
  axiosClient.post<Assignment>(`/assignments/${assignmentId}/${open ? "open" : "close"}`).then(r => r.data);

export const submitAssignmentPrediction = (assignmentId: string, predictions: unknown) => 
  axiosClient.post<AssignmentSubmission>(
    `/assignments/${assignmentId}/predictions`, 
    { predictions }
  ).then(r => r.data);

export const completeAssignment = (assignmentId: string, request: { conclusion: string; answerText?: string; estimatedValue?: number }) =>
  axiosClient.post<AssignmentSubmission>(`/assignments/${assignmentId}/submit`, request).then(r => r.data);

export const logStudentAction = (assignmentId: string, action: string, payload?: unknown) =>
  axiosClient.post("/student/action-logs", { assignmentId, action, payload }).then(r => r.data);

export async function downloadAssignmentGrades(assignmentId: string, title: string) {
  const response = await axiosClient.get<Blob>("/assignments/" + assignmentId + "/grades.csv", { responseType: "blob" });
  const name = title.replaceAll(/[^\p{L}\p{N}._-]/gu, "-").slice(0, 80) || assignmentId;
  saveFile("diem-" + name + ".csv", response.data);
}
