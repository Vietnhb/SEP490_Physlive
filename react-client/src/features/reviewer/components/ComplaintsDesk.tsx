import PageActions from "../../../shared/layout/PageActions";
import { useResource } from "../../../shared/hooks/operationsData";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Dialog, Flex, SegmentedControl, Select, Spinner, TextArea, TextField } from "@radix-ui/themes";
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
import { SlaBadge } from "./ReviewerKit";
import { SimulationPreviewPane } from "./SimulationPreviewPane";
import RefreshButton from "../../../shared/ui/RefreshButton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import styles from "./ComplaintsDesk.module.css";

const code = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const contentOf = (value: string) => { const at = value.indexOf("\n— Đề bài —"); return at < 0 ? { detail: value, context: "" } : { detail: value.slice(0, at), context: value.slice(at + "\n— Đề bài —".length) }; };
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
type ActionMode = "reply" | "escalate";

function topicUrlOf(meta: { schemaId?: string; topic?: string }) {
  if (meta.schemaId) return `/reviewer/topics?schemaId=${encodeURIComponent(meta.schemaId)}`;
  if (meta.topic) return `/reviewer/topics?topic=${encodeURIComponent(meta.topic)}`;
  return "";
}

export function ComplaintsDesk({ canEdit = false }: Readonly<{ canEdit?: boolean }>) {
  const me = useSessionStore(state => state.user);
  const [filter, setFilter] = useState<Filter>("todo");
  const [mineOnly, setMineOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
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
    if (mineOnly) params.set("assignedToMe", "true");
    else if (unassignedOnly) params.set("unassignedOnly", "true");
    if (overdueOnly && filter !== "done") params.set("slaHours", "24");
    if (from && isValidDateInput(from)) params.set("from", from);
    if (to && isValidDateInput(to)) params.set("to", to);
    return `/support/complaints/review/page?${params.toString()}`;
  }, [filter, page, size, status, debouncedQuery, mineOnly, unassignedOnly, overdueOnly, from, to]);

  const countsResource = useResource<ComplaintCounts>("/support/complaints/counts", true);
  const resource = useResource<ComplaintPage>(pageUrl, !invalidDates);
  const rows = useMemo(() => (invalidDates ? [] : resource.data?.items ?? []), [invalidDates, resource.data?.items]);
  const totalElements = invalidDates ? 0 : (resource.data?.totalElements ?? rows.length);
  const pages = Math.max(1, invalidDates ? 1 : (resource.data?.totalPages ?? 1));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;

  // Lazy-fetch full complaint detail (including heavy simulationSnapshot JSONB) only when opened.
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

  const todoCount = countsResource.data ? countsResource.data.open + countsResource.data.read : undefined;
  const doneCount = countsResource.data?.resolved;
  const allCount = countsResource.data?.total;
  const hasFilters = Boolean(query || status !== "ALL" || from || to || mineOnly || unassignedOnly || overdueOnly);
  const clear = () => { setQuery(""); setStatus("ALL"); setFrom(""); setTo(""); setMineOnly(false); setUnassignedOnly(false); setOverdueOnly(false); setPage(1); };
  const refreshAll = () => Promise.all([countsResource.refresh(), resource.refresh()]);

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
      setNotice(message);
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
      setNotice(message);
    } catch (error) { setActionError(apiMessage(error, "Chưa chuyển được sang rà soát định luật. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };

  const act = async (nextStatus: SupportStatus) => {
    if (!selected || lock.current) return;
    const response = (drafts[selected.id] ?? "").trim();
    if (!response && (nextStatus !== "RESOLVED" || !selected.adminResponse?.trim())) { setActionError("Hãy nhập phản hồi hoặc kết quả xử lý trước khi lưu."); return; }
    lock.current = true; setBusy(true); setActionError(""); setNotice(""); setDialogNotice("");
    try {
      const updated = await resolveComplaint(selected.id, nextStatus, response || undefined, selected.status, selected.respondedAt);
      syncUpdatedItem(updated);
      void queryClient.invalidateQueries({ queryKey: apiKey("/support/complaints/counts") });
      void resource.refresh();
      setDrafts(previous => ({ ...previous, [updated.id]: "" }));
      const message = nextStatus === "RESOLVED" ? "Đã giải quyết khiếu nại và gửi kết quả cho giáo viên." : "Đã gửi phản hồi. Khiếu nại tiếp tục được xem xét.";
      setNotice(message);
      if (nextStatus === "RESOLVED") { setDialogNotice(""); setSelectedId(""); }
      else setDialogNotice(message);
    } catch (error) { setActionError(apiMessage(error, "Chưa lưu được phản hồi. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };

  const claimedByMe = Boolean(selected?.assignedToId && me?.id && Number(selected.assignedToId) === Number(me.id));
  const claimedByOther = Boolean(selected?.assignedToId && !claimedByMe);
  // Only reviewers WITHOUT CONTENT_EDIT need to escalate a complaint to the law-authoring desk.
  const canEscalate = Boolean(!canEdit && selected && selected.status !== "RESOLVED" && !selected.lawGapId);
  const effectiveMode: ActionMode = canEscalate ? actionMode : "reply";
  const templates = useMemo(() => canEdit ? COMPLAINT_TEMPLATES.filter(t => t.id !== "referred") : COMPLAINT_TEMPLATES, [canEdit]);

  return <div className={styles.desk}>
    <header className={styles.heading}><div><h1 className="admin-content-title">Khiếu nại mô phỏng</h1><p>Kiểm tra báo lỗi, phản hồi giáo viên và theo dõi kết quả xử lý. Hàng đợi cần xử lý ưu tiên khiếu nại cũ nhất trước.</p></div><PageActions><RefreshButton onClick={() => void refreshAll()} disabled={resource.refreshing || countsResource.refreshing || busy} /></PageActions></header>
    {resource.error && !invalidDates && <p role="alert" className={styles.error}>{resource.error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    <section className={styles.panel}>
      <SegmentedControl.Root value={filter} onValueChange={value => { setFilter(value as Filter); setStatus("ALL"); setOverdueOnly(false); setPage(1); }} aria-label="Nhóm khiếu nại">
        <SegmentedControl.Item value="todo">Cần xử lý{todoCount !== undefined ? ` · ${todoCount}` : ""}</SegmentedControl.Item>
        <SegmentedControl.Item value="done">Đã giải quyết{doneCount !== undefined ? ` · ${doneCount}` : ""}</SegmentedControl.Item>
        <SegmentedControl.Item value="all">Tất cả{allCount !== undefined ? ` · ${allCount}` : ""}</SegmentedControl.Item>
      </SegmentedControl.Root>
      <div className={styles.filters} role="group" aria-label="Bộ lọc khiếu nại Reviewer">
        <label>Tìm kiếm<TextField.Root aria-label="Tìm khiếu nại Reviewer" placeholder="Mã, tiêu đề, tên, email hoặc người xử lý…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>Trạng thái<Select.Root value={status} onValueChange={value => { setStatus(value); setPage(1); }}><Select.Trigger aria-label="Trạng thái khiếu nại Reviewer" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item>{Object.entries(COMPLAINT_STATUS).filter(([value]) => filter === "all" || (value === "RESOLVED") === (filter === "done")).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></label>
        <label>Từ ngày<input type="date" min="2020-01-01" max="2099-12-31" aria-label="Reviewer khiếu nại từ ngày" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>
        <label>Đến ngày<input type="date" min="2020-01-01" max="2099-12-31" aria-label="Reviewer khiếu nại đến ngày" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>
        <Button variant="outline" onClick={clear} disabled={!hasFilters}>Xóa bộ lọc</Button>
      </div>
      <div className={styles.quickFilters} role="group" aria-label="Lọc nhanh khiếu nại">
        <span className={styles.quickFiltersLabel}>Lọc nhanh:</span>
        {filter !== "done" && <button type="button" className="reviewer-chip" aria-pressed={unassignedOnly} onClick={() => { setUnassignedOnly(value => !value); setMineOnly(false); setPage(1); }}>Chưa có người nhận</button>}
        <button type="button" className="reviewer-chip" aria-pressed={mineOnly} onClick={() => { setMineOnly(value => !value); setUnassignedOnly(false); setPage(1); }}>Việc tôi đang nhận</button>
        {filter !== "done" && <button type="button" className="reviewer-chip" aria-pressed={overdueOnly} onClick={() => { setOverdueOnly(value => !value); setPage(1); }}>Quá hạn &gt; 24h</button>}
      </div>
      {invalidDateFormat && <p role="alert" className={styles.error}>Ngày lọc không hợp lệ (năm phải từ 2000 đến 2099).</p>}
      {!invalidDateFormat && invalidDates && <p role="alert" className={styles.error}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {resource.loading ? <TableLoadingSkeleton headers={["Người gửi", "Khiếu nại", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : <div className={styles.scroll} role="region" aria-label="Danh sách khiếu nại Reviewer"><table className={styles.table}>
        <colgroup><col style={{ width: "24%" }} /><col style={{ width: "32%" }} /><col style={{ width: "17%" }} /><col style={{ width: "15%" }} /><col style={{ width: "12%" }} /></colgroup>
        <thead><tr><th>Người gửi</th><th>Khiếu nại</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}>
          <td><span className={styles.clamp}>{item.senderName}</span><small>{item.senderEmail}</small></td>
          <td><span className={styles.clamp}>{item.subject}</span><Flex gap="2" align="center" wrap="wrap"><small>{code(item.id)}</small>{(item.simulationId || item.hasSimulationSnapshot || hasSavedScene(item.simulationSnapshot)) && <Badge size="1" variant="soft" color="indigo">Có mô phỏng</Badge>}{item.lawGapId && <Badge size="1" variant="soft" color={item.lawGapStatus === "RESOLVED" ? "green" : "purple"}>{item.lawGapStatus === "RESOLVED" ? "Đã sửa định luật" : "Đã chuyển biên soạn"}</Badge>}</Flex></td>
          <td><Flex direction="column" gap="1" align="start"><Badge color={item.status === "RESOLVED" ? "green" : item.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[item.status]}</Badge><SlaBadge createdAt={item.createdAt} active={item.status !== "RESOLVED"} />{item.assignedToName && item.status !== "RESOLVED" && <small>Đang xử lý: {item.assignedToName}</small>}</Flex></td>
          <td><time dateTime={item.createdAt}>{date(item.createdAt)}</time></td>
          <td><Button size="1" variant="soft" aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setSelectedId(item.id); setActionMode("reply"); setEscalateNote(""); setDialogNotice(""); setActionError(""); }}>{item.status === "RESOLVED" ? "Xem chi tiết" : "Xử lý"}</Button></td>
        </tr>)}</tbody></table>{!rows.length && <p className={styles.empty}>Không có khiếu nại phù hợp với bộ lọc.</p>}</div>}
      <footer className={styles.footer}><span aria-live="polite">Hiển thị {totalElements ? start + 1 : 0}–{Math.min(start + rows.length, totalElements)} / {totalElements} khiếu nại</span><div><label>Số dòng/trang<Select.Root value={String(size)} onValueChange={value => { setSize(Number(value)); setPage(1); }}><Select.Trigger aria-label="Số khiếu nại Reviewer mỗi trang" /><Select.Content>{[5, 10, 20].map(value => <Select.Item key={value} value={String(value)}>{value}</Select.Item>)}</Select.Content></Select.Root></label><Button variant="soft" size="1" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</Button><span>Trang {current}/{pages}</span><Button variant="soft" size="1" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</Button></div></footer>
    </section>
    <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open && !busy) { setSelectedId(""); setConfirmTakeover(false); setActionMode("reply"); setEscalateNote(""); setDialogNotice(""); setActionError(""); } }}><Dialog.Content maxWidth="840px" className={`${modal.dialog} reviewer-academic`} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}>
      <header className={styles.dialogHeader}><div><Dialog.Title mb="1">Xử lý khiếu nại mô phỏng</Dialog.Title><Dialog.Description>{selected && code(selected.id)}</Dialog.Description></div><Flex gap="2" align="center">{selected && selected.status !== "RESOLVED" && (claimedByOther ? <Button size="2" variant="soft" color="amber" disabled={busy} onClick={() => setConfirmTakeover(true)}>Tiếp nhận lại</Button> : <Button size="2" variant="soft" color={claimedByMe ? "gray" : "indigo"} loading={busy} disabled={busy} onClick={() => void toggleClaim(claimedByMe)}>{claimedByMe ? "Bỏ nhận xử lý" : "Nhận xử lý"}</Button>)}<Dialog.Close><Button variant="soft" color="gray" disabled={busy} aria-label="Đóng chi tiết khiếu nại">Đóng</Button></Dialog.Close></Flex></header>
      <div className={modal.body}>{selected && selectedContent && <>
        {dialogNotice && <p role="status" className={styles.success} style={{ marginBottom: 14 }}>{dialogNotice}</p>}
        {actionError && <p role="alert" className={styles.error} style={{ margin: "0 0 14px" }}>{actionError}</p>}
        {confirmTakeover && claimedByOther && <div className="reviewer-note" role="alert" style={{ marginBottom: 14 }}>
          <strong>Khiếu nại đang được {selected.assignedToName} nhận xử lý.</strong> Bạn có chắc muốn tiếp nhận lại không?
          <Flex gap="2" mt="2">
            <Button size="1" color="amber" disabled={busy} onClick={() => void toggleClaim(false, true)}>Xác nhận tiếp nhận</Button>
            <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => setConfirmTakeover(false)}>Hủy</Button>
          </Flex>
        </div>}
        <h2 className={styles.subject}>{selected.subject}</h2>
        <Flex gap="2" align="center" wrap="wrap">
          <Badge color={selected.status === "RESOLVED" ? "green" : selected.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[selected.status]}</Badge>
          <SlaBadge createdAt={selected.createdAt} active={selected.status !== "RESOLVED"} />
          {selected.assignedToName && selected.status !== "RESOLVED" && <Badge color={claimedByMe ? "indigo" : "amber"} variant="soft">{claimedByMe ? "Bạn đang nhận xử lý" : `Đang xử lý: ${selected.assignedToName}`}</Badge>}
          {selected.lawGapId && <Badge color={selected.lawGapStatus === "RESOLVED" ? "green" : "purple"} variant="soft">{selected.lawGapStatus === "RESOLVED" ? "Biên soạn định luật: Đã bổ sung ✓" : selected.lawGapStatus === "DISMISSED" ? "Biên soạn định luật: Không cần bổ sung" : "Biên soạn định luật: Đang rà soát"}</Badge>}
          {selected.lawGapId && canEdit && <Button asChild size="1" variant="ghost" color="purple"><Link to="/reviewer/gaps">Xem mục rà soát →</Link></Button>}
          {topicUrl && <Button asChild size="1" variant="ghost"><Link to={topicUrl}>Mở chủ đề vật lý →</Link></Button>}
        </Flex>
        <dl className={styles.meta}><div><dt>Người gửi</dt><dd>{selected.senderName}<small>{selected.senderEmail}</small></dd></div><div><dt>Ngày gửi</dt><dd>{date(selected.createdAt)}</dd></div></dl>
        <h3 className={styles.subheading}>Nội dung báo lỗi</h3><p className={styles.body}>{selectedContent.detail.trim()}</p>
        {selected.simulationId
          ? <section className={styles.preview}><h3 className={styles.subheading}>Xem lại mô phỏng người gửi đính kèm</h3><SimulationPreviewPane simulationId={selected.simulationId} onMeta={onPreviewMeta} errorText="Không mở được mô phỏng đính kèm. Có thể mô phỏng đã bị người gửi xóa hoặc dữ liệu bị lỗi." /></section>
          : snapshotScene
            ? <section className={styles.preview}><h3 className={styles.subheading}>Xem lại bản chụp mô phỏng chưa lưu</h3><div className="reviewer-preview"><SavedScene scene={snapshotScene} /></div></section>
            : detailState.loading && selected.hasSimulationSnapshot
              ? <section className={styles.preview}><Flex align="center" gap="2" py="3"><Spinner /><span>Đang tải bản chụp mô phỏng đính kèm…</span></Flex></section>
              : <p className={styles.context}>Người gửi chưa lưu hoặc không đính kèm mô phỏng cho khiếu nại này.</p>}
        {selectedContent.context && <details className={styles.context}><summary>Đề bài và thông số mô phỏng</summary><p className={styles.body}>{selectedContent.context.trim()}</p></details>}
        {selected.adminResponse && <section className={styles.response}><h3 className={styles.subheading}>Phản hồi đã gửi{selected.responderName ? " · " + selected.responderName : ""}</h3>{selected.respondedAt && <small>{date(selected.respondedAt)}</small>}<p className={styles.body}>{selected.adminResponse}</p></section>}
        {selected.status !== "RESOLVED" && <div ref={actionSectionRef} className={styles.actionSection}>
          <div className={styles.actionSectionHead}>
            <h3 className={styles.subheading} style={{ margin: 0 }}>Xử lý khiếu nại</h3>
            {canEscalate && <SegmentedControl.Root size="1" value={effectiveMode} onValueChange={value => switchActionMode(value as ActionMode)} aria-label="Chế độ xử lý khiếu nại">
              <SegmentedControl.Item value="reply">Phản hồi giáo viên</SegmentedControl.Item>
              <SegmentedControl.Item value="escalate">Chuyển rà soát định luật</SegmentedControl.Item>
            </SegmentedControl.Root>}
          </div>
          {claimedByOther && <div className="reviewer-note" role="status">Khiếu nại đang được <strong>{selected.assignedToName}</strong> nhận xử lý. Hãy bấm <strong>Tiếp nhận lại</strong> ở góc trên nếu bạn cần trực tiếp xử lý.</div>}
          {effectiveMode === "reply" ? <div className={styles.reply} style={{ marginTop: 0 }}>
            <Flex justify="between" align="center" gap="2" wrap="wrap">
              <label htmlFor="reviewer-complaint-response">Nội dung phản hồi / kết quả kiểm tra</label>
              <Select.Root size="1" value="" disabled={busy || claimedByOther} onValueChange={id => {
                const tpl = templates.find(t => t.id === id);
                if (tpl) { setDrafts(previous => ({ ...previous, [selected.id]: tpl.text })); setActionError(""); }
              }}>
                <Select.Trigger placeholder="Chèn mẫu phản hồi nhanh…" />
                <Select.Content>
                  {templates.map(tpl => <Select.Item key={tpl.id} value={tpl.id}>{tpl.label}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </Flex>
            <TextArea id="reviewer-complaint-response" rows={4} maxLength={4000} value={drafts[selected.id] ?? ""} disabled={busy || claimedByOther} onChange={event => { setDrafts(previous => ({ ...previous, [selected.id]: event.target.value })); setActionError(""); }} placeholder="Nhập kết quả kiểm tra, cách khắc phục hoặc thông tin cần bổ sung…" />
            <small>Bấm “Gửi phản hồi” để giữ trạng thái đang xem xét, hoặc “Hoàn tất xử lý” khi đã xong.</small>
          </div> : <div className={styles.reply} style={{ marginTop: 0 }}>
            <p className={styles.escalateHint}>Hệ thống sẽ tạo 1 mục mới trong <strong>Định luật cần rà soát</strong> gắn với khiếu nại <strong>{code(selected.id)}</strong> để đội biên soạn dữ liệu chuẩn xử lý, đồng thời thông báo trạng thái đang xem xét cho giáo viên.</p>
            <label htmlFor="reviewer-escalate-note">Ghi chú chuyên môn cho đội biên soạn (không bắt buộc)</label>
            <TextArea id="reviewer-escalate-note" rows={3} maxLength={2000} value={escalateNote} disabled={busy || claimedByOther} onChange={event => { setEscalateNote(event.target.value); setActionError(""); }} placeholder="Ví dụ: Công thức tầm xa thiếu trường hợp ném từ độ cao h, cần bổ sung định luật cho chủ đề Động học…" />
          </div>}
          {actionError && <p role="alert" className={styles.error} style={{ margin: 0 }}>{actionError}</p>}
        </div>}
      </>}</div>
      {selected && selected.status !== "RESOLVED" && <Flex justify="end" align="center" gap="3" wrap="wrap" className={styles.dialogFooter}>
        {effectiveMode === "escalate" ? <>
          <Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => switchActionMode("reply")}>Quay lại phản hồi</Button>
          <Button type="button" color="purple" loading={busy} disabled={busy || claimedByOther} onClick={() => void escalateToLawGap()}>Xác nhận chuyển</Button>
        </> : <>
          <Button variant="outline" disabled={busy || claimedByOther || !(drafts[selected.id] ?? "").trim()} onClick={() => void act("READ")}>Gửi phản hồi</Button>
          <Button loading={busy} disabled={busy || claimedByOther} onClick={() => void act("RESOLVED")}>Hoàn tất xử lý</Button>
        </>}
      </Flex>}
    </Dialog.Content></Dialog.Root>
  </div>;
}
