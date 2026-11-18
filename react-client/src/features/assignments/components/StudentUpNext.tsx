import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import type { Assignment } from "../../../shared/types/physlive";
import { useAssignmentClock } from "../hooks/useAssignmentClock";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

type Props = {
  assignments: Assignment[];
  loading: boolean;
  error: string;
  onSelect: (item: Assignment) => void;
  onAll: () => void;
};

const SHOWN = 3;
const needsWork = (item: Assignment) => !item.submissionCompleted || item.retryAllowed;
const dueTime = (item: Assignment) => item.dueAt ? new Date(item.dueAt).getTime() : Infinity;

/** The home page's short "what to do next": the nearest few assignments still open, the full list lives on its own page. */
export function StudentUpNext({ assignments, loading, error, onSelect, onAll }: Readonly<Props>) {
  const now = useAssignmentClock();
  const open = assignments.filter(needsWork)
    .sort((a, b) => Number(Boolean(b.retryAllowed)) - Number(Boolean(a.retryAllowed)) || dueTime(a) - dueTime(b));
  const shown = open.slice(0, SHOWN);

  return <section className="student-up-next" aria-labelledby="student-up-next-title">
    <div className="student-section-title">
      <Heading as="h2" size="4" id="student-up-next-title">Cần làm tiếp</Heading>
      {assignments.length > 0 && <Button variant="ghost" onClick={onAll}>Tất cả bài tập ({assignments.length})<LearningIcon name="arrow" /></Button>}
    </div>
    {loading ? <CardLoadingSkeleton cards={1} label="Đang tải bài tập…" />
      : error ? <Card className="student-quiet-state"><Text color="gray">Chưa tải được bài tập. Mở trang "Bài tập được giao" để thử lại.</Text></Card>
      : shown.length === 0 ? <Card className="student-quiet-state"><Text color="gray">{assignments.length ? "Bạn đã nộp hết bài tập hiện tại." : "Chưa có bài tập được giao."}</Text></Card>
      : <Card size="1" className="student-up-next__list"><ul>{shown.map(item => {
          const overdue = Boolean(item.dueAt && dueTime(item) < now);
          const status = item.retryAllowed ? "Cần làm lại" : item.predictionSubmitted ? "Đang làm" : overdue ? "Quá hạn" : "Chưa làm";
          const action = item.retryAllowed ? "Làm lại" : item.predictionSubmitted ? "Tiếp tục" : overdue ? "Nộp muộn" : "Làm bài";
          const due = item.dueAt ? `Hạn ${new Date(item.dueAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : "Không giới hạn";
          return <li key={item.id}>
            <span className="student-up-next__text">
              <strong>{item.title}</strong>
              <small>{item.className && <>{item.className} · </>}{due}</small>
            </span>
            <Badge color={item.retryAllowed || overdue ? "amber" : item.predictionSubmitted ? "indigo" : "gray"}>{status}</Badge>
            <Button onClick={() => onSelect(item)} aria-label={`${action}: ${item.title}`}>{action}<LearningIcon name="arrow" /></Button>
          </li>;
        })}</ul>
        {open.length > SHOWN && <Text as="p" size="2" color="gray" className="student-up-next__more">Còn {open.length - SHOWN} bài cần làm khác.</Text>}
      </Card>}
  </section>;
}
