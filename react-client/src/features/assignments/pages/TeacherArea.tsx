import { useResource } from "../../../shared/hooks/operationsData";
import { StudioIcon } from "../components/StudioIcon";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Theme } from "@radix-ui/themes";
import { useEffectiveTheme, useThemeStore, type ThemeMode } from "../../../shared/theme/themeStore";
import { createPortal } from "react-dom";
import { useStudioPortal } from "../components/useStudioPortal";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import PageActionsTarget from "../../../shared/layout/PageActionsTarget";
import FallbackHeading from "../../../shared/layout/FallbackHeading";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { canTeach, isDepartmentHead } from "../../../shared/auth/permissions";
import { clearToken } from "../../../shared/lib/token";
import type { SimulationComplaint } from "../../support/api/supportApi";
import StudioSprite from "../components/StudioSprite";
import "../../support/styles/complaints.css";
import "../../simulation/styles/learning.css";
import "../../simulation/styles/lab.css";
import "../styles/studio-canvas.css";
import "../styles/studio-lab.css";
export { default as TeacherComplaintsPage } from "./TeacherComplaintsPage";

const complaintsOnly = (items: SimulationComplaint[]) =>
  items.filter((item) => item.kind === "COMPLAINT");

type NavItem = { to: string; label: string; icon: string; end?: boolean; count?: number };
type NavGroup = { label: string; items: NavItem[] };

/** An icon of the design canvas's sprite. */
export { StudioIcon };

const initials = (name = "") => name.trim().split(/\s+/).slice(-2).map(part => part[0]?.toUpperCase() ?? "").join("");

/**
 * Teacher area: the shell of the design canvas (teacher), markup for markup — side bar with brand, "Giao bài mới",
 * the grouped menu and the account; main column with the top bar (breadcrumb, page actions, settings).
 */
const FOLD_KEY = "physlive.teacher.sideFolded";

