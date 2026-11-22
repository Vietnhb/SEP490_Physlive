import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import type { Assignment } from "../../../shared/types/physlive";
import { studentAssignmentState, studentAssignmentSummary } from "../model/studentAssignmentState";
import { useAssignmentClock } from "../hooks/useAssignmentClock";
import LearningIcon from "../../../shared/ui/LearningIcon";

type Props = { assignments: Assignment[]; loading: boolean; error: string; onSelect: (item: Assignment) => void };
export function StudentRecentResults({ assignments, loading, error, onSelect }: Readonly<Props>) {
  const now = useAssignmentClock();
  const summary = studentAssignmentSummary(assignments, now);
  const results = assignments.filter(item => item.submissionCompleted && !item.retryAllowed && studentAssignmentState(item, now).key !== "expired")
    .sort((a, b) => Date.parse(b.completedAt || b.assignedAt) - Date.parse(a.completedAt || a.assignedAt)).slice(0, 3);
  if (loading || error || (!results.length && !summary.expired)) return null;
  return <section className="student-results" aria-labelledby="student-results-title">
    <div className="student-section-title"><div><Heading as="h2" size="4" id="student-results-title">Kết quả & phản hồi</Heading><Text as="p" size="2" className="student-dashboard-section-description">Theo dõi điểm và nhận xét của giáo viên.</Text></div>
      <div className="student-results-counts"><Badge color="green">Đã chấm {summary.graded}</Badge><Badge color="cyan">Chờ chấm / xác nhận {summary.awaitingGrade}</Badge></div>
    </div>
    {summary.expired > 0 && <Text as="p" size="2" className="student-results-expired">{summary.expired} bài quá hạn không nộp, ghi nhận 0 điểm. Tra cứu trong danh sách bài tập.</Text>}
    {results.length > 0 && <Card size="1" className="student-up-next__list student-results__list"><ul>{results.map(item => {
      const state = studentAssignmentState(item, now);
      return <li key={item.id}>
        <span className="student-dashboard-row-icon" aria-hidden="true"><LearningIcon name={state.key === "graded" ? "check" : "file"} /></span>
        <span className="student-up-next__text"><strong title={item.title}>{item.title}</strong>
          <small>{item.className}{item.completedAt && <> · Nộp {new Date(item.completedAt).toLocaleDateString("vi-VN")}</>}</small>
          {item.feedback && <span className="student-results-feedback" title={item.feedback}>Nhận xét: {item.feedback}</span>}
        </span>
        <div className="student-results-score"><Badge color={state.color}>{state.label}</Badge>{item.score != null && <Text as="span" size="3" weight="bold">{item.score} / {item.maxScore ?? 10}</Text>}</div>
        <Button variant="soft" onClick={() => onSelect(item)} aria-label={"Xem bài: " + item.title}>Xem bài<LearningIcon name="arrow" /></Button>
      </li>;
    })}</ul></Card>}
  </section>;
}
