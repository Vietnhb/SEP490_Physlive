import styles from "./UsersView.module.css";
import UsersArt from "./UsersArt";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { AccountPage } from "../../../shared/api/page";
import { useEffect, useRef, useState, type FormEvent } from "react";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { Button as ThemeButton, Callout, Dialog, DropdownMenu, IconButton, Select, Table, Text, TextField } from "@radix-ui/themes";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { adminSchools, type ManagedSchool } from "../../school/api/schoolApi";
import { createManagedUser, setManagedUserActive, updateManagedUser } from "../api/userApi";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { isAdminRole, isPlatformRole, canEditUser, assignableRoles, getRoleLabel } from "../../../shared/auth/roles";
import type { User } from "../../../shared/auth/types";
import { apiMessage } from "../../../shared/lib/apiError";
import { AccountPermissionFields, AccountProfileFields, ResetManagedPasswordDialog } from "./ManagedAccountFields";
import { accountDetails, accountDetailsPayload, blankAccountDetails, missingPermission, type AccountDetails } from "../model/accountDetailsModel";
import { permissionSummary, permissionsForRole } from "../../../shared/auth/permissions";
import { Loading, ErrorNotice, Button, FormField } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import SchoolAccountProfileDialog from "./SchoolAccountProfileDialog";

function roleClass(role: string): string {
  switch (role) {
    case "STUDENT": return styles.roleStudent;
    case "STAFF": return styles.roleStaff;
    case "SCHOOL": return styles.roleSchool;
    case "MANAGER": return styles.roleManager;
    case "REVIEWER": return styles.roleReviewer;
    case "ADMIN": return styles.roleAdmin;
    default: return "";
  }
}

function initialsOf(fullName?: string | null, email?: string | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 1).toUpperCase();
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function StatusIcon({ active }: Readonly<{ active: boolean }>) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  );
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
      <IconButton type="button" variant="ghost" color="gray" disabled={disabled} aria-label={`Thao tác với ${item.email}`}><DotsHorizontalIcon width="18" height="18" /></IconButton>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8}>
      <DropdownMenu.Label>Tài khoản</DropdownMenu.Label>
      <DropdownMenu.Separator />
      {onViewProfile && <DropdownMenu.Item onSelect={() => { onViewProfile(); onClose(); }}>Xem hồ sơ</DropdownMenu.Item>}
      <DropdownMenu.Item onSelect={() => { onEdit(); onClose(); }}>Sửa hồ sơ</DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => { onResetPassword(); onClose(); }}>Đặt lại mật khẩu</DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item disabled={item.active === false && ((actorRole === "SCHOOL" && item.suspensionScope !== "SCHOOL") || (actorRole === "MANAGER" && item.suspensionScope === "SCHOOL"))} color={item.active === false ? "teal" : "red"} onSelect={() => { onToggle(); onClose(); }}>{item.active === false ? "Kích hoạt lại" : "Tạm khóa"}</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}

type UserForm = AccountDetails & { email: string; password: string; fullName: string; role: string; institutionId: string };

const blankUser: UserForm = { email: "", password: "", fullName: "", role: "STUDENT", institutionId: "", ...blankAccountDetails };
const USER_PAGE_SIZES = [10, 25, 50, 100] as const;

