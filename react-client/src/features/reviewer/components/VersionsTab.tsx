import PageActions from "../../../shared/layout/PageActions";
import RowActions from "../../../shared/ui/RowActions";
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Heading, SegmentedControl, Table, Text } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { LoadState } from "../../../shared/ui/OperationsKit";
import { useAction, useResource } from "../../../shared/hooks/operationsData";
import { VersionEditorModal, type VersionSaveOutcome } from "./VersionEditorModal";
import { ReviewerDialog } from "./ReviewerDialog";
import type { Version } from "../model/reviewerTypes";
import { formatDate, matches, reviewerStatusLabel, timeAgo } from "../model/reviewerUtils";
import { ReviewerIcon, ReviewerPagination, ReviewerRefresh, ReviewerSearch, ReviewStatus } from "./ReviewerKit";
import { objectRows } from "../model/jsonRows";
import { LawBook } from "./LawCatalogueEditor";

type Lifecycle = "DRAFT" | "APPROVED" | "RETIRED";
const ORDER = ["DRAFT", "APPROVED", "RETIRED"];
const gradeOf = (version: Version) => { const grade = (version.definition as { grade?: unknown } | undefined)?.grade; return grade ? `Lớp ${String(grade)}` : ""; };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function VersionsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = useResource<Version[]>("/reviewer/schemas");
  const action = useAction();
  const [filter, setFilter] = useState<"ALL" | Lifecycle>("ALL");
  const [query, setQuery] = useState(() => searchParams.get("topic") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selected, setSelected] = useState<Version | null>(null);
  const [editor, setEditor] = useState<{ version?: Version; clone: boolean } | null>(null);
  const [decision, setDecision] = useState<{ version: Version; status: "APPROVED" | "RETIRED" | "DELETE" } | null>(null);
  const all = useMemo(() => resource.data ?? [], [resource.data]);

  const deepSchemaId = searchParams.get("schemaId");
  const deepTarget = useMemo(() => {
    if (!deepSchemaId || all.length === 0) return null;
    const candidates = all.filter(item => item.schemaId.toLowerCase() === deepSchemaId.toLowerCase());
    return candidates.find(item => item.lifecycleStatus === "APPROVED")
      ?? candidates.find(item => item.lifecycleStatus === "DRAFT")
      ?? candidates[0]
      ?? null;
  }, [deepSchemaId, all]);
  const activeSelected = selected ?? deepTarget;
  const clearSelection = () => {
    setSelected(null);
    if (searchParams.has("schemaId") || searchParams.has("topic")) {
      const next = new URLSearchParams(searchParams);
      next.delete("schemaId");
      next.delete("topic");
      setSearchParams(next, { replace: true });
    }
  };
  const count = (status: Lifecycle) => all.filter(version => version.lifecycleStatus === status).length;
  const rows = all.filter(version => (filter === "ALL" || version.lifecycleStatus === filter) && matches(query, version.schemaId, version.name, version.topic, version.version))
    .sort((a, b) => ORDER.indexOf(a.lifecycleStatus) - ORDER.indexOf(b.lifecycleStatus));
  const noun = "chủ đề";

  // Merge roles, kinds and forceKinds across all topics so cross-topic roles (e.g. "force" in Electrostatics) resolve in Vietnamese.
  const sharedCatalogue = useMemo(() => {
    const roles: Record<string, unknown> = {};
    const kinds: Record<string, unknown> = {};
    const forceKinds: Record<string, unknown> = {};
    all.forEach(version => {
      const cat = asRecord(asRecord(version.definition).lawCatalogue);
      Object.entries(asRecord(cat.roles)).forEach(([k, v]) => { if (!(k in roles)) roles[k] = v; });
      Object.entries(asRecord(cat.kinds)).forEach(([k, v]) => { if (!(k in kinds)) kinds[k] = v; });
      Object.entries(asRecord(cat.forceKinds)).forEach(([k, v]) => { if (!(k in forceKinds)) forceKinds[k] = v; });
    });
    return { roles, kinds, forceKinds };
  }, [all]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = pageSize > 0 ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;
  const currentApprovedFor = (target?: Version) =>
    target ? all.find(item => item.id !== target.id && item.schemaId.toLowerCase() === target.schemaId.toLowerCase() && item.lifecycleStatus === "APPROVED") : undefined;

  const changeLifecycle = async () => {
    if (!decision) return;
    const targetId = decision.version.id;
    const isDelete = decision.status === "DELETE";
    let updatedVersion: Version | undefined;
    const ok = await action.run(
      async () => {
        if (isDelete) {
          await api.delete(`/reviewer/schema-versions/${targetId}`);
        } else {
          const response = await api.put<Version>(`/reviewer/schema-versions/${targetId}/lifecycle`, null, { params: { status: decision.status } });
          updatedVersion = response.data;
        }
      },
      isDelete ? "Đã xoá bản nháp." : decision.status === "APPROVED" ? "Đã phê duyệt phiên bản mới. Phiên bản cũ cùng chủ đề đã được chuyển sang ngừng dùng." : "Đã ngừng sử dụng phiên bản.",
    );
    if (ok) {
      if (isDelete) {
        resource.setData(prev => (prev ?? []).filter(item => item.id !== targetId));
        if (activeSelected?.id === targetId) clearSelection();
      } else if (updatedVersion) {
        const nextVersion = updatedVersion;
        resource.setData(prev => (prev ?? []).map(item => item.id === targetId ? nextVersion : decision.status === "APPROVED" && item.schemaId.toLowerCase() === nextVersion.schemaId.toLowerCase() && item.lifecycleStatus === "APPROVED" ? { ...item, lifecycleStatus: "RETIRED" } : item));
        if (activeSelected?.id === targetId) setSelected(nextVersion);
      }
      setDecision(null);
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/schemas/summary") });
      void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/schema-versions/${targetId}/history`) });
      void resource.refresh();
    }
  };

  const handleEditorSaved = (outcome?: VersionSaveOutcome) => {
    if (outcome?.deletedId) {
      resource.setData(prev => (prev ?? []).filter(item => item.id !== outcome.deletedId));
    } else if (outcome?.saved) {
      const saved = outcome.saved;
      resource.setData(prev => {
        const list = prev ?? [];
        return list.some(item => item.id === saved.id)
          ? list.map(item => item.id === saved.id ? saved : item)
          : [saved, ...list];
      });
    }
    setEditor(null);
    void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/schemas/summary") });
    if (outcome?.saved?.id) {
      void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/schema-versions/${outcome.saved.id}/history`) });
    }
    void resource.refresh();
  };

  // Editing takes the page; the list comes back when the reviewer saves or leaves.
  if (editor) return <VersionEditorModal initial={editor.version} clone={editor.clone} sharedCatalogue={sharedCatalogue} onClose={() => setEditor(null)} onSaved={handleEditorSaved} />;
  // Reading a topic takes the page too: its roles and laws need the width, and the actions sit beside its title.
  if (activeSelected) return <>
    <VersionDetail version={activeSelected} sharedCatalogue={sharedCatalogue} onClose={clearSelection}
      onEdit={() => { setEditor({ version: activeSelected, clone: activeSelected.lifecycleStatus !== "DRAFT" }); clearSelection(); }}
      onApprove={activeSelected.lifecycleStatus === "DRAFT" ? () => setDecision({ version: activeSelected, status: "APPROVED" }) : undefined}
      onDelete={activeSelected.lifecycleStatus === "DRAFT" ? () => setDecision({ version: activeSelected, status: "DELETE" }) : undefined} />
    {decision && <DecisionDialog decision={decision} previousApproved={currentApprovedFor(decision.version)} busy={action.busy} feedback={action.feedback} onClose={() => setDecision(null)} onConfirm={() => void changeLifecycle()} />}
  </>;

  return <Card size="3" className="reviewer-panel">
    <div className="reviewer-toolbar">
      <SegmentedControl.Root size="2" value={filter} onValueChange={value => { setFilter(value as typeof filter); setPage(1); }} aria-label="Lọc trạng thái">
        <SegmentedControl.Item value="ALL">Tất cả ({all.length})</SegmentedControl.Item>
        <SegmentedControl.Item value="DRAFT">Bản nháp ({count("DRAFT")})</SegmentedControl.Item>
        <SegmentedControl.Item value="APPROVED">Đang dùng ({count("APPROVED")})</SegmentedControl.Item>
        <SegmentedControl.Item value="RETIRED">Ngừng dùng ({count("RETIRED")})</SegmentedControl.Item>
      </SegmentedControl.Root>
      <ReviewerSearch aria-label={`Tìm ${noun}`} placeholder="Tìm tên hoặc mã chủ đề" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      <ReviewerRefresh refresh={resource.refresh} loading={resource.loading} />
    </div>
    <PageActions><Button type="button" size="2" onClick={() => setEditor({ clone: false })}><ReviewerIcon name="add" size={16} />Thêm chủ đề</Button></PageActions>
    <LoadState {...resource} headers={["Chủ đề", "Phiên bản", "Trạng thái", "Thao tác"]} />{action.feedback}

    {!resource.loading && <>
      <div className="reviewer-table-scroll"><Table.Root variant="surface" size="2">
        <Table.Header><Table.Row><Table.ColumnHeaderCell>Chủ đề</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Phiên bản</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell><Table.ColumnHeaderCell className="reviewer-col-actions">Thao tác</Table.ColumnHeaderCell></Table.Row></Table.Header>
        <Table.Body>
          {visibleRows.map(version => <Table.Row key={version.id}>
            <Table.Cell><button type="button" className="reviewer-link" onClick={() => setSelected(version)}>{version.name || version.schemaId}</button>{gradeOf(version) && <small>{gradeOf(version)}</small>}</Table.Cell>
            <Table.Cell>v{version.version}<small>{formatDate(version.createdAt)}</small></Table.Cell>
            <Table.Cell><ReviewStatus status={version.lifecycleStatus} /></Table.Cell>
            <Table.Cell><div className="reviewer-actions reviewer-actions-end">
              <RowActions subject={version.name || version.schemaId} actions={[
                ...(version.lifecycleStatus === "DRAFT" ? [
                  { label: "Sửa", onSelect: () => setEditor({ version, clone: false }) },
                  { label: "Phê duyệt", onSelect: () => setDecision({ version, status: "APPROVED" }) },
                  { label: "Xoá", danger: true, onSelect: () => setDecision({ version, status: "DELETE" }) },
                ] : []),
                ...(version.lifecycleStatus === "APPROVED" ? [
                  { label: "Tạo phiên bản mới", onSelect: () => setEditor({ version, clone: true }) },
                  { label: "Ngừng dùng", danger: true, onSelect: () => setDecision({ version, status: "RETIRED" }) },
                ] : []),
                ...(version.lifecycleStatus === "RETIRED" ? [{ label: "Nhân bản", onSelect: () => setEditor({ version, clone: true }) }] : []),
              ]} />
            </div></Table.Cell>
          </Table.Row>)}
          {!resource.loading && !resource.error && rows.length === 0 && <Table.Row><Table.Cell colSpan={4} className="reviewer-table-empty">{query || filter !== "ALL" ? `Không có ${noun} phù hợp.` : `Chưa có ${noun} nào. Bấm “Thêm chủ đề” để bắt đầu.`}</Table.Cell></Table.Row>}
        </Table.Body>
      </Table.Root></div>
      <ReviewerPagination total={rows.length} page={currentPage} pageSize={pageSize} noun="chủ đề" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    </>}

    {decision && <DecisionDialog decision={decision} previousApproved={currentApprovedFor(decision.version)} busy={action.busy} feedback={action.feedback} onClose={() => setDecision(null)} onConfirm={() => void changeLifecycle()} />}

  </Card>;
}

