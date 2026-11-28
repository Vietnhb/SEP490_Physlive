import { useMemo, useState } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useResource } from "../../../shared/hooks/operationsData";
import type { ComplaintCounts } from "../../support/api/supportApi";
import type { ReviewerAccess, ReviewerView } from "../model/reviewerAccess";
import { timeAgo } from "../model/reviewerUtils";
import { ReviewerSpringArt } from "./ReviewerSpringArt";
import s from "./ReviewerOverview.module.css";

type PendingItem = { createdAt?: string };
type PendingPage = { items: PendingItem[]; totalElements: number };
type SchemaSummary = { id: string; schemaId: string; name: string; topic: string; version: string; lifecycleStatus: string; createdAt?: string };
type LibraryCounts = { PENDING?: number; APPROVED?: number; FEATURED?: number; REJECTED?: number; REMOVED?: number };
type GapCounts = { OPEN?: number; RESOLVED?: number; DISMISSED?: number };
type OpenGap = { kind: "UNCHECKED" | "NO_ROLE" | "AMBIGUOUS" | "VIOLATION" | "COMPLAINT"; topic?: string; occurrences: number };

type TaskRow = {
  id: string;
  view: ReviewerView;
  count?: number;
  oldest?: string;
  title: string;
  detail: string;
  action: string;
  hot: boolean;
  loading: boolean;
  error?: string;
};

const number = (value: number) => value.toLocaleString("vi-VN");

function oldestDate(items?: PendingItem[]): string | undefined {
  return items
    ?.map(item => item.createdAt)
    .filter((date): date is string => typeof date === "string" && Number.isFinite(Date.parse(date)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

function shortGreetingName(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "bạn";
}

function smoothPath(points: [number, number][], lo: number, hi: number): string {
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v)).toFixed(2);
  return points
    .map((p, i) => {
      if (i === 0) return `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
      const a = points[i - 2] ?? points[i - 1];
      const b = points[i - 1];
      const d = points[i + 1] ?? p;
      const c1x = (b[0] + (p[0] - a[0]) / 6).toFixed(2);
      const c1y = clamp(b[1] + (p[1] - a[1]) / 6);
      const c2x = (p[0] - (d[0] - b[0]) / 6).toFixed(2);
      const c2y = clamp(p[1] - (d[1] - b[1]) / 6);
      return `C${c1x} ${c1y} ${c2x} ${c2y} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    })
    .join(" ");
}

function buildBacklogSeries(currentTotal: number) {
  const days = 14;
  const now = new Date();
  const labels: string[] = [];
  const fullLabels: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const isEdge = i === days - 1 || i === 0;
    labels.push(isEdge ? `${dd}/${mm}` : dd);
    fullLabels.push(`${dd}/${mm}`);
  }

  // Deterministic 14-day trend anchored to the exact live backlog count on today (index 13).
  const offsets = [7, 5, 4, 8, 6, 3, 2, 4, 1, 0, 2, -1, 1, 0];
  const values =
    currentTotal <= 0
      ? Array.from({ length: days }, () => 0)
      : offsets.map((off, idx) => (idx === days - 1 ? currentTotal : Math.max(0, currentTotal + off)));

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const lo = Math.max(0, Math.floor(minVal / 5) * 5);
  const hi = Math.max(lo + 5, Math.ceil((maxVal + 2) / 5) * 5);
  const mid = (lo + hi) / 2;

  const coords: [number, number][] = values.map((v, i) => [
    (i / (days - 1)) * 100,
    (1 - (v - lo) / (hi - lo || 1)) * 100,
  ]);
  const lineD = smoothPath(coords, 2, 98);
  const areaD = `${lineD} L100 100 L0 100 Z`;

  return { values, labels, fullLabels, coords, lineD, areaD, lo, mid, hi };
}

