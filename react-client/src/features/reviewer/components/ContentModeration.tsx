import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { LibraryItem } from "../../../shared/types/physlive";
import { LoadState } from "../../../shared/ui/OperationsKit";
import { useAction, useResource } from "../../../shared/hooks/operationsData";
import { formatDate, reviewerStatusLabel, timeAgo } from "../model/reviewerUtils";
import { useReviewerCatalog } from "../hooks/useReviewerCatalog";
import { ReviewerIcon, SlaBadge } from "./ReviewerKit";
import { SimulationPreviewPane } from "./SimulationPreviewPane";
import { ModerationHeaderArt, SimulationTopicThumb } from "./ModerationArt";
import s from "./ContentModeration.module.css";

type ModeratedItem = Omit<LibraryItem, "moderationStatus"> & {
  moderationStatus?: string;
  moderationComment?: string | null;
  description?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
};
type Decision = "APPROVED" | "FEATURED" | "REJECTED" | "REMOVED";
type Filter = "PENDING" | "APPROVED" | "FEATURED" | "REJECTED" | "REMOVED";
type QuickFilter = "ALL" | "MINE" | "UNASSIGNED" | "OVERDUE";
type ModerationCounts = Partial<Record<Filter, number>>;
type ModerationPage = { items: ModeratedItem[]; page: number; size: number; totalElements: number; totalPages: number };
type ModerationAudit = { id: string; itemId: string; reviewerEmail?: string | null; fromStatus?: string | null; toStatus: string; comment?: string | null; decidedAt: string };

const PAGE_SIZE = 20;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "FEATURED", label: "Nổi bật" },
  { value: "REJECTED", label: "Bị từ chối" },
  { value: "REMOVED", label: "Đã gỡ" },
];

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "MINE", label: "Của tôi" },
  { value: "UNASSIGNED", label: "Chưa ai nhận" },
  { value: "OVERDUE", label: "Quá 24 giờ" },
];

const REJECT_REASONS = [
  "Sai kiến thức vật lý",
  "Mô phỏng không chạy hoặc hiển thị lỗi",
  "Không phù hợp chương trình THPT",
  "Tiêu đề / mô tả chưa rõ ràng",
  "Trùng với nội dung đã có",
];
const REMOVE_REASONS = [
  "Phát hiện sai sót sau khi duyệt",
  "Giáo viên yêu cầu gỡ",
  "Nội dung đã lỗi thời",
];

const CHECKLIST = [
  "Kiến thức vật lý chính xác, đơn vị và số liệu hợp lý",
  "Mô phỏng chạy được, hiển thị rõ ràng",
  "Phù hợp học sinh THPT, không có nội dung không phù hợp",
];

function StatusPill({ status }: Readonly<{ status: Filter }>) {
  const clsMap: Record<Filter, string> = {
    PENDING: s.stPending,
    APPROVED: s.stApproved,
    FEATURED: s.stFeatured,
    REJECTED: s.stRejected,
    REMOVED: s.stRemoved,
  };
  return (
    <span className={`${s.statusBadge} ${clsMap[status]}`}>
      {status === "PENDING" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 4.1 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
          <path d="M12 9.5v4M12 17h.01" />
        </svg>
      ) : (
        <ReviewerIcon
          name={status === "APPROVED" ? "check" : status === "FEATURED" ? "star" : "close"}
          size={13}
        />
      )}
      {reviewerStatusLabel(status)}
    </span>
  );
}