export default function TeacherAreaLayout({ children, mini = false }: Readonly<{ children?: ReactNode; mini?: boolean }> = {}) {
  const user = useSessionStore((state) => state.user);
  const appearance = useEffectiveTheme();
  const navigate = useNavigate();
  // A reply can come from Manager or Reviewer; referral alone is not a reply.
  // a department head without the teaching permission has no simulations, classes or complaints of their own
  const teaches = canTeach(user);
  const supportResource = useResource<SimulationComplaint[]>("/support/mine", teaches);
  const answered = complaintsOnly(supportResource.data ?? []).filter(item => item.status === "READ" && item.adminResponse?.trim()).length;
  const [settings, setSettings] = useState(false);
  // the side bar folds to its icon rail on request (remembered in this browser); the simulation workspace starts folded
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem(FOLD_KEY) === "1"; } catch { return false; } });
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const isMini = mini ? !workspaceOpen : folded;
  const toggleSide = () => {
    if (mini) { setWorkspaceOpen(value => !value); return; }
    setFolded(value => { try { localStorage.setItem(FOLD_KEY, value ? "0" : "1"); } catch { /* private mode: folding still works for this visit */ } return !value; });
  };
  const settingsRef = useRef<HTMLSpanElement>(null);
  // the account card opens a small menu (profile, support, sign out) instead of jumping straight to the profile page
  const [account, setAccount] = useState<{ left: number; bottom: number } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // the menu lives outside the side bar: the folded rail clips sideways and the main column would cover it
  const [accountAnchor, setAccountAnchor] = useState<HTMLDivElement | null>(null);
  const accountPortal = useStudioPortal(accountAnchor);
  useEffect(() => {
    if (!account) return;
    const away = (event: MouseEvent) => { const target = event.target as Node; if (!accountRef.current?.contains(target) && !accountMenuRef.current?.contains(target)) setAccount(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccount(null); accountRef.current?.querySelector<HTMLButtonElement>(".acct")?.focus(); } };
    const close = () => setAccount(null);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", escape); window.removeEventListener("resize", close); };
  }, [account]);
  const openAccount = (button: HTMLElement) => {
    if (account) { setAccount(null); return; }
    const rect = button.getBoundingClientRect();
    // on the icon rail the menu opens beside the avatar; otherwise it rises above the card, aligned with it
    setAccount(isMini ? { left: rect.right + 8, bottom: window.innerHeight - rect.bottom } : { left: rect.left, bottom: window.innerHeight - rect.top + 6 });
  };
  const go = (to: string) => { setAccount(null); navigate(to); };
  useEffect(() => {
    if (!settings) return;
    const away = (event: MouseEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettings(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSettings(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", escape); };
  }, [settings]);

  const { pathname } = useLocation();
  const nav: NavGroup[] = !teaches ? [
    { label: "Quản lý chuyên môn", items: [{ to: "/department", label: "Tổ bộ môn", icon: "shield" }] },
  ] : [
    { label: "", items: [
      { to: "/teacher", label: "Tổng quan", icon: "grid", end: true },
    ] },
    // simulations are what the product is about, so they come first and the big button makes a new one
    { label: "Mô phỏng", items: [
      { to: "/workspace", label: "Mô phỏng", icon: "atom" },
      { to: "/lab/library", label: "Mô phỏng của tôi", icon: "folder" },
      { to: "/lab/community", label: "Cộng đồng", icon: "star" },
    ] },
    { label: "Giảng dạy", items: [
      { to: "/assignments/workspace", label: "Giao bài mới", icon: "plus" },
      // a class holds its students, its assignments and their grading, its gradebook and its report: one entry
      { to: "/lab/classes", label: "Lớp học", icon: "users" },
      ...(isDepartmentHead(user) && user?.schoolId ? [{ to: "/lab/department", label: "Tổ bộ môn", icon: "shield" }] : []),
    ] },
    { label: "Hỗ trợ", items: [
      { to: "/lab/complaints", label: "Khiếu nại đã gửi", icon: "message", count: answered },
    ] },
  ];
  const matches = (item: NavItem) => item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  const group = nav.find(entry => entry.items.some(matches));
  const current = nav.flatMap(entry => entry.items).filter(matches).sort((a, b) => b.to.length - a.to.length)[0];
  const composing = pathname.startsWith("/assignments/workspace");
  const crumbs = composing ? ["Giáo viên", "Giảng dạy", "Giao bài mới"] : [teaches ? "Giáo viên" : "Tổ trưởng", ...(group?.label && group.label !== current?.label ? [group.label] : []), current?.label ?? "Tổng quan"];
  const logout = () => { clearToken(); useSessionStore.getState().setUser(null); navigate("/login", { replace: true }); };
  // pages already written in canvas markup (they render their own main.page)
  const ownPage = ["/teacher", "/lab", "/lab/library", "/lab/reports", "/lab/classes"].includes(pathname) || pathname.startsWith("/lab/classes/");

  return (
    <div className={"studio-root app" + (appearance === "dark" ? " dark" : "")}>
      <StudioSprite />
      <aside className={"side" + (isMini ? " side-mini" : "")}>
        <Link className="brand" to={teaches ? "/teacher" : "/department"} aria-label="PhysLive — về trang chủ"><img className="logo" src="/studio/logo.png" alt="" /><span className="side-txt"><b>PhysLive</b><small>Phòng học tương tác</small></span></Link>
        {/* a fresh state each click: the workspace clears whatever simulation is open and waits for a new description */}
        {teaches && <Link className="side-create" to="/workspace" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate("/workspace", { state: { fresh: Date.now() } }); }}>
          <span className="side-create-ic"><StudioIcon name="throw" /></span>
          <span className="side-txt"><b>Mô phỏng mới</b><small>Dựng từ đề bài vật lý</small></span>
        </Link>}
        <nav className="nav" aria-label="Menu giáo viên">
          {nav.map(entry => <div className="nav-group" key={entry.label || "home"}>
            <p className="nav-label" style={{ display: entry.label ? "block" : "none" }}>{entry.label}</p>
            {entry.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} className="nav-item" title={isMini ? item.label : undefined} aria-current={matches(item) && item === current ? "page" : "false"}>
              <StudioIcon name={item.icon} /><span>{item.label}</span>
              <span className="count" style={{ display: item.count ? "inline-block" : "none" }}>{item.count}</span>
            </NavLink>)}
          </div>)}
        </nav>
        <div ref={element => { accountRef.current = element; setAccountAnchor(element); }} className="acct-wrap">
          <button type="button" className="acct" aria-haspopup="menu" aria-expanded={Boolean(account)} aria-label={`Tài khoản: ${user?.fullName ?? ""}`} title={isMini ? user?.fullName : undefined}
            onClick={event => openAccount(event.currentTarget)}>
            <span className="avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user?.fullName)}</span>
            <span className="side-txt"><b>{user?.fullName}</b><small>{!teaches ? "Tổ trưởng bộ môn" : isDepartmentHead(user) ? "Giáo viên · Tổ trưởng" : "Giáo viên"}</small></span>
            <StudioIcon name="chevron-down" />
          </button>
          {account && createPortal(<div ref={accountMenuRef} className="menu acct-menu" role="menu" aria-label="Tài khoản" style={{ left: account.left, bottom: account.bottom }}>
            <div className="acct-menu-head">
              <span className="avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user?.fullName)}</span>
              <span><b className="clamp-1">{user?.fullName}</b><small className="clamp-1">{user?.email}</small></span>
            </div>
            <hr />
            <button type="button" role="menuitem" autoFocus onClick={() => go("/profile")}><StudioIcon name="user" />Hồ sơ cá nhân</button>
            {teaches ? <button type="button" role="menuitem" onClick={() => go("/lab/complaints")}><StudioIcon name="message" />Khiếu nại đã gửi</button>
              : <button type="button" role="menuitem" onClick={() => go("/support")}><StudioIcon name="message" />Hỗ trợ</button>}
            <hr />
            <button type="button" role="menuitem" className="danger" onClick={logout}><StudioIcon name="logout" />Đăng xuất</button>
          </div>, accountPortal)}
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button type="button" className="btn btn-ghost btn-sm btn-icon side-toggle" aria-label={isMini ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} title={isMini ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!isMini} onClick={toggleSide}><StudioIcon name="panel" /></button>
          <p className="crumbs">{crumbs.map((label, index) => <Fragment key={label + index}>
            <span aria-hidden="true" style={{ display: index ? "inline" : "none" }}>/</span><span className={index === crumbs.length - 1 ? "cur" : ""}>{label}</span>
          </Fragment>)}</p>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <PageActionsTarget />
            <span ref={settingsRef} style={{ position: "relative" }}>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Cài đặt không gian làm việc" aria-haspopup="menu" aria-expanded={settings} onClick={() => setSettings(open => !open)}><StudioIcon name="settings" /></button>
              {settings && <div className="menu" role="menu" aria-label="Cài đặt" style={{ top: "calc(100% + 6px)", right: 0, minWidth: 280 }}>
                <div className="menu-l">Giao diện</div>
                <div style={{ padding: "4px 6px 6px" }}><ThemeChoice /></div>
                <hr />
                <button type="button" role="menuitem" onClick={() => { setSettings(false); navigate("/profile"); }}><StudioIcon name="user" />Hồ sơ cá nhân</button>
                <button type="button" role="menuitem" onClick={() => { setSettings(false); navigate("/support"); }}><StudioIcon name="message" />Hỗ trợ &amp; khiếu nại</button>
                <hr />
                <button type="button" role="menuitem" className="danger" onClick={logout}><StudioIcon name="logout" />Đăng xuất</button>
              </div>}
            </span>
          </div>
        </div>
        {/* pages written in canvas markup render their own main.page; the others keep their own styles */}
        {children ? (mini ? <div className="workspace-embed">{children}</div> : children)
          : ownPage ? <Outlet /> : <div className="legacy learning-app"><FallbackHeading title={current?.label ?? "Giáo viên"} /><Outlet /></div>}
      </div>
    </div>
  );
}

/** Pages built with Radix Themes need its variables; teacher pages are otherwise plain CSS. */
export function TeacherThemed({ children }: Readonly<{ children: ReactNode }>) {
  const appearance = useEffectiveTheme();
  return (
    <Theme
      appearance={appearance}
      accentColor="indigo"
      grayColor="slate"
      radius="large"
      scaling="100%"
      hasBackground={false}
    >
      {children}
    </Theme>
  );
}

/** Light, dark or follow the device — the canvas segmented control; the switch animates out from the pressed button. */
function ThemeChoice() {
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  const options: [ThemeMode, string][] = [["light", "Sáng"], ["dark", "Tối"], ["system", "Hệ thống"]];
  return <div className="seg" role="group" aria-label="Giao diện" style={{ display: "flex", width: "100%" }}>{options.map(([value, label]) =>
    <button key={value} type="button" aria-pressed={mode === value} style={{ flex: 1, justifyContent: "center" }}
      onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMode(value, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }}>{label}</button>)}</div>;
}
