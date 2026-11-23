import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, Heading, SegmentedControl, Select, Text, TextArea } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { LibraryItem } from "../../../shared/types/physlive";
import { LoadState } from "../../../shared/ui/OperationsKit";
import { useAction, useResource } from "../../../shared/hooks/operationsData";
import { formatDate, reviewerStatusLabel, timeAgo } from "../model/reviewerUtils";
import { useReviewerCatalog } from "../hooks/useReviewerCatalog";
import { ReviewerIcon, ReviewerRefresh, ReviewerSearch, ReviewStatus, SlaBadge } from "./ReviewerKit";
import { SimulationPreviewPane } from "./SimulationPreviewPane";

type ModeratedItem = Omit<LibraryItem, "moderationStatus"> & {
  moderationStatus?: string;
  moderationComment?: string | null;
  description?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
};
type Decision = "APPROVED" | "FEATURED" | "REJECTED" | "REMOVED";
type Filter = "PENDING" | "APPROVED" | "FEATURED" | "REJECTED" | "REMOVED";
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

const REJECT_REASONS = ["Sai kiến thức vật lý", "Mô phỏng không chạy hoặc hiển thị lỗi", "Không phù hợp chương trình THPT", "Tiêu đề / mô tả chưa rõ ràng", "Trùng với nội dung đã có"];
const REMOVE_REASONS = ["Phát hiện sai sót sau khi duyệt", "Giáo viên yêu cầu gỡ", "Nội dung đã lỗi thời"];

const CHECKLIST = ["Kiến thức vật lý chính xác, đơn vị và số liệu hợp lý", "Mô phỏng chạy được, hiển thị rõ ràng", "Phù hợp học sinh THPT, không có nội dung không phù hợp"];