function summarizeRecordDiff(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));
  const added = [...nextKeys].filter(k => !prevKeys.has(k));
  const removed = [...prevKeys].filter(k => !nextKeys.has(k));
  const changed = [...nextKeys].filter(k => prevKeys.has(k) && JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
  return { added, removed, changed };
}

function summarizeArrayDiff(prev: unknown, next: unknown, keyOf: (item: Record<string, unknown>) => string) {
  const toMap = (list: unknown) => {
    const map: Record<string, unknown> = {};
    if (Array.isArray(list)) {
      list.forEach((item, index) => {
        const rec = asRecord(item);
        const key = keyOf(rec) || String(index);
        map[key] = item;
      });
    }
    return map;
  };
  return summarizeRecordDiff(toMap(prev), toMap(next));
}

function VersionDiffBox({ previous, next }: Readonly<{ previous: Version; next: Version }>) {
  const prevDef = asRecord(previous.definition);
  const nextDef = asRecord(next.definition);
  const prevCat = asRecord(prevDef.lawCatalogue);
  const nextCat = asRecord(nextDef.lawCatalogue);
  const rows: { label: string; added: number; changed: number; removed: number }[] = [
    { label: "Định luật", ...summarizeArrayDiff(prevCat.laws, nextCat.laws, r => String(r.id ?? r.title ?? "")) },
    { label: "Vai trò đại lượng", ...summarizeRecordDiff(asRecord(prevCat.roles), asRecord(nextCat.roles)) },
    { label: "Vật thể gợi ý", ...summarizeArrayDiff(prevDef.objectTypes, nextDef.objectTypes, r => String(r.type ?? r.label ?? "")) },
    { label: "Đại lượng gợi ý", ...summarizeArrayDiff(prevDef.quantityDefinitions, nextDef.quantityDefinitions, r => String(r.key ?? r.label ?? "")) },
  ].map(item => ({ label: item.label, added: item.added.length, changed: item.changed.length, removed: item.removed.length }))
    .filter(item => item.added > 0 || item.changed > 0 || item.removed > 0);
  const metaChanged = previous.name !== next.name || previous.topic !== next.topic;
  return <div className="reviewer-diff">
    <Text as="div" size="2" weight="bold">So sánh với bản đang dùng (v{previous.version})</Text>
    {!metaChanged && rows.length === 0
      ? <Text as="p" size="2" color="gray" mt="1">Không phát hiện thay đổi nội dung so với v{previous.version}.</Text>
      : <ul className="reviewer-diff-list">
        {metaChanged && <li>Thông tin chung: {previous.name !== next.name ? `Tên "${previous.name}" → "${next.name}"` : ""}{previous.name !== next.name && previous.topic !== next.topic ? " · " : ""}{previous.topic !== next.topic ? `Nhóm "${previous.topic}" → "${next.topic}"` : ""}</li>}
        {rows.map(row => <li key={row.label}>
          <strong>{row.label}:</strong>{" "}
          {[row.added > 0 && `+${row.added} thêm`, row.changed > 0 && `~${row.changed} sửa`, row.removed > 0 && `-${row.removed} xóa`].filter(Boolean).join(", ")}
        </li>)}
      </ul>}
  </div>;
}

