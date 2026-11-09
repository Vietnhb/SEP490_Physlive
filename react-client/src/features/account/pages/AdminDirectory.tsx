import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { AccountPage } from "../../../shared/api/page";
import { useState } from "react";
import { Avatar, Badge, Button, Callout, Card, Dialog, Flex, Heading, IconButton, Select, Table, Text, TextField } from "@radix-ui/themes";
import { ArrowRightIcon, CheckCircledIcon, Cross2Icon, ExclamationTriangleIcon, LockClosedIcon, MagnifyingGlassIcon, PersonIcon, ReloadIcon } from "@radix-ui/react-icons";
import { motion } from "motion/react";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { ROLE_NAMES, getRoleLabel } from "../../../shared/auth/roles";
import type { User, AccountStatus } from "../../../shared/auth/types";
import { permissionSummary, permissionsForRole } from "../../../shared/auth/permissions";
import "../styles/admin-directory.css";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import ManagerAccountActions from "../components/ManagerAccountActions";
import modal from "../../../shared/ui/ModalScroll.module.css";

type UserTier = "ALL" | "SYSTEM" | "SCHOOL" | "INDIVIDUAL";

const USER_TIERS: Record<UserTier, { id: UserTier; label: string; roles: string[]; icon: Parameters<typeof LearningIcon>[0]["name"]; desc: string }> = {
  ALL: { id: "ALL", label: "Tất cả tài khoản", roles: [], icon: "grid", desc: "Toàn bộ tài khoản trong nền tảng" },
  SYSTEM: { id: "SYSTEM", label: "Quản trị hệ thống", roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.MANAGER], icon: "shield", desc: "Quản trị viên nền tảng và quản lý vận hành" },
  SCHOOL: { id: "SCHOOL", label: "Trường học", roles: [ROLE_NAMES.SCHOOL, ROLE_NAMES.STAFF], icon: "book", desc: "Tài khoản đại diện trường và giáo viên bộ môn" },
  INDIVIDUAL: { id: "INDIVIDUAL", label: "Cá nhân", roles: [ROLE_NAMES.STUDENT, ROLE_NAMES.REVIEWER], icon: "users", desc: "Học sinh và chuyên gia thẩm định độc lập" },
};

const TIER_ORDER: UserTier[] = ["ALL", "SYSTEM", "SCHOOL", "INDIVIDUAL"];
const DIRECTORY_PAGE_SIZES = [10, 25, 50, 100] as const;

function getUserTier(role: string): "SYSTEM" | "SCHOOL" | "INDIVIDUAL" {
  if (role === ROLE_NAMES.ADMIN || role === ROLE_NAMES.MANAGER) return "SYSTEM";
  if (role === ROLE_NAMES.SCHOOL || role === ROLE_NAMES.STAFF) return "SCHOOL";
  return "INDIVIDUAL";
}

const formatDate = (date?: string | null) => date ? new Date(date).toLocaleString("vi-VN") : "Chưa có thông tin";
const organizationLabel = (user: User) => user.schoolName || user.schoolId || user.institutionId || (getUserTier(user.role) === "SYSTEM" ? "Nền tảng PhysLive" : "Chưa cập nhật");
const roleColors: Record<string, "iris" | "indigo" | "amber" | "cyan" | "green" | "gray"> = {
  ADMIN: "iris", MANAGER: "indigo", REVIEWER: "amber", SCHOOL: "cyan", STAFF: "green", STUDENT: "gray"
};

function accountStatusBadge(user: User) {
  const status: AccountStatus = user.accountStatus ?? (user.active === false ? "SUSPENDED_READ_ONLY" : "ACTIVE");
  if (status === "SUSPENDED_READ_ONLY" || user.active === false) {
    return <Badge color="red" variant="soft"><LockClosedIcon /> Tạm khóa (Chỉ xem)</Badge>;
  }
  if (status === "WARNED") {
    return <Badge color="amber" variant="soft"><ExclamationTriangleIcon /> Cảnh báo</Badge>;
  }
  return <Badge color="cyan" variant="soft"><CheckCircledIcon /> Hoạt động</Badge>;
}

