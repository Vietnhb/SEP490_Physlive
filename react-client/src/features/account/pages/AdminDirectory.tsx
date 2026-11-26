import { useState } from "react";
import { Badge, Callout, Dialog, Flex, Heading, IconButton } from "@radix-ui/themes";
import {
  CheckCircledIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import type { AccountPage } from "../../../shared/api/page";
import { ROLE_NAMES, getRoleLabel } from "../../../shared/auth/roles";
import type { User, AccountStatus } from "../../../shared/auth/types";
import { permissionSummary, permissionsForRole } from "../../../shared/auth/permissions";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import ManagerAccountActions from "../components/ManagerAccountActions";
import UsersArt from "../components/UsersArt";
import modal from "../../../shared/ui/ModalScroll.module.css";
import PageActions from "../../../shared/layout/PageActions";
import s from "./AdminDirectory.module.css";

type UserTier = "ALL" | "SYSTEM" | "SCHOOL" | "INDIVIDUAL";

const USER_TIERS: Record<UserTier, { id: UserTier; label: string; roles: string[]; hint: string }> = {
  ALL: {
    id: "ALL",
    label: "Tất cả tài khoản",
    roles: [],
    hint: "Toàn bộ tài khoản trong nền tảng. Bạn chỉ quản lý được tài khoản Vận hành; các vai trò khác chỉ xem.",
  },
  SYSTEM: {
    id: "SYSTEM",
    label: "Tài khoản nền tảng",
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.MANAGER],
    hint: "Quản trị viên nền tảng và quản lý vận hành. Bạn có thể tạo mới, sửa hồ sơ, đặt lại mật khẩu và khóa/mở khóa tài khoản Vận hành.",
  },
  SCHOOL: {
    id: "SCHOOL",
    label: "Tài khoản trường",
    roles: [ROLE_NAMES.SCHOOL, ROLE_NAMES.STAFF],
    hint: "Tài khoản đại diện trường và giáo viên bộ môn. Chế độ chỉ xem ở cấp Quản trị hệ thống.",
  },
  INDIVIDUAL: {
    id: "INDIVIDUAL",
    label: "Cá nhân",
    roles: [ROLE_NAMES.STUDENT, ROLE_NAMES.REVIEWER],
    hint: "Học sinh và chuyên gia thẩm định độc lập. Chế độ chỉ xem ở cấp Quản trị hệ thống.",
  },
};

const TIER_ORDER: UserTier[] = ["ALL", "SYSTEM", "SCHOOL", "INDIVIDUAL"];
const DIRECTORY_PAGE_SIZES = [10, 25, 50, 100] as const;

function getUserTier(role: string): "SYSTEM" | "SCHOOL" | "INDIVIDUAL" {
  if (role === ROLE_NAMES.ADMIN || role === ROLE_NAMES.MANAGER) return "SYSTEM";
  if (role === ROLE_NAMES.SCHOOL || role === ROLE_NAMES.STAFF) return "SCHOOL";
  return "INDIVIDUAL";
}

function getInitials(fullName?: string | null, email?: string) {
  const source = (fullName || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email || "?").slice(0, 2).toUpperCase();
}

function roleStyleClass(role: string) {
  switch (role) {
    case ROLE_NAMES.STUDENT:
      return s.roleStudent;
    case ROLE_NAMES.STAFF:
      return s.roleStaff;
    case ROLE_NAMES.SCHOOL:
      return s.roleSchool;
    case ROLE_NAMES.MANAGER:
      return s.roleManager;
    case ROLE_NAMES.REVIEWER:
      return s.roleReviewer;
    default:
      return s.roleAdmin;
  }
}

const formatDate = (date?: string | null) => (date ? new Date(date).toLocaleString("vi-VN") : "Chưa có thông tin");
const organizationLabel = (user: User) =>
  user.schoolName || user.schoolId || user.institutionId || (getUserTier(user.role) === "SYSTEM" ? "Nền tảng PhysLive" : "Chưa cập nhật");

function accountStatus(user: User): AccountStatus {
  return user.accountStatus ?? (user.active === false ? "SUSPENDED_READ_ONLY" : "ACTIVE");
}

function statusLabel(user: User) {
  const st = accountStatus(user);
  if (st === "SUSPENDED_READ_ONLY" || user.active === false) return "Tạm khóa (chỉ xem, không thao tác được)";
  return st === "WARNED" ? "Đã bị cảnh báo" : "Hoạt động";
}