export function ContentModeration() {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [mineOnly, setMineOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const pageUrl = useMemo(() => {
    const params = new URLSearchParams({ status: filter, page: String(page), size: String(PAGE_SIZE) });
    if (topicFilter !== "ALL") params.set("topic", topicFilter);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (filter === "PENDING") {
      if (mineOnly) params.set("assignedToMe", "true");
      else if (unassignedOnly) params.set("unassignedOnly", "true");
      if (overdueOnly) params.set("slaHours", "24");
    }
    return `/reviewer/library/page?${params.toString()}`;
  }, [filter, page, topicFilter, debouncedQuery, mineOnly, unassignedOnly, overdueOnly]);

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
    // Move on to the next item in the same list so the reviewer keeps a steady rhythm.
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

  return <div className="reviewer-stack">
    <header className="reviewer-page-head">
      <div><Heading as="h1" className="admin-content-title" size="6">Kiểm duyệt mô phỏng</Heading><Text as="p" size="2" color="gray" mt="1">Giáo viên chia sẻ mô phỏng lên thư viện công khai. Hãy chạy thử mô phỏng trước khi quyết định.</Text></div>
      <ReviewerRefresh refresh={() => void refreshAll()} loading={refreshing} />
    </header>
    <div className="reviewer-toolbar-stack">
      <div className="reviewer-toolbar">
        <SegmentedControl.Root size="2" value={filter} onValueChange={value => { setFilter(value as Filter); setPage(0); setSelectedId(""); }} aria-label="Lọc theo trạng thái">
          {FILTERS.map(item => {
            const count = countsResource.data?.[item.value];
            return <SegmentedControl.Item key={item.value} value={item.value}>{item.label}{count !== undefined ? ` (${count})` : ""}</SegmentedControl.Item>;
          })}
        </SegmentedControl.Root>
      </div>
      <div className="reviewer-toolbar">
        <ReviewerSearch aria-label="Tìm mô phỏng" placeholder="Tìm tiêu đề, chủ đề, giáo viên, trường" value={query} onChange={event => setQuery(event.target.value)} />
        {topics.length > 0 && <Select.Root size="3" value={topicFilter} onValueChange={value => { setTopicFilter(value); setPage(0); setSelectedId(""); }}>
          <Select.Trigger aria-label="Lọc theo chủ đề" className="reviewer-filter" />
          <Select.Content>
            <Select.Item value="ALL">Tất cả chủ đề</Select.Item>
            {topics.map(topic => <Select.Item key={topic} value={topic}>{catalog.topicName(topic)}</Select.Item>)}
          </Select.Content>
        </Select.Root>}
      </div>
      {filter === "PENDING" && <div className="reviewer-quick-filters" role="group" aria-label="Lọc nhanh mô phỏng chờ duyệt">
        <span className="reviewer-quick-label">Lọc nhanh:</span>
        <button type="button" className="reviewer-chip" aria-pressed={unassignedOnly} onClick={() => { setUnassignedOnly(value => !value); setMineOnly(false); setPage(0); setSelectedId(""); }}>Chưa có người nhận</button>
        <button type="button" className="reviewer-chip" aria-pressed={mineOnly} onClick={() => { setMineOnly(value => !value); setUnassignedOnly(false); setPage(0); setSelectedId(""); }}>Việc tôi đang nhận</button>
        <button type="button" className="reviewer-chip" aria-pressed={overdueOnly} onClick={() => { setOverdueOnly(value => !value); setPage(0); setSelectedId(""); }}>Quá hạn &gt; 24h</button>
      </div>}
    </div>
    <LoadState {...pageResource} />
    {!pageResource.loading && !pageResource.error && rows.length === 0 && <Card size="3"><div className="reviewer-empty"><span className="reviewer-empty-icon"><ReviewerIcon name="check" size={30} /></span><Heading as="h2" size="4">{debouncedQuery || topicFilter !== "ALL" || mineOnly || unassignedOnly || overdueOnly ? "Không tìm thấy mô phỏng phù hợp" : filter === "PENDING" ? "Đã duyệt hết!" : "Chưa có mô phỏng nào"}</Heading><Text as="p" color="gray" size="2">{debouncedQuery || topicFilter !== "ALL" || mineOnly || unassignedOnly || overdueOnly ? "Thử từ khóa hoặc bộ lọc khác." : filter === "PENDING" ? "Mô phỏng mới do giáo viên gửi sẽ xuất hiện tại đây." : "Danh sách này đang trống."}</Text></div></Card>}
    {!pageResource.loading && rows.length > 0 && <div className="reviewer-split">
      <aside className="reviewer-list" aria-label="Danh sách mô phỏng">
        <Text as="div" size="1" color="gray" className="reviewer-list-count">{rows.length}{totalElements > rows.length ? ` / ${totalElements}` : ""} mô phỏng</Text>
        {rows.map(item => <button key={item.id} type="button" className="reviewer-list-item" aria-current={selected?.id === item.id ? "true" : undefined} onClick={() => setSelectedId(item.id)}>
          <strong>{item.title}</strong>
          <span className="reviewer-list-meta">{catalog.topicName(item.topic) || "Chưa gắn chủ đề"}</span>
          <span className="reviewer-list-meta">{item.sharedByName || "Không rõ người gửi"}{item.schoolName ? ` · ${item.schoolName}` : ""}</span>
          <div className="reviewer-list-tags">
            {item.createdAt && <small>{timeAgo(item.createdAt)}</small>}
            <SlaBadge createdAt={item.createdAt} active={filter === "PENDING"} />
            {item.assignedToName && <Badge size="1" color="indigo" variant="soft">Đang duyệt: {item.assignedToName}</Badge>}
          </div>
        </button>)}
        {totalPages > 1 && <div className="reviewer-list-pager">
          <Button type="button" variant="soft" color="gray" size="1" disabled={page <= 0} onClick={() => { setPage(p => Math.max(0, p - 1)); setSelectedId(""); }}>← Trước</Button>
          <Text size="1" color="gray">Trang {page + 1}/{totalPages}</Text>
          <Button type="button" variant="soft" color="gray" size="1" disabled={page + 1 >= totalPages} onClick={() => { setPage(p => p + 1); setSelectedId(""); }}>Sau →</Button>
        </div>}
      </aside>
      {selected && <ModerationDetail key={selected.id} item={selected} topic={catalog.topicName(selected.topic)} onUpdated={onItemUpdated} onDone={decision => afterDecision(selected.id, decision)} />}
    </div>}
  </div>;
}

function ModerationDetail({ item, topic, onUpdated, onDone }: Readonly<{ item: ModeratedItem; topic: string; onUpdated: (updated: ModeratedItem) => void; onDone: (decision: Decision) => void }>) {
  const me = useSessionStore(state => state.user);
  const action = useAction();
  const status = (item.moderationStatus || "PENDING") as Filter;
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
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
    const messages: Record<Decision, string> = { APPROVED: "Đã phê duyệt mô phỏng.", FEATURED: "Đã phê duyệt và đánh dấu nổi bật.", REJECTED: "Đã từ chối và gửi lý do cho giáo viên.", REMOVED: "Đã gỡ mô phỏng khỏi thư viện." };
    const ok = await action.run(
      () => api.put(`/reviewer/library/${item.id}`, { status: decision, comment: comment?.trim() || undefined, expectedStatus: status }),
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

  return <Card size="3" className="reviewer-detail">
    <div className="reviewer-detail-head reviewer-sticky-header" style={{ marginBottom: 0 }}>
      <div><Heading as="h2" size="5">{item.title}</Heading>
        <div className="reviewer-detail-meta">
          <ReviewStatus status={status} />
          <SlaBadge createdAt={item.createdAt} active={status === "PENDING"} />
          {item.assignedToName && <Badge color={claimedByMe ? "indigo" : "amber"} variant="soft">{claimedByMe ? "Bạn đang nhận duyệt" : `Đang duyệt: ${item.assignedToName}`}</Badge>}
          {topic && <Badge color="gray" variant="soft">{topic}</Badge>}
          <Text size="2" color="gray"><ReviewerIcon name="user" size={14} /> {item.sharedByName || "Không rõ"}{item.schoolName ? ` · ${item.schoolName}` : ""}{item.createdAt ? ` · gửi ${timeAgo(item.createdAt)}` : ""}</Text>
        </div>
      </div>
      {status === "PENDING" && (claimedByOther ? (
        <Button type="button" size="2" variant="soft" color="amber" disabled={action.busy} onClick={() => setConfirmTakeover(true)}>
          Tiếp nhận lại
        </Button>
      ) : (
        <Button type="button" size="2" variant="soft" color={claimedByMe ? "gray" : "indigo"} disabled={action.busy} onClick={() => void toggleClaim(claimedByMe)}>
          {claimedByMe ? "Bỏ nhận duyệt" : "Nhận duyệt"}
        </Button>
      ))}
    </div>
    {confirmTakeover && claimedByOther && <div className="reviewer-note" role="alert">
      <strong>Mô phỏng đang được {item.assignedToName} nhận duyệt.</strong> Bạn có chắc muốn tiếp nhận lại không?
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button type="button" size="1" color="amber" disabled={action.busy} onClick={() => void toggleClaim(false, true)}>Xác nhận tiếp nhận</Button>
        <Button type="button" size="1" variant="soft" color="gray" disabled={action.busy} onClick={() => setConfirmTakeover(false)}>Hủy</Button>
      </div>
    </div>}
    {item.description && <Text as="p" size="2" className="reviewer-context-text">{item.description}</Text>}
    {item.moderationComment && status !== "PENDING" && <div className="reviewer-note"><strong>Ghi chú kiểm duyệt:</strong> {item.moderationComment}</div>}
    <SimulationPreviewPane simulationId={item.simulationId} onLoaded={onLoaded} />

    {history.length > 0 && <details className="reviewer-disclosure">
      <summary>Lịch sử kiểm duyệt ({history.length})</summary>
      <table className="reviewer-mini-table">
        <thead><tr><th>Thời điểm</th><th>Người duyệt</th><th>Thay đổi</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {history.map(entry => <tr key={entry.id}>
            <td title={formatDate(entry.decidedAt)}>{timeAgo(entry.decidedAt) || formatDate(entry.decidedAt)}</td>
            <td>{entry.reviewerEmail || "—"}</td>
            <td>{entry.fromStatus ? `${reviewerStatusLabel(entry.fromStatus)} → ` : ""}{reviewerStatusLabel(entry.toStatus)}</td>
            <td>{entry.comment || "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </details>}

    {status === "PENDING" && <fieldset className="reviewer-checklist">
      <legend>Trước khi phê duyệt, xác nhận rằng:</legend>
      {CHECKLIST.map((label, index) => <label key={label}><input type="checkbox" checked={checked[index]} onChange={event => setChecked(values => values.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}
    </fieldset>}

    {action.feedback}
    {asking ? <form className="reviewer-reason" onSubmit={submitReason}>
      <Text as="div" size="3" weight="bold">{asking === "REJECTED" ? "Lý do từ chối" : "Lý do gỡ khỏi thư viện"}</Text>
      <Text as="p" size="2" color="gray">Giáo viên sẽ nhận được lý do này. Chọn nhanh hoặc tự viết.</Text>
      <div className="reviewer-chips">{(asking === "REJECTED" ? REJECT_REASONS : REMOVE_REASONS).map(value => <button key={value} type="button" className="reviewer-chip" aria-pressed={reason === value} onClick={() => setReason(value)}>{value}</button>)}</div>
      <TextArea size="3" rows={3} required autoFocus placeholder="Ví dụ: Gia tốc trọng trường đang đặt 98 m/s², cần sửa thành 9,8 m/s²." value={reason} onChange={event => setReason(event.target.value)} />
      <div className="reviewer-form-footer"><Button type="button" variant="soft" color="gray" onClick={() => { setAsking(null); setReason(""); }}>Quay lại</Button><Button type="submit" color="red" disabled={action.busy || !reason.trim()}>{action.busy ? "Đang lưu…" : asking === "REJECTED" ? "Từ chối mô phỏng" : "Gỡ mô phỏng"}</Button></div>
    </form> : <div className="reviewer-decision-bar reviewer-sticky-footer">
      {status === "PENDING" && <>
        <Button size="3" disabled={action.busy || approveBlocked} onClick={() => void decide("APPROVED")}><ReviewerIcon name="check" size={16} />Phê duyệt</Button>
        <Button size="3" variant="soft" disabled={action.busy || approveBlocked} onClick={() => void decide("FEATURED")}><ReviewerIcon name="star" size={16} />Duyệt & nổi bật</Button>
        <span className="reviewer-spacer" />
        <Button size="3" variant="soft" color="red" disabled={action.busy || claimedByOther} onClick={() => setAsking("REJECTED")}><ReviewerIcon name="close" size={16} />Từ chối</Button>
      </>}
      {status === "APPROVED" && <>
        <Button size="3" variant="soft" disabled={action.busy} onClick={() => void decide("FEATURED")}><ReviewerIcon name="star" size={16} />Đánh dấu nổi bật</Button>
        <span className="reviewer-spacer" />
        <Button size="3" variant="soft" color="red" disabled={action.busy} onClick={() => setAsking("REMOVED")}><ReviewerIcon name="trash" size={16} />Gỡ khỏi thư viện</Button>
      </>}
      {status === "FEATURED" && <>
        <Button size="3" variant="soft" color="gray" disabled={action.busy} onClick={() => void decide("APPROVED")}>Bỏ nổi bật</Button>
        <span className="reviewer-spacer" />
        <Button size="3" variant="soft" color="red" disabled={action.busy} onClick={() => setAsking("REMOVED")}><ReviewerIcon name="trash" size={16} />Gỡ khỏi thư viện</Button>
      </>}
      {(status === "REJECTED" || status === "REMOVED") && <>
        <Button size="3" variant="soft" disabled={action.busy || previewOk !== true} onClick={() => void decide("APPROVED")}><ReviewerIcon name="check" size={16} />Duyệt lại</Button>
        {previewOk !== true && !action.busy && <Text as="p" size="1" color="gray" className="reviewer-decision-hint">{previewOk === null ? "Đang mở mô phỏng…" : "Mô phỏng lỗi nên không thể duyệt lại."}</Text>}
      </>}
      {status === "PENDING" && approveBlocked && !action.busy && <Text as="p" size="1" color="gray" className="reviewer-decision-hint">{claimedByOther ? `Mô phỏng đang được ${item.assignedToName} nhận duyệt — bấm “Tiếp nhận lại” để xử lý.` : previewOk === null ? "Đang mở mô phỏng…" : previewOk === false ? "Mô phỏng lỗi nên không thể phê duyệt." : "Đánh dấu đủ 3 tiêu chí để phê duyệt."}</Text>}
    </div>}
  </Card>;
}
