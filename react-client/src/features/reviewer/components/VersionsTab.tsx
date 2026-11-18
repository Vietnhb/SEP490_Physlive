import PageActions from "../../../shared/layout/PageActions";
import RowActions from "../../../shared/ui/RowActions";
import { useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Card, Heading, SegmentedControl, Table, Text } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { LoadState } from "../../../shared/ui/OperationsKit";
import { useAction, useResource } from "../../../shared/hooks/operationsData";
import { VersionEditorModal, type VersionSaveOutcome } from "./VersionEditorModal";
import { ReviewerDialog } from "./ReviewerDialog";
import type { Version } from "../model/reviewerTypes";
import { formatDate, matches } from "../model/reviewerUtils";
import { ReviewerIcon, ReviewerRefresh, ReviewerSearch, ReviewStatus } from "./ReviewerKit";
import { objectRows } from "../model/jsonRows";
import { LawBook } from "./LawCatalogueEditor";

type Lifecycle = "DRAFT" | "APPROVED" | "RETIRED";
const ORDER = ["DRAFT", "APPROVED", "RETIRED"];
const gradeOf = (version: Version) => { const grade = (version.definition as { grade?: unknown } | undefined)?.grade; return grade ? `Lớp ${String(grade)}` : ""; };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function VersionsTab() {
  const resource = useResource<Version[]>("/reviewer/schemas");
  const action = useAction();
  const [filter, setFilter] = useState<"ALL" | Lifecycle>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selected, setSelected] = useState<Version | null>(null);
  const [editor, setEditor] = useState<{ version?: Version; clone: boolean } | null>(null);
  const [decision, setDecision] = useState<{ version: Version; status: "APPROVED" | "RETIRED" | "DELETE" } | null>(null);
  const all = useMemo(() => resource.data ?? [], [resource.data]);
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
  const rangeStart = rows.length === 0 ? 0 : pageSize > 0 ? (currentPage - 1) * pageSize + 1 : 1;
  const rangeEnd = pageSize > 0 ? Math.min(rows.length, currentPage * pageSize) : rows.length;

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
      isDelete ? "Đã xoá bản nháp." : decision.status === "APPROVED" ? "Đã phê duyệt. Phiên bản này bắt đầu được sử dụng." : "Đã ngừng sử dụng phiên bản.",
    );
    if (ok) {
      if (isDelete) {
        resource.setData(prev => (prev ?? []).filter(item => item.id !== targetId));
        if (selected?.id === targetId) setSelected(null);
      } else if (updatedVersion) {
        const nextVersion = updatedVersion;
        resource.setData(prev => (prev ?? []).map(item => item.id === targetId ? nextVersion : item));
        if (selected?.id === targetId) setSelected(nextVersion);
      }
      setDecision(null);
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
    void resource.refresh();
  };

  // Editing takes the page; the list comes back when the reviewer saves or leaves.
  if (editor) return <VersionEditorModal initial={editor.version} clone={editor.clone} sharedCatalogue={sharedCatalogue} onClose={() => setEditor(null)} onSaved={handleEditorSaved} />;
  // Reading a topic takes the page too: its roles and laws need the width, and the actions sit beside its title.
  if (selected) return <>
    <VersionDetail version={selected} sharedCatalogue={sharedCatalogue} onClose={() => setSelected(null)}
      onEdit={() => { setEditor({ version: selected, clone: selected.lifecycleStatus !== "DRAFT" }); setSelected(null); }}
      onDelete={selected.lifecycleStatus === "DRAFT" ? () => setDecision({ version: selected, status: "DELETE" }) : undefined} />
    {decision && <DecisionDialog decision={decision} busy={action.busy} feedback={action.feedback} onClose={() => setDecision(null)} onConfirm={() => void changeLifecycle()} />}
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
      {rows.length > 5 && (
        <div className="reviewer-pagination">
          <Text size="2" color="gray">
            Hiển thị <strong>{rangeStart}–{rangeEnd}</strong> trong <strong>{rows.length}</strong> chủ đề
          </Text>
          <div className="reviewer-pagination-controls">
            <div className="reviewer-pagination-sizes" role="group" aria-label="Số dòng mỗi trang">
              {[5, 10, 0].map(size => (
                <button
                  key={size}
                  type="button"
                  className={`reviewer-page-chip${pageSize === size ? " is-active" : ""}`}
                  onClick={() => { setPageSize(size); setPage(1); }}
                >
                  {size === 0 ? "Tất cả" : `${size} / trang`}
                </button>
              ))}
            </div>
            {pageSize > 0 && totalPages > 1 && (
              <div className="reviewer-pagination-pages">
                <Button type="button" variant="soft" color="gray" size="1" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>← Trước</Button>
                <Text size="2">Trang {currentPage} / {totalPages}</Text>
                <Button type="button" variant="soft" color="gray" size="1" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau →</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>}

    {decision && <DecisionDialog decision={decision} busy={action.busy} feedback={action.feedback} onClose={() => setDecision(null)} onConfirm={() => void changeLifecycle()} />}

  </Card>;
}

function DecisionDialog({ decision, busy, feedback, onClose, onConfirm }: Readonly<{ decision: { version: Version; status: "APPROVED" | "RETIRED" | "DELETE" }; busy: boolean; feedback: ReactNode; onClose: () => void; onConfirm: () => void }>) {
  const isDelete = decision.status === "DELETE";
  const isApprove = decision.status === "APPROVED";
  const title = isDelete ? "Xoá bản nháp?" : isApprove ? "Phê duyệt phiên bản?" : "Ngừng sử dụng phiên bản?";
  const actionLabel = busy ? (isDelete ? "Đang xoá…" : "Đang cập nhật…") : isDelete ? "Xoá bản nháp" : isApprove ? "Phê duyệt" : "Ngừng sử dụng";
  return <ReviewerDialog title={title} onClose={onClose}>
    <Text as="p" size="3"><strong>{decision.version.name || decision.version.schemaId}</strong> · v{decision.version.version}</Text>
    <ul className="reviewer-consequences">{isDelete ? <>
      <li>Bản nháp này sẽ bị <strong>xoá vĩnh viễn</strong> và không thể khôi phục.</li>
      <li>Các phiên bản đang dùng hoặc ngừng dùng của chủ đề không bị ảnh hưởng.</li>
    </> : isApprove ? <>
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

function VersionDetail({ version, sharedCatalogue, onClose, onEdit, onDelete }: Readonly<{ version: Version; sharedCatalogue?: Record<string, unknown>; onClose: () => void; onEdit: () => void; onDelete?: () => void }>) {
  const definition = (version.definition && typeof version.definition === "object" ? version.definition : {}) as Record<string, unknown>;
  const objects = objectRows(definition.objectTypes);
  const quantities = objectRows(definition.quantityDefinitions);
  const examples = objectRows(definition.capabilities);
  const catalogue = (definition.lawCatalogue && typeof definition.lawCatalogue === "object" ? definition.lawCatalogue : {}) as Record<string, unknown>;
  const limitations = Array.isArray(definition.limitations) ? definition.limitations.map(String) : [];
  return <Card size="3" className="reviewer-panel">
    <div className="reviewer-toolbar" style={{ alignItems: "center" }}>
      <Button type="button" variant="soft" color="gray" size="2" onClick={onClose}>← Danh sách chủ đề</Button>
      <Heading as="h2" size="5" style={{ flex: 1, minWidth: 0 }}>{version.name || version.schemaId} · v{version.version}</Heading>
      {onDelete && <Button type="button" variant="soft" color="red" size="2" onClick={onDelete}>Xoá bản nháp</Button>}
      <Button type="button" size="2" onClick={onEdit}>{version.lifecycleStatus === "DRAFT" ? "Sửa bản nháp" : "Tạo phiên bản mới để sửa"}</Button>
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
    <details className="reviewer-disclosure"><summary>Thông tin kỹ thuật</summary>
      <dl className="reviewer-evidence-grid"><div><dt>Mã chủ đề</dt><dd><code>{version.schemaId}</code></dd></div><div><dt>Số lần chỉnh sửa</dt><dd>{version.recordVersion ?? 0}</dd></div><div><dt>Mã kiểm tra nội dung</dt><dd><code>{version.definitionChecksum ?? "—"}</code></dd></div></dl>
      <pre className="reviewer-json">{JSON.stringify(version.definition, null, 2)}</pre>
    </details>
  </Card>;
}
