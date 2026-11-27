import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { formatDate, matches, timeAgo } from "../model/reviewerUtils";
import { LawGapsArt } from "./LawGapsArt";
import ts from "./TopicsWorkspace.module.css";
import s from "./LawGapsDesk.module.css";

type Gap = {
  id: string;
  kind: "UNCHECKED" | "NO_ROLE" | "AMBIGUOUS" | "VIOLATION" | "COMPLAINT";
  schemaId?: string;
  topic?: string;
  role?: string;
  unit?: string;
  label?: string;
  occurrences: number;
  exampleDescription?: string;
  exampleFormula?: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  note?: string;
  decidedByName?: string | null;
  decidedAt?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignedAt?: string | null;
  sourceComplaintId?: string | null;
  updatedAt: string;
};
type GapAudit = {
  id: string;
  lawGapId: string;
  kind: Gap["kind"];
  schemaId?: string | null;
  topic?: string | null;
  label?: string | null;
  role?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};
type Filter = "OPEN" | "RESOLVED" | "DISMISSED";
type ClaimFilter = "ALL" | "MINE" | "UNASSIGNED";
type KindFilter = "ALL" | Gap["kind"];
type HistoryActionFilter = "ALL" | "CLAIM" | "RESOLVE" | "DISMISS" | "REOPEN";
type GapCounts = Partial<Record<Filter, number>>;

const GAP_STATUS_LABEL: Record<string, string> = {
  OPEN: "Cần xử lý",
  RESOLVED: "Đã bổ sung",
  DISMISSED: "Không cần bổ sung",
};

const GAP_AUDIT_META: Record<string, { label: string; actorRole: string; pill: "draft" | "approved" | "retired" }> = {
  CLAIM: { label: "Nhận xử lý", actorRole: "Người nhận xử lý", pill: "draft" },
  RELEASE: { label: "Bỏ nhận xử lý", actorRole: "Người thực hiện", pill: "retired" },
  RESOLVE: { label: "Đã bổ sung định luật", actorRole: "Người sửa & hoàn tất", pill: "approved" },
  DISMISS: { label: "Không cần bổ sung", actorRole: "Người đánh giá", pill: "retired" },
  REOPEN: { label: "Mở lại rà soát", actorRole: "Người mở lại", pill: "draft" },
  AUTO_REOPEN: { label: "Tự động mở lại", actorRole: "Hệ thống", pill: "draft" },
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
};

function matchesGapHistoryFilter(action: string, filter: HistoryActionFilter) {
  if (filter === "ALL") return true;
  if (filter === "CLAIM") return action === "CLAIM" || action === "RELEASE";
  if (filter === "RESOLVE") return action === "RESOLVE";
  if (filter === "DISMISS") return action === "DISMISS";
  return action === "REOPEN" || action === "AUTO_REOPEN";
}

const KIND: Record<Gap["kind"], { short: string; title: string; todo: string }> = {
  UNCHECKED: {
    short: "Đại lượng chưa có định luật kiểm chứng",
    title: "Đại lượng chưa có định luật kiểm chứng",
    todo: "Thêm định luật kiểm chứng cho đại lượng này vào chủ đề liên quan.",
  },
  NO_ROLE: {
    short: "Đại lượng chưa có trong danh mục",
    title: "Đại lượng chưa có trong danh mục chuẩn",
    todo: "Bổ sung đại lượng này vào danh mục của chủ đề, rồi thêm định luật kiểm chứng tương ứng.",
  },
  AMBIGUOUS: {
    short: "Chưa phân biệt được đại lượng áp dụng",
    title: "Công thức chưa phân biệt được đại lượng áp dụng",
    todo: "Bổ sung điều kiện áp dụng và phạm vi cho định luật để hệ thống chọn đúng một đại lượng.",
  },
  VIOLATION: {
    short: "Kết quả không thỏa mãn định luật",
    title: "Kết quả mô phỏng không thỏa mãn định luật",
    todo: "Kiểm tra xem mô hình AI tính sai hay định luật đang viết quá chặt, rồi điều chỉnh nếu cần.",
  },
  COMPLAINT: {
    short: "Chuyển từ khiếu nại mô phỏng",
    title: "Chuyển từ khiếu nại mô phỏng của giáo viên",
    todo: "Kiểm tra lại định luật và dữ liệu chuẩn của chủ đề liên quan; nếu mô phỏng đúng thì đánh dấu Không cần bổ sung.",
  },
};

