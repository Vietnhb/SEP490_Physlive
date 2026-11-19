import PageActions from "../../../shared/layout/PageActions";
import { useResource } from "../../../shared/hooks/operationsData";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Dialog, Flex, SegmentedControl, Select, TextArea, TextField } from "@radix-ui/themes";
import { resolveComplaint, type SimulationComplaint, type SupportStatus } from "../../support/api/supportApi";
import { COMPLAINT_STATUS } from "../../support/model/complaintStatus";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { apiMessage } from "../../../shared/lib/apiError";
import { isWithinSentDates } from "../../../shared/lib/sentDateRange";
import RefreshButton from "../../../shared/ui/RefreshButton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import styles from "./ComplaintsDesk.module.css";

const code = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const contentOf = (value: string) => { const at = value.indexOf("\n— Đề bài —"); return at < 0 ? { detail: value, context: "" } : { detail: value.slice(0, at), context: value.slice(at + "\n— Đề bài —".length) }; };
type Filter = "todo" | "done" | "all";

export function ComplaintsDesk() {
  const resource = useResource<SimulationComplaint[]>("/support/complaints/review", true);
  const items = useMemo(() => [...(resource.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [resource.data]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const [selectedId, setSelectedId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const selected = items.find(item => item.id === selectedId);
  const selectedContent = selected ? contentOf(selected.content) : null;
  const invalidDates = Boolean(from && to && from > to);
  const todo = items.filter(item => item.status !== "RESOLVED").length;
  const rows = invalidDates ? [] : items.filter(item => (filter === "all" || (item.status === "RESOLVED") === (filter === "done"))
    && (status === "ALL" || item.status === status)
    && (item.subject + " " + item.senderName + " " + item.senderEmail + " " + code(item.id)).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))
    && isWithinSentDates(item.createdAt, from, to));
  const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(page, pages), start = (current - 1) * size;
  const clear = () => { setQuery(""); setStatus("ALL"); setFrom(""); setTo(""); setPage(1); };
  const act = async (nextStatus: SupportStatus) => {
    if (!selected || lock.current) return;
    const response = (drafts[selected.id] ?? "").trim();
    if (!response && (nextStatus !== "RESOLVED" || !selected.adminResponse?.trim())) { setActionError("Hãy nhập phản hồi hoặc kết quả xử lý trước khi lưu."); return; }
    lock.current = true; setBusy(true); setActionError(""); setNotice("");
    try {
      const updated = await resolveComplaint(selected.id, nextStatus, response || undefined);
      resource.setData(previous => previous.map(item => item.id === updated.id ? updated : item));
      setDrafts(previous => ({ ...previous, [updated.id]: "" }));
      setNotice(nextStatus === "RESOLVED" ? "Đã giải quyết khiếu nại và gửi kết quả cho giáo viên." : "Đã gửi phản hồi. Khiếu nại tiếp tục được xem xét.");
      if (nextStatus === "RESOLVED") setSelectedId("");
    } catch (error) { setActionError(apiMessage(error, "Chưa lưu được phản hồi. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={styles.desk}>
    <header className={styles.heading}><div><h1 className="admin-content-title">Khiếu nại mô phỏng</h1><p>Kiểm tra báo lỗi, phản hồi giáo viên và theo dõi kết quả xử lý.</p></div><PageActions><RefreshButton onClick={() => void resource.refresh()} disabled={resource.refreshing || busy} /></PageActions></header>
    {resource.error && <p role="alert" className={styles.error}>{resource.error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    <section className={styles.panel}>
      <SegmentedControl.Root value={filter} onValueChange={value => { setFilter(value as Filter); setStatus("ALL"); setPage(1); }} aria-label="Nhóm khiếu nại"><SegmentedControl.Item value="todo">Cần xử lý · {todo}</SegmentedControl.Item><SegmentedControl.Item value="done">Đã giải quyết · {items.length - todo}</SegmentedControl.Item><SegmentedControl.Item value="all">Tất cả · {items.length}</SegmentedControl.Item></SegmentedControl.Root>
      <div className={styles.filters} role="group" aria-label="Bộ lọc khiếu nại Reviewer">
        <label>Tìm kiếm<TextField.Root aria-label="Tìm khiếu nại Reviewer" placeholder="Mã, tiêu đề, tên hoặc email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <label>Trạng thái<Select.Root value={status} onValueChange={value => { setStatus(value); setPage(1); }}><Select.Trigger aria-label="Trạng thái khiếu nại Reviewer" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item>{Object.entries(COMPLAINT_STATUS).filter(([value]) => filter === "all" || (value === "RESOLVED") === (filter === "done")).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></label>
        <label>Từ ngày<input type="date" aria-label="Reviewer khiếu nại từ ngày" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>
        <label>Đến ngày<input type="date" aria-label="Reviewer khiếu nại đến ngày" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>
        <Button variant="outline" onClick={clear} disabled={!query && status === "ALL" && !from && !to}>Xóa bộ lọc</Button>
      </div>
      {invalidDates && <p role="alert" className={styles.error}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {resource.loading ? <TableLoadingSkeleton headers={["Người gửi", "Khiếu nại", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : <div className={styles.scroll} role="region" aria-label="Danh sách khiếu nại Reviewer"><table className={styles.table}>
        <colgroup><col style={{ width: "24%" }} /><col style={{ width: "32%" }} /><col style={{ width: "15%" }} /><col style={{ width: "17%" }} /><col style={{ width: "12%" }} /></colgroup>
        <thead><tr><th>Người gửi</th><th>Khiếu nại</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>{rows.slice(start, start + size).map(item => <tr key={item.id}>
          <td><span className={styles.clamp}>{item.senderName}</span><small>{item.senderEmail}</small></td>
          <td><span className={styles.clamp}>{item.subject}</span><small>{code(item.id)}</small></td>
          <td><Badge color={item.status === "RESOLVED" ? "green" : item.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[item.status]}</Badge></td>
          <td><time dateTime={item.createdAt}>{date(item.createdAt)}</time></td>
          <td><Button size="1" variant="soft" aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setSelectedId(item.id); setActionError(""); }}>{item.status === "RESOLVED" ? "Xem chi tiết" : "Xử lý"}</Button></td>
        </tr>)}</tbody></table>{!rows.length && <p className={styles.empty}>Không có khiếu nại phù hợp với bộ lọc.</p>}</div>}
      <footer className={styles.footer}><span aria-live="polite">Hiển thị {rows.length ? start + 1 : 0}–{Math.min(start + size, rows.length)} / {rows.length} khiếu nại</span><div><label>Số dòng/trang<Select.Root value={String(size)} onValueChange={value => { setSize(Number(value)); setPage(1); }}><Select.Trigger aria-label="Số khiếu nại Reviewer mỗi trang" /><Select.Content>{[5, 10, 20].map(value => <Select.Item key={value} value={String(value)}>{value}</Select.Item>)}</Select.Content></Select.Root></label><Button variant="soft" size="1" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</Button><span>Trang {current}/{pages}</span><Button variant="soft" size="1" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</Button></div></footer>
    </section>
    <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open && !busy) setSelectedId(""); }}><Dialog.Content maxWidth="800px" className={modal.dialog} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}>
      <header className={styles.dialogHeader}><div><Dialog.Title mb="1">Xử lý khiếu nại mô phỏng</Dialog.Title><Dialog.Description>{selected && code(selected.id)}</Dialog.Description></div><Dialog.Close><Button variant="soft" color="gray" disabled={busy} aria-label="Đóng chi tiết khiếu nại">Đóng</Button></Dialog.Close></header>
      <div className={modal.body}>{selected && selectedContent && <>
        <h2 className={styles.subject}>{selected.subject}</h2><Badge color={selected.status === "RESOLVED" ? "green" : selected.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[selected.status]}</Badge>
        <dl className={styles.meta}><div><dt>Người gửi</dt><dd>{selected.senderName}<small>{selected.senderEmail}</small></dd></div><div><dt>Ngày gửi</dt><dd>{date(selected.createdAt)}</dd></div></dl>
        <h3 className={styles.subheading}>Nội dung báo lỗi</h3><p className={styles.body}>{selectedContent.detail.trim()}</p>
        {selectedContent.context && <details className={styles.context}><summary>Đề bài và thông số mô phỏng</summary><p className={styles.body}>{selectedContent.context.trim()}</p></details>}
        {selected.adminResponse && <section className={styles.response}><h3 className={styles.subheading}>Phản hồi đã gửi{selected.responderName ? " · " + selected.responderName : ""}</h3>{selected.respondedAt && <small>{date(selected.respondedAt)}</small>}<p className={styles.body}>{selected.adminResponse}</p></section>}
        {selected.status !== "RESOLVED" && <div className={styles.reply}><label htmlFor="reviewer-complaint-response">Kết quả kiểm tra và hướng xử lý</label><TextArea id="reviewer-complaint-response" rows={5} maxLength={4000} value={drafts[selected.id] ?? ""} disabled={busy} onChange={event => { setDrafts(previous => ({ ...previous, [selected.id]: event.target.value })); setActionError(""); }} placeholder="Nhập kết quả kiểm tra, cách khắc phục hoặc thông tin cần bổ sung…" /><small>Gửi phản hồi để tiếp tục xem xét, hoặc hoàn tất khi đã xử lý xong.</small></div>}
        {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
      </>}</div>
      {selected && selected.status !== "RESOLVED" && <Flex justify="end" gap="3" wrap="wrap" className={styles.dialogFooter}><Button variant="outline" disabled={busy || !(drafts[selected.id] ?? "").trim()} onClick={() => void act("READ")}>Gửi phản hồi</Button><Button loading={busy} disabled={busy} onClick={() => void act("RESOLVED")}>Hoàn tất xử lý</Button></Flex>}
    </Dialog.Content></Dialog.Root>
  </div>;
}
