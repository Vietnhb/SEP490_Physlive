import RefreshButton from "../../../shared/ui/RefreshButton";
import ReportChart from "../../../shared/ui/ReportChart";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { Badge, Button } from "@radix-ui/themes";
import type { ComplaintCounts } from "../../support/api/supportApi";
import type { ReviewerAccess, ReviewerView } from "../model/reviewerAccess";
import { timeAgo } from "../model/reviewerUtils";
import { ReviewerIcon, type ReviewerIconName } from "./ReviewerKit";
import s from "./ReviewerOverview.module.css";

type PendingItem = { createdAt?: string };
type PendingPage = { items: PendingItem[]; totalElements: number };
type SchemaSummary = { id: string; schemaId: string; name: string; topic: string; version: string; lifecycleStatus: string; createdAt?: string };
type LibraryCounts = { PENDING?: number; APPROVED?: number; FEATURED?: number; REJECTED?: number; REMOVED?: number };
type GapCounts = { OPEN?: number; RESOLVED?: number; DISMISSED?: number };
type OpenGap = { kind: "UNCHECKED" | "NO_ROLE" | "AMBIGUOUS" | "VIOLATION" | "COMPLAINT"; topic?: string; occurrences: number };
type Task = { id: string; view: ReviewerView; icon: ReviewerIconName; count?: number; oldest?: string; title: string; detail: string; empty: string; action: string; tone: "primary" | "secondary" | "success" | "neutral"; loading: boolean; error?: string };

const GAP_KIND_LABEL: Record<OpenGap["kind"], string> = {
  UNCHECKED: "Chưa có định luật",
  NO_ROLE: "Thiếu vai trò",
  AMBIGUOUS: "Định luật mơ hồ",
  VIOLATION: "Định luật bác bỏ",
  COMPLAINT: "Từ khiếu nại",
};

const number = (value: number) => value.toLocaleString("vi-VN");
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const oldestDate = (items?: PendingItem[]) => items?.map(item => item.createdAt).filter((date): date is string => Boolean(date) && Number.isFinite(Date.parse(date!))).sort((a, b) => Date.parse(a) - Date.parse(b))[0];

type DonutSegment = { key: string; label: string; value: number; color: string };

function DonutChart({ segments, centerValue, centerLabel, ariaLabel }: Readonly<{ segments: DonutSegment[]; centerValue: string; centerLabel: string; ariaLabel: string }>) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<{ items: (DonutSegment & { dash: number; offset: number })[]; used: number }>((acc, item) => {
    const dash = total > 0 ? (item.value / total) * circumference : 0;
    acc.items.push({ ...item, dash, offset: acc.used });
    acc.used += dash;
    return acc;
  }, { items: [], used: 0 }).items;
  return <div className={s.donutWrap}>
    <svg className={s.donutSvg} viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
      <circle className={s.donutTrack} cx="60" cy="60" r={radius} />
      {total > 0 && arcs.map(arc => arc.value > 0 && (
        <circle
          key={arc.key}
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth="14"
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={-arc.offset}
          transform="rotate(-90 60 60)"
        />
      ))}
      <text x="60" y="57" textAnchor="middle" className={s.donutValue}>{centerValue}</text>
      <text x="60" y="73" textAnchor="middle" className={s.donutCaption}>{centerLabel}</text>
    </svg>
    <ul className={s.legend}>
      {segments.map(item => <li key={item.key}>
        <span className={s.legendDot} style={{ background: item.color }} aria-hidden="true" />
        <span className={s.legendLabel}>{item.label}</span>
        <strong>{number(item.value)}</strong>
        <small>{pct(item.value, total)}%</small>
      </li>)}
    </ul>
  </div>;
}

