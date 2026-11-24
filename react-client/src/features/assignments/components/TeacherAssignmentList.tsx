import { useState } from "react";
import Icon from "../../../shared/ui/LearningIcon";
import type { AssignmentRecord } from "../model/teacherSubmissionTypes";
import { formatShortDate } from "../model/teacherSubmissionUtils";

export function TeacherAssignmentList({
  records,
  selectedId,
  onSelect,
  loadedIds,
  failedIds,
}: Readonly<{
  records: AssignmentRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  loadedIds: ReadonlySet<string>;
  failedIds: ReadonlySet<string>;
}>) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("vi-VN");
  const visible = records.filter(({ assignment }) =>
    [assignment.title, assignment.className].some(value => value?.toLocaleLowerCase("vi-VN").includes(search)));

  return (
    <aside className="lab-assignment-list" aria-label="Danh sách bài đã giao">
      <div className="lab-list-heading">
        <h2>Danh sách bài tập</h2>
        <span className="lab-list-count">{records.length}</span>
      </div>

      <label className="lab-search lab-assignment-search">
        <Icon name="search" />
        <input type="search" aria-label="Tìm bài tập" placeholder="Tìm bài hoặc lớp" value={query} onChange={event => setQuery(event.target.value)} />
      </label>

      <label className="lab-mobile-selector">
        <span>Bài đang xem</span>
        <select
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Chọn bài đang xem"
        >
          {records.map(({ assignment }) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.title}
            </option>
          ))}
        </select>
      </label>

      <nav className="lab-assignment-items" aria-label="Bài tập đã giao">
        {visible.map(({ assignment, submissions }) => (
          <button
            type="button"
            key={assignment.id}
            className={`lab-assignment-item${selectedId === assignment.id ? " active" : ""}`}
            aria-pressed={selectedId === assignment.id}
            onClick={() => onSelect(assignment.id)}
          >
            <span className="lab-assignment-item-title" title={assignment.title}>
              {assignment.title}
            </span>
            <span className="lab-assignment-item-meta">
              <span>{loadedIds.has(assignment.id)
                ? `${submissions.filter(item => item.completedAt).length}/${assignment.studentIds.length} đã nộp`
                : failedIds.has(assignment.id) ? "Lỗi tải bài nộp" : "Đang tải…"}</span>
              <span>{assignment.dueAt ? formatShortDate(assignment.dueAt) : "Chưa đặt hạn"}</span>
            </span>
          </button>
        ))}
        {visible.length === 0 && <p className="lab-assignment-empty" role="status">Không tìm thấy bài tập phù hợp.</p>}
      </nav>
    </aside>
  );
}
