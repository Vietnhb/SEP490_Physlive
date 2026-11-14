import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { AccountPage } from "../../../shared/api/page";
import { useEffect, useRef, useState, type FormEvent } from "react";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { Avatar, Badge, Button as ThemeButton, Callout, Dialog, DropdownMenu, IconButton, Select, Table, Text, TextField, type BadgeProps } from "@radix-ui/themes";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { adminSchools, type ManagedSchool } from "../../school/api/schoolApi";
import { createManagedUser, setManagedUserActive, updateManagedUser } from "../api/userApi";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { isAdminRole, canEditUser, assignableRoles, getRoleLabel } from "../../../shared/auth/roles";
import type { User } from "../../../shared/auth/types";
import { apiMessage } from "../../../shared/lib/apiError";
import { AccountPermissionFields, AccountProfileFields, ResetManagedPasswordDialog } from "./ManagedAccountFields";
import { accountDetails, accountDetailsPayload, blankAccountDetails, missingPermission, type AccountDetails } from "../model/accountDetailsModel";
import { permissionSummary, permissionsForRole } from "../../../shared/auth/permissions";
import { Panel, Loading, ErrorNotice, Button, FormField, Stat } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import SchoolAccountProfileDialog from "./SchoolAccountProfileDialog";

function roleColor(role: string): NonNullable<BadgeProps["color"]> {
  switch (role) {
    case "ADMIN": return "indigo";
    case "MANAGER": return "violet";
    case "REVIEWER": return "amber";
    case "SCHOOL": return "cyan";
    case "STAFF": return "orange";
    case "STUDENT": return "blue";
    default: return "gray";
  }
}

function UserActionMenu({ item, open, disabled, onToggleMenu, onToggle, onEdit, onResetPassword, onClose, onViewProfile }: Readonly<{
  item: User;
  open: boolean;
  disabled: boolean;
  onToggleMenu: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onClose: () => void;
  onViewProfile?: () => void;
}>) {
  const actorRole = useSessionStore(state => state.user?.role);
  return <DropdownMenu.Root open={open} onOpenChange={nextOpen => { if (nextOpen) onToggleMenu(); else onClose(); }}>
    <DropdownMenu.Trigger>
      <IconButton type="button" variant="ghost" color="gray" disabled={disabled} aria-label={`Thao tác với ${item.email}`}><DotsHorizontalIcon width="20" height="20" /></IconButton>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8}>
      <DropdownMenu.Label>Tài khoản</DropdownMenu.Label>
      <DropdownMenu.Separator />
      {onViewProfile && <DropdownMenu.Item onSelect={() => { onViewProfile(); onClose(); }}>Xem hồ sơ</DropdownMenu.Item>}
      <DropdownMenu.Item onSelect={() => { onEdit(); onClose(); }}>Sửa hồ sơ</DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => { onResetPassword(); onClose(); }}>Đặt lại mật khẩu</DropdownMenu.Item>
      <DropdownMenu.Item disabled={item.active === false && ((actorRole === "SCHOOL" && item.suspensionScope !== "SCHOOL") || (actorRole === "MANAGER" && item.suspensionScope === "SCHOOL"))} color={item.active === false ? "cyan" : "red"} onSelect={() => { onToggle(); onClose(); }}>{item.active === false ? "Kích hoạt lại" : "Tạm khóa"}</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}

type UserForm = AccountDetails & { email: string; password: string; fullName: string; role: string; institutionId: string };

const blankUser: UserForm = { email: "", password: "", fullName: "", role: "STUDENT", institutionId: "", ...blankAccountDetails };
const USER_PAGE_SIZES = [10, 25, 50, 100] as const;

