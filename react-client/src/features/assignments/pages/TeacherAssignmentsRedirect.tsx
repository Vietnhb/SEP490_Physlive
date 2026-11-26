import { Navigate, useSearchParams } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import type { Assignment } from "../../../shared/types/physlive";
import StudioTableSkeleton from "../components/StudioTableSkeleton";

/**
 * The old "Bài tập đã giao" address. Assignments now live in their class (tab "Bài tập & chấm bài"),
 * so a link to one assignment opens its class on it, and the bare address opens the class list.
 */
export default function TeacherAssignmentsRedirect() {
  const [params] = useSearchParams();
  const wanted = params.get("assignment");
  const work = useResource<Assignment[]>("/assignments/mine/teacher", Boolean(wanted));
  if (!wanted) return <Navigate replace to="/lab/classes" />;
  if (work.loading) return <main className="page"><section className="card"><StudioTableSkeleton headers={["Bài tập", "Hạn nộp", "Trạng thái"]} label="Đang mở bài tập…" /></section></main>;
  const assignment = work.data?.find(item => item.id === wanted);
  return <Navigate replace to={assignment?.classId ? `/lab/classes/${assignment.classId}?tab=assignments&assignment=${encodeURIComponent(assignment.id)}` : "/lab/classes"} />;
}
