import RowActions from "../../../shared/ui/RowActions";
import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { DataPage } from "../../../shared/api/page";
import { useRef, useState, type FormEvent } from "react";
import { AlertDialog, Badge, Button, Callout, Card, Dialog, Flex, Select, Table, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon, PlusIcon, DashboardIcon, ExclamationTriangleIcon, PersonIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { archiveSchoolClass, createSchoolClass, restoreSchoolClass } from "../api/schoolApi";
import type { SchoolClassRequest, SchoolClassSummary } from "../types";
import { apiMessage } from "../../../shared/lib/apiError";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import s from "./SchoolClasses.module.css";
import ClassManagementArt from "./ClassManagementArt";
import { ClassTableLoading } from "./SchoolLoading";
import { FormField } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";

type ClassStatistics = {
  activeClasses: number; unassignedClasses: number; averageSize: number; minimumSize: number; maximumSize: number;
  enrolledStudents: number; multiClassStudents: number;
  grades: { gradeLevel: number; classCount: number; averageSize: number }[];
  needsAttention: { id: string; name: string; gradeLevel: number; studentCount: number }[];
};
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

const blankClass = (): SchoolClassRequest => {
  const today = new Date();
  const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return { name: "", gradeLevel: 10, schoolYear: `${year}-${year + 1}`, subject: "Vật lý" };
};

export default function SchoolClasses() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const schoolId = useSessionStore(state => state.user?.schoolId);
  const actorRole = useSessionStore(state => state.user?.role);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [schoolYear, setSchoolYear] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [classPage, setClassPage] = useState(1);
  const [classPageSize, setClassPageSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusTarget, setStatusTarget] = useState<SchoolClassSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<SchoolClassRequest>(blankClass);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const createLock = useRef(false);

  const submitClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!schoolId || busy || createLock.current) return;
    createLock.current = true; setBusy(true); setFormError(""); setNotice("");
    try {
      const created = await createSchoolClass(schoolId, { ...form, name: form.name.trim(), schoolYear: form.schoolYear.trim(), subject: form.subject.trim() });
      load();
      setQuery(""); setGrade("ALL"); setSchoolYear("ALL"); setStatus("ACTIVE"); setClassPage(1);
      setShowCreate(false); setForm(blankClass());
      setNotice(`Đã tạo lớp ${created.name}. Bạn có thể chọn Sửa để phân công giáo viên và thêm học sinh.`);
    } catch (err) {
      setFormError(apiMessage(err, "Không thể tạo lớp học."));
    } finally {
      createLock.current = false; setBusy(false);
    }
  };

  const search = useDebouncedValue(query);
  const params = new URLSearchParams({ page: String(classPage - 1), size: String(classPageSize), query: search, year: schoolYear, status });
  if (grade !== "ALL") params.set("grade", grade);
  const resource = useResource<DataPage<SchoolClassSummary> & { years: string[] }>(`/schools/${schoolId}/classes/page?${params}`, Boolean(schoolId));
  const total = resource.data?.totalElements ?? 0;
  const years = resource.data?.years ?? [];
  const loading = resource.loading;
  const statistics = useResource<ClassStatistics>(`/schools/${schoolId}/classes/statistics`, Boolean(schoolId));
  const stats = statistics.data;
  const load = () => { void resource.refresh(); void statistics.refresh(); };
  const classPageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentClassPage = resource.data ? resource.data.page + 1 : classPage;
  const classPageStart = (currentClassPage - 1) * classPageSize;
  const visibleClasses = resource.data?.items ?? [];

  const updateQuery = (value: string) => { setQuery(value); setClassPage(1); };
  const updateGrade = (value: string) => { setGrade(value); setClassPage(1); };
  const updateSchoolYear = (value: string) => { setSchoolYear(value); setClassPage(1); };

  const confirmStatusChange = async () => {
    if (!schoolId || !statusTarget || busy) return;
    const target = statusTarget;
    setStatusTarget(null);
    setBusy(true);
    setError(""); setNotice("");
    try {
      if (target.active) {
        await archiveSchoolClass(schoolId, target.id);
        load();
        setNotice(`Đã xóa lớp ${target.name}. Có thể mở lại trong bộ lọc Đã xóa.`);
      } else {
        const restored = await restoreSchoolClass(schoolId, target.id);
        load();
        setStatus("ACTIVE"); setClassPage(1);
        setNotice(`Đã mở lại lớp ${restored.name}. Chọn Sửa để phân công giáo viên và xếp học sinh lại.`);
      }
    } catch (err) {
      setError(apiMessage(err, target.active ? "Không thể xóa lớp học." : "Không thể mở lại lớp học."));
    } finally {
      setBusy(false);
    }
  };

  if (!schoolId) return null;

  return <div className={`admin-content ${s.managementPage}`}>
    <header className={s.feature}>
      <div className={s.featureCopy}>
        <span className={s.eyebrow}>KHÔNG GIAN LỚP HỌC</span>
        <h1>Quản lý lớp học</h1>
        <p>Sắp xếp lớp, phân công giáo viên và theo dõi học sinh trong trường.</p>
        <div className={s.featureActions}>
          {actorRole === "SCHOOL" && <Button disabled={busy || loading} onClick={() => { setForm(blankClass()); setFormError(""); setNotice(""); setShowCreate(true); }}><PlusIcon />Tạo lớp học</Button>}
          <span>{loading ? "Đang tải danh sách…" : `${total.toLocaleString("vi-VN")} lớp ${status === "ACTIVE" ? "đang hoạt động" : status === "INACTIVE" ? "đã xóa" : "phù hợp bộ lọc"}`}</span>
        </div>
      </div>
      <ClassManagementArt className={s.featureArt} />
    </header>
    {notice && <Callout.Root color="green" role="status" mb="4"><Callout.Text>{notice}</Callout.Text></Callout.Root>}
    {(error || resource.error) && <div className="admin-error-banner" role="alert">{error || resource.error}<Button variant="soft" color="red" onClick={() => void load()}>Tải lại</Button></div>}

    <section className={s.statistics} aria-label="Thống kê lớp đang hoạt động" aria-busy={statistics.loading}>
      {[
        { title: "Lớp đang hoạt động", value: stats?.activeClasses, detail: stats?.grades.map(item => `Khối ${item.gradeLevel}: ${item.classCount} lớp`).join(" · ") || "Chưa có lớp hoạt động", icon: <DashboardIcon /> },
        { title: "Chưa phân công giáo viên", value: stats?.unassignedClasses, detail: stats?.unassignedClasses ? "Cần phân công giáo viên phụ trách" : "Đã phân công đầy đủ", icon: <ExclamationTriangleIcon /> },
        { title: "Sĩ số trung bình", value: stats?.averageSize, detail: stats?.activeClasses ? `Từ ${stats.minimumSize} đến ${stats.maximumSize} học sinh/lớp` : "Chưa có dữ liệu sĩ số", icon: <PersonIcon /> },
        { title: "Học sinh đã xếp lớp", value: stats?.enrolledStudents, detail: stats?.multiClassStudents ? `${number(stats.multiClassStudents)} em đang học nhiều lớp` : "Học sinh riêng biệt trong các lớp", icon: <PersonIcon /> },
      ].map(item => <article key={item.title} className={s.statCard}><span className={s.statIcon}>{item.icon}</span><span>{item.title}</span><strong>{item.value === undefined ? "—" : number(item.value)}</strong><small>{item.value === undefined ? "Đang tải số liệu…" : item.detail}</small></article>)}
    </section>
    {statistics.error && <div role="alert" className="admin-error-banner">Không thể tải thống kê lớp học.<Button variant="soft" onClick={() => void statistics.refresh()}>Thử lại</Button></div>}
    <div className={s.directoryLayout}>
    <motion.div className="school-classes-grid" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>
      <Card asChild size="3"><section className={`admin-panel ${s.listPanel}`}>
        <div className={s.listHeading}><h2>Danh sách lớp học</h2><span>Chọn lớp để xem thành viên và bảng điểm</span></div>

        <div className={`${s.filters} ${s.classFilters}`}>
          <TextField.Root type="search" value={query} onChange={event => updateQuery(event.target.value)} placeholder="Tìm theo tên lớp hoặc môn học…" aria-label="Tìm lớp học">
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
          <Select.Root value={grade} onValueChange={updateGrade}>
            <Select.Trigger aria-label="Lọc theo khối" />
            <Select.Content><Select.Item value="ALL">Tất cả khối</Select.Item>{[10, 11, 12].map(value => <Select.Item key={value} value={String(value)}>Khối {value}</Select.Item>)}</Select.Content>
          </Select.Root>
          <Select.Root value={schoolYear} onValueChange={updateSchoolYear}>
            <Select.Trigger aria-label="Lọc theo năm học" />
            <Select.Content><Select.Item value="ALL">Tất cả năm học</Select.Item>{years.map(value => <Select.Item key={value} value={value}>{value}</Select.Item>)}</Select.Content>
          </Select.Root>
          <Select.Root value={status} disabled={busy} onValueChange={value => { setStatus(value); setClassPage(1); }}>
            <Select.Trigger aria-label="Lọc theo trạng thái lớp" />
            <Select.Content position="popper"><Select.Item value="ACTIVE">Đang hoạt động</Select.Item><Select.Item value="INACTIVE">Đã xóa</Select.Item><Select.Item value="ALL">Tất cả trạng thái</Select.Item></Select.Content>
          </Select.Root>
        </div>

        {loading ? <ClassTableLoading headers={["Lớp", "Khối", "Năm học", "Môn học", "Giáo viên", "Học sinh", "Trạng thái", "Thao tác"]} /> : <>
          <div className={`admin-table-scroll ${s.classTable}`}><Table.Root size="2" variant="surface">
            <Table.Header><Table.Row>
              <Table.ColumnHeaderCell>Lớp</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Khối</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Năm học</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Môn học</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Giáo viên</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Học sinh</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Thao tác</Table.ColumnHeaderCell>
            </Table.Row></Table.Header>
            <Table.Body>
              {visibleClasses.length === 0 ? <Table.Row><Table.Cell colSpan={8}><div className={s.empty}>Không tìm thấy lớp phù hợp với bộ lọc.</div></Table.Cell></Table.Row> : visibleClasses.map(item => <Table.Row key={item.id}>
                <Table.RowHeaderCell><div className={s.classIdentity}><span className={s.classSymbol} aria-hidden="true">{item.gradeLevel}</span><span>{item.name}</span></div></Table.RowHeaderCell>
                <Table.Cell><Badge color="indigo" variant="soft">{item.gradeLevel}</Badge></Table.Cell>
                <Table.Cell>{item.schoolYear}</Table.Cell>
                <Table.Cell>{item.subject || "—"}</Table.Cell>
                <Table.Cell>{item.teacherNames?.filter(Boolean).join(", ") || "Chưa phân công"}</Table.Cell>
                <Table.Cell>{item.studentCount}</Table.Cell>
                <Table.Cell><Badge color={item.active ? "green" : "gray"} variant="soft">{item.active ? "Hoạt động" : "Đã xóa"}</Badge></Table.Cell>
                <Table.Cell>{actorRole !== "SCHOOL" ? <span className={s.empty} style={{ padding: 0 }}>—</span> : <RowActions subject={item.name} disabled={busy} actions={item.active ? [
                  { label: "Xem lớp", onSelect: () => navigate(`/school/classes/${item.id}`) },
                  { label: "Sửa lớp", onSelect: () => navigate(`/school/classes/${item.id}?mode=edit`) },
                  { label: "Xóa lớp", danger: true, onSelect: () => setStatusTarget(item) },
                ] : [{ label: "Mở lại", onSelect: () => setStatusTarget(item) }]} />}</Table.Cell>
              </Table.Row>)}
            </Table.Body>
          </Table.Root></div>
          {total > 0 && <Pagination start={classPageStart} pageSize={classPageSize} total={total} page={currentClassPage} pageCount={classPageCount} onPageChange={setClassPage} onPageSizeChange={value => { setClassPageSize(value); setClassPage(1); }} />}
        </>}
      </section></Card>

    </motion.div>
    <aside className={s.insights} aria-label="Phân tích lớp đang hoạt động">
      <section className={s.insightCard}><h2>Sĩ số trung bình theo khối</h2><p>Học sinh / lớp · toàn trường</p>
        {stats?.grades.length ? stats.grades.map(item => <div key={item.gradeLevel} className={s.gradeSize}><div><span>Khối {item.gradeLevel}</span><strong>{number(item.averageSize)}</strong></div><div className={s.barTrack}><span style={{ width: `${Math.max(0, item.averageSize / Math.max(...stats.grades.map(grade => grade.averageSize), 1) * 100)}%` }} /></div></div>) : <p className={s.insightEmpty}>{statistics.loading ? "Đang tải số liệu…" : statistics.error ? "Chưa tải được số liệu." : "Chưa có lớp đang hoạt động."}</p>}
      </section>
      <section className={s.insightCard}><h2>Cần chú ý</h2>
        {stats?.needsAttention.length ? <>{stats.needsAttention.map(item => <div key={item.id} className={s.attentionItem}><span className={s.gradeTag}>{item.gradeLevel}</span><div><strong>{item.name}</strong><span>Chưa có giáo viên</span><small>{number(item.studentCount)} học sinh</small></div><Button size="1" variant="outline" color="orange" onClick={() => navigate(`/school/classes/${item.id}?mode=edit`)}>Phân công</Button></div>)}{stats.unassignedClasses > stats.needsAttention.length && <p>Còn {stats.unassignedClasses - stats.needsAttention.length} lớp chưa phân công khác.</p>}</> : <div className={s.insightEmpty}><CheckCircledIcon /><span>{statistics.loading ? "Đang kiểm tra…" : statistics.error ? "Chưa tải được số liệu." : stats?.activeClasses ? "Các lớp đang hoạt động đã có giáo viên phụ trách." : "Chưa có lớp cần phân công."}</span></div>}
      </section>
    </aside>
    </div>

    <Dialog.Root open={showCreate} onOpenChange={open => { if (!createLock.current) setShowCreate(open); }}>
      <Dialog.Content className={modal.dialog} maxWidth="620px" onEscapeKeyDown={event => { if (createLock.current) event.preventDefault(); }} onInteractOutside={event => { if (createLock.current) event.preventDefault(); }}>
        <div className={modal.body}>
          <Dialog.Title>Tạo lớp học</Dialog.Title>
          <Dialog.Description size="2" mb="5">Nhập thông tin lớp. Sau khi tạo, bạn có thể phân công giáo viên và thêm học sinh.</Dialog.Description>
          {formError && <Callout.Root color="red" role="alert" mb="4"><Callout.Text>{formError}</Callout.Text></Callout.Root>}
          <form className="admin-form-grid" onSubmit={submitClass}>
            <FormField label="Tên lớp" htmlFor="create-class-name"><input id="create-class-name" required maxLength={100} disabled={busy} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: 10A1" /></FormField>
            <FormField label="Khối" htmlFor="create-class-grade"><Select.Root size="3" value={String(form.gradeLevel)} disabled={busy} onValueChange={value => setForm({ ...form, gradeLevel: Number(value) })}><Select.Trigger id="create-class-grade" /><Select.Content position="popper" align="start">{[10, 11, 12].map(value => <Select.Item key={value} value={String(value)}>Khối {value}</Select.Item>)}</Select.Content></Select.Root></FormField>
            <FormField label="Năm học" htmlFor="create-class-year"><input id="create-class-year" required maxLength={20} pattern="[0-9]{4}-[0-9]{4}" title="Nhập năm học dạng 2026-2027" disabled={busy} value={form.schoolYear} onChange={event => setForm({ ...form, schoolYear: event.target.value })} /></FormField>
            <FormField label="Môn học" htmlFor="create-class-subject"><input id="create-class-subject" maxLength={50} disabled={busy} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></FormField>
            <div className="admin-form-actions"><Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => setShowCreate(false)}>Hủy</Button><Button type="submit" loading={busy} disabled={busy}>Tạo lớp</Button></div>
          </form>
        </div>
      </Dialog.Content>
    </Dialog.Root>

    <AlertDialog.Root open={statusTarget !== null} onOpenChange={open => { if (!open) setStatusTarget(null); }}><AlertDialog.Content maxWidth="480px"><AlertDialog.Title>{statusTarget?.active ? "Xóa lớp học?" : "Mở lại lớp học?"}</AlertDialog.Title><AlertDialog.Description size="2">{statusTarget?.active ? `Lớp “${statusTarget.name}” sẽ được xóa khỏi danh sách đang hoạt động. Phân công giáo viên sẽ được gỡ và xếp lớp học sinh sẽ kết thúc. Bài tập, bài nộp và điểm vẫn được lưu trữ; bạn có thể mở lại lớp.` : `Lớp “${statusTarget?.name}” sẽ hoạt động trở lại. Bạn cần phân công giáo viên và xếp học sinh lại; các phân công cũ không tự động khôi phục.`}</AlertDialog.Description><Flex gap="3" mt="4" justify="end"><AlertDialog.Cancel><Button variant="soft" color="gray">Hủy</Button></AlertDialog.Cancel><AlertDialog.Action><Button color={statusTarget?.active ? "red" : "green"} disabled={busy} onClick={() => void confirmStatusChange()}>{statusTarget?.active ? "Xóa lớp" : "Mở lại lớp"}</Button></AlertDialog.Action></Flex></AlertDialog.Content></AlertDialog.Root>
  </div>;
}

function Pagination({ start, pageSize, total, page, pageCount, onPageChange, onPageSizeChange, compact = false }: Readonly<{ start: number; pageSize: number; total: number; page: number; pageCount: number; onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void; compact?: boolean }>) {
  return <div className={`${s.pagination} ${compact ? s.compactPagination : ""}`}>
    <span>Hiển thị {start + 1}–{Math.min(start + pageSize, total)} / {total}</span>
    <div>{onPageSizeChange && <label className={s.pageSize}>Số dòng/trang<select aria-label="Số lớp mỗi trang" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>{[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>}<Button type="button" size="1" variant="soft" color="gray" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>Trước</Button><span>Trang {page}/{pageCount}</span><Button type="button" size="1" variant="soft" color="gray" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))}>Sau</Button></div>
  </div>;
}
