import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Card, Heading, Text, TextField } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { useAction } from "../../../shared/hooks/operationsData";
import type { Version } from "../model/reviewerTypes";
import { ReviewerDialog } from "./ReviewerDialog";
import { TopicDefinitionForm } from "./TopicDefinitionForm";

type Definition = Record<string, unknown>;
type DryRunResult = { valid: boolean; errors: string[]; openGapsTotal: number; coveredCount: number; gaps: { id: string; kind: string; label: string; occurrences: number; covered: boolean }[] };

function plainObject(value: unknown): Definition {
  return value && typeof value === "object" && !Array.isArray(value) ? structuredClone(value as Definition) : {};
}

/** 1.0 → 1.1, 2.3.4 → 2.3.5; anything else is left for the reviewer to type. */
function nextVersion(version?: string) {
  if (!version) return "";
  const parts = version.split(".");
  const last = Number(parts.at(-1));
  if (!Number.isInteger(last)) return "";
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
}

export type VersionSaveOutcome = { saved?: Version; deletedId?: string };

export function VersionEditorModal({ initial, clone, sharedCatalogue, onClose, onSaved }: Readonly<{ initial?: Version; clone: boolean; sharedCatalogue?: Definition; onClose: () => void; onSaved: (outcome?: VersionSaveOutcome) => void }>) {
  const [initialMeta] = useState(() => ({
    schemaId: initial?.schemaId ?? "",
    version: clone ? nextVersion(initial?.version) : initial?.version ?? "1.0",
    name: initial?.name ?? "",
    topic: initial?.topic ?? "",
  }));
  const [schemaId, setSchemaId] = useState(initialMeta.schemaId);
  const [version, setVersion] = useState(initialMeta.version);
  const [name, setName] = useState(initialMeta.name);
  const [topic, setTopic] = useState(initialMeta.topic);
  const navigate = useNavigate();
  const location = useLocation();
  const [definition, setDefinition] = useState<Definition>(() => plainObject(initial?.definition));
  const [confirmAction, setConfirmAction] = useState<"leave" | "delete" | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const dryRunRef = useRef<HTMLDivElement | null>(null);
  const action = useAction();
  const [original] = useState(() => JSON.stringify(plainObject(initial?.definition)));
  const dirty = JSON.stringify(definition) !== original
    || schemaId !== initialMeta.schemaId
    || version !== initialMeta.version
    || name !== initialMeta.name
    || topic !== initialMeta.topic;
  // Leaving with unsaved edits asks first: both browser tab close and sidebar link clicks.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const interceptLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const nextRoute = url.pathname + url.search + url.hash;
      const currentRoute = location.pathname + location.search + location.hash;
      if (nextRoute === currentRoute) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingRoute(nextRoute);
      setConfirmAction("leave");
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [dirty, location.pathname, location.search, location.hash]);
  const leave = () => {
    if (!dirty) { onClose(); return; }
    setPendingRoute(null);
    setConfirmAction("leave");
  };
  const isEdit = Boolean(initial && !clone);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let savedVersion: Version | undefined;
    const ok = await action.run(async () => {
      const body = {
        schemaId: schemaId.trim(),
        version: version.trim(),
        name: name.trim(),
        topic: topic.trim(),
        definition,
        ...(isEdit && initial?.recordVersion !== undefined ? { expectedRecordVersion: initial.recordVersion } : {}),
      };
      const endpoint = isEdit ? `/reviewer/schema-versions/${initial?.id}` : "/schemas";
      const response = await (isEdit ? api.put<Version>(endpoint, body) : api.post<Version>(endpoint, body));
      savedVersion = response.data;
    }, "Đã lưu bản nháp. Bản nháp cần được phê duyệt trước khi hệ thống sử dụng.");
    if (ok) onSaved({ saved: savedVersion });
  };

  const runDryCheck = async () => {
    setDryRunBusy(true);
    try {
      const response = await api.post<DryRunResult>("/reviewer/schema-versions/dry-run", {
        schemaId: schemaId.trim(),
        version: version.trim(),
        name: name.trim() || schemaId.trim(),
        topic: topic.trim(),
        definition,
      });
      setDryRunResult(response.data);
      window.requestAnimationFrame(() => {
        dryRunRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch {
      setDryRunResult({ valid: false, errors: ["Không thể chạy kiểm thử bản nháp. Vui lòng thử lại."], openGapsTotal: 0, coveredCount: 0, gaps: [] });
      window.requestAnimationFrame(() => {
        dryRunRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } finally {
      setDryRunBusy(false);
    }
  };

  const deleteDraft = async () => {
    if (!isEdit || !initial?.id) return;
    const deletedId = initial.id;
    const ok = await action.run(() => api.delete(`/reviewer/schema-versions/${deletedId}`), "Đã xoá bản nháp.");
    if (ok) { setConfirmAction(null); onSaved({ deletedId }); }
  };

  const title = isEdit ? "Chỉnh sửa bản nháp" : clone ? "Tạo phiên bản mới" : "Thêm chủ đề mới";
  /* A full page instead of a dialog: a topic has many roles and laws, and editing them needs the whole width,
     the page's own scrolling, and a save bar that stays in reach. */
  return <Card size="3" className="reviewer-panel"><form onSubmit={submit}>
    <div className="reviewer-toolbar reviewer-sticky-header" style={{ alignItems: "center" }}>
      <Button type="button" variant="soft" color="gray" size="2" onClick={leave}>← Danh sách chủ đề</Button>
      <Heading as="h2" size="5" style={{ flex: 1, minWidth: 0 }}>{title}{initial?.name ? ` · ${initial.name}` : ""}</Heading>
      {dirty && <Badge color="amber" variant="soft" size="2">Có thay đổi chưa lưu</Badge>}
    </div>
    {clone && initial && <div className="reviewer-note"><strong>Phiên bản đang dùng không sửa trực tiếp được.</strong> Bạn đang tạo bản nháp mới dựa trên v{initial.version}; bản cũ vẫn hoạt động cho tới khi bản mới được phê duyệt.</div>}
    <div className="reviewer-form-row">
      <label className="reviewer-field"><span>Mã chủ đề *</span>
        <TextField.Root size="3" name="schemaId" required maxLength={80} readOnly={isEdit || (clone && Boolean(initial))} value={schemaId} onChange={event => setSchemaId(event.target.value)} placeholder="thpt_kinematics" />
        {!isEdit && !clone && <Text size="1" color="gray">Viết thường, không dấu, nối bằng dấu gạch dưới.</Text>}
      </label>
      <label className="reviewer-field"><span>Phiên bản *</span><TextField.Root size="3" name="version" required maxLength={16} readOnly={isEdit} value={version} onChange={event => setVersion(event.target.value)} placeholder="1.0" /></label>
    </div>
      <div className="reviewer-form-row"><label className="reviewer-field"><span>Tên chủ đề *</span><TextField.Root size="3" name="name" required value={name} onChange={event => setName(event.target.value)} placeholder="Động học" /></label><label className="reviewer-field"><span>Nhóm chủ đề *</span><TextField.Root size="3" name="topic" required value={topic} onChange={event => setTopic(event.target.value)} placeholder="KINEMATICS" /></label></div>
      <TopicDefinitionForm value={definition} sharedCatalogue={sharedCatalogue} onChange={setDefinition} />
    {dryRunResult && <div ref={dryRunRef} className={dryRunResult.valid ? "reviewer-diff" : "reviewer-note reviewer-note-danger"} role="status">
      <Text as="div" size="2" weight="bold">
        {dryRunResult.valid ? "Kiểm thử bản nháp hợp lệ" : "Bản nháp có lỗi định nghĩa"}
        {dryRunResult.openGapsTotal > 0 ? ` · Đã xử lý ${dryRunResult.coveredCount}/${dryRunResult.openGapsTotal} mục định luật đang mở` : ""}
      </Text>
      {dryRunResult.errors.length > 0 && <ul>{dryRunResult.errors.map(err => <li key={err}>{err}</li>)}</ul>}
      {dryRunResult.gaps.length > 0 && <div className="reviewer-chips" style={{ marginTop: 8 }}>
        {dryRunResult.gaps.slice(0, 10).map(gap => <Badge key={gap.id} color={gap.covered ? "green" : "amber"} variant="soft">
          {gap.covered ? "✓ " : "○ "}{gap.label} ({gap.occurrences} lần)
        </Badge>)}
      </div>}
    </div>}
    {action.feedback}
    <div className="reviewer-form-footer reviewer-sticky-footer">
      {isEdit && initial?.id && <Button type="button" variant="soft" color="red" size="3" disabled={action.busy} onClick={() => setConfirmAction("delete")} style={{ marginRight: "auto" }}>Xoá bản nháp</Button>}
      <Button type="button" variant="soft" size="3" disabled={action.busy || dryRunBusy || !schemaId.trim() || !topic.trim()} onClick={() => void runDryCheck()}>{dryRunBusy ? "Đang kiểm thử…" : "Kiểm thử định luật"}</Button>
      <Button type="button" variant="soft" color="gray" size="3" onClick={leave}>Hủy</Button>
      <Button type="submit" size="3" disabled={action.busy}>{action.busy ? "Đang lưu…" : "Lưu bản nháp"}</Button>
    </div>
    {confirmAction === "delete" && initial && <ReviewerDialog title="Xoá bản nháp?" onClose={() => setConfirmAction(null)}>
      <Text as="p" size="3"><strong>{initial.name || initial.schemaId}</strong> · v{initial.version}</Text>
      <ul className="reviewer-consequences">
        <li>Bản nháp này sẽ bị <strong>xoá vĩnh viễn</strong> và không thể khôi phục.</li>
        <li>Các phiên bản đang dùng hoặc ngừng dùng của chủ đề không bị ảnh hưởng.</li>
      </ul>
      {action.feedback}
      <div className="reviewer-form-footer">
        <Button type="button" variant="soft" color="gray" size="2" onClick={() => setConfirmAction(null)}>Hủy</Button>
        <Button type="button" color="red" size="2" disabled={action.busy} onClick={() => void deleteDraft()}>{action.busy ? "Đang xoá…" : "Xoá bản nháp"}</Button>
      </div>
    </ReviewerDialog>}
    {confirmAction === "leave" && <ReviewerDialog title="Bỏ các thay đổi chưa lưu?" onClose={() => { setConfirmAction(null); setPendingRoute(null); }}>
      <Text as="p" size="2" color="gray">Bạn có thay đổi chưa lưu. Nếu rời khỏi trang sửa, các thay đổi này sẽ bị mất.</Text>
      <div className="reviewer-form-footer">
        <Button type="button" variant="soft" color="gray" size="2" onClick={() => { setConfirmAction(null); setPendingRoute(null); }}>Ở lại tiếp tục sửa</Button>
        <Button type="button" color="red" size="2" onClick={() => {
          const target = pendingRoute;
          setConfirmAction(null);
          setPendingRoute(null);
          if (target) navigate(target);
          else onClose();
        }}>Rời khỏi trang</Button>
      </div>
    </ReviewerDialog>}
  </form></Card>;
}
