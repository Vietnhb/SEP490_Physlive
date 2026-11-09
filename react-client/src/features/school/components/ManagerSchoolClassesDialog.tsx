import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { DataPage } from "../../../shared/api/page";
import { useState } from "react";
import { Badge, Button, Dialog, Flex, IconButton, Select, Table, TextField } from "@radix-ui/themes";
import { ArrowLeftIcon, Cross2Icon, MagnifyingGlassIcon, ReloadIcon } from "@radix-ui/react-icons";
import type { SchoolClassOverview, SchoolClassSummary } from "../types";
import { CardLoadingSkeleton, TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import s from "./ManagerSchoolClassesDialog.module.css";

type Props = { school: { id: string; name: string } | null; onClose: () => void };
const PAGE_SIZE = 10;
const headers = ["Lớp", "Khối", "Năm học", "Giáo viên", "Học sinh", "Trạng thái", "Chi tiết"];

export default function ManagerSchoolClassesDialog({ school, onClose }: Readonly<Props>) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SchoolClassSummary | null>(null);
  const schoolId = school?.id;
  const classId = selected?.id;

  const search = useDebouncedValue(query);
  const params = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE), query: search, year, status });
  if (grade !== "ALL") params.set("grade", grade);
  const roster = useResource<DataPage<SchoolClassSummary> & { years: string[]; totalClasses: number; activeClasses: number }>(`/schools/${schoolId}/classes/page?${params}`, Boolean(schoolId));
  const overview = useResource<SchoolClassOverview>(`/schools/${schoolId}/classes/${classId}/overview`, Boolean(schoolId && classId));
  const items = roster.data?.items ?? [];
  const years = roster.data?.years ?? [];
  const total = roster.data?.totalElements ?? 0;
  const pages = Math.max(1, roster.data?.totalPages ?? 1);
  const currentPage = roster.data ? roster.data.page + 1 : page, start = (currentPage - 1) * PAGE_SIZE;
  const loading = roster.loading, error = roster.error;
  const detail = overview.data, detailLoading = overview.loading, detailError = overview.error;
  const openClass = (item: SchoolClassSummary) => setSelected(item);
  const retryList = roster.refresh, retryDetail = overview.refresh;

  return <Dialog.Root open={!!school} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Content maxWidth="1100px" className={modal.dialog} style={{ width: "min(1100px, calc(100vw - 32px))" }}>
      <header className={s.header}>
        <Flex justify="between" align="start" gap="3"><div><Dialog.Title mb="1">{selected ? "Chi tiết lớp học" : "Lớp học của trường"}</Dialog.Title><Dialog.Description>{school?.name}</Dialog.Description></div><Flex align="center" gap="3"><Badge color="gray">Chỉ xem</Badge><Dialog.Close><IconButton variant="ghost" color="gray" aria-label="Đóng danh sách lớp học"><Cross2Icon /></IconButton></Dialog.Close></Flex></Flex>
      </header>
      <div className={modal.body}>
        {selected ? <>
          <Button variant="ghost" mb="4" onClick={() => setSelected(null)}><ArrowLeftIcon />Quay lại danh sách lớp</Button>
          {detailLoading ? <CardLoadingSkeleton cards={2} label="Đang tải chi tiết lớp học…" /> : detailError ? <div role="alert" className={s.error}><p>{detailError}</p><Button variant="soft" onClick={retryDetail}>Thử lại</Button></div> : detail && <>
            <Flex justify="between" align="center" gap="3" wrap="wrap" mb="4"><h3 className={s.className}>{detail.name}</h3><Badge color={detail.active ? "green" : "gray"}>{detail.active ? "Hoạt động" : "Đã tắt"}</Badge></Flex>
            <dl className={s.facts}><div><dt>Khối</dt><dd>{detail.gradeLevel}</dd></div><div><dt>Năm học</dt><dd>{detail.schoolYear}</dd></div><div><dt>Môn học</dt><dd>{detail.subject || "Chưa cập nhật"}</dd></div><div><dt>Học sinh đang xếp lớp</dt><dd>{detail.studentCount.toLocaleString("vi-VN")} học sinh</dd></div></dl>
            <section aria-labelledby="manager-class-teachers"><h3 id="manager-class-teachers" className={s.sectionTitle}>Giáo viên phụ trách <Badge color="gray">{detail.teachers.length}</Badge></h3>
              {detail.teachers.length === 0 ? <p className={s.empty}>Chưa có giáo viên đang được phân công.</p> : <ul className={s.teachers}>{detail.teachers.map(teacher => <li key={teacher.id}><span className={s.avatar} aria-hidden="true">{teacher.fullName.trim().charAt(0).toLocaleUpperCase("vi") || "G"}</span><div><strong>{teacher.fullName}</strong><span>{teacher.email}</span></div></li>)}</ul>}
            </section>
          </>}
        </> : <>
          <Flex justify="between" align="center" gap="3" wrap="wrap" mb="4"><span className={s.caption}>{loading ? "Đang tải danh sách lớp…" : `${roster.data?.totalClasses ?? 0} lớp · ${roster.data?.activeClasses ?? 0} đang hoạt động`}</span><Button variant="outline" disabled={loading} onClick={retryList}><ReloadIcon />Làm mới</Button></Flex>
          <div className={s.filters}>
            <TextField.Root aria-label="Tìm lớp học" placeholder="Tìm tên lớp hoặc môn học…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root>
            <Select.Root value={grade} onValueChange={value => { setGrade(value); setPage(1); }}><Select.Trigger aria-label="Khối lớp" /><Select.Content position="popper"><Select.Item value="ALL">Tất cả khối</Select.Item>{[10, 11, 12].map(value => <Select.Item key={value} value={String(value)}>Khối {value}</Select.Item>)}</Select.Content></Select.Root>
            <Select.Root value={year} onValueChange={value => { setYear(value); setPage(1); }}><Select.Trigger aria-label="Năm học" /><Select.Content position="popper"><Select.Item value="ALL">Tất cả năm học</Select.Item>{years.map(value => <Select.Item key={value} value={value}>{value}</Select.Item>)}</Select.Content></Select.Root>
            <Select.Root value={status} onValueChange={value => { setStatus(value); setPage(1); }}><Select.Trigger aria-label="Trạng thái lớp" /><Select.Content position="popper"><Select.Item value="ALL">Tất cả trạng thái</Select.Item><Select.Item value="ACTIVE">Hoạt động</Select.Item><Select.Item value="INACTIVE">Đã tắt</Select.Item></Select.Content></Select.Root>
          </div>
          {loading ? <TableLoadingSkeleton headers={headers} /> : error ? <div role="alert" className={s.error}><p>{error}</p><Button variant="soft" onClick={retryList}>Thử lại</Button></div> : <>
            <Table.Root className={`${tableScroll.viewport} ${s.table}`} size="2" variant="surface"><Table.Header><Table.Row>{headers.map(header => <Table.ColumnHeaderCell key={header}>{header}</Table.ColumnHeaderCell>)}</Table.Row></Table.Header><Table.Body>
              {items.map(item => <Table.Row key={item.id}><Table.Cell>{item.name}</Table.Cell><Table.Cell>{item.gradeLevel}</Table.Cell><Table.Cell>{item.schoolYear}</Table.Cell><Table.Cell>{item.teacherCount}</Table.Cell><Table.Cell>{item.studentCount}</Table.Cell><Table.Cell><Badge color={item.active ? "green" : "gray"}>{item.active ? "Hoạt động" : "Đã tắt"}</Badge></Table.Cell><Table.Cell><Button size="1" variant="soft" onClick={() => openClass(item)} aria-label={`Xem lớp ${item.name}`}>Xem</Button></Table.Cell></Table.Row>)}
              {total === 0 && <Table.Row><Table.Cell colSpan={headers.length} className={s.empty}>{years.length === 0 ? "Trường chưa có lớp học." : "Không tìm thấy lớp phù hợp với bộ lọc."}</Table.Cell></Table.Row>}
            </Table.Body></Table.Root>
            <Flex justify="between" align="center" gap="3" wrap="wrap" mt="4" className={s.pagination}><span aria-live="polite">{total ? `Hiển thị ${start + 1}–${Math.min(start + PAGE_SIZE, total)} / ${total} lớp` : "0 lớp"}</span><Flex align="center" gap="3"><Button size="1" variant="soft" disabled={currentPage <= 1} onClick={() => setPage(value => value - 1)}>Trước</Button><span>Trang {currentPage}/{pages}</span><Button size="1" variant="soft" disabled={currentPage >= pages} onClick={() => setPage(value => value + 1)}>Sau</Button></Flex></Flex>
          </>}
        </>}
      </div>
      <footer className={s.footer}><Dialog.Close><Button variant="soft" color="gray">Đóng</Button></Dialog.Close></footer>
    </Dialog.Content>
  </Dialog.Root>;
}
