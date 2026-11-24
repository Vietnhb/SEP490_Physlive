import { useCustomerEmailAlerts, threadUrl } from "../components/useCustomerEmailAlerts";
import s from "./EmailAlerts.module.css";
import { usePendingSupport } from "../../../shared/hooks/usePendingSupport";
import { adminPlans } from "../../billing/api/billingApi";
import { usePlanNames } from "../../../shared/hooks/usePlanNames";
import { useEffect, useState } from "react";
import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { paymentNotifications, type PaymentNotification } from "../../billing/api/billingApi";
import LearningIcon from "../../../shared/ui/LearningIcon";
import AppSidebarLayout, { type SidebarGroup } from "../../../shared/layout/AppSidebar";

/** MANAGER area: platform operations. Every menu item is its own route under /manager. */
export default function AdminLayout() {
  const planName = usePlanNames(adminPlans);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [notificationError, setNotificationError] = useState(false);
  const pendingSupport = usePendingSupport();
  const emailAlerts = useCustomerEmailAlerts();
  const unreadEmails = emailAlerts.data?.unreadCount ?? 0;
  useEffect(() => {
    let active = true;
    const load = () => void paymentNotifications().then(items => { if (active) { setNotifications(items); setNotificationError(false); } }).catch(() => { if (active) setNotificationError(true); });
    load(); const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const toReconcile = notifications.filter(item => item.status === "REQUIRES_REVIEW").length;

  const groups: SidebarGroup[] = [
    { items: [{ to: "/manager", label: "Tổng quan", icon: "grid", end: true }] },
    { label: "Khách hàng", items: [
      { to: "/manager/schools", label: "Trường học", icon: "book" },
      { to: "/manager/users", label: "Người dùng", icon: "users", title: "Quản lý người dùng" },
      { to: "/manager/plans", label: "Gói dịch vụ", icon: "sliders" },
      { to: "/manager/customer-usage", label: "Sử dụng khách hàng", icon: "activity" },
      { to: "/manager/payments", label: "Thanh toán", icon: "chart", badge: toReconcile },
    ] },
    { label: "Hỗ trợ", items: [
      { to: "/manager/support", label: "Yêu cầu hỗ trợ", icon: "message", badge: pendingSupport },
      { to: "/manager/emails", label: "Nhật ký email", icon: "message", badge: unreadEmails },
    ] },
    { label: "Nội dung", items: [
      { to: "/manager/curriculum", label: "Chương trình học", icon: "file" },
      { to: "/manager/validation", label: "Kiểm định", icon: "activity" },
    ] },
  ];

  const bell = <DropdownMenu.Root><DropdownMenu.Trigger><IconButton variant="ghost" color="gray" className={s.bell} aria-label={"Thông báo"+(unreadEmails?" · "+unreadEmails+" email chưa đọc":"")}><LearningIcon name="bell" />{unreadEmails>0&&<span className={s.count}>{unreadEmails>99?"99+":unreadEmails}</span>}</IconButton></DropdownMenu.Trigger><DropdownMenu.Content align="end" sideOffset={8}>
    <DropdownMenu.Label>Email phản hồi chưa đọc · {unreadEmails}</DropdownMenu.Label>
    {emailAlerts.error?<DropdownMenu.Item onSelect={()=>void emailAlerts.refresh()}>Không tải được thông báo email. Thử lại</DropdownMenu.Item>:!emailAlerts.data?<DropdownMenu.Label>Đang tải thông báo…</DropdownMenu.Label>:!unreadEmails?<DropdownMenu.Label>Không có phản hồi chưa đọc</DropdownMenu.Label>:emailAlerts.data.items.map(item=><DropdownMenu.Item className={s.notification} key={item.id} onSelect={()=>navigate(threadUrl(item))}><strong>{item.schoolName} vừa phản hồi</strong><span>{item.subject}</span></DropdownMenu.Item>)}
    <DropdownMenu.Item onSelect={()=>navigate("/manager/emails")}>Mở hộp thư khách hàng →</DropdownMenu.Item>
    <DropdownMenu.Separator/><DropdownMenu.Label>Đăng ký & thanh toán của trường</DropdownMenu.Label><DropdownMenu.Separator />
    {notificationError ? <p>Không thể tải thông báo.</p> : notifications.length === 0 ? <p>Chưa có đăng ký đã thanh toán.</p> : notifications.map(item => <DropdownMenu.Item key={item.id} onSelect={() => navigate("/manager/schools")}><strong>{item.schoolName}</strong><span>{planName(item.planCode)} · {item.amountVnd.toLocaleString("vi-VN")} ₫{item.status === "REQUIRES_REVIEW" ? " · Cần đối soát" : ""}</span><small>{new Date(item.paidAt).toLocaleString("vi-VN")}</small></DropdownMenu.Item>)}
  </DropdownMenu.Content></DropdownMenu.Root>;

  return <>{emailAlerts.notice&&<div className={s.toast} role="status"><div><strong>Trường vừa phản hồi email</strong><span>{emailAlerts.notice.schoolName}</span></div><button onClick={()=>{navigate(threadUrl(emailAlerts.notice!));emailAlerts.dismiss();}}>Xem thư</button><button aria-label="Đóng thông báo email" onClick={emailAlerts.dismiss}>×</button></div>}<AppSidebarLayout id="manager" subtitle="Vận hành" home="/manager" groups={groups} actions={bell} contentClassName="admin-shell" /></>;
}