function StatusPill({ user }: Readonly<{ user: User }>) {
  const st = accountStatus(user);
  if (st === "SUSPENDED_READ_ONLY" || user.active === false) {
    return (
      <span className={`${s.statusPill} ${s.stSuspended}`}>
        <LockClosedIcon width={12} height={12} /> Tạm khóa
      </span>
    );
  }
  if (st === "WARNED") {
    return (
      <span className={`${s.statusPill} ${s.stWarn}`}>
        <ExclamationTriangleIcon width={12} height={12} /> Cảnh báo
      </span>
    );
  }
  return (
    <span className={`${s.statusPill} ${s.stActive}`}>
      <CheckCircledIcon width={12} height={12} /> Hoạt động
    </span>
  );
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
  const resource = useResource<AccountPage<User>>(
    "/admin/users/page?" +
      new URLSearchParams({
        page: String(page - 1),
        size: String(pageSize),
        query: search,
        tier,
        role,
        status,
      })
  );

  const users = resource.data?.items ?? [];
  const counts = resource.data?.counts ?? {};
  const total = resource.data?.totalElements ?? 0;
  const loading = resource.loading;
  const error = resource.error;
  const load = resource.refresh;

  const selected = users.find(item => item.id === selectedId) ?? (selectedSnapshot?.id === selectedId ? selectedSnapshot : undefined);
  const openDetails = (id: number) => {
    setNotice("");
    setSelectedSnapshot(users.find(item => item.id === id) ?? null);
    setSelectedId(id);
  };

  const managerSaved = (saved: User, message: string) => {
    const exists = users.some(item => item.id === saved.id);
    load();
    setSelectedSnapshot(saved);
    setSelectedId(saved.id);
    setNotice(message);
    if (!exists) {
      setQuery("");
      setTier("SYSTEM");
      setRole("MANAGER");
      setStatus("");
      setPage(1);
    }
  };

  const tierCounts: Record<UserTier, number> = {
    ALL: counts.total ?? 0,
    SYSTEM: (counts.ADMIN ?? 0) + (counts.MANAGER ?? 0),
    SCHOOL: (counts.SCHOOL ?? 0) + (counts.STAFF ?? 0),
    INDIVIDUAL: (counts.STUDENT ?? 0) + (counts.REVIEWER ?? 0),
  };

  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRoles = tier === "ALL" ? Object.values(ROLE_NAMES) : USER_TIERS[tier].roles;

  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div className={s.headingText}>
          <h1 className={s.title}>Tài khoản người dùng</h1>
          <p className={s.subtitle}>Xem mọi tài khoản theo nhóm. Chỉ tài khoản Vận hành do Quản trị hệ thống quản lý.</p>
        </div>
        <div className={s.headingRight}>
          {canManageManagers && (
            <PageActions>
              <ManagerAccountActions onSaved={managerSaved} />
            </PageActions>
          )}
          <div className={s.headerArt}>
            <UsersArt />
          </div>
        </div>
      </header>

      {notice && (
        <Callout.Root color="green" role="status">
          <Callout.Text>{notice}</Callout.Text>
        </Callout.Root>
      )}

      <section className={s.card} aria-label="Danh sách tài khoản">
        {/* Underline Tier Filter Tabs */}
        <div className={s.ftabs} role="tablist" aria-label="Lọc theo cấp bậc tài khoản">
          {TIER_ORDER.map(key => {
            const item = USER_TIERS[key];
            const isActive = tier === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${s.tab} ${isActive ? s.tabActive : ""}`}
                onClick={() => {
                  setTier(key);
                  setRole("");
                  setPage(1);
                }}
              >
                <span>{item.label}</span>
                <span className={s.tabCount}>{loading && !resource.data ? "…" : tierCounts[key].toLocaleString("vi-VN")}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tier Hint */}
        <div className={s.tierHint}>{USER_TIERS[tier].hint}</div>

        {/* Search & Dropdown Toolbar */}
        <div className={s.toolbar}>
          <div className={s.searchWrap}>
            <MagnifyingGlassIcon className={s.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={s.searchInput}
              aria-label="Tìm tài khoản"
              placeholder="Tìm tên, email, mã hoặc trường…"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className={s.filterSelect}
            aria-label="Lọc vai trò"
            value={role}
            onChange={e => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {visibleRoles.map(value => (
              <option key={value} value={value}>
                {getRoleLabel(value)}
              </option>
            ))}
          </select>

          <select
            className={s.filterSelect}
            aria-label="Lọc trạng thái"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="WARNED">Cảnh báo</option>
            <option value="SUSPENDED">Tạm khóa</option>
          </select>

          <button
            type="button"
            className={s.iconBtn}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Làm mới danh sách"
            title="Làm mới danh sách"
          >
            <ReloadIcon width={15} height={15} className={loading ? s.spin : undefined} />
          </button>
        </div>

        {/* Table / States */}
        {error ? (
          <div className={s.emptyState} role="alert">
            <p>{error}</p>
            <button type="button" className={s.surfaceBtn} onClick={() => void load()}>
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: "16px 20px" }}>
            <TableLoadingSkeleton
              label="Đang tải tài khoản…"
              headers={["Người dùng", "Vai trò", "Đơn vị trực thuộc", "Trạng thái", "Chi tiết"]}
            />
          </div>
        ) : total === 0 ? (
          <div className={s.emptyState}>
            <MagnifyingGlassIcon width={24} height={24} />
            <h3>Chưa tìm thấy tài khoản</h3>
            <p>Thử tìm theo từ khóa khác hoặc thay đổi nhóm, vai trò hay trạng thái.</p>
            <button
              type="button"
              className={s.surfaceBtn}
              onClick={() => {
                setQuery("");
                setTier("ALL");
                setRole("");
                setStatus("");
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Đơn vị trực thuộc</th>
                    <th>Trạng thái</th>
                    <th>
                      <span className={s.srOnly}>Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(item => {
                    const isManagerActionable = canManageManagers && item.role === "MANAGER";
                    const roleCls = roleStyleClass(item.role);
                    return (
                      <tr key={item.id} className={selectedId === item.id ? s.selectedRow : undefined}>
                        <td>
                          <div className={s.person}>
                            <span className={`${s.avatar} ${roleCls}`} aria-hidden="true">
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt="" className={s.avatarImg} />
                              ) : (
                                getInitials(item.fullName, item.email)
                              )}
                            </span>
                            <div className={s.personMeta}>
                              <span className={s.personName}>{item.fullName || "Chưa có họ tên"}</span>
                              <span className={s.personEmail}>{item.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`${s.tag} ${roleCls}`}>{getRoleLabel(item.role)}</span>
                        </td>
                        <td>
                          <div className={s.orgText} title={organizationLabel(item)}>
                            {organizationLabel(item)}
                          </div>
                        </td>
                        <td>
                          <StatusPill user={item} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={isManagerActionable ? s.primaryBtn : s.surfaceBtn}
                            aria-label={`${isManagerActionable ? "Quản lý tài khoản vận hành" : "Xem chi tiết"} ${item.fullName || item.email}`}
                            onClick={() => openDetails(item.id)}
                          >
                            {isManagerActionable ? "Quản lý" : "Xem chi tiết"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className={s.mobileList} aria-label="Danh sách tài khoản">
              {users.map(item => {
                const isManagerActionable = canManageManagers && item.role === "MANAGER";
                const roleCls = roleStyleClass(item.role);
                return (
                  <article key={item.id} className={`${s.mobileCard} ${selectedId === item.id ? s.mobileCardSelected : ""}`}>
                    <div className={s.person}>
                      <span className={`${s.avatar} ${roleCls}`} aria-hidden="true">
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} alt="" className={s.avatarImg} />
                        ) : (
                          getInitials(item.fullName, item.email)
                        )}
                      </span>
                      <div className={s.personMeta}>
                        <span className={s.personName}>{item.fullName || "Chưa có họ tên"}</span>
                        <span className={s.personEmail}>{item.email}</span>
                      </div>
                    </div>
                    <div className={s.mobileMeta}>
                      <span className={`${s.tag} ${roleCls}`}>{getRoleLabel(item.role)}</span>
                      <StatusPill user={item} />
                    </div>
                    <div className={s.orgText}>{organizationLabel(item)}</div>
                    <button
                      type="button"
                      className={isManagerActionable ? s.primaryBtn : s.surfaceBtn}
                      onClick={() => openDetails(item.id)}
                    >
                      {isManagerActionable ? "Quản lý" : "Xem chi tiết"}
                    </button>
                  </article>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className={s.pager}>
              <span aria-live="polite">
                Hiển thị {(pageStart + 1).toLocaleString("vi-VN")}–{Math.min(pageStart + pageSize, total).toLocaleString("vi-VN")} /{" "}
                {total.toLocaleString("vi-VN")} tài khoản
              </span>
              <div className={s.pagerControls}>
                <label className={s.pageSizeLabel}>
                  <span>Số dòng/trang</span>
                  <select
                    className={s.pageSizeSelect}
                    aria-label="Số tài khoản trên mỗi trang"
                    value={String(pageSize)}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {DIRECTORY_PAGE_SIZES.map(size => (
                      <option key={size} value={String(size)}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={s.surfaceBtn}
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Trước
                </button>
                <span className={s.pageInfo}>
                  Trang {currentPage.toLocaleString("vi-VN")}/{pageCount.toLocaleString("vi-VN")}
                </span>
                <button
                  type="button"
                  className={s.surfaceBtn}
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Sau
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Account Detail Dialog */}
      <Dialog.Root
        open={!!selected}
        onOpenChange={open => {
          if (!open) setSelectedId(null);
        }}
      >
        {selected && (
          <Dialog.Content className={modal.dialog} maxWidth="780px" aria-describedby={undefined}>
            <div className={`${modal.body} ${s.detailBody}`}>
              <Flex justify="between" align="center" mb="4">
                <Flex align="center" gap="2">
                  <Dialog.Title size="4" mb="0">
                    Chi tiết tài khoản
                  </Dialog.Title>
                  <Badge color={canManageManagers && selected.role === "MANAGER" ? "teal" : "amber"} size="1" variant="soft">
                    {canManageManagers && selected.role === "MANAGER" ? "Có thể quản lý" : "Chỉ xem"}
                  </Badge>
                </Flex>
                <IconButton variant="ghost" color="gray" aria-label="Đóng chi tiết" onClick={() => setSelectedId(null)}>
                  <Cross2Icon />
                </IconButton>
              </Flex>

              {notice && (
                <Callout.Root color="green" role="status" mb="4">
                  <Callout.Text>{notice}</Callout.Text>
                </Callout.Root>
              )}

              <div className={s.detailIdentity}>
                <span className={`${s.avatar} ${s.detailAvatar} ${roleStyleClass(selected.role)}`} aria-hidden="true">
                  {selected.avatarUrl ? (
                    <img src={selected.avatarUrl} alt="" className={s.avatarImg} />
                  ) : (
                    getInitials(selected.fullName, selected.email)
                  )}
                </span>
                <Heading as="h3" size="4" mt="3" mb="2">
                  {selected.fullName || "Chưa có họ tên"}
                </Heading>
                <Flex justify="center" gap="2" wrap="wrap">
                  <span className={`${s.tag} ${roleStyleClass(selected.role)}`}>{getRoleLabel(selected.role)}</span>
                  <StatusPill user={selected} />
                </Flex>
              </div>

              {canManageManagers && selected.role === "MANAGER" && (
                <div style={{ marginBottom: 20 }}>
                  <ManagerAccountActions key={selected.id} user={selected} onSaved={managerSaved} />
                </div>
              )}

              <dl className={s.detailList}>
                {[
                  ["Mã tài khoản", `#${selected.id}`],
                  ["Email", selected.email],
                  ["Nhóm tài khoản", USER_TIERS[getUserTier(selected.role)].label],
                  ["Vai trò", getRoleLabel(selected.role)],
                  ["Trạng thái", statusLabel(selected)],
                  ...(selected.suspensionReason ? [["Lý do tạm khóa", selected.suspensionReason]] : []),
                  ...(selected.suspendedUntil ? [["Thời hạn khóa", formatDate(selected.suspendedUntil)]] : []),
                  ["Trường / Tổ chức", organizationLabel(selected)],
                  [
                    "Ngày sinh",
                    selected.dateOfBirth ? new Date(`${selected.dateOfBirth}T00:00:00`).toLocaleDateString("vi-VN") : "Chưa cập nhật",
                  ],
                  ["Đăng nhập gần nhất", formatDate(selected.lastLogin)],
                  ...(permissionsForRole(selected.role).length > 0 ? [["Quyền cấp phát", permissionSummary(selected)]] : []),
                  ["Đổi mật khẩu", selected.mustChangePassword ? "Bắt buộc khi đăng nhập lại" : "Đã hoàn tất"],
                ].map(([lbl, val]) => (
                  <div key={lbl} className={s.detailItem}>
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
  );
}
