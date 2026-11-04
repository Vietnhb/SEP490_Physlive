import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Dialog, IconButton, Select, TextArea, TextField } from "@radix-ui/themes";
import { Cross2Icon, ExitIcon, EyeOpenIcon, MagnifyingGlassIcon, PlusIcon, ReloadIcon } from "@radix-ui/react-icons";
import { createAppeal, getMyAppeals, type Appeal } from "../../account/api/appealApi";
import { mySupportItems, submitSupportRequest, type SupportItem } from "../api/supportApi";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { isAccountSuspended, userHome } from "../../../shared/auth/permissions";
import { getRoleLabel } from "../../../shared/auth/roles";
import { apiMessage } from "../../../shared/lib/apiError";
import { clearToken } from "../../../shared/lib/token";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import LearningIcon from "../../../shared/ui/LearningIcon";
import s from "./MySupport.module.css";

type Category = "ALL" | "ACCOUNT" | "SUPPORT";
type Phase = "ALL" | "WAITING" | "PROCESSING" | "DONE";
type Case = {
  key: string; code: string; subject: string; content: string; category: Exclude<Category, "ALL">;
  typeLabel: string; phase: Exclude<Phase, "ALL">; statusLabel: string; color: "orange" | "blue" | "green" | "red";
  createdAt: string; response?: string | null; respondedAt?: string | null; responder?: string | null; referred?: boolean;
};
const timestamp = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
const reference = (prefix: string, id: string) => `${prefix}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
const PAGE_SIZE = 5;

export default function MySupport() {
  const navigate = useNavigate();
  const user = useSessionStore(state => state.user);
  const logout = () => {
    clearToken();
    useSessionStore.getState().setUser(null);
    navigate("/login", { replace: true });
  };
  const [items, setItems] = useState<SupportItem[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<"MESSAGE" | "FEEDBACK">("MESSAGE");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [category, setCategory] = useState<Category>("ALL");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("ALL");
  const [applied, setApplied] = useState({ query: "", phase: "ALL" as Phase });
  const [page, setPage] = useState(1);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [support, account] = await Promise.all([mySupportItems(), getMyAppeals()]); setItems(support); setAppeals(account); }
    catch (err) { setError(apiMessage(err, "Không thể tải lịch sử yêu cầu. Vui lòng thử lại.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const suspended = isAccountSuspended(user);
  const internalAdmin = suspended && ["MANAGER", "ADMIN"].includes(user?.role ?? "");
  const pendingAppeal = appeals.some(item => item.status === "PENDING" && item.currentSuspension !== false);
  const cases: Case[] = [
    ...appeals.map((item): Case => ({ key: `account:${item.id}`, code: reference("KN", item.id), subject: item.reason, content: item.content,
      category: "ACCOUNT", typeLabel: "Khiếu nại tài khoản", phase: item.status === "PENDING" ? "WAITING" : "DONE",
      statusLabel: { PENDING: "Chờ xử lý", APPROVED: "Đã duyệt mở khóa", REJECTED: "Đã từ chối" }[item.status],
      color: item.status === "PENDING" ? "orange" : item.status === "APPROVED" ? "green" : "red",
      createdAt: item.createdAt, response: item.resolutionNote, respondedAt: item.resolvedAt })),
    ...items.map((item): Case => ({ key: `support:${item.id}`, code: reference("YC", item.id), subject: item.subject, content: item.content,
      category: "SUPPORT", typeLabel: { MESSAGE: "Yêu cầu hỗ trợ", FEEDBACK: "Góp ý / phản hồi", COMPLAINT: "Báo lỗi mô phỏng" }[item.kind],
      phase: item.status === "OPEN" ? "WAITING" : item.status === "READ" ? "PROCESSING" : "DONE",
      statusLabel: { OPEN: "Chờ xử lý", READ: "Đang xử lý", RESOLVED: "Đã xử lý" }[item.status],
      color: item.status === "OPEN" ? "orange" : item.status === "READ" ? "blue" : "green",
      createdAt: item.createdAt, response: item.adminResponse, respondedAt: item.respondedAt,
      responder: item.responderName, referred: item.reviewerReferred })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const completed = cases.filter(item => item.phase === "DONE").length;
  const filtered = cases.filter(item => (category === "ALL" || item.category === category)
    && (applied.phase === "ALL" || item.phase === applied.phase)
    && `${item.code} ${item.subject}`.toLocaleLowerCase("vi").includes(applied.query.toLocaleLowerCase("vi")));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), currentPage = Math.min(page, pages);
  const selected = cases.find(item => item.key === selectedKey);
  const changeCategory = (value: Category) => { setCategory(value); setPage(1); };
  const resetFilters = () => { setQuery(""); setPhase("ALL"); setApplied({ query: "", phase: "ALL" }); setCategory("ALL"); setPage(1); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current || !subject.trim() || !content.trim()) return;
    lock.current = true; setBusy(true); setFormError(""); setNotice("");
    try {
      if (suspended) {
        const item = await createAppeal({ reason: subject.trim(), content: content.trim() }); setAppeals(current => [item, ...current]);
      } else {
        const item = await submitSupportRequest(kind, subject.trim(), content.trim()); setItems(current => [item, ...current]);
      }
      setSubject(""); setContent(""); setCreateOpen(false); resetFilters();
      setNotice("Đã gửi yêu cầu. Bạn có thể theo dõi trạng thái và phản hồi trong danh sách bên dưới.");
    } catch (err) { setFormError(apiMessage(err, "Không thể gửi yêu cầu. Vui lòng thử lại.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className={s.page}>
    <aside className={s.sidebar} aria-label="Thông tin và danh mục yêu cầu">
      <div className={s.identity}><span className={s.avatar}>{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user?.fullName?.trim().charAt(0).toLocaleUpperCase("vi") || "U"}</span><strong>{user?.fullName}</strong><span>{getRoleLabel(user?.role ?? "")}</span><small>{user?.email}</small></div>
      <div className={s.stats} aria-label="Thống kê yêu cầu"><div><strong className={s.completed}>{loading ? "—" : completed}</strong><span>Đã hoàn tất</span></div><div><strong className={s.pending}>{loading ? "—" : cases.length - completed}</strong><span>Chưa hoàn tất</span></div></div>
      <nav className={s.navigation}>
        {!suspended && <Link to="/profile"><LearningIcon name="users" />Thông tin tài khoản<LearningIcon name="chevronRight" /></Link>}
        <button type="button" aria-current={category === "ALL" ? "page" : undefined} onClick={() => changeCategory("ALL")}><LearningIcon name="file" />Tất cả yêu cầu<span>{loading ? "—" : cases.length}</span></button>
        <button type="button" aria-current={category === "ACCOUNT" ? "page" : undefined} onClick={() => changeCategory("ACCOUNT")}><LearningIcon name="shield" />Khiếu nại tài khoản<span>{loading ? "—" : appeals.length}</span></button>
        <button type="button" aria-current={category === "SUPPORT" ? "page" : undefined} onClick={() => changeCategory("SUPPORT")}><LearningIcon name="message" />Hỗ trợ & góp ý<span>{loading ? "—" : items.length}</span></button>
        {!suspended && <Link to={userHome(user)} className={s.backLink}><LearningIcon name="back" />Quay lại trang chính</Link>}
        <button type="button" className={s.logout} onClick={logout}><ExitIcon />Đăng xuất</button>
      </nav>
    </aside>
    <div className={s.main}>
      <header className={s.banner}><span className={s.bannerIcon}><LearningIcon name="message" /></span><div><h1>Hỗ trợ & khiếu nại của tôi</h1><p>Theo dõi yêu cầu, tra cứu kết quả và phản hồi từ bộ phận hỗ trợ.</p></div></header>
      <div className={s.toolbar}><span>{loading ? "Đang tải yêu cầu…" : `${cases.length} yêu cầu đã gửi`}</span><div><Button variant="outline" disabled={loading} onClick={() => void load()}><ReloadIcon />Làm mới</Button>{!internalAdmin && <Button disabled={loading || (suspended && pendingAppeal)} onClick={() => { setFormError(""); setCreateOpen(true); }}><PlusIcon />{suspended ? "Gửi khiếu nại" : "Gửi yêu cầu"}</Button>}</div></div>
      {suspended && <p className={s.info}>{internalAdmin ? "Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên hệ thống để được mở lại; không gửi yêu cầu trong ứng dụng." : pendingAppeal ? "Bạn đã có đơn khiếu nại tài khoản đang chờ xử lý. Vui lòng theo dõi kết quả bên dưới." : "Tài khoản đang tạm khóa. Bạn có thể gửi khiếu nại và theo dõi kết quả xử lý tại đây."}</p>}
      {error && <p className={s.error} role="alert">{error}</p>}{notice && <p className={s.success} role="status">{notice}</p>}
      <form className={s.filters} onSubmit={event => { event.preventDefault(); setApplied({ query: query.trim(), phase }); setPage(1); }}>
        <label>Tên hoặc mã yêu cầu<TextField.Root size="3" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nhập mã tham chiếu / tiêu đề yêu cầu"><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root></label>
        <label>Trạng thái yêu cầu<Select.Root size="3" value={phase} onValueChange={value => setPhase(value as Phase)}><Select.Trigger /><Select.Content position="popper"><Select.Item value="ALL">Tất cả trạng thái</Select.Item><Select.Item value="WAITING">Chờ xử lý</Select.Item><Select.Item value="PROCESSING">Đang xử lý</Select.Item><Select.Item value="DONE">Đã hoàn tất</Select.Item></Select.Content></Select.Root></label>
        <div className={s.searchActions}><Button size="3" type="submit"><MagnifyingGlassIcon />Tìm kiếm</Button>{(applied.query || applied.phase !== "ALL" || category !== "ALL") && <Button type="button" variant="ghost" color="gray" onClick={resetFilters}>Xóa bộ lọc</Button>}</div>
      </form>
      <section className={s.results} aria-label="Danh sách yêu cầu" aria-busy={loading}>
        <div className={s.resultHeading}><h2>{category === "ACCOUNT" ? "Khiếu nại tài khoản" : category === "SUPPORT" ? "Hỗ trợ & góp ý" : "Danh sách yêu cầu"}</h2><span>{loading ? "Đang tải…" : `${filtered.length} kết quả`}</span></div>
        {loading ? <CardLoadingSkeleton cards={3} /> : filtered.length === 0 ? <div className={s.empty}><LearningIcon name="file" /><h3>{cases.length ? "Không tìm thấy yêu cầu phù hợp" : "Bạn chưa có yêu cầu nào"}</h3><p>{cases.length ? "Thử thay đổi từ khóa hoặc trạng thái tìm kiếm." : "Các yêu cầu đã gửi và kết quả xử lý sẽ hiển thị tại đây."}</p></div> : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(item => <article className={s.caseCard} key={item.key}>
          <h3><span>{item.code}</span><span aria-hidden="true"> · </span>{item.subject}</h3>
          <div className={s.caseMiddle}><div className={s.caseTags}><Badge color={item.color}>{item.statusLabel}</Badge><span>{item.typeLabel}</span>{item.referred && <span className={s.referral}>Reviewer xử lý</span>}</div><Button variant="outline" size="2" onClick={() => setSelectedKey(item.key)}><EyeOpenIcon />Xem chi tiết</Button></div>
          <div className={s.caseDates}><span><b>Ngày gửi:</b> <time dateTime={item.createdAt}>{timestamp(item.createdAt)}</time></span><span>{item.respondedAt ? <><b>Ngày phản hồi:</b> <time dateTime={item.respondedAt}>{timestamp(item.respondedAt)}</time></> : item.response ? "Đã có phản hồi" : "Chưa có phản hồi"}</span></div>
        </article>)}
        {!loading && filtered.length > 0 && <div className={s.pagination}><span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length} yêu cầu</span><div><Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button><span>Trang {currentPage}/{pages}</span><Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></div></div>}
      </section>
    </div>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelectedKey(""); }}><Dialog.Content maxWidth="900px" className={s.dialog}>
      <div className={s.dialogHeader}><div><Dialog.Title className={s.dialogTitle}>Chi tiết yêu cầu</Dialog.Title><Dialog.Description className={s.dialogDescription}>{selected?.code} · {selected?.typeLabel}</Dialog.Description></div><Dialog.Close><IconButton variant="ghost" color="gray" aria-label="Đóng chi tiết"><Cross2Icon /></IconButton></Dialog.Close></div>
      <div className={s.dialogBody} tabIndex={0} aria-label="Nội dung chi tiết yêu cầu">
        <h3 className={s.detailSubject}>{selected?.subject}</h3>
        <dl className={s.detailMeta}><div><dt>Thời gian gửi</dt><dd>{selected && timestamp(selected.createdAt)}</dd></div><div><dt>Trạng thái</dt><dd>{selected && <Badge color={selected.color}>{selected.statusLabel}</Badge>}</dd></div></dl>
        <section className={s.detailSection}><h3>Nội dung yêu cầu</h3><p>{selected?.content}</p></section>
        {selected?.referred && <p className={s.info}>Reviewer tiếp nhận trực tiếp báo lỗi mô phỏng để kiểm tra chuyên môn.</p>}
        <section className={`${s.detailSection} ${s.reply}`}><h3>Phản hồi từ bộ phận hỗ trợ</h3>{selected?.response ? <><div className={s.replyMeta}>{selected.responder && <strong>{selected.responder}</strong>}{selected.respondedAt && <time dateTime={selected.respondedAt}>{timestamp(selected.respondedAt)}</time>}</div><p>{selected.response}</p></> : <p>Yêu cầu đang chờ phản hồi. Bạn có thể quay lại trang này để theo dõi kết quả xử lý.</p>}</section>
      </div>
      <div className={s.dialogFooter}><Dialog.Close><Button variant="outline" color="gray">Đóng</Button></Dialog.Close></div>
    </Dialog.Content></Dialog.Root>
    <Dialog.Root open={createOpen} onOpenChange={open => { if (!lock.current) setCreateOpen(open); }}><Dialog.Content maxWidth="700px" className={s.dialog}>
      <div className={s.dialogHeader}><div><Dialog.Title className={s.dialogTitle}>{suspended ? "Gửi khiếu nại tài khoản" : "Gửi yêu cầu hỗ trợ"}</Dialog.Title><Dialog.Description className={s.dialogDescription}>Nhập thông tin để bộ phận phụ trách tiếp nhận và phản hồi.</Dialog.Description></div><Dialog.Close><IconButton disabled={busy} variant="ghost" color="gray" aria-label="Đóng form gửi yêu cầu"><Cross2Icon /></IconButton></Dialog.Close></div>
      <form onSubmit={submit} className={s.dialogForm}><div className={s.dialogBody}>
        {formError && <p className={s.error} role="alert">{formError}</p>}
        {!suspended && <label className={s.formField}>Loại yêu cầu<Select.Root size="3" value={kind} onValueChange={value => setKind(value as "MESSAGE" | "FEEDBACK")} disabled={busy}><Select.Trigger /><Select.Content position="popper"><Select.Item value="MESSAGE">Hỗ trợ sử dụng, gói dịch vụ, thanh toán</Select.Item><Select.Item value="FEEDBACK">Góp ý / phản hồi</Select.Item></Select.Content></Select.Root></label>}
        <label className={s.formField}>Tiêu đề<TextField.Root size="3" required maxLength={suspended ? 200 : 180} value={subject} disabled={busy} onChange={e => setSubject(e.target.value)} placeholder="Tóm tắt vấn đề cần hỗ trợ" /></label>
        <label className={s.formField}>Nội dung<TextArea size="3" required rows={7} maxLength={10000} value={content} disabled={busy} onChange={e => setContent(e.target.value)} placeholder="Mô tả vấn đề, thời điểm xảy ra và thông tin cần kiểm tra…" /></label><span className={s.characterCount}>{content.length.toLocaleString("vi-VN")} / 10.000 ký tự</span>
      </div><div className={s.dialogFooter}><Dialog.Close><Button type="button" variant="outline" color="gray" disabled={busy}>Hủy</Button></Dialog.Close><Button type="submit" loading={busy} disabled={busy || !subject.trim() || !content.trim()}>Gửi yêu cầu</Button></div></form>
    </Dialog.Content></Dialog.Root>
  </main>;
}
