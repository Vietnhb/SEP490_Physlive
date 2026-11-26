import { useResource } from "../../../shared/hooks/operationsData";
import { AppealEvidenceGallery } from "../../account/components/AppealEvidence";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Dialog, Flex, Select, TextArea, TextField } from "@radix-ui/themes";
import { resolveAppeal, type Appeal } from "../../account/api/appealApi";
import { updateSupportItem, type SupportItem } from "../api/supportApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import "../styles/support-pages.css";
import RefreshButton from "../../../shared/ui/RefreshButton";
import LearningIcon from "../../../shared/ui/LearningIcon";
import filters from "../styles/SupportFilters.module.css";
import styles from "./SchoolUnlockRequests.module.css";
import ms from "./ManagerSupport.module.css";
import { UnlockStatistics, UnlockMonthlyChart, type SchoolAppealStatistics } from "../components/SchoolUnlockAnalytics";
import UnlockRequestsArt from "../components/UnlockRequestsArt";
import ManagerSupportArt from "../components/ManagerSupportArt";
import { MagnifyingGlassIcon, ArrowRightIcon, PersonIcon } from "@radix-ui/react-icons";

const KINDS = { COMPLAINT: "Báo lỗi mô phỏng", MESSAGE: "Yêu cầu hỗ trợ", FEEDBACK: "Góp ý", ACCOUNT: "Yêu cầu mở khóa" };
const STATUS: Record<string, string> = { OPEN: "Chờ xử lý", READ: "Đang xử lý", RESOLVED: "Đã hoàn tất", PENDING: "Chờ xử lý", APPROVED: "Đã duyệt mở khóa", REJECTED: "Đã từ chối" };
type Entry = {
  key: string;
  id: string;
  kind: keyof typeof KINDS;
  subject: string;
  content: string;
  sender: string;
  email: string;
  createdAt: string;
  completedAt?: string | null;
  status: string;
  response?: string | null;
  support?: SupportItem;
  appeal?: Appeal;
};
type Handler = "ALL" | "MANAGER" | "SCHOOL" | "REVIEWER";
type InboxPayload = { support: SupportItem[]; appeals: Appeal[]; totalElements: number; totalPages: number; page: number };

