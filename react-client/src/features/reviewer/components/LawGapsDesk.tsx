import { useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { matches } from "../model/reviewerUtils";
import { LawGapsArt } from "./LawGapsArt";
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
  sourceComplaintId?: string | null;
  updatedAt: string;
};
type Filter = "OPEN" | "RESOLVED" | "DISMISSED";
type KindFilter = "ALL" | Gap["kind"];
type GapCounts = Partial<Record<Filter, number>>;

const KIND: Record<Gap["kind"], { short: string; title: string; todo: string }> = {
  UNCHECKED: {
    short: "Vai trò chưa có định luật",
    title: "Vai trò chưa có định luật kiểm",
    todo: "Thêm một định luật dùng vai trò này vào chủ đề liên quan.",
  },
  NO_ROLE: {
    short: "Đại lượng chưa có vai trò",
    title: "Đại lượng chưa có vai trò phù hợp",
    todo: "Thêm vai trò mới cho loại đại lượng này, rồi thêm định luật dùng vai trò đó.",
  },
  AMBIGUOUS: {
    short: "Không xác định được đại lượng",
    title: "Định luật không xác định được đại lượng",
    todo: "Bổ sung điều kiện áp dụng và phạm vi cho định luật để nó chọn đúng một đại lượng.",
  },
  VIOLATION: {
    short: "Định luật bác bỏ kết quả",
    title: "Định luật bác bỏ kết quả mô phỏng",
    todo: "Xem mô hình AI viết sai hay định luật đang quá hẹp, rồi sửa định luật nếu cần.",
  },
  COMPLAINT: {
    short: "Từ khiếu nại",
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

function isoWeekNumber(ms: number): number {
  const d = new Date(ms);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

/** What teachers' simulations computed that no law could check, most frequent first. */
export function LawGapsDesk() {
  const topicName = useTopicName();
  const [nowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [actionError, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const countsResource = useResource<GapCounts>("/reviewer/law-gaps/counts");
  const resource = useResource<Gap[]>("/reviewer/law-gaps?status=" + filter);
  const openResource = useResource<Gap[]>("/reviewer/law-gaps?status=OPEN");
  const resolvedResource = useResource<Gap[]>("/reviewer/law-gaps?status=RESOLVED");

  const items = useMemo(() => resource.data ?? [], [resource.data]);
  const openItems = useMemo(() => openResource.data ?? [], [openResource.data]);
  const resolvedItems = useMemo(() => resolvedResource.data ?? [], [resolvedResource.data]);
  const loading = resource.loading;
  const error = actionError || resource.error || "";

  const load = () => {
    setError("");
    return Promise.all([countsResource.refresh(), resource.refresh(), openResource.refresh(), resolvedResource.refresh()]);
  };

  const topics = useMemo(() => {
    const seen = new Set<string>();
    items.forEach(item => { if (item.topic) seen.add(item.topic); });
    return Array.from(seen).sort((a, b) => topicName(a).localeCompare(topicName(b), "vi"));
  }, [items, topicName]);

  const activeTopic = topicFilter !== "ALL" && topics.includes(topicFilter) ? topicFilter : "ALL";

  const rows = useMemo(() => items.filter(gap =>
    (kindFilter === "ALL" || gap.kind === kindFilter)
    && (activeTopic === "ALL" || gap.topic === activeTopic)
    && matches(query, gap.role, gap.label, gap.unit, gap.topic, gap.topic ? topicName(gap.topic) : "", gap.schemaId, gap.exampleDescription, gap.exampleFormula, KIND[gap.kind].title)
  ), [items, kindFilter, activeTopic, query, topicName]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = pageSize > 0 ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;

  // Insight 1: Open gaps grouped by kind (sum of occurrences)
  const byKind = useMemo(() => {
    const kinds = (Object.keys(KIND) as Gap["kind"][]).map(kind => {
      const occ = openItems.filter(g => g.kind === kind).reduce((sum, g) => sum + g.occurrences, 0);
      return { kind, label: KIND[kind].short, occ };
    }).filter(k => k.occ > 0).sort((a, b) => b.occ - a.occ);
    const max = Math.max(1, ...kinds.map(k => k.occ));
    return kinds.map(k => ({ ...k, pct: Math.round((k.occ / max) * 100) }));
  }, [openItems]);

  // Insight 2: Resolved gaps in the last 5 ISO weeks
  const weeklyResolved = useMemo(() => {
    const weekMs = 7 * 86_400_000;
    const buckets = Array.from({ length: 5 }, (_, idx) => {
      const targetMs = nowMs - (4 - idx) * weekMs;
      const wk = isoWeekNumber(targetMs);
      return { week: wk, label: `T${wk}`, count: 0, isCurrent: idx === 4 };
    });
    const byWeek = new Map(buckets.map(b => [b.week, b]));
    resolvedItems.forEach(item => {
      const ts = Date.parse(item.decidedAt || item.updatedAt);
      if (!Number.isFinite(ts)) return;
      const wk = isoWeekNumber(ts);
      const bucket = byWeek.get(wk);
      if (bucket) bucket.count += 1;
    });
    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => ({
      ...b,
      heightPx: b.count > 0 ? Math.max(14, Math.round((b.count / max) * 86)) : 6,
    }));
  }, [resolvedItems, nowMs]);

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
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps?status=RESOLVED") });
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      setError(message || "Chưa lưu được. Vui lòng thử lại.");
    } finally {
      setBusy("");
    }
  };

  const countOf = (status: Filter) => countsResource.data?.[status];
  const hasFilters = Boolean(query.trim()) || kindFilter !== "ALL" || activeTopic !== "ALL";
  const refreshing = countsResource.refreshing || resource.refreshing;

  return (
    <div className={s.page}>
      {/* Page Header */}
      <header className={s.heading}>
        <div className={s.headingCopy}>
          <h1 className={s.title}>Định luật cần rà soát</h1>
          <p className={s.sub}>
            Các trường hợp định luật chưa kiểm được mô phỏng, gộp theo loại. Đánh dấu khi đã xử lý; gặp lại thì mục sẽ mở lại.
          </p>
        </div>
        <div className={s.headingRight}>
          <button type="button" className={s.surfaceBtn} onClick={() => void load()} disabled={refreshing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? s.spin : undefined} aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
            </svg>
            Làm mới
          </button>
          <LawGapsArt />
        </div>
      </header>

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

          <div className={s.filterRow}>
            <div className={s.searchWrap}>
              <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                className={s.searchInput}
                aria-label="Tìm mục cần rà soát"
                placeholder="Tìm vai trò, đại lượng, công thức, mô tả…"
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

            return (
              <article key={gap.id} className={s.card}>
                <div className={s.cardHead}>
                  <div style={{ minWidth: 0 }}>
                    <h2 className={s.cardTitle}>
                      {KIND[gap.kind].title}
                      {roleOrLabel && <span className={s.roleCode}>{roleOrLabel}</span>}
                    </h2>
                    <p className={s.cardSub}>
                      {gap.topic ? topicName(gap.topic) : "Chưa gắn chủ đề"} · cập nhật {lastSeen(gap.updatedAt)}
                    </p>
                    {gap.sourceComplaintId && (
                      <div className={s.chips}>
                        <span className={s.tagLaw}>Từ khiếu nại {complaintCode(gap.sourceComplaintId)}</span>
                      </div>
                    )}
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
                  {byKind.map((row, idx) => (
                    <div key={row.kind} className={s.hrow}>
                      <div className={s.hrowTop}>
                        <span>{row.label}</span>
                        <b>{number(row.occ)} lần</b>
                      </div>
                      <div className={s.barTrack}>
                        <i
                          className={`${s.barFill} ${idx === 0 ? s.barFillFirst : ""}`}
                          style={{ width: `${Math.max(6, row.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={s.decidedMeta}>Hiện chưa có mục cần xử lý.</p>
              )}
            </div>
          </section>

          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>Đã bổ sung mỗi tuần</h2>
              <span className={s.cardMuted}>5 tuần gần nhất</span>
            </div>
            <div className={s.cardBody}>
              <div className={s.vbars} role="img" aria-label="Số định luật đã bổ sung mỗi tuần">
                {weeklyResolved.map(bar => (
                  <div key={bar.label} className={s.vbarCol} title={`${bar.label}: ${bar.count}`}>
                    <span className={s.vbarVal}>{bar.count}</span>
                    <span
                      className={`${s.vbarFill} ${bar.isCurrent ? s.vbarFillHl : ""}`}
                      style={{ height: `${bar.heightPx}px` }}
                    />
                    <span className={s.vbarLabel}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