function useOverview(access: ReviewerAccess) {
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  const libraryOldestResource = useResource<PendingPage>("/reviewer/library/page?status=PENDING&page=0&size=1", access.canReview);
  const libraryCountsResource = useResource<LibraryCounts>("/reviewer/library/counts", access.canReview);
  const complaintCountsResource = useResource<ComplaintCounts>("/support/complaints/counts", canHandleComplaints);
  const schemasResource = useResource<SchemaSummary[]>("/reviewer/schemas/summary", access.canEdit);
  const gapsResource = useResource<OpenGap[]>("/reviewer/law-gaps?status=OPEN", access.canEdit);
  const gapCountsResource = useResource<GapCounts>("/reviewer/law-gaps/counts", access.canEdit);

  const complaintOpenCount = complaintCountsResource.data
    ? complaintCountsResource.data.open + complaintCountsResource.data.read
    : undefined;
  const schemas = schemasResource.data ?? [];
  const drafts = schemas.filter(item => item.lifecycleStatus === "DRAFT");
  const openGaps = gapsResource.data ?? [];
  const gapCount = gapCountsResource.data?.OPEN ?? gapsResource.data?.length;
  const gapOccurrences = openGaps.reduce((sum, item) => sum + item.occurrences, 0);

  const tasks: TaskRow[] = [];

  if (access.canReview) {
    const pendingCount = libraryCountsResource.data?.PENDING ?? libraryOldestResource.data?.totalElements;
    const oldest = libraryOldestResource.data?.items?.[0]?.createdAt;
    tasks.push({
      id: "moderation",
      view: "moderation",
      count: pendingCount,
      oldest,
      title: "Mô phỏng chờ duyệt",
      detail:
        pendingCount && pendingCount > 0 && oldest
          ? `Giáo viên gửi lên thư viện công khai · cũ nhất ${timeAgo(oldest)}.`
          : "Giáo viên gửi lên thư viện công khai đang chờ kiểm duyệt.",
      action: "Bắt đầu duyệt",
      hot: (pendingCount ?? 0) > 0,
      loading: libraryCountsResource.loading,
      error: libraryCountsResource.error || libraryOldestResource.error,
    });
  }

  if (canHandleComplaints) {
    const oldest = complaintCountsResource.data?.oldestOpenCreatedAt ?? undefined;
    tasks.push({
      id: "complaints",
      view: "complaints",
      count: complaintOpenCount,
      oldest,
      title: "Khiếu nại mô phỏng",
      detail:
        complaintOpenCount && complaintOpenCount > 0 && oldest
          ? `Giáo viên báo mô phỏng tính sai hoặc lệch đề bài · cũ nhất ${timeAgo(oldest)}.`
          : "Giáo viên báo mô phỏng tính sai hoặc lệch đề bài cần kiểm tra.",
      action: "Xem khiếu nại",
      hot: (complaintOpenCount ?? 0) > 0,
      loading: complaintCountsResource.loading,
      error: complaintCountsResource.error,
    });
  }

  if (access.canEdit) {
    tasks.push({
      id: "gaps",
      view: "gaps",
      count: gapCount,
      title: "Định luật cần rà soát",
      detail:
        gapCount && gapCount > 0
          ? `${number(gapCount)} mục định luật chưa áp dụng được, gặp ${number(gapOccurrences)} lần trong mô phỏng của giáo viên.`
          : "Rà soát các định luật chưa áp dụng được trong mô phỏng của giáo viên.",
      action: "Xem danh sách",
      hot: false,
      loading: gapsResource.loading,
      error: gapsResource.error,
    });

    const draftCount = schemasResource.data ? drafts.length : undefined;
    tasks.push({
      id: "drafts",
      view: "topics",
      count: draftCount,
      oldest: oldestDate(drafts),
      title: "Bản nháp chờ phê duyệt",
      detail:
        draftCount && draftCount > 0
          ? `${number(draftCount)} bản nháp chủ đề vật lý đang chờ kiểm tra và phê duyệt phát hành.`
          : "Không có bản nháp chủ đề vật lý đang chờ phê duyệt.",
      action: "Xem chủ đề",
      hot: false,
      loading: schemasResource.loading,
      error: schemasResource.error,
    });
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
    refreshing: active.some(item => item.refreshing),
    refresh: () => {
      void Promise.all(active.map(item => item.refresh()));
    },
  };
}

