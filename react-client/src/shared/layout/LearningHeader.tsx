import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "../ui/LearningIcon";
import BrandMark from "../ui/BrandMark";
import { ActivePill } from "../effects/Motion";
import { ThemeSegmented } from "../theme/ThemeToggle";
import AccountMenu from "./AccountMenu";
import MobileTabBar from "./MobileTabBar";
import { useSessionStore } from "../auth/sessionStore";

type HeaderVariant = "workspace" | "submissions";

export type LearningHeaderProps = {
  variant?: HeaderVariant;
  onNewSimulation?: () => void;
  viewMode?: "2d" | "3d";
  threeDEnabled?: boolean;
  onViewModeChange?: (mode: "2d" | "3d") => void;
  libraryCollapsed?: boolean;
  onToggleLibrary?: () => void;
};

export default function LearningHeader({
  variant = "workspace",
  onNewSimulation,
  viewMode = "2d",
  threeDEnabled = false,
  onViewModeChange,
  libraryCollapsed = false,
  onToggleLibrary,
}: Readonly<LearningHeaderProps>) {
  const pathname = useLocation().pathname;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const user = useSessionStore(state => state.user);
  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  const isSubmissions = variant === "submissions";
  // three jobs, three places: make a simulation, run assignments (give, follow, grade), keep simulations
  const inLibrary = pathname.startsWith("/lab/library") || pathname.startsWith("/lab/community");
  const journey = [
    { to: "/workspace", label: "Mô phỏng", icon: "atom" as const, active: pathname === "/workspace" },
    { to: "/lab", label: "Bài tập", icon: "book" as const,
      active: pathname === "/assignments/workspace" || (pathname.startsWith("/lab") && !inLibrary) },
    { to: "/lab/library", label: "Thư viện", icon: "folder" as const, active: inLibrary },
  ];

  return (
    <header className="learn-header unified-header" data-header-variant={variant}>
      <div className="learn-header-left">
        <Link className="learn-brand" to="/" aria-label="PhysLive — về trang chủ">
          <BrandMark size={28} caption="Phòng học tương tác" />
        </Link>
        {!isSubmissions && (
          <>
            <div className="learn-settings-anchor" ref={settingsRef}>
              <button type="button" className="learn-header-icon" aria-label="Cài đặt workspace" title="Cài đặt workspace" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><Icon name="settings" /></button>
              {settingsOpen && <dialog open className="learn-settings-popover" aria-label="Cài đặt workspace">
                <strong>Cài đặt</strong>
                <span>Giao diện</span>
                <ThemeSegmented />
                <label htmlFor="learn-language">Ngôn ngữ</label>
                <select id="learn-language" defaultValue="vi" disabled><option value="vi">Tiếng Việt</option></select>
              </dialog>}
            </div>
            {onToggleLibrary && <button type="button" className="learn-header-icon" aria-label={libraryCollapsed ? "Mở thư viện" : "Thu gọn thư viện"} title={libraryCollapsed ? "Mở thư viện" : "Thu gọn thư viện"} onClick={onToggleLibrary}><Icon name="panel" /></button>}
          </>
        )}
      </div>

      <nav className="learn-journey" aria-label="Điều hướng workspace">
        {journey.map(step => <Link key={step.to} to={step.to} aria-current={step.active ? "page" : undefined} className={step.active ? "active" : ""}>{step.active && <ActivePill id="learn-journey-pill" />}<span>{step.label}</span></Link>)}
      </nav>
      {/* phones hide the journey links in the header; the same steps become the bottom tabs */}
      <MobileTabBar items={journey} spacer={false} />

      <div className="learn-header-actions">
        {!isSubmissions && <>
          {onNewSimulation && <button type="button" className="learn-header-action" onClick={onNewSimulation}><Icon name="plus" />Mô phỏng mới</button>}
          {onViewModeChange && <fieldset className="learn-view-switch"><legend className="learn-sr-only">Chế độ hiển thị</legend>
            <button type="button" className={viewMode === "2d" ? "active" : ""} aria-pressed={viewMode === "2d"} onClick={() => onViewModeChange("2d")} title="Hiển thị mặt phẳng 2D"><Icon name="view2d" />2D</button>
            <button type="button" className={viewMode === "3d" ? "active" : ""} aria-pressed={viewMode === "3d"} disabled={!threeDEnabled} onClick={() => onViewModeChange("3d")} title={threeDEnabled ? "Hiển thị không gian 3D" : "3D chưa được cung cấp cho schema này"}><Icon name="view3d" />3D</button>
          </fieldset>}
        </>}
        {user ? <AccountMenu variant="workspace" /> : <Link className="learn-back" to="/login"><Icon name="login" />Đăng nhập</Link>}
      </div>
    </header>
  );
}