export default function AdminDirectory() {
  const canManageManagers = useSessionStore(state => state.user?.role === "ADMIN");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<UserTier>("ALL");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<User | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(query);
  const resource = useResource<AccountPage<User>>("/admin/users/page?" + new URLSearchParams({
    page: String(page - 1), size: String(pageSize), query: search, tier, role, status }));
  const users = resource.data?.items ?? [];
  const counts = resource.data?.counts ?? {};
  const total = resource.data?.totalElements ?? 0;
  const loading = resource.loading;
  const error = resource.error;
  const load = resource.refresh;
  const selected = users.find(item => item.id === selectedId) ?? (selectedSnapshot?.id === selectedId ? selectedSnapshot : undefined);
  const openDetails = (id: number) => { setNotice(""); setSelectedSnapshot(users.find(item => item.id === id) ?? null); setSelectedId(id); };
  const managerSaved = (saved: User, message: string) => {
    const exists = users.some(item => item.id === saved.id);
    load();
    setSelectedSnapshot(saved); setSelectedId(saved.id); setNotice(message);
    if (!exists) { setQuery(""); setTier("SYSTEM"); setRole("MANAGER"); setStatus(""); setPage(1); }
  };

  const tierCounts = { ALL: counts.total ?? 0, SCHOOL: (counts.SCHOOL ?? 0) + (counts.STAFF ?? 0),
    SYSTEM: (counts.ADMIN ?? 0) + (counts.MANAGER ?? 0), INDIVIDUAL: (counts.STUDENT ?? 0) + (counts.REVIEWER ?? 0) };
  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleUsers = users;

  return (
    <div className="directory-main">
      <div className="directory-content">
        {/* Admin may manage Manager accounts; other roles remain read-only. */}
        <div className="directory-heading">
          <div>
            <Flex align="center" gap="3">
              <Heading as="h1" size="7">Tài khoản người dùng</Heading>
              <Badge color="amber" size="2" variant="surface">
                <LearningIcon name="shield" /> Quản lý Manager
              </Badge>
            </Flex>
            <Text as="p" size="2" color="gray" mt="1">
              Tra cứu tài khoản toàn hệ thống. Admin có thể tạo và quản lý Manager; các vai trò khác chỉ được xem.
            </Text>
          </div>
          {canManageManagers && <ManagerAccountActions onSaved={managerSaved} />}
        </div>
        {notice && <Callout.Root color="green" role="status"><Callout.Text>{notice}</Callout.Text></Callout.Root>}

        {/* High-level Stats */}
        <div className="directory-stats" aria-label="Thống kê tài khoản">
          {[
            { label: "Tổng tài khoản", value: (counts.total ?? 0), icon: <PersonIcon /> },
            { label: "Trường học", value: tierCounts.SCHOOL, icon: <LearningIcon name="book" /> },
            { label: "Hệ thống", value: tierCounts.SYSTEM, icon: <LearningIcon name="shield" /> },
            { label: "Cá nhân", value: tierCounts.INDIVIDUAL, icon: <PersonIcon /> },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .035 }} whileHover={{ y: -2 }}>
              <Card size="3" className="directory-stat">
                <Flex justify="between" align="center" gap="3">
                  <Text size="2" color="gray" weight="medium">{stat.label}</Text>
                  <Badge color="gray" size="3" className="directory-stat-icon">{stat.icon}</Badge>
                </Flex>
                <Heading as="h2" size="8" mt="3">{loading ? "—" : stat.value}</Heading>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* View-Only Audit Callout */}
        <div className="directory-readonly-notice" role="status">
          <LockClosedIcon />
          <span>Chọn <strong>Quản lý</strong> trên tài khoản Manager để sửa hồ sơ, đặt lại mật khẩu hoặc khóa/mở tài khoản. Các vai trò khác chỉ cho phép tra cứu.</span>
        </div>

        {/* Full-width User List & Detail Panel */}
        <div className="directory-workspace">
            <Card className="directory-panel" size="1" aria-label="Danh sách tài khoản">
              <div className="directory-panel-heading">
                <div>
                  <Heading as="h2" size="4">
                    {USER_TIERS[tier].label}
                  </Heading>
                  <Text as="p" size="2" color="gray">
                    {loading ? "Đang tải dữ liệu…" : `${total} / ${(counts.total ?? 0)} tài khoản`}
                  </Text>
                </div>
              </div>

              <div className="directory-tier-tabs" role="tablist" aria-label="Lọc theo cấp bậc tài khoản">
                {TIER_ORDER.map(key => {
                  const item = USER_TIERS[key];
                  const isActive = tier === key;
                  return (
                    <button
                      type="button"
                      role="tab"
                      key={key}
                      aria-selected={isActive}
                      className={`directory-tier-tab ${isActive ? "active" : ""}`}
                      onClick={() => { setTier(key); setRole(""); setPage(1); }}
                    >
                      <LearningIcon name={item.icon} />
                      <span>{item.label}</span>
                      <Badge color={isActive ? "indigo" : "gray"} variant="soft" size="1">
                        {loading ? "…" : tierCounts[key]}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Search & Dropdown Filters */}
              <div className="directory-filters">
                <TextField.Root aria-label="Tìm tài khoản" placeholder="Tìm tên, email, mã hoặc trường…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} size="3">
                  <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
                </TextField.Root>

                <Select.Root value={role || "all"} onValueChange={value => { setRole(value === "all" ? "" : value); setPage(1); }} size="3">
                  <Select.Trigger aria-label="Lọc vai trò" />
                  <Select.Content>
                    <Select.Item value="all">Tất cả vai trò</Select.Item>
                    {(tier === "ALL" ? Object.values(ROLE_NAMES) : USER_TIERS[tier].roles).map(value => (
                      <Select.Item key={value} value={value}>{getRoleLabel(value)} ({value})</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>

                <Select.Root value={status || "all"} onValueChange={value => { setStatus(value === "all" ? "" : value); setPage(1); }} size="3">
                  <Select.Trigger aria-label="Lọc trạng thái" />
                  <Select.Content>
                    <Select.Item value="all">Tất cả trạng thái</Select.Item>
                    <Select.Item value="ACTIVE">Hoạt động (ACTIVE)</Select.Item>
                    <Select.Item value="WARNED">Cảnh báo (WARNED)</Select.Item>
                    <Select.Item value="SUSPENDED">Tạm khóa (SUSPENDED)</Select.Item>
                  </Select.Content>
                </Select.Root>

                <IconButton className="directory-refresh" variant="soft" color="gray" size="3" onClick={() => void load()} disabled={loading} aria-label="Làm mới danh sách">
                  <ReloadIcon />
                </IconButton>
              </div>

              {error ? (
                <div className="directory-empty" role="alert">
                  <p>{error}</p>
                  <Button variant="soft" onClick={() => void load()}>Thử lại</Button>
                </div>
              ) : loading ? (
                <TableLoadingSkeleton label="Đang tải tài khoản…" headers={["Người dùng", "Vai trò", "Đơn vị trực thuộc", "Trạng thái", "Chi tiết"]} />
              ) : total === 0 ? (
                <div className="directory-empty">
                  <MagnifyingGlassIcon />
                  <Heading as="h3" size="4">Chưa tìm thấy tài khoản</Heading>
                  <p>Thử tìm theo từ khóa khác hoặc thay đổi nhóm, vai trò hay trạng thái.</p>
                  <Button variant="soft" onClick={() => { setQuery(""); setTier("ALL"); setRole(""); setStatus(""); setPage(1); }}>
                    Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                <Table.Root size="3" className="directory-table">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Người dùng</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Vai trò</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Đơn vị trực thuộc</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell><span className="sr-only">Chi tiết</span></Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {visibleUsers.map(item => (
                      <Table.Row key={item.id} className={selectedId === item.id ? "selected" : ""}>
                        <Table.Cell>
                          <div className="directory-person">
                            <Avatar size="2" src={item.avatarUrl || undefined} color={roleColors[item.role]} fallback={(item.fullName || item.email).slice(0, 1).toUpperCase()} />
                            <div>
                              <Text weight="medium">{item.fullName || "Chưa có họ tên"}</Text>
                              <Text as="div" color="gray" size="2">{item.email}</Text>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex direction="column" gap="1" align="start">
                            <Badge color={roleColors[item.role]}>{getRoleLabel(item.role)}</Badge>
                            <Text size="1" color="gray">{item.role}</Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell><Text size="2" color="gray">{organizationLabel(item)}</Text></Table.Cell>
                        <Table.Cell>
                          {accountStatusBadge(item)}
                        </Table.Cell>
                        <Table.Cell>
                          <Button variant="ghost" aria-label={`${canManageManagers && item.role === "MANAGER" ? "Quản lý Manager" : "Xem chi tiết"} ${item.fullName || item.email}`} onClick={() => openDetails(item.id)}>
                            {canManageManagers && item.role === "MANAGER" ? "Quản lý" : "Xem"} <ArrowRightIcon />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}

              {!error && !loading && total > 0 && (
                <div className="directory-mobile-list" aria-label="Danh sách tài khoản">
                  {visibleUsers.map(item => (
                    <article key={item.id} className={`directory-user-card ${selectedId === item.id ? "selected" : ""}`}>
                      <div className="directory-user-card__identity">
                        <Avatar size="3" src={item.avatarUrl || undefined} color={roleColors[item.role]} fallback={(item.fullName || item.email).slice(0, 1).toUpperCase()} />
                        <div>
                          <Text as="div" weight="medium">{item.fullName || "Chưa có họ tên"}</Text>
                          <Text as="div" color="gray" size="2">{item.email}</Text>
                        </div>
                      </div>
                      <div className="directory-user-card__meta">
                        <Badge color={roleColors[item.role]}>{getRoleLabel(item.role)}</Badge>
                        {accountStatusBadge(item)}
                      </div>
                      <Text as="p" size="2" color="gray" className="directory-user-card__organization">{organizationLabel(item)}</Text>
                      <Button variant="soft" onClick={() => openDetails(item.id)}>{canManageManagers && item.role === "MANAGER" ? "Quản lý" : "Xem chi tiết"} <ArrowRightIcon /></Button>
                    </article>
                  ))}
                </div>
              )}

              {!error && !loading && total > 0 && (
                <div className="directory-pagination">
                  <Text size="2" color="gray" aria-live="polite">
                    Hiển thị {pageStart + 1}–{Math.min(pageStart + pageSize, total)} / {total} tài khoản
                  </Text>
                  <div className="directory-pagination__controls">
                    <label>
                      <Text size="2" color="gray">Số dòng/trang</Text>
                      <Select.Root value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }} size="2">
                        <Select.Trigger aria-label="Số tài khoản trên mỗi trang" />
                        <Select.Content>
                          {DIRECTORY_PAGE_SIZES.map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}
                        </Select.Content>
                      </Select.Root>
                    </label>
                    <Button variant="soft" color="gray" size="2" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button>
                    <Text size="2">Trang {currentPage}/{pageCount}</Text>
                    <Button variant="soft" color="gray" size="2" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Sau</Button>
                  </div>
                </div>
              )}

              <footer className="directory-table-footer">
                <LearningIcon name="shield" />
                <span>Admin quản lý tài khoản Manager · Các vai trò khác chỉ được xem</span>
              </footer>
            </Card>

            {/* Open details immediately in view instead of below the full account list. */}
            <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}>
              {selected && (
                <Dialog.Content className={modal.dialog} maxWidth="880px" aria-describedby={undefined}>
                  <div className={`${modal.body} directory-detail`}>
                    <Flex justify="between" align="center" mb="4">
                      <div>
                        <Dialog.Title size="4">Chi tiết tài khoản</Dialog.Title>
                        <Badge color={canManageManagers && selected.role === "MANAGER" ? "indigo" : "amber"} size="1" variant="surface">{canManageManagers && selected.role === "MANAGER" ? "Có thể quản lý" : "Chỉ xem"}</Badge>
                      </div>
                      <IconButton variant="ghost" color="gray" aria-label="Đóng chi tiết" onClick={() => setSelectedId(null)}>
                        <Cross2Icon />
                      </IconButton>
                    </Flex>

                    {notice && <Callout.Root color="green" role="status" mb="4"><Callout.Text>{notice}</Callout.Text></Callout.Root>}

                    <div className="directory-detail-identity">
                      <Avatar size="5" src={selected.avatarUrl || undefined} color={roleColors[selected.role]} fallback={(selected.fullName || selected.email).slice(0, 1).toUpperCase()} />
                      <Heading as="h3" size="4" mt="3" mb="1">{selected.fullName || "Chưa có họ tên"}</Heading>
                      <Flex justify="center" gap="2" mt="1">
                        <Badge color={roleColors[selected.role]}>{getRoleLabel(selected.role)}</Badge>
                        <Badge color="gray">{USER_TIERS[getUserTier(selected.role)].label.split(" ")[0]}</Badge>
                      </Flex>
                    </div>

                    {canManageManagers && selected.role === "MANAGER" && <div style={{ marginBottom: 20 }}><ManagerAccountActions key={selected.id} user={selected} onSaved={managerSaved} /></div>}
                    <dl>
                      {[
                        ["Mã tài khoản", `#${selected.id}`],
                        ["Email", selected.email],
                        ["Nhóm tài khoản", USER_TIERS[getUserTier(selected.role)].label],
                        ["Vai trò", `${getRoleLabel(selected.role)} (${selected.role})`],
                        ["Trạng thái", selected.accountStatus ?? (selected.active === false ? "SUSPENDED_READ_ONLY" : "ACTIVE")],
                        ...(selected.suspensionReason ? [["Lý do tạm khóa", selected.suspensionReason]] : []),
                        ...(selected.suspendedUntil ? [["Thời hạn khóa", formatDate(selected.suspendedUntil)]] : []),
                        ["Trường / Tổ chức", organizationLabel(selected)],
                        ["Ngày sinh", selected.dateOfBirth ? new Date(`${selected.dateOfBirth}T00:00:00`).toLocaleDateString("vi-VN") : "Chưa cập nhật"],
                        ["Đăng nhập gần nhất", formatDate(selected.lastLogin)],
                        ...(permissionsForRole(selected.role).length > 0 ? [["Quyền cấp phát", permissionSummary(selected)]] : []),
                        ["Đổi mật khẩu", selected.mustChangePassword ? "Bắt buộc khi đăng nhập lại" : "Đã hoàn tất"],
                      ].map(([lbl, val]) => (
                        <div key={lbl}>
                          <dt>{lbl}</dt>
                          <dd>{val}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Dialog.Content>
              )}
            </Dialog.Root>
        </div>
      </div>
    </div>
  );
}
