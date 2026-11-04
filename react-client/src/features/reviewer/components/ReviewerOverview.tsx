import { useCallback, useEffect, useState } from "react";
import { Button, Card, Heading, Text } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { complaintsForReview } from "../../support/api/supportApi";
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

async function settle<T>(request: Promise<{ data: T }>) {
  try { return (await request).data; } catch { return undefined; }
}

function useOverview(access: ReviewerAccess) {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  // State is set only when the requests answer; a manual refresh shows the loading state itself.
  const load = useCallback(() => Promise.all([
      access.canReview ? settle(api.get<PendingItem[]>("/reviewer/library", { params: { status: "PENDING" } })) : undefined,
      canHandleComplaints ? complaintsForReview().catch(() => undefined) : undefined,
      access.canEdit ? settle(api.get<Version[]>("/reviewer/schemas")) : undefined,
      access.canEdit ? settle(api.get<{ occurrences: number }[]>("/reviewer/law-gaps", { params: { status: "OPEN" } })) : undefined,
  ]).then(([library, complaints, schemas, gaps]) => {
    const next: Counts = {};
    if (access.canReview && library) {
      const oldest = library.map(item => item.createdAt).filter(Boolean).sort()[0];
      next.moderation = { pending: library.length, oldest };
    }
    if (canHandleComplaints && complaints) {
      const open = complaints.filter(item => item.status !== "RESOLVED");
      const oldest = open.map(item => item.createdAt).filter(Boolean).sort()[0];
      next.complaints = { open: open.length, oldest };
    }
    if (access.canEdit) {
      next.drafts = schemas?.filter(item => item.lifecycleStatus === "DRAFT").length ?? 0;
      if (gaps) next.gaps = { open: gaps.length, met: gaps.reduce((sum, item) => sum + item.occurrences, 0) };
    }
    const expected = (access.canReview ? 1 : 0) + (canHandleComplaints ? 1 : 0) + (access.canEdit ? 1 : 0);
    setFailed(expected > 0 && !library && !complaints && !gaps);
    setCounts(next); setLoading(false);
  }), [access.canEdit, access.canReview, canHandleComplaints]);
  useEffect(() => { void load(); }, [load]);
  return { counts, loading, failed, canHandleComplaints, refresh: () => { setLoading(true); setFailed(false); void load(); } };
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
