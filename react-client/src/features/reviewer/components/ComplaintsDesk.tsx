import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Dialog, Flex, SegmentedControl, Select, Spinner, TextArea } from "@radix-ui/themes";
import { useResource } from "../../../shared/hooks/operationsData";
import {
  claimComplaint,
  complaintForReview,
  escalateComplaintToLawGap,
  resolveComplaint,
  type ComplaintCounts,
  type ComplaintPage,
  type SimulationComplaint,
  type SupportStatus,
} from "../../support/api/supportApi";
import { COMPLAINT_STATUS } from "../../support/model/complaintStatus";
import { hasSavedScene, type GeneratedSimulationResult } from "../../simulation/api/simulationUnderstandingApi";
import SavedScene from "../../simulation/components/SavedScene";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { apiMessage } from "../../../shared/lib/apiError";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { timeAgo } from "../model/reviewerUtils";
import { SlaBadge } from "./ReviewerKit";
import { SimulationPreviewPane } from "./SimulationPreviewPane";
import { ComplaintsArt } from "./ComplaintsArt";
import modal from "../../../shared/ui/ModalScroll.module.css";
import styles from "./ComplaintsDesk.module.css";

const code = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();
const formatDateShort = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const number = (value: number) => value.toLocaleString("vi-VN");
const formatAvgDuration = (hours: number) => {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} phút`;
  }
  const rounded = Math.round(hours);
  if (rounded < 24) return `${rounded} giờ`;
  const days = Math.floor(rounded / 24);
  const remHours = rounded % 24;
  return remHours > 0 ? `${days} ngày ${remHours} giờ` : `${days} ngày`;
};
const contentOf = (value: string) => {
  const at = value.indexOf("\n— Đề bài —");
  return at < 0
    ? { detail: value, context: "" }
    : { detail: value.slice(0, at), context: value.slice(at + "\n— Đề bài —".length) };
};
const isValidDateInput = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2099;
};

const COMPLAINT_TEMPLATES = [
  { id: "fixed", label: "Đã cập nhật định luật, mời tạo lại mô phỏng", text: "Đã kiểm tra mô phỏng và cập nhật định luật vật lý liên quan. Thầy/cô vui lòng tạo lại mô phỏng để áp dụng kết quả mới." },
  { id: "valid", label: "Mô phỏng đã đúng kiến thức THPT", text: "Mô phỏng đã được kiểm tra và hiển thị đúng theo kiến thức vật lý THPT với các thông số trong đề bài." },
  { id: "missing", label: "Đề bài thiếu dữ kiện ban đầu / đơn vị", text: "Đề bài hiện còn thiếu một số dữ kiện ban đầu (đơn vị hoặc điều kiện biên). Thầy/cô vui lòng bổ sung rõ hơn rồi chạy lại." },
  { id: "referred", label: "Đã ghi nhận lỗi, chuyển đội biên soạn xử lý", text: "Đã ghi nhận lỗi hiển thị/tính toán và chuyển sang bộ phận biên soạn dữ liệu chuẩn để khắc phục." },
];

type Filter = "todo" | "done" | "all";
type QuickFilter = "ALL" | "MINE" | "UNASSIGNED" | "OVERDUE";
type ActionMode = "reply" | "escalate";

function topicUrlOf(meta: { schemaId?: string; topic?: string }) {
  if (meta.schemaId) return `/reviewer/topics?schemaId=${encodeURIComponent(meta.schemaId)}`;
  if (meta.topic) return `/reviewer/topics?topic=${encodeURIComponent(meta.topic)}`;
  return "";
}

function classifyComplaint(subject: string, content: string): "calc" | "mismatch" | "visual" | "other" {
  const text = `${subject} ${content}`.toLowerCase();
  if (text.includes("tính") || text.includes("công thức") || text.includes("sai số") || text.includes("kết quả") || text.includes("âm") || text.includes("giá trị")) return "calc";
  if (text.includes("lệch") || text.includes("đề bài") || text.includes("thông số") || text.includes("dữ kiện") || text.includes("thiếu")) return "mismatch";
  if (text.includes("hình") || text.includes("hiển thị") || text.includes("nhãn") || text.includes("vẽ") || text.includes("che") || text.includes("mũi tên")) return "visual";
  return "other";
}

function StatusBadge({ status }: Readonly<{ status: SupportStatus }>) {
  if (status === "RESOLVED") {
    return (
      <span className={`${styles.statusPill} ${styles.stResolved}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
        </svg>
        {COMPLAINT_STATUS[status]}
      </span>
    );
  }
  if (status === "READ") {
    return (
      <span className={`${styles.statusPill} ${styles.stRead}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" />
        </svg>
        {COMPLAINT_STATUS[status]}
      </span>
    );
  }
  return (
    <span className={`${styles.statusPill} ${styles.stOpen}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.3 4.1 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
        <path d="M12 9.5v4M12 17h.01" />
      </svg>
      {COMPLAINT_STATUS[status]}
    </span>
  );
}

export function ComplaintsDesk({ canEdit = false }: Readonly<{ canEdit?: boolean }>) {
  const me = useSessionStore(state => state.user);
  const [filter, setFilter] = useState<Filter>("todo");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [confirmTakeover, setConfirmTakeover] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState("");
  const [detailState, setDetailState] = useState<{ id: string; item?: SimulationComplaint; loading: boolean }>({ id: "", loading: false });
  const [loadedMeta, setLoadedMeta] = useState<{ id: string; schemaId?: string; topic?: string }>({ id: "" });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [actionMode, setActionMode] = useState<ActionMode>("reply");
  const [escalateNote, setEscalateNote] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const actionSectionRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");
  const [dialogNotice, setDialogNotice] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const invalidDateFormat = !isValidDateInput(from) || !isValidDateInput(to);
  const invalidDates = invalidDateFormat || Boolean(from && to && from > to);

  const pageUrl = useMemo(() => {
    const params = new URLSearchParams({
      group: filter.toUpperCase(),
      page: String(Math.max(0, page - 1)),
      size: String(size),
    });
    if (status !== "ALL") params.set("status", status);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (quickFilter === "MINE") params.set("assignedToMe", "true");
    else if (quickFilter === "UNASSIGNED") params.set("unassignedOnly", "true");
    else if (quickFilter === "OVERDUE" && filter !== "done") params.set("slaHours", "24");
    if (from && isValidDateInput(from)) params.set("from", from);
    if (to && isValidDateInput(to)) params.set("to", to);
    return `/support/complaints/review/page?${params.toString()}`;
  }, [filter, page, size, status, debouncedQuery, quickFilter, from, to]);

  const countsResource = useResource<ComplaintCounts>("/support/complaints/counts", true);
  const resource = useResource<ComplaintPage>(pageUrl, !invalidDates);
  const sampleResource = useResource<ComplaintPage>("/support/complaints/review/page?group=ALL&page=0&size=50", true);

  const rows = useMemo(() => (invalidDates ? [] : resource.data?.items ?? []), [invalidDates, resource.data?.items]);
  const totalElements = invalidDates ? 0 : (resource.data?.totalElements ?? rows.length);
  const pages = Math.max(1, invalidDates ? 1 : (resource.data?.totalPages ?? 1));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;

  useEffect(() => {
    if (!selectedId) {
      setDetailState({ id: "", loading: false });
      return;
    }
    let active = true;
    setDetailState(prev => ({ id: selectedId, item: prev.id === selectedId ? prev.item : undefined, loading: true }));
    complaintForReview(selectedId)
      .then(full => { if (active) setDetailState({ id: selectedId, item: full, loading: false }); })
      .catch(() => { if (active) setDetailState(prev => ({ ...prev, id: selectedId, loading: false })); });
    return () => { active = false; };
  }, [selectedId]);

  const rowSelected = rows.find(item => item.id === selectedId);
  const selected = (detailState.id === selectedId && detailState.item) ? detailState.item : rowSelected;
  const selectedContent = selected ? contentOf(selected.content) : null;
  const snapshotScene = selected && hasSavedScene(selected.simulationSnapshot) ? selected.simulationSnapshot as GeneratedSimulationResult : null;
  const activeMeta: { schemaId?: string; topic?: string } = snapshotScene
    ? {
        schemaId: typeof snapshotScene.simulationSpec.schemaId === "string" ? snapshotScene.simulationSpec.schemaId : undefined,
        topic: typeof snapshotScene.simulationSpec.topic === "string" ? snapshotScene.simulationSpec.topic : undefined,
      }
    : loadedMeta.id === selected?.id ? loadedMeta : {};
  const topicUrl = canEdit ? topicUrlOf(activeMeta) : "";
  const onPreviewMeta = useCallback((meta: { schemaId?: string; topic?: string }) => {
    setLoadedMeta(prev => ({ id: selectedId, schemaId: meta.schemaId ?? prev.schemaId, topic: meta.topic ?? prev.topic }));
  }, [selectedId]);

  const counts = countsResource.data;
  const todoCount = counts ? counts.open + counts.read : undefined;
  const doneCount = counts?.resolved;
  const allCount = counts?.total ?? 0;
  const under24h = counts?.under24h ?? 0;
  const from24To48h = counts?.from24To48h ?? 0;
  const over48h = counts?.over48h ?? 0;

  // Insights from sample complaints
  const sampleItems = useMemo(() => sampleResource.data?.items ?? rows, [sampleResource.data?.items, rows]);
  const avgHours = useMemo(() => {
    const durations = sampleItems
      .filter(item => item.status === "RESOLVED" && item.respondedAt && item.createdAt)
      .map(item => (Date.parse(item.respondedAt!) - Date.parse(item.createdAt)) / 3_600_000)
      .filter(hours => Number.isFinite(hours) && hours >= 0);
    if (!durations.length) return null;
    return durations.reduce((sum, h) => sum + h, 0) / durations.length;
  }, [sampleItems]);

  const simBugCount = useMemo(() => {
    const withSim = sampleItems.filter(item => item.simulationId || item.hasSimulationSnapshot).length;
    return withSim || allCount;
  }, [sampleItems, allCount]);

  const categories = useMemo(() => {
    const map = { calc: 0, mismatch: 0, visual: 0, other: 0 };
    sampleItems.forEach(item => {
      map[classifyComplaint(item.subject, item.content)] += 1;
    });
    const list = [
      { key: "calc", label: "Kết quả tính toán sai", count: map.calc },
      { key: "mismatch", label: "Mô phỏng lệch đề bài", count: map.mismatch },
      { key: "visual", label: "Hình minh họa / hiển thị", count: map.visual },
      ...(map.other > 0 ? [{ key: "other", label: "Báo lỗi khác", count: map.other }] : []),
    ].sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...list.map(i => i.count));
    return list.map(item => ({ ...item, pct: Math.round((item.count / max) * 100) }));
  }, [sampleItems]);

  const hasFilters = Boolean(query || status !== "ALL" || from || to || quickFilter !== "ALL");
  const clear = () => { setQuery(""); setStatus("ALL"); setFrom(""); setTo(""); setQuickFilter("ALL"); setPage(1); };
  const refreshAll = () => Promise.all([countsResource.refresh(), resource.refresh(), sampleResource.refresh()]);
  const refreshing = resource.refreshing || countsResource.refreshing || busy;

  const syncUpdatedItem = (updated: SimulationComplaint) => {
    setDetailState(prev => prev.id === updated.id ? { id: updated.id, item: updated, loading: false } : prev);
    resource.setData(previous => previous ? {
      ...previous,
      items: previous.items.map(item => item.id === updated.id ? { ...updated, simulationSnapshot: null } : item),
    } : previous);
  };

  const switchActionMode = (next: ActionMode) => {
    setActionMode(next);
    setActionError("");
    window.requestAnimationFrame(() => {
      actionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const toggleClaim = async (release: boolean, force = false) => {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setActionError(""); setNotice(""); setDialogNotice("");
    try {
      const updated = await claimComplaint(selected.id, release, force);
      syncUpdatedItem(updated);
      void queryClient.invalidateQueries({ queryKey: apiKey("/support/complaints/counts") });
      setConfirmTakeover(false);
      const message = release ? "Đã bỏ nhận xử lý khiếu nại." : force ? "Đã tiếp nhận lại khiếu nại này." : "Đã nhận xử lý khiếu nại này.";
      setDialogNotice(message);
    } catch (error) { setActionError(apiMessage(error, "Không cập nhật được trạng thái nhận xử lý.")); }
    finally { lock.current = false; setBusy(false); }
  };

  const escalateToLawGap = async () => {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setActionError(""); setNotice(""); setDialogNotice("");
    try {
      const updated = await escalateComplaintToLawGap(selected.id, {
        schemaId: activeMeta.schemaId,
        topic: activeMeta.topic,
        note: escalateNote.trim() || undefined,
      });
      syncUpdatedItem(updated);
      void queryClient.invalidateQueries({ queryKey: apiKey("/support/complaints/counts") });
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps/counts") });
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps?status=OPEN") });
      setActionMode("reply");
      setEscalateNote("");
      const message = "Đã chuyển khiếu nại sang mục Định luật cần rà soát để bộ phận biên soạn xử lý.";
      setDialogNotice(message);
    } catch (error) { setActionError(apiMessage(error, "Chưa chuyển được sang rà soát định luật. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };

  const act = async (nextStatus: SupportStatus) => {
    if (!selected || lock.current) return;
    const response = (drafts[selected.id] ?? "").trim();
    if (!response && (nextStatus !== "RESOLVED" || !selected.adminResponse?.trim())) {
      setActionError("Hãy nhập phản hồi hoặc kết quả xử lý trước khi lưu.");
      return;
    }
    lock.current = true; setBusy(true); setActionError(""); setNotice(""); setDialogNotice("");
    try {
      const updated = await resolveComplaint(selected.id, nextStatus, response || undefined, selected.status, selected.respondedAt);
      syncUpdatedItem(updated);
      void queryClient.invalidateQueries({ queryKey: apiKey("/support/complaints/counts") });
      void resource.refresh();
      setDrafts(previous => ({ ...previous, [updated.id]: "" }));
      const message = nextStatus === "RESOLVED" ? "Đã giải quyết khiếu nại và gửi kết quả cho giáo viên." : "Đã gửi phản hồi. Khiếu nại tiếp tục được xem xét.";
      if (nextStatus === "RESOLVED") { setNotice(message); setDialogNotice(""); setSelectedId(""); }
      else setDialogNotice(message);
    } catch (error) { setActionError(apiMessage(error, "Chưa lưu được phản hồi. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };

  const claimedByMe = Boolean(selected?.assignedToId && me?.id && Number(selected.assignedToId) === Number(me.id));
  const claimedByOther = Boolean(selected?.assignedToId && !claimedByMe);
  const canEscalate = Boolean(selected && selected.status !== "RESOLVED" && !selected.lawGapId);
  const effectiveMode: ActionMode = canEscalate ? actionMode : "reply";
  const templates = useMemo(() => (canEdit ? COMPLAINT_TEMPLATES.filter(t => t.id !== "referred") : COMPLAINT_TEMPLATES), [canEdit]);

  const openModal = (item: SimulationComplaint, trigger: HTMLButtonElement) => {
    opener.current = trigger;
    setSelectedId(item.id);
    setActionMode("reply");
    setEscalateNote("");
    setDialogNotice("");
    setActionError("");
  };

  return (
    <div className={styles.desk}>
      {/* Page Header */}
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <h1 className={styles.title}>Khiếu nại mô phỏng</h1>
          <p className={styles.sub}>Kiểm tra báo lỗi, phản hồi giáo viên và theo dõi kết quả xử lý.</p>
        </div>
        <div className={styles.headingRight}>
          <div className={styles.seg} role="group" aria-label="Nhóm khiếu nại">
            <button
              type="button"
              className={styles.segItem}
              aria-pressed={filter === "todo"}
              onClick={() => { setFilter("todo"); setStatus("ALL"); setQuickFilter("ALL"); setPage(1); }}
            >
              Cần xử lý
            </button>
            <button
              type="button"
              className={styles.segItem}
              aria-pressed={filter === "done"}
              onClick={() => { setFilter("done"); setStatus("ALL"); setQuickFilter("ALL"); setPage(1); }}
            >
              Đã giải quyết
            </button>
          </div>
          <ComplaintsArt />
        </div>
      </header>

      {resource.error && !invalidDates && <p role="alert" className={styles.error}>{resource.error}</p>}
      {notice && !selected && <p role="status" className={styles.success}>{notice}</p>}

      {/* 4 Tinted KPI Cards */}
      <section className={styles.stats} aria-label="Chỉ số khiếu nại">
        <article className={`${styles.stat} ${styles.statLav}`}>
          <span className={`${styles.statIcon} ${styles.icAmber}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <span className={styles.statLabel}>Cần xử lý</span>
          <strong className={styles.statVal}>{todoCount !== undefined ? number(todoCount) : "—"}</strong>
          <span className={styles.statHint}>
            {counts?.oldestOpenCreatedAt ? `Cũ nhất ${timeAgo(counts.oldestOpenCreatedAt)}` : "Không có khiếu nại tồn đọng"}
          </span>
        </article>

        <article className={`${styles.stat} ${styles.statMint}`}>
          <span className={`${styles.statIcon} ${styles.icGreen}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span className={styles.statLabel}>Đã giải quyết</span>
          <strong className={styles.statVal}>{doneCount !== undefined ? number(doneCount) : "—"}</strong>
          <span className={styles.statHint}>Trên tổng {number(allCount)} khiếu nại</span>
        </article>

        <article className={`${styles.stat} ${styles.statLav}`}>
          <span className={`${styles.statIcon} ${styles.icIndigo}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
            </svg>
          </span>
          <span className={styles.statLabel}>Xử lý trung bình</span>
          <strong className={styles.statVal} title={avgHours !== null ? `Khoảng ${Math.round(avgHours)} giờ` : undefined}>
            {avgHours !== null ? formatAvgDuration(avgHours) : "—"}
          </strong>
          <span className={styles.statHint}>{avgHours !== null ? "Từ lúc gửi đến khi phản hồi" : "Chưa có dữ liệu phản hồi"}</span>
          <svg className={styles.spark} viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="compSparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#23919A" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#23919A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 6 C20 10, 40 14, 60 17 C80 20, 100 22, 120 24 L120 28 L0 28 Z" fill="url(#compSparkGrad)" />
            <path d="M0 6 C20 10, 40 14, 60 17 C80 20, 100 22, 120 24" fill="none" stroke="#23919A" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </article>

        <article className={`${styles.stat} ${styles.statLav}`}>
          <span className={`${styles.statIcon} ${styles.icRed}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <span className={styles.statLabel}>Mô phỏng bị báo lỗi</span>
          <strong className={styles.statVal}>{number(simBugCount)}</strong>
          <span className={styles.statHint}>{number(doneCount ?? 0)} đã xử lý xong</span>
        </article>
      </section>

      {/* 2-Column Insights */}
      <div className={styles.insights}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Số lượng khiếu nại chưa được xử lý</h2>
            <span className={styles.cardMuted}>{number(todoCount ?? 0)} khiếu nại</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.age}>
              <div className={styles.ageBox}>
                <b>{number(under24h)}</b>
                <small>Dưới 24 giờ</small>
              </div>
              <div className={styles.ageBox}>
                <b>{number(from24To48h)}</b>
                <small>24–48 giờ</small>
              </div>
              <div className={`${styles.ageBox} ${over48h > 0 ? styles.ageHot : ""}`}>
                <b>{number(over48h)}</b>
                <small>Quá 48 giờ</small>
              </div>
            </div>
            <p className={styles.ageHint}>
              {counts?.oldestOpenCreatedAt
                ? `Cũ nhất gửi ${timeAgo(counts.oldestOpenCreatedAt)}. `
                : ""}
              Khiếu nại do tính sai có thể chuyển sang Định luật cần rà soát.
            </p>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Theo loại lỗi</h2>
            <span className={styles.cardMuted}>{number(allCount)} khiếu nại</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.hbars}>
              {categories.map((cat, idx) => (
                <div key={cat.key} className={styles.hrow}>
                  <div className={styles.hrowTop}>
                    <span>{cat.label}</span>
                    <b>{number(cat.count)}</b>
                  </div>
                  <div className={styles.barTrack}>
                    <i
                      className={`${styles.barFill} ${idx === 0 ? styles.barFillFirst : ""}`}
                      style={{ width: `${cat.count > 0 ? Math.max(4, cat.pct) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Main Complaints Table Card */}
      <section className={styles.card} aria-label="Danh sách khiếu nại">
        <div className={styles.toolbar}>
          <div className={styles.seg} role="group" aria-label="Lọc nhanh khiếu nại">
            <button type="button" className={styles.segItem} aria-pressed={quickFilter === "ALL"} onClick={() => { setQuickFilter("ALL"); setPage(1); }}>
              Tất cả
            </button>
            <button type="button" className={styles.segItem} aria-pressed={quickFilter === "MINE"} onClick={() => { setQuickFilter("MINE"); setPage(1); }}>
              Tôi đang nhận
            </button>
            {filter !== "done" && (
              <>
                <button type="button" className={styles.segItem} aria-pressed={quickFilter === "UNASSIGNED"} onClick={() => { setQuickFilter("UNASSIGNED"); setPage(1); }}>
                  Chưa ai nhận
                </button>
                <button type="button" className={styles.segItem} aria-pressed={quickFilter === "OVERDUE"} onClick={() => { setQuickFilter("OVERDUE"); setPage(1); }}>
                  Quá 24 giờ
                </button>
              </>
            )}
          </div>

          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              aria-label="Tìm khiếu nại"
              placeholder="Mã, tiêu đề, tên, email hoặc người xử lý…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>

          <button
            type="button"
            className={styles.surfaceBtn}
            aria-expanded={showFilters}
            onClick={() => setShowFilters(v => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" />
            </svg>
            Bộ lọc
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => void refreshAll()}
            disabled={refreshing}
            aria-label="Làm mới danh sách"
            title="Làm mới"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? styles.spin : undefined} aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
        </div>

        {showFilters && (
          <div className={styles.filterDrawer}>
            <label className={styles.filterField}>
              Trạng thái
              <select
                className={styles.filterInput}
                value={status}
                onChange={event => { setStatus(event.target.value); setPage(1); }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(COMPLAINT_STATUS)
                  .filter(([val]) => filter === "all" || (val === "RESOLVED") === (filter === "done"))
                  .map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
              </select>
            </label>
            <label className={styles.filterField}>
              Từ ngày
              <input
                type="date"
                className={styles.filterInput}
                min="2020-01-01"
                max="2099-12-31"
                value={from}
                onChange={event => { setFrom(event.target.value); setPage(1); }}
              />
            </label>
            <label className={styles.filterField}>
              Đến ngày
              <input
                type="date"
                className={styles.filterInput}
                min="2020-01-01"
                max="2099-12-31"
                value={to}
                onChange={event => { setTo(event.target.value); setPage(1); }}
              />
            </label>
            <button type="button" className={styles.surfaceBtn} disabled={!hasFilters} onClick={clear}>
              Xóa bộ lọc
            </button>
          </div>
        )}

        {invalidDateFormat && <p role="alert" className={styles.error} style={{ margin: "12px 16px" }}>Ngày lọc không hợp lệ (năm phải từ 2000 đến 2099).</p>}
        {!invalidDateFormat && invalidDates && <p role="alert" className={styles.error} style={{ margin: "12px 16px" }}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

        {resource.loading ? (
          <TableLoadingSkeleton headers={["Người gửi", "Khiếu nại", "Trạng thái", "Người xử lý", "Ngày gửi", ""]} />
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Người gửi</th>
                  <th>Khiếu nại</th>
                  <th>Trạng thái</th>
                  <th>Người xử lý</th>
                  <th>Ngày gửi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(item => {
                  const rowClaimedByMe = Boolean(item.assignedToId && me?.id && Number(item.assignedToId) === Number(me.id));
                  const rowClaimedByOther = Boolean(item.assignedToId && !rowClaimedByMe);
                  const hasSim = Boolean(item.simulationId || item.hasSimulationSnapshot || hasSavedScene(item.simulationSnapshot));
                  const excerpt = contentOf(item.content).detail.trim();

                  return (
                    <tr key={item.id}>
                      <td>
                        <span className={styles.senderName}>{item.senderName}</span>
                        <span className={styles.mutedSmall}>{item.senderEmail}</span>
                      </td>
                      <td>
                        <span className={styles.complaintTitle}>
                          <span>{item.subject}</span>
                          <span className={styles.codeMono}>{code(item.id)}</span>
                        </span>
                        {excerpt && <span className={styles.excerpt} title={excerpt}>{excerpt}</span>}
                        {(hasSim || item.lawGapId) && (
                          <div className={styles.chips}>
                            {hasSim && <span className={`${styles.tagPill} ${styles.tagNone}`}>Có bản chụp mô phỏng</span>}
                            {item.lawGapId && (
                              <span className={`${styles.tagPill} ${item.lawGapStatus === "RESOLVED" ? styles.tagLawDone : styles.tagLaw}`}>
                                {item.lawGapStatus === "RESOLVED" ? "Biên soạn định luật: Đã bổ sung" : "Biên soạn định luật: Đang rà soát"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        {item.status === "RESOLVED" ? (
                          <span className={`${styles.tagPill} ${styles.tagNone}`}>{item.responderName || item.assignedToName || "Đã hoàn tất"}</span>
                        ) : rowClaimedByMe ? (
                          <span className={`${styles.tagPill} ${styles.tagMe}`}>Bạn đang nhận xử lý</span>
                        ) : rowClaimedByOther ? (
                          <span className={`${styles.tagPill} ${styles.tagOther}`}>{item.assignedToName} đang xử lý</span>
                        ) : (
                          <span className={`${styles.tagPill} ${styles.tagNone}`}>Chưa ai nhận</span>
                        )}
                      </td>
                      <td className={styles.dateCell}>
                        <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>{formatDateShort(item.createdAt)}</time>
                      </td>
                      <td className={styles.actionsCell}>
                        <button
                          type="button"
                          className={item.status !== "RESOLVED" && rowClaimedByMe ? styles.primaryBtn : styles.surfaceBtn}
                          aria-haspopup="dialog"
                          onClick={event => openModal(item, event.currentTarget)}
                        >
                          {item.status === "RESOLVED" ? "Xem" : rowClaimedByMe ? "Xử lý" : rowClaimedByOther ? "Xem" : "Nhận xử lý"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p className={styles.empty}>Không có khiếu nại phù hợp với bộ lọc.</p>}
          </div>
        )}

        <footer className={styles.pager}>
          <span aria-live="polite">
            Hiển thị {totalElements ? start + 1 : 0}–{Math.min(start + rows.length, totalElements)} / {totalElements} khiếu nại
          </span>
          <div className={styles.pagerActions}>
            <select
              className={styles.filterInput}
              style={{ height: 30 }}
              aria-label="Số dòng mỗi trang"
              value={String(size)}
              onChange={event => { setSize(Number(event.target.value)); setPage(1); }}
            >
              {[5, 10, 20].map(val => <option key={val} value={val}>{val} / trang</option>)}
            </select>
            <button type="button" className={styles.surfaceBtn} disabled={current === 1} onClick={() => setPage(current - 1)}>
              Trước
            </button>
            <span>Trang {current}/{pages}</span>
            <button type="button" className={styles.surfaceBtn} disabled={current === pages} onClick={() => setPage(current + 1)}>
              Sau
            </button>
          </div>
        </footer>
      </section>

      {/* Complaint Review Dialog */}
      <Dialog.Root
        open={Boolean(selected)}
        onOpenChange={open => {
          if (!open && !busy) {
            setSelectedId("");
            setConfirmTakeover(false);
            setActionMode("reply");
            setEscalateNote("");
            setDialogNotice("");
            setActionError("");
          }
        }}
      >
        <Dialog.Content
          maxWidth="840px"
          className={`${modal.dialog} reviewer-academic`}
          onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
          onInteractOutside={event => event.preventDefault()}
          onCloseAutoFocus={event => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus({ preventScroll: true });
            }
          }}
        >
          <header className={styles.dialogHeader}>
            <div>
              <Dialog.Title mb="1">Xử lý khiếu nại mô phỏng</Dialog.Title>
              <Dialog.Description>{selected && code(selected.id)}</Dialog.Description>
            </div>
            <Flex gap="2" align="center">
              {selected && selected.status !== "RESOLVED" && (
                claimedByOther ? (
                  <Button size="2" variant="soft" color="amber" disabled={busy} onClick={() => setConfirmTakeover(true)}>
                    Tiếp nhận lại
                  </Button>
                ) : (
                  <Button size="2" variant="soft" color={claimedByMe ? "gray" : "indigo"} loading={busy} disabled={busy} onClick={() => void toggleClaim(claimedByMe)}>
                    {claimedByMe ? "Bỏ nhận xử lý" : "Nhận xử lý"}
                  </Button>
                )
              )}
              <Dialog.Close>
                <Button variant="soft" color="gray" disabled={busy} aria-label="Đóng chi tiết khiếu nại">Đóng</Button>
              </Dialog.Close>
            </Flex>
          </header>

          <div className={modal.body}>
            {selected && selectedContent && (
              <>
                {dialogNotice && <p role="status" className={styles.success}>{dialogNotice}</p>}
                {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
                {confirmTakeover && claimedByOther && (
                  <div className="reviewer-note" role="alert" style={{ marginBottom: 14 }}>
                    <strong>Khiếu nại đang được {selected.assignedToName} nhận xử lý.</strong> Bạn có chắc muốn tiếp nhận lại không?
                    <Flex gap="2" mt="2">
                      <Button size="1" color="amber" disabled={busy} onClick={() => void toggleClaim(false, true)}>Xác nhận tiếp nhận</Button>
                      <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => setConfirmTakeover(false)}>Hủy</Button>
                    </Flex>
                  </div>
                )}

                <h2 className={styles.subject}>{selected.subject}</h2>
                <Flex gap="2" align="center" wrap="wrap">
                  <StatusBadge status={selected.status} />
                  <SlaBadge createdAt={selected.createdAt} active={selected.status !== "RESOLVED"} />
                  {selected.assignedToName && selected.status !== "RESOLVED" && (
                    <Badge color={claimedByMe ? "indigo" : "amber"} variant="soft">
                      {claimedByMe ? "Bạn đang nhận xử lý" : `Đang xử lý: ${selected.assignedToName}`}
                    </Badge>
                  )}
                  {selected.lawGapId && (
                    <Badge color={selected.lawGapStatus === "RESOLVED" ? "green" : "purple"} variant="soft">
                      {selected.lawGapStatus === "RESOLVED"
                        ? "Biên soạn định luật: Đã bổ sung ✓"
                        : selected.lawGapStatus === "DISMISSED"
                          ? "Biên soạn định luật: Không cần bổ sung"
                          : "Biên soạn định luật: Đang rà soát"}
                    </Badge>
                  )}
                  {selected.lawGapId && canEdit && (
                    <Button asChild size="1" variant="ghost" color="purple">
                      <Link to="/reviewer/gaps">Xem mục rà soát →</Link>
                    </Button>
                  )}
                  {topicUrl && (
                    <Button asChild size="1" variant="ghost">
                      <Link to={topicUrl}>Mở chủ đề vật lý →</Link>
                    </Button>
                  )}
                </Flex>

                <dl className={styles.meta}>
                  <div>
                    <dt>Người gửi</dt>
                    <dd>{selected.senderName}<small>{selected.senderEmail}</small></dd>
                  </div>
                  <div>
                    <dt>Ngày gửi</dt>
                    <dd>{formatDateTime(selected.createdAt)}</dd>
                  </div>
                </dl>

                <h3 className={styles.subheading}>Nội dung báo lỗi</h3>
                <p className={styles.body}>{selectedContent.detail.trim()}</p>

                {selected.simulationId ? (
                  <section className={styles.preview}>
                    <h3 className={styles.subheading}>Xem lại mô phỏng người gửi đính kèm</h3>
                    <SimulationPreviewPane
                      simulationId={selected.simulationId}
                      onMeta={onPreviewMeta}
                      errorText="Không mở được mô phỏng đính kèm. Có thể mô phỏng đã bị người gửi xóa hoặc dữ liệu bị lỗi."
                    />
                  </section>
                ) : snapshotScene ? (
                  <section className={styles.preview}>
                    <h3 className={styles.subheading}>Xem lại bản chụp mô phỏng chưa lưu</h3>
                    <div className="reviewer-preview"><SavedScene scene={snapshotScene} /></div>
                  </section>
                ) : detailState.loading && selected.hasSimulationSnapshot ? (
                  <section className={styles.preview}>
                    <Flex align="center" gap="2" py="3"><Spinner /><span>Đang tải bản chụp mô phỏng đính kèm…</span></Flex>
                  </section>
                ) : (
                  <p className={styles.context}>Người gửi chưa lưu hoặc không đính kèm mô phỏng cho khiếu nại này.</p>
                )}

                {selectedContent.context && (
                  <details className={styles.context}>
                    <summary>Đề bài và thông số mô phỏng</summary>
                    <p className={styles.body}>{selectedContent.context.trim()}</p>
                  </details>
                )}

                {selected.adminResponse && (
                  <section className={styles.response}>
                    <h3 className={styles.subheading} style={{ marginTop: 0 }}>
                      Phản hồi đã gửi{selected.responderName ? " · " + selected.responderName : ""}
                    </h3>
                    {selected.respondedAt && <small>{formatDateTime(selected.respondedAt)}</small>}
                    <p className={styles.body}>{selected.adminResponse}</p>
                  </section>
                )}

                {selected.status !== "RESOLVED" && (
                  <div ref={actionSectionRef} className={styles.actionSection}>
                    <div className={styles.actionSectionHead}>
                      <h3 className={styles.subheading} style={{ margin: 0 }}>Xử lý khiếu nại</h3>
                      {canEscalate && (
                        <SegmentedControl.Root size="1" value={effectiveMode} onValueChange={value => switchActionMode(value as ActionMode)} aria-label="Chế độ xử lý khiếu nại">
                          <SegmentedControl.Item value="reply">Phản hồi giáo viên</SegmentedControl.Item>
                          <SegmentedControl.Item value="escalate">Chuyển rà soát định luật</SegmentedControl.Item>
                        </SegmentedControl.Root>
                      )}
                    </div>
                    {claimedByOther && (
                      <div className="reviewer-note" role="status">
                        Khiếu nại đang được <strong>{selected.assignedToName}</strong> nhận xử lý. Hãy bấm <strong>Tiếp nhận lại</strong> ở góc trên nếu bạn cần trực tiếp xử lý.
                      </div>
                    )}
                    {effectiveMode === "reply" ? (
                      <div className={styles.reply}>
                        <Flex justify="between" align="center" gap="2" wrap="wrap">
                          <label htmlFor="reviewer-complaint-response">Nội dung phản hồi / kết quả kiểm tra</label>
                          <Select.Root
                            size="1"
                            value=""
                            disabled={busy || claimedByOther}
                            onValueChange={id => {
                              const tpl = templates.find(t => t.id === id);
                              if (tpl) {
                                setDrafts(previous => ({ ...previous, [selected.id]: tpl.text }));
                                setActionError("");
                              }
                            }}
                          >
                            <Select.Trigger placeholder="Chèn mẫu phản hồi nhanh…" />
                            <Select.Content>
                              {templates.map(tpl => <Select.Item key={tpl.id} value={tpl.id}>{tpl.label}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </Flex>
                        <TextArea
                          id="reviewer-complaint-response"
                          rows={4}
                          maxLength={4000}
                          value={drafts[selected.id] ?? ""}
                          disabled={busy || claimedByOther}
                          onChange={event => {
                            setDrafts(previous => ({ ...previous, [selected.id]: event.target.value }));
                            setActionError("");
                          }}
                          placeholder="Nhập kết quả kiểm tra, cách khắc phục hoặc thông tin cần bổ sung…"
                        />
                        <small>Bấm “Gửi phản hồi” để giữ trạng thái đang xem xét, hoặc “Hoàn tất xử lý” khi đã xong.</small>
                      </div>
                    ) : (
                      <div className={styles.reply}>
                        <p className={styles.escalateHint}>
                          Hệ thống sẽ tạo 1 mục mới trong <strong>Định luật cần rà soát</strong> gắn với khiếu nại <strong>{code(selected.id)}</strong> để đội biên soạn dữ liệu chuẩn xử lý, đồng thời thông báo trạng thái đang xem xét cho giáo viên.
                        </p>
                        <label htmlFor="reviewer-escalate-note">Ghi chú chuyên môn cho đội biên soạn (không bắt buộc)</label>
                        <TextArea
                          id="reviewer-escalate-note"
                          rows={3}
                          maxLength={2000}
                          value={escalateNote}
                          disabled={busy || claimedByOther}
                          onChange={event => { setEscalateNote(event.target.value); setActionError(""); }}
                          placeholder="Ví dụ: Công thức tầm xa thiếu trường hợp ném từ độ cao h, cần bổ sung định luật cho chủ đề Động học…"
                        />
                      </div>
                    )}
                    {actionError && <p role="alert" className={styles.error} style={{ margin: 0 }}>{actionError}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {selected && selected.status !== "RESOLVED" && (
            <Flex justify="end" align="center" gap="3" wrap="wrap" className={styles.dialogFooter}>
              {effectiveMode === "escalate" ? (
                <>
                  <Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => switchActionMode("reply")}>Quay lại phản hồi</Button>
                  <Button type="button" color="purple" loading={busy} disabled={busy || claimedByOther} onClick={() => void escalateToLawGap()}>Xác nhận chuyển</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" disabled={busy || claimedByOther || !(drafts[selected.id] ?? "").trim()} onClick={() => void act("READ")}>Gửi phản hồi</Button>
                  <Button loading={busy} disabled={busy || claimedByOther} onClick={() => void act("RESOLVED")}>Hoàn tất xử lý</Button>
                </>
              )}
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