function DecisionDialog({ decision, previousApproved, busy, feedback, onClose, onConfirm }: Readonly<{ decision: { version: Version; status: "APPROVED" | "RETIRED" | "DELETE" }; previousApproved?: Version; busy: boolean; feedback: ReactNode; onClose: () => void; onConfirm: () => void }>) {
  const isDelete = decision.status === "DELETE";
  const isApprove = decision.status === "APPROVED";
  const title = isDelete ? "Xoá bản nháp?" : isApprove ? "Phê duyệt phiên bản?" : "Ngừng sử dụng phiên bản?";
  const actionLabel = busy ? (isDelete ? "Đang xoá…" : "Đang cập nhật…") : isDelete ? "Xoá bản nháp" : isApprove ? "Phê duyệt" : "Ngừng sử dụng";
  return <ReviewerDialog title={title} onClose={onClose}>
    <Text as="p" size="3"><strong>{decision.version.name || decision.version.schemaId}</strong> · v{decision.version.version}</Text>
    {isApprove && previousApproved && <VersionDiffBox previous={previousApproved} next={decision.version} />}
    <ul className="reviewer-consequences">{isDelete ? <>
      <li>Bản nháp này sẽ bị <strong>xoá vĩnh viễn</strong> và không thể khôi phục.</li>
      <li>Các phiên bản đang dùng hoặc ngừng dùng của chủ đề không bị ảnh hưởng.</li>
    </> : isApprove ? <>
      <li>Phiên bản đang dùng trước đó của cùng mã chủ đề sẽ tự chuyển sang <strong>Ngừng dùng</strong>.</li>
      <li>Hệ thống sẽ dùng phiên bản này cho các mô phỏng <strong>mới</strong>. Mô phỏng cũ giữ nguyên phiên bản đã dùng.</li>
      <li>Sau khi phê duyệt, nội dung <strong>không sửa được</strong> — muốn thay đổi phải tạo phiên bản mới.</li>
    </> : <>
      <li>Mô phỏng mới sẽ không dùng phiên bản này nữa.</li>
      <li>Mô phỏng và bài tập đã tạo trước đó vẫn hoạt động bình thường.</li>
    </>}</ul>
    {feedback}
    <div className="reviewer-form-footer"><Button type="button" variant="soft" color="gray" size="2" onClick={onClose}>Hủy</Button><Button type="button" size="2" color={isApprove ? undefined : "red"} disabled={busy} onClick={onConfirm}>{actionLabel}</Button></div>
  </ReviewerDialog>;
}

