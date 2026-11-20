import { useResource } from "../../../shared/hooks/operationsData";
import { Badge, Button } from "@radix-ui/themes";
import type { SimulationComplaint } from "../../support/api/supportApi";
import type { ReviewerAccess, ReviewerView } from "../model/reviewerAccess";
import type { Version } from "../model/reviewerTypes";
import { timeAgo } from "../model/reviewerUtils";
import { ReviewerIcon, type ReviewerIconName } from "./ReviewerKit";
import LearningIcon from "../../../shared/ui/LearningIcon";
import s from "./ReviewerOverview.module.css";

type PendingItem = { createdAt?: string };
type Task = { id: string; view: ReviewerView; icon: ReviewerIconName; count?: number; oldest?: string; title: string; detail: string; empty: string; action: string; tone: "primary" | "secondary" | "success" | "neutral"; loading: boolean; error?: string };
const number = (value: number) => value.toLocaleString("vi-VN");
const oldestDate = (items?: PendingItem[]) => items?.map(item => item.createdAt).filter((date): date is string => Boolean(date) && Number.isFinite(Date.parse(date!))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];

function useOverview(access: ReviewerAccess) {
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  const libraryResource = useResource<PendingItem[]>("/reviewer/library?status=PENDING", access.canReview);
  const complaintsResource = useResource<SimulationComplaint[]>("/support/complaints/review", canHandleComplaints);
  const schemasResource = useResource<Version[]>("/reviewer/schemas", access.canEdit);
  const gapsResource = useResource<{ occurrences: number }[]>("/reviewer/law-gaps?status=OPEN", access.canEdit);
  const complaints = complaintsResource.data?.filter(item => item.status !== "RESOLVED");
  const drafts = schemasResource.data?.filter(item => item.lifecycleStatus === "DRAFT");
  const tasks: Task[] = [];
  if (access.canReview) tasks.push({ id: "moderation", view: "moderation", icon: "library", count: libraryResource.data?.length, oldest: oldestDate(libraryResource.data), title: "Mô phỏng chờ duyệt", detail: "Kiểm tra mô phỏng giáo viên chia sẻ lên thư viện công khai.", empty: "Không có mô phỏng đang chờ duyệt.", action: "Bắt đầu duyệt", tone: "secondary", loading: libraryResource.loading, error: libraryResource.error });
  if (canHandleComplaints) tasks.push({ id: "complaints", view: "complaints", icon: "message", count: complaints?.length, oldest: oldestDate(complaints), title: "Khiếu nại mô phỏng", detail: "Kiểm tra và phản hồi báo lỗi mô phỏng từ giáo viên.", empty: "Không có khiếu nại đang chờ xử lý.", action: "Xem khiếu nại", tone: "primary", loading: complaintsResource.loading, error: complaintsResource.error });
  if (access.canEdit) {
    tasks.push({ id: "gaps", view: "gaps", icon: "benchmark", count: gapsResource.data?.length, title: "Định luật cần rà soát", detail: gapsResource.data?.length ? "Các mục cần rà soát được ghi nhận " + number(gapsResource.data.reduce((sum, item) => sum + item.occurrences, 0)) + " lần trong mô phỏng của giáo viên." : "Rà soát định luật chưa áp dụng được trong các lượt chạy mô phỏng.", empty: "Không có mục định luật đang chờ rà soát.", action: "Xem danh sách", tone: "neutral", loading: gapsResource.loading, error: gapsResource.error });
    tasks.push({ id: "drafts", view: "topics", icon: "schema", count: drafts?.length, oldest: oldestDate(drafts), title: "Bản nháp chờ phê duyệt", detail: "Kiểm tra bản nháp chủ đề vật lý trước khi phát hành.", empty: "Không có bản nháp chủ đề đang chờ.", action: "Xem chủ đề", tone: "success", loading: schemasResource.loading, error: schemasResource.error });
  }
  const active = [access.canReview && libraryResource, canHandleComplaints && complaintsResource, access.canEdit && schemasResource, access.canEdit && gapsResource].filter(item => item !== false);
  return { tasks, canHandleComplaints, refreshing: active.some(item => item.refreshing), refresh: () => { void Promise.all(active.map(item => item.refresh())); } };
}

