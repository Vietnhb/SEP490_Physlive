import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import { LoadState } from "../../../shared/ui/OperationsKit";
import { formatDate, matches, reviewerStatusLabel, timeAgo } from "../model/reviewerUtils";
import s from "./TopicsWorkspace.module.css";

type HistoryEntry = {
  id: string;
  schemaVersionId: string;
  schemaId: string;
  topicName: string;
  version: string;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};

type ActionFilter = "ALL" | "CREATE" | "UPDATE" | "APPROVE" | "RETIRE";

const ACTION_META: Record<string, { label: string; actorRole: string; pill: "draft" | "approved" | "retired" }> = {
  CREATE_DRAFT: { label: "Tạo bản nháp", actorRole: "Người tạo", pill: "draft" },
  UPDATE_DRAFT: { label: "Cập nhật bản nháp", actorRole: "Người sửa", pill: "draft" },
  APPROVE: { label: "Phê duyệt phát hành", actorRole: "Người duyệt", pill: "approved" },
  RETIRE: { label: "Ngừng sử dụng", actorRole: "Người thực hiện", pill: "retired" },
  AUTO_RETIRE: { label: "Tự động ngừng dùng", actorRole: "Hệ thống / Người duyệt", pill: "retired" },
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
};

function matchesActionFilter(action: string, filter: ActionFilter) {
  if (filter === "ALL") return true;
  if (filter === "CREATE") return action === "CREATE_DRAFT";
  if (filter === "UPDATE") return action === "UPDATE_DRAFT";
  if (filter === "APPROVE") return action === "APPROVE";
  return action === "RETIRE" || action === "AUTO_RETIRE";
}

function versionTargetUrl(entry: HistoryEntry) {
  const params = new URLSearchParams({
    schemaId: entry.schemaId,
    versionId: entry.schemaVersionId,
  });
  return `/reviewer/topics?${params.toString()}`;
}