function useOverview(access: ReviewerAccess) {
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  // Fetch only the 1 oldest pending item + exact counts (avoids loading full queues or heavy simulation snapshots).
  const libraryOldestResource = useResource<PendingPage>("/reviewer/library/page?status=PENDING&page=0&size=1", access.canReview);
  const libraryCountsResource = useResource<LibraryCounts>("/reviewer/library/counts", access.canReview);
  const complaintCountsResource = useResource<ComplaintCounts>("/support/complaints/counts", canHandleComplaints);
  const schemasResource = useResource<SchemaSummary[]>("/reviewer/schemas/summary", access.canEdit);
  const gapsResource = useResource<OpenGap[]>("/reviewer/law-gaps?status=OPEN", access.canEdit);
  const gapCountsResource = useResource<GapCounts>("/reviewer/law-gaps/counts", access.canEdit);

  const complaintOpenCount = complaintCountsResource.data ? complaintCountsResource.data.open + complaintCountsResource.data.read : undefined;
  const schemas = schemasResource.data ?? [];
  const drafts = schemas.filter(item => item.lifecycleStatus === "DRAFT");
  const openGaps = gapsResource.data ?? [];

  const tasks: Task[] = [];
  if (access.canReview) tasks.push({ id: "moderation", view: "moderation", icon: "library", count: libraryCountsResource.data?.PENDING ?? libraryOldestResource.data?.totalElements, oldest: libraryOldestResource.data?.items?.[0]?.createdAt, title: "Mô phỏng chờ duyệt", detail: "Kiểm tra mô phỏng giáo viên chia sẻ lên thư viện công khai.", empty: "Không có mô phỏng đang chờ duyệt.", action: "Bắt đầu duyệt", tone: "secondary", loading: libraryCountsResource.loading, error: libraryCountsResource.error || libraryOldestResource.error });
  if (canHandleComplaints) tasks.push({ id: "complaints", view: "complaints", icon: "message", count: complaintOpenCount, oldest: complaintCountsResource.data?.oldestOpenCreatedAt ?? undefined, title: "Khiếu nại mô phỏng", detail: "Kiểm tra và phản hồi báo lỗi mô phỏng từ giáo viên.", empty: "Không có khiếu nại đang chờ xử lý.", action: "Xem khiếu nại", tone: "primary", loading: complaintCountsResource.loading, error: complaintCountsResource.error });
  if (access.canEdit) {
    tasks.push({ id: "gaps", view: "gaps", icon: "benchmark", count: gapCountsResource.data?.OPEN ?? gapsResource.data?.length, title: "Định luật cần rà soát", detail: openGaps.length ? "Các mục cần rà soát được ghi nhận " + number(openGaps.reduce((sum, item) => sum + item.occurrences, 0)) + " lần trong mô phỏng của giáo viên." : "Rà soát định luật chưa áp dụng được trong các lượt chạy mô phỏng.", empty: "Không có mục định luật đang chờ rà soát.", action: "Xem danh sách", tone: "neutral", loading: gapsResource.loading, error: gapsResource.error });
    tasks.push({ id: "drafts", view: "topics", icon: "schema", count: schemasResource.data ? drafts.length : undefined, oldest: oldestDate(drafts), title: "Bản nháp chờ phê duyệt", detail: "Kiểm tra bản nháp chủ đề vật lý trước khi phát hành.", empty: "Không có bản nháp chủ đề đang chờ.", action: "Xem chủ đề", tone: "success", loading: schemasResource.loading, error: schemasResource.error });
  }
  const active = [
    access.canReview && libraryOldestResource,
    access.canReview && libraryCountsResource,
    canHandleComplaints && complaintCountsResource,
    access.canEdit && schemasResource,
    access.canEdit && gapsResource,
    access.canEdit && gapCountsResource,
  ].filter(item => item !== false);

  return {
    tasks,
    canHandleComplaints,
    libraryCounts: libraryCountsResource.data,
    complaintCounts: complaintCountsResource.data,
    schemas,
    openGaps,
    gapCounts: gapCountsResource.data,
    refreshing: active.some(item => item.refreshing),
    refresh: () => { void Promise.all(active.map(item => item.refresh())); },
  };
}