export function ReviewerOverview({ access, name, onOpen }: Readonly<{ access: ReviewerAccess; name?: string; onOpen: (view: ReviewerView) => void }>) {
  const { tasks, canHandleComplaints, refreshing, refresh } = useOverview(access);
  const failed = tasks.filter(task => task.error);
  const loaded = tasks.filter(task => task.count !== undefined).length;
  const ready = loaded === tasks.length && !failed.length;
  const pending = tasks.filter(task => (task.count ?? 0) > 0).sort((a, b) => (a.oldest ? Date.parse(a.oldest) : Infinity) - (b.oldest ? Date.parse(b.oldest) : Infinity) || (b.count ?? 0) - (a.count ?? 0));
  const total = tasks.reduce((sum, task) => sum + (task.count ?? 0), 0);
  const oldest = oldestDate(pending.map(task => ({ createdAt: task.oldest })));
  const firstName = name?.trim().split(/\s+/).at(-1);
  const message = failed.length ? "Một số nhóm công việc chưa cập nhật được. Hãy thử làm mới." : !ready ? "Đang kiểm tra các nhóm công việc của bạn…" : total > 0 ? "Hiện có " + number(total) + " việc đang chờ bạn xử lý." : "Không còn công việc đang chờ xử lý.";
  const priority = pending[0];
  return <div className={s.dashboard} data-testid="reviewer-dashboard">
    <header className={s.welcome}><div><span className={s.eyebrow}><LearningIcon name="shield" />Không gian kiểm duyệt</span><h1>{firstName ? "Chào " + firstName : "Việc cần làm"}</h1><p>{message}</p></div><div className={s.headerActions}><Button variant="soft" disabled={refreshing} onClick={refresh}><ReviewerIcon name="refresh" />{refreshing ? "Đang cập nhật…" : "Làm mới"}</Button>{priority && <Button onClick={() => onOpen(priority.view)}>Tiếp tục xử lý<ReviewerIcon name="arrow" /></Button>}</div></header>
    {failed.length > 0 && <div className={s.error} role="alert"><span>Chưa cập nhật được: {failed.map(task => task.title).join(", ")}. Các nhóm còn lại vẫn có thể sử dụng.</span><Button variant="soft" onClick={refresh}>Thử lại</Button></div>}
    <section className={s.stats} aria-label="Các nhóm công việc">{tasks.map(task => <article key={task.id} className={s.stat + " " + s[task.tone]} data-task={task.id} aria-busy={task.loading}>
      <h2><ReviewerIcon name={task.icon} />{task.title}</h2><strong aria-label={task.count == null ? "Chưa có số liệu" : number(task.count) + " mục"}>{task.count == null ? "—" : number(task.count)}</strong><p title={task.count === 0 ? task.empty : undefined}>{task.error ? "Chưa cập nhật được số liệu" : task.count == null ? "Đang tải công việc…" : task.count > 0 ? "Đang chờ xử lý" : "Không có việc đang chờ"}</p><Button variant="ghost" onClick={() => onOpen(task.view)}>{task.action}<ReviewerIcon name="arrow" size={16} /></Button>
    </article>)}</section>
    <div className={s.content}>
      <section className={s.panel} aria-labelledby="reviewer-priority-title"><div className={s.panelHeading}><div><h2 id="reviewer-priority-title">Ưu tiên xử lý</h2><p>Nhóm có yêu cầu cũ nhất được xếp trước.</p></div><span className={s.sectionIcon}><ReviewerIcon name="queue" /></span></div>
        {pending.length > 0 ? <ul className={s.priorityList}>{pending.map(task => <li key={task.id}><span className={s.rowIcon}><ReviewerIcon name={task.icon} /></span><div className={s.taskCopy}><div><h3>{task.title}</h3><Badge color="amber">{number(task.count!)} mục</Badge></div><p>{task.detail}</p>{task.oldest && <small><ReviewerIcon name="clock" size={14} />Cũ nhất {timeAgo(task.oldest)}</small>}{task.error && <small className={s.warningText}>Đang hiển thị số liệu gần nhất.</small>}</div><Button variant="soft" onClick={() => onOpen(task.view)} aria-label={task.action + ": " + task.title}>Xử lý<ReviewerIcon name="arrow" size={16} /></Button></li>)}</ul> : <div className={s.empty}><span><ReviewerIcon name={ready ? "check" : "queue"} size={28} /></span><h3>{ready ? "Đã xử lý hết công việc" : failed.length ? "Chưa thể tổng hợp công việc" : "Đang tổng hợp công việc"}</h3><p>{ready ? "Bạn có thể xem lại các nhóm công việc hoặc cập nhật dữ liệu chuẩn." : failed.length ? "Thử làm mới để kiểm tra lại các nhóm chưa tải được." : "Số liệu sẽ xuất hiện khi tải xong."}</p></div>}
      </section>
      <aside className={s.aside} aria-label="Tình trạng và phạm vi công việc">
        <section className={s.queueSummary} aria-labelledby="reviewer-queue-title"><span className={s.summaryIcon}><ReviewerIcon name="clock" size={24} /></span><h2 id="reviewer-queue-title">Tình trạng hàng đợi</h2><dl><div><dt>Công việc đang chờ</dt><dd>{ready ? number(total) : "—"}</dd></div><div><dt>Nhóm còn công việc</dt><dd>{ready ? number(pending.length) + " / " + number(tasks.length) : loaded + " / " + tasks.length + " nhóm đã tải"}</dd></div><div><dt>Yêu cầu cũ nhất</dt><dd>{oldest ? timeAgo(oldest) : "—"}</dd></div></dl></section>
        <section className={s.panel + " " + s.guide} aria-labelledby="reviewer-scope-title"><div className={s.panelHeading}><div><h2 id="reviewer-scope-title">Phạm vi công việc</h2><p>Các chức năng tài khoản được cấp.</p></div></div><ul>
          {access.canReview && <li><span className={s.guideIcon}><ReviewerIcon name="eye" /></span><div><h3>Kiểm duyệt nội dung</h3><p>Xem, phê duyệt hoặc từ chối mô phỏng chia sẻ công khai.</p></div></li>}
          {canHandleComplaints && <li><span className={s.guideIcon}><ReviewerIcon name="message" /></span><div><h3>Hỗ trợ giáo viên</h3><p>Kiểm tra báo lỗi và phản hồi kết quả xử lý mô phỏng.</p></div></li>}
          {access.canEdit && <li><span className={s.guideIcon}><ReviewerIcon name="edit" /></span><div><h3>Biên soạn dữ liệu chuẩn</h3><p>Quản lý chủ đề, định luật và các bản nháp chờ phát hành.</p></div></li>}
        </ul>{!access.isManager && (!access.canEdit || !access.canReview) && <p className={s.accessNote}>Liên hệ bộ phận vận hành nếu cần thêm quyền.</p>}</section>
      </aside>
    </div>
  </div>;
}
