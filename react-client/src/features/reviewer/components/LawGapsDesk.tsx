import { useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Button, Card, Heading, SegmentedControl, Select, Text, TextArea } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { matches } from "../model/reviewerUtils";
import { ReviewerPagination, ReviewerRefresh, ReviewerSearch } from "./ReviewerKit";

type Gap = {
  id: string; kind: "UNCHECKED" | "NO_ROLE" | "AMBIGUOUS" | "VIOLATION" | "COMPLAINT"; schemaId?: string; topic?: string; role?: string; unit?: string; label?: string;
  occurrences: number; exampleDescription?: string; exampleFormula?: string; status: "OPEN" | "RESOLVED" | "DISMISSED"; note?: string;
  decidedByName?: string | null; decidedAt?: string | null; sourceComplaintId?: string | null; updatedAt: string;
};
type Filter = "OPEN" | "RESOLVED" | "DISMISSED";
type KindFilter = "ALL" | Gap["kind"];
type GapCounts = Partial<Record<Filter, number>>;

const KIND: Record<Gap["kind"], { short: string; title: string; todo: string }> = {
  UNCHECKED: { short: "Chưa có định luật", title: "Vai trò chưa có định luật kiểm", todo: "Thêm một định luật dùng vai trò này vào chủ đề liên quan." },
  NO_ROLE: { short: "Thiếu vai trò", title: "Đại lượng chưa có vai trò phù hợp", todo: "Thêm vai trò mới cho loại đại lượng này, rồi thêm định luật dùng vai trò đó." },
  AMBIGUOUS: { short: "Định luật mơ hồ", title: "Định luật không xác định được đại lượng", todo: "Bổ sung điều kiện (where, scope) cho định luật để nó chọn đúng một đại lượng." },
  VIOLATION: { short: "Định luật bác bỏ", title: "Định luật vẫn bác bỏ mô hình sau khi AI sửa", todo: "Xem mô hình AI viết sai hay định luật đang quá hẹp, rồi sửa định luật nếu cần." },
  COMPLAINT: { short: "Từ khiếu nại", title: "Chuyển từ khiếu nại mô phỏng của giáo viên", todo: "Kiểm tra lại định luật/dữ liệu chuẩn của chủ đề liên quan, cập nhật nếu cần rồi đánh dấu đã xử lý." },
};
const DESCRIPTION_PREVIEW = 280;
const lastSeen = (at: string) => new Date(at).toLocaleDateString("vi-VN");

function topicLinkOf(gap: Gap) {
  if (gap.schemaId) return `/reviewer/topics?schemaId=${encodeURIComponent(gap.schemaId)}`;
  if (gap.topic) return `/reviewer/topics?topic=${encodeURIComponent(gap.topic)}`;
  return "/reviewer/topics";
}

