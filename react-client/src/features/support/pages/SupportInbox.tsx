import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Dialog, Flex, Select, TextArea, TextField } from "@radix-ui/themes";
import { getAdminAppeals, resolveAppeal, type Appeal } from "../../account/api/appealApi";
import { adminSupportItems, referComplaintToReviewer, updateSupportItem, type SupportItem } from "../api/supportApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import "../styles/support-pages.css";

const KINDS = { COMPLAINT: "Báo lỗi mô phỏng", MESSAGE: "Yêu cầu hỗ trợ", FEEDBACK: "Góp ý", ACCOUNT: "Khiếu nại tài khoản" };
const STATUS: Record<string, string> = { OPEN: "Chờ xử lý", READ: "Đang xử lý", RESOLVED: "Đã hoàn tất", PENDING: "Chờ xử lý", APPROVED: "Đã duyệt mở khóa", REJECTED: "Đã từ chối" };
type Entry = { key: string; id: string; kind: keyof typeof KINDS; subject: string; content: string; sender: string; email: string; createdAt: string; status: string; response?: string | null; support?: SupportItem; appeal?: Appeal };

export default function SupportInbox() {
  const [params] = useSearchParams();
  const [items, setItems] = useState<SupportItem[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [kind, setKind] = useState(params.get("kind") ?? "ALL");
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [response, setResponse] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [support, account] = await Promise.all([adminSupportItems(), getAdminAppeals()]); setItems(support); setAppeals(account); window.dispatchEvent(new Event("physlive:support-updated")); }
    catch (err) { setError(apiMessage(err, "Không thể tải yêu cầu hỗ trợ.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const entries: Entry[] = [
    ...items.map(item => ({ key: `support:${item.id}`, id: item.id, kind: item.kind, subject: item.subject, content: item.content, sender: item.senderName, email: item.senderEmail, createdAt: item.createdAt, status: item.status, response: item.adminResponse, support: item })),
    ...appeals.map(item => ({ key: `account:${item.id}`, id: item.id, kind: "ACCOUNT" as const, subject: item.reason, content: item.content, sender: item.userName, email: item.userEmail, createdAt: item.createdAt, status: item.status, response: item.resolutionNote, appeal: item })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = entries.find(item => item.key === selectedKey);
  const done = (item: Entry) => ["RESOLVED", "APPROVED", "REJECTED"].includes(item.status);
  const filtered = entries.filter(item => (kind === "ALL" || item.kind === kind)
    && (status === "ALL" || (status === "DONE" ? done(item) : !done(item)))
    && `${item.sender} ${item.email} ${item.subject}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  const act = async (action: "READ" | "RESOLVED" | "REFER" | "APPROVED" | "REJECTED") => {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (selected.appeal && (action === "APPROVED" || action === "REJECTED")) {
        const updated = await resolveAppeal(selected.id, { status: action, resolutionNote: response.trim() });
        setAppeals(current => current.map(item => item.id === updated.id ? updated : item));
      } else if (selected.support && ["READ", "RESOLVED", "REFER"].includes(action)) {
        const updated = action === "REFER" ? await referComplaintToReviewer(selected.id) : await updateSupportItem(selected.id, action as "READ" | "RESOLVED", response.trim());
        setItems(current => current.map(item => item.id === updated.id ? updated : item));
      }
      setNotice(action === "REFER" ? "Đã chuyển báo lỗi cho Reviewer kiểm tra." : "Đã lưu kết quả và cập nhật phản hồi cho người gửi.");
      window.dispatchEvent(new Event("physlive:support-updated"));
      setSelectedKey("");
    } catch (err) { setError(apiMessage(err, "Không thể cập nhật yêu cầu.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="support-page support-page--manager"><Flex justify="between" align="center" gap="3" wrap="wrap"><header><h1>Yêu cầu hỗ trợ</h1><p>Tiếp nhận, phản hồi hoặc chuyển báo lỗi mô phỏng cho Reviewer.</p></header><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>Làm mới</Button></Flex>
    {notice && <p role="status" className="support-success">{notice}</p>}{error && !selected && <p role="alert" className="admin-error-banner">{error}</p>}
    <section className="support-panel"><Flex gap="3" wrap="wrap" mb="4">
      <TextField.Root aria-label="Tìm yêu cầu" placeholder="Tìm tên, email, tiêu đề…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <Select.Root value={kind} onValueChange={value => { setKind(value); setPage(1); }}><Select.Trigger aria-label="Loại yêu cầu" /><Select.Content><Select.Item value="ALL">Tất cả loại yêu cầu</Select.Item>{Object.entries(KINDS).map(([value, label]) => <Select.Item value={value} key={value}>{label}</Select.Item>)}</Select.Content></Select.Root>
      <Select.Root value={status} onValueChange={value => { setStatus(value); setPage(1); }}><Select.Trigger aria-label="Trạng thái" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item><Select.Item value="TODO">Chưa hoàn tất</Select.Item><Select.Item value="DONE">Đã hoàn tất</Select.Item></Select.Content></Select.Root>
    </Flex>
    {loading ? <TableLoadingSkeleton headers={["Người gửi", "Loại", "Tiêu đề", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : <div className="support-scroll"><table className="support-table"><thead><tr><th>Người gửi</th><th>Loại</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>
      {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(item => <tr key={item.key}><td>{item.sender}<small>{item.email}</small></td><td>{KINDS[item.kind]}</td><td>{item.subject}</td><td><Badge color={done(item) ? "green" : "orange"}>{STATUS[item.status]}</Badge>{item.support?.reviewerReferred && <small>Đã chuyển Reviewer</small>}</td><td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td><td><Button size="1" variant="soft" onClick={() => { setSelectedKey(item.key); setResponse(item.response ?? ""); setError(""); }}>Xem yêu cầu</Button></td></tr>)}
      {filtered.length === 0 && <tr><td colSpan={6}>Không có yêu cầu phù hợp.</td></tr>}
    </tbody></table></div>}
    <Flex justify="between" align="center" mt="4" gap="3" wrap="wrap"><span>{filtered.length} yêu cầu</span><Flex align="center" gap="3"><Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button><span>Trang {currentPage}/{pages}</span><Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></Flex></Flex></section>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open && !lock.current) setSelectedKey(""); }}><Dialog.Content maxWidth="700px" className={modal.dialog}><div className={modal.body}>
      <Dialog.Title>{selected?.subject}</Dialog.Title><Dialog.Description>{selected?.sender} · {selected?.email}</Dialog.Description><p><Badge>{selected ? KINDS[selected.kind] : ""}</Badge> {selected ? STATUS[selected.status] : ""}</p><p className="support-body">{selected?.content}</p>
      {selected?.support?.reviewerReferred && <p>Đã chuyển Reviewer kiểm tra. Manager vẫn có thể phản hồi và hoàn tất yêu cầu.</p>}
      {selected?.response && <div className="support-panel"><strong>Phản hồi{selected.support?.responderName ? ` (${selected.support.responderName})` : ""}</strong><p className="support-body">{selected.response}</p></div>}
      {error && <p role="alert" className="admin-error-banner">{error}</p>}
      {selected && (!selected.appeal || selected.status === "PENDING") && <label className="support-field">Phản hồi / lý do xử lý<TextArea rows={4} maxLength={10000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label>}
      <Flex justify="end" gap="3" wrap="wrap"><Button variant="soft" color="gray" disabled={busy} onClick={() => setSelectedKey("")}>Đóng</Button>
        {selected?.appeal && selected.status === "PENDING" && <><Button variant="outline" color="red" disabled={busy || !response.trim()} onClick={() => void act("REJECTED")}>Từ chối</Button><Button loading={busy} disabled={busy || !response.trim()} onClick={() => void act("APPROVED")}>Duyệt & mở khóa</Button></>}
        {selected?.support && <>
          {selected.kind === "COMPLAINT" && !done(selected) && !selected.support.reviewerReferred && <Button variant="outline" disabled={busy} onClick={() => void act("REFER")}>Chuyển Reviewer</Button>}
          <Button variant="soft" disabled={busy} onClick={() => void act("READ")}>{done(selected) ? "Mở lại xử lý" : "Lưu, tiếp tục xử lý"}</Button>
          {!done(selected) && <Button loading={busy} disabled={busy || !response.trim()} onClick={() => void act("RESOLVED")}>Phản hồi & hoàn tất</Button>}
        </>}
      </Flex>
    </div></Dialog.Content></Dialog.Root>
  </main>;
}
