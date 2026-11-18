import { useEffect, useState, type ReactNode, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import LearningIcon from "../ui/LearningIcon";
import BrandMark from "../ui/BrandMark";
import ThemeToggle from "../theme/ThemeToggle";
import AccountMenu from "./AccountMenu";
import MobileTabBar from "./MobileTabBar";
import "./AppSidebar.css";
import { PageBreadcrumbContext, type PageBreadcrumb } from "./PageBreadcrumbContext";
import { PageActionsSlot } from "./PageActionsContext";

type IconName = Parameters<typeof LearningIcon>[0]["name"];

export type SidebarItem = {
  to: string;
  label: string;
  icon: IconName;
  /** Match the path exactly (use for a section's index page). */
  end?: boolean;
  /** Count of things waiting; hidden when 0 or undefined. */
  badge?: number;
  /** Page heading when it should differ from the menu label. */
  title?: string;
  /** Optional breadcrumb shown when the current URL is below this item's route. */
  childTitle?: string;
};
export type SidebarGroup = { label?: string; items: SidebarItem[] };

type Props = {
  /** Unique per area so the sliding highlight does not jump between layouts. */
  id: string;
  /** Line under the product name, e.g. "Kiểm duyệt". */
  subtitle: string;
  home: string;
  groups: SidebarGroup[];
  /** Extra controls on the right of the top bar (notifications…). */
  actions?: ReactNode;
  /** Classes for the content column, so each area keeps its own page styles. */
  contentClassName?: string;
  shellClassName?: string;
  /** Where to render the user account menu. Defaults to "sidebar". Use "topbar" to place a workspace-style avatar menu in the topbar actions. */
  accountPlacement?: "sidebar" | "topbar";
  /** Whether to show the theme button in topbar actions. Defaults to false when accountPlacement is 'topbar', true otherwise. */
  showThemeToggle?: boolean;
  children?: ReactNode;
};

const STORAGE_KEY = "physlive.sidebar";
const readCollapsed = () => { try { return localStorage.getItem(STORAGE_KEY) === "collapsed"; } catch { return false; } };
function isActive(pathname: string, item: SidebarItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/**
 * Application shell for signed-in areas: a collapsible sidebar with grouped
 * sections, count badges and a user menu, plus a slim top bar. Each role passes
 * its own groups; every item is a real route.
 */
export default function AppSidebarLayout({ id, subtitle, home, groups, actions, contentClassName = "", shellClassName = "", accountPlacement = "sidebar", showThemeToggle = accountPlacement !== "topbar", children }: Readonly<Props>) {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // The drawer belongs to the page it was opened on; navigating closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [pageBreadcrumb, setPageBreadcrumb] = useState<PageBreadcrumb>();
  const [pageActions, setPageActions] = useState<HTMLDivElement | null>(null);
  const drawerOpen = drawerPath === pathname;
  // a page that names itself keeps its own heading; one that does not gets the menu name as its heading
  const contentRef = useRef<HTMLDivElement>(null);
  const [ownHeading, setOwnHeading] = useState(true);
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const check = () => setOwnHeading(Boolean(content.querySelector("h1:not([data-layout-heading])")));
    check();
    const observer = new MutationObserver(check);
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const toggleCollapsed = () => setCollapsed(value => {
    try { localStorage.setItem(STORAGE_KEY, value ? "expanded" : "collapsed"); } catch { /* keep for this visit */ }
    return !value;
  });

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") { event.preventDefault(); toggleCollapsed(); }
      if (event.key === "Escape") setDrawerPath(null);
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);

  const items = groups.flatMap(group => group.items);
  const current = items.filter(item => isActive(pathname, item)).sort((a, b) => b.to.length - a.to.length)[0];
  // a detail page's own name (set by the page), else the item's generic child name on nested routes
  const childCrumb = pageBreadcrumb?.path === pathname ? pageBreadcrumb.title
    : current?.childTitle && pathname.startsWith(`${current.to}/`) ? current.childTitle : undefined;
  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 36 };
  // Phones: the first sections become tabs; the rest, and the account menu when it lives in the sidebar, stay in the drawer.
  const tabs = items.slice(0, 4);
  const drawerOnly = items.slice(4);
  const needsMore = drawerOnly.length > 0 || accountPlacement === "sidebar";

  return (
    <PageBreadcrumbContext.Provider value={setPageBreadcrumb}>
    <PageActionsSlot.Provider value={pageActions}>
    <div className={`app-shell ${shellClassName}`} data-collapsed={collapsed || undefined} data-drawer={drawerOpen || undefined}>
      <button type="button" className="app-scrim" aria-label="Đóng menu" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerPath(null)} />
      <aside className="app-sidebar" aria-label={`Điều hướng ${subtitle}`}>
        <div className="app-sidebar__head">
          <Link to={home} className="app-sidebar__brand" aria-label={`PhysLive — ${subtitle}`}>
            <BrandMark size={30} wordmark={false} />
            <span className="app-sidebar__brand-copy"><strong>PhysLive</strong><small>{subtitle}</small></span>
          </Link>
        </div>

        <nav className="app-sidebar__nav">
          {groups.map((group, index) => (
            <div key={group.label ?? index} className="app-sidebar__group">
              {group.label && <p className="app-sidebar__label">{group.label}</p>}
              {group.items.map(item => {
                const active = current?.to === item.to;
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} className="app-sidebar__item" data-active={active || undefined} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>
                    {active && <motion.span layoutId={`app-sidebar-pill-${id}`} className="app-sidebar__pill" aria-hidden="true" transition={spring} />}
                    <LearningIcon name={item.icon} />
                    <span className="app-sidebar__text">{item.label}</span>
                    {Boolean(item.badge) && <span className="app-sidebar__badge" aria-label={`${item.badge} mục đang chờ`}>{item.badge! > 99 ? "99+" : item.badge}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {accountPlacement === "sidebar" && (
          <div className="app-sidebar__foot">
            <AccountMenu variant="sidebar" />
          </div>
        )}

      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button type="button" className="app-topbar__toggle app-topbar__toggle--desktop" onClick={toggleCollapsed} aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-pressed={collapsed} title="Thu gọn / mở rộng (Ctrl+B)"><LearningIcon name="panel" /></button>
          <button type="button" className="app-topbar__toggle app-topbar__toggle--mobile" onClick={() => setDrawerPath(drawerOpen ? null : pathname)} aria-label="Mở menu" aria-expanded={drawerOpen}><LearningIcon name="menu" /></button>
          <span className="app-topbar__divider" aria-hidden="true" />
          <p className="app-topbar__title"><span>{subtitle}</span>{current && <><span aria-hidden="true">/</span>{childCrumb ? <Link to={current.to} className="app-topbar__crumb-link">{current.title ?? current.label}</Link> : <strong>{current.title ?? current.label}</strong>}{childCrumb && <><span aria-hidden="true">/</span><strong className="app-topbar__crumb-child" title={childCrumb}>{childCrumb}</strong></>}</>}</p>
          <div className="app-topbar__actions">
            <div ref={setPageActions} className="app-topbar__page-actions" />
            {actions}
            {showThemeToggle && <ThemeToggle />}
            {accountPlacement === "topbar" && <AccountMenu variant="workspace" />}
          </div>
        </header>
        <div ref={contentRef} className={`app-content ${contentClassName}`}>
          {!ownHeading && current && <h1 className="sr-only" data-layout-heading>{current.title ?? current.label}</h1>}
          {children ?? <Outlet />}
        </div>
        <MobileTabBar
          items={tabs.map(item => ({ to: item.to, label: item.label, icon: item.icon, badge: item.badge, active: current?.to === item.to }))}
          more={needsMore ? { onOpen: () => setDrawerPath(pathname), badge: drawerOnly.reduce((sum, item) => sum + (item.badge ?? 0), 0), accountOnly: drawerOnly.length === 0 } : undefined}
        />
      </div>
    </div>
    </PageActionsSlot.Provider>
    </PageBreadcrumbContext.Provider>
  );
}