export function UsersView({ schoolId }: Readonly<{ schoolId?: string }> = {}) {
  const actorRole = useSessionStore(state => state.user?.role);
  const adminOnly = isAdminRole(actorRole);
  const newUser = () => ({ ...blankUser, role: adminOnly ? "MANAGER" : "STUDENT", institutionId: schoolId ?? "" });
  const [availableSchools, setAvailableSchools] = useState<ManagedSchool[]>([]);
  const [query, setQuery] = useState(""); const [form, setForm] = useState<UserForm>(blankUser); const [editing, setEditing] = useState<number | null>(null); const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [openActions, setOpenActions] = useState<number | null>(null);
  const [suspendUser, setSuspendUser] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const busyRef = useRef(false);
  const search = useDebouncedValue(query);
  const resource = useResource<AccountPage<User>>(
    (schoolId ? `/schools/${schoolId}/users/page` : "/admin/users/page")
    + "?" + new URLSearchParams({ page: String(page - 1), size: String(pageSize), query: search, role: selectedRole }));
  const items = resource.data?.items ?? [];
  const counts = resource.data?.counts ?? {};
  const loading = resource.loading;
  const load = resource.refresh;
  useEffect(() => {
    if (!showForm || schoolId || adminOnly) return;
    let active = true;
    void adminSchools().then(schools => { if (active) setAvailableSchools(schools); }).catch(() => undefined);
    return () => { active = false; };
  }, [showForm, schoolId, adminOnly]);
  const schoolScoped = Boolean(schoolId);
  const total = resource.data?.totalElements ?? 0;
  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleItems = items;
  const updateDetails = (details: Partial<AccountDetails>) => setForm(current => ({ ...current, ...details }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busyRef.current) return;
    if (missingPermission(form, form.role)) { setError("Cần chọn ít nhất một quyền cho tài khoản này."); return; }
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const payload = { fullName: form.fullName.trim(), role: form.role, institutionId: form.institutionId || undefined, ...accountDetailsPayload(form, form.role) };
      if (editing === null) await createManagedUser({ ...payload, email: form.email.trim(), password: form.password }, schoolId);
      else await updateManagedUser(editing, payload, schoolId);
      if (editing === null) { setQuery(""); setSelectedRole("ALL"); setPage(1); }
      setShowForm(false); setEditing(null); setForm(newUser()); await load();
      setNotice("Đã lưu tài khoản.");
    } catch (e) { setError(apiMessage(e, "Không thể lưu tài khoản.")); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const edit = (item: User) => { setError(""); setNotice(""); setEditing(item.id); setForm({ email: item.email, password: "", fullName: item.fullName, role: item.role, institutionId: item.schoolId ?? item.institutionId ?? "", ...accountDetails(item) }); setShowForm(true); };
  const toggle = async (item: User, reason?: string) => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(""); setNotice(""); try { const updated = await setManagedUserActive(item.id, item.active === false, schoolId, reason); load(); setSuspendUser(null); setNotice(updated.active ? "Đã mở khóa tài khoản." : "Đã tạm khóa tài khoản và lưu lý do."); } catch (e) { setError(apiMessage(e, "Không thể cập nhật trạng thái tài khoản.")); } finally { busyRef.current = false; setBusy(false); } };
  return <div className="admin-content">
    {schoolId && profileId !== null && <SchoolAccountProfileDialog schoolId={schoolId} userId={profileId} onClose={() => setProfileId(null)} />}
    {(error || resource.error) && <ErrorNotice error={error || resource.error || ""} onRetry={() => void load()} />}
    {notice && <Callout.Root color="green" role="status"><Callout.Text>{notice}</Callout.Text></Callout.Root>}
    <div className="admin-stats-grid">
      <Stat label="Tổng tài khoản" value={(counts.total ?? 0)} icon="users" tone="blue" />
      <Stat label="Giáo viên" value={(counts.STAFF ?? 0)} icon="book" tone="orange" />
      <Stat label="Học sinh" value={(counts.STUDENT ?? 0)} icon="users" tone="green" />
      <Stat label="Tạm khóa" value={(counts.suspended ?? 0)} icon="close" tone="red" />
    </div>
    <div className="admin-toolbar admin-user-filters">
      <TextField.Root type="search" size="3" aria-label="Tìm theo email hoặc họ tên" placeholder="Tìm họ tên hoặc email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); setOpenActions(null); }} style={{ width: "min(100%, 360px)" }}><TextField.Slot><LearningIcon name="search" /></TextField.Slot></TextField.Root>
      <Select.Root size="3" value={selectedRole} onValueChange={value => { setSelectedRole(value); setPage(1); setOpenActions(null); }}>
        <Select.Trigger aria-label="Lọc theo đối tượng người dùng" style={{ minWidth: 180 }} />
        <Select.Content position="popper" side="bottom" align="start" sideOffset={6} avoidCollisions={false}>
          <Select.Item value="ALL">Tất cả đối tượng</Select.Item>
          {schoolScoped ? <>
            <Select.Item value="SCHOOL">Quản lý trường</Select.Item>
            <Select.Item value="STAFF">Giáo viên</Select.Item>
            <Select.Item value="STUDENT">Học sinh</Select.Item>
          </> : <>
            <Select.Item value="SCHOOL">Quản trị trường (SCHOOL)</Select.Item>
            <Select.Item value="STAFF">Giáo viên (STAFF)</Select.Item>
            <Select.Item value="STUDENT">Học sinh (STUDENT)</Select.Item>
            <Select.Item value="REVIEWER">Người thẩm định (REVIEWER)</Select.Item>
            <Select.Item value="MANAGER">Quản lý vận hành (MANAGER)</Select.Item>
          </>}
        </Select.Content>
      </Select.Root>
      <IconButton type="button" variant="surface" size="3" aria-label="Làm mới danh sách tài khoản" onClick={() => void load()} disabled={loading}><LearningIcon name="refresh" /></IconButton>
      {schoolScoped && actorRole === "SCHOOL" && <ThemeButton type="button" size="3" disabled={busy} style={{ marginLeft: "auto" }} onClick={() => { setError(""); setNotice(""); setEditing(null); setForm(newUser()); setOpenActions(null); setShowForm(true); }}><LearningIcon name="plus" />Tạo tài khoản</ThemeButton>}
    </div>
    <Dialog.Root open={showForm} onOpenChange={open => { if (!busyRef.current) setShowForm(open); }}><Dialog.Content className={modal.dialog} maxWidth="620px" aria-describedby={undefined} onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }} onInteractOutside={event => { if (busyRef.current) event.preventDefault(); }}>
      <div className={modal.body}>
      <Dialog.Title>{editing === null ? "Tạo tài khoản" : "Cập nhật tài khoản"}</Dialog.Title>
      {error && <Callout.Root color="red" size="1" mb="4" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      <form className="admin-form-grid" onSubmit={submit}>
        <FormField label="Email" htmlFor="managed-user-email"><TextField.Root id="managed-user-email" name="email" size="3" type="email" value={form.email} disabled={busy || editing !== null} required onChange={event => setForm({ ...form, email: event.target.value })} /></FormField>
        <FormField label="Họ và tên" htmlFor="managed-user-name"><TextField.Root id="managed-user-name" name="fullName" size="3" value={form.fullName} disabled={busy} maxLength={120} required onChange={event => setForm({ ...form, fullName: event.target.value })} /></FormField>
        <AccountProfileFields idPrefix="managed-user" value={form} name={form.fullName} disabled={busy} onChange={updateDetails} />
        <FormField label="Vai trò" htmlFor="managed-user-role"><Select.Root size="3" name="role" value={form.role} disabled={busy} onValueChange={role => setForm({ ...form, role, institutionId: ["ADMIN", "MANAGER", "REVIEWER"].includes(role) ? "" : form.institutionId })}><Select.Trigger id="managed-user-role" /><Select.Content>{assignableRoles(actorRole, items.find(item => item.id === editing)?.role).map(role => <Select.Item key={role} value={role}>{getRoleLabel(role)}</Select.Item>)}</Select.Content></Select.Root></FormField>
        <AccountPermissionFields idPrefix="managed-user" role={form.role} value={form} disabled={busy} onChange={updateDetails} />
        {!schoolId && ["STAFF", "STUDENT", "SCHOOL"].includes(form.role) && <FormField label="Trường" htmlFor="managed-user-school"><Select.Root size="3" name="institutionId" required value={form.institutionId} onValueChange={institutionId => setForm({ ...form, institutionId })}><Select.Trigger id="managed-user-school" placeholder="Chọn trường" /><Select.Content>{availableSchools.filter(item => item.active).map(item => <Select.Item key={item.id} value={item.id}>{item.name}</Select.Item>)}</Select.Content></Select.Root></FormField>}
        {editing === null && <FormField label="Mật khẩu ban đầu" htmlFor="managed-user-password"><TextField.Root id="managed-user-password" name="password" size="3" type="password" autoComplete="new-password" minLength={8} maxLength={120} disabled={busy} required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></FormField>}
        {editing === null && <Text size="2" color="gray" style={{ gridColumn: "1 / -1" }}>Tài khoản phải đổi mật khẩu khi đăng nhập lần đầu.</Text>}
        <div className="admin-form-actions"><Button disabled={busy} onClick={() => setShowForm(false)}>Hủy</Button><ThemeButton type="submit" size="3" disabled={busy || missingPermission(form, form.role)} loading={busy}>{busy ? "Đang lưu…" : "Lưu tài khoản"}</ThemeButton></div>
      </form>
      </div>
    </Dialog.Content></Dialog.Root>
    <Panel title="Danh sách tài khoản" className="admin-users-panel" hideHeader>{loading ? <Loading text="Đang tải danh sách tài khoản…" headers={schoolScoped ? ["Họ tên / Email", "Vai trò", "Đăng nhập gần nhất", "Trạng thái", "Thao tác"] : ["Họ tên / Email", "Vai trò", "Trường", "Đăng nhập gần nhất", "Trạng thái", "Thao tác"]} /> : <><Table.Root className={`admin-user-table ${tableScroll.viewport}`} size="2" variant="ghost"><Table.Header><Table.Row><Table.ColumnHeaderCell>Họ tên / Email</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Vai trò</Table.ColumnHeaderCell>{!schoolScoped && <Table.ColumnHeaderCell>Trường</Table.ColumnHeaderCell>}<Table.ColumnHeaderCell>Đăng nhập gần nhất</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Thao tác</Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{total === 0 ? <Table.Row><Table.Cell colSpan={schoolScoped ? 5 : 6} className="admin-empty-table">Không tìm thấy tài khoản phù hợp.</Table.Cell></Table.Row> : visibleItems.map(item => <Table.Row key={item.id}>
      <Table.Cell><div className="admin-table-user"><Avatar size="3" radius="full" src={item.avatarUrl || undefined} color={roleColor(item.role)} fallback={(item.fullName || item.email).slice(0, 1).toUpperCase()} /><span><Text as="div" size="3" weight="medium">{item.fullName || "Chưa có họ tên"}</Text><Text as="div" color="gray" size="2">{item.email}</Text></span></div></Table.Cell>
      <Table.Cell><div style={{ display: "grid", gap: 6, justifyItems: "start" }}><Badge color={roleColor(item.role)} size="2" title={item.role}>{getRoleLabel(item.role)}</Badge>{permissionsForRole(item.role).length > 0 && permissionSummary(item) !== getRoleLabel(item.role) && <Text size="1" color="gray">{permissionSummary(item)}</Text>}</div></Table.Cell>
      {!schoolScoped && <Table.Cell>{availableSchools.find(school => school.id === item.institutionId)?.name || "—"}</Table.Cell>}
      <Table.Cell><Text size="2" color="gray">{item.lastLogin ? new Date(item.lastLogin).toLocaleString("vi-VN") : "Chưa đăng nhập"}</Text></Table.Cell>
      <Table.Cell><div style={{ display: "grid", gap: 6, justifyItems: "start" }}><Badge color={item.active === false ? "amber" : "cyan"} size="2">{item.active === false ? "Tạm khóa" : "Hoạt động"}</Badge>{item.mustChangePassword && <Text size="1" color="gray">Cần đổi mật khẩu</Text>}</div></Table.Cell>
      <Table.Cell>{schoolScoped && item.role === "SCHOOL" ? <Text size="2" color="gray">Chỉ xem</Text> : canEditUser(actorRole, item.role) && <UserActionMenu onViewProfile={schoolId && actorRole === "SCHOOL" ? () => setProfileId(item.id) : undefined} item={item} open={openActions === item.id} disabled={busy} onToggleMenu={() => setOpenActions(openActions === item.id ? null : item.id)} onToggle={() => { if (item.active === false) void toggle(item); else { setSuspendReason(""); setError(""); setSuspendUser(item); } }} onEdit={() => edit(item)} onResetPassword={() => setResetUser(item)} onClose={() => setOpenActions(null)} />}</Table.Cell>
    </Table.Row>)}</Table.Body></Table.Root><div className="admin-table-pagination"><span aria-live="polite">{total === 0 ? "0 kết quả" : `Hiển thị ${pageStart + 1}–${Math.min(pageStart + pageSize, total)} / ${total} tài khoản`}</span><div><label>Số dòng/trang<Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); setOpenActions(null); }}><Select.Trigger aria-label="Số tài khoản trên mỗi trang" /><Select.Content>{USER_PAGE_SIZES.map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content></Select.Root></label><ThemeButton type="button" size="2" variant="soft" color="gray" disabled={currentPage <= 1} onClick={() => { setPage(Math.max(1, currentPage - 1)); setOpenActions(null); }}>Trước</ThemeButton><span>Trang {currentPage}/{pageCount}</span><ThemeButton type="button" size="2" variant="soft" color="gray" disabled={currentPage >= pageCount} onClick={() => { setPage(Math.min(pageCount, currentPage + 1)); setOpenActions(null); }}>Sau</ThemeButton></div></div></>}</Panel>
    <Dialog.Root open={!!suspendUser} onOpenChange={open => { if (!open && !busy) setSuspendUser(null); }}><Dialog.Content maxWidth="520px"><Dialog.Title>Tạm khóa tài khoản</Dialog.Title><Dialog.Description>{suspendUser?.email}. Người dùng chỉ được gửi và theo dõi yêu cầu mở khóa.</Dialog.Description><form onSubmit={event => { event.preventDefault(); if (suspendUser && suspendReason.trim()) void toggle(suspendUser, suspendReason.trim()); }}><FormField label="Lý do tạm khóa" htmlFor="user-suspend-reason"><TextField.Root id="user-suspend-reason" required maxLength={2000} value={suspendReason} onChange={event => setSuspendReason(event.target.value)} disabled={busy} /></FormField>{error && <p role="alert">{error}</p>}<div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:20}}><ThemeButton type="button" variant="soft" disabled={busy} onClick={()=>setSuspendUser(null)}>Hủy</ThemeButton><ThemeButton type="submit" color="red" loading={busy} disabled={busy || !suspendReason.trim()}>Tạm khóa</ThemeButton></div></form></Dialog.Content></Dialog.Root>
    <ResetManagedPasswordDialog user={resetUser} schoolId={schoolId} onClose={() => setResetUser(null)} onUpdated={updated => { load(); setNotice(`Đã đặt lại mật khẩu cho ${updated.email}.`); }} />
  </div>;
}
