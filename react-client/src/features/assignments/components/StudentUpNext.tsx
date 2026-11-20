import { compareStudentWork, studentAssignmentState } from "../model/studentAssignmentState";
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

/** The home page's short "what to do next": the nearest few assignments still open, the full list lives on its own page. */
export function StudentUpNext({ assignments, loading, error, onSelect, onAll }: Readonly<Props>) {
  const now = useAssignmentClock();
  const open = assignments.filter(item => studentAssignmentState(item, now).actionable)
    .sort((a, b) => compareStudentWork(a, b, now));
  const shown = open.slice(0, SHOWN);

  return <section className="student-up-next" aria-labelledby="student-up-next-title">
    <div className="student-section-title">
      <div><Heading as="h2" size="4" id="student-up-next-title">Cần làm tiếp</Heading><Text as="p" size="2" className="student-dashboard-section-description">Ưu tiên bài cần làm lại và sắp đến hạn.</Text></div>
      {assignments.length > 0 && <Button variant="ghost" onClick={onAll}>Tất cả bài tập ({assignments.length})<LearningIcon name="arrow" /></Button>}
    </div>
    {loading ? <CardLoadingSkeleton cards={1} label="Đang tải bài tập…" />
      : error ? <Card className="student-quiet-state"><Text color="gray">Chưa tải được bài tập. Mở trang "Bài tập được giao" để thử lại.</Text></Card>
      : shown.length === 0 ? <Card className="student-quiet-state"><Text color="gray">{assignments.length ? "Không còn bài tập đang mở cần hoàn thành. Xem tất cả để kiểm tra kết quả và bài đã hết hạn." : "Chưa có bài tập được giao."}</Text></Card>
      : <Card size="1" className="student-up-next__list"><ul>{shown.map(item => {
          const { label: status, action, color } = studentAssignmentState(item, now);
          const due = item.dueAt ? `Hạn ${new Date(item.dueAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}` : "Không giới hạn";
          return <li key={item.id}>
            <span className="student-dashboard-row-icon" aria-hidden="true"><LearningIcon name={item.retryAllowed ? "reset" : "file"} /></span>
            <span className="student-up-next__text">
              <strong title={item.title}>{item.title}</strong>
              <small>{item.className && <>{item.className} · </>}{due}</small>
              <Badge color={color}>{status}</Badge>
            </span>
            <Button onClick={() => onSelect(item)} aria-label={`${action}: ${item.title}`}>{action}<LearningIcon name="arrow" /></Button>
          </li>;
        })}</ul>
        {open.length > SHOWN && <Text as="p" size="2" color="gray" className="student-up-next__more">Còn {open.length - SHOWN} bài cần làm khác.</Text>}
      </Card>}
  </section>;
}
