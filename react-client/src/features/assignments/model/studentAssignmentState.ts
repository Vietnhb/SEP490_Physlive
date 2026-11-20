import type { Assignment } from "../../../shared/types/physlive";
import { missedDeadline } from "./assignmentDeadline.ts";

export function studentAssignmentState(item: Assignment, now = Date.now()) {
  if (missedDeadline(item, now)) return { key: "expired", label: "Quá hạn · 0 điểm", color: "red", action: "Xem kết quả", actionable: false } as const;
  if (item.submissionCompleted && !item.retryAllowed) {
    if (item.gradingStatus === "TEACHER_CONFIRMED") return { key: "graded", label: "Đã chấm", color: "green", action: "Xem bài", actionable: false } as const;
    if (item.gradingStatus === "AI_GRADED") return { key: "provisional", label: "Điểm tạm tính", color: "purple", action: "Xem bài", actionable: false } as const;
    return { key: "submitted", label: "Chờ chấm", color: "cyan", action: "Xem bài", actionable: false } as const;
  }
  if (item.status === "CLOSED") return { key: "closed", label: "Đã đóng", color: "gray", action: "Xem bài", actionable: false } as const;
  if (item.retryAllowed) return { key: "returned", label: "Cần làm lại", color: "amber", action: "Làm lại", actionable: true } as const;
  if (item.dueAt && Date.parse(item.dueAt) <= now) return { key: "late", label: "Quá hạn · Được nộp trễ", color: "amber", action: "Nộp muộn", actionable: true } as const;
  if (item.predictionSubmitted) return { key: "started", label: "Đang làm", color: "indigo", action: "Tiếp tục", actionable: true } as const;
  return { key: "todo", label: "Chưa làm", color: "gray", action: "Làm bài", actionable: true } as const;
}

export function studentAssignmentSummary(items: Assignment[], now = Date.now()) {
  const states = items.map(item => studentAssignmentState(item, now));
  return {
    total: items.length,
    pending: states.filter(state => state.actionable).length,
    submitted: items.filter(item => item.submissionCompleted && !item.retryAllowed && !missedDeadline(item, now)).length,
    graded: states.filter(state => state.key === "graded").length,
    awaitingGrade: states.filter(state => state.key === "submitted" || state.key === "provisional").length,
    expired: states.filter(state => state.key === "expired").length,
    closed: states.filter(state => state.key === "closed").length,
  };
}

/** Returned work first, then approaching deadlines, allowed late work and work without a deadline. */
export function compareStudentWork(a: Assignment, b: Assignment, now: number) {
  const rank = (item: Assignment) => item.retryAllowed ? 0 : !item.dueAt ? 3 : Date.parse(item.dueAt) > now ? 1 : 2;
  const due = (item: Assignment) => item.dueAt ? Date.parse(item.dueAt) : Number.MAX_SAFE_INTEGER;
  return rank(a) - rank(b) || due(a) - due(b) || Date.parse(b.assignedAt) - Date.parse(a.assignedAt);
}
