import { useResource } from "../../../shared/hooks/operationsData";
import { Button, Card, Heading, Text } from "@radix-ui/themes";
import type { SimulationComplaint } from "../../support/api/supportApi";
import type { ReviewerAccess, ReviewerView } from "../model/reviewerAccess";
import type { Version } from "../model/reviewerTypes";
import { timeAgo } from "../model/reviewerUtils";
import { ReviewerIcon, ReviewerRefresh, type ReviewerIconName } from "./ReviewerKit";

type PendingItem = { createdAt?: string };
type Counts = {
  moderation?: { pending: number; oldest?: string };
  complaints?: { open: number; oldest?: string };
  drafts?: number;
  gaps?: { open: number; met: number };
};
type Task = { id: string; view: ReviewerView; icon: ReviewerIconName; count: number; title: string; detail: string; action: string };

function useOverview(access: ReviewerAccess) {
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  const libraryResource = useResource<PendingItem[]>("/reviewer/library?status=PENDING", access.canReview);
  const complaintsResource = useResource<SimulationComplaint[]>("/support/complaints/review", canHandleComplaints);
  const schemasResource = useResource<Version[]>("/reviewer/schemas", access.canEdit);
  const gapsResource = useResource<{ occurrences: number }[]>("/reviewer/law-gaps?status=OPEN", access.canEdit);
  const library = libraryResource.data, complaints = complaintsResource.data, schemas = schemasResource.data, gaps = gapsResource.data;
  const counts: Counts = {};
  if (access.canReview && library) counts.moderation = { pending: library.length, oldest: library.map(item => item.createdAt).filter(Boolean).sort()[0] };
  if (canHandleComplaints && complaints) {
    const open = complaints.filter(item => item.status !== "RESOLVED");
    counts.complaints = { open: open.length, oldest: open.map(item => item.createdAt).filter(Boolean).sort()[0] };
  }
  if (access.canEdit) {
    counts.drafts = schemas?.filter(item => item.lifecycleStatus === "DRAFT").length ?? 0;
    if (gaps) counts.gaps = { open: gaps.length, met: gaps.reduce((sum, item) => sum + item.occurrences, 0) };
  }
  const active = [access.canReview && libraryResource, canHandleComplaints && complaintsResource, access.canEdit && schemasResource, access.canEdit && gapsResource].filter(item => item !== false);
  const loading = active.some(item => item.loading);
  const failed = active.some(item => Boolean(item.error));
  return { counts, loading, failed, canHandleComplaints, refresh: () => { void Promise.all(active.map(item => item.refresh())); } };
}