const DESCRIPTION_PREVIEW = 280;
const number = (value: number) => value.toLocaleString("vi-VN");
const lastSeen = (at: string) => new Date(at).toLocaleDateString("vi-VN");
const complaintCode = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();

function topicLinkOf(gap: Gap) {
  if (gap.schemaId) return `/reviewer/topics?schemaId=${encodeURIComponent(gap.schemaId)}`;
  if (gap.topic) return `/reviewer/topics?topic=${encodeURIComponent(gap.topic)}`;
  return "/reviewer/topics";
}

/** What teachers' simulations computed that no law could check, most frequent first. */
export function LawGapsDesk() {
  const me = useSessionStore(state => state.user);
  const topicName = useTopicName();
  const [viewMode, setViewMode] = useState<"list" | "history">("list");
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("ALL");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [historyFilter, setHistoryFilter] = useState<HistoryActionFilter>("ALL");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(15);
  const [actionError, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [highlightedGapId, setHighlightedGapId] = useState("");

  const countsResource = useResource<GapCounts>("/reviewer/law-gaps/counts");
  const resource = useResource<Gap[]>("/reviewer/law-gaps?status=" + filter);
  const openResource = useResource<Gap[]>("/reviewer/law-gaps?status=OPEN");
  const historyResource = useResource<GapAudit[]>("/reviewer/law-gaps/history", viewMode === "history");

  const items = useMemo(() => resource.data ?? [], [resource.data]);
  const openItems = useMemo(() => openResource.data ?? [], [openResource.data]);
  const historyItems = useMemo(() => historyResource.data ?? [], [historyResource.data]);
  const loading = resource.loading;
  const error = actionError || resource.error || "";

  const load = () => {
    setError("");
    return Promise.all([
      countsResource.refresh(),
      resource.refresh(),
      openResource.refresh(),
      ...(viewMode === "history" ? [historyResource.refresh()] : []),
    ]);
  };

  const topics = useMemo(() => {
    const seen = new Set<string>();
    items.forEach(item => { if (item.topic) seen.add(item.topic); });
    return Array.from(seen).sort((a, b) => topicName(a).localeCompare(topicName(b), "vi"));
  }, [items, topicName]);

  const activeTopic = topicFilter !== "ALL" && topics.includes(topicFilter) ? topicFilter : "ALL";

  const isClaimedByMe = (gap: Gap) => Boolean(gap.assignedToId && me?.id && Number(gap.assignedToId) === Number(me.id));
  const isClaimedByOther = (gap: Gap) => Boolean(gap.assignedToId && !isClaimedByMe(gap));

  const visibleStatusItems = useMemo(
    () => (filter === "OPEN" ? items.filter(gap => !isClaimedByOther(gap)) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filter, me?.id],
  );

  const myClaimedCount = useMemo(
    () => (filter === "OPEN" ? visibleStatusItems.filter(isClaimedByMe).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleStatusItems, filter, me?.id],
  );
  const unassignedCount = useMemo(
    () => (filter === "OPEN" ? visibleStatusItems.filter(gap => !gap.assignedToId).length : 0),
    [visibleStatusItems, filter],
  );

  const rows = useMemo(() => visibleStatusItems.filter(gap =>
    (filter !== "OPEN" || claimFilter === "ALL" || (claimFilter === "MINE" ? isClaimedByMe(gap) : !gap.assignedToId))
    && (kindFilter === "ALL" || gap.kind === kindFilter)
    && (activeTopic === "ALL" || gap.topic === activeTopic)
    && matches(query, gap.role, gap.label, gap.unit, gap.topic, gap.topic ? topicName(gap.topic) : "", gap.schemaId, gap.exampleDescription, gap.exampleFormula, KIND[gap.kind].title)
  ), // eslint-disable-next-line react-hooks/exhaustive-deps
  [visibleStatusItems, filter, claimFilter, kindFilter, activeTopic, query, topicName, me?.id]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = pageSize > 0 ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;

  const jumpToGap = (entry: GapAudit) => {
    const targetStatus: Filter = entry.toStatus === "RESOLVED"
      ? "RESOLVED"
      : entry.toStatus === "DISMISSED"
        ? "DISMISSED"
        : "OPEN";
    setFilter(targetStatus);
    setKindFilter("ALL");
    setTopicFilter("ALL");
    setQuery("");
    setPage(1);
    setHighlightedGapId(entry.lawGapId);
    setViewMode("list");
  };

  useEffect(() => {
    if (viewMode !== "list" || !highlightedGapId || rows.length === 0) return;
    const idx = rows.findIndex(g => g.id === highlightedGapId);
    if (idx < 0) return;
    const targetPage = pageSize > 0 ? Math.floor(idx / pageSize) + 1 : 1;
    if (targetPage !== page) {
      setPage(targetPage);
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(`gap-card-${highlightedGapId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => setHighlightedGapId(""), 4000);
    return () => window.clearTimeout(timer);
  }, [viewMode, highlightedGapId, rows, page, pageSize]);

  // Insight 1: Open gaps grouped by kind (sum of occurrences & item count)
  const byKind = useMemo(() => {
    const kinds = (Object.keys(KIND) as Gap["kind"][]).map(kind => {
      const matched = openItems.filter(g => g.kind === kind);
      const occ = matched.reduce((sum, g) => sum + g.occurrences, 0);
      return { kind, label: KIND[kind].short, count: matched.length, occ };
    }).filter(k => k.count > 0).sort((a, b) => b.occ - a.occ);
    const max = Math.max(1, ...kinds.map(k => k.occ));
    return kinds.map(k => ({ ...k, pct: Math.round((k.occ / max) * 100) }));
  }, [openItems]);

  // Insight 2: Open gaps grouped by physics topic (actionable triage: click to filter)
  const byTopic = useMemo(() => {
    const map = new Map<string, { topic: string; label: string; count: number; occ: number }>();
    openItems.forEach(gap => {
      const key = gap.topic || "__UNASSIGNED__";
      const label = gap.topic ? topicName(gap.topic) : "Chưa gắn chủ đề";
      const entry = map.get(key) ?? { topic: key, label, count: 0, occ: 0 };
      entry.count += 1;
      entry.occ += gap.occurrences;
      map.set(key, entry);
    });
    const list = [...map.values()].sort((a, b) => b.count - a.count || b.occ - a.occ);
    const max = Math.max(1, ...list.map(t => t.occ));
    return list.map(t => ({ ...t, pct: Math.round((t.occ / max) * 100) }));
  }, [openItems, topicName]);

  const claim = async (gap: Gap, release: boolean, force = false) => {
    setBusy(gap.id);
    setError("");
    try {
      const response = await api.post<Gap>(`/reviewer/law-gaps/${gap.id}/claim`, null, { params: { release, force } });
      const updated = response.data;
      resource.setData(current => current.map(item => item.id === updated.id ? updated : item));
      openResource.setData(current => current.map(item => item.id === updated.id ? updated : item));
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps/history") });
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      setError(message || "Chưa cập nhật được trạng thái nhận xử lý.");
    } finally {
      setBusy("");
    }
  };

  const decide = async (gap: Gap, status: Filter) => {
    setBusy(gap.id);
    setError("");
    try {
      await api.put(`/reviewer/law-gaps/${gap.id}`, { status, note: notes[gap.id] ?? gap.note ?? "" });
      resource.setData(current => current.filter(item => item.id !== gap.id));
      countsResource.setData(prev => prev ? {
        ...prev,
        [filter]: Math.max(0, (prev[filter] ?? 1) - 1),
        [status]: (prev[status] ?? 0) + 1,
      } : prev);
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps/counts") });
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps?status=" + status) });
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps?status=OPEN") });
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps/history") });
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      setError(message || "Chưa lưu được. Vui lòng thử lại.");
    } finally {
      setBusy("");
    }
  };

  const filteredHistory = useMemo(() => historyItems.filter(entry =>
    matchesGapHistoryFilter(entry.action, historyFilter)
    && matches(
      historyQuery,
      entry.label,
      entry.role,
      entry.schemaId,
      entry.topic ? topicName(entry.topic) : "",
      entry.actorName,
      entry.actorEmail,
      entry.note,
      KIND[entry.kind]?.short,
      GAP_AUDIT_META[entry.action]?.label,
    ),
  ), [historyItems, historyFilter, historyQuery, topicName]);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const visibleHistory = filteredHistory.slice((historyCurrentPage - 1) * historyPageSize, historyCurrentPage * historyPageSize);
  const countHistory = (f: HistoryActionFilter) => historyItems.filter(e => matchesGapHistoryFilter(e.action, f)).length;

  const countOf = (status: Filter) => countsResource.data?.[status];
  const hasFilters = Boolean(query.trim()) || kindFilter !== "ALL" || activeTopic !== "ALL" || (filter === "OPEN" && claimFilter !== "ALL");
  const clearFilters = () => { setQuery(""); setKindFilter("ALL"); setTopicFilter("ALL"); setClaimFilter("ALL"); setPage(1); };
  const refreshing = countsResource.refreshing || resource.refreshing || historyResource.refreshing;

  return (
    <div className={s.page}>
      {/* Page Header */}
      <header className={s.heading}>
        <div className={s.headingCopy}>
          <h1 className={s.title}>Định luật cần rà soát</h1>
          <p className={s.sub}>
            Các trường hợp định luật chưa kiểm được mô phỏng, gộp theo loại. Mục “Đã bổ sung” sẽ tự mở lại nếu lỗi tái diễn; mục “Không cần bổ sung” sẽ không tự mở lại.
          </p>
        </div>
        <div className={s.headingRight}>
          <div className={ts.seg} role="group" aria-label="Chế độ xem rà soát định luật">
            <button
              type="button"
              className={ts.segItem}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              Danh sách rà soát
            </button>
            <button
              type="button"
              className={ts.segItem}
              aria-pressed={viewMode === "history"}
              onClick={() => setViewMode("history")}
            >
              Lịch sử xử lý
            </button>
          </div>
          <button type="button" className={s.surfaceBtn} onClick={() => void load()} disabled={refreshing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? s.spin : undefined} aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
            </svg>
            Làm mới
          </button>
          <LawGapsArt />
        </div>
      </header>

      {viewMode === "history" ? (
        <section className={ts.card} aria-label="Lịch sử nhận và xử lý định luật">
          <div className={ts.toolbar}>
            <div className={ts.seg} role="group" aria-label="Lọc theo hành động">
              <button type="button" className={ts.segItem} aria-pressed={historyFilter === "ALL"} onClick={() => { setHistoryFilter("ALL"); setHistoryPage(1); }}>
                Tất cả ({historyItems.length})
              </button>
              <button type="button" className={ts.segItem} aria-pressed={historyFilter === "CLAIM"} onClick={() => { setHistoryFilter("CLAIM"); setHistoryPage(1); }}>
                Nhận xử lý ({countHistory("CLAIM")})
              </button>
              <button type="button" className={ts.segItem} aria-pressed={historyFilter === "RESOLVE"} onClick={() => { setHistoryFilter("RESOLVE"); setHistoryPage(1); }}>
                Đã bổ sung ({countHistory("RESOLVE")})
              </button>
              <button type="button" className={ts.segItem} aria-pressed={historyFilter === "DISMISS"} onClick={() => { setHistoryFilter("DISMISS"); setHistoryPage(1); }}>
                Không cần bổ sung ({countHistory("DISMISS")})
              </button>
              <button type="button" className={ts.segItem} aria-pressed={historyFilter === "REOPEN"} onClick={() => { setHistoryFilter("REOPEN"); setHistoryPage(1); }}>
                Mở lại ({countHistory("REOPEN")})
              </button>
            </div>
            <div className={ts.searchWrap}>
              <svg className={ts.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                className={ts.searchInput}
                aria-label="Tìm trong lịch sử xử lý định luật"
                placeholder="Tìm chủ đề, đại lượng, người nhận / người sửa…"
                value={historyQuery}
                onChange={event => { setHistoryQuery(event.target.value); setHistoryPage(1); }}
              />
            </div>
          </div>

          {historyResource.error && <div className={s.errorBanner} style={{ margin: 16 }} role="alert">{historyResource.error}</div>}
          {historyResource.loading && historyItems.length === 0 ? (
            <div style={{ padding: 16 }}><CardLoadingSkeleton cards={3} label="Đang tải lịch sử xử lý…" /></div>
          ) : (
            <>
              <div className={ts.scroll}>
                <table className={ts.table}>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Mục định luật &amp; Chủ đề</th>
                      <th>Hành động</th>
                      <th>Người thực hiện</th>
                      <th>Trạng thái / Ghi chú</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map(entry => {
                      const meta = GAP_AUDIT_META[entry.action] ?? { label: entry.action, actorRole: "Người thực hiện", pill: "retired" as const };
                      const pillClass = meta.pill === "approved" ? ts.stApproved : meta.pill === "draft" ? ts.stDraft : ts.stRetired;
                      const actor = entry.actorName || entry.actorEmail || "Hệ thống";
                      const isClaimByOther = entry.action === "CLAIM"
                        && entry.toStatus === "OPEN"
                        && Boolean(entry.actorEmail && me?.email && entry.actorEmail.toLowerCase() !== me.email.toLowerCase());
                      const targetStatusLabel = entry.toStatus === "RESOLVED"
                        ? "Đã bổ sung"
                        : entry.toStatus === "DISMISSED"
                          ? "Không cần bổ sung"
                          : "Cần xử lý";
                      return (
                        <tr key={entry.id}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className={ts.verMono} title={formatDateTime(entry.createdAt)}>
                              {formatDateTime(entry.createdAt)}
                            </span>
                            <span className={ts.dateSmall}>{timeAgo(entry.createdAt) || formatDate(entry.createdAt)}</span>
                          </td>
                          <td>
                            {isClaimByOther ? (
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                {KIND[entry.kind]?.short ?? entry.kind}
                                {(entry.role || entry.label) && <span className={s.roleCode}>{entry.role || entry.label}</span>}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={ts.topicLink}
                                onClick={() => jumpToGap(entry)}
                                title={`Nhấn để tới mục này trong tab ${targetStatusLabel}`}
                              >
                                {KIND[entry.kind]?.short ?? entry.kind}
                                {(entry.role || entry.label) && <span className={s.roleCode}>{entry.role || entry.label}</span>}
                              </button>
                            )}
                            <span className={ts.codeMono}>{entry.topic ? topicName(entry.topic) : entry.schemaId || "Chưa gắn chủ đề"}</span>
                          </td>
                          <td>
                            <span className={`${ts.statusPill} ${pillClass}`}>{meta.label}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{actor}</div>
                            <span className={ts.dateSmall}>
                              {entry.actorEmail || "Tự động bởi hệ thống"}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: 12.5, color: "var(--gray-11)" }}>
                              {entry.fromStatus ? `${GAP_STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus} → ` : ""}
                              {entry.toStatus ? (GAP_STATUS_LABEL[entry.toStatus] ?? entry.toStatus) : "—"}
                            </div>
                            {entry.note && <span className={ts.dateSmall}>{entry.note}</span>}
                          </td>
                          <td className={ts.actionsCell}>
                            {isClaimByOther ? (
                              <span className={s.tagOther}>Đang do {actor} xử lý</span>
                            ) : (
                              <button
                                type="button"
                                className={ts.surfaceBtn}
                                onClick={() => jumpToGap(entry)}
                              >
                                Xem ở {targetStatusLabel} →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!historyResource.error && filteredHistory.length === 0 && (
                  <p className={ts.empty}>
                    {historyQuery || historyFilter !== "ALL"
                      ? "Không có mục lịch sử nào khớp bộ lọc."
                      : "Chưa có lịch sử nhận hoặc xử lý định luật nào được ghi nhận."}
                  </p>
                )}
              </div>

              {filteredHistory.length > 0 && (
                <footer className={ts.pager}>
                  <span>
                    Hiển thị {(historyCurrentPage - 1) * historyPageSize + 1}–{Math.min(historyCurrentPage * historyPageSize, filteredHistory.length)} / {filteredHistory.length} thao tác
                  </span>
                  <div className={ts.pagerActions}>
                    <select
                      className={ts.selectSm}
                      aria-label="Số dòng mỗi trang"
                      value={String(historyPageSize)}
                      onChange={event => { setHistoryPageSize(Number(event.target.value)); setHistoryPage(1); }}
                    >
                      {[10, 15, 30, 50].map(val => <option key={val} value={val}>Số dòng mỗi trang {val}</option>)}
                    </select>
                    <button type="button" className={ts.surfaceBtn} disabled={historyCurrentPage <= 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))}>
                      ← Trước
                    </button>
                    <span>Trang {historyCurrentPage}/{historyTotalPages}</span>
                    <button type="button" className={ts.surfaceBtn} disabled={historyCurrentPage >= historyTotalPages} onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}>
                      Sau →
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </section>
      ) : (
        <div className={s.split}>
        {/* Left Main Column */}
        <div className={s.mainCol}>
          <div className={s.tabs} role="tablist" aria-label="Trạng thái rà soát">
            <button
              type="button"
              role="tab"
              className={s.tab}
              aria-selected={filter === "OPEN"}
              onClick={() => { setFilter("OPEN"); setTopicFilter("ALL"); setPage(1); }}
            >
              Cần xử lý
              {countOf("OPEN") !== undefined && <span className={s.tabCount}>{number(countOf("OPEN")!)}</span>}
            </button>
            <button
              type="button"
              role="tab"
              className={s.tab}
              aria-selected={filter === "RESOLVED"}
              onClick={() => { setFilter("RESOLVED"); setTopicFilter("ALL"); setPage(1); }}
            >
              Đã bổ sung
              {countOf("RESOLVED") !== undefined && <span className={s.tabCount}>{number(countOf("RESOLVED")!)}</span>}
            </button>
            <button
              type="button"
              role="tab"
              className={s.tab}
              aria-selected={filter === "DISMISSED"}
              onClick={() => { setFilter("DISMISSED"); setTopicFilter("ALL"); setPage(1); }}
            >
              Không cần bổ sung
              {countOf("DISMISSED") !== undefined && <span className={s.tabCount}>{number(countOf("DISMISSED")!)}</span>}
            </button>
          </div>

          <div className={s.filterCard}>
            <div className={s.filterRow}>
              <div className={s.searchWrap}>
                <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  className={s.searchInput}
                  aria-label="Tìm mục cần rà soát"
                  placeholder="Tìm đại lượng, công thức, mô tả…"
                  value={query}
                  onChange={event => { setQuery(event.target.value); setPage(1); }}
                />
              </div>

              <select
                className={s.filterSelect}
                aria-label="Lọc theo loại"
                value={kindFilter}
                onChange={event => { setKindFilter(event.target.value as KindFilter); setPage(1); }}
              >
                <option value="ALL">Tất cả loại</option>
                {(Object.keys(KIND) as Gap["kind"][]).map(kind => (
                  <option key={kind} value={kind}>{KIND[kind].short}</option>
                ))}
              </select>

              {topics.length > 0 && (
                <select
                  className={s.filterSelect}
                  aria-label="Lọc theo chủ đề"
                  value={activeTopic}
                  onChange={event => { setTopicFilter(event.target.value); setPage(1); }}
                >
                  <option value="ALL">Tất cả chủ đề</option>
                  {topics.map(topic => (
                    <option key={topic} value={topic}>{topicName(topic)}</option>
                  ))}
                </select>
              )}
            </div>

            {(filter === "OPEN" || hasFilters) && (
              <div className={s.filterSubRow}>
                {filter === "OPEN" && (
                  <div className={ts.seg} role="group" aria-label="Lọc theo người nhận xử lý">
                    <button
                      type="button"
                      className={ts.segItem}
                      aria-pressed={claimFilter === "ALL"}
                      onClick={() => { setClaimFilter("ALL"); setPage(1); }}
                    >
                      Tất cả ({visibleStatusItems.length})
                    </button>
                    <button
                      type="button"
                      className={ts.segItem}
                      aria-pressed={claimFilter === "MINE"}
                      onClick={() => { setClaimFilter("MINE"); setPage(1); }}
                    >
                      Tôi đã nhận ({myClaimedCount})
                    </button>
                    <button
                      type="button"
                      className={ts.segItem}
                      aria-pressed={claimFilter === "UNASSIGNED"}
                      onClick={() => { setClaimFilter("UNASSIGNED"); setPage(1); }}
                    >
                      Chưa ai nhận ({unassignedCount})
                    </button>
                  </div>
                )}
                {hasFilters && (
                  <button type="button" className={s.ghostBtn} style={{ marginLeft: "auto" }} onClick={clearFilters}>
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <div className={s.errorBanner} role="alert">{error}</div>}
          {loading && items.length === 0 && <CardLoadingSkeleton cards={3} label="Đang tải danh sách định luật cần rà soát…" />}

          {!loading && rows.length === 0 && (
            <div className={`${s.card} ${s.emptyCard}`}>
              {hasFilters
                ? "Không tìm thấy mục nào khớp bộ lọc."
                : filter === "OPEN"
                  ? "Không có mục nào cần xử lý. Các mục mới sẽ xuất hiện khi giáo viên tạo mô phỏng có đại lượng chưa được kiểm."
                  : "Chưa có mục nào."}
            </div>
          )}

          {visibleRows.map(gap => {
            const roleOrLabel = gap.kind === "UNCHECKED"
              ? [gap.role, gap.unit ? `(${gap.unit})` : ""].filter(Boolean).join(" ")
              : [gap.label, gap.unit ? `(${gap.unit})` : ""].filter(Boolean).join(" ");
            const lead = gap.kind === "COMPLAINT" ? "Nội dung khiếu nại:" : "Mô tả của giáo viên (ví dụ gần nhất):";
            const claimedByMe = isClaimedByMe(gap);

            return (
              <article
                key={gap.id}
                id={`gap-card-${gap.id}`}
                className={`${s.card}${highlightedGapId === gap.id ? ` ${s.cardHighlight}` : ""}`}
              >
                <div className={s.cardHead}>
                  <div style={{ minWidth: 0 }}>
                    <h2 className={s.cardTitle}>
                      {KIND[gap.kind].title}
                      {roleOrLabel && <span className={s.roleCode}>{roleOrLabel}</span>}
                    </h2>
                    <p className={s.cardSub}>
                      {gap.topic ? topicName(gap.topic) : "Chưa gắn chủ đề"} · cập nhật {lastSeen(gap.updatedAt)}
                    </p>
                    <div className={s.chips}>
                      {gap.status === "OPEN" && (
                        claimedByMe ? (
                          <span className={s.tagMe}>Bạn đang nhận xử lý</span>
                        ) : (
                          <span className={s.tagNone}>Chưa ai nhận xử lý</span>
                        )
                      )}
                      {gap.sourceComplaintId && (
                        <span className={s.tagLaw}>Chuyển từ khiếu nại {complaintCode(gap.sourceComplaintId)}</span>
                      )}
                    </div>
                  </div>
                  <span className={s.occBadge}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.3 4.1 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
                      <path d="M12 9.5v4M12 17h.01" />
                    </svg>
                    Gặp {number(gap.occurrences)} lần
                  </span>
                </div>

                <div className={s.cardBody}>
                  {(gap.exampleDescription || gap.exampleFormula) && (
                    <div className={s.quote}>
                      {gap.exampleDescription && (
                        gap.exampleDescription.length > DESCRIPTION_PREVIEW ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>
                              <b>{lead}</b> {gap.exampleDescription.slice(0, DESCRIPTION_PREVIEW)}…
                            </summary>
                            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {gap.exampleDescription}
                            </p>
                          </details>
                        ) : (
                          <div>
                            <b>{lead}</b> {gap.exampleDescription}
                          </div>
                        )
                      )}
                      {gap.exampleFormula && (
                        <p className={s.formulaLine}>
                          <b>{gap.kind === "COMPLAINT" ? "Ghi chú từ người kiểm duyệt:" : "AI đã viết:"}</b>{" "}
                          <code>{gap.exampleFormula}</code>
                        </p>
                      )}
                    </div>
                  )}

                  <p className={s.todoLine}>
                    <b>Việc cần làm:</b> {KIND[gap.kind].todo}
                    <Link className={s.topicLink} to={topicLinkOf(gap)}>
                      {gap.topic ? `Mở chủ đề ${topicName(gap.topic)}` : "Mở Chủ đề vật lý"}
                    </Link>
                  </p>

                  {gap.status === "OPEN" ? (
                    <>
                      {gap.note && (
                        <p className={s.reopenNote}><b>Lịch sử trước đó:</b> {gap.note}</p>
                      )}
                      <label className={s.field}>
                        <span className={s.fieldLabel}>
                          Ghi chú xử lý <span className={s.fieldHint}>(không bắt buộc)</span>
                        </span>
                        <input
                          type="text"
                          className={s.noteInput}
                          placeholder="Đã thêm định luật … vào chủ đề …"
                          value={notes[gap.id] ?? ""}
                          onChange={event => setNotes(current => ({ ...current, [gap.id]: event.target.value }))}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      {(gap.decidedByName || gap.decidedAt) && (
                        <p className={s.decidedMeta}>
                          Xử lý bởi <strong>{gap.decidedByName || "Người kiểm duyệt"}</strong>
                          {gap.decidedAt ? ` · ${lastSeen(gap.decidedAt)}` : ""}
                        </p>
                      )}
                      {gap.note && (
                        <p className={s.todoLine}><b>Ghi chú:</b> {gap.note}</p>
                      )}
                    </>
                  )}
                </div>

                <div className={s.cardFoot}>
                  {gap.status === "OPEN" ? (
                    <>
                      <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className={s.surfaceBtn}
                          disabled={busy === gap.id}
                          onClick={() => void claim(gap, claimedByMe)}
                        >
                          {claimedByMe ? "Bỏ nhận" : "Nhận xử lý"}
                        </button>
                      </div>
                      <button
                        type="button"
                        className={s.ghostBtn}
                        disabled={busy === gap.id}
                        onClick={() => void decide(gap, "DISMISSED")}
                      >
                        Không cần bổ sung
                      </button>
                      <button
                        type="button"
                        className={s.primaryBtn}
                        disabled={busy === gap.id}
                        onClick={() => void decide(gap, "RESOLVED")}
                      >
                        Đã bổ sung định luật
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={s.surfaceBtn}
                      disabled={busy === gap.id}
                      onClick={() => void decide(gap, "OPEN")}
                    >
                      Mở lại
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {rows.length > 0 && (
            <footer className={s.pager}>
              <span>
                Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} / {rows.length} mục
              </span>
              <div className={s.pagerActions}>
                <select
                  className={s.filterSelect}
                  style={{ height: 30 }}
                  aria-label="Số mục mỗi trang"
                  value={String(pageSize)}
                  onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
                >
                  {[5, 10, 20].map(val => <option key={val} value={val}>{val} / trang</option>)}
                </select>
                <button type="button" className={s.surfaceBtn} style={{ height: 30 }} disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  ← Trước
                </button>
                <span>Trang {currentPage}/{totalPages}</span>
                <button type="button" className={s.surfaceBtn} style={{ height: 30 }} disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Sau →
                </button>
              </div>
            </footer>
          )}
        </div>

        {/* Right Insight Column */}
        <aside className={s.asideCol}>
          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>Theo loại</h2>
              <span className={s.cardMuted}>Cần xử lý</span>
            </div>
            <div className={s.cardBody}>
              {byKind.length > 0 ? (
                <div className={s.hbars}>
                  {byKind.map((row, idx) => {
                    const active = filter === "OPEN" && kindFilter === row.kind;
                    return (
                      <button
                        key={row.kind}
                        type="button"
                        className={`${s.hrowBtn}${active ? ` ${s.hrowBtnActive}` : ""}`}
                        onClick={() => {
                          setFilter("OPEN");
                          setKindFilter(prev => prev === row.kind ? "ALL" : row.kind);
                          setPage(1);
                        }}
                        title="Nhấn để lọc danh sách theo loại lỗi này"
                      >
                        <div className={s.hrowTop}>
                          <span>{row.label}</span>
                          <b>{number(row.count)} mục · {number(row.occ)} lần</b>
                        </div>
                        <div className={s.barTrack}>
                          <i
                            className={`${s.barFill} ${idx === 0 ? s.barFillFirst : ""}`}
                            style={{ width: `${Math.max(6, row.pct)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={s.decidedMeta}>Hiện chưa có mục cần xử lý.</p>
              )}
            </div>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>Theo chủ đề</h2>
              <span className={s.cardMuted}>Cần xử lý</span>
            </div>
            <div className={s.cardBody}>
              {byTopic.length > 0 ? (
                <div className={s.hbars}>
                  {byTopic.map((row, idx) => {
                    const selectable = row.topic !== "__UNASSIGNED__";
                    const active = selectable && filter === "OPEN" && activeTopic === row.topic;
                    return (
                      <button
                        key={row.topic}
                        type="button"
                        disabled={!selectable}
                        className={`${s.hrowBtn}${active ? ` ${s.hrowBtnActive}` : ""}`}
                        onClick={() => {
                          if (!selectable) return;
                          setFilter("OPEN");
                          setTopicFilter(prev => prev === row.topic ? "ALL" : row.topic);
                          setPage(1);
                        }}
                        title={selectable ? "Nhấn để lọc các mục thuộc chủ đề này" : undefined}
                      >
                        <div className={s.hrowTop}>
                          <span>{row.label}</span>
                          <b>{number(row.count)} mục · {number(row.occ)} lần</b>
                        </div>
                        <div className={s.barTrack}>
                          <i
                            className={`${s.barFill} ${idx === 0 ? s.barFillFirst : ""}`}
                            style={{ width: `${Math.max(6, row.pct)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={s.decidedMeta}>Hiện chưa có chủ đề nào tồn đọng mục cần xử lý.</p>
              )}
            </div>
          </section>
        </aside>
        </div>
      )}
    </div>
  );
}
