import AppSidebarLayout, { type SidebarGroup } from "../../../shared/layout/AppSidebar";
import "../styles/admin-directory.css";
export { default as AdminOverviewPage } from "./AdminOverview";

const groups: SidebarGroup[] = [
  { items: [{ to: "/admin", label: "Tổng quan", icon: "grid", end: true }] },
  { label: "Quản trị", items: [{ to: "/admin/users", label: "Tài khoản người dùng", icon: "users" }] },
];

/** ADMIN sees every account and manages manager accounts through the directory. */
export default function AdminAreaLayout() {
  return <AppSidebarLayout id="admin" subtitle="Quản trị hệ thống" home="/admin" groups={groups} />;
}
