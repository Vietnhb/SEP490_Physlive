import type { Assignment } from "../../../shared/types/physlive";

export function deadlineClosed(item: Pick<Assignment, "dueAt" | "allowLateSubmission">, now = Date.now()) {
  return item.allowLateSubmission === false && Boolean(item.dueAt) && new Date(item.dueAt!).getTime() <= now;
}
export function missedDeadline(item: Pick<Assignment, "dueAt" | "allowLateSubmission" | "submissionCompleted" | "gradingStatus">, now = Date.now()) {
  return item.gradingStatus === "MISSED_DEADLINE" || (!item.submissionCompleted && deadlineClosed(item, now));
}