export function UsersView({ schoolId }: Readonly<{ schoolId?: string }> = {}) {
  const actorRole = useSessionStore(state => state.user?.role);
  const adminOnly = isAdminRole(actorRole);
  const canCreate = assignableRoles(actorRole).length > 0;
  const newUser = () => ({ ...blankUser, role: adminOnly ? "MANAGER" : "STUDENT", institutionId: schoolId ?? "" });
  const [availableSchools, setAvailableSchools] = useState<ManagedSchool[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<UserForm>(blankUser);
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const known = resource.data !== undefined;
  const loading = resource.loading && !known;
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

  const openCreate = () => {
    setError("");
    setNotice("");
    setEditing(null);
    setForm(newUser());
    setOpenActions(null);
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (missingPermission(form, form.role)) {
      setError("Cần chọn ít nhất một quyền cho tài khoản này.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { fullName: form.fullName.trim(), role: form.role, institutionId: form.institutionId || undefined, ...accountDetailsPayload(form, form.role) };
      if (editing === null) await createManagedUser({ ...payload, email: form.email.trim(), password: form.password }, schoolId);
      else await updateManagedUser(editing, payload, schoolId);
      if (editing === null) { setQuery(""); setSelectedRole("ALL"); setPage(1); }
      setShowForm(false);
      setEditing(null);
      setForm(newUser());
      await load();
      setNotice("Đã lưu tài khoản.");
    } catch (e) {
      setError(apiMessage(e, "Không thể lưu tài khoản."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const edit = (item: User) => {
    setError("");
    setNotice("");
    setEditing(item.id);
    setForm({ email: item.email, password: "", fullName: item.fullName, role: item.role, institutionId: item.schoolId ?? item.institutionId ?? "", ...accountDetails(item) });
    setShowForm(true);
  };

  const toggle = async (item: User, reason?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await setManagedUserActive(item.id, item.active === false, schoolId, reason);
      void load();
      setSuspendUser(null);
      setNotice(updated.active ? "Đã mở khóa tài khoản." : "Đã tạm khóa tài khoản và lưu lý do.");
    } catch (e) {
      setError(apiMessage(e, "Không thể cập nhật trạng thái tài khoản."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const selectRole = (role: string) => {
    setSelectedRole(role);
    setPage(1);
    setOpenActions(null);
  };

  const roleTabs = schoolScoped
    ? [
      { value: "ALL", label: "Tất cả", count: counts.total ?? 0, dotClass: "" },
      { value: "STUDENT", label: "Học sinh", count: counts.STUDENT ?? 0, dotClass: styles.roleStudent },
      { value: "STAFF", label: "Giáo viên", count: counts.STAFF ?? 0, dotClass: styles.roleStaff },
      { value: "SCHOOL", label: "Quản lý trường", count: counts.SCHOOL ?? 0, dotClass: styles.roleSchool },
    ]
    : [
      { value: "ALL", label: "Tất cả", count: counts.total ?? 0, dotClass: "" },
      { value: "STUDENT", label: "Học sinh", count: counts.STUDENT ?? 0, dotClass: styles.roleStudent },
      { value: "STAFF", label: "Giáo viên", count: counts.STAFF ?? 0, dotClass: styles.roleStaff },
      { value: "SCHOOL", label: "Quản lý trường", count: counts.SCHOOL ?? 0, dotClass: styles.roleSchool },
      { value: "MANAGER", label: "Vận hành", count: counts.MANAGER ?? 0, dotClass: styles.roleManager },
      { value: "REVIEWER", label: "Kiểm duyệt vật lý", count: counts.REVIEWER ?? 0, dotClass: styles.roleReviewer },
    ];

  const schoolNameFor = (item: User) => {
    const matched = item.schoolName || availableSchools.find(school => school.id === (item.schoolId ?? item.institutionId))?.name;
    if (matched) return matched;
    if (isPlatformRole(item.role)) return "Nền tảng PhysLive";
    return "—";
  };

  const schoolCount = counts.SCHOOL ?? 0;

  return <div className={"admin-content " + styles.page}>
    <RefreshButton disabled={resource.refreshing} onClick={() => void load()} />
    {schoolId && profileId !== null && <SchoolAccountProfileDialog schoolId={schoolId} userId={profileId} onClose={() => setProfileId(null)} />}

    <header className={styles.heading}>
      <div className={styles.headingText}>
        <h1>{schoolScoped ? "Tài khoản nhà trường" : "Quản lý người dùng"}</h1>
        <p>{schoolScoped
          ? "Tài khoản giáo viên, học sinh và quản lý của trường. Sửa hồ sơ, đặt lại mật khẩu hoặc tạm khóa ngay trên từng dòng."
          : "Tài khoản của các trường và đội ngũ PhysLive. Sửa hồ sơ, đặt lại mật khẩu hoặc tạm khóa ngay trên từng dòng."}
        </p>
      </div>
      <div className={styles.headingActions}>
        {canCreate && <ThemeButton type="button" size="3" color="teal" className={styles.createBtn} disabled={busy} onClick={openCreate}><LearningIcon name="plus" />Tạo tài khoản</ThemeButton>}
        <div className={styles.artWrap}><UsersArt /></div>
      </div>
    </header>

    {(error || resource.error) && <ErrorNotice error={error || resource.error || ""} onRetry={() => void load()} />}
    {notice && <Callout.Root color="green" role="status"><Callout.Text>{notice}</Callout.Text></Callout.Root>}

    <section className={styles.stats} aria-label="Số liệu tài khoản">
      <button type="button" className={`${styles.stat} ${styles.indigo}`} aria-pressed={selectedRole === "ALL"} onClick={() => selectRole("ALL")}>
        <span className={styles.statIcon}><LearningIcon name="users" /></span>
        <span className={styles.statLabel}>Tổng tài khoản</span>
        <strong className={styles.statValue}>{known ? (counts.total ?? 0).toLocaleString("vi-VN") : "—"}</strong>
        <span className={styles.statHint}>{schoolScoped ? "Tài khoản thuộc trường" : "Toàn bộ tài khoản trên nền tảng"}</span>
        <svg className={styles.spark} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
          <path className={styles.sparkArea} d="M0 26 C18 26 32 25 48 22 C64 18 76 6 92 14 C104 20 112 24 120 24 L120 32 L0 32 Z" />
          <path className={styles.sparkLine} d="M0 26 C18 26 32 25 48 22 C64 18 76 6 92 14 C104 20 112 24 120 24" />
        </svg>
      </button>

      <button type="button" className={`${styles.stat} ${styles.mint}`} aria-pressed={selectedRole === "STAFF"} onClick={() => selectRole("STAFF")}>
        <span className={styles.statIcon}><LearningIcon name="book" /></span>
        <span className={styles.statLabel}>Giáo viên</span>
        <strong className={styles.statValue}>{known ? (counts.STAFF ?? 0).toLocaleString("vi-VN") : "—"}</strong>
        <span className={styles.statHint}>{schoolScoped ? "Tài khoản giảng dạy" : schoolCount > 0 ? `Thuộc ${schoolCount.toLocaleString("vi-VN")} trường` : "Tài khoản giảng dạy"}</span>
      </button>

      <button type="button" className={`${styles.stat} ${styles.blue}`} aria-pressed={selectedRole === "STUDENT"} onClick={() => selectRole("STUDENT")}>
        <span className={styles.statIcon}><LearningIcon name="users" /></span>
        <span className={styles.statLabel}>Học sinh</span>
        <strong className={styles.statValue}>{known ? (counts.STUDENT ?? 0).toLocaleString("vi-VN") : "—"}</strong>
        <span className={styles.statHint}>{schoolScoped ? "Tài khoản học tập" : schoolCount > 0 ? `Thuộc ${schoolCount.toLocaleString("vi-VN")} trường` : "Tài khoản học tập"}</span>
      </button>

      <article className={`${styles.stat} ${styles.red}`}>
        <span className={styles.statIcon}><LockIcon /></span>
        <span className={styles.statLabel}>Tạm khóa</span>
        <strong className={styles.statValue}>{known ? (counts.suspended ?? 0).toLocaleString("vi-VN") : "—"}</strong>
        <span className={styles.statHint}>Tài khoản đang bị tạm khóa</span>
      </article>
    </section>

    <Dialog.Root open={showForm} onOpenChange={open => { if (!busyRef.current) setShowForm(open); }}>
      <Dialog.Content className={modal.dialog} maxWidth="620px" aria-describedby={undefined} onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }} onInteractOutside={event => { if (busyRef.current) event.preventDefault(); }}>
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
      </Dialog.Content>
    </Dialog.Root>

    <section className={styles.card} aria-label="Danh sách tài khoản">
      <div className={styles.ftabs} role="tablist" aria-label="Lọc theo vai trò">
        {roleTabs.map(tab => (
          <button key={tab.value} type="button" role="tab" className={styles.tab} aria-selected={selectedRole === tab.value} onClick={() => selectRole(tab.value)}>
            {tab.dotClass && <i className={`${styles.dot} ${tab.dotClass}`} aria-hidden="true" />}
            {tab.label}
            <span className={styles.tabCount}>{known ? tab.count.toLocaleString("vi-VN") : "—"}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <TextField.Root type="search" size="3" className={styles.searchField} aria-label="Tìm theo email hoặc họ tên" placeholder="Tìm họ tên hoặc email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); setOpenActions(null); }}>
          <TextField.Slot><LearningIcon name="search" /></TextField.Slot>
        </TextField.Root>
        <IconButton type="button" size="3" variant="surface" color="gray" className={styles.refreshBtn} aria-label="Làm mới danh sách tài khoản" disabled={resource.refreshing} onClick={() => void load()}>
          <LearningIcon name="refresh" />
        </IconButton>
      </div>

      {loading ? (
        <Loading text="Đang tải danh sách tài khoản…" headers={schoolScoped ? ["Họ tên / Email", "Vai trò", "Đăng nhập gần nhất", "Trạng thái", "Thao tác"] : ["Họ tên / Email", "Vai trò", "Trường", "Đăng nhập gần nhất", "Trạng thái", "Thao tác"]} />
      ) : (
        <>
          <Table.Root className={`${styles.tableWrap} ${tableScroll.viewport}`} size="2" variant="ghost">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Họ tên / Email</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Vai trò</Table.ColumnHeaderCell>
                {!schoolScoped && <Table.ColumnHeaderCell>Trường</Table.ColumnHeaderCell>}
                <Table.ColumnHeaderCell>Đăng nhập gần nhất</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell><span className="sr-only">Thao tác</span></Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {total === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={schoolScoped ? 5 : 6} className={styles.emptyCell}>Không tìm thấy tài khoản phù hợp.</Table.Cell>
                </Table.Row>
              ) : (
                visibleItems.map(item => {
                  const rc = roleClass(item.role);
                  const editable = !(schoolScoped && item.role === "SCHOOL") && canEditUser(actorRole, item.role);
                  const isActive = item.active !== false;
                  return (
                    <Table.Row key={item.id}>
                      <Table.Cell>
                        <div className={styles.person}>
                          <span className={`${styles.avatar} ${rc}`}>
                            {item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : initialsOf(item.fullName, item.email)}
                          </span>
                          <span className={styles.personText}>
                            <span className={styles.personName}>
                              {schoolScoped && ["STAFF", "STUDENT"].includes(item.role)
                                ? <button type="button" className={styles.profileLink} onClick={() => setProfileId(item.id)} aria-label={"Xem hồ sơ " + (item.fullName || item.email)}>{item.fullName || "Chưa có họ tên"}</button>
                                : item.fullName || "Chưa có họ tên"}
                            </span>
                            <span className={styles.personEmail}>{item.email}</span>
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className={styles.cellStack}>
                          <span className={`${styles.roleTag} ${rc}`}>{getRoleLabel(item.role)}</span>
                          {permissionsForRole(item.role).length > 0 && permissionSummary(item) !== getRoleLabel(item.role) && (
                            <span className={styles.cellNote}>{permissionSummary(item)}</span>
                          )}
                        </div>
                      </Table.Cell>
                      {!schoolScoped && <Table.Cell>{schoolNameFor(item)}</Table.Cell>}
                      <Table.Cell>
                        <Text size="2" color="gray">{item.lastLogin ? new Date(item.lastLogin).toLocaleString("vi-VN") : "Chưa đăng nhập"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <div className={styles.cellStack}>
                          <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusSuspended}`}>
                            <StatusIcon active={isActive} />
                            {isActive ? "Hoạt động" : "Tạm khóa"}
                          </span>
                          {item.mustChangePassword && <span className={styles.cellNote}>Cần đổi mật khẩu</span>}
                        </div>
                      </Table.Cell>
                      <Table.Cell className={styles.actionCell}>
                        {!editable ? (
                          <span className={styles.readOnly}>Chỉ xem</span>
                        ) : (
                          <UserActionMenu
                            onViewProfile={schoolId && actorRole === "SCHOOL" ? () => setProfileId(item.id) : undefined}
                            item={item}
                            open={openActions === item.id}
                            disabled={busy}
                            onToggleMenu={() => setOpenActions(openActions === item.id ? null : item.id)}
                            onToggle={() => { if (item.active === false) void toggle(item); else { setSuspendReason(""); setError(""); setSuspendUser(item); } }}
                            onEdit={() => edit(item)}
                            onResetPassword={() => setResetUser(item)}
                            onClose={() => setOpenActions(null)}
                          />
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>

          <div className={styles.pager}>
            <span aria-live="polite">{total === 0 ? "0 tài khoản" : `Hiển thị ${(pageStart + 1).toLocaleString("vi-VN")}–${Math.min(pageStart + pageSize, total).toLocaleString("vi-VN")} / ${total.toLocaleString("vi-VN")} tài khoản`}</span>
            <div className={styles.pagerActions}>
              <label className={styles.pagerSize}>
                Số dòng/trang
                <Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); setOpenActions(null); }}>
                  <Select.Trigger aria-label="Số tài khoản trên mỗi trang" />
                  <Select.Content>{USER_PAGE_SIZES.map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content>
                </Select.Root>
              </label>
              <ThemeButton type="button" size="2" variant="surface" color="gray" disabled={currentPage <= 1} onClick={() => { setPage(Math.max(1, currentPage - 1)); setOpenActions(null); }}>Trước</ThemeButton>
              <span>Trang {currentPage.toLocaleString("vi-VN")}/{pageCount.toLocaleString("vi-VN")}</span>
              <ThemeButton type="button" size="2" variant="surface" color="gray" disabled={currentPage >= pageCount} onClick={() => { setPage(Math.min(pageCount, currentPage + 1)); setOpenActions(null); }}>Sau</ThemeButton>
            </div>
          </div>
        </>
      )}
    </section>

    <Dialog.Root open={!!suspendUser} onOpenChange={open => { if (!open && !busy) setSuspendUser(null); }}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Tạm khóa tài khoản</Dialog.Title>
        <Dialog.Description>{suspendUser?.email}. Người dùng chỉ được gửi và theo dõi yêu cầu mở khóa.</Dialog.Description>
        <form onSubmit={event => { event.preventDefault(); if (suspendUser && suspendReason.trim()) void toggle(suspendUser, suspendReason.trim()); }}>
          <FormField label="Lý do tạm khóa" htmlFor="user-suspend-reason">
            <TextField.Root id="user-suspend-reason" required maxLength={2000} value={suspendReason} onChange={event => setSuspendReason(event.target.value)} disabled={busy} />
          </FormField>
          {error && <p role="alert">{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
            <ThemeButton type="button" variant="soft" disabled={busy} onClick={() => setSuspendUser(null)}>Hủy</ThemeButton>
            <ThemeButton type="submit" color="red" loading={busy} disabled={busy || !suspendReason.trim()}>Tạm khóa</ThemeButton>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>

    <ResetManagedPasswordDialog user={resetUser} schoolId={schoolId} onClose={() => setResetUser(null)} onUpdated={updated => { void load(); setNotice(`Đã đặt lại mật khẩu cho ${updated.email}.`); }} />
  </div>;
}