export function ReviewerOverview({ access, name, onOpen }: Readonly<{ access: ReviewerAccess; name?: string; onOpen: (view: ReviewerView) => void }>) {
  const { counts, loading, failed, canHandleComplaints, refresh } = useOverview(access);
  const tasks: Task[] = [];
  if (counts.moderation) tasks.push({ id: "moderation", view: "moderation", icon: "library", count: counts.moderation.pending, title: "Mô phỏng chờ duyệt", detail: counts.moderation.pending ? `Giáo viên gửi lên thư viện công khai${counts.moderation.oldest ? ` · cũ nhất ${timeAgo(counts.moderation.oldest)}` : ""}.` : "Không có mô phỏng nào đang chờ.", action: "Bắt đầu duyệt" });
  if (counts.complaints) tasks.push({ id: "complaints", view: "complaints", icon: "message", count: counts.complaints.open, title: "Khiếu nại mô phỏng", detail: counts.complaints.open ? `Giáo viên báo mô phỏng tính sai hoặc lệch đề bài${counts.complaints.oldest ? ` · cũ nhất ${timeAgo(counts.complaints.oldest)}` : ""}.` : "Không có khiếu nại nào đang chờ xử lý.", action: "Xem khiếu nại" });
  if (counts.gaps) tasks.push({ id: "gaps", view: "gaps", icon: "benchmark", count: counts.gaps.open, title: "Định luật còn thiếu", detail: counts.gaps.open ? `${counts.gaps.open} loại đại lượng chưa có định luật kiểm, gặp ${counts.gaps.met} lần trong mô phỏng của giáo viên.` : "Mọi đại lượng giáo viên dùng đều đã có định luật kiểm.", action: "Xem danh sách" });
  if (counts.drafts !== undefined) {
    tasks.push({ id: "drafts", view: "topics", icon: "schema", count: counts.drafts, title: "Bản nháp chờ phê duyệt", detail: counts.drafts ? `${counts.drafts} bản nháp chủ đề vật lý đang chờ kiểm tra và phê duyệt phát hành.` : "Không có bản nháp chủ đề nào tồn đọng.", action: "Xem chủ đề" });
  }
  const total = tasks.reduce((sum, task) => sum + task.count, 0);
  const firstName = name?.trim().split(/\s+/).at(-1);
  const skeletonCount = (access.canReview ? 1 : 0) + (canHandleComplaints ? 1 : 0) + (access.canEdit ? 2 : 0);

  return <div className="reviewer-stack">
    <header className="reviewer-hero">
      <div>
        <Heading as="h1" size="7">{firstName ? `Chào ${firstName},` : "Chào bạn,"}</Heading>
        <Text as="p" size="3" color="gray" mt="1">{loading ? "Đang kiểm tra công việc…" : total ? <>Hiện có <strong>{total}</strong> việc đang chờ bạn xử lý.</> : "Bạn đã xử lý hết công việc. Tuyệt vời!"}</Text>
      </div>
      <ReviewerRefresh refresh={refresh} loading={loading} />
    </header>
    {failed && <div className="ops-alert" role="alert">Không tải được số liệu. Kiểm tra kết nối máy chủ rồi bấm “Làm mới”.</div>}
    <div className="reviewer-task-grid">
      {loading && tasks.length === 0 && Array.from({ length: skeletonCount }, (_, index) => <Card key={index} size="3" className="reviewer-task reviewer-task-skeleton" aria-hidden="true"><span className="reviewer-task-icon" /><span className="reviewer-skeleton-line" /><span className="reviewer-skeleton-line short" /></Card>)}
      {tasks.map(task => <Card key={task.id} size="3" className={`reviewer-task${task.count ? " has-work" : ""}`}>
        <div className="reviewer-task-top"><span className="reviewer-task-icon"><ReviewerIcon name={task.icon} size={22} /></span><span className="reviewer-task-count">{loading ? "—" : task.count}</span></div>
        <Heading as="h2" size="4" mt="3">{task.title}</Heading>
        <Text as="p" size="2" color="gray" mt="1" className="reviewer-task-detail">{loading ? "Đang tải…" : task.detail}</Text>
        <Button mt="4" size="2" variant={task.count ? "solid" : "soft"} color={task.count ? undefined : "gray"} onClick={() => onOpen(task.view)}>{task.action}<ReviewerIcon name="arrow" size={15} /></Button>
      </Card>)}
    </div>
    <Card size="3" className="reviewer-guide">
      <Heading as="h2" size="3">Quyền của bạn</Heading>
      <ul>
        {access.canReview && <li><ReviewerIcon name="eye" size={16} /><span><strong>Kiểm duyệt nội dung</strong> — xem mô phỏng giáo viên chia sẻ, phê duyệt, đánh dấu nổi bật, từ chối hoặc gỡ khỏi thư viện công khai.</span></li>}
        {canHandleComplaints && <li><ReviewerIcon name="message" size={16} /><span><strong>Hỗ trợ giáo viên</strong> — kiểm tra và phản hồi khi giáo viên báo mô phỏng tính sai hoặc không đúng đề bài.</span></li>}
        {access.canEdit && <li><ReviewerIcon name="edit" size={16} /><span><strong>Biên soạn dữ liệu chuẩn</strong> — quản lý vai trò, định luật của từng chủ đề và bổ sung định luật còn thiếu.</span></li>}
      </ul>
      {!access.isManager && (!access.canEdit || !access.canReview) && <Text as="p" size="2" color="gray">Cần thêm quyền? Liên hệ bộ phận vận hành (Manager) để được cấp.</Text>}
    </Card>
  </div>;
}
