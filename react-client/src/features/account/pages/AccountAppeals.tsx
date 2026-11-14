import { useResource } from "../../../shared/hooks/operationsData";
import { AppealEvidenceGallery } from "../components/AppealEvidence";
import { useRef, useState } from "react";
import { Badge, Button, Dialog, Flex, Select, TextArea, TextField } from "@radix-ui/themes";
import { resolveAppeal, type Appeal } from "../api/appealApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import "../../support/styles/support-pages.css";

const APPEAL_STATUS = { PENDING: "Chờ xử lý", APPROVED: "Đã duyệt mở khóa", REJECTED: "Đã từ chối" };

export default function AccountAppeals() {
  const [actionError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const appealsResource = useResource<Appeal[]>("/admin/appeals", true);
  const items = appealsResource.data ?? [];
  const setItems = appealsResource.setData;
  const loading = appealsResource.loading;
  const error = actionError || appealsResource.error || "";
  const load = () => { setError(""); return appealsResource.refresh(); };
  const filtered = items.filter(item => (filter === "ALL" || item.status === filter)
    && `${item.userName} ${item.userEmail} ${item.reason}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const save = async (status: "APPROVED" | "REJECTED") => {
    if (!selected || lock.current || !note.trim()) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const updated = await resolveAppeal(selected.id, { status, resolutionNote: note.trim() });
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
      setSelected(null); setNotice(status === "APPROVED" ? "Đã duyệt đơn và mở khóa tài khoản." : "Đã từ chối đơn và gửi phản hồi.");
    } catch (err) { setError(apiMessage(err, "Không thể xử lý đơn.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="support-page">
    <Flex justify="between" align="center" wrap="wrap" gap="3"><div><h1>Khiếu nại tài khoản</h1><p>Các đơn thuộc phạm vi tài khoản bạn được quản lý.</p></div><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>Làm mới</Button></Flex>
    {notice && <p role="status" className="support-success">{notice}</p>}
    {!selected && error && <p role="alert" className="admin-error-banner">{error}</p>}
    <section className="support-panel">
      <Flex gap="3" wrap="wrap" mb="4"><TextField.Root aria-label="Tìm khiếu nại" placeholder="Tìm tên, email hoặc tiêu đề…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
        <Select.Root value={filter} onValueChange={value => { setFilter(value); setPage(1); }}><Select.Trigger aria-label="Trạng thái đơn" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item>{Object.entries(APPEAL_STATUS).map(([value, label]) => <Select.Item key={value} value={value}>{label}</Select.Item>)}</Select.Content></Select.Root></Flex>
      {loading ? <TableLoadingSkeleton headers={["Người gửi", "Nội dung", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : <div className="support-scroll"><table className="support-table"><thead><tr><th>Người gửi</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>
        {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(item => <tr key={item.id}><td>{item.userName}<small>{item.userEmail}</small></td><td>{item.reason}</td><td><Badge color={item.status === "PENDING" ? "orange" : item.status === "APPROVED" ? "green" : "red"}>{APPEAL_STATUS[item.status]}</Badge></td><td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td><td><Button size="1" variant="soft" onClick={() => { setSelected(item); setNote(""); setError(""); }}>Xem đơn</Button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={5}>Không có đơn phù hợp.</td></tr>}
      </tbody></table></div>}
      <Flex justify="between" align="center" mt="4" wrap="wrap" gap="2"><span>{filtered.length} đơn</span><Flex align="center" gap="3"><Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button><span>Trang {currentPage}/{pages}</span><Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></Flex></Flex>
    </section>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open && !lock.current) setSelected(null); }}><Dialog.Content maxWidth="620px" className={modal.dialog}><div className={modal.body}>
      <Dialog.Title>{selected?.reason}</Dialog.Title><Dialog.Description>{selected?.userName} · {selected?.userEmail}</Dialog.Description>
      <p className="support-body">{selected?.content}</p>
      {selected && <AppealEvidenceGallery key={selected.id} appealId={selected.id} />}
      {error && <p role="alert" className="admin-error-banner">{error}</p>}
      {selected?.status === "PENDING" ? <><label className="support-field">Kết quả / lý do xử lý<TextArea rows={4} maxLength={10000} disabled={busy} value={note} onChange={e => setNote(e.target.value)} /></label><p>Duyệt đơn sẽ mở khóa tài khoản. Từ chối sẽ giữ trạng thái tài khoản hiện tại.</p><Flex justify="end" gap="3" wrap="wrap"><Button color="gray" variant="soft" disabled={busy} onClick={() => setSelected(null)}>Đóng</Button><Button color="red" variant="outline" disabled={busy || !note.trim()} onClick={() => void save("REJECTED")}>Từ chối</Button><Button loading={busy} disabled={busy || !note.trim()} onClick={() => void save("APPROVED")}>Duyệt & mở khóa</Button></Flex></> : <><Badge>{selected ? APPEAL_STATUS[selected.status] : ""}</Badge><p className="support-body">{selected?.resolutionNote}</p><Dialog.Close><Button variant="soft">Đóng</Button></Dialog.Close></>}
    </div></Dialog.Content></Dialog.Root>
  </main>;
}
