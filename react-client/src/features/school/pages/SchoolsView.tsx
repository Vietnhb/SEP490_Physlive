import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import { useState, type FormEvent } from "react";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { Badge, Button as ThemeButton, Callout, Checkbox, Dialog, Select, Table, Text, TextField } from "@radix-ui/themes";
import { createSchool, updateSchool, type ManagedSchool } from "../api/schoolApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { PageHeader, Panel, Loading, ErrorNotice, Button, FormField } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import ManagerSchoolClassesDialog from "../components/ManagerSchoolClassesDialog";
import SchoolSubscriptionDialog from "../components/SchoolSubscriptionDialog";
import { SUBSCRIPTION_STATUS } from "../model/schoolSubscription";

type SchoolForm = { code: string; name: string; address: string; active: boolean; licenseStart: string; licenseEnd: string; monthlyTokenQuota: string };

const blankSchool: SchoolForm = { code: "", name: "", address: "", active: true, licenseStart: "", licenseEnd: "", monthlyTokenQuota: "0" };
const SCHOOL_PAGE_SIZES = [10, 25, 50] as const;

export function SchoolsView() {
  const [form, setForm] = useState<SchoolForm>(blankSchool); const [editing, setEditing] = useState<string | null>(null); const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [classSchool, setClassSchool] = useState<ManagedSchool | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const resource = useResource<DataPage<ManagedSchool>>(`/admin/schools/page?page=${page - 1}&size=${pageSize}`);
  const items = resource.data?.items ?? [];
  const total = resource.data?.totalElements ?? 0;
  const loading = resource.loading;
  const load = resource.refresh;
  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleItems = items;
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const payload = { ...form, licenseStart: form.licenseStart || null, licenseEnd: form.licenseEnd || null, monthlyTokenQuota: form.monthlyTokenQuota === "" ? null : Number(form.monthlyTokenQuota) }; if (editing) { await updateSchool(editing, payload); } else { await createSchool(payload); } setShowForm(false); setEditing(null); setForm(blankSchool); await load(); } catch (e) { setError(apiMessage(e, "Không thể lưu trường học.")); } finally { setBusy(false); } };
  return <div className="admin-content">
    <PageHeader title="" description="" action={<Button primary onClick={() => { setEditing(null); setForm(blankSchool); setShowForm(true); }}><LearningIcon name="plus" />Thêm trường</Button>} />
    {(error || resource.error) && <ErrorNotice error={error || resource.error || ""} onRetry={() => void load()} />}
    <ManagerSchoolClassesDialog key={classSchool?.id ?? "no-school"} school={classSchool} onClose={() => setClassSchool(null)} />
    <SchoolSubscriptionDialog key={subscriptionId ?? "closed"} schoolId={subscriptionId} onClose={() => setSubscriptionId(null)} />
    <Dialog.Root open={showForm} onOpenChange={setShowForm}><Dialog.Content className={modal.dialog} maxWidth="620px" aria-describedby={undefined}><div className={modal.body}><Dialog.Title>{editing ? "Cập nhật trường" : "Thêm trường"}</Dialog.Title>
      {error && <Callout.Root color="red" size="1" mb="4" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      <form className="admin-form-grid" onSubmit={submit}>
        <FormField label="Mã trường" htmlFor="managed-school-code"><TextField.Root id="managed-school-code" size="3" required value={form.code} disabled={Boolean(editing)} onChange={event => setForm({ ...form, code: event.target.value })} /></FormField>
        <FormField label="Tên trường" htmlFor="managed-school-name"><TextField.Root id="managed-school-name" size="3" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></FormField>
        <FormField label="Địa chỉ" htmlFor="managed-school-address"><TextField.Root id="managed-school-address" size="3" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></FormField>
        <FormField label="Ngày bắt đầu license" htmlFor="managed-school-start"><TextField.Root id="managed-school-start" size="3" type="date" value={form.licenseStart} required={Boolean(form.licenseEnd)} onChange={event => setForm({ ...form, licenseStart: event.target.value })} /></FormField>
        <FormField label="Ngày hết hạn license" htmlFor="managed-school-end"><TextField.Root id="managed-school-end" size="3" type="date" min={form.licenseStart} value={form.licenseEnd} required={Boolean(form.licenseStart)} onChange={event => setForm({ ...form, licenseEnd: event.target.value })} /></FormField>
        <FormField label="Token AI/tháng (trống = không giới hạn)" htmlFor="managed-school-quota"><TextField.Root id="managed-school-quota" size="3" type="number" min="0" step="1" value={form.monthlyTokenQuota} onChange={event => setForm({ ...form, monthlyTokenQuota: event.target.value })} /></FormField>
        <Text as="label" size="2" className="admin-checkbox"><Checkbox checked={form.active} onCheckedChange={checked => setForm({ ...form, active: checked === true })} />Đang hoạt động</Text>
        <div className="admin-form-actions"><Button onClick={() => setShowForm(false)}>Hủy</Button><ThemeButton type="submit" size="3" loading={busy} disabled={busy}>{busy ? "Đang lưu…" : "Lưu trường"}</ThemeButton></div>
      </form>
    </div></Dialog.Content></Dialog.Root>
    {loading ? <Loading text="Đang tải danh sách trường học…" headers={["Mã", "Tên trường", "Gói hiện tại", "Ngày hết hạn", "Trạng thái gói", "Trạng thái trường", "Thao tác"]} /> : <Panel title={`${total} trường học`}><Table.Root className={tableScroll.viewport} size="2" variant="ghost"><Table.Header><Table.Row><Table.ColumnHeaderCell>Mã</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Tên trường</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Gói hiện tại</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Ngày hết hạn</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái gói</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái trường</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Thao tác</Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{visibleItems.map(item => <Table.Row key={item.id}><Table.Cell><Text weight="medium">{item.code}</Text></Table.Cell><Table.Cell><Text as="div">{item.name}</Text><Text as="div" size="1" color="gray">{item.address || "Chưa cập nhật địa chỉ"}</Text></Table.Cell><Table.Cell><Badge variant="soft" color={item.planCode ? "indigo" : "gray"}>{item.planCode || "Chưa mua gói"}</Badge></Table.Cell><Table.Cell>{item.licenseEnd ? item.licenseEnd.split("-").reverse().join("/") : "Chưa thiết lập"}</Table.Cell><Table.Cell><Badge color={SUBSCRIPTION_STATUS[item.subscriptionStatus ?? "UNKNOWN"].color}>{SUBSCRIPTION_STATUS[item.subscriptionStatus ?? "UNKNOWN"].label}</Badge></Table.Cell><Table.Cell><Badge color={item.active ? "cyan" : "gray"} size="2">{item.active ? "Hoạt động" : "Đã tắt"}</Badge></Table.Cell><Table.Cell><div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}><Button onClick={() => setClassSchool(item)}>Xem lớp học</Button><Button onClick={() => setSubscriptionId(item.id)}>Xem gói</Button><Button onClick={() => { setEditing(item.id); setForm({ code: item.code, name: item.name, address: item.address ?? "", active: item.active, licenseStart: item.licenseStart ?? "", licenseEnd: item.licenseEnd ?? "", monthlyTokenQuota: item.monthlyTokenQuota == null ? "" : String(item.monthlyTokenQuota) }); setShowForm(true); }}>Sửa</Button></div></Table.Cell></Table.Row>)}</Table.Body></Table.Root><div className="admin-table-pagination"><span aria-live="polite">{total === 0 ? "0 trường học" : `Hiển thị ${pageStart + 1}–${Math.min(pageStart + pageSize, total)} / ${total} trường học`}</span><div><label>Số dòng/trang<Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}><Select.Trigger aria-label="Số trường học trên mỗi trang" /><Select.Content>{SCHOOL_PAGE_SIZES.map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content></Select.Root></label><ThemeButton type="button" size="2" variant="soft" color="gray" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</ThemeButton><span>Trang {currentPage}/{pageCount}</span><ThemeButton type="button" size="2" variant="soft" color="gray" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Sau</ThemeButton></div></div></Panel>}
  </div>;
}