export function VersionHistoryDesk({
  embedded = false,
  onOpenVersion,
}: Readonly<{
  embedded?: boolean;
  onOpenVersion?: (schemaVersionId: string, schemaId: string) => void;
}> = {}) {
  const resource = useResource<HistoryEntry[]>("/reviewer/schemas/history");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const all = useMemo(() => resource.data ?? [], [resource.data]);

  const topics = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach(item => {
      if (!map.has(item.schemaId)) map.set(item.schemaId, item.topicName || item.schemaId);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [all]);

  const rows = useMemo(() => all.filter(entry =>
    matchesActionFilter(entry.action, actionFilter)
    && (topicFilter === "ALL" || entry.schemaId === topicFilter)
    && matches(
      query,
      entry.topicName,
      entry.schemaId,
      `v${entry.version}`,
      entry.actorName,
      entry.actorEmail,
      entry.note,
      ACTION_META[entry.action]?.label ?? entry.action,
    ),
  ), [all, actionFilter, topicFilter, query]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const countByFilter = (f: ActionFilter) => all.filter(e => matchesActionFilter(e.action, f)).length;

  const cardContent = (
    <section className={s.card} aria-label="Bảng lịch sử thay đổi phiên bản">
      <div className={s.toolbar}>
        <div className={s.seg} role="group" aria-label="Lọc theo hành động">
          <button type="button" className={s.segItem} aria-pressed={actionFilter === "ALL"} onClick={() => { setActionFilter("ALL"); setPage(1); }}>
            Tất cả ({all.length})
          </button>
          <button type="button" className={s.segItem} aria-pressed={actionFilter === "CREATE"} onClick={() => { setActionFilter("CREATE"); setPage(1); }}>
            Tạo mới ({countByFilter("CREATE")})
          </button>
          <button type="button" className={s.segItem} aria-pressed={actionFilter === "UPDATE"} onClick={() => { setActionFilter("UPDATE"); setPage(1); }}>
            Chỉnh sửa ({countByFilter("UPDATE")})
          </button>
          <button type="button" className={s.segItem} aria-pressed={actionFilter === "APPROVE"} onClick={() => { setActionFilter("APPROVE"); setPage(1); }}>
            Phê duyệt ({countByFilter("APPROVE")})
          </button>
          <button type="button" className={s.segItem} aria-pressed={actionFilter === "RETIRE"} onClick={() => { setActionFilter("RETIRE"); setPage(1); }}>
            Ngừng dùng ({countByFilter("RETIRE")})
          </button>
        </div>

        <div className={s.searchWrap}>
          <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            className={s.searchInput}
            aria-label="Tìm trong lịch sử thay đổi"
            placeholder="Tìm chủ đề, phiên bản, người tạo/sửa/duyệt…"
            value={query}
            onChange={event => { setQuery(event.target.value); setPage(1); }}
          />
        </div>

        {topics.length > 0 && (
          <select
            className={s.selectSm}
            style={{ height: 36 }}
            aria-label="Lọc theo chủ đề"
            value={topicFilter}
            onChange={event => { setTopicFilter(event.target.value); setPage(1); }}
          >
            <option value="ALL">Tất cả chủ đề</option>
            {topics.map(([schemaId, name]) => (
              <option key={schemaId} value={schemaId}>{name}</option>
            ))}
          </select>
        )}

        <button
          type="button"
          className={s.iconBtn}
          onClick={() => void resource.refresh()}
          disabled={resource.refreshing}
          aria-label="Làm mới lịch sử thay đổi"
          title="Làm mới"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={resource.refreshing ? s.spin : undefined} aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>

      <LoadState {...resource} headers={["Thời gian", "Chủ đề & Phiên bản", "Hành động", "Người thực hiện", "Trạng thái / Ghi chú", ""]} />

      {!resource.loading && (
        <>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Chủ đề &amp; Phiên bản</th>
                  <th>Hành động</th>
                  <th>Người thực hiện</th>
                  <th>Trạng thái / Ghi chú</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(entry => {
                  const meta = ACTION_META[entry.action] ?? { label: entry.action, actorRole: "Người thực hiện", pill: "retired" as const };
                  const pillClass = meta.pill === "approved" ? s.stApproved : meta.pill === "draft" ? s.stDraft : s.stRetired;
                  const actor = entry.actorName || entry.actorEmail || "Hệ thống";
                  const targetUrl = versionTargetUrl(entry);
                  return (
                    <tr key={entry.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={s.verMono} title={formatDateTime(entry.createdAt)}>
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <span className={s.dateSmall}>{timeAgo(entry.createdAt) || formatDate(entry.createdAt)}</span>
                      </td>
                      <td>
                        {onOpenVersion ? (
                          <button
                            type="button"
                            className={s.topicLink}
                            onClick={() => onOpenVersion(entry.schemaVersionId, entry.schemaId)}
                          >
                            {entry.topicName || entry.schemaId} · v{entry.version}
                          </button>
                        ) : (
                          <Link to={targetUrl} className={s.inlineGapLink} style={{ display: "block", fontSize: 13.5 }}>
                            {entry.topicName || entry.schemaId} · v{entry.version}
                          </Link>
                        )}
                        <span className={s.codeMono}>{entry.schemaId}</span>
                      </td>
                      <td>
                        <span className={`${s.statusPill} ${pillClass}`}>{meta.label}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{actor}</div>
                        <span className={s.dateSmall}>
                          {entry.actorEmail || "Tự động bởi hệ thống"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, color: "var(--gray-11)" }}>
                          {entry.fromStatus ? `${reviewerStatusLabel(entry.fromStatus)} → ` : ""}
                          {entry.toStatus ? reviewerStatusLabel(entry.toStatus) : "—"}
                        </div>
                        {entry.note && <span className={s.dateSmall}>{entry.note}</span>}
                      </td>
                      <td className={s.actionsCell}>
                        {onOpenVersion ? (
                          <button
                            type="button"
                            className={s.surfaceBtn}
                            onClick={() => onOpenVersion(entry.schemaVersionId, entry.schemaId)}
                          >
                            Xem phiên bản →
                          </button>
                        ) : (
                          <Link to={targetUrl} className={s.surfaceBtn} style={{ textDecoration: "none" }}>
                            Xem phiên bản →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!resource.error && rows.length === 0 && (
              <p className={s.empty}>
                {query || actionFilter !== "ALL" || topicFilter !== "ALL"
                  ? "Không có mục lịch sử nào khớp bộ lọc."
                  : "Chưa có lịch sử thay đổi nào được ghi nhận."}
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <footer className={s.pager}>
              <span>
                Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} / {rows.length} thao tác
              </span>
              <div className={s.pagerActions}>
                <select
                  className={s.selectSm}
                  aria-label="Số dòng mỗi trang"
                  value={String(pageSize)}
                  onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
                >
                  {[10, 15, 30, 50].map(val => <option key={val} value={val}>Số dòng mỗi trang {val}</option>)}
                </select>
                <button type="button" className={s.surfaceBtn} disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  ← Trước
                </button>
                <span>Trang {currentPage}/{totalPages}</span>
                <button type="button" className={s.surfaceBtn} disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Sau →
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </section>
  );

  if (embedded) return cardContent;

  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div className={s.headingCopy}>
          <h1 className={s.title}>Lịch sử thay đổi</h1>
          <p className={s.sub}>
            Ghi nhận đầy đủ thời gian, người tạo, người sửa và người phê duyệt các phiên bản chủ đề vật lý.
          </p>
        </div>
      </header>
      {cardContent}
    </div>
  );
}