/** What teachers' simulations computed that no law could check, most frequent first. */
export function LawGapsDesk() {
  const topicName = useTopicName();
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
  const items = useMemo(() => resource.data ?? [], [resource.data]);
  const loading = resource.loading;
  const error = actionError || resource.error || "";

  const load = () => {
    setError("");
    return Promise.all([countsResource.refresh(), resource.refresh()]);
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

  const decide = async (gap: Gap, status: Filter) => {
    setBusy(gap.id); setError("");
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
      if (filter !== "OPEN" && status !== "OPEN") {
        void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/law-gaps?status=OPEN") });
      }
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      setError(message || "Chưa lưu được. Vui lòng thử lại.");
    } finally { setBusy(""); }
  };

  const countOf = (status: Filter) => countsResource.data?.[status];
  const hasFilters = Boolean(query.trim()) || kindFilter !== "ALL" || activeTopic !== "ALL";

  return <div className="reviewer-stack">
    <header className="reviewer-page-head">
      <div>
        <Heading as="h1" className="admin-content-title" size="6">Định luật cần rà soát</Heading>
        <Text as="p" size="2" color="gray" mt="1">Các trường hợp định luật chưa kiểm được mô phỏng, gộp theo loại. Đánh dấu khi đã xử lý; gặp lại thì mục tự mở lại.</Text>
      </div>
      <ReviewerRefresh refresh={() => void load()} loading={countsResource.refreshing || resource.refreshing} />
    </header>
    <div className="reviewer-toolbar-stack">
      <div className="reviewer-toolbar">
        <SegmentedControl.Root size="2" value={filter} onValueChange={value => { setFilter(value as Filter); setTopicFilter("ALL"); setPage(1); }} aria-label="Trạng thái rà soát">
          <SegmentedControl.Item value="OPEN">Cần xử lý{countOf("OPEN") !== undefined ? ` (${countOf("OPEN")})` : ""}</SegmentedControl.Item>
          <SegmentedControl.Item value="RESOLVED">Đã bổ sung{countOf("RESOLVED") !== undefined ? ` (${countOf("RESOLVED")})` : ""}</SegmentedControl.Item>
          <SegmentedControl.Item value="DISMISSED">Không cần bổ sung{countOf("DISMISSED") !== undefined ? ` (${countOf("DISMISSED")})` : ""}</SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>
      <div className="reviewer-toolbar">
        <ReviewerSearch aria-label="Tìm mục cần rà soát" placeholder="Tìm vai trò, đại lượng, công thức, mô tả…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <Select.Root size="3" value={kindFilter} onValueChange={value => { setKindFilter(value as KindFilter); setPage(1); }}>
          <Select.Trigger aria-label="Lọc theo loại" className="reviewer-filter" />
          <Select.Content>
            <Select.Item value="ALL">Tất cả loại</Select.Item>
            {(Object.keys(KIND) as Gap["kind"][]).map(kind => <Select.Item key={kind} value={kind}>{KIND[kind].short}</Select.Item>)}
          </Select.Content>
        </Select.Root>
        {topics.length > 0 && <Select.Root size="3" value={activeTopic} onValueChange={value => { setTopicFilter(value); setPage(1); }}>
          <Select.Trigger aria-label="Lọc theo chủ đề" className="reviewer-filter" />
          <Select.Content>
            <Select.Item value="ALL">Tất cả chủ đề</Select.Item>
            {topics.map(topic => <Select.Item key={topic} value={topic}>{topicName(topic)}</Select.Item>)}
          </Select.Content>
        </Select.Root>}
      </div>
    </div>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    {loading && items.length === 0 && <CardLoadingSkeleton cards={3} label="Đang tải danh sách định luật cần rà soát…" />}
    {!loading && rows.length === 0 && <Card size="3"><Text as="p" color="gray">{hasFilters ? "Không tìm thấy mục nào khớp bộ lọc." : filter === "OPEN" ? "Không có mục nào cần xử lý. Các mục mới sẽ xuất hiện khi giáo viên tạo mô phỏng có đại lượng chưa được kiểm." : "Chưa có mục nào."}</Text></Card>}
    {visibleRows.map(gap => <Card key={gap.id} size="3">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <Text as="div" size="1" color="gray">{KIND[gap.kind].title}{gap.topic ? ` · ${topicName(gap.topic)}` : ""}</Text>
          <Heading as="h2" size="4" mt="1">{gap.kind === "UNCHECKED" ? <><code>{gap.role}</code>{gap.unit ? ` (${gap.unit})` : ""}</> : gap.label}</Heading>
          {gap.kind === "NO_ROLE" && gap.unit && <Text as="p" size="2" color="gray">Đơn vị: {gap.unit}</Text>}
        </div>
        <div style={{ textAlign: "right" }}>
          <Text as="div" size="2" weight="bold" style={{ whiteSpace: "nowrap" }}>Gặp {gap.occurrences} lần</Text>
          <Text as="div" size="1" color="gray" style={{ whiteSpace: "nowrap" }}>Lần gần nhất {lastSeen(gap.updatedAt)}</Text>
        </div>
      </div>
      {gap.exampleDescription && (gap.exampleDescription.length > DESCRIPTION_PREVIEW
        ? <details style={{ marginTop: 8 }}><summary><Text size="2"><strong>Mô tả của giáo viên (ví dụ gần nhất):</strong> {gap.exampleDescription.slice(0, DESCRIPTION_PREVIEW)}… <Text color="blue">Xem đầy đủ</Text></Text></summary>
            <Text as="p" size="2" mt="1" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{gap.exampleDescription}</Text></details>
        : <Text as="p" size="2" mt="2"><strong>Mô tả của giáo viên (ví dụ gần nhất):</strong> {gap.exampleDescription}</Text>)}
      {gap.exampleFormula && <Text as="p" size="2" mt="1"><strong>{gap.kind === "COMPLAINT" ? "Ghi chú từ người kiểm duyệt:" : "AI đã viết:"}</strong> <code style={{ wordBreak: "break-word" }}>{gap.exampleFormula}</code></Text>}
      <Text as="p" size="2" mt="2" color="gray"><strong>Việc cần làm:</strong> {KIND[gap.kind].todo} <Link to={topicLinkOf(gap)}>{gap.topic ? `Mở chủ đề ${topicName(gap.topic)}` : "Mở Chủ đề vật lý"}</Link></Text>
      {gap.status === "OPEN" ? <>
        <label className="reviewer-field" style={{ marginTop: 8 }}><span>Ghi chú xử lý (không bắt buộc)</span>
          <TextArea size="2" rows={2} placeholder="Đã thêm định luật … vào chủ đề …" value={notes[gap.id] ?? ""} onChange={event => setNotes(current => ({ ...current, [gap.id]: event.target.value }))} /></label>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Button size="2" disabled={busy === gap.id} onClick={() => void decide(gap, "RESOLVED")}>Đã bổ sung định luật</Button>
          <Button size="2" variant="soft" color="gray" disabled={busy === gap.id} onClick={() => void decide(gap, "DISMISSED")}>Không cần bổ sung</Button>
        </div>
      </> : <>
        {(gap.decidedByName || gap.decidedAt) && <Text as="p" size="1" color="gray" mt="2">Xử lý bởi <strong>{gap.decidedByName || "Người kiểm duyệt"}</strong>{gap.decidedAt ? ` · ${lastSeen(gap.decidedAt)}` : ""}</Text>}
        {gap.note && <Text as="p" size="2" mt="1"><strong>Ghi chú:</strong> {gap.note}</Text>}
        <Button size="1" variant="soft" color="gray" mt="2" disabled={busy === gap.id} onClick={() => void decide(gap, "OPEN")}>Mở lại</Button>
      </>}
    </Card>)}
    <ReviewerPagination total={rows.length} page={currentPage} pageSize={pageSize} noun="mục" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
  </div>;
}