function toEntries(payload?: InboxPayload): Entry[] {
  const items = payload?.support ?? [];
  const appeals = payload?.appeals ?? [];
  return [
    ...items.map(item => ({
      key: `support:${item.id}`,
      id: item.id,
      kind: item.kind,
      subject: item.subject,
      content: item.content,
      sender: item.senderName,
      email: item.senderEmail,
      createdAt: item.createdAt,
      completedAt: item.respondedAt ?? null,
      status: item.status,
      response: item.adminResponse,
      support: item,
    })),
    ...appeals.map(item => ({
      key: `account:${item.id}`,
      id: item.id,
      kind: "ACCOUNT" as const,
      subject: item.reason,
      content: item.content,
      sender: item.userName,
      email: item.userEmail,
      createdAt: item.createdAt,
      completedAt: item.resolvedAt ?? null,
      status: item.status,
      response: item.resolutionNote,
      appeal: item,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

function ownerOf(item: Entry): { label: string; group: "MANAGER" | "SCHOOL" | "REVIEWER" } {
  if (item.kind === "COMPLAINT") return { label: "Kiểm duyệt xử lý", group: "REVIEWER" };
  if (item.appeal) {
    return item.appeal.authority === "SCHOOL"
      ? { label: "Nhà trường xử lý", group: "SCHOOL" }
      : { label: "Cấp hệ thống", group: "MANAGER" };
  }
  return { label: "Vận hành quản lý", group: "MANAGER" };
}

function isDoneStatus(status: string): boolean {
  return ["RESOLVED", "APPROVED", "REJECTED"].includes(status);
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

function StatusPillIcon({ status }: Readonly<{ status: string }>) {
  if (status === "REJECTED") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </svg>
    );
  }
  if (isDoneStatus(status)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
      </svg>
    );
  }
  if (status === "READ") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 4.1 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

function buildSparkline(values: number[]): { line: string; area: string } | null {
  if (values.length < 2 || values.every(v => v === 0)) return null;
  const w = 120;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 3 - ((v - min) / span) * (h - 8),
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}

function formatAvgResponse(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return "< 1 giờ";
  if (hours < 24) return `${Math.round(hours)} giờ`;
  return `${(hours / 24).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ngày`;
}

export default function SupportInbox({ schoolOnly = false }: { schoolOnly?: boolean }) {
  const [params] = useSearchParams();
  const [kind, setKind] = useState(schoolOnly ? "ACCOUNT" : params.get("kind") ?? "ALL");
  const [status, setStatus] = useState("ALL");
  const [handler, setHandler] = useState<Handler>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const invalidDates = Boolean(from && to && from > to);
  const activeFilterCount = (!schoolOnly && kind !== "ALL" ? 1 : 0)
    + (!schoolOnly && handler !== "ALL" ? 1 : 0)
    + (status !== "ALL" ? 1 : 0)
    + (from ? 1 : 0)
    + (to ? 1 : 0);
  const hasFilters = Boolean(query || activeFilterCount > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [response, setResponse] = useState("");
  const lock = useRef(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const resetPage = () => { setPage(1); tableRef.current?.scrollTo({ top: 0 }); };
  const search = useDebouncedValue(query);
  const inboxParams = new URLSearchParams({ page: String(page - 1), size: String(pageSize), kind: schoolOnly ? "ACCOUNT" : kind, handler, status, query: search });
  if (from) inboxParams.set("from", from);
  if (to) inboxParams.set("to", to);

  const resource = useResource<InboxPayload>("/support/inbox?" + inboxParams, !invalidDates);
  const overviewResource = useResource<InboxPayload>("/support/inbox?page=0&size=100&kind=ALL&handler=ALL&status=ALL", !schoolOnly);
  const statistics = useResource<SchoolAppealStatistics>("/support/inbox/school-statistics", schoolOnly);

  const loading = !invalidDates && resource.loading && resource.data === undefined;
  const load = () => {
    void resource.refresh();
    if (schoolOnly) void statistics.refresh();
    else void overviewResource.refresh();
  };

  const total = resource.data?.totalElements ?? 0;
  const entries = toEntries(resource.data);
  const selected = entries.find(item => item.key === selectedKey);
  const canProcessItem = (item: Entry) => (item.appeal ? item.appeal.canResolve === true : item.kind !== "COMPLAINT");
  const canProcess = !!selected && canProcessItem(selected);
  const done = (item: Entry) => isDoneStatus(item.status);
  const filtered = entries;
  const pages = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;

  // Manager overview analytics derived from latest 100 unfiltered items
  const overviewKnown = overviewResource.data !== undefined;
  const overviewEntries = toEntries(overviewResource.data);
  const nowMs = Date.now();
  const dayMs = 86_400_000;
  const last30 = overviewEntries.filter(item => nowMs - Date.parse(item.createdAt) <= 30 * dayMs);

  const pendingEntries = overviewEntries.filter(item => item.status === "OPEN" || item.status === "PENDING");
  const pendingManager = pendingEntries.filter(item => ownerOf(item).group === "MANAGER").length;
  const inProgressEntries = overviewEntries.filter(item => item.status === "READ");
  const schoolOpenOrProgress = overviewEntries.filter(item => !isDoneStatus(item.status) && ownerOf(item).group === "SCHOOL").length;

  const completedEntries = overviewEntries.filter(item => isDoneStatus(item.status));
  const completedThisWeek = completedEntries.filter(item => nowMs - Date.parse(item.completedAt || item.createdAt) <= 7 * dayMs);
  const completedPrevWeek = completedEntries.filter(item => {
    const age = nowMs - Date.parse(item.completedAt || item.createdAt);
    return age > 7 * dayMs && age <= 14 * dayMs;
  });
  const weekDelta = completedThisWeek.length - completedPrevWeek.length;

  const dailyCompleted = Array.from({ length: 7 }, (_, i) => {
    const start = nowMs - (6 - i) * dayMs;
    const end = start + dayMs;
    return completedEntries.filter(item => {
      const ts = Date.parse(item.completedAt || item.createdAt);
      return ts >= start - dayMs && ts < end;
    }).length;
  });
  const weekSpark = buildSparkline(dailyCompleted);

  const responseHours = completedEntries
    .map(item => {
      if (!item.completedAt) return null;
      const diff = (Date.parse(item.completedAt) - Date.parse(item.createdAt)) / 3_600_000;
      return Number.isFinite(diff) && diff >= 0 ? diff : null;
    })
    .filter((v): v is number => v !== null);
  const avgHours = responseHours.length > 0 ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length : null;

  const kindBreakdown = ([
    { key: "MESSAGE", label: KINDS.MESSAGE },
    { key: "ACCOUNT", label: KINDS.ACCOUNT },
    { key: "FEEDBACK", label: KINDS.FEEDBACK },
    { key: "COMPLAINT", label: KINDS.COMPLAINT },
  ] as const)
    .map(row => ({ ...row, count: last30.filter(item => item.kind === row.key).length }))
    .sort((a, b) => b.count - a.count);
  const maxKindCount = Math.max(1, ...kindBreakdown.map(row => row.count));

  const manager30 = last30.filter(item => ownerOf(item).group === "MANAGER").length;
  const school30 = last30.filter(item => ownerOf(item).group === "SCHOOL").length;
  const reviewer30 = last30.filter(item => ownerOf(item).group === "REVIEWER").length;
  const total30 = last30.length;

  const act = async (action: "READ" | "RESOLVED" | "APPROVED" | "REJECTED") => {
    if (!selected || !canProcess || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (selected.appeal && (action === "APPROVED" || action === "REJECTED")) {
        await resolveAppeal(selected.id, { status: action, resolutionNote: response.trim() });
        load();
      } else if (selected.support && ["READ", "RESOLVED"].includes(action)) {
        await updateSupportItem(selected.id, action as "READ" | "RESOLVED", response.trim());
        load();
      }
      setNotice("Đã lưu kết quả và cập nhật phản hồi cho người gửi.");
      window.dispatchEvent(new Event("physlive:support-updated"));
      setSelectedKey("");
    } catch (err) {
      setError(apiMessage(err, "Không thể cập nhật yêu cầu."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const openItem = (item: Entry) => {
    setSelectedKey(item.key);
    setResponse(item.response ?? "");
    setError("");
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    setHandler("ALL");
    setKind(schoolOnly ? "ACCOUNT" : "ALL");
    resetPage();
  };

  const detailDialog = (
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open && !lock.current) setSelectedKey(""); }}>
      <Dialog.Content maxWidth="700px" className={modal.dialog}>
        <div className={modal.body}>
          <Dialog.Title>{selected?.subject}</Dialog.Title>
          <Dialog.Description>{selected?.sender} · {selected?.email}</Dialog.Description>
          <p><Badge>{selected ? KINDS[selected.kind] : ""}</Badge> {selected ? STATUS[selected.status] : ""}</p>
          <p className="support-body">{selected?.content}</p>
          {selected && !canProcess && <p>Chỉ xem. {selected.kind === "COMPLAINT" ? "Người kiểm duyệt tiếp nhận và xử lý trực tiếp báo lỗi mô phỏng." : selected.appeal?.authority === "SCHOOL" ? "Nhà trường chịu trách nhiệm xem xét quyết định khóa này." : "Yêu cầu không thuộc quyền xử lý hoặc quyết định khóa đã thay đổi."}</p>}
          {selected?.response && <div className="support-panel"><strong>Phản hồi{selected.support?.responderName ? ` (${selected.support.responderName})` : ""}</strong><p className="support-body">{selected.response}</p></div>}
          {selected?.appeal && <AppealEvidenceGallery key={selected.appeal.id} appealId={selected.appeal.id} />}
          {error && <p role="alert" className="admin-error-banner">{error}</p>}
          {selected && canProcess && (!selected.appeal || selected.status === "PENDING") && <label className="support-field">Phản hồi / lý do xử lý<TextArea rows={4} maxLength={10000} disabled={busy} value={response} onChange={e => setResponse(e.target.value)} /></label>}
          <Flex justify="end" gap="3" wrap="wrap">
            <Button variant="soft" color="gray" disabled={busy} onClick={() => setSelectedKey("")}>Đóng</Button>
            {selected?.appeal && canProcess && selected.status === "PENDING" && <>
              <Button variant="outline" color="red" disabled={busy || !response.trim()} onClick={() => void act("REJECTED")}>Từ chối</Button>
              <Button color="teal" loading={busy} disabled={busy || !response.trim()} onClick={() => void act("APPROVED")}>Duyệt & mở khóa</Button>
            </>}
            {selected?.support && canProcess && <>
              <Button variant="soft" disabled={busy} onClick={() => void act("READ")}>{done(selected) ? "Mở lại xử lý" : "Lưu, tiếp tục xử lý"}</Button>
              {!done(selected) && <Button color="teal" loading={busy} disabled={busy || !response.trim()} onClick={() => void act("RESOLVED")}>Phản hồi & hoàn tất</Button>}
            </>}
          </Flex>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );

  if (schoolOnly) {
    return (
      <main className={`support-page support-page--manager ${styles.page}`}>
        <RefreshButton onClick={() => void load()} disabled={loading || busy || invalidDates} />
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>HỖ TRỢ TÀI KHOẢN</span>
            <h1>Yêu cầu mở khóa</h1>
            <p>Xem xét và phản hồi yêu cầu của giáo viên, học sinh do nhà trường tạm khóa.</p>
            <span className={styles.total}>{loading ? "Đang tải danh sách…" : `${total.toLocaleString("vi-VN")} yêu cầu phù hợp`}</span>
          </div>
          <UnlockRequestsArt className={styles.art} />
        </header>

        {notice && <p role="status" className="support-success">{notice}</p>}
        {(error || resource.error) && !selected && <p role="alert" className="admin-error-banner">{error || resource.error}</p>}
        <UnlockStatistics data={statistics.data ?? undefined} loading={statistics.loading} />
        {statistics.error && <div role="alert" className="admin-error-banner">Không thể tải thống kê yêu cầu.<Button variant="soft" onClick={() => void statistics.refresh()}>Thử lại</Button></div>}

        <div className={styles.inboxLayout}>
          <section className={`support-panel ${styles.panel}`}>
            <div className={styles.sectionHeading}><h2>Danh sách yêu cầu</h2><span>Tra cứu đơn và kết quả xử lý</span></div>
            <div className={filters.filters} role="group" aria-label="Bộ lọc yêu cầu">
              <label className={filters.field + " " + filters.search}>Tìm kiếm<TextField.Root type="search" aria-label="Tìm yêu cầu" placeholder="Tìm tên, email, tiêu đề…" value={query} onChange={e => { setQuery(e.target.value); resetPage(); }}><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root></label>
              <label className={filters.field}>Trạng thái<Select.Root value={status} onValueChange={value => { setStatus(value); resetPage(); }}><Select.Trigger aria-label="Trạng thái" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item><Select.Item value="TODO">Chưa hoàn tất</Select.Item><Select.Item value="DONE">Đã hoàn tất</Select.Item></Select.Content></Select.Root></label>
              <label className={filters.field}>Từ ngày<input type="date" aria-label="Yêu cầu từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); resetPage(); }} /></label>
              <label className={filters.field}>Đến ngày<input type="date" aria-label="Yêu cầu đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); resetPage(); }} /></label>
              <Button variant="outline" disabled={!hasFilters} onClick={clearFilters}>Xóa bộ lọc</Button>
            </div>
            {invalidDates && <p role="alert" className="admin-error-banner">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
            {loading ? <TableLoadingSkeleton headers={["Người gửi", "Tiêu đề", "Trạng thái", "Ngày gửi", "Thao tác"]} /> : (
              <div ref={tableRef} className="support-scroll" role="region" tabIndex={0} aria-label="Danh sách yêu cầu có thể cuộn">
                <table className="support-table">
                  <thead><tr><th>Người gửi</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {filtered.map(item => (
                      <tr key={item.key}>
                        <td><div className={styles.sender}><span className={styles.avatar} aria-hidden="true"><PersonIcon /></span><div><span>{item.sender}</span><small>{item.email}</small></div></div></td>
                        <td><span className={styles.subject} title={item.subject}>{item.subject}</span></td>
                        <td><Badge color={item.status === "REJECTED" ? "red" : done(item) ? "green" : "orange"}>{STATUS[item.status]}</Badge>{item.appeal && <small>{item.appeal.authority === "SCHOOL" ? "Nhà trường xử lý" : "Cấp hệ thống"}</small>}</td>
                        <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                        <td><Button size="1" variant="soft" className={styles.viewButton} onClick={() => openItem(item)}>Xem đơn<ArrowRightIcon /></Button></td>
                      </tr>
                    ))}
                    {total === 0 && <tr><td colSpan={5}><div className={styles.empty}><UnlockRequestsArt className={styles.emptyArt} /><strong>Không có yêu cầu phù hợp</strong><span>{hasFilters ? "Thử thay đổi từ khóa hoặc xóa bộ lọc." : "Yêu cầu mở khóa của giáo viên và học sinh sẽ hiển thị tại đây."}</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <Flex justify="between" align="center" mt="4" gap="3" wrap="wrap">
              <span>{total} yêu cầu</span>
              <Flex align="center" gap="3" wrap="wrap">
                <label className={filters.pageSize}>Số dòng/trang<Select.Root value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); resetPage(); }}><Select.Trigger aria-label="Số yêu cầu mỗi trang" /><Select.Content>{[10, 25, 50].map(value => <Select.Item key={value} value={String(value)}>{value}</Select.Item>)}</Select.Content></Select.Root></label>
                <Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); tableRef.current?.scrollTo({ top: 0 }); }}>Trước</Button>
                <span>Trang {currentPage}/{pages}</span>
                <Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => { setPage(currentPage + 1); tableRef.current?.scrollTo({ top: 0 }); }}>Sau</Button>
              </Flex>
            </Flex>
          </section>
          <UnlockMonthlyChart data={statistics.data ?? undefined} loading={statistics.loading} />
        </div>
        {detailDialog}
      </main>
    );
  }

  return (
    <main className={`admin-content ${ms.page}`}>
      <RefreshButton onClick={load} disabled={resource.refreshing || busy || invalidDates} />

      <header className={ms.heading}>
        <div className={ms.headingText}>
          <h1>Yêu cầu hỗ trợ</h1>
          <p>Xử lý hỗ trợ và quyết định khóa cấp hệ thống; theo dõi đơn do nhà trường và người kiểm duyệt xử lý.</p>
        </div>
        <div className={ms.artWrap}>
          <ManagerSupportArt />
        </div>
      </header>

      {notice && <p role="status" className="support-success">{notice}</p>}
      {(error || resource.error) && !selected && <p role="alert" className="admin-error-banner">{error || resource.error}</p>}

      <section className={ms.stats} aria-label="Chỉ số yêu cầu hỗ trợ">
        <article className={`${ms.stat} ${ms.amber}`}>
          <span className={ms.statIcon}><ClockIcon /></span>
          <span className={ms.statLabel}>Chờ xử lý</span>
          <strong className={ms.statValue}>{overviewKnown ? pendingEntries.length.toLocaleString("vi-VN") : "—"}</strong>
          <span className={ms.statHint}>{overviewKnown ? `${pendingManager.toLocaleString("vi-VN")} vận hành phụ trách` : "Đang tải…"}</span>
        </article>

        <article className={`${ms.stat} ${ms.indigo}`}>
          <span className={ms.statIcon}><LearningIcon name="message" /></span>
          <span className={ms.statLabel}>Đang xử lý</span>
          <strong className={ms.statValue}>{overviewKnown ? inProgressEntries.length.toLocaleString("vi-VN") : "—"}</strong>
          <span className={ms.statHint}>{overviewKnown ? `${schoolOpenOrProgress.toLocaleString("vi-VN")} do nhà trường` : "Đang tải…"}</span>
        </article>

        <article className={`${ms.stat} ${ms.mint}`}>
          <span className={ms.statIcon}><LearningIcon name="check" /></span>
          <span className={ms.statLabel}>Hoàn tất tuần này</span>
          <strong className={ms.statValue}>{overviewKnown ? completedThisWeek.length.toLocaleString("vi-VN") : "—"}</strong>
          <span className={ms.statHint}>
            {overviewKnown
              ? `${weekDelta >= 0 ? "+" : ""}${weekDelta.toLocaleString("vi-VN")} so với tuần trước`
              : "7 ngày qua"}
          </span>
          {weekSpark && (
            <svg className={ms.spark} viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
              <path className={ms.sparkArea} d={weekSpark.area} />
              <path className={ms.sparkLine} d={weekSpark.line} />
            </svg>
          )}
        </article>

        <article className={`${ms.stat} ${ms.indigo}`}>
          <span className={ms.statIcon}><LearningIcon name="chart" /></span>
          <span className={ms.statLabel}>Phản hồi trung bình</span>
          <strong className={ms.statValue}>{overviewKnown ? formatAvgResponse(avgHours) : "—"}</strong>
          <span className={ms.statHint}>Mục tiêu dưới 1 ngày</span>
        </article>
      </section>

      <div className={ms.split}>
        <section className={ms.card} aria-label="Danh sách yêu cầu">
          <div className={ms.toolbar} aria-label="Bộ lọc yêu cầu">
            <TextField.Root
              type="search"
              size="3"
              className={ms.searchField}
              aria-label="Tìm kiếm"
              placeholder="Tìm tên, email, tiêu đề…"
              value={query}
              onChange={e => { setQuery(e.target.value); resetPage(); }}
            >
              <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
            </TextField.Root>
            <Button
              type="button"
              size="2"
              variant={showFilters || activeFilterCount > 0 ? "soft" : "surface"}
              color={showFilters || activeFilterCount > 0 ? "teal" : "gray"}
              aria-expanded={showFilters}
              onClick={() => setShowFilters(v => !v)}
            >
              <FilterIcon />
              Bộ lọc
              {activeFilterCount > 0 && <span className={ms.filterBadge}>{activeFilterCount}</span>}
            </Button>
          </div>

          {showFilters && (
            <div className={ms.filterDrawer} role="group" aria-label="Bộ lọc chi tiết">
              <label className={ms.filterField}>
                Loại yêu cầu
                <Select.Root size="2" value={kind} onValueChange={value => { setKind(value); resetPage(); }}>
                  <Select.Trigger aria-label="Loại yêu cầu" />
                  <Select.Content>
                    <Select.Item value="ALL">Tất cả loại yêu cầu</Select.Item>
                    {Object.entries(KINDS).map(([value, label]) => <Select.Item value={value} key={value}>{label}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              </label>

              <label className={ms.filterField}>
                Bên xử lý
                <Select.Root size="2" value={handler} onValueChange={value => { setHandler(value as Handler); resetPage(); }}>
                  <Select.Trigger aria-label="Bên xử lý" />
                  <Select.Content>
                    <Select.Item value="ALL">Tất cả bên xử lý</Select.Item>
                    <Select.Item value="MANAGER">Vận hành quản lý</Select.Item>
                    <Select.Item value="SCHOOL">Nhà trường quản lý</Select.Item>
                    <Select.Item value="REVIEWER">Kiểm duyệt quản lý</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              <label className={ms.filterField}>
                Trạng thái
                <Select.Root size="2" value={status} onValueChange={value => { setStatus(value); resetPage(); }}>
                  <Select.Trigger aria-label="Trạng thái" />
                  <Select.Content>
                    <Select.Item value="ALL">Tất cả trạng thái</Select.Item>
                    <Select.Item value="TODO">Chưa hoàn tất</Select.Item>
                    <Select.Item value="DONE">Đã hoàn tất</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              <label className={ms.filterField}>
                Từ ngày
                <input className={ms.dateInput} type="date" aria-label="Yêu cầu từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); resetPage(); }} />
              </label>

              <label className={ms.filterField}>
                Đến ngày
                <input className={ms.dateInput} type="date" aria-label="Yêu cầu đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); resetPage(); }} />
              </label>

              <Button type="button" size="2" variant="outline" color="gray" disabled={!hasFilters} onClick={clearFilters}>Xóa bộ lọc</Button>
            </div>
          )}

          {invalidDates && <p role="alert" className="admin-error-banner" style={{ margin: "12px 16px 0" }}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

          {loading ? (
            <TableLoadingSkeleton headers={["Yêu cầu", "Người gửi", "Trạng thái", "Ngày gửi", "Thao tác"]} />
          ) : (
            <div ref={tableRef} className={ms.tableWrap} role="region" tabIndex={0} aria-label="Danh sách yêu cầu có thể cuộn">
              <table className={ms.table}>
                <thead>
                  <tr>
                    <th scope="col">Yêu cầu</th>
                    <th scope="col">Người gửi</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Ngày gửi</th>
                    <th scope="col"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const owner = ownerOf(item);
                    const mine = canProcessItem(item) && !done(item);
                    const statusTone = item.status === "REJECTED"
                      ? ms.statusDanger
                      : done(item)
                        ? ms.statusSuccess
                        : item.status === "READ"
                          ? ms.statusInfo
                          : ms.statusWarn;
                    return (
                      <tr key={item.key}>
                        <th scope="row" className={ms.subjectCell}>
                          <div className={ms.rowSub}>
                            <span className={ms.rowTitle} title={item.subject}>{item.subject}</span>
                            <span className={ms.rowMeta}>{KINDS[item.kind]} · {owner.label}</span>
                          </div>
                        </th>
                        <td>
                          <div className={ms.rowSub}>
                            <span className={ms.rowTitle}>{item.sender}</span>
                            <span className={ms.rowMeta}>{item.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`${ms.statusBadge} ${statusTone}`}>
                            <StatusPillIcon status={item.status} />
                            {STATUS[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className={ms.dateCell}>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td className={ms.actionCell}>
                          <Button
                            type="button"
                            size="2"
                            variant={mine ? "solid" : "surface"}
                            color={mine ? "teal" : "gray"}
                            onClick={() => openItem(item)}
                          >
                            {mine ? "Xử lý" : "Xem"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {total === 0 && (
                    <tr>
                      <td colSpan={5} className={ms.emptyCell}>Không có yêu cầu phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className={ms.pager}>
            <span>{total.toLocaleString("vi-VN")} yêu cầu</span>
            <div className={ms.pagerActions}>
              <label className={ms.pagerSize}>
                Số dòng/trang
                <Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); resetPage(); }}>
                  <Select.Trigger aria-label="Số yêu cầu mỗi trang" />
                  <Select.Content>{[10, 25, 50].map(value => <Select.Item key={value} value={String(value)}>{value}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
              <Button type="button" size="2" variant="surface" color="gray" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); tableRef.current?.scrollTo({ top: 0 }); }}>Trước</Button>
              <span>Trang {currentPage}/{pages}</span>
              <Button type="button" size="2" variant="surface" color="gray" disabled={currentPage >= pages} onClick={() => { setPage(currentPage + 1); tableRef.current?.scrollTo({ top: 0 }); }}>Sau</Button>
            </div>
          </div>
        </section>

        <aside className={ms.insights}>
          <section className={ms.card}>
            <div className={ms.panelHead}>
              <h2>Theo loại yêu cầu</h2>
              <span>30 ngày</span>
            </div>
            <div className={ms.panelBody}>
              {kindBreakdown.map((row, index) => (
                <div key={row.key} className={ms.hrow}>
                  <div className={ms.hrowHead}>
                    <span>{row.label}</span>
                    <strong>{overviewKnown ? row.count.toLocaleString("vi-VN") : "—"}</strong>
                  </div>
                  <span className={ms.bar}>
                    <i
                      className={`${ms.barFill} ${index === 0 ? ms.barFillPrimary : ""}`}
                      style={{ width: `${row.count === 0 ? 0 : Math.max(6, Math.round((row.count / maxKindCount) * 100))}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={ms.card}>
            <div className={ms.panelHead}>
              <h2>Ai xử lý</h2>
              <span>30 ngày qua</span>
            </div>
            <div className={ms.panelBody}>
              <svg
                className={ms.flowSvg}
                viewBox="0 0 270 200"
                role="img"
                aria-label={`${total30} yêu cầu trong 30 ngày được chuyển: vận hành ${manager30}, nhà trường ${school30}, kiểm duyệt ${reviewer30}`}
              >
                <rect x="2" y="78" width="90" height="44" rx="10" fill="var(--gray-3)" stroke="var(--gray-5)" />
                <text x="47" y="97" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--gray-12)">Yêu cầu</text>
                <text x="47" y="112" textAnchor="middle" fontSize="11" fill="var(--gray-10)">{total30.toLocaleString("vi-VN")} yêu cầu</text>

                <path className={ms.flowLine} d="M92 100C132 100 122 30 162 30" stroke="var(--teal-9)" strokeWidth={manager30 > 0 ? 3.5 : 2} />
                <rect x="162" y="8" width="106" height="44" rx="10" fill="var(--color-panel-solid)" stroke="var(--gray-5)" />
                <text x="174" y="27" fontSize="12" fontWeight="600" fill="var(--gray-12)">Vận hành</text>
                <text x="174" y="42" fontSize="11" fill="var(--gray-10)">{manager30.toLocaleString("vi-VN")} yêu cầu</text>

                <path className={ms.flowLine} d="M92 100C132 100 122 100 162 100" stroke="var(--blue-9)" strokeWidth={school30 > 0 ? 2.5 : 1.8} />
                <rect x="162" y="78" width="106" height="44" rx="10" fill="var(--color-panel-solid)" stroke="var(--gray-5)" />
                <text x="174" y="97" fontSize="12" fontWeight="600" fill="var(--gray-12)">Nhà trường</text>
                <text x="174" y="112" fontSize="11" fill="var(--gray-10)">{school30.toLocaleString("vi-VN")} yêu cầu</text>

                <path className={ms.flowLine} d="M92 100C132 100 122 170 162 170" stroke="var(--crimson-9)" strokeWidth={reviewer30 > 0 ? 2.5 : 1.8} />
                <rect x="162" y="148" width="106" height="44" rx="10" fill="var(--color-panel-solid)" stroke="var(--gray-5)" />
                <text x="174" y="167" fontSize="12" fontWeight="600" fill="var(--gray-12)">Kiểm duyệt</text>
                <text x="174" y="182" fontSize="11" fill="var(--gray-10)">{reviewer30.toLocaleString("vi-VN")} yêu cầu</text>
              </svg>
              <p className={ms.flowHint}>Báo lỗi mô phỏng đi thẳng tới kiểm duyệt; khóa tài khoản trong trường do nhà trường quyết.</p>
            </div>
          </section>
        </aside>
      </div>

      {detailDialog}
    </main>
  );
}