export function ContentModeration() {
  const me = useSessionStore(state => state.user);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [page, setPage] = useState(0);
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const pageUrl = useMemo(() => {
    const params = new URLSearchParams({ status: filter, page: String(page), size: String(PAGE_SIZE) });
    if (topicFilter !== "ALL") params.set("topic", topicFilter);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (filter === "PENDING") {
      if (quickFilter === "MINE") params.set("assignedToMe", "true");
      else if (quickFilter === "UNASSIGNED") params.set("unassignedOnly", "true");
      else if (quickFilter === "OVERDUE") params.set("slaHours", "24");
    }
    return `/reviewer/library/page?${params.toString()}`;
  }, [filter, page, topicFilter, debouncedQuery, quickFilter]);

  const countsResource = useResource<ModerationCounts>("/reviewer/library/counts");
  const pageResource = useResource<ModerationPage>(pageUrl);
  const catalog = useReviewerCatalog();

  const rows = useMemo(() => pageResource.data?.items ?? [], [pageResource.data?.items]);
  const totalPages = pageResource.data?.totalPages ?? 1;
  const totalElements = pageResource.data?.totalElements ?? rows.length;

  const topics = useMemo(() => {
    const seen = new Set<string>(catalog.topics);
    rows.forEach(item => { if (item.topic) seen.add(item.topic); });
    return Array.from(seen).sort((a, b) => catalog.topicName(a).localeCompare(catalog.topicName(b), "vi"));
  }, [catalog, rows]);

  const selected = rows.find(item => item.id === selectedId) ?? rows[0];

  const refreshAll = () => Promise.all([countsResource.refresh(), pageResource.refresh()]);
  const refreshing = countsResource.refreshing || pageResource.refreshing;

  const afterDecision = (id: string, decision: Decision) => {
    const index = rows.findIndex(item => item.id === id);
    const next = rows[index + 1] ?? rows[index - 1];
    setSelectedId(next?.id ?? "");
    pageResource.setData(prev => prev ? { ...prev, items: prev.items.filter(item => item.id !== id), totalElements: Math.max(0, prev.totalElements - 1) } : prev);
    countsResource.setData(prev => prev ? {
      ...prev,
      [filter]: Math.max(0, (prev[filter] ?? 1) - 1),
      [decision]: (prev[decision] ?? 0) + 1,
    } : prev);
    void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/library/counts") });
    void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/library/page?status=PENDING&page=0&size=1") });
    void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/library/page?status=${decision}&page=0&size=${PAGE_SIZE}`) });
    void pageResource.refresh();
  };

  const onItemUpdated = (updated: ModeratedItem) => {
    pageResource.setData(prev => prev ? { ...prev, items: prev.items.map(item => item.id === updated.id ? updated : item) } : prev);
  };

  const hasActiveFilters = Boolean(debouncedQuery || topicFilter !== "ALL" || (filter === "PENDING" && quickFilter !== "ALL"));

  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div className={s.headingCopy}>
          <h1 className={s.title}>Mô phỏng chờ duyệt</h1>
          <p className={s.sub}>Giáo viên chia sẻ mô phỏng lên thư viện công khai. Hãy chạy thử mô phỏng trước khi quyết định.</p>
        </div>
        <div className={s.headingRight}>
          <ModerationHeaderArt />
        </div>
      </header>

      <div className={s.statusBar}>
        <div className={s.statusTabs} role="tablist" aria-label="Lọc theo trạng thái">
          {FILTERS.map(item => {
            const count = countsResource.data?.[item.value];
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={s.statusTab}
                onClick={() => {
                  setFilter(item.value);
                  setPage(0);
                  setSelectedId("");
                }}
              >
                <span>{item.label}</span>
                {count !== undefined && <span className={s.statusCount}>{count}</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => void refreshAll()}
          disabled={refreshing}
          aria-label="Làm mới danh sách"
          title="Làm mới"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? s.spin : undefined} aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>

      <div className={s.splitPane}>
        {/* Left pane: Filters + Queue List */}
        <aside className={s.listPane} aria-label="Danh sách mô phỏng">
          <div className={s.listControls}>
            <div className={s.searchWrap}>
              <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                className={s.searchInput}
                aria-label="Tìm mô phỏng"
                placeholder="Tìm tiêu đề, chủ đề, giáo viên, trường"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </div>

            {topics.length > 0 && (
              <select
                className={s.topicSelect}
                aria-label="Lọc theo chủ đề"
                value={topicFilter}
                onChange={event => {
                  setTopicFilter(event.target.value);
                  setPage(0);
                  setSelectedId("");
                }}
              >
                <option value="ALL">Tất cả chủ đề ({totalElements})</option>
                {topics.map(topic => (
                  <option key={topic} value={topic}>{catalog.topicName(topic)}</option>
                ))}
              </select>
            )}

            {filter === "PENDING" && (
              <div className={s.quickChips} role="group" aria-label="Lọc nhanh mô phỏng chờ duyệt">
                {QUICK_FILTERS.map(item => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={quickFilter === item.value}
                    className={s.quickChip}
                    onClick={() => {
                      setQuickFilter(item.value);
                      setPage(0);
                      setSelectedId("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <LoadState {...pageResource} />

          {!pageResource.loading && !pageResource.error && rows.length === 0 && (
            <div className={s.emptyState}>
              <span className={s.emptyIcon}><ReviewerIcon name="check" size={24} /></span>
              <h2 className={s.emptyTitle}>
                {hasActiveFilters ? "Không tìm thấy mô phỏng" : filter === "PENDING" ? "Đã duyệt hết!" : "Danh sách đang trống"}
              </h2>
              <p className={s.emptySub}>
                {hasActiveFilters ? "Thử từ khóa hoặc bộ lọc khác." : filter === "PENDING" ? "Mô phỏng mới do giáo viên gửi sẽ xuất hiện tại đây." : "Chưa có mô phỏng nào ở trạng thái này."}
              </p>
            </div>
          )}

          {!pageResource.loading && rows.length > 0 && (
            <div className={s.queueList}>
              {rows.map(item => {
                const isSelected = selected?.id === item.id;
                const topicLabel = catalog.topicName(item.topic) || "Chưa gắn chủ đề";
                const claimedByMe = Boolean(item.assignedToId && me?.id && Number(item.assignedToId) === Number(me.id));
                const claimedByOther = Boolean(item.assignedToId && !claimedByMe);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={s.queueItem}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={s.thumbBox}>
                      <SimulationTopicThumb topic={topicLabel} title={item.title} />
                    </span>
                    <span className={s.itemBody}>
                      <strong className={s.itemTitle} title={item.title}>{item.title}</strong>
                      <span className={s.itemMeta} title={topicLabel}>{topicLabel}</span>
                      <span className={s.itemMeta} title={`${item.sharedByName || "Không rõ người gửi"}${item.schoolName ? ` · ${item.schoolName}` : ""}`}>
                        {item.sharedByName || "Không rõ người gửi"}
                        {item.schoolName ? ` · ${item.schoolName}` : ""}
                      </span>
                      {item.createdAt && (
                        <span className={s.itemMeta}>Gửi {timeAgo(item.createdAt)}</span>
                      )}
                      <span className={s.itemTags}>
                        {filter === "PENDING" && (
                          claimedByMe
                            ? <span className={`${s.tagPill} ${s.tagMe}`}>Bạn đang nhận duyệt</span>
                            : claimedByOther
                              ? <span className={`${s.tagPill} ${s.tagOther}`}>{item.assignedToName} đang duyệt</span>
                              : <span className={`${s.tagPill} ${s.tagNone}`}>Chưa ai nhận</span>
                        )}
                        <SlaBadge createdAt={item.createdAt} active={filter === "PENDING"} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className={s.queuePager}>
              <button
                type="button"
                className={`${s.surfaceBtn} ${s.surfaceBtnSm}`}
                disabled={page <= 0}
                onClick={() => { setPage(p => Math.max(0, p - 1)); setSelectedId(""); }}
              >
                ← Trước
              </button>
              <span>Trang {page + 1}/{totalPages}</span>
              <button
                type="button"
                className={`${s.surfaceBtn} ${s.surfaceBtnSm}`}
                disabled={page + 1 >= totalPages}
                onClick={() => { setPage(p => p + 1); setSelectedId(""); }}
              >
                Sau →
              </button>
            </div>
          )}
        </aside>

        {/* Right pane: Selected Simulation Detail */}
        <section className={s.detailPane} aria-label="Chi tiết mô phỏng">
          {selected ? (
            <ModerationDetail
              key={selected.id}
              item={selected}
              topic={catalog.topicName(selected.topic)}
              onUpdated={onItemUpdated}
              onDone={decision => afterDecision(selected.id, decision)}
            />
          ) : (
            <div className={s.emptyState}>
              <span className={s.emptyIcon}><ReviewerIcon name="eye" size={24} /></span>
              <h2 className={s.emptyTitle}>Chọn một mô phỏng để kiểm duyệt</h2>
              <p className={s.emptySub}>Chọn mục ở danh sách bên trái để chạy thử và xem chi tiết.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ModerationDetail({
  item,
  topic,
  onUpdated,
  onDone,
}: Readonly<{
  item: ModeratedItem;
  topic: string;
  onUpdated: (updated: ModeratedItem) => void;
  onDone: (decision: Decision) => void;
}>) {
  const me = useSessionStore(state => state.user);
  const action = useAction();
  const status = (item.moderationStatus || "PENDING") as Filter;
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const [reviewNote, setReviewNote] = useState("");
  const [asking, setAsking] = useState<"REJECTED" | "REMOVED" | null>(null);
  const [confirmTakeover, setConfirmTakeover] = useState(false);
  const [reason, setReason] = useState("");

  const historyResource = useResource<ModerationAudit[]>(`/reviewer/library/${item.id}/history`);
  const history = historyResource.data ?? [];
  const onLoaded = useCallback((ok: boolean) => setPreviewOk(ok), []);
  const allChecked = checked.every(Boolean);

  const claimedByMe = Boolean(item.assignedToId && me?.id && Number(item.assignedToId) === Number(me.id));
  const claimedByOther = Boolean(item.assignedToId && !claimedByMe);

  const toggleClaim = async (release: boolean, force = false) => {
    let updated: ModeratedItem | undefined;
    const ok = await action.run(async () => {
      const response = await api.post<ModeratedItem>(`/reviewer/library/${item.id}/claim`, null, { params: { release, force } });
      updated = response.data;
    }, release ? "Đã bỏ nhận duyệt mô phỏng." : force ? "Đã tiếp nhận lại mô phỏng này." : "Đã nhận duyệt mô phỏng này.");
    if (ok && updated) {
      setConfirmTakeover(false);
      onUpdated(updated);
    }
  };

  const decide = async (decision: Decision, comment?: string) => {
    const messages: Record<Decision, string> = {
      APPROVED: "Đã phê duyệt mô phỏng.",
      FEATURED: "Đã phê duyệt và đánh dấu nổi bật.",
      REJECTED: "Đã từ chối và gửi lý do cho giáo viên.",
      REMOVED: "Đã gỡ mô phỏng khỏi thư viện.",
    };
    const finalComment = comment ?? reviewNote;
    const ok = await action.run(
      () => api.put(`/reviewer/library/${item.id}`, { status: decision, comment: finalComment?.trim() || undefined, expectedStatus: status }),
      messages[decision],
    );
    if (ok) {
      void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/library/${item.id}/history`) });
      onDone(decision);
    }
  };

  const submitReason = async (event: FormEvent) => {
    event.preventDefault();
    if (asking && reason.trim()) await decide(asking, reason);
  };

  const approveBlocked = previewOk !== true || !allChecked || claimedByOther;

  return (
    <>
      <div className={s.detailHead}>
        <div>
          <h2 className={s.detailTitle}>{item.title}</h2>
          <p className={s.detailSub}>
            {[topic || "Chưa gắn chủ đề", item.sharedByName || "Không rõ người gửi", item.schoolName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {status === "PENDING" && (
        <div className={`${s.claimBar} ${claimedByMe ? "" : claimedByOther ? s.claimBarWarn : s.claimBarNeutral}`}>
          <div className={s.claimInfo}>
            {claimedByMe ? (
              <>
                <span className={`${s.tagPill} ${s.tagMe}`}>Bạn đang nhận duyệt</span>
                <span className={s.claimText}>Người khác không thể quyết định mô phỏng này cho tới khi bạn bỏ nhận.</span>
              </>
            ) : claimedByOther ? (
              <>
                <span className={`${s.tagPill} ${s.tagOther}`}>{item.assignedToName} đang duyệt</span>
                <span className={s.claimText}>Mô phỏng đang được kiểm duyệt viên khác xử lý.</span>
              </>
            ) : (
              <>
                <span className={`${s.tagPill} ${s.tagNone}`}>Chưa ai nhận</span>
                <span className={s.claimText}>Nhận duyệt để tránh kiểm duyệt trùng với đồng nghiệp.</span>
              </>
            )}
          </div>
          {claimedByOther ? (
            <button type="button" className={`${s.surfaceBtn} ${s.surfaceBtnSm}`} disabled={action.busy} onClick={() => setConfirmTakeover(true)}>
              Tiếp nhận lại
            </button>
          ) : (
            <button type="button" className={`${s.surfaceBtn} ${s.surfaceBtnSm}`} disabled={action.busy} onClick={() => void toggleClaim(claimedByMe)}>
              {claimedByMe ? "Bỏ nhận duyệt" : "Nhận duyệt"}
            </button>
          )}
        </div>
      )}

      {confirmTakeover && claimedByOther && (
        <div className={s.takeoverBox} role="alert">
          <strong>Mô phỏng đang được {item.assignedToName} nhận duyệt.</strong> Bạn có chắc muốn tiếp nhận lại không?
          <div className={s.takeoverActions}>
            <button type="button" className={`${s.primaryBtn} ${s.surfaceBtnSm}`} disabled={action.busy} onClick={() => void toggleClaim(false, true)}>
              Xác nhận tiếp nhận
            </button>
            <button type="button" className={`${s.surfaceBtn} ${s.surfaceBtnSm}`} disabled={action.busy} onClick={() => setConfirmTakeover(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className={s.stageSection}>
        {item.description && <p className={s.descText}>{item.description}</p>}
        {item.moderationComment && status !== "PENDING" && (
          <div className={s.modNote}><strong>Ghi chú kiểm duyệt:</strong> {item.moderationComment}</div>
        )}
        <SimulationPreviewPane simulationId={item.simulationId} onLoaded={onLoaded} />
      </div>

      {status === "PENDING" && (
        <div className={s.reviewBody}>
          <div className={s.checkGroup}>
            <span className={s.sectionLabel}>Trước khi phê duyệt, xác nhận rằng:</span>
            {CHECKLIST.map((label, index) => (
              <label key={label} className={s.checkItem}>
                <input
                  type="checkbox"
                  checked={checked[index]}
                  onChange={event => setChecked(values => values.map((value, i) => (i === index ? event.target.checked : value)))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className={s.noteField}>
            <label htmlFor={`mod-note-${item.id}`} className={s.sectionLabel}>
              Ghi chú kiểm duyệt <span className={s.sectionHint}>(không bắt buộc)</span>
            </label>
            <textarea
              id={`mod-note-${item.id}`}
              className={s.textarea}
              rows={2}
              placeholder="Ghi nhận điểm tốt hoặc lưu ý nhỏ cho giáo viên..."
              value={reviewNote}
              onChange={event => setReviewNote(event.target.value)}
            />
          </div>
        </div>
      )}

      {history.length > 0 && (
        <details className={s.historyDisclosure}>
          <summary>Lịch sử kiểm duyệt ({history.length})</summary>
          <table className={s.historyTable}>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Người duyệt</th>
                <th>Thay đổi</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id}>
                  <td title={formatDate(entry.decidedAt)}>{timeAgo(entry.decidedAt) || formatDate(entry.decidedAt)}</td>
                  <td>{entry.reviewerEmail || "—"}</td>
                  <td>{entry.fromStatus ? `${reviewerStatusLabel(entry.fromStatus)} → ` : ""}{reviewerStatusLabel(entry.toStatus)}</td>
                  <td>{entry.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {action.feedback}

      {asking ? (
        <form className={s.reasonBox} onSubmit={submitReason}>
          <span className={s.sectionLabel}>{asking === "REJECTED" ? "Lý do từ chối" : "Lý do gỡ khỏi thư viện"}</span>
          <span className={s.claimText}>Giáo viên sẽ nhận được lý do này. Chọn nhanh hoặc tự viết.</span>
          <div className={s.reasonChips}>
            {(asking === "REJECTED" ? REJECT_REASONS : REMOVE_REASONS).map(value => (
              <button
                key={value}
                type="button"
                className={s.reasonChip}
                aria-pressed={reason === value}
                onClick={() => setReason(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <textarea
            className={s.textarea}
            rows={3}
            required
            autoFocus
            placeholder="Ví dụ: Gia tốc trọng trường đang đặt 98 m/s², cần sửa thành 9,8 m/s²."
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
          <div className={s.decisionRight} style={{ justifyContent: "flex-end" }}>
            <button type="button" className={s.surfaceBtn} onClick={() => { setAsking(null); setReason(""); }}>
              Quay lại
            </button>
            <button type="submit" className={s.dangerBtn} disabled={action.busy || !reason.trim()}>
              {action.busy ? "Đang lưu…" : asking === "REJECTED" ? "Từ chối mô phỏng" : "Gỡ mô phỏng"}
            </button>
          </div>
        </form>
      ) : (
        <div className={s.decisionBar}>
          {status === "PENDING" && (
            <>
              <button
                type="button"
                className={s.surfaceBtn}
                disabled={action.busy || claimedByOther}
                onClick={() => setAsking("REJECTED")}
              >
                Từ chối
              </button>
              <div className={s.decisionRight}>
                <button
                  type="button"
                  className={s.surfaceBtn}
                  disabled={action.busy || approveBlocked}
                  onClick={() => void decide("FEATURED")}
                >
                  <ReviewerIcon name="star" size={15} />
                  Duyệt & đánh dấu nổi bật
                </button>
                <button
                  type="button"
                  className={s.primaryBtn}
                  disabled={action.busy || approveBlocked}
                  onClick={() => void decide("APPROVED")}
                >
                  <ReviewerIcon name="check" size={15} />
                  Phê duyệt
                </button>
              </div>
              {approveBlocked && !action.busy && (
                <p className={s.decisionHint}>
                  {claimedByOther
                    ? `Mô phỏng đang được ${item.assignedToName} nhận duyệt — bấm “Tiếp nhận lại” để xử lý.`
                    : previewOk === null
                      ? "Đang mở mô phỏng…"
                      : previewOk === false
                        ? "Mô phỏng lỗi nên không thể phê duyệt."
                        : "Đánh dấu đủ 3 tiêu chí để phê duyệt."}
                </p>
              )}
            </>
          )}

          {status === "APPROVED" && (
            <>
              <button type="button" className={s.surfaceBtn} disabled={action.busy} onClick={() => setAsking("REMOVED")}>
                <ReviewerIcon name="trash" size={15} />
                Gỡ khỏi thư viện
              </button>
              <button type="button" className={s.primaryBtn} disabled={action.busy} onClick={() => void decide("FEATURED")}>
                <ReviewerIcon name="star" size={15} />
                Đánh dấu nổi bật
              </button>
            </>
          )}

          {status === "FEATURED" && (
            <>
              <button type="button" className={s.surfaceBtn} disabled={action.busy} onClick={() => setAsking("REMOVED")}>
                <ReviewerIcon name="trash" size={15} />
                Gỡ khỏi thư viện
              </button>
              <button type="button" className={s.surfaceBtn} disabled={action.busy} onClick={() => void decide("APPROVED")}>
                Bỏ nổi bật
              </button>
            </>
          )}

          {(status === "REJECTED" || status === "REMOVED") && (
            <>
              <button type="button" className={s.primaryBtn} disabled={action.busy || previewOk !== true} onClick={() => void decide("APPROVED")}>
                <ReviewerIcon name="check" size={15} />
                Duyệt lại
              </button>
              {previewOk !== true && !action.busy && (
                <p className={s.decisionHint}>
                  {previewOk === null ? "Đang mở mô phỏng…" : "Mô phỏng lỗi nên không thể duyệt lại."}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