type SchemaAudit = {
  id: string;
  schemaVersionId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};

const SCHEMA_AUDIT_ACTION: Record<string, string> = {
  CREATE_DRAFT: "Tạo bản nháp",
  UPDATE_DRAFT: "Cập nhật bản nháp",
  APPROVE: "Phê duyệt phát hành",
  RETIRE: "Ngừng sử dụng",
  AUTO_RETIRE: "Tự động ngừng dùng",
};

function VersionDetail({ version, sharedCatalogue, onClose, onEdit, onApprove, onDelete }: Readonly<{ version: Version; sharedCatalogue?: Record<string, unknown>; onClose: () => void; onEdit: () => void; onApprove?: () => void; onDelete?: () => void }>) {
  const historyResource = useResource<SchemaAudit[]>(`/reviewer/schema-versions/${version.id}/history`);
  const history = historyResource.data ?? [];
  const definition = (version.definition && typeof version.definition === "object" ? version.definition : {}) as Record<string, unknown>;
  const objects = objectRows(definition.objectTypes);
  const quantities = objectRows(definition.quantityDefinitions);
  const examples = objectRows(definition.capabilities);
  const catalogue = (definition.lawCatalogue && typeof definition.lawCatalogue === "object" ? definition.lawCatalogue : {}) as Record<string, unknown>;
  const limitations = Array.isArray(definition.limitations) ? definition.limitations.map(String) : [];
  return <Card size="3" className="reviewer-panel">
    <div className="reviewer-toolbar reviewer-sticky-header" style={{ alignItems: "center" }}>
      <Button type="button" variant="soft" color="gray" size="2" onClick={onClose}>← Danh sách chủ đề</Button>
      <Heading as="h2" size="5" style={{ flex: 1, minWidth: 0 }}>{version.name || version.schemaId} · v{version.version}</Heading>
      {onDelete && <Button type="button" variant="soft" color="red" size="2" onClick={onDelete}>Xoá bản nháp</Button>}
      <Button type="button" variant={onApprove ? "soft" : "solid"} size="2" onClick={onEdit}>{version.lifecycleStatus === "DRAFT" ? "Sửa bản nháp" : "Tạo phiên bản mới để sửa"}</Button>
      {onApprove && <Button type="button" size="2" onClick={onApprove}>Phê duyệt</Button>}
    </div>
    <div className="reviewer-detail-meta"><ReviewStatus status={version.lifecycleStatus} /><Text size="2" color="gray">Tạo ngày {formatDate(version.createdAt)}</Text></div>
    <div className="reviewer-summary">
      {typeof definition.description === "string" && <Text as="p" size="2" className="reviewer-context-text">{definition.description}</Text>}
      <Heading as="h3" size="3">Định luật dùng để xác minh mô phỏng</Heading>
      <Text as="p" size="2" color="gray">AI viết mô hình theo mô tả của giáo viên; hệ thống tính rồi đối chiếu kết quả với từng định luật dưới đây.</Text>
      <LawBook value={catalogue} shared={sharedCatalogue} />
      <details className="reviewer-disclosure"><summary>Vật và đại lượng thường gặp trong đề bài (gợi ý cho AI): {objects.length} vật, {quantities.length} đại lượng</summary>
        <div className="reviewer-chips">{objects.map((item, index) => <Badge key={"o" + index} color="gray" variant="soft" size="2">{String(item.label ?? item.type ?? "—")}</Badge>)}</div>
        <div className="reviewer-chips" style={{ marginTop: 8 }}>{quantities.map((item, index) => <Badge key={"q" + index} color="indigo" variant="soft" size="2">{String(item.label ?? item.key ?? "—")}{item.symbol ? ` (${String(item.symbol)})` : ""}</Badge>)}</div>
      </details>
      {examples.length > 0 && <details className="reviewer-disclosure"><summary>Bài mẫu ({examples.length}) — chỉ để tham khảo</summary>
        <Text as="p" size="1" color="gray" mb="2">Ví dụ về kí hiệu và công thức cho AI, và để mở lại mô phỏng đã lưu trước đây. Chúng không còn quyết định mô phỏng nào được tạo.</Text>
        <ul>{examples.map((item, index) => <li key={index}><Text size="2">{String(item.title ?? item.capabilityId ?? "")}</Text></li>)}</ul>
      </details>}
      {limitations.length > 0 && <><Heading as="h3" size="2">Giới hạn</Heading><ul className="reviewer-consequences">{limitations.map(item => <li key={item}>{item}</li>)}</ul></>}
    </div>
    {history.length > 0 && <details className="reviewer-disclosure">
      <summary>Lịch sử phiên bản ({history.length})</summary>
      <table className="reviewer-mini-table">
        <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {history.map(entry => <tr key={entry.id}>
            <td title={formatDate(entry.createdAt)}>{timeAgo(entry.createdAt) || formatDate(entry.createdAt)}</td>
            <td>{entry.actorName || entry.actorEmail || "—"}</td>
            <td>{SCHEMA_AUDIT_ACTION[entry.action] ?? entry.action}</td>
            <td>{entry.fromStatus ? `${reviewerStatusLabel(entry.fromStatus)} → ` : ""}{entry.toStatus ? reviewerStatusLabel(entry.toStatus) : "—"}</td>
            <td>{entry.note || "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </details>}
    <details className="reviewer-disclosure"><summary>Thông tin kỹ thuật</summary>
      <dl className="reviewer-evidence-grid"><div><dt>Mã chủ đề</dt><dd><code>{version.schemaId}</code></dd></div><div><dt>Số lần chỉnh sửa</dt><dd>{version.recordVersion ?? 0}</dd></div><div><dt>Mã kiểm tra nội dung</dt><dd><code>{version.definitionChecksum ?? "—"}</code></dd></div></dl>
      <pre className="reviewer-json">{JSON.stringify(version.definition, null, 2)}</pre>
    </details>
  </Card>;
}