export function ReviewerOverview({ access, onOpen }: Readonly<{ access: ReviewerAccess; name?: string; onOpen: (view: ReviewerView) => void }>) {
  const topicName = useTopicName();
  const { tasks, canHandleComplaints, libraryCounts, complaintCounts, schemas, openGaps, gapCounts, refreshing, refresh } = useOverview(access);
  const failed = tasks.filter(task => task.error);
  const loaded = tasks.filter(task => task.count !== undefined).length;
  const ready = loaded === tasks.length && !failed.length;
  const pending = tasks.filter(task => (task.count ?? 0) > 0).sort((a, b) => (a.oldest ? Date.parse(a.oldest) : Infinity) - (b.oldest ? Date.parse(b.oldest) : Infinity) || (b.count ?? 0) - (a.count ?? 0));
  const total = tasks.reduce((sum, task) => sum + (task.count ?? 0), 0);
  const oldest = oldestDate(pending.map(task => ({ createdAt: task.oldest })));

  // Chart 1: Library moderation distribution & approval rate
  const libPending = libraryCounts?.PENDING ?? 0;
  const libApproved = libraryCounts?.APPROVED ?? 0;
  const libFeatured = libraryCounts?.FEATURED ?? 0;
  const libRejected = libraryCounts?.REJECTED ?? 0;
  const libRemoved = libraryCounts?.REMOVED ?? 0;
  const libDecided = libApproved + libFeatured + libRejected + libRemoved;
  const approvalRate = pct(libApproved + libFeatured, libDecided);
  const moderationSegments: DonutSegment[] = [
    { key: "PENDING", label: "Chờ duyệt", value: libPending, color: "#d97706" },
    { key: "APPROVED", label: "Đã duyệt", value: libApproved, color: "#15803d" },
    { key: "FEATURED", label: "Nổi bật", value: libFeatured, color: "#2563eb" },
    { key: "REJECTED", label: "Bị từ chối", value: libRejected, color: "#dc2626" },
    { key: "REMOVED", label: "Đã gỡ", value: libRemoved, color: "#64748b" },
  ];

  // Chart 2: Complaints status & SLA buckets (exact DB counts via /support/complaints/counts)
  const complaintOpen = complaintCounts?.open ?? 0;
  const complaintRead = complaintCounts?.read ?? 0;
  const complaintResolved = complaintCounts?.resolved ?? 0;
  const complaintTotal = complaintCounts?.total ?? 0;
  const complaintResolveRate = pct(complaintResolved, complaintTotal);
  const slaUnder24 = complaintCounts?.under24h ?? 0;
  const sla24to48 = complaintCounts?.from24To48h ?? 0;
  const slaOver48 = complaintCounts?.over48h ?? 0;
  const slaMax = Math.max(1, slaUnder24, sla24to48, slaOver48);

  // Chart 3: Open law gaps by kind (weighted by occurrences) + top impacted topics
  const gapByKind = (Object.keys(GAP_KIND_LABEL) as OpenGap["kind"][]).map(kind => {
    const matched = openGaps.filter(g => g.kind === kind);
    return {
      kind,
      label: GAP_KIND_LABEL[kind],
      items: matched.length,
      occurrences: matched.reduce((sum, item) => sum + item.occurrences, 0),
    };
  });
  const maxGapOcc = Math.max(1, ...gapByKind.map(g => g.occurrences));
  const topGapTopics = Array.from(
    openGaps.reduce((map, gap) => {
      if (!gap.topic) return map;
      map.set(gap.topic, (map.get(gap.topic) ?? 0) + gap.occurrences);
      return map;
    }, new Map<string, number>()).entries()
  ).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const gapTotalAll = (gapCounts?.OPEN ?? 0) + (gapCounts?.RESOLVED ?? 0) + (gapCounts?.DISMISSED ?? 0);
  const gapResolutionRate = pct((gapCounts?.RESOLVED ?? 0) + (gapCounts?.DISMISSED ?? 0), gapTotalAll);

  // Chart 4: Physics topics catalogue health
  const schemaApproved = schemas.filter(v => v.lifecycleStatus === "APPROVED").length;
  const schemaDraft = schemas.filter(v => v.lifecycleStatus === "DRAFT").length;
  const schemaRetired = schemas.filter(v => v.lifecycleStatus === "RETIRED").length;
  const uniqueTopics = new Set(schemas.map(v => v.schemaId.toLowerCase())).size;

  return <div className={s.dashboard} data-testid="reviewer-dashboard" data-analytics="dashboard" data-dashboard-role="reviewer">
    <RefreshButton disabled={refreshing} onClick={refresh} />
    {failed.length > 0 && <div className={s.error} role="alert"><span>Chưa cập nhật được: {failed.map(task => task.title).join(", ")}. Các nhóm còn lại vẫn có thể sử dụng.</span><Button variant="soft" onClick={refresh}>Thử lại</Button></div>}
    <section data-kpis className={s.stats} aria-label="Các nhóm công việc">{tasks.map(task => <article data-kpi key={task.id} className={s.stat + " " + s[task.tone]} data-task={task.id} data-pending={(task.count ?? 0) > 0} aria-busy={task.loading}>
      <h2><ReviewerIcon name={task.icon} />{task.title}</h2><strong aria-label={task.count == null ? "Chưa có số liệu" : number(task.count) + " mục"}>{task.count == null ? "—" : number(task.count)}</strong><p title={task.count === 0 ? task.empty : undefined}>{task.error ? "Chưa cập nhật được số liệu" : task.count == null ? "Đang tải công việc…" : task.count > 0 ? "Đang chờ xử lý" : "Không có việc đang chờ"}</p><Button variant="ghost" onClick={() => onOpen(task.view)}>{task.action}<ReviewerIcon name="arrow" size={16} /></Button>
    </article>)}</section>

    <div className={s.content}>
      <div className={s.main}>
      <section className={s.chartsGrid} aria-label="Thống kê kiểm duyệt và chất lượng dữ liệu">
        {access.canReview && <article className={s.panel} aria-labelledby="rev-chart-moderation">
          <div className={s.panelHeading}>
            <div>
              <h2 id="rev-chart-moderation">Phân bổ kiểm duyệt mô phỏng</h2>
              <p>{libDecided > 0 ? `Tỷ lệ đạt duyệt ${approvalRate}% trên ${number(libDecided)} mô phỏng đã xử lý.` : "Theo dõi chất lượng mô phỏng giáo viên chia sẻ công khai."}</p>
            </div>
            <Button variant="ghost" onClick={() => onOpen("moderation")}>Mở danh sách<ReviewerIcon name="arrow" size={16} /></Button>
          </div>
          <DonutChart
            segments={moderationSegments}
            centerValue={libDecided > 0 ? `${approvalRate}%` : number(libPending)}
            centerLabel={libDecided > 0 ? "Đạt duyệt" : "Chờ duyệt"}
            ariaLabel={moderationSegments.map(item => `${item.label}: ${item.value}`).join(", ")}
          />
        </article>}

        {canHandleComplaints && <article className={s.panel} aria-labelledby="rev-chart-complaints">
          <div className={s.panelHeading}>
            <div>
              <h2 id="rev-chart-complaints">Xử lý khiếu nại & thời gian chờ</h2>
              <p>{complaintTotal > 0 ? `Đã giải quyết ${complaintResolveRate}% (${number(complaintResolved)}/${number(complaintTotal)} khiếu nại).` : "Chưa có khiếu nại mô phỏng nào được ghi nhận."}</p>
            </div>
            <Button variant="ghost" onClick={() => onOpen("complaints")}>Xử lý<ReviewerIcon name="arrow" size={16} /></Button>
          </div>
          <div className={s.stackedBar} role="img" aria-label={`Mới: ${complaintOpen}, Đang xem xét: ${complaintRead}, Đã giải quyết: ${complaintResolved}`}>
            {complaintTotal > 0 ? <>
              {complaintResolved > 0 && <span style={{ width: `${pct(complaintResolved, complaintTotal)}%`, background: "#15803d" }} title={`Đã giải quyết: ${complaintResolved}`} />}
              {complaintRead > 0 && <span style={{ width: `${pct(complaintRead, complaintTotal)}%`, background: "#2563eb" }} title={`Đang xem xét: ${complaintRead}`} />}
              {complaintOpen > 0 && <span style={{ width: `${pct(complaintOpen, complaintTotal)}%`, background: "#d97706" }} title={`Mới tiếp nhận: ${complaintOpen}`} />}
            </> : <span style={{ width: "100%", background: "var(--m3-surface-container)" }} />}
          </div>
          <div className={s.miniStats}>
            <span><i style={{ background: "#d97706" }} />Mới: <strong>{number(complaintOpen)}</strong></span>
            <span><i style={{ background: "#2563eb" }} />Đang xem xét: <strong>{number(complaintRead)}</strong></span>
            <span><i style={{ background: "#15803d" }} />Đã giải quyết: <strong>{number(complaintResolved)}</strong></span>
          </div>
          <div className={s.subBlock}>
            <h3>Tuổi hàng đợi khiếu nại chưa giải quyết</h3>
            <ul className={s.hBars}>
              <li><span>Dưới 24 giờ</span><div className={s.barTrack}><i style={{ width: `${(slaUnder24 / slaMax) * 100}%`, background: "#2563eb" }} /></div><strong>{number(slaUnder24)}</strong></li>
              <li><span>24 – 48 giờ</span><div className={s.barTrack}><i style={{ width: `${(sla24to48 / slaMax) * 100}%`, background: "#d97706" }} /></div><strong>{number(sla24to48)}</strong></li>
              <li><span>Quá 48 giờ (cần gấp)</span><div className={s.barTrack}><i style={{ width: `${(slaOver48 / slaMax) * 100}%`, background: "#dc2626" }} /></div><strong>{number(slaOver48)}</strong></li>
            </ul>
          </div>
        </article>}

        {access.canEdit && <article className={s.panel} aria-labelledby="rev-chart-gaps">
          <div className={s.panelHeading}>
            <div>
              <h2 id="rev-chart-gaps">Lỗ hổng định luật theo tác động</h2>
              <p>{gapTotalAll > 0 ? `Đã rà soát ${gapResolutionRate}% (${number((gapCounts?.RESOLVED ?? 0) + (gapCounts?.DISMISSED ?? 0))}/${number(gapTotalAll)} mục).` : "Tổng hợp số lần mô phỏng gặp đại lượng chưa có định luật kiểm."}</p>
            </div>
            <Button variant="ghost" onClick={() => onOpen("gaps")}>Rà soát<ReviewerIcon name="arrow" size={16} /></Button>
          </div>
          <ul className={s.hBars}>
            {gapByKind.map(row => <li key={row.kind}>
              <span>{row.label} <small>({number(row.items)} mục)</small></span>
              <div className={s.barTrack}><i style={{ width: `${row.occurrences > 0 ? Math.max(6, (row.occurrences / maxGapOcc) * 100) : 0}%`, background: row.kind === "VIOLATION" ? "#dc2626" : row.kind === "AMBIGUOUS" ? "#d97706" : "#315da8" }} /></div>
              <strong>{number(row.occurrences)} lần</strong>
            </li>)}
          </ul>
          {topGapTopics.length > 0 && <div className={s.subBlock}>
            <h3>Chủ đề cần ưu tiên bổ sung định luật</h3>
            <div className={s.topicChips}>
              {topGapTopics.map(([topic, count]) => <Badge key={topic} color="indigo" variant="soft">{topicName(topic)} · {number(count)} lần</Badge>)}
            </div>
          </div>}
        </article>}

        {access.canEdit && <article className={s.panel} aria-labelledby="rev-chart-schemas">
          <div className={s.panelHeading}>
            <div>
              <h2 id="rev-chart-schemas">Tình trạng bộ dữ liệu Chủ đề vật lý</h2>
              <p>Hiện có {number(uniqueTopics)} chủ đề với {number(schemas.length)} phiên bản trong hệ thống.</p>
            </div>
            <Button variant="ghost" onClick={() => onOpen("topics")}>Quản lý<ReviewerIcon name="arrow" size={16} /></Button>
          </div>
          <div className={s.stackedBar} role="img" aria-label={`Đang dùng: ${schemaApproved}, Bản nháp: ${schemaDraft}, Ngừng dùng: ${schemaRetired}`}>
            {schemas.length > 0 ? <>
              {schemaApproved > 0 && <span style={{ width: `${pct(schemaApproved, schemas.length)}%`, background: "#15803d" }} title={`Đang dùng: ${schemaApproved}`} />}
              {schemaDraft > 0 && <span style={{ width: `${pct(schemaDraft, schemas.length)}%`, background: "#d97706" }} title={`Bản nháp: ${schemaDraft}`} />}
              {schemaRetired > 0 && <span style={{ width: `${pct(schemaRetired, schemas.length)}%`, background: "#64748b" }} title={`Ngừng dùng: ${schemaRetired}`} />}
            </> : <span style={{ width: "100%", background: "var(--m3-surface-container)" }} />}
          </div>
          <ul className={s.hBars} style={{ marginTop: 14 }}>
            <li><span>Đang dùng (đã phát hành)</span><div className={s.barTrack}><i style={{ width: `${pct(schemaApproved, schemas.length)}%`, background: "#15803d" }} /></div><strong>{number(schemaApproved)}</strong></li>
            <li><span>Bản nháp chờ phê duyệt</span><div className={s.barTrack}><i style={{ width: `${pct(schemaDraft, schemas.length)}%`, background: "#d97706" }} /></div><strong>{number(schemaDraft)}</strong></li>
            <li><span>Phiên bản ngừng dùng</span><div className={s.barTrack}><i style={{ width: `${pct(schemaRetired, schemas.length)}%`, background: "#64748b" }} /></div><strong>{number(schemaRetired)}</strong></li>
          </ul>
        </article>}
      </section>
        <section className={s.panel} aria-labelledby="reviewer-priority-title"><div className={s.panelHeading}><div><h2 id="reviewer-priority-title">Ưu tiên xử lý</h2><p>Nhóm có yêu cầu cũ nhất được xếp trước.</p></div><span className={s.sectionIcon}><ReviewerIcon name="queue" /></span></div>
          {pending.length > 0 ? <ul className={s.priorityList}>{pending.map(task => <li key={task.id}><span className={s.rowIcon}><ReviewerIcon name={task.icon} /></span><div className={s.taskCopy}><div><h3>{task.title}</h3><Badge color="amber">{number(task.count!)} mục</Badge></div><p>{task.detail}</p>{task.oldest && <small><ReviewerIcon name="clock" size={14} />Cũ nhất {timeAgo(task.oldest)}</small>}{task.error && <small className={s.warningText}>Đang hiển thị số liệu gần nhất.</small>}</div><Button variant="soft" onClick={() => onOpen(task.view)} aria-label={task.action + ": " + task.title}>Xử lý<ReviewerIcon name="arrow" size={16} /></Button></li>)}</ul> : <div className={s.empty}><span><ReviewerIcon name={ready ? "check" : "queue"} size={28} /></span><h3>{ready ? "Đã xử lý hết công việc" : failed.length ? "Chưa thể tổng hợp công việc" : "Đang tổng hợp công việc"}</h3><p>{ready ? "Bạn có thể xem lại các nhóm công việc hoặc cập nhật dữ liệu chuẩn." : failed.length ? "Thử làm mới để kiểm tra lại các nhóm chưa tải được." : "Số liệu sẽ xuất hiện khi tải xong."}</p></div>}
        </section>
      </div>
      <aside className={s.aside} aria-label="Tình trạng và phạm vi công việc"><ReportChart title="Phân bổ công việc" description="Các mục đang chờ theo từng nhóm." variant="donut" unit="mục đang chờ" items={tasks.filter(task => !task.error).map(task => ({ label: task.title, value: task.count }))} />
        <section className={s.queueSummary} aria-labelledby="reviewer-queue-title"><span className={s.summaryIcon}><ReviewerIcon name="clock" size={24} /></span><h2 id="reviewer-queue-title">Tình trạng hàng đợi</h2><dl><div><dt>Công việc đang chờ</dt><dd>{ready ? number(total) : "—"}</dd></div><div><dt>Nhóm còn công việc</dt><dd>{ready ? number(pending.length) + " / " + number(tasks.length) : loaded + " / " + tasks.length + " nhóm đã tải"}</dd></div><div><dt>Yêu cầu cũ nhất</dt><dd>{oldest ? timeAgo(oldest) : "—"}</dd></div></dl></section>
        <details className="reviewer-role-guide"><summary>Phạm vi công việc</summary><section data-panel className={s.panel + " " + s.guide} aria-labelledby="reviewer-scope-title"><div className={s.panelHeading}><div><h2 id="reviewer-scope-title">Phạm vi công việc</h2><p>Các chức năng tài khoản được cấp.</p></div></div><ul>
          {access.canReview && <li><span className={s.guideIcon}><ReviewerIcon name="eye" /></span><div><h3>Kiểm duyệt nội dung</h3><p>Xem, phê duyệt hoặc từ chối mô phỏng chia sẻ công khai.</p></div></li>}
          {canHandleComplaints && <li><span className={s.guideIcon}><ReviewerIcon name="message" /></span><div><h3>Hỗ trợ giáo viên</h3><p>Kiểm tra báo lỗi và phản hồi kết quả xử lý mô phỏng.</p></div></li>}
          {access.canEdit && <li><span className={s.guideIcon}><ReviewerIcon name="edit" /></span><div><h3>Biên soạn dữ liệu chuẩn</h3><p>Quản lý chủ đề, định luật và các bản nháp chờ phát hành.</p></div></li>}
        </ul>{!access.isManager && (!access.canEdit || !access.canReview) && <p className={s.accessNote}>Liên hệ bộ phận vận hành nếu cần thêm quyền.</p>}</section></details>
      </aside>
    </div>
  </div>;
}