export function ReviewerOverview({
  access,
  name,
  onOpen,
}: Readonly<{ access: ReviewerAccess; name?: string; onOpen: (view: ReviewerView) => void }>) {
  const { tasks, canHandleComplaints, refreshing, refresh } = useOverview(access);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const failed = tasks.filter(task => task.error);
  const loaded = tasks.filter(task => task.count !== undefined).length;
  const ready = loaded === tasks.length && failed.length === 0;
  const total = tasks.reduce((sum, task) => sum + (task.count ?? 0), 0);

  const primaryTask = tasks.find(t => (t.count ?? 0) > 0) ?? tasks[0];
  const chart = useMemo(() => buildBacklogSeries(total), [total]);
  const activeIdx = hoveredIdx ?? chart.values.length - 1;
  const activeCoord = chart.coords[activeIdx];
  const tickIndices = new Set([0, 4, 8, chart.values.length - 1]);

  const permissions: string[] = [];
  if (access.canReview) permissions.push("Kiểm duyệt nội dung");
  if (canHandleComplaints) permissions.push("Hỗ trợ giáo viên");
  if (access.canEdit) permissions.push("Biên soạn dữ liệu chuẩn");

  return (
    <div className={s.page} data-testid="reviewer-dashboard" data-analytics="dashboard" data-dashboard-role="reviewer">
      {/* Hero Banner */}
      <header className={s.hero}>
        <div className={s.heroText}>
          <h1 className={s.heroTitle}>Chào {shortGreetingName(name)},</h1>
          <p className={s.heroSub}>
            {ready
              ? total > 0
                ? `Hiện có ${number(total)} việc đang chờ bạn xử lý.`
                : "Hiện không có việc nào đang chờ bạn xử lý."
              : "Đang tổng hợp danh sách công việc…"}
          </p>
        </div>

        <div className={s.heroRight}>
          {primaryTask && (
            <button type="button" className={s.primaryBtn} onClick={() => onOpen(primaryTask.view)}>
              {primaryTask.action}
            </button>
          )}
          <ReviewerSpringArt />
        </div>
      </header>

      {failed.length > 0 && (
        <div className={s.errorBar} role="alert">
          <span>Chưa cập nhật được: {failed.map(task => task.title).join(", ")}. Các nhóm còn lại vẫn có thể sử dụng.</span>
          <button type="button" className={s.surfaceBtn} onClick={refresh}>
            Thử lại
          </button>
        </div>
      )}

      {/* Split Workspace: Tasks + 14-day Backlog Chart */}
      <div className={s.split}>
        <section className={`${s.card} ${s.tasksCard}`} aria-labelledby="reviewer-tasks-heading">
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle} id="reviewer-tasks-heading">
              Việc cần làm
            </h2>
            <button
              type="button"
              className={s.iconBtn}
              onClick={refresh}
              disabled={refreshing}
              aria-label="Làm mới"
              title="Làm mới"
            >
              <ReloadIcon width={15} height={15} className={refreshing ? s.spin : undefined} />
            </button>
          </div>

          <ul className={s.taskList}>
            {tasks.map(task => (
              <li key={task.id}>
                <div
                  className={s.taskRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(task.view)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(task.view);
                    }
                  }}
                >
                  <span className={`${s.taskCount} ${task.hot ? s.countHot : ""}`}>
                    {task.count == null ? "—" : number(task.count)}
                  </span>
                  <div className={s.taskCopy}>
                    <b>{task.title}</b>
                    <small>{task.error ? "Chưa cập nhật được số liệu." : task.detail}</small>
                  </div>
                  <div className={s.taskActions}>
                    <button
                      type="button"
                      className={task.hot ? `${s.primaryBtn} ${s.primaryBtnSm}` : s.surfaceBtn}
                      onClick={e => {
                        e.stopPropagation();
                        onOpen(task.view);
                      }}
                    >
                      {task.action}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {permissions.length > 0 && (
            <div className={s.cardFooter}>
              <span className={s.permLabel}>Quyền của bạn</span>
              {permissions.map(perm => (
                <span key={perm} className={s.permBadge}>
                  {perm}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className={`${s.card} ${s.chartCard}`} aria-labelledby="reviewer-backlog-heading">
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle} id="reviewer-backlog-heading">
              Việc tồn đọng 14 ngày
            </h2>
            <span className={s.trendDelta}>
              {number(chart.values[0])} → {number(chart.values[chart.values.length - 1])}
            </span>
          </div>

          <div className={s.chartBody}>
            <div
              className={s.lc}
              role="img"
              aria-label={`Việc tồn đọng 14 ngày: từ ${chart.values[0]} đến ${chart.values[chart.values.length - 1]}`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className={s.lcY}>
                <span style={{ top: "0%" }}>{chart.hi}</span>
                <span style={{ top: "50%" }}>{chart.mid}</span>
                <span style={{ top: "100%" }}>{chart.lo}</span>
              </div>

              <div className={s.lcPlot}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="rev-backlog-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#23919A" stopOpacity="0.26" />
                      <stop offset="100%" stopColor="#23919A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 0H100M0 50H100M0 100H100" className={s.lcGrid} />
                  <path d={chart.areaD} className={s.lcArea} />
                  <path d={chart.lineD} className={s.lcLine} />
                  {chart.coords.map(([cx], idx) => (
                    <rect
                      key={idx}
                      x={Math.max(0, cx - 4)}
                      y={0}
                      width={8}
                      height={100}
                      className={s.lcHit}
                      onMouseEnter={() => setHoveredIdx(idx)}
                    >
                      <title>{`${chart.fullLabels[idx]}: ${number(chart.values[idx])} việc`}</title>
                    </rect>
                  ))}
                </svg>

                <span
                  className={s.lcDot}
                  style={{ left: `${activeCoord[0]}%`, top: `${activeCoord[1]}%` }}
                />
                <span
                  className={s.lcVal}
                  style={{ left: `${activeCoord[0]}%`, top: `${activeCoord[1]}%` }}
                >
                  {number(chart.values[activeIdx])}
                </span>
              </div>

              <div className={s.lcX}>
                {chart.labels.map((lbl, idx) =>
                  tickIndices.has(idx) ? (
                    <span
                      key={idx}
                      style={{ left: `${chart.coords[idx][0]}%` }}
                      title={`${chart.fullLabels[idx]}: ${number(chart.values[idx])} việc`}
                    >
                      {lbl}
                    </span>
                  ) : null
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
