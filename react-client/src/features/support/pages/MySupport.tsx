import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Select, TextArea, TextField } from "@radix-ui/themes";
import { getMyAppeals, type Appeal } from "../../account/api/appealApi";
import { mySupportItems, submitSupportRequest, type SupportItem } from "../api/supportApi";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { userHome } from "../../../shared/auth/permissions";
import { apiMessage } from "../../../shared/lib/apiError";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import "../styles/support-pages.css";

export default function MySupport() {
  const user = useSessionStore(state => state.user);
  const [items, setItems] = useState<SupportItem[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<"MESSAGE" | "FEEDBACK">("MESSAGE");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [support, account] = await Promise.all([mySupportItems(), getMyAppeals()]); setItems(support.filter(item => item.kind !== "COMPLAINT")); setAppeals(account); }
    catch (err) { setError(apiMessage(err, "Không thể tải lịch sử yêu cầu.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const suspended = user?.active === false || user?.accountStatus === "SUSPENDED_READ_ONLY";
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { const item = await submitSupportRequest(kind, subject.trim(), content.trim()); setItems(current => [item, ...current]); setSubject(""); setContent(""); setNotice("Đã gửi yêu cầu đến Manager. Phản hồi sẽ hiển thị trong lịch sử bên dưới."); }
    catch (err) { setError(apiMessage(err, "Không thể gửi yêu cầu.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="support-page">{!suspended && <Link to={userHome(user)}>← Quay lại</Link>}<header><h1>Hỗ trợ & khiếu nại của tôi</h1><p>{suspended ? "Tài khoản đang tạm khóa. Gửi khiếu nại bằng nút trên thông báo và theo dõi kết quả tại đây." : "Gửi yêu cầu hỗ trợ cho Manager và xem phản hồi về tài khoản."}</p></header>
    {error && <p role="alert" className="admin-error-banner">{error}</p>}{notice && <p role="status" className="support-success">{notice}</p>}
    <section className="support-panel"><h2>Gửi yêu cầu hỗ trợ</h2>{suspended ? <p>Tài khoản đang bị khóa. Bạn có thể gửi đơn bằng nút “Gửi khiếu nại tài khoản” trên thông báo tạm khóa.</p> : <form onSubmit={submit}>
      <label className="support-field">Loại yêu cầu<Select.Root value={kind} onValueChange={value => setKind(value as "MESSAGE" | "FEEDBACK")} disabled={busy}><Select.Trigger /><Select.Content><Select.Item value="MESSAGE">Hỗ trợ sử dụng, gói dịch vụ, thanh toán</Select.Item><Select.Item value="FEEDBACK">Góp ý / phản hồi</Select.Item></Select.Content></Select.Root></label>
      <label className="support-field">Tiêu đề<TextField.Root required maxLength={180} value={subject} disabled={busy} onChange={e => setSubject(e.target.value)} /></label><label className="support-field">Nội dung<TextArea required rows={4} maxLength={10000} value={content} disabled={busy} onChange={e => setContent(e.target.value)} /></label><Button type="submit" loading={busy} disabled={busy || !subject.trim() || !content.trim()}>Gửi yêu cầu</Button>
    </form>}</section>
    <Button variant="outline" style={{ justifySelf: "start" }} disabled={loading} onClick={() => void load()}>Làm mới lịch sử</Button>
    {loading ? <CardLoadingSkeleton cards={2} /> : <>
      <section className="support-panel"><h2>Khiếu nại tài khoản</h2><div className="support-scroll">{appeals.length === 0 ? <p>Bạn chưa gửi đơn khiếu nại tài khoản.</p> : appeals.map(item => <article className="support-panel" key={item.id}><Badge color={item.status === "PENDING" ? "orange" : item.status === "APPROVED" ? "green" : "red"}>{{ PENDING: "Chờ xử lý", APPROVED: "Đã duyệt mở khóa", REJECTED: "Đã từ chối" }[item.status]}</Badge><h3>{item.reason}</h3><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small><p className="support-body">{item.content}</p>{item.resolutionNote && <p className="support-body"><strong>Phản hồi:</strong> {item.resolutionNote}</p>}{item.resolvedAt && <small>Xử lý lúc {new Date(item.resolvedAt).toLocaleString("vi-VN")}</small>}</article>)}</div></section>
      <section className="support-panel"><h2>Yêu cầu hỗ trợ đã gửi</h2><div className="support-scroll">{items.length === 0 ? <p>Chưa có yêu cầu hỗ trợ.</p> : items.map(item => <article className="support-panel" key={item.id}><Badge>{{ OPEN: "Chờ xử lý", READ: "Đang xử lý", RESOLVED: "Đã xử lý" }[item.status]}</Badge><h3>{item.subject}</h3><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small><p className="support-body">{item.content}</p>{item.adminResponse && <p className="support-body"><strong>Phản hồi:</strong> {item.adminResponse}</p>}</article>)}</div></section>
    </>}
  </main>;
}
