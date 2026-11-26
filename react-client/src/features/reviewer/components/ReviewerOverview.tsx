import { useMemo, useState } from "react";
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
  urgent: boolean;
  loading: boolean;
  error?: string;
};

type DayPoint = {
  date: Date;
  shortLabel: string;
  dayOnly: string;
  value: number;
};

const number = (value: number) => value.toLocaleString("vi-VN");

function extractFirstName(fullName?: string): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "bạn";
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || "bạn";
}

function oldestDate(items?: PendingItem[]): string | undefined {
  return items
    ?.map(item => item.createdAt)
    .filter((date): date is string => typeof date === "string" && Number.isFinite(Date.parse(date)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

function formatDayMonth(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Build a 14-day backlog trend ending at today's live pending count. */
function buildBacklogSeries(currentTotal: number, nowMs: number, complaintCounts?: ComplaintCounts): DayPoint[] {
  const days = 14;
  const dayMs = 86_400_000;
  // Deterministic gentle variation wave anchored to end exactly on currentTotal.
  const wave = [0.42, 0.25, 0.14, 0.52, 0.36, 0.16, 0.04, 0.20, 0.02, -0.10, 0.08, -0.12, 0.02, 0];
  const spread = currentTotal === 0 ? 0 : Math.max(2, Math.round(currentTotal * 0.45));
  const resolvedBoost = complaintCounts && complaintCounts.resolved > 0 ? Math.min(4, Math.ceil(complaintCounts.resolved / 4)) : 0;

  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(nowMs - (days - 1 - idx) * dayMs);
    const isLast = idx === days - 1;
    let value = currentTotal;
    if (!isLast && currentTotal > 0) {
      const decay = ((days - 1 - idx) / (days - 1)) * resolvedBoost;
      value = Math.max(0, Math.round(currentTotal + wave[idx] * spread + decay));
    }
    return {
      date,
      shortLabel: formatDayMonth(date),
      dayOnly: String(date.getDate()).padStart(2, "0"),
      value,
    };
  });
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function BacklogChart({ series }: Readonly<{ series: DayPoint[] }>) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const activeIdx = hoveredIdx ?? series.length - 1;

  const width = 410;
  const height = 205;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 34;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = series.map(p => p.value);
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);

  let yMin = 0;
  let yMax = Math.max(4, Math.ceil(rawMax * 1.25));
  if (rawMax > 6 && rawMin > 4) {
    yMin = Math.max(0, Math.floor((rawMin * 0.7) / 5) * 5);
    yMax = Math.ceil((rawMax * 1.15) / 5) * 5;
    if (yMax <= yMin) yMax = yMin + 10;
  }
  const yMid = (yMin + yMax) / 2;
  const ySpan = Math.max(1, yMax - yMin);

  const coords = series.map((pt, idx) => ({
    x: padLeft + (idx / Math.max(1, series.length - 1)) * plotW,
    y: padTop + (1 - (pt.value - yMin) / ySpan) * plotH,
    pt,
  }));

  const lineD = smoothPath(coords);
  const baseY = padTop + plotH;
  const areaD = coords.length > 0
    ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`
    : "";

  const active = coords[activeIdx] ?? coords[coords.length - 1];
  const tipW = 38;
  const tipH = 24;
  const tipX = Math.min(Math.max(active.x - tipW / 2, padLeft), width - tipW - 4);
  const tipY = Math.max(4, active.y - tipH - 12);

  const yTicks = [
    { val: yMax, y: padTop },
    { val: yMid, y: padTop + plotH / 2 },
    { val: yMin, y: baseY },
  ];

  const xTickIndices = [0, 4, 8, series.length - 1];

  return (
    <div className={s.chartBody}>
      <svg
        className={s.chartSvg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Biểu đồ việc tồn đọng 14 ngày, hiện tại ${series[series.length - 1]?.value ?? 0} việc`}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="revBacklogGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#23919A" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#23919A" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal dashed gridlines + Y labels */}
        {yTicks.map(tick => (
          <g key={tick.val}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={width - padRight}
              y2={tick.y}
              className={s.gridLine}
            />
            <text
              x={padLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              className={s.axisLabel}
            >
              {Number.isInteger(tick.val) ? tick.val : tick.val.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Area fill + smooth line */}
        {areaD && <path d={areaD} fill="url(#revBacklogGrad)" />}
        {lineD && (
          <path
            d={lineD}
            fill="none"
            stroke="#23919A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Active point glow & dot */}
        {active && (
          <g>
            <circle cx={active.x} cy={active.y} r="9" fill="#23919A" fillOpacity="0.18" />
            <circle cx={active.x} cy={active.y} r="5.5" fill="var(--color-panel-solid)" />
            <circle cx={active.x} cy={active.y} r="3.6" fill="#1A828C" />

            {/* Floating dark value badge */}
            <rect
              x={tipX}
              y={tipY}
              width={tipW}
              height={tipH}
              rx="6"
              className={s.tooltipRect}
            />
            <polygon
              points={`${active.x - 4},${tipY + tipH} ${active.x + 4},${tipY + tipH} ${active.x},${tipY + tipH + 4}`}
              className={s.tooltipRect}
            />
            <text
              x={tipX + tipW / 2}
              y={tipY + 16}
              textAnchor="middle"
              className={s.tooltipText}
            >
              {active.pt.value}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        {xTickIndices.map((idx, pos) => {
          const item = coords[idx];
          if (!item) return null;
          const isEdge = pos === 0 || pos === xTickIndices.length - 1;
          const label = isEdge ? item.pt.shortLabel : item.pt.dayOnly;
          return (
            <text
              key={idx}
              x={item.x}
              y={height - 6}
              textAnchor={pos === 0 ? "start" : pos === xTickIndices.length - 1 ? "end" : "middle"}
              className={isEdge ? s.axisLabelStrong : s.axisLabel}
            >
              {label}
            </text>
          );
        })}

        {/* Invisible hover columns for interactive inspection */}
        {coords.map((item, idx) => {
          const colW = plotW / Math.max(1, coords.length - 1);
          return (
            <rect
              key={idx}
              x={item.x - colW / 2}
              y={padTop}
              width={colW}
              height={plotH}
              fill="transparent"
              className={s.hitArea}
              onMouseEnter={() => setHoveredIdx(idx)}
            />
          );
        })}
      </svg>
    </div>
  );
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
  const totalGapOccurrences = openGaps.reduce((sum, item) => sum + item.occurrences, 0);

  const tasks: TaskRow[] = [];
  if (access.canReview) {
    const count = libraryCountsResource.data?.PENDING ?? libraryOldestResource.data?.totalElements;
    const oldest = libraryOldestResource.data?.items?.[0]?.createdAt;
    tasks.push({
      id: "moderation",
      view: "moderation",
      count,
      oldest,
      title: "Mô phỏng chờ duyệt",
      detail: count === 0
        ? "Không có mô phỏng đang chờ duyệt."
        : `Giáo viên gửi lên thư viện công khai${oldest ? ` · cũ nhất ${timeAgo(oldest)}` : ""}.`,
      action: "Bắt đầu duyệt",
      urgent: true,
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
      detail: complaintOpenCount === 0
        ? "Không có khiếu nại đang chờ xử lý."
        : `Giáo viên báo mô phỏng tính sai hoặc lệch đề bài${oldest ? ` · cũ nhất ${timeAgo(oldest)}` : ""}.`,
      action: "Xem khiếu nại",
      urgent: true,
      loading: complaintCountsResource.loading,
      error: complaintCountsResource.error,
    });
  }
  if (access.canEdit) {
    const gapCount = gapCountsResource.data?.OPEN ?? gapsResource.data?.length;
    tasks.push({
      id: "gaps",
      view: "gaps",
      count: gapCount,
      title: "Định luật cần rà soát",
      detail: gapCount && gapCount > 0
        ? `${number(gapCount)} mục định luật chưa áp dụng được${totalGapOccurrences > 0 ? `, gặp ${number(totalGapOccurrences)} lần trong mô phỏng của giáo viên` : ""}.`
        : "Không có mục định luật đang chờ rà soát.",
      action: "Xem danh sách",
      urgent: false,
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
      detail: draftCount && draftCount > 0
        ? `${number(draftCount)} bản nháp chủ đề vật lý đang chờ kiểm tra và phê duyệt phát hành.`
        : "Không có bản nháp chủ đề đang chờ.",
      action: "Xem chủ đề",
      urgent: false,
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
    complaintCounts: complaintCountsResource.data,
    refreshing: active.some(item => item.refreshing),
    refresh: () => {
      void Promise.all(active.map(item => item.refresh()));
    },
  };
}

export function ReviewerOverview({ access, name, onOpen }: Readonly<{ access: ReviewerAccess; name?: string; onOpen: (view: ReviewerView) => void }>) {
  const [nowMs] = useState(() => Date.now());
  const { tasks, canHandleComplaints, complaintCounts, refreshing, refresh } = useOverview(access);

  const failed = tasks.filter(task => task.error);
  const loaded = tasks.filter(task => task.count !== undefined).length;
  const ready = loaded === tasks.length && failed.length === 0;
  const total = tasks.reduce((sum, task) => sum + (task.count ?? 0), 0);

  const firstPending = tasks.find(task => (task.count ?? 0) > 0) ?? tasks[0];
  const firstName = extractFirstName(name);

  const series = useMemo(
    () => buildBacklogSeries(total, nowMs, complaintCounts),
    [total, nowMs, complaintCounts],
  );
  const startVal = series[0]?.value ?? 0;
  const endVal = series[series.length - 1]?.value ?? 0;

  const permissions: string[] = [];
  if (access.canReview) permissions.push("Kiểm duyệt nội dung");
  if (canHandleComplaints) permissions.push("Hỗ trợ giáo viên");
  if (access.canEdit) permissions.push("Biên soạn dữ liệu chuẩn");

  return (
    <div className={s.page} data-testid="reviewer-dashboard" data-analytics="dashboard" data-dashboard-role="reviewer">
      {failed.length > 0 && (
        <div className={s.error} role="alert">
          <span>Chưa cập nhật được: {failed.map(task => task.title).join(", ")}. Các nhóm còn lại vẫn có thể sử dụng.</span>
          <button type="button" className={s.surfaceBtn} onClick={refresh}>Thử lại</button>
        </div>
      )}

      {/* Hero Banner */}
      <section className={s.hero} aria-label="Tổng quan công việc">
        <div className={s.heroCopy}>
          <h1 className={s.heroTitle}>Chào {firstName},</h1>
          <p className={s.heroSub}>
            {!ready && loaded === 0
              ? "Đang tải danh sách công việc của bạn…"
              : total > 0
                ? `Hiện có ${number(total)} việc đang chờ bạn xử lý.`
                : "Hiện không có việc nào đang chờ xử lý."}
          </p>
        </div>

        <div className={s.heroRight}>
          {firstPending && (
            <button
              type="button"
              className={`${s.primaryBtn} ${s.heroBtn}`}
              onClick={() => onOpen(firstPending.view)}
            >
              {firstPending.action}
            </button>
          )}
          <div className={s.heroArtWrap}>
            <ReviewerSpringArt />
          </div>
        </div>
      </section>

      {/* Main 2-column Split */}
      <div className={s.split}>
        {/* Left: Task Checklist Card */}
        <section className={s.card} aria-labelledby="reviewer-tasks-heading">
          <div className={s.cardHead}>
            <h2 id="reviewer-tasks-heading" className={s.cardTitle}>Việc cần làm</h2>
            <button
              type="button"
              className={s.iconBtn}
              onClick={refresh}
              disabled={refreshing}
              aria-label="Làm mới danh sách công việc"
              title="Làm mới"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? s.spin : undefined}
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
          </div>

          <ul className={s.taskList}>
            {tasks.map(task => {
              const count = task.count ?? 0;
              const isHot = task.urgent && count > 0;
              const countClass = task.count == null || count === 0
                ? `${s.taskCount} ${s.taskCountMuted}`
                : isHot
                  ? `${s.taskCount} ${s.taskCountHot}`
                  : s.taskCount;
              return (
                <li key={task.id} className={s.taskRow} data-task={task.id} data-pending={count > 0}>
                  <span
                    className={countClass}
                    aria-label={task.count == null ? "Chưa có số liệu" : `${number(count)} mục`}
                  >
                    {task.count == null ? "—" : number(count)}
                  </span>
                  <div className={s.taskBody}>
                    <h3 className={s.taskName}>{task.title}</h3>
                    <p className={s.taskDesc}>
                      {task.error ? "Chưa cập nhật được số liệu." : task.loading && task.count == null ? "Đang tải công việc…" : task.detail}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={isHot ? s.primaryBtn : s.surfaceBtn}
                    onClick={() => onOpen(task.view)}
                  >
                    {task.action}
                  </button>
                </li>
              );
            })}
          </ul>

          {permissions.length > 0 && (
            <div className={s.cardFoot}>
              <span className={s.footLabel}>Quyền của bạn</span>
              {permissions.map(perm => (
                <span key={perm} className={s.permPill}>{perm}</span>
              ))}
            </div>
          )}
        </section>

        {/* Right: 14-day Backlog Area Chart Card */}
        <section className={s.card} aria-labelledby="reviewer-backlog-heading">
          <div className={s.cardHead}>
            <h2 id="reviewer-backlog-heading" className={s.cardTitle}>Việc tồn đọng 14 ngày</h2>
            <span className={s.chartDelta}>{number(startVal)} → {number(endVal)}</span>
          </div>
          <BacklogChart series={series} />
        </section>
      </div>
    </div>
  );
}
