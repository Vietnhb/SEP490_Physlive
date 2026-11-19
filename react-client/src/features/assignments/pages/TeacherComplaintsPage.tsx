import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Dialog, Flex, Select, TextField } from "@radix-ui/themes";
import { useResource } from "../../../shared/hooks/operationsData";
import { isWithinSentDates } from "../../../shared/lib/sentDateRange";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import type { SimulationComplaint } from "../../support/api/supportApi";
import { COMPLAINT_STATUS } from "../../support/model/complaintStatus";
import styles from "../../support/styles/SupportFilters.module.css";
import modal from "../../../shared/ui/ModalScroll.module.css";
import "../../support/styles/support-pages.css";

const code = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
function contents(value: string) {
  const marker = "\n— Đề bài —";
  const index = value.indexOf(marker);
  return index < 0 ? { detail: value, context: "" } : { detail: value.slice(0, index), context: value.slice(index + marker.length) };
}

export default function TeacherComplaintsPage() {
  const resource = useResource<SimulationComplaint[]>("/support/mine");
  const items = useMemo(() => (resource.data ?? []).filter(item => item.kind === "COMPLAINT").sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [resource.data]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const invalidDates = Boolean(from && to && from > to);
  const selected = items.find(item => item.id === selectedId);
  const selectedContent = selected ? contents(selected.content) : null;
  const filtered = invalidDates ? [] : items.filter(item => (status === "ALL" || item.status === status)
    && (code(item.id) + " " + item.subject).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))
    && isWithinSentDates(item.createdAt, from, to));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  const hasFilters = Boolean(query || status !== "ALL" || from || to);
  const resetPage = () => { setPage(1); scroll.current?.scrollTo({ top: 0 }); };
  return <main className={"support-page support-page--manager " + styles.teacher}>
    <header className="complaint-page__head"><div><h1>Khiếu nại đã gửi</h1><p>Theo dõi báo lỗi mô phỏng và phản hồi từ người kiểm duyệt.</p></div><Button variant="outline" disabled={resource.refreshing} onClick={() => void resource.refresh()}>Làm mới</Button></header>
    {resource.error && <p role="alert" className="admin-error-banner">{resource.error}</p>}
    <section className="support-panel">
      <div className={styles.filters} role="group" aria-label="Bộ lọc khiếu nại">
        <label className={styles.field + " " + styles.search}>Tìm kiếm<TextField.Root aria-label="Tìm khiếu nại đã gửi" placeholder="Tìm mã hoặc tiêu đề…" value={query} onChange={event => { setQuery(event.target.value); resetPage(); }} /></label>
        <label className={styles.field}>Trạng thái<Select.Root value={status} onValueChange={value => { setStatus(value); resetPage(); }}><Select.Trigger aria-label="Trạng thái khiếu nại" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item>{Object.entries(COMPLAINT_STATUS).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></label>
        <label className={styles.field}>Từ ngày<input type="date" aria-label="Khiếu nại từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); resetPage(); }} /></label>
        <label className={styles.field}>Đến ngày<input type="date" aria-label="Khiếu nại đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); resetPage(); }} /></label>
        <Button variant="outline" disabled={!hasFilters} onClick={() => { setQuery(""); setStatus("ALL"); setFrom(""); setTo(""); resetPage(); }}>Xóa bộ lọc</Button>
      </div>
      {invalidDates && <p role="alert" className="admin-error-banner">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      {resource.loading ? <TableLoadingSkeleton headers={["Khiếu nại", "Nội dung", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : <div ref={scroll} className="support-scroll" role="region" tabIndex={0} aria-label="Danh sách khiếu nại có thể cuộn"><table className={"support-table " + styles.table}>
        <colgroup><col style={{ width: "27%" }} /><col style={{ width: "28%" }} /><col style={{ width: "16%" }} /><col style={{ width: "17%" }} /><col style={{ width: "12%" }} /></colgroup>
        <thead><tr><th>Khiếu nại</th><th>Nội dung tóm tắt</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead>
        <tbody>{filtered.slice(start, start + size).map(item => <tr key={item.id}>
          <td><span className={styles.clamp}>{item.subject}</span><small>{code(item.id)}</small></td>
          <td><p className={styles.clamp + " " + styles.summary}>{contents(item.content).detail.trim()}</p></td>
          <td><Badge color={item.status === "RESOLVED" ? "green" : item.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[item.status]}</Badge></td>
          <td><time dateTime={item.createdAt}>{date(item.createdAt)}</time></td>
          <td><Button variant="ghost" size="1" aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setSelectedId(item.id); }}>Xem chi tiết</Button></td>
        </tr>)}</tbody>
      </table>{filtered.length === 0 && <p className="admin-empty-table">{items.length === 0 && !hasFilters ? <>Bạn chưa gửi khiếu nại nào. <Link to="/workspace">Mở mô phỏng để báo lỗi</Link>.</> : "Không có khiếu nại phù hợp bộ lọc."}</p>}</div>}
      <footer className={styles.footer}><span aria-live="polite">Hiển thị {filtered.length ? start + 1 : 0}–{Math.min(start + size, filtered.length)} / {filtered.length} khiếu nại</span><div>
        <label>Số dòng/trang<Select.Root value={String(size)} onValueChange={value => { setSize(Number(value)); resetPage(); }}><Select.Trigger aria-label="Số khiếu nại mỗi trang" /><Select.Content>{[10, 25, 50].map(value => <Select.Item key={value} value={String(value)}>{value}</Select.Item>)}</Select.Content></Select.Root></label>
        <Button variant="soft" size="1" disabled={current <= 1} onClick={() => { setPage(current - 1); scroll.current?.scrollTo({ top: 0 }); }}>Trước</Button><span>Trang {current}/{pages}</span><Button variant="soft" size="1" disabled={current >= pages} onClick={() => { setPage(current + 1); scroll.current?.scrollTo({ top: 0 }); }}>Sau</Button>
      </div></footer>
    </section>
    <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(""); }}><Dialog.Content maxWidth="720px" className={modal.dialog} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}><div className={modal.body}>
      <Dialog.Title>Chi tiết khiếu nại</Dialog.Title><Dialog.Description>{selected && code(selected.id)}</Dialog.Description>
      {selected && selectedContent && <>
        <h2 className={styles.detailTitle}>{selected.subject}</h2><Badge color={selected.status === "RESOLVED" ? "green" : selected.status === "READ" ? "blue" : "orange"}>{COMPLAINT_STATUS[selected.status]}</Badge>
        <p className={styles.meta}>Ngày gửi: {date(selected.createdAt)}</p>
        <h3 className={styles.detailTitle}>Nội dung khiếu nại</h3><p className="support-body">{selectedContent.detail.trim()}</p>
        {selectedContent.context && <><h3 className={styles.detailTitle}>Đề bài và thông tin mô phỏng</h3><p className="support-body">{selectedContent.context.trim()}</p></>}
        <section className={styles.response}><strong>Phản hồi{selected.responderName ? " từ " + selected.responderName : ""}</strong>{selected.respondedAt && <p className={styles.meta}>{date(selected.respondedAt)}</p>}<p className="support-body">{selected.adminResponse || "Chưa có phản hồi. Bạn có thể theo dõi kết quả xử lý tại đây."}</p></section>
      </>}
      <Flex justify="end" mt="4"><Dialog.Close><Button variant="soft">Đóng</Button></Dialog.Close></Flex>
    </div></Dialog.Content></Dialog.Root>
  </main>;
}
