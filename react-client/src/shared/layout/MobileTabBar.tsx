import { Link } from "react-router-dom";
import LearningIcon from "../ui/LearningIcon";
import "./MobileTabBar.css";

type IconName = Parameters<typeof LearningIcon>[0]["name"];

export type TabItem = { to: string; label: string; icon: IconName; active: boolean; badge?: number };

const count = (value?: number) => value && value > 0 ? (value > 99 ? "99+" : String(value)) : null;

/**
 * Phone navigation: the area's own sections as a bottom tab bar, the way a phone app is used with one thumb.
 * Hidden on wider screens, where the sidebar or header navigation is shown instead.
 */
export default function MobileTabBar({ items, more, spacer = true }: Readonly<{ items: TabItem[]; more?: { onOpen: () => void; badge?: number; accountOnly?: boolean }; spacer?: boolean }>) {
  return <>
    {spacer && <div className="mobile-tabbar-spacer" aria-hidden="true" />}
    <nav className="mobile-tabbar" aria-label="Điều hướng chính">
      {items.map(item => <Link key={item.to} to={item.to} className="mobile-tabbar__item" data-active={item.active || undefined} aria-current={item.active ? "page" : undefined}>
        <span className="mobile-tabbar__icon"><LearningIcon name={item.icon} />{count(item.badge) && <span className="mobile-tabbar__badge">{count(item.badge)}</span>}</span>
        <span className="mobile-tabbar__label">{item.label}</span>
      </Link>)}
      {more && <button type="button" className="mobile-tabbar__item" onClick={more.onOpen}>
        <span className="mobile-tabbar__icon"><LearningIcon name={more.accountOnly ? "users" : "menu"} />{count(more.badge) && <span className="mobile-tabbar__badge">{count(more.badge)}</span>}</span>
        <span className="mobile-tabbar__label">{more.accountOnly ? "Tài khoản" : "Thêm"}</span>
      </button>}
    </nav>
  </>;
}
